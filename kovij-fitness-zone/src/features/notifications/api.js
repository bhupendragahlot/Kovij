import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { api } from "../../app/http";

export const notificationKeys = {
  all: ["notifications"],
  log: (source, params) => ["notifications", "log", source, params],
  member: (memberId) => ["notifications", "member", memberId],
};

const SOURCES = {
  all: "/admin/notifications",
  reminders: "/admin/reminders/history",
};

/** Everything sent to members (or only automatic reminders), newest first. */
export function useNotificationLog(source, params) {
  return useQuery({
    queryKey: notificationKeys.log(source, params),
    queryFn: () => api.get(SOURCES[source] || SOURCES.all, params),
    placeholderData: keepPreviousData,
  });
}
