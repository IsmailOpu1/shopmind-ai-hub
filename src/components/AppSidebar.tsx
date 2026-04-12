import { Home, LayoutGrid, Settings, LogOut, Brain, User } from "lucide-react";
import { NavLink } from "@/components/NavLink";
import { useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useEffect, useState } from "react";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarFooter,
  useSidebar,
} from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";

const navItems = [
  { title: "Dashboard", url: "/dashboard", icon: Home },
  { title: "Products", url: "/dashboard/products", icon: LayoutGrid },
  { title: "Chatbot Settings", url: "/dashboard/chatbot", icon: Settings },
];

export function AppSidebar() {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const location = useLocation();
  const navigate = useNavigate();
  const { signOut, user } = useAuth();
  const [businessName, setBusinessName] = useState<string>("");

  useEffect(() => {
    const fetchBusiness = async () => {
      if (!user) return;
      const { data } = await supabase
        .from("businesses")
        .select("name")
        .eq("owner_id", user.id)
        .maybeSingle();
      if (data) setBusinessName(data.name);
    };
    fetchBusiness();
  }, [user]);

  const handleLogout = async () => {
    await signOut();
    navigate("/login");
  };

  const businessInitial = businessName.charAt(0).toUpperCase();

  return (
    <Sidebar collapsible="icon" className="sidebar-dark">
      <SidebarContent>
        <div className="flex items-center gap-2 px-4 py-5">
          <Brain className="h-6 w-6 shrink-0 text-blue-400" />
          {!collapsed && <span className="text-lg font-bold text-gradient-blue-purple">ShopMind AI</span>}
        </div>

        <div className="sidebar-divider mx-4" />

        <SidebarGroup>
          <SidebarGroupLabel className="text-gray-400">Menu</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {navItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild>
                    <NavLink
                      to={item.url}
                      end={item.url === "/dashboard"}
                      className="sidebar-nav-item text-gray-300 hover:text-white"
                      activeClassName="sidebar-nav-item active text-white font-medium"
                    >
                      <item.icon className="mr-2 h-5 w-5" />
                      {!collapsed && <span>{item.title}</span>}
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="p-3 flex flex-col gap-2">
        {!collapsed && (
          <div className="flex items-center gap-3 px-2 py-2 mb-2">
            <div className="h-8 w-8 rounded-full user-avatar flex items-center justify-center text-white font-semibold text-sm">
              {businessInitial || "U"}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-white truncate">{businessName || "Loading..."}</p>
            </div>
          </div>
        )}
        <Button
          variant="ghost"
          className="w-full justify-start text-gray-400 hover:text-red-400 sidebar-logout transition-all duration-200"
          onClick={handleLogout}
        >
          <LogOut className="mr-2 h-4 w-4" />
          {!collapsed && <span>Logout</span>}
        </Button>
      </SidebarFooter>
    </Sidebar>
  );
}
