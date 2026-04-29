import { NavLink, useLocation } from "react-router-dom";
import {
  LayoutDashboard,
  Database,
  Sparkles,
  Settings,
  PanelsTopLeft,
  Activity,
  Users,
  Plus,
  ChevronsUpDown,
  Check,
} from "lucide-react";
import { useAppStore } from "@/store/app";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const nav = [
  { label: "Overview", to: "/app", icon: LayoutDashboard, end: true },
  { label: "Dashboards", to: "/app/dashboards", icon: PanelsTopLeft },
  { label: "Collections", to: "/app/collections", icon: Database },
  { label: "AI Studio", to: "/app/ai", icon: Sparkles },
  { label: "Activity", to: "/app/activity", icon: Activity },
  { label: "Members", to: "/app/members", icon: Users },
];

export function AppSidebar() {
  const { orgs, currentOrgId, setCurrentOrg } = useAppStore();
  const current = orgs.find((o) => o.id === currentOrgId)!;
  const { pathname } = useLocation();

  return (
    <aside className="hidden md:flex w-60 shrink-0 flex-col border-r border-sidebar-border bg-sidebar/80 backdrop-blur-xl">
      {/* Org switcher */}
      <div className="p-3">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="w-full flex items-center gap-2.5 rounded-md px-2.5 py-2 hover:bg-sidebar-accent transition-colors text-left group">
              <div className="h-7 w-7 rounded-md bg-gradient-primary grid place-items-center text-xs font-bold text-primary-foreground shadow-glow">
                {current.name.charAt(0)}
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-semibold text-sidebar-accent-foreground truncate">{current.name}</div>
                <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{current.plan}</div>
              </div>
              <ChevronsUpDown className="h-3.5 w-3.5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent className="w-56" align="start">
            <DropdownMenuLabel className="text-xs">Workspaces</DropdownMenuLabel>
            {orgs.map((o) => (
              <DropdownMenuItem key={o.id} onClick={() => setCurrentOrg(o.id)}>
                <div className="h-5 w-5 rounded bg-gradient-primary grid place-items-center text-[10px] font-bold text-primary-foreground mr-2">
                  {o.name.charAt(0)}
                </div>
                <span className="flex-1">{o.name}</span>
                {o.id === currentOrgId && <Check className="h-3.5 w-3.5" />}
              </DropdownMenuItem>
            ))}
            <DropdownMenuSeparator />
            <DropdownMenuItem>
              <Plus className="h-3.5 w-3.5 mr-2" /> New workspace
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-2 space-y-0.5 overflow-y-auto scrollbar-thin">
        <div className="px-2.5 pt-3 pb-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
          Workspace
        </div>
        {nav.map((item) => {
          const active = item.end ? pathname === item.to : pathname.startsWith(item.to);
          return (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={cn(
                "flex items-center gap-2.5 rounded-md px-2.5 py-1.5 text-sm transition-all",
                active
                  ? "bg-sidebar-accent text-sidebar-accent-foreground shadow-card"
                  : "text-sidebar-foreground hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground"
              )}
            >
              <item.icon className="h-4 w-4" />
              <span>{item.label}</span>
            </NavLink>
          );
        })}
      </nav>

      {/* Footer */}
      <div className="p-3 border-t border-sidebar-border">
        <NavLink
          to="/app/settings"
          className={({ isActive }) =>
            cn(
              "flex items-center gap-2.5 rounded-md px-2.5 py-1.5 text-sm transition-colors",
              isActive
                ? "bg-sidebar-accent text-sidebar-accent-foreground"
                : "text-sidebar-foreground hover:bg-sidebar-accent/60"
            )
          }
        >
          <Settings className="h-4 w-4" />
          <span>Settings</span>
        </NavLink>
        <Button variant="outline" size="sm" className="w-full mt-2 justify-start gap-2 text-xs">
          <Sparkles className="h-3.5 w-3.5 text-primary" />
          Upgrade plan
        </Button>
      </div>
    </aside>
  );
}
