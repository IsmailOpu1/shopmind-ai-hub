import { useEffect, useState } from "react";
import { Outlet } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";
import ChatWidget from "@/components/ChatWidget";

const DashboardLayout = () => {
  const { user } = useAuth();
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

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full">
        <AppSidebar />
        <div className="flex-1 flex flex-col min-w-0">
          <header className="h-14 flex items-center justify-between border-b border-border px-4">
            <div className="flex items-center gap-2">
              <SidebarTrigger />
              <span className="text-sm font-medium text-muted-foreground truncate">
                {businessName || "Loading..."}
              </span>
            </div>
          </header>
          <main className="flex-1 p-4 sm:p-6 overflow-x-hidden">
            <Outlet />
          </main>
          <ChatWidget />
        </div>
      </div>
    </SidebarProvider>
  );
};

export default DashboardLayout;
