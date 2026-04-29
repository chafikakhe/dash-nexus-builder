import { Topbar } from "@/components/layout/Topbar";
import { Button } from "@/components/ui/button";
import { Plus, MoreHorizontal } from "lucide-react";
import { Badge } from "@/components/ui/badge";

const members = [
  { name: "Jane Doe", email: "jane@dashforge.io", role: "Owner", initials: "JD" },
  { name: "Marcus Liu", email: "marcus@acme.io", role: "Admin", initials: "ML" },
  { name: "Sara Park", email: "sara@acme.io", role: "Editor", initials: "SP" },
  { name: "David Chen", email: "david@acme.io", role: "Editor", initials: "DC" },
  { name: "Aisha Khan", email: "aisha@acme.io", role: "Viewer", initials: "AK" },
];

const roleColor = (r: string) =>
  r === "Owner" ? "bg-primary/15 text-primary border-primary/30" :
  r === "Admin" ? "bg-success/15 text-success border-success/30" :
  r === "Editor" ? "bg-warning/15 text-warning border-warning/30" :
  "bg-secondary text-muted-foreground border-border";

export default function Members() {
  return (
    <>
      <Topbar
        breadcrumb={[{ label: "Acme Inc." }, { label: "Members" }]}
        actions={<Button size="sm" className="bg-gradient-primary shadow-glow"><Plus className="h-3.5 w-3.5 mr-1.5" />Invite member</Button>}
      />
      <main className="flex-1 p-6 max-w-4xl animate-fade-in">
        <h1 className="text-2xl font-bold tracking-tight">Members</h1>
        <p className="text-sm text-muted-foreground mt-1">Manage who has access to this workspace.</p>

        <div className="mt-6 rounded-xl border border-border bg-card divide-y divide-border">
          {members.map((m) => (
            <div key={m.email} className="flex items-center px-5 py-3.5 hover:bg-secondary/30 transition-colors">
              <div className="h-9 w-9 rounded-full bg-gradient-primary grid place-items-center text-xs font-bold text-primary-foreground mr-3">{m.initials}</div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium">{m.name}</div>
                <div className="text-xs text-muted-foreground">{m.email}</div>
              </div>
              <span className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-medium border mr-3 ${roleColor(m.role)}`}>{m.role}</span>
              <Button variant="ghost" size="icon" className="h-7 w-7"><MoreHorizontal className="h-3.5 w-3.5" /></Button>
            </div>
          ))}
        </div>
      </main>
    </>
  );
}
