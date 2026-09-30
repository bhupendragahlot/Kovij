import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, http } from "../../app/http";
import { qk } from "../../app/queryKeys";
import { retryDelay, retryIdempotent } from "../../app/queryClient";

/** Query keys for body progress (wellness module). */
export const progressKeys = {
  member: (memberId) => ["progress", memberId],
  photos: (memberId) => ["progress", memberId, "photos"],
  photo: (url, version) => ["progress", "photo", url, version],
};

const base = (memberId) => `/admin/members/${memberId}/progress`;

export function useProgress(memberId, { enabled = true } = {}) {
  return useQuery({
    queryKey: progressKeys.member(memberId),
    queryFn: () => api.get(base(memberId)),
    enabled: Boolean(memberId) && enabled,
  });
}

/** After a measurement changes: progress, and the profile (its weight and BMI follow the newest entry). */
function useInvalidateProgress(memberId) {
  const queryClient = useQueryClient();
  return () => {
    queryClient.invalidateQueries({ queryKey: progressKeys.member(memberId), exact: true });
    queryClient.invalidateQueries({ queryKey: qk.members.detail(memberId) });
  };
}

/** New entry (idempotent: a retried save never records twice) or edit of an existing one. */
export function useSaveEntry(memberId) {
  const invalidate = useInvalidateProgress(memberId);
  return useMutation({
    mutationFn: ({ id, payload, idempotencyKey }) =>
      id ? api.patch(`${base(memberId)}/entries/${id}`, payload) : api.post(`${base(memberId)}/entries`, payload, { idempotencyKey }),
    retry: retryIdempotent,
    retryDelay,
    onSuccess: invalidate,
  });
}

export function useDeleteEntry(memberId) {
  const invalidate = useInvalidateProgress(memberId);
  return useMutation({ mutationFn: (id) => api.delete(`${base(memberId)}/entries/${id}`), onSuccess: invalidate });
}

export function usePhotos(memberId, { enabled = true } = {}) {
  return useQuery({
    queryKey: progressKeys.photos(memberId),
    queryFn: () => api.get(`${base(memberId)}/photos`),
    enabled: Boolean(memberId) && enabled,
  });
}

/** Upload one photo (a prepared JPEG blob). Same day and pose replaces, so a retry is harmless. */
export function useUploadPhoto(memberId) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ blob, pose, day }) => {
      const form = new FormData();
      form.append("pose", pose);
      form.append("day", day);
      form.append("photo", blob, `${pose}.jpg`);
      return api.post(`${base(memberId)}/photos`, form);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: progressKeys.photos(memberId) }),
  });
}

export function useDeletePhoto(memberId) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (photoId) => api.delete(`${base(memberId)}/photos/${photoId}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: progressKeys.photos(memberId) }),
  });
}

/**
 * A private photo, fetched with the staff token and shown from memory. The file is never a public
 * link; `version` (the photo's updatedAt) makes a replaced photo load fresh.
 */
export function usePrivateImage(url, version) {
  const query = useQuery({
    queryKey: progressKeys.photo(url, version),
    queryFn: () => http.get(url, { responseType: "blob" }).then((r) => r.data),
    enabled: Boolean(url),
    staleTime: Infinity,
    gcTime: 5 * 60_000,
    retry: 1,
  });
  const [src, setSrc] = useState(null);
  useEffect(() => {
    if (!query.data) {
      setSrc(null);
      return undefined;
    }
    const objectUrl = URL.createObjectURL(query.data);
    setSrc(objectUrl);
    return () => URL.revokeObjectURL(objectUrl);
  }, [query.data]);
  return { src, isPending: query.isPending || (query.data && !src), isError: query.isError, refetch: query.refetch };
}
