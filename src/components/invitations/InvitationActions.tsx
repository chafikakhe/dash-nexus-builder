import { CheckCircle2, Loader2, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";

export function InvitationAcceptButton({
  token,
  actingToken,
  onAccept,
}: {
  token: string;
  actingToken: string | null;
  onAccept: (token: string) => void | Promise<void>;
}) {
  const loading = actingToken === token;
  return (
    <Button className="bg-gradient-primary" onClick={() => void onAccept(token)} disabled={loading}>
      {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <><CheckCircle2 className="h-4 w-4 mr-2" />Accept</>}
    </Button>
  );
}

export function InvitationDeclineButton({
  token,
  actingToken,
  onDecline,
}: {
  token: string;
  actingToken: string | null;
  onDecline: (token: string) => void | Promise<void>;
}) {
  const loading = actingToken === token;
  return (
    <Button variant="outline" onClick={() => void onDecline(token)} disabled={loading}>
      {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <><XCircle className="h-4 w-4 mr-2" />Decline</>}
    </Button>
  );
}
