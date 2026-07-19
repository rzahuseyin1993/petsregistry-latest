import { useState } from "react";
import { Bell, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { useAuth } from "@/contexts/AuthContext";
import { useNotifications } from "@/hooks/useNotifications";
import { Link } from "react-router-dom";
import { formatDistanceToNow } from "date-fns";

const typeIcons: Record<string, string> = {
  lost_pet: "🚨",
  adoption: "🏠",
  health: "💊",
  info: "ℹ️",
};

interface NotificationBellProps {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  showTrigger?: boolean;
  /** Sheet works better in narrow sidebars; popover for navbar/mobile header */
  mode?: "popover" | "sheet";
}

function NotificationBadge({ count }: { count: number }) {
  if (count <= 0) return null;
  return (
    <span className="absolute -right-0.5 -top-0.5 flex h-5 w-5 items-center justify-center rounded-full bg-destructive text-[10px] font-bold text-destructive-foreground">
      {count > 9 ? "9+" : count}
    </span>
  );
}

function NotificationList({
  notifications,
  unreadCount,
  onMarkAllRead,
  onMarkRead,
  onDismiss,
  onClose,
  inSheet = false,
}: {
  notifications: ReturnType<typeof useNotifications>["notifications"];
  unreadCount: number;
  onMarkAllRead: () => void;
  onMarkRead: (id: string) => void;
  onDismiss: (id: string) => void;
  onClose: () => void;
  inSheet?: boolean;
}) {
  return (
    <div className={`flex min-h-0 flex-col ${inSheet ? "h-full" : ""}`}>
      <div className={`flex shrink-0 items-center justify-between border-b border-border px-4 py-3 ${inSheet ? "pr-12" : ""}`}>
        <h4 className="font-display font-semibold text-foreground">Notifications</h4>
        {unreadCount > 0 && (
          <Button variant="ghost" size="sm" className="text-xs text-primary" onClick={onMarkAllRead}>
            Mark all read
          </Button>
        )}
      </div>

      <div
        className={
          inSheet
            ? "min-h-0 flex-1 overflow-y-auto overscroll-contain"
            : "max-h-[min(20rem,calc(100vh-10rem))] overflow-y-auto overscroll-contain"
        }
      >
        {notifications.length === 0 ? (
          <div className="py-8 text-center text-sm text-muted-foreground">No notifications yet</div>
        ) : (
          notifications.map((n) => (
            <div
              key={n.id}
              className={`group flex gap-3 border-b border-border px-4 py-3 transition-colors ${!n.is_read ? "bg-primary/5" : ""}`}
            >
              <span className="mt-0.5 shrink-0 text-lg">{typeIcons[n.type] || "📌"}</span>
              <button
                type="button"
                className="flex min-w-0 flex-1 cursor-pointer text-left"
                onClick={() => {
                  if (!n.is_read) onMarkRead(n.id);
                }}
              >
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-foreground">{n.title}</p>
                  <p className="text-xs text-muted-foreground line-clamp-2">{n.message}</p>
                  <div className="mt-1 flex items-center gap-2">
                    <span className="text-[10px] text-muted-foreground">
                      {formatDistanceToNow(new Date(n.created_at), { addSuffix: true })}
                    </span>
                    {n.link && (
                      <Link
                        to={n.link}
                        onClick={(e) => {
                          e.stopPropagation();
                          onClose();
                          onMarkRead(n.id);
                        }}
                        className="text-[10px] font-medium text-primary hover:underline"
                      >
                        View →
                      </Link>
                    )}
                  </div>
                </div>
              </button>
              <div className="flex shrink-0 flex-col items-center gap-1 pt-0.5">
                {!n.is_read && <span className="h-2 w-2 rounded-full bg-primary" />}
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 opacity-60 hover:opacity-100"
                  aria-label="Dismiss notification"
                  onClick={(e) => {
                    e.stopPropagation();
                    onDismiss(n.id);
                  }}
                >
                  <X className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

const NotificationBell = ({
  open: controlledOpen,
  onOpenChange,
  showTrigger = true,
  mode = "popover",
}: NotificationBellProps = {}) => {
  const { user } = useAuth();
  const { notifications, unreadCount, markAllRead, markRead, dismissNotification } = useNotifications();
  const [internalOpen, setInternalOpen] = useState(false);
  const open = controlledOpen ?? internalOpen;
  const setOpen = onOpenChange ?? setInternalOpen;

  if (!user) return null;

  const list = (
    <NotificationList
      notifications={notifications}
      unreadCount={unreadCount}
      onMarkAllRead={markAllRead}
      onMarkRead={markRead}
      onDismiss={dismissNotification}
      onClose={() => setOpen(false)}
      inSheet={mode === "sheet" || !showTrigger}
    />
  );

  const triggerButton = (
    <Button variant="ghost" size="icon" className="relative shrink-0" aria-label="Notifications">
      <Bell className="h-5 w-5" />
      <NotificationBadge count={unreadCount} />
    </Button>
  );

  if (mode === "sheet" || !showTrigger) {
    return (
      <>
        {showTrigger && (
          <Button
            variant="ghost"
            size="icon"
            className="relative shrink-0"
            aria-label="Notifications"
            onClick={() => setOpen(true)}
          >
            <Bell className="h-5 w-5" />
            <NotificationBadge count={unreadCount} />
          </Button>
        )}
        <Sheet open={open} onOpenChange={setOpen}>
          <SheetContent side="right" className="flex w-full flex-col p-0 sm:max-w-md">
            <SheetHeader className="sr-only">
              <SheetTitle>Notifications</SheetTitle>
            </SheetHeader>
            {list}
          </SheetContent>
        </Sheet>
      </>
    );
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>{triggerButton}</PopoverTrigger>
      <PopoverContent
        className="w-80 overflow-hidden p-0"
        align="end"
        side="bottom"
        sideOffset={8}
        collisionPadding={12}
      >
        {list}
      </PopoverContent>
    </Popover>
  );
};

export default NotificationBell;
