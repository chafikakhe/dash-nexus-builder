import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";

import Index from "./pages/Index.tsx";
import NotFound from "./pages/NotFound.tsx";
import Landing from "./pages/Landing.tsx";
import Login from "./pages/Login.tsx";
import { AppLayout } from "./components/layout/AppLayout";
import Overview from "./pages/app/Overview";
import Dashboards from "./pages/app/Dashboards";
import Builder from "./pages/app/Builder";
import Collections from "./pages/app/Collections";
import AIStudio from "./pages/app/AIStudio";
import Settings from "./pages/app/Settings";
import Members from "./pages/app/Members";
import Activity from "./pages/app/Activity";
import Notifications from "./pages/app/Notifications";
import { AuthProvider } from "./contexts/AuthContext";
import { ProtectedRoute } from "./components/auth/ProtectedRoute";
import { AdminRoute } from "./components/auth/AdminRoute";
import { AdminLayout } from "./components/layout/AdminLayout";
import AdminStats from "./pages/admin/AdminStats";
import AdminUsers from "./pages/admin/AdminUsers";
import AdminOrgs from "./pages/admin/AdminOrgs";
import AdminDashboards from "./pages/admin/AdminDashboards";
import AdminActivity from "./pages/admin/AdminActivity";
import Invite from "./pages/Invite";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <Routes>
            <Route path="/" element={<Landing />} />
            <Route path="/login" element={<Login />} />
            <Route path="/invite/:token" element={<Invite />} />
            <Route
              path="/app"
              element={
                <ProtectedRoute>
                  <AppLayout />
                </ProtectedRoute>
              }
            >
              <Route index element={<Overview />} />
              <Route path="dashboards" element={<Dashboards />} />
              <Route path="dashboards/new" element={<Builder />} />
              <Route path="dashboards/:id" element={<Builder />} />
              <Route path="collections" element={<Collections />} />
              <Route path="ai" element={<AIStudio />} />
              <Route path="notifications" element={<Notifications />} />
              <Route path="members" element={<Members />} />
              <Route path="activity" element={<Activity />} />
              <Route path="settings" element={<Settings />} />
            </Route>
            <Route
              path="/admin"
              element={
                <AdminRoute>
                  <AdminLayout />
                </AdminRoute>
              }
            >
              <Route index element={<AdminStats />} />
              <Route path="users" element={<AdminUsers />} />
              <Route path="orgs" element={<AdminOrgs />} />
              <Route path="dashboards" element={<AdminDashboards />} />
              <Route path="activity" element={<AdminActivity />} />
            </Route>
            <Route path="/legacy" element={<Index />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
