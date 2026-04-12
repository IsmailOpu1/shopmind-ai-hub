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
  const [currentDate, setCurrentDate] = useState<string>("");

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

  useEffect(() => {
    const updateDate = () => {
      const now = new Date();
      const options: Intl.DateTimeFormatOptions = {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      };
      setCurrentDate(now.toLocaleDateString('en-US', options));
    };
    updateDate();
  }, []);

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full dashboard-background">
        {/* Background effects */}
        <div className="dashboard-gradient-mesh" />
        
        {/* Top left blue orb */}
        <div style={{
          position: 'fixed',
          top: '-100px',
          left: '-100px', 
          width: '500px',
          height: '500px',
          borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(29,78,216,0.25) 0%, transparent 70%)',
          filter: 'blur(60px)',
          zIndex: 0,
          pointerEvents: 'none'
        }} />
        
        {/* Bottom right purple orb */}
        <div style={{
          position: 'fixed',
          bottom: '-100px',
          right: '-100px',
          width: '450px',
          height: '450px',
          borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(109,40,217,0.2) 0%, transparent 70%)',
          filter: 'blur(60px)',
          zIndex: 0,
          pointerEvents: 'none'
        }} />
        
        <div className="dashboard-dot-grid" />
        
        {/* Floating dot particles drifting upward */}
        <div className="absolute inset-0" style={{ zIndex: 0, pointerEvents: 'none' }}>
          {[...Array(15)].map((_, i) => (
            <div
              key={i}
              className="absolute rounded-full bg-blue-400/30 animate-float-up"
              style={{
                width: Math.random() * 6 + 2 + "px",
                height: Math.random() * 6 + 2 + "px",
                left: Math.random() * 100 + "%",
                animationDelay: Math.random() * 10 + "s",
                animationDuration: Math.random() * 15 + 20 + "s",
              }}
            />
          ))}
        </div>

        <AppSidebar />
        <div className="flex-1 flex flex-col min-w-0 relative z-10">
          <header className="h-16 flex items-center justify-between border-b border-gray-800 px-6">
            <div className="flex items-center gap-3">
              <SidebarTrigger />
              <span className="text-lg font-semibold text-white">
                Welcome back, {businessName || "Loading..."}
              </span>
            </div>
            <div className="text-sm text-gray-400">
              {currentDate}
            </div>
          </header>
          <main className="flex-1 p-6 overflow-x-hidden">
            <Outlet />
          </main>
          <ChatWidget />
        </div>
      </div>
    </SidebarProvider>
  );
};

export default DashboardLayout;
