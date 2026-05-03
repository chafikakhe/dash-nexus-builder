import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/contexts/AuthContext";
import { logActivity } from "@/lib/activity";
import { toast } from "sonner";

export type Dashboard = {
  id: string;
  org_id: string;
  name: string;
  description: string | null;
  layout: any;
  created_at: string;
  updated_at: string;
};

export function useDashboards() {
  const { currentOrgId, user } = useAuth();
  const [dashboards, setDashboards] = useState<Dashboard[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchAll = useCallback(async () => {
    if (!currentOrgId) {
      setDashboards([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const { data, error } = await supabase
      .from("dashboards")
      .select("*")
      .eq("org_id", currentOrgId)
      .order("updated_at", { ascending: false });
    if (error) toast.error(error.message);
    else setDashboards((data ?? []) as Dashboard[]);
    setLoading(false);
  }, [currentOrgId]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const create = useCallback(
    async (input: { name: string; description?: string; layout?: any }) => {
      if (!currentOrgId || !user) return null;
      const { data, error } = await supabase
        .from("dashboards")
        .insert({
          org_id: currentOrgId,
          name: input.name,
          description: input.description ?? null,
          layout: input.layout ?? [],
          created_by: user.id,
        })
        .select("*")
        .single();
      if (error) { toast.error(error.message); return null; }
      setDashboards((prev) => [data as Dashboard, ...prev]);
      logActivity({
        orgId: currentOrgId, action: "dashboard.created",
        targetType: "dashboard", targetId: (data as Dashboard).id, targetLabel: (data as Dashboard).name,
      });
      return data as Dashboard;
    },
    [currentOrgId, user]
  );

  const update = useCallback(
    async (id: string, patch: Partial<Pick<Dashboard, "name" | "description" | "layout">>) => {
      const { data, error } = await supabase
        .from("dashboards")
        .update({ ...patch, updated_at: new Date().toISOString() })
        .eq("id", id)
        .select("*")
        .maybeSingle();
      if (error) { toast.error(error.message); return null; }
      if (data) setDashboards((prev) => prev.map((d) => (d.id === id ? (data as Dashboard) : d)));
      return data as Dashboard | null;
    },
    []
  );

  const remove = useCallback(async (id: string) => {
    const target = dashboards.find((d) => d.id === id);
    const { error } = await supabase.from("dashboards").delete().eq("id", id);
    if (error) { toast.error(error.message); return false; }
    setDashboards((prev) => prev.filter((d) => d.id !== id));
    logActivity({
      orgId: currentOrgId, action: "dashboard.deleted",
      targetType: "dashboard", targetId: id, targetLabel: target?.name,
    });
    return true;
  }, [dashboards, currentOrgId]);

  return { dashboards, loading, refetch: fetchAll, create, update, remove };
}

export async function fetchDashboard(id: string): Promise<Dashboard | null> {
  const { data, error } = await supabase.from("dashboards").select("*").eq("id", id).maybeSingle();
  if (error) { toast.error(error.message); return null; }
  return data as Dashboard | null;
}
