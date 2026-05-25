import { Inbox, Loader2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { usePendingInvitations, type PendingInvitation } from "@/hooks/usePendingInvitations";
import { InvitationAcceptButton, InvitationDeclineButton } from "@/components/invitations/InvitationActions";

type PendingInvitationsController = {
  invitations: PendingInvitation[];
  loading: boolean;
  actingToken: string | null;
  acceptInvitation: (token: string) => Promise<boolean>;
  declineInvitation: (token: string) => Promise<boolean>;
};

export function PendingInvitationsCard({
  showEmpty = false,
  controller,
}: {
  showEmpty?: boolean;
  controller?: PendingInvitationsController;
}) {
  const ownController = usePendingInvitations();
  const {
    invitations,
    loading,
    actingToken,
    acceptInvitation,
    declineInvitation,
  } = controller ?? ownController;

  if (!loading && invitations.length === 0 && !showEmpty) return null;

  return (
    <section className="rounded-xl border border-border bg-card">
      <div className="p-5 border-b border-border flex items-center justify-between">
        <div>
          <h3 className="font-semibold">Workspace invitations</h3>
          <p className="text-sm text-muted-foreground mt-1">Invitations waiting for the email signed into this account.</p>
        </div>
        <Badge className="bg-muted text-muted-foreground">
          {loading ? "Refreshing" : `${invitations.length} pending`}
        </Badge>
      </div>

      {loading ? (
        <div className="p-8 text-center text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin inline mr-2" /> Loading invitations...
        </div>
      ) : invitations.length === 0 ? (
        <div className="p-8 text-center text-sm text-muted-foreground">
          No pending invitations were found for your email.
        </div>
      ) : (
        <div className="divide-y divide-border">
          {invitations.map((invite) => (
            <div key={invite.id} className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <div className="flex items-center gap-2 text-base font-semibold text-foreground">
                  <Inbox className="h-5 w-5 text-primary" />
                  <span>{invite.org?.name ?? "Workspace invitation"}</span>
                </div>
                <p className="mt-2 text-sm text-muted-foreground">
                  Role: <span className="font-medium text-foreground">{invite.role === "admin" ? "Admin" : "Member"}</span>
                </p>
                <p className="mt-1 text-sm text-muted-foreground">Invited as: {invite.email}</p>
                <p className="mt-1 text-sm text-muted-foreground">Sent: {new Date(invite.created_at).toLocaleDateString()}</p>
              </div>
              <div className="flex items-center gap-2">
                <InvitationDeclineButton token={invite.token} actingToken={actingToken} onDecline={declineInvitation} />
                <InvitationAcceptButton token={invite.token} actingToken={actingToken} onAccept={acceptInvitation} />
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
