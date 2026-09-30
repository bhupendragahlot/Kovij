import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../../app/http";
import { qk } from "../../app/queryKeys";

export function useCampaigns() {
  return useQuery({ queryKey: qk.campaigns.all, queryFn: () => api.get("/campaigns"), select: (d) => d.campaigns });
}

export function useAudienceCount(filter) {
  return useQuery({
    queryKey: qk.campaigns.audience(filter),
    queryFn: () => api.get(`/campaigns/audience/${filter}`),
    select: (d) => d.count,
    enabled: Boolean(filter),
  });
}

function useCampaignMutation(fn) {
  const queryClient = useQueryClient();
  return useMutation({ mutationFn: fn, onSuccess: () => queryClient.invalidateQueries({ queryKey: qk.campaigns.all }) });
}

export const useCreateCampaign = () => useCampaignMutation((payload) => api.post("/campaigns", payload));
export const useSendCampaign = () => useCampaignMutation((id) => api.post(`/campaigns/${id}/send`));
export const useTestCampaign = () => useCampaignMutation(({ id, to }) => api.post(`/campaigns/${id}/test`, { to }));
