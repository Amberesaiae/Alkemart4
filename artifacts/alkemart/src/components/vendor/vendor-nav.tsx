import { Link, useLocation } from "@tanstack/react-router";
import { LayoutDashboard, Store, PackageSearch, ClipboardList, MessageSquare } from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuBadge,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import { useListMyConversations, getListMyConversationsQueryKey } from "@workspace/api-client-react";
import { getLastSeenAt } from "@/lib/vendor-messages-seen";

const BASE_NAV_ITEMS = [
  { to: "/vendor", label: "Overview", icon: LayoutDashboard },
  { to: "/vendor/store", label: "Store profile", icon: Store },
  { to: "/vendor/orders", label: "Orders", icon: ClipboardList },
  { to: "/vendor/products", label: "Products", icon: PackageSearch },
] as const;

function MessagesNavItem({ isActive }: { isActive: boolean }) {
  const { data: conversations } = useListMyConversations({
    query: {
      queryKey: getListMyConversationsQueryKey(),
      refetchInterval: 30_000,
      staleTime: 20_000,
    },
  });

  const unreadCount = (() => {
    if (!conversations) return 0;
    const lastSeen = getLastSeenAt();
    return conversations.filter((c) => new Date(c.lastMessageAt) > lastSeen).length;
  })();

  return (
    <SidebarMenuItem>
      <SidebarMenuButton asChild tooltip="Messages" isActive={isActive}>
        <Link to="/vendor/messages">
          <MessageSquare />
          <span>Messages</span>
        </Link>
      </SidebarMenuButton>
      {unreadCount > 0 && (
        <SidebarMenuBadge className="bg-destructive text-destructive-foreground">
          {unreadCount}
        </SidebarMenuBadge>
      )}
    </SidebarMenuItem>
  );
}

function VendorSidebar() {
  const { pathname } = useLocation();

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="border-b border-border">
        <div className="flex items-center gap-2 px-2 py-1.5">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary text-sm font-bold text-primary-foreground">
            V
          </div>
          <div className="text-sm font-semibold group-data-[collapsible=icon]:hidden">Vendor dashboard</div>
        </div>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Your store</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {BASE_NAV_ITEMS.map((item) => {
                const isActive = item.to === "/vendor" ? pathname === "/vendor" : pathname.startsWith(item.to);
                return (
                  <SidebarMenuItem key={item.to}>
                    <SidebarMenuButton asChild tooltip={item.label} isActive={isActive}>
                      <Link to={item.to}>
                        <item.icon />
                        <span>{item.label}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
              <MessagesNavItem isActive={pathname.startsWith("/vendor/messages")} />
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
    </Sidebar>
  );
}

export function VendorShell({ title, description, children }: { title: string; description?: string; children: React.ReactNode }) {
  return (
    <SidebarProvider>
      <VendorSidebar />
      <SidebarInset>
        <div className="mx-auto w-full max-w-[1200px] space-y-6 px-6 py-8">
          <header className="flex items-start gap-3">
            <SidebarTrigger className="mt-1" />
            <div>
              <div className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Vendor dashboard</div>
              <h1 className="mt-1 font-display text-3xl font-bold tracking-tight">{title}</h1>
              {description && <p className="mt-1 text-muted-foreground">{description}</p>}
            </div>
          </header>

          <div>{children}</div>
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}
