import { Brain, LogOut } from "lucide-react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuBadge,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";
import { NAV_GROUPS, navItemFor } from "@/lib/nav";

type Props = { businessName: string; waiting: number };

export function AppSidebar({ businessName, waiting }: Props) {
  const { state, isMobile, setOpenMobile } = useSidebar();
  const collapsed = state === "collapsed" && !isMobile;
  const location = useLocation();
  const navigate = useNavigate();
  const { signOut, user } = useAuth();
  const current = navItemFor(location.pathname);

  const handleLogout = async () => {
    await signOut();
    navigate("/login");
  };

  return (
    <Sidebar collapsible="icon" className="app-sidebar border-r border-white/[0.06]">
      <SidebarHeader className="px-3 pb-2 pt-4">
        <Link to="/dashboard" className="flex items-center gap-2.5 rounded-xl px-1 py-1" onClick={() => setOpenMobile(false)}>
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-blue-500 to-violet-600 shadow-lg shadow-blue-900/50">
            <Brain className="h-5 w-5 text-white" />
          </span>
          {!collapsed && <span className="text-base font-semibold tracking-tight text-white">ShopMind AI</span>}
        </Link>
      </SidebarHeader>

      <SidebarContent className="px-1">
        {NAV_GROUPS.map((group) => (
          <SidebarGroup key={group.label} className="py-1.5">
            <SidebarGroupLabel className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">
              {group.label}
            </SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {group.items.map((item) => {
                  const active = current?.url === item.url;
                  const badge = item.url === "/dashboard/inbox" && waiting > 0 ? waiting : 0;
                  return (
                    <SidebarMenuItem key={item.url}>
                      <SidebarMenuButton
                        asChild
                        isActive={active}
                        tooltip={item.title}
                        className="app-nav-item h-10 rounded-xl text-slate-400"
                      >
                        <Link to={item.url} aria-current={active ? "page" : undefined} onClick={() => setOpenMobile(false)}>
                          <item.icon className="h-[18px] w-[18px]" />
                          <span>{item.title}</span>
                        </Link>
                      </SidebarMenuButton>
                      {badge > 0 && (
                        <SidebarMenuBadge
                          className="app-nav-badge right-2 top-2.5 rounded-full px-1.5 text-[11px] font-semibold"
                          aria-label={`${badge} waiting`}
                        >
                          {badge}
                        </SidebarMenuBadge>
                      )}
                    </SidebarMenuItem>
                  );
                })}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        ))}
      </SidebarContent>

      <SidebarFooter className="p-3">
        <div className={`app-user-card flex items-center gap-3 rounded-2xl ${collapsed ? "justify-center p-1" : "p-2.5"}`}>
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-blue-500/80 to-violet-600/80 text-sm font-semibold text-white">
            {(businessName.charAt(0) || "S").toUpperCase()}
          </div>
          {!collapsed && (
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-white">{businessName || "Your store"}</p>
              <p className="truncate text-xs text-slate-500">{user?.email}</p>
            </div>
          )}
          {!collapsed && (
            <button
              type="button"
              onClick={handleLogout}
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-red-500/10 hover:text-red-400"
              aria-label="Log out"
              title="Log out"
            >
              <LogOut className="h-4 w-4" />
            </button>
          )}
        </div>
        {collapsed && (
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton tooltip="Log out" onClick={handleLogout} className="text-slate-400 hover:text-red-400">
                <LogOut className="h-4 w-4" />
                <span>Log out</span>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        )}
      </SidebarFooter>
    </Sidebar>
  );
}
