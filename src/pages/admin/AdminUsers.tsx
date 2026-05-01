import { useEffect, useState } from "react";
import { Topbar } from "@/components/layout/Topbar";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, Shield, ShieldOff } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";

type Profile = {
  id: string;
  email: string;
  display_name: string | null;
  is_admin: boolean;
  created_at: string;
};

export default function AdminUsers() {
  const { user } = useAuth();
  const [users, setUsers] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchUsers = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("profiles")
      .select("id, email, display_name, is_admin, created_at")
      .order("created_at", { ascending: false });
    if (error) toast.error(error.message);
    else setUsers((data ?? []) as Profile[]);
    setLoading(false);
  };

  useEffect(() => { fetchUsers(); }, []);

  const toggleAdmin = async (p: Profile) => {
    if (p.id === user?.id) {
      toast.error("Can't change your own admin status");
      return;
    }
    const { error } = await supabase
      .from("profiles")
      .update({ is_admin: !p.is_admin })
      .eq("id", p.id);
    if (error) { toast.error(error.message); return; }
    setUsers((prev) => prev.map((x) => (x.id === p.id ? { ...x, is_admin: !p.is_admin } : x)));
    toast.success(p.is_admin ? "Admin revoked" : "Promoted to admin");
  };

  return (
    <>
      <Topbar breadcrumb={[{ label: "Admin" }, { label: "Users" }]} />
      <main className="flex-1 p-6 animate-fade-in">
        <h1 className="text-2xl font-bold tracking-tight mb-1">Users</h1>
        <p className="text-sm text-muted-foreground mb-5">All platform users. {users.length} total.</p>

        <div className="rounded-xl border border-border bg-card overflow-hidden">
          {loading ? (
            <div className="p-12 text-center text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin inline mr-2" /> Loading…
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead className="border-b border-border bg-secondary/30">
                <tr>
                  <th className="text-left px-4 py-2.5 text-xs font-medium text-muted-foreground">Email</th>
                  <th className="text-left px-4 py-2.5 text-xs font-medium text-muted-foreground">Name</th>
                  <th className="text-left px-4 py-2.5 text-xs font-medium text-muted-foreground">Role</th>
                  <th className="text-left px-4 py-2.5 text-xs font-medium text-muted-foreground">Joined</th>
                  <th className="px-4 py-2.5" />
                </tr>
              </thead>
              <tbody>
                {users.map((u) => (
                  <tr key={u.id} className="border-b border-border/50 hover:bg-secondary/20">
                    <td className="px-4 py-2.5 font-medium">{u.email}</td>
                    <td className="px-4 py-2.5 text-muted-foreground">{u.display_name || "—"}</td>
                    <td className="px-4 py-2.5">
                      {u.is_admin ? (
                        <Badge className="bg-primary/15 text-primary border-primary/30">Admin</Badge>
                      ) : (
                        <Badge variant="secondary" className="font-normal">User</Badge>
                      )}
                    </td>
                    <td className="px-4 py-2.5 text-xs text-muted-foreground tabular-nums">
                      {new Date(u.created_at).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-2.5 text-right">
                      <Button
                        variant="outline" size="sm" className="gap-1.5"
                        disabled={u.id === user?.id}
                        onClick={() => toggleAdmin(u)}
                      >
                        {u.is_admin ? <><ShieldOff className="h-3.5 w-3.5" /> Revoke</> : <><Shield className="h-3.5 w-3.5" /> Promote</>}
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </main>
    </>
  );
}
