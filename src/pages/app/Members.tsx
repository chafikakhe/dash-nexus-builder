import { useCallback, useEffect, useState } from "react";
import { Topbar } from "@/components/layout/Topbar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Plus, MoreHorizontal, Loader2 } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/contexts/AuthContext";
import { logActivity } from "@/lib/activity";
import { toast } from "sonner";

type Role = "owner" | "admin" | "editor" | "viewer";

type Member = {
  user_id: string;
  role: Role;
  email: string;
  display_name: string | null;
};

const ROLES: Role[] = ["owner", "admin", "editor", "viewer"];

const roleColor = (r: Role) =>
  r === "owner" ? "bg-primary/15 text-primary border-primary/30" :
  r === "admin" ? "bg-success/15 text-success border-success/30" :
  r === "editor" ? "bg-warning/15 text-warning border-warning/30" :
  "bg-secondary text-muted-foreground border-border";

const initialsOf = (m: Member) => {
  const base = m.display_name || m.email;
  return base.split(/[\s@.]+/).filter(Boolean).slice(0, 2).map((s) => s[0]?.toUpperCase()).join("");
};

export default function Members() {
  const { currentOrgId, user, orgs } = useAuth();
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<Role>("viewer");
  const [inviting, setInviting] = useState(false);

  const myRole = orgs.find((o) => o.id === currentOrgId)?.role as Role | undefined;
  const canManage = myRole === "owner" || myRole === "admin";

  const load = useCallback(async () => {
    if (!currentOrgId) { setMembers([]); setLoading(false); return; }
    setLoading(true);
    const { data, error } = await supabase
      .from("org_members")
      .select("user_id, role, profiles:user_id(email, display_name)")
      .eq("org_id", currentOrgId);
    if (error) { toast.error(error.message); setLoading(false); return; }
    const list: Member[] = (data ?? []).map((r: any) => ({
      user_id: r.user_id,
      role: r.role,
      email: r.profiles?.email ?? "",
      display_name: r.profiles?.display_name ?? null,
    }));
    setMembers(list);
    setLoading(false);
  }, [currentOrgId]);

  useEffect(() => { load(); }, [load]);

  const invite = async () => {
    if (!currentOrgId || !inviteEmail.trim()) return;
    setInviting(true);
    // Look up an existing profile by email (no admin API on the client).
    const { data: profile, error: pErr } = await supabase
      .from("profiles")
      .select("id, email")
      .eq("email", inviteEmail.trim().toLowerCase())
      .maybeSingle();
    if (pErr) { toast.error(pErr.message); setInviting(false); return; }
    if (!profile) {
      toast.error("No user with that email has signed up yet. Ask them to create an account first.");
      setInviting(false);
      return;
    }
    const { error } = await supabase
      .from("org_members")
      .insert({ org_id: currentOrgId, user_id: profile.id, role: inviteRole });
    if (error) { toast.error(error.message); setInviting(false); return; }
    toast.success(`Added ${profile.email} as ${inviteRole}`);
    await logActivity({
      orgId: currentOrgId, action: "member.invited",
      targetType: "user", targetId: profile.id, targetLabel: profile.email,
      metadata: { role: inviteRole },
    });
    setInviteEmail(""); setInviteRole("viewer"); setInviteOpen(false); setInviting(false);
    load();
  };

  const changeRole = async (m: Member, role: Role) => {
    const { error } = await supabase
      .from("org_members")
      .update({ role })
      .eq("org_id", currentOrgId!)
      .eq("user_id", m.user_id);
    if (error) { toast.error(error.message); return; }
    toast.success(`${m.email} is now ${role}`);
    logActivity({
      orgId: currentOrgId, action: "member.role_changed",
      targetType: "user", targetId: m.user_id, targetLabel: m.email,
      metadata: { role },
    });
    load();
  };

  const remove = async (m: Member) => {
    if (!confirm(`Remove ${m.email} from this workspace?`)) return;
    const { error } = await supabase
      .from("org_members")
      .delete()
      .eq("org_id", currentOrgId!)
      .eq("user_id", m.user_id);
    if (error) { toast.error(error.message); return; }
    toast.success(`Removed ${m.email}`);
    logActivity({
      orgId: currentOrgId, action: "member.removed",
      targetType: "user", targetId: m.user_id, targetLabel: m.email,
    });
    load();
  };

  return (
    <>
      <Topbar
        breadcrumb={[{ label: orgs.find((o) => o.id === currentOrgId)?.name ?? "Workspace" }, { label: "Members" }]}
        actions={
          canManage ? (
            <Dialog open={inviteOpen} onOpenChange={setInviteOpen}>
              <DialogTrigger asChild>
                <Button size="sm" className="bg-gradient-primary shadow-glow">
                  <Plus className="h-3.5 w-3.5 mr-1.5" />Invite member
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Invite member</DialogTitle>
                  <DialogDescription>
                    Add an existing DashForge user to this workspace by email.
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="email">Email</Label>
                    <Input id="email" type="email" placeholder="user@example.com"
                      value={inviteEmail} onChange={(e) => setInviteEmail(e.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <Label>Role</Label>
                    <Select value={inviteRole} onValueChange={(v) => setInviteRole(v as Role)}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {ROLES.filter((r) => r !== "owner").map((r) => (
                          <SelectItem key={r} value={r} className="capitalize">{r}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setInviteOpen(false)}>Cancel</Button>
                  <Button onClick={invite} disabled={inviting || !inviteEmail.trim()}>
                    {inviting && <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />}
                    Add member
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          ) : null
        }
      />
      <main className="flex-1 p-6 max-w-4xl animate-fade-in">
        <h1 className="text-2xl font-bold tracking-tight">Members</h1>
        <p className="text-sm text-muted-foreground mt-1">Manage who has access to this workspace.</p>

        <div className="mt-6 rounded-xl border border-border bg-card divide-y divide-border">
          {loading ? (
            <div className="p-12 text-center text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin inline mr-2" /> Loading…
            </div>
          ) : members.length === 0 ? (
            <div className="p-12 text-center text-sm text-muted-foreground">No members yet.</div>
          ) : members.map((m) => (
            <div key={m.user_id} className="flex items-center px-5 py-3.5 hover:bg-secondary/30 transition-colors">
              <div className="h-9 w-9 rounded-full bg-gradient-primary grid place-items-center text-xs font-bold text-primary-foreground mr-3">
                {initialsOf(m) || "?"}
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium truncate">
                  {m.display_name || m.email}
                  {m.user_id === user?.id && <span className="text-xs text-muted-foreground ml-2">(you)</span>}
                </div>
                <div className="text-xs text-muted-foreground truncate">{m.email}</div>
              </div>
              <span className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-medium border mr-3 capitalize ${roleColor(m.role)}`}>
                {m.role}
              </span>
              {canManage && m.role !== "owner" && m.user_id !== user?.id ? (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-7 w-7">
                      <MoreHorizontal className="h-3.5 w-3.5" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuLabel>Change role</DropdownMenuLabel>
                    {ROLES.filter((r) => r !== "owner" && r !== m.role).map((r) => (
                      <DropdownMenuItem key={r} className="capitalize" onClick={() => changeRole(m, r)}>
                        Make {r}
                      </DropdownMenuItem>
                    ))}
                    <DropdownMenuSeparator />
                    <DropdownMenuItem className="text-destructive" onClick={() => remove(m)}>
                      Remove from workspace
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              ) : (
                <div className="w-7" />
              )}
            </div>
          ))}
        </div>
      </main>
    </>
  );
}
