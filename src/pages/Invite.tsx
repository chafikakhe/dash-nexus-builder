import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { ArrowLeft, CheckCircle2, Loader2, AlertTriangle } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/contexts/AuthContext";
import { Topbar } from "@/components/layout/Topbar";

type InviteRecord = {
  id: string;
  email: string;
  org_id: string;
  role: string;
  status: string;
  created_at: string;
  accepted_at: string | null;
  orgs: { id: string; name: string }[] | null;
};

export default function Invite() {
  const { user, loading: authLoading, refreshOrgs } = useAuth();
  const { token } = useParams();
  const navigate = useNavigate();
  const [invite, setInvite] = useState<InviteRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [accepting, setAccepting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!token) return;
    if (authLoading) return;

    setLoading(true);
    setError(null);
    setInvite(null);

    if (!user) {
      setError("Please sign in with the invited email to view this invitation.");
      setLoading(false);
      return;
    }

    (async () => {
      const { data, error: fetchError } = await supabase
        .from("invitations")
        .select("id, email, role, status, created_at, accepted_at, orgs:org_id(id, name)")
        .eq("token", token)
        .maybeSingle();

      if (fetchError) {
        console.error("[invite] fetch error", fetchError);
        setError("Unable to load invitation details.");
      } else if (!data) {
        setError("Invitation not found.");
      } else {
        setInvite(data as InviteRecord);
      }
      setLoading(false);
    })();
  }, [token, authLoading, user]);

  const handleAccept = async () => {
    if (!token || !user) return;
    setAccepting(true);
    setError(null);

    const { error: acceptError } = await supabase.rpc("accept_invitation", { p_token: token });
    if (acceptError) {
      console.error("[invite] accept error", acceptError);
      setError(acceptError.message || "Unable to accept invitation.");
      setAccepting(false);
      return;
    }

    toast.success("Invitation accepted. Welcome to the workspace.");
    await refreshOrgs();
    navigate("/app/members", { replace: true });
  };

  const inviteRoleLabel = invite?.role === "admin" ? "Admin" : "Member";
  const userEmail = user?.email ?? "";

  return (
    <div className="min-h-screen bg-background">
      <Topbar breadcrumb={[{ label: "Invitation" }]} />
      <main className="mx-auto max-w-3xl p-6">
        <div className="mb-6 flex items-center gap-3 text-muted-foreground">
          <ArrowLeft className="h-4 w-4" />
          <Link to="/" className="text-sm font-medium text-primary transition-colors hover:text-primary/80">
            Back to landing
          </Link>
        </div>

        <div className="rounded-3xl border border-border bg-card p-8 shadow-sm">
          {authLoading || loading ? (
            <div className="grid place-items-center py-20 text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin mr-2" /> Loading invitation…
            </div>
          ) : error ? (
            <div className="space-y-4 text-center">
              <AlertTriangle className="mx-auto h-10 w-10 text-destructive" />
              <h1 className="text-xl font-semibold">Unable to accept invitation</h1>
              <p className="text-sm text-muted-foreground">{error}</p>
              <div className="flex justify-center">
                <Button variant="secondary" onClick={() => navigate("/login", { state: { from: `/invite/${token}` } })}>
                  Sign in with the invited email
                </Button>
              </div>
            </div>
          ) : !invite ? (
            <div className="space-y-4 text-center">
              <AlertTriangle className="mx-auto h-10 w-10 text-destructive" />
              <h1 className="text-xl font-semibold">Invitation not found</h1>
              <p className="text-sm text-muted-foreground">Verify the invite link or ask the sender to resend it.</p>
            </div>
          ) : (
            <div className="space-y-6">
              <div className="space-y-2">
                <div className="flex items-center gap-3">
                  <div className="grid h-10 w-10 place-items-center rounded-full bg-primary/10 text-primary">I</div>
                  <div>
                    <p className="text-sm uppercase tracking-[0.24em] text-muted-foreground">Workspace invitation</p>
                    <h1 className="text-2xl font-semibold">{invite.orgs?.[0]?.name ?? "Workspace"}</h1>
                  </div>
                </div>
                <p className="text-sm text-muted-foreground">
                  You were invited as a <strong>{inviteRoleLabel}</strong> for <strong>{invite.email}</strong>.
                </p>
              </div>

              <div className="grid gap-4 rounded-2xl border border-border bg-background p-5">
                <div className="grid gap-1 text-sm text-muted-foreground">
                  <span>Invitation status</span>
                  <span className="font-medium text-foreground">{invite.status === "accepted" ? "Accepted" : "Pending"}</span>
                </div>
                <div className="grid gap-1 text-sm text-muted-foreground">
                  <span>Issued to</span>
                  <span className="font-medium text-foreground">{invite.email}</span>
                </div>
                <div className="grid gap-1 text-sm text-muted-foreground">
                  <span>Role</span>
                  <span className="font-medium text-foreground">{inviteRoleLabel}</span>
                </div>
              </div>

              {invite.status === "accepted" ? (
                <div className="rounded-2xl border border-emerald-300/30 bg-emerald-50 p-5 text-sm text-emerald-900">
                  <div className="flex items-center gap-2 font-medium">
                    <CheckCircle2 className="h-4 w-4" /> Invitation already accepted.
                  </div>
                  <p>Open the app to continue.</p>
                </div>
              ) : !user ? (
                <div className="space-y-4 text-center">
                  <p className="text-sm text-muted-foreground">Sign in with the invited email to accept this workspace invitation.</p>
                  <Button onClick={() => navigate("/login", { state: { from: `/invite/${token}` } })} className="w-full md:w-auto">
                    Sign in to accept invite
                  </Button>
                </div>
              ) : userEmail.toLowerCase() !== invite.email.toLowerCase() ? (
                <div className="space-y-4 rounded-2xl border border-amber-300/40 bg-amber-50 p-5 text-sm text-amber-900">
                  <p>You are signed in as <strong>{userEmail}</strong>, but this invitation was sent to <strong>{invite.email}</strong>.</p>
                  <p>Please sign in with the invited email address to accept the invite.</p>
                  <Button onClick={() => navigate("/login", { state: { from: `/invite/${token}` } })} className="w-full md:w-auto">
                    Sign in with invited email
                  </Button>
                </div>
              ) : (
                <div className="space-y-4">
                  <p className="text-sm text-muted-foreground">Accept the invite and join this workspace immediately.</p>
                  <Button onClick={handleAccept} disabled={accepting} className="w-full bg-gradient-primary shadow-glow">
                    {accepting ? <Loader2 className="h-4 w-4 animate-spin" /> : "Accept invitation"}
                  </Button>
                </div>
              )}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
