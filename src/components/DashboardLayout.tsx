import { useEffect, useState } from "react";
import { Link, Outlet, useLocation } from "react-router-dom";
import { Inbox } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { SidebarInset, SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";
import ChatWidget from "@/components/ChatWidget";
import { countWaiting } from "@/lib/inbox";
import { navItemFor } from "@/lib/nav";

// How often the dashboard checks for chats waiting on the team.
const WAITING_POLL_MS = 30000;

const DashboardLayout = () => {
  const { user } = useAuth();
  const location = useLocation();
  const [businessName, setBusinessName] = useState("");
  const [businessId, setBusinessId] = useState<string | null>(null);
  const [waiting, setWaiting] = useState(0);
  const page = navItemFor(location.pathname);

  useEffect(() => {
    if (!user) return;
    void (async () => {
      const { data } = await supabase.from("businesses").select("id, name").eq("owner_id", user.id).maybeSingle();
      if (data) {
        setBusinessName(data.name);
        setBusinessId(data.id);
      }
    })();
  }, [user]);

  // Chats waiting for the team, so the owner notices them from any page.
  useEffect(() => {
    if (!businessId) return;
    const check = () => countWaiting(businessId).then(setWaiting, () => {});
    check();
    const timer = setInterval(check, WAITING_POLL_MS);
    return () => clearInterval(timer);
  }, [businessId, location.pathname]);

  useEffect(() => {
    document.title = page ? `${page.title} · ShopMind AI` : "ShopMind AI";
  }, [page]);

  return (
    <SidebarProvider>
      <div className="app-shell flex min-h-screen w-full text-slate-200">
        <div className="landing-bg" aria-hidden="true" />
        <AppSidebar businessName={businessName} waiting={waiting} />
        <SidebarInset className="min-w-0 bg-transparent">
          <header className="app-topbar sticky top-0 z-30 flex h-16 items-center gap-3 border-b border-white/[0.06] px-4 sm:px-6">
            <SidebarTrigger className="h-9 w-9 rounded-lg text-slate-300 hover:bg-white/5 hover:text-white" />
            <div className="h-5 w-px bg-white/10" aria-hidden="true" />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold text-white sm:text-base">{page?.title ?? "Dashboard"}</p>
              {page && <p className="hidden truncate text-xs text-slate-500 sm:block">{page.description}</p>}
            </div>
            {waiting > 0 && (
              <Link
                to="/dashboard/inbox"
                className="flex items-center gap-2 rounded-full border border-amber-400/30 bg-amber-400/10 px-3 py-1.5 text-xs font-medium text-amber-200 transition-colors hover:bg-amber-400/20"
              >
                <Inbox className="h-3.5 w-3.5" />
                {waiting} waiting
              </Link>
            )}
            <div
              className="hidden h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-blue-500/80 to-violet-600/80 text-sm font-semibold text-white sm:flex"
              title={businessName}
              aria-hidden="true"
            >
              {(businessName.charAt(0) || "S").toUpperCase()}
            </div>
          </header>
          <div className="app-main flex-1 overflow-x-hidden px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
            <div key={location.pathname} className="page-enter mx-auto w-full max-w-7xl">
              <Outlet />
            </div>
          </div>
          <ChatWidget />
        </SidebarInset>
      </div>
    </SidebarProvider>
  );
};

export default DashboardLayout;
