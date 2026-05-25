import { Link } from "react-router-dom";
import { Bell } from "lucide-react";
import { Button } from "@/components/ui/button";
import { usePendingInvitations } from "@/hooks/usePendingInvitations";

export function InvitationNotificationBadge({ compact = false }: { compact?: boolean }) {
  const { count, loading } = usePendingInvitations();
  const showCount = !loading && count > 0;

  if (compact) {
    return showCount ? (
      <span className="ml-auto min-w-5 rounded-full bg-primary px-1.5 py-0.5 text-center text-[10px] font-semibold text-primary-foreground">
        {count}
      </span>
    ) : null;
  }

  return (
    <Button variant="ghost" size="icon" className="h-8 w-8 relative" asChild>
      <Link to="/app/notifications" aria-label={showCount ? `${count} pending invitation${count === 1 ? "" : "s"}` : "Notifications"}>
        <Bell className="h-4 w-4" />
        {showCount && (
          <span className="absolute -top-0.5 -right-0.5 min-w-4 rounded-full bg-primary px-1 text-[10px] font-semibold leading-4 text-primary-foreground">
            {count}
          </span>
        )}
      </Link>
    </Button>
  );
}
