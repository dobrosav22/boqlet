"use client";

import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { Schemas } from "@ifc-boq/api";
import { api } from "@/api/client";
import { keys } from "@/api/keys";

export type Notification = Schemas["Notification"];
export type NotificationPreferences = Schemas["NotificationPreferences"];

/** The newest notifications and the unread count (the bell, F13). `notification.created` refetches it. */
export function useNotifications(limit = 8) {
  return useQuery({
    queryKey: [...keys.notifications(), "latest", limit],
    queryFn: async () => (await api.GET("/notifications", { params: { query: { limit } } })).data!,
  });
}

/** Every notification, paged (S26). */
export function useNotificationPages(unreadOnly: boolean) {
  return useInfiniteQuery({
    queryKey: [...keys.notifications(), "pages", unreadOnly],
    initialPageParam: undefined as string | undefined,
    queryFn: async ({ pageParam }) =>
      (await api.GET("/notifications", { params: { query: { limit: 50, ...(unreadOnly ? { unreadOnly: true } : {}), ...(pageParam ? { cursor: pageParam } : {}) } } })).data!,
    getNextPageParam: (last) => last.nextCursor ?? undefined,
  });
}

export function useMarkRead() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => api.POST("/notifications/{notificationId}/read", { params: { path: { notificationId: id } } }),
    onSettled: () => client.invalidateQueries({ queryKey: keys.notifications() }),
  });
}

export function useMarkAllRead() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: async () => api.POST("/notifications/read-all"),
    onSettled: () => client.invalidateQueries({ queryKey: keys.notifications() }),
  });
}

export function useNotificationPreferences() {
  return useQuery({ queryKey: keys.notificationPreferences(), queryFn: async () => (await api.GET("/me/notification-preferences")).data! });
}

export function useSetNotificationPreferences() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: async (prefs: NotificationPreferences) => (await api.PUT("/me/notification-preferences", { body: prefs })).data!,
    // Shown at once; the server's answer (or the old value, on an error) replaces it.
    onMutate: (prefs) => {
      const before = client.getQueryData<NotificationPreferences>(keys.notificationPreferences());
      client.setQueryData<NotificationPreferences>(keys.notificationPreferences(), { email: { ...(before?.email ?? {}), ...(prefs.email ?? {}) } });
      void client.cancelQueries({ queryKey: keys.notificationPreferences() });
      return { before };
    },
    onError: (_e, _p, ctx) => client.setQueryData(keys.notificationPreferences(), ctx?.before),
    onSuccess: (data) => client.setQueryData(keys.notificationPreferences(), data),
  });
}
