import { Topbar } from "@/components/layout/Topbar";
import { Activity as ActivityIcon, GitCommit, UserPlus, Database, Sparkles } from "lucide-react";

const events = [
  { icon: GitCommit, who: "Marcus Liu", what: "updated", target: "Revenue overview", when: "2 min ago" },
  { icon: Sparkles, who: "Jane Doe", what: "generated", target: "Customer health (AI)", when: "1 hr ago" },
  { icon: Database, who: "Sara Park", what: "imported 4,320 records to", target: "Orders", when: "3 hr ago" },
  { icon: UserPlus, who: "Jane Doe", what: "invited", target: "aisha@acme.io", when: "Yesterday" },
  { icon: GitCommit, who: "David Chen", what: "deleted widget on", target: "Support queue", when: "2 days ago" },
  { icon: ActivityIcon, who: "System", what: "rotated API token for", target: "Acme Inc.", when: "1 week ago" },
];

export default function ActivityPage() {
  return (
    <>
      <Topbar breadcrumb={[{ label: "Acme Inc." }, { label: "Activity" }]} />
      <main className="flex-1 p-6 max-w-3xl animate-fade-in">
        <h1 className="text-2xl font-bold tracking-tight">Activity</h1>
        <p className="text-sm text-muted-foreground mt-1">Audit log of everything happening in your workspace.</p>

        <div className="mt-6 rounded-xl border border-border bg-card">
          {events.map((e, i) => (
            <div key={i} className="flex items-center gap-4 px-5 py-3.5 border-b border-border last:border-0 hover:bg-secondary/30 transition-colors">
              <div className="h-8 w-8 rounded-md bg-secondary grid place-items-center">
                <e.icon className="h-3.5 w-3.5 text-muted-foreground" />
              </div>
              <div className="flex-1 min-w-0 text-sm">
                <span className="font-medium">{e.who}</span>{" "}
                <span className="text-muted-foreground">{e.what}</span>{" "}
                <span className="font-medium">{e.target}</span>
              </div>
              <span className="text-xs text-muted-foreground">{e.when}</span>
            </div>
          ))}
        </div>
      </main>
    </>
  );
}
