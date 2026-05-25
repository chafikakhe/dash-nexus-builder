import { Topbar } from "@/components/layout/Topbar";
import { Badge } from "@/components/ui/badge";
import { PendingInvitationsCard } from "@/components/invitations/PendingInvitationsCard";
import { usePendingInvitations } from "@/hooks/usePendingInvitations";

export default function Notifications() {
  const invitationsController = usePendingInvitations();
  const { count, loading } = invitationsController;

  return (
    <>
      <Topbar
        breadcrumb={[{ label: "Notifications" }]}
        actions={
          <Badge className="bg-muted text-muted-foreground">
            {loading ? "Refreshing" : `${count} pending`}
          </Badge>
        }
      />
      <main className="flex-1 p-6 max-w-5xl animate-fade-in space-y-6">
        <PendingInvitationsCard showEmpty controller={invitationsController} />
      </main>
    </>
  );
}
