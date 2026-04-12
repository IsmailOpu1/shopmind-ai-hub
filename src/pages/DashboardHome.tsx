import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Package, MessageSquare, Activity, TrendingUp, Upload, Settings, ArrowRight } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Link } from "react-router-dom";

const DashboardHome = () => {
  const { user } = useAuth();
  const [stats, setStats] = useState([
    { title: "Total Products Uploaded", value: 0, icon: Package, color: "blue", label: "products in catalog" },
    { title: "Total Conversations", value: 0, icon: MessageSquare, color: "purple", label: "total chats" },
    { title: "Active Sessions", value: 0, icon: Activity, color: "green", label: "last 24 hours" },
  ]);
  const [loading, setLoading] = useState(true);
  const [displayValues, setDisplayValues] = useState([0, 0, 0]);

  // Count-up animation
  useEffect(() => {
    if (loading) return;

    stats.forEach((stat, index) => {
      const targetValue = stat.value;
      const duration = 1000;
      const steps = 60;
      const increment = targetValue / steps;
      let current = 0;

      const timer = setInterval(() => {
        current += increment;
        if (current >= targetValue) {
          current = targetValue;
          clearInterval(timer);
        }
        setDisplayValues((prev) => {
          const newValues = [...prev];
          newValues[index] = Math.floor(current);
          return newValues;
        });
      }, duration / steps);
    });

    return () => {
      // Cleanup timers if component unmounts
    };
  }, [loading, stats]);

  useEffect(() => {
    const fetchStats = async () => {
      if (!user) {
        setLoading(false);
        return;
      }

      try {
        // Get business_id for current user
        const { data: business } = await supabase
          .from("businesses")
          .select("id")
          .eq("owner_id", user.id)
          .maybeSingle();

        if (!business) {
          setLoading(false);
          return;
        }

        const businessId = business.id;

        // Fetch total products
        const { count: productsCount } = await supabase
          .from("products")
          .select("*", { count: "exact", head: true })
          .eq("business_id", businessId);

        // Fetch total conversations
        const { count: conversationsCount } = await supabase
          .from("conversations")
          .select("*", { count: "exact", head: true })
          .eq("business_id", businessId);

        // Fetch active sessions (conversations within last 24 hours)
        const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
        const { data: activeConversations } = await supabase
          .from("conversations")
          .select("session_id")
          .eq("business_id", businessId)
          .gte("created_at", twentyFourHoursAgo);

        const uniqueSessions = new Set(activeConversations?.map((c) => c.session_id) || []);
        const activeSessionsCount = uniqueSessions.size;

        setStats([
          { title: "Total Products Uploaded", value: productsCount || 0, icon: Package, color: "blue", label: "products in catalog" },
          { title: "Total Conversations", value: conversationsCount || 0, icon: MessageSquare, color: "purple", label: "total chats" },
          { title: "Active Sessions", value: activeSessionsCount, icon: Activity, color: "green", label: "last 24 hours" },
        ]);
      } catch (error) {
        console.error("Failed to fetch dashboard stats:", error);
      } finally {
        setLoading(false);
      }
    };

    void fetchStats();
  }, [user]);

  const getCardColorClass = (color: string) => {
    switch (color) {
      case "blue":
        return "stat-card stat-card-blue";
      case "purple":
        return "stat-card stat-card-purple";
      case "green":
        return "stat-card stat-card-green";
      default:
        return "stat-card";
    }
  };

  const getIconCircleClass = (color: string) => {
    switch (color) {
      case "blue":
        return "icon-circle-blue";
      case "purple":
        return "icon-circle-purple";
      case "green":
        return "icon-circle-green";
      default:
        return "";
    }
  };

  const getAccentColorClass = (color: string) => {
    switch (color) {
      case "blue":
        return "text-blue-400";
      case "purple":
        return "text-purple-400";
      case "green":
        return "text-green-400";
      default:
        return "text-blue-400";
    }
  };

  return (
    <div className="page-fade-in">
      <h1 className="mb-2 text-4xl font-bold text-gradient-blue-purple">Dashboard</h1>
      <p className="mb-8 text-lg text-gray-400">Overview of your ShopMind AI store</p>

      <div className="grid gap-6 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 mb-12">
        {stats.map((stat, index) => (
          <Card key={stat.title} className={getCardColorClass(stat.color)}>
            <CardHeader className="flex flex-row items-center justify-between pb-3">
              <CardTitle className="text-sm font-medium text-gray-400">
                {stat.title}
              </CardTitle>
              <div className={`p-2 rounded-lg ${getIconCircleClass(stat.color)}`}>
                <stat.icon className="h-5 w-5 text-white" />
              </div>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="h-16 shimmer rounded" />
              ) : (
                <div className="flex items-end justify-between">
                  <div>
                    <p className="text-5xl font-bold text-white">{displayValues[index]}</p>
                    <p className="text-xs text-gray-500 mt-1">{stat.label}</p>
                  </div>
                  <TrendingUp className={`h-5 w-5 ${getAccentColorClass(stat.color)}`} />
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Quick Actions Section */}
      <div>
        <h2 className="mb-4 text-xl font-semibold text-white">Quick Actions</h2>
        <div className="grid gap-4 grid-cols-1 sm:grid-cols-2">
          <Link to="/dashboard/products">
            <Card className="quick-action-card cursor-pointer">
              <CardContent className="p-6">
                <div className="flex items-start gap-4">
                  <div className="p-3 rounded-lg bg-blue-500/20">
                    <Upload className="h-6 w-6 text-blue-400" />
                  </div>
                  <div className="flex-1">
                    <h3 className="text-lg font-semibold text-white mb-1">Upload Products</h3>
                    <p className="text-sm text-gray-400">Add new products to your catalog</p>
                  </div>
                  <ArrowRight className="h-5 w-5 text-gray-500 mt-1" />
                </div>
              </CardContent>
            </Card>
          </Link>
          <Link to="/dashboard/chatbot">
            <Card className="quick-action-card cursor-pointer">
              <CardContent className="p-6">
                <div className="flex items-start gap-4">
                  <div className="p-3 rounded-lg bg-purple-500/20">
                    <Settings className="h-6 w-6 text-purple-400" />
                  </div>
                  <div className="flex-1">
                    <h3 className="text-lg font-semibold text-white mb-1">Chatbot Settings</h3>
                    <p className="text-sm text-gray-400">Configure your AI assistant</p>
                  </div>
                  <ArrowRight className="h-5 w-5 text-gray-500 mt-1" />
                </div>
              </CardContent>
            </Card>
          </Link>
        </div>
      </div>
    </div>
  );
};

export default DashboardHome;
