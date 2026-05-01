import { Outlet, NavLink, useNavigate } from "react-router-dom";
import {
  Shield, Users, Building2, PanelsTopLeft, Activity, BarChart3, ArrowLeft,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

const adminNav = [
  { label: "Stats", to: "/admin", icon: BarChart3, end: true },
  { label: "Users", to: "/admin/users", icon: Users },
  { label: "Workspaces", to: "/admin/orgs", icon: Building2 },
  { label: "Dashboards", to: "/admin/dashboards", icon: PanelsTopLeft },
  { label: "Activity", to: "/admin/activity", icon: Activity },
];

export function AdminLayout() {
  const navigate = useNavigate();
  return (
    <div className="min-h-screen flex bg-background">
      <aside className="hidden md:flex w-60 shrink-0 flex-col border-r border-sidebar-border bg-sidebar/80 backdrop-blur-xl">
        <div className="p-3 border-b border-sidebar-border">
          <div className="flex items-center gap-2.5 px-2.5 py-2">
            <div className="h-7 w-7 rounded-md bg-destructive/20 border border-destructive/40 grid place-items-center">
              <Shield className="h-3.5 w-3.5 text-destructive" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-semibold">Admin Panel</div>
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Platform-wide</div>
            </div>
          </div>
        </div>

        <nav className="flex-1 px-2 space-y-0.5 mt-2">
          {adminNav.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                cn(
                  "flex items-center gap-2.5 rounded-md px-2.5 py-1.5 text-sm transition-all",
                  isActive
                    ? "bg-sidebar-accent text-sidebar-accent-foreground shadow-card"
                    : "text-sidebar-foreground hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground"
                )
              }
            >
              <item.icon className="h-4 w-4" />
              <span>{item.label}</span>
            </NavLink>
          ))}
        </nav>

        <div className="p-3 border-t border-sidebar-border">
          <Button variant="outline" size="sm" className="w-full justify-start gap-2" onClick={() => navigate("/app")}>
            <ArrowLeft className="h-3.5 w-3.5" /> Back to app
          </Button>
        </div>
      </aside>

      <div className="flex-1 min-w-0 flex flex-col">
        <Outlet />
      </div>
    </div>
  );
}
