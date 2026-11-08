import { lazy, Suspense } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as SonnerToaster } from "sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/hooks/useAuth";
import ProtectedRoute from "@/components/ProtectedRoute";
import ErrorBoundary from "@/components/ErrorBoundary";
import Login from "./pages/Login";
import Signup from "./pages/Signup";
import NotFound from "./pages/NotFound";

// Dashboard pages load on demand, so the login page stays small.
const DashboardLayout = lazy(() => import("@/components/DashboardLayout"));
const DashboardHome = lazy(() => import("@/pages/DashboardHome"));
const ChatbotSettings = lazy(() => import("@/pages/ChatbotSettings"));
const Products = lazy(() => import("@/pages/Products"));
const Analytics = lazy(() => import("@/pages/Analytics"));
const StoreKnowledge = lazy(() => import("@/pages/StoreKnowledge"));
const Inbox = lazy(() => import("@/pages/Inbox"));
const Landing = lazy(() => import("@/pages/Landing"));

const PageFallback = () => (
  <div className="flex min-h-screen items-center justify-center text-sm text-muted-foreground">
    Loading...
  </div>
);

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <SonnerToaster position="top-right" richColors />
      <ErrorBoundary>
        <BrowserRouter>
          <AuthProvider>
            <Suspense fallback={<PageFallback />}>
              <Routes>
                <Route path="/" element={<Landing />} />
                <Route path="/login" element={<Login />} />
                <Route path="/signup" element={<Signup />} />
                <Route
                  path="/dashboard"
                  element={
                    <ProtectedRoute>
                      <DashboardLayout />
                    </ProtectedRoute>
                  }
                >
                  <Route index element={<DashboardHome />} />
                  <Route path="products" element={<Products />} />
                  <Route path="knowledge" element={<StoreKnowledge />} />
                  <Route path="inbox" element={<Inbox />} />
                  <Route path="chatbot" element={<ChatbotSettings />} />
                  <Route path="analytics" element={<Analytics />} />
                </Route>
                <Route path="*" element={<NotFound />} />
              </Routes>
            </Suspense>
          </AuthProvider>
        </BrowserRouter>
      </ErrorBoundary>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
