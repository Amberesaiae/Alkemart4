import { Link, useLocation } from "@tanstack/react-router";
import { LayoutDashboard, Store, PackageSearch, ClipboardList } from "lucide-react";
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
  { to: "/vendor", label: "Overview", icon: LayoutDashboard },
  { to: "/vendor/store", label: "Store profile", icon: Store },
  { to: "/vendor/orders", label: "Orders", icon: ClipboardList },
  { to: "/vendor/products", label: "Products", icon: PackageSearch },
] as const;

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
              {navItems.map((item) => {
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
