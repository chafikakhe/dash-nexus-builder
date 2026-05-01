import { Topbar } from "@/components/layout/Topbar";
import { Activity } from "lucide-react";

export default function AdminActivity() {
  return (
    <>
      <Topbar breadcrumb={[{ label: "Admin" }, { label: "Activity" }]} />
      <main className="flex-1 p-6 animate-fade-in">
        <h1 className="text-2xl font-bold tracking-tight mb-1">Activity log</h1>
        <p className="text-sm text-muted-foreground mb-5">Cross-workspace audit trail.</p>
        <div className="rounded-xl border border-dashed border-border p-12 text-center">
          <Activity className="h-8 w-8 text-muted-foreground mx-auto mb-3 opacity-50" />
          <h3 className="font-semibold">No activity tracking yet</h3>
          <p className="text-sm text-muted-foreground mt-1">
            Add an <code className="text-primary">activity_log</code> table and triggers to populate this view.
          </p>
        </div>
      </main>
    </>
  );
}
