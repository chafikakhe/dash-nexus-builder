import { NavLink, useLocation, useNavigate } from "react-router-dom";
import { useState } from "react";
import {
  LayoutDashboard, Database, Sparkles, Settings, PanelsTopLeft, Activity, Users,
  Plus, ChevronsUpDown, Check, LogOut, Loader2, Shield, Bell,
} from "lucide-react";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";
import { useIsAdmin } from "@/hooks/useIsAdmin";
import { useWorkspacePermissions } from "@/hooks/useWorkspacePermissions";
import { InvitationNotificationBadge } from "@/components/invitations/InvitationNotificationBadge";
import { usePendingInvitations } from "@/hooks/usePendingInvitations";

const nav = [
  { label: "Overview", to: "/app", icon: LayoutDashboard, end: true },
  { label: "Dashboards", to: "/app/dashboards", icon: PanelsTopLeft },
  { label: "Collections", to: "/app/collections", icon: Database },
  { label: "AI Studio", to: "/app/ai", icon: Sparkles },
  { label: "Activity", to: "/app/activity", icon: Activity },
  { label: "Notifications", to: "/app/notifications", icon: Bell },
  { label: "Members", to: "/app/members", icon: Users },
];

export function AppSidebar() {
  const { orgs, currentOrgId, setCurrentOrgId, signOut, user, refreshOrgs } = useAuth();
  const { isAdmin } = useIsAdmin();
  const { canViewMembers } = useWorkspacePermissions();
  const { count: pendingInvitationCount } = usePendingInvitations();
  const current = orgs.find((o) => o.id === currentOrgId) ?? orgs[0];
  const { pathname } = useLocation();
  const navigate = useNavigate();

  const [openNew, setOpenNew] = useState(false);
  const [newName, setNewName] = useState("");
  const [creating, setCreating] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const expanded = isHovered;
  const labelClass = expanded ? "opacity-100" : "pointer-events-none w-0 opacity-0";

  const handleSignOut = async () => {
    await signOut();
    navigate("/login", { replace: true });
  };

  const handleCreateOrg = async () => {
    if (!newName.trim() || !user) return;
    setCreating(true);
    const slug =
      newName.toLowerCase().replace(/[^a-z0-9]+/g, "-").slice(0, 40) +
      "-" + Math.random().toString(36).slice(2, 6);
    const { data, error } = await supabase
      .from("orgs")
      .insert({ name: newName.trim(), slug, owner_id: user.id, created_by: user.id })
      .select("id")
      .single();
    setCreating(false);
    if (error) { toast.error(error.message); return; }
    // Immediately ensure the creator is added to org_members to avoid RLS race
    try {
      const { error: memberErr } = await supabase
        .from("org_members")
        .insert({ org_id: data?.id, user_id: user.id, role: "owner" })
        .select();
      if (memberErr) {
        // Not fatal - server trigger may handle it. Log for debugging.
        console.error("[sidebar] org_members insert error", memberErr);
      }
    } catch (e) {
      console.error("[sidebar] org_members insert unexpected error", e);
    }
    await refreshOrgs();
    if (data?.id) setCurrentOrgId(data.id);
    setOpenNew(false);
    setNewName("");
    toast.success("Workspace created");
  };

  return (
    <aside
      className={cn(
        "hidden md:flex shrink-0 flex-col border-r border-sidebar-border bg-sidebar/80 backdrop-blur-xl transition-[width] duration-300 ease-in-out overflow-hidden",
        expanded ? "w-64" : "w-16"
      )}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* Org switcher */}
      <div className={cn("p-3 transition-all duration-300", expanded ? "border-b border-sidebar-border" : "")}>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              className={cn(
                "w-full flex items-center rounded-md py-2 hover:bg-sidebar-accent transition-colors text-left group overflow-hidden",
                expanded ? "gap-2.5 px-2.5" : "justify-center px-0"
              )}
              title={expanded ? undefined : current?.name ?? "Workspaces"}
            >
              <div className="h-7 w-7 shrink-0 rounded-md bg-gradient-primary grid place-items-center text-xs font-bold text-primary-foreground shadow-glow">
                {current ? current.name.charAt(0).toUpperCase() : "·"}
              </div>
              <div className={cn("min-w-0 flex-1 overflow-hidden transition-all duration-200", labelClass)}>
                <div className="text-sm font-semibold text-sidebar-accent-foreground truncate">
                  {current?.name ?? "No workspace"}
                </div>
                <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
                  {current?.plan ?? "create one"}
                </div>
              </div>
              <ChevronsUpDown className={cn("h-3.5 w-3.5 shrink-0 text-muted-foreground transition-opacity", expanded ? "opacity-0 group-hover:opacity-100" : "hidden")} />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent className="w-56" align="start">
            <DropdownMenuLabel className="text-xs">Workspaces</DropdownMenuLabel>
            {orgs.length === 0 && (
              <div className="px-2 py-2 text-xs text-muted-foreground">No workspaces yet</div>
            )}
            {orgs.map((o) => (
              <DropdownMenuItem key={o.id} onClick={() => setCurrentOrgId(o.id)}>
                <div className="h-5 w-5 rounded bg-gradient-primary grid place-items-center text-[10px] font-bold text-primary-foreground mr-2">
                  {o.name.charAt(0).toUpperCase()}
                </div>
                <span className="flex-1 truncate">{o.name}</span>
                {o.id === currentOrgId && <Check className="h-3.5 w-3.5" />}
              </DropdownMenuItem>
            ))}
            {pendingInvitationCount > 0 && (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuItem onSelect={() => navigate("/app/notifications")}>
                  <Bell className="h-3.5 w-3.5 mr-2" />
                  <span className="flex-1">Pending invitations</span>
                  <span className="rounded-full bg-primary px-1.5 py-0.5 text-[10px] font-semibold text-primary-foreground">
                    {pendingInvitationCount}
                  </span>
                </DropdownMenuItem>
              </>
            )}
            <DropdownMenuSeparator />
            <DropdownMenuItem onSelect={(e) => { e.preventDefault(); setOpenNew(true); }}>
              <Plus className="h-3.5 w-3.5 mr-2" /> New workspace
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onSelect={handleSignOut} className="text-destructive focus:text-destructive">
              <LogOut className="h-3.5 w-3.5 mr-2" /> Sign out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-2 space-y-0.5 overflow-y-auto overflow-x-hidden scrollbar-thin">
        <div className={cn("px-2.5 pt-3 pb-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground transition-all duration-200", labelClass)}>
          Workspace
        </div>
        {nav.filter((item) => item.label !== "Members" || canViewMembers).map((item) => {
          const active = item.end ? pathname === item.to : pathname.startsWith(item.to);
          return (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              title={expanded ? undefined : item.label}
              className={cn(
                "flex items-center rounded-md py-1.5 text-sm transition-all overflow-hidden",
                expanded ? "gap-2.5 px-2.5" : "justify-center px-0",
                active
                  ? "bg-sidebar-accent text-sidebar-accent-foreground shadow-card"
                  : "text-sidebar-foreground hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground"
              )}
            >
              <item.icon className="h-4 w-4 shrink-0" />
              <span className={cn("truncate transition-all duration-200", labelClass)}>{item.label}</span>
              {expanded && item.label === "Notifications" && <InvitationNotificationBadge compact />}
            </NavLink>
          );
        })}
        {isAdmin && (
          <NavLink
            to="/admin"
            title={expanded ? undefined : "Admin Panel"}
            className={cn(
              "flex items-center rounded-md py-1.5 text-sm transition-all mt-2 overflow-hidden",
              expanded ? "gap-2.5 px-2.5" : "justify-center px-0",
              pathname.startsWith("/admin")
                ? "bg-destructive/15 text-destructive border border-destructive/30"
                : "text-destructive/80 hover:bg-destructive/10 border border-destructive/20"
            )}
          >
            <Shield className="h-4 w-4 shrink-0" />
            <span className={cn("truncate transition-all duration-200", labelClass)}>Admin Panel</span>
          </NavLink>
        )}
      </nav>

      {/* Footer */}
      <div className="p-3 border-t border-sidebar-border">
        <NavLink
          to="/app/settings"
          title={expanded ? undefined : "Settings"}
          className={({ isActive }) =>
            cn(
              "flex items-center rounded-md py-1.5 text-sm transition-colors overflow-hidden",
              expanded ? "gap-2.5 px-2.5" : "justify-center px-0",
              isActive
                ? "bg-sidebar-accent text-sidebar-accent-foreground"
                : "text-sidebar-foreground hover:bg-sidebar-accent/60"
            )
          }
        >
          <Settings className="h-4 w-4 shrink-0" />
          <span className={cn("truncate transition-all duration-200", labelClass)}>Settings</span>
        </NavLink>
        <Button
          variant="outline"
          size="sm"
          className={cn(
            "w-full mt-2 gap-2 text-xs overflow-hidden transition-all",
            expanded ? "justify-start px-3" : "justify-center px-0"
          )}
          title={expanded ? undefined : "Upgrade plan"}
        >
          <Sparkles className="h-3.5 w-3.5 text-primary" />
          <span className={cn("truncate transition-all duration-200", labelClass)}>Upgrade plan</span>
        </Button>
      </div>

      {/* New workspace dialog */}
      <Dialog open={openNew} onOpenChange={setOpenNew}>
        <DialogContent>
          <DialogHeader><DialogTitle>Create a new workspace</DialogTitle></DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="ws-name">Workspace name</Label>
            <Input
              id="ws-name"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="Acme Inc."
              onKeyDown={(e) => e.key === "Enter" && handleCreateOrg()}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpenNew(false)}>Cancel</Button>
            <Button onClick={handleCreateOrg} disabled={creating || !newName.trim()} className="bg-gradient-primary">
              {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : "Create"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </aside>
  );
}
