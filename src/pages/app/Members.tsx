import { useEffect, useMemo, useState } from "react";
import { Topbar } from "@/components/layout/Topbar";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, MoreHorizontal, Loader2, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/lib/supabase";
import { sendInviteEmail } from "@/lib/email";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { useDashboards, type Dashboard } from "@/hooks/useDashboards";

type Member = {
  user_id: string;
  role: string;
  email: string;
  display_name: string;
};

type Invite = {
  id: string;
  email: string;
  role: string;
  status: string;
  created_at: string;
  invited_by: string;
  inviter_name: string;
  inviter_email: string;
  token: string;
};

const roleColor = (r: string) =>
  r === "owner" ? "bg-primary/15 text-primary border-primary/30" :
  r === "admin" ? "bg-success/15 text-success border-success/30" :
  r === "editor" ? "bg-warning/15 text-warning border-warning/30" :
  "bg-secondary text-muted-foreground border-border";

const roleLabel = (r: string) =>
  r === "owner" ? "Owner" :
  r === "admin" ? "Admin" :
  r === "editor" ? "Editor" : "Viewer";

const inviteRoleLabel = (role: string) => (role === "admin" ? "Admin" : "Member");

export default function Members() {
  const { currentOrgId, orgs, user } = useAuth();
  const currentOrg = orgs.find((o) => o.id === currentOrgId);
  const [members, setMembers] = useState<Member[]>([]);
  const [pendingInvites, setPendingInvites] = useState<Invite[]>([]);
  const [loading, setLoading] = useState(true);
  const [isInviteOpen, setIsInviteOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<"member" | "admin">("member");
  const [inviteDashboardIds, setInviteDashboardIds] = useState<string[]>([]);
  const [inviteLoading, setInviteLoading] = useState(false);

  const { dashboards } = useDashboards();

  const canInvite = useMemo(() => currentOrg?.role === "owner" || currentOrg?.role === "admin", [currentOrg?.role]);

  const loadMembersAndInvites = async () => {
    if (!currentOrgId) {
      setMembers([]);
      setPendingInvites([]);
      setLoading(false);
      return;
    }

    setLoading(true);

    const [membersResult, invitesResult] = await Promise.all([
      supabase
        .from("org_members")
        .select("user_id, role, profiles:user_id(email, display_name)")
        .eq("org_id", currentOrgId)
        .order("role", { ascending: false }),
      supabase
        .from("invitations")
        .select("id, email, role, status, created_at, invited_by, inviter:invited_by(email, display_name), token")
        .eq("org_id", currentOrgId)
        .order("created_at", { ascending: false }),
    ]);

    if (membersResult.error) {
      console.error("[members] fetch error:", membersResult.error);
      toast.error("Failed to load members");
    } else {
      setMembers(((membersResult.data ?? []) as any[]).map((m) => ({
        user_id: m.user_id,
        role: m.role,
        email: m.profiles?.email ?? "—",
        display_name: m.profiles?.display_name ?? m.profiles?.email?.split("@")[0] ?? "User",
      })));
    }

    if (invitesResult.error) {
      console.error("[members] invites fetch error:", invitesResult.error);
      toast.error("Failed to load invitations");
    } else {
      setPendingInvites(((invitesResult.data ?? []) as any[]).map((invite) => ({
        id: invite.id,
        email: invite.email,
        role: invite.role,
        status: invite.status,
        created_at: invite.created_at,
        invited_by: invite.invited_by,
        inviter_name: invite.inviter?.display_name ?? invite.inviter?.email?.split("@")[0] ?? "Unknown",
        inviter_email: invite.inviter?.email ?? "—",
        token: invite.token,
      })));
    }

    setLoading(false);
  };

  useEffect(() => {
    void loadMembersAndInvites();
  }, [currentOrgId]);

  const handleInvite = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!currentOrgId || !user) {
      toast.error("Unable to create invitation.");
      return;
    }

    const normalizedEmail = inviteEmail.trim().toLowerCase();
    if (!normalizedEmail || !normalizedEmail.includes("@")) {
      toast.error("Enter a valid email address.");
      return;
    }

    setInviteLoading(true);

    const { data: insertedInvite, error } = await supabase.rpc("create_invitation", {
      _email: normalizedEmail,
      _org_id: currentOrgId,
      _role: inviteRole,
      _invited_by: user.id,
      _dashboard_ids: inviteDashboardIds,
    });

    if (error || !insertedInvite) {
      console.error("[members] invite error:", error);
      toast.error(error?.message || "Failed to create invitation.");
      setInviteLoading(false);
      return;
    }

    const inviteLink = `${window.location.origin}/invite/${insertedInvite.token}`;
    const workspaceName = currentOrg?.name ?? "workspace";

    try {
      await sendInviteEmail(normalizedEmail, workspaceName, inviteLink);
      toast.success("Invitation email sent.");
    } catch (emailError) {
      console.error("[members] invite email error:", emailError);
      toast.error("Invite saved, but sending email failed. Try again later.");
    }

    setInviteEmail("");
    setInviteRole("member");
    setInviteDashboardIds([]);
    setIsInviteOpen(false);
    await loadMembersAndInvites();
    setInviteLoading(false);
  };

  const handleRevoke = async (inviteId: string) => {
    const { error } = await supabase.from("invitations").delete().eq("id", inviteId);
    if (error) {
      console.error("[members] revoke error:", error);
      toast.error("Unable to revoke invitation.");
      return;
    }
    toast.success("Invitation revoked.");
    await loadMembersAndInvites();
  };

  return (
    <>
      <Topbar
        breadcrumb={[{ label: currentOrg?.name ?? "Workspace" }, { label: "Members" }]}
        actions={
          <div className="flex items-center gap-2">
            {!canInvite && <Badge className="bg-muted text-muted-foreground">Owner/Admin only</Badge>}
            <Dialog open={isInviteOpen} onOpenChange={setIsInviteOpen}>
              <DialogTrigger asChild>
                <Button size="sm" className="bg-gradient-primary shadow-glow" disabled={!canInvite}>
                  <Plus className="h-3.5 w-3.5 mr-1.5" />Invite member
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Invite a member</DialogTitle>
                  <DialogDescription>Send a workspace invitation link to someone by email.</DialogDescription>
                </DialogHeader>
                <form className="space-y-4" onSubmit={handleInvite}>
                  <div className="space-y-2">
                    <Label htmlFor="invite-email">Email</Label>
                    <Input
                      id="invite-email"
                      type="email"
                      value={inviteEmail}
                      onChange={(event) => setInviteEmail(event.target.value)}
                      placeholder="name@company.com"
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="invite-role">Role</Label>
                    <Select value={inviteRole} onValueChange={(value) => setInviteRole(value as "member" | "admin") }>
                      <SelectTrigger id="invite-role">
                        <SelectValue placeholder="Choose a role" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="member">Member</SelectItem>
                        <SelectItem value="admin">Admin</SelectItem>
                      </SelectContent>
                    </Select>
                    <p className="text-sm text-muted-foreground">Members can access the workspace. Admins can manage members.</p>
                  </div>
                  <div className="space-y-2">
                    <Label>Assign dashboards</Label>
                    {dashboards.length === 0 ? (
                      <p className="text-sm text-muted-foreground">No dashboards available yet. Assign access once you have created one.</p>
                    ) : (
                      <div className="grid gap-2 max-h-48 overflow-y-auto rounded border border-border p-3">
                        {dashboards.map((dashboard: Dashboard) => (
                          <label key={dashboard.id} className="flex items-center gap-2 text-sm">
                            <input
                              type="checkbox"
                              checked={inviteDashboardIds.includes(dashboard.id)}
                              onChange={() => {
                                setInviteDashboardIds((prev) =>
                                  prev.includes(dashboard.id)
                                    ? prev.filter((id) => id !== dashboard.id)
                                    : [...prev, dashboard.id],
                                );
                              }}
                              className="h-4 w-4 rounded border-border text-primary focus:ring-primary"
                            />
                            <span>{dashboard.name}</span>
                          </label>
                        ))}
                      </div>
                    )}
                  </div>
                  <DialogFooter>
                    <Button type="submit" className="bg-gradient-primary shadow-glow" disabled={inviteLoading}>
                      {inviteLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Send invitation"}
                    </Button>
                  </DialogFooter>
                </form>
              </DialogContent>
            </Dialog>
          </div>
        }
      />
      <main className="flex-1 p-6 max-w-5xl animate-fade-in space-y-6">
        <section className="rounded-3xl border border-border bg-card p-6">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h1 className="text-2xl font-bold tracking-tight">Members</h1>
              <p className="text-sm text-muted-foreground mt-1">Manage who has access to this workspace.</p>
            </div>
            <div className="hidden sm:block text-sm text-muted-foreground">
              {members.length} workspace member{members.length === 1 ? "" : "s"}
            </div>
          </div>

          {loading ? (
            <div className="mt-6 flex items-center justify-center py-12 text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin mr-2" /> Loading members…
            </div>
          ) : members.length === 0 ? (
            <div className="mt-6 flex items-center justify-center py-12 text-muted-foreground">
              No members yet. Invite someone to get started.
            </div>
          ) : (
            <div className="mt-6 rounded-xl border border-border bg-background divide-y divide-border overflow-hidden">
              {members.map((member) => {
                const initial = member.email?.[0]?.toUpperCase() ?? "?";
                return (
                  <div key={member.user_id} className="flex items-center gap-3 px-5 py-4 hover:bg-secondary/50 transition-colors">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-primary text-[11px] font-bold text-primary-foreground">{initial}</div>
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-medium">{member.display_name}</div>
                      <div className="text-xs text-muted-foreground">{member.email}</div>
                    </div>
                    <span className={`inline-flex rounded-full border px-2 py-1 text-[11px] font-semibold ${roleColor(member.role)}`}>{roleLabel(member.role)}</span>
                    <Button variant="ghost" size="icon" className="h-8 w-8" aria-label="Member actions">
                      <MoreHorizontal className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        <section className="rounded-3xl border border-border bg-card p-6">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-lg font-semibold">Pending invitations</h2>
              <p className="text-sm text-muted-foreground mt-1">Track outstanding workspace invites.</p>
            </div>
          </div>

          {loading ? null : pendingInvites.length === 0 ? (
            <div className="mt-6 rounded-2xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
              No pending invitations. Use the invite button to add someone to this workspace.
            </div>
          ) : (
            <div className="mt-6 space-y-3">
              {pendingInvites.map((invite) => (
                <div key={invite.id} className="flex flex-col gap-3 rounded-2xl border border-border bg-background p-4 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2 text-sm font-medium text-foreground">
                      <span>{invite.email}</span>
                      <span className="inline-flex rounded-full border px-2 py-1 text-[11px] font-semibold text-muted-foreground">{inviteRoleLabel(invite.role)}</span>
                      <span className="rounded-full bg-muted px-2 py-1 text-[11px] font-medium text-muted-foreground">{invite.status}</span>
                    </div>
                    <div className="mt-1 text-sm text-muted-foreground">
                      Sent by {invite.inviter_name} • {new Date(invite.created_at).toLocaleDateString()}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-destructive"
                      onClick={() => handleRevoke(invite.id)}
                    >
                      <Trash2 className="h-4 w-4 mr-2" /> Revoke
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </main>
    </>
  );
}
