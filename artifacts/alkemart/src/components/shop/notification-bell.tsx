import { BellIcon } from "@radix-ui/react-icons";
import { useQueryClient } from "@tanstack/react-query";
import {
  useListMyNotifications,
  useMarkNotificationRead,
  getListMyNotificationsQueryKey,
  type Notification,
} from "@workspace/api-client-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";

function describeNotification(notification: Notification): string {
  const data = notification.data as Record<string, unknown> | null;
  const orderId = data?.orderId;
  switch (notification.type) {
    case "order.confirmed":
      return `Order #${orderId} confirmed — thanks for shopping with us!`;
    case "order.new_for_vendor":
      return `New order #${orderId} received for your shop.`;
    case "fulfillment.shipped":
      return `Order #${orderId} is on its way — your package has shipped!`;
    case "fulfillment.delivered":
      return `Order #${orderId} has been delivered. Enjoy!`;
    default:
      return "You have a new notification.";
  }
}

export function NotificationBell() {
  const { data } = useListMyNotifications({
    query: {
      queryKey: getListMyNotificationsQueryKey(),
      refetchInterval: 15000,
      refetchOnWindowFocus: true,
    },
  });
  const queryClient = useQueryClient();
  const notifications = data?.items ?? [];
  const unreadCount = notifications.filter((n) => !n.isRead).length;

  const markRead = useMarkNotificationRead({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListMyNotificationsQueryKey() });
      },
    },
  });

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          aria-label="Notifications"
          className="relative hidden items-center justify-center rounded-full p-2 hover:bg-primary-hover md:flex"
        >
          <BellIcon className="h-5 w-5" />
          {unreadCount > 0 && (
            <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-accent px-1 text-[10px] font-bold text-accent-foreground">
              {unreadCount}
            </span>
          )}
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" sideOffset={12} className="w-80 rounded-xl p-2 text-foreground">
        <DropdownMenuLabel>Notifications</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {notifications.length === 0 ? (
          <p className="px-2 py-4 text-center text-sm text-muted-foreground">No notifications yet.</p>
        ) : (
          <div className="flex max-h-96 flex-col gap-1 overflow-y-auto">
            {notifications.map((notification) => (
              <button
                key={notification.id}
                type="button"
                aria-label={describeNotification(notification)}
                onClick={() => {
                  if (!notification.isRead) {
                    markRead.mutate({ id: notification.id });
                  }
                }}
                className={`flex flex-col items-start gap-0.5 rounded-lg px-2 py-2 text-left text-sm hover:bg-muted ${
                  notification.isRead ? "text-muted-foreground" : "font-medium text-foreground"
                }`}
              >
                <span className="flex w-full items-center gap-2">
                  {!notification.isRead && <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-accent" />}
                  {describeNotification(notification)}
                </span>
                <span className="text-xs text-muted-foreground">
                  {new Date(notification.createdAt).toLocaleString()}
                </span>
              </button>
            ))}
          </div>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
