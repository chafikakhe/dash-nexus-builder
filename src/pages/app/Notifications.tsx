import { useEffect, useState } from "react";
import { Topbar } from "@/components/layout/Topbar";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { Loader2, CheckCircle2, Inbox } from "lucide-react";

type Invitation = {
  id: string;
  email: string;
  role: string;
  status: string;
  created_at: string;
  orgs: { id: string; name: string } | null;
  token: string;
};

type NotificationItem = {
  id: string;
  type: string;
  payload: {
    invite_id?: string;
    token?: string;
    role?: string;
    invited_by?: string;
    recipient_email?: string;
    [key: string]: any;
  };
  created_at: string;
  orgs: { id: string; name: string }[] | null;
};

export default function Notifications() {
  const { user } = useAuth();
  const [invitations, setInvitations] = useState<Invitation[]>([]);
  const [loading, setLoading] = useState(true);
  const [accepting, setAccepting] = useState<string | null>(null);

  const loadInvitations = async () => {
    if (!user) {
      setInvitations([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    const normalizedEmail = user.email?.toLowerCase() ?? "";
    console.log("[notifications] loading invites for email", normalizedEmail);

    let inviteItems: Invitation[] = [];
    const notificationSelect = () =>
      supabase
        .from("notifications")
        .select("id, type, payload, created_at, orgs:org_id(id, name)")
        .order("created_at", { ascending: false });

    const notificationsByEmail = normalizedEmail
      ? await notificationSelect().eq("recipient_email", normalizedEmail)
      : null;
    const notificationsById = await notificationSelect().eq("recipient_id", user.id);

    if ((notificationsByEmail?.error == null || notificationsByEmail === null) && !notificationsById.error) {
      const combinedRows = [
        ...(notificationsByEmail?.data ?? []),
        ...(notificationsById.data ?? []),
      ] as any[];
      const unique = new Map<string, any>();
      combinedRows.forEach((item) => {
        if (!unique.has(item.id)) unique.set(item.id, item);
      });

      inviteItems = Array.from(unique.values())
        .filter((item) => item.type === "workspace_invite" && item.payload?.token)
        .map((item) => {
          const org = Array.isArray(item.orgs) ? item.orgs[0] : null;
          return {
            id: item.payload.invite_id ?? item.id,
            email: item.payload.recipient_email ?? normalizedEmail,
            role: item.payload.role ?? "member",
            status: "pending",
            created_at: item.created_at,
            orgs: org ? { id: org.id, name: org.name } : null,
            token: item.payload.token,
          };
        });

      if (inviteItems.length > 0) {
        setInvitations(inviteItems);
        setLoading(false);
        return;
      }
    }

    if (notificationsByEmail?.error || notificationsById.error) {
      console.warn("[notifications] fallback to invitations query", {
        byEmailError: notificationsByEmail?.error,
        byIdError: notificationsById.error,
      });
    }

    const { data, error } = await supabase
      .from("invitations")
      .select("id, email, role, status, created_at, orgs:org_id(id, name), token")
      .eq("status", "pending")
      .eq("email", normalizedEmail)
      .order("created_at", { ascending: false });

    console.log("[notifications] invitations response", { data, error });
    if (error) {
      console.error("[notifications] load invitations error:", error);
      toast.error("Failed to load your invitations.");
      setInvitations([]);
    } else {
      setInvitations(((data ?? []) as any[]).map((row) => ({
        id: row.id,
        email: row.email,
        role: row.role,
        status: row.status,
        created_at: row.created_at,
        orgs: Array.isArray(row.orgs) ? row.orgs[0] : null,
        token: row.token,
      })));
    }

    setLoading(false);
  };

  useEffect(() => {
    void loadInvitations();
  }, [user]);

  const handleAccept = async (token: string) => {
    setAccepting(token);
    const { error } = await supabase.rpc("accept_invitation", { p_token: token });
    if (error) {
      console.error("[notifications] accept invitation error:", error);
      toast.error(error.message || "Unable to accept the invitation.");
    } else {
      toast.success("Invitation accepted. You now have access to the workspace.");
      await loadInvitations();
    }
    setAccepting(null);
  };

  return (
    <>
      <Topbar
        breadcrumb={[{ label: "Notifications" }]}
        actions={
          <Badge className="bg-muted text-muted-foreground">{invitations.length} pending</Badge>
        }
      />
      <main className="flex-1 p-6 max-w-5xl animate-fade-in space-y-6">
        <section className="rounded-3xl border border-border bg-card p-6">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h1 className="text-2xl font-bold tracking-tight">Workspace invitations</h1>
              <p className="text-sm text-muted-foreground mt-1">Accept workspace access invitations sent to your email.</p>
            </div>
            <div className="text-sm text-muted-foreground">
              {loading ? "Refreshing…" : `${invitations.length} pending invitation${invitations.length === 1 ? "" : "s"}`}
            </div>
          </div>

          {loading ? (
            <div className="mt-6 flex items-center justify-center py-12 text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin mr-2" /> Loading invitations…
            </div>
          ) : invitations.length === 0 ? (
            <div className="mt-6 rounded-2xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
              No pending invitations were found for your email.
            </div>
          ) : (
            <div className="mt-6 space-y-4">
              {invitations.map((invite) => (
                <div key={invite.id} className="flex flex-col gap-4 rounded-2xl border border-border bg-background p-5 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <div className="flex items-center gap-2 text-lg font-semibold text-foreground">
                      <Inbox className="h-5 w-5 text-primary" />
                      <span>{invite.orgs?.name ?? "Workspace invitation"}</span>
                    </div>
                    <p className="mt-2 text-sm text-muted-foreground">
                      Role: <span className="font-medium text-foreground">{invite.role === "admin" ? "Admin" : "Member"}</span>
                    </p>
                    <p className="mt-1 text-sm text-muted-foreground">Invited as: {invite.email}</p>
                    <p className="mt-1 text-sm text-muted-foreground">Sent: {new Date(invite.created_at).toLocaleDateString()}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      className="bg-gradient-primary"
                      onClick={() => void handleAccept(invite.token)}
                      disabled={accepting === invite.token}
                    >
                      {accepting === invite.token ? <Loader2 className="h-4 w-4 animate-spin" /> : <><CheckCircle2 className="h-4 w-4 mr-2" /> Accept</>}
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
