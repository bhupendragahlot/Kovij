import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../../app/http";
import { retryDelay, retryIdempotent } from "../../app/queryClient";

/** Staff notes on a member (wellness module). Staff only: no member route returns them. */
export const noteKeys = {
  member: (memberId) => ["notes", memberId],
  list: (memberId, params) => ["notes", memberId, params],
};

const base = (memberId) => `/admin/members/${memberId}/notes`;

export function useNotes(memberId, params) {
  return useQuery({
    queryKey: noteKeys.list(memberId, params),
    queryFn: () => api.get(base(memberId), params),
    placeholderData: keepPreviousData,
    enabled: Boolean(memberId),
  });
}

function useNoteMutation(memberId, fn, options = {}) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: fn,
    ...options,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: noteKeys.member(memberId) }),
  });
}

/** Idempotent: a double tap adds the note once. */
export const useAddNote = (memberId) =>
  useNoteMutation(memberId, ({ payload, idempotencyKey }) => api.post(base(memberId), payload, { idempotencyKey }), { retry: retryIdempotent, retryDelay });

export const useUpdateNote = (memberId) => useNoteMutation(memberId, ({ id, patch }) => api.patch(`${base(memberId)}/${id}`, patch));

export const useDeleteNote = (memberId) => useNoteMutation(memberId, (id) => api.delete(`${base(memberId)}/${id}`));
