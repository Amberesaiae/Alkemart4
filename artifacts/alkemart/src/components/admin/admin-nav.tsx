import { Link, useLocation } from "@tanstack/react-router";
import {
  LayoutDashboard,
  Store,
  ShieldAlert,
  LayoutTemplate,
  Tag,
  ImageIcon,
  Inbox,
} from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar";

const navItems = [
  { to: "/admin", label: "Overview", icon: LayoutDashboard },
  { to: "/admin/vendors", label: "Vendors", icon: Store },
  { to: "/admin/disputes", label: "Disputes", icon: ShieldAlert },
  { to: "/admin/homepage", label: "Homepage sections", icon: LayoutTemplate },
  { to: "/admin/promotions", label: "Promotions", icon: Tag },
  { to: "/admin/images", label: "Image moderation", icon: ImageIcon },
  { to: "/admin/inbox", label: "Inbox", icon: Inbox },
] as const;

function AdminSidebar() {
  const { pathname } = useLocation();

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="border-b border-border">
        <div className="flex items-center gap-2 px-2 py-1.5">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary text-sm font-bold text-primary-foreground">
            A
          </div>
          <div className="text-sm font-semibold group-data-[collapsible=icon]:hidden">Admin panel</div>
        </div>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Operations</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {navItems.map((item) => {
                const isActive = item.to === "/admin" ? pathname === "/admin" : pathname.startsWith(item.to);
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
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
    </Sidebar>
  );
}

export function AdminShell({ title, description, children }: { title: string; description?: string; children: React.ReactNode }) {
  return (
    <SidebarProvider>
      <AdminSidebar />
      <SidebarInset>
        <div className="mx-auto w-full max-w-[1400px] space-y-6 px-6 py-8">
          <header className="flex items-start gap-3">
            <SidebarTrigger className="mt-1" />
            <div>
              <div className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Admin panel</div>
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
