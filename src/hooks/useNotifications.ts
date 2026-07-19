import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export type AppNotification = {
  id: string;
  user_id: string;
  title: string;
  message: string;
  type: string;
  link: string | null;
  is_read: boolean;
  created_at: string;
};

export function notificationsQueryKey(userId?: string | null) {
  return ["notifications", userId] as const;
}

export function useNotifications() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const queryKey = notificationsQueryKey(user?.id);

  const { data: notifications = [], isLoading } = useQuery({
    queryKey,
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("notifications")
        .select("*")
        .eq("user_id", user!.id)
        .order("created_at", { ascending: false })
        .limit(20);
      if (error) throw error;
      return (data || []) as AppNotification[];
    },
  });

  const unreadCount = notifications.filter((n) => !n.is_read).length;

  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel(`notifications-realtime-${user.id}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "notifications",
          filter: `user_id=eq.${user.id}`,
        },
        () => {
          queryClient.invalidateQueries({ queryKey: notificationsQueryKey(user.id) });
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, queryClient]);

  const markAllRead = async () => {
    if (!user || unreadCount === 0) return;
    queryClient.setQueryData<AppNotification[]>(queryKey, (prev) =>
      (prev || []).map((n) => ({ ...n, is_read: true })),
    );
    const { error } = await supabase
      .from("notifications")
      .update({ is_read: true })
      .eq("user_id", user.id)
      .eq("is_read", false);
    if (error) queryClient.invalidateQueries({ queryKey });
  };

  const markRead = async (id: string) => {
    if (!user) return;
    queryClient.setQueryData<AppNotification[]>(queryKey, (prev) =>
      (prev || []).map((n) => (n.id === id ? { ...n, is_read: true } : n)),
    );
    const { error } = await supabase.from("notifications").update({ is_read: true }).eq("id", id);
    if (error) queryClient.invalidateQueries({ queryKey });
  };

  const dismissNotification = async (id: string) => {
    if (!user) return;
    queryClient.setQueryData<AppNotification[]>(queryKey, (prev) =>
      (prev || []).filter((n) => n.id !== id),
    );
    const { error } = await supabase.from("notifications").delete().eq("id", id).eq("user_id", user.id);
    if (error) queryClient.invalidateQueries({ queryKey });
  };

  return {
    notifications,
    unreadCount,
    isLoading,
    markAllRead,
    markRead,
    dismissNotification,
  };
}
