import { useCallback, useEffect, useState } from "react";
import {
  FunctionsFetchError,
  FunctionsHttpError,
  FunctionsRelayError,
} from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { useWorkspacePermissions } from "@/hooks/useWorkspacePermissions";

export type Dashboard = {
  id: string;
  org_id: string;
  name: string;
  description: string | null;
  layout: any;
  created_at: string;
  updated_at: string;
  permission?: "view" | "edit";
};

type FunctionErrorBody = {
  error?: {
    message?: string;
  };
};

async function readFunctionErrorBody(context: unknown): Promise<FunctionErrorBody | null> {
  if (!(context instanceof Response)) return null;

  try {
    return await context.clone().json();
  } catch (_jsonError) {
    try {
      const text = await context.clone().text();
      return text ? { error: { message: text } } : null;
    } catch (_textError) {
      return null;
    }
  }
}

async function toFunctionErrorMessage(error: unknown): Promise<string> {
  if (error instanceof FunctionsHttpError) {
    const body = await readFunctionErrorBody(error.context);
    return body?.error?.message || `Edge Function returned HTTP ${error.context.status}.`;
  }

  if (error instanceof FunctionsRelayError) {
    return `Supabase Functions relay error: ${error.message}`;
  }

  if (error instanceof FunctionsFetchError) {
    return `Could not reach Supabase Edge Function: ${error.message}`;
  }

  if (error instanceof Error) {
    return error.message;
  }

  return "Failed to create dashboard.";
}

/**
 * Hook for managing dashboards.
 * Includes comprehensive logging and error handling for debugging database operations.
 * If RLS policies are blocking operations, errors will show "Permission denied" message.
 */
export function useDashboards() {
  const { currentOrgId, user } = useAuth();
  const { canCreateContent, canManageWorkspace, isOwner } = useWorkspacePermissions();
  const [dashboards, setDashboards] = useState<Dashboard[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchAll = useCallback(async () => {
    if (!currentOrgId) {
      console.debug("[dashboards] No currentOrgId, clearing dashboards");
      setDashboards([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      console.debug("[dashboards] Fetching dashboards for org:", currentOrgId);
      const { data, error } = await supabase
        .from("dashboards")
        .select("*")
        .eq("org_id", currentOrgId)
        .order("updated_at", { ascending: false });
      if (error) {
        console.error("[dashboards] Fetch error:", error.code, error.message, error);
        toast.error(`Failed to load dashboards: ${error.message}`);
      } else {
        const rows = (data ?? []) as Dashboard[];
        if (isOwner) {
          setDashboards(rows.map((dashboard) => ({ ...dashboard, permission: "edit" })));
        } else if (user && rows.length > 0) {
          const { data: permissions, error: permissionError } = await supabase
            .from("dashboard_permissions")
            .select("dashboard_id, permission")
            .eq("user_id", user.id)
            .in("dashboard_id", rows.map((dashboard) => dashboard.id));
          if (permissionError) console.error("[dashboards] Permission lookup error:", permissionError);
          const permissionByDashboard = new Map(
            (permissions ?? []).map((permission) => [permission.dashboard_id, permission.permission as "view" | "edit"])
          );
          setDashboards(rows.map((dashboard) => ({ ...dashboard, permission: permissionByDashboard.get(dashboard.id) ?? "view" })));
        } else {
          setDashboards(rows);
        }
        console.debug("[dashboards] Fetched", rows.length, "dashboards");
      }
    } catch (e: any) {
      console.error("[dashboards] Unexpected fetch error:", e);
      toast.error("Failed to load dashboards");
    } finally {
      setLoading(false);
    }
  }, [currentOrgId, isOwner, user]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  /**
   * Create a new dashboard with optional initial layout.
   * The dashboard will be associated with the current org and created_by user.
   * If RLS blocks this, you likely lack owner role in org_members.
   */
  const create = useCallback(
    async (input: { name: string; description?: string; layout?: any }) => {
      if (!currentOrgId) {
        console.warn("[dashboards] create: No currentOrgId");
        toast.error("No workspace selected");
        return null;
      }
      if (!user) {
        console.warn("[dashboards] create: No user logged in");
        toast.error("Not logged in");
        return null;
      }
      console.debug("[dashboards] Creating dashboard:", { name: input.name, description: input.description, orgId: currentOrgId, userId: user.id });

      // Verify membership/role before creating to avoid RLS blocks
      try {
        const { data: membership, error: membErr } = await supabase
          .from("org_members")
          .select("role")
          .eq("org_id", currentOrgId)
          .eq("user_id", user.id)
          .maybeSingle();
        if (membErr) console.error("[dashboards] membership check error", membErr);
        if (!membership) {
          toast.error("You don't have access to this workspace");
          return null;
        }
        if (!canCreateContent || membership.role !== "owner") {
          toast.error("Only workspace owners can create dashboards");
          return null;
        }
      } catch (e) {
        console.error("[dashboards] membership check unexpected error", e);
      }
      try {
        const { data, error } = await supabase.functions.invoke("create-dashboard", {
          body: {
            orgId: currentOrgId,
            name: input.name,
            description: input.description ?? null,
            layout: input.layout ?? [],
          },
        });
        if (error) {
          const message = await toFunctionErrorMessage(error);
          console.error("[dashboards] create-dashboard function error:", message, error);
          toast.error(`Failed to create dashboard: ${message}`);
          return null;
        }

        const createdRow = data?.dashboard;
        if (!createdRow?.id) {
          toast.error("Failed to create dashboard: missing dashboard payload.");
          return null;
        }

        console.debug("[dashboards] Dashboard created successfully:", createdRow.id);
        const created = { ...(createdRow as Dashboard), permission: "edit" as const };
        setDashboards((prev) => [created, ...prev]);
        return created;
      } catch (e: any) {
        console.error("[dashboards] Unexpected create error:", e);
        toast.error("Failed to create dashboard");
        return null;
      }
    },
    [canCreateContent, currentOrgId, user]
  );

  /**
   * Update an existing dashboard (name, description, or layout).
   * Called when saving dashboard layout changes from the builder.
   * If RLS blocks this, you likely lack owner role or edit access to this dashboard.
   */
  const update = useCallback(
    async (id: string, patch: Partial<Pick<Dashboard, "name" | "description" | "layout">>) => {
      console.debug("[dashboards] Updating dashboard:", id, { patch });
      if (!currentOrgId) {
        toast.error("No workspace selected");
        return null;
      }
      if (!user) {
        toast.error("Not logged in");
        return null;
      }

      // Verify membership/role before updating
      try {
        const { data: membership, error: membErr } = await supabase
          .from("org_members")
          .select("role")
          .eq("org_id", currentOrgId)
          .eq("user_id", user.id)
          .maybeSingle();
        if (membErr) console.error("[dashboards] membership check error", membErr);
        if (!membership) {
          toast.error("You don't have access to this workspace");
          return null;
        }
        if (!canManageWorkspace || membership.role !== "owner") {
          const { data: permission, error: permissionError } = await supabase
            .from("dashboard_permissions")
            .select("permission")
            .eq("dashboard_id", id)
            .eq("user_id", user.id)
            .maybeSingle();
          if (permissionError) console.error("[dashboards] permission check error", permissionError);
          if (permission?.permission !== "edit") {
            toast.error("You do not have edit access to this dashboard");
            return null;
          }
        }
      } catch (e) {
        console.error("[dashboards] membership check unexpected error", e);
      }

      try {
        const { data, error } = await supabase
          .from("dashboards")
          .update({ ...patch, updated_at: new Date().toISOString() })
          .eq("id", id)
          .select("*")
          .maybeSingle();
        if (error) {
          console.error("[dashboards] Update error:", error.code, error.message, error);
          if (error.code === "PGRST301" || error.message.includes("row level security")) {
            toast.error("Permission denied. You need dashboard edit access.");
          } else {
            toast.error(`Failed to save dashboard: ${error.message}`);
          }
          return null;
        }
        console.debug("[dashboards] Dashboard updated successfully");
        if (data) {
          setDashboards((prev) => prev.map((d) => (d.id === id ? (data as Dashboard) : d)));
        }
        return data as Dashboard | null;
      } catch (e: any) {
        console.error("[dashboards] Unexpected update error:", e);
        toast.error("Failed to save dashboard");
        return null;
      }
    },
    [canManageWorkspace, currentOrgId, user]
  );

  const remove = useCallback(async (id: string) => {
    console.debug("[dashboards] Deleting dashboard:", id);
    try {
      const { error } = await supabase.from("dashboards").delete().eq("id", id);
      if (error) {
        console.error("[dashboards] Delete error:", error.message, error);
        if (error.code === "PGRST301" || error.message.includes("row level security")) {
          toast.error("Permission denied. You need dashboard edit access.");
        } else {
          toast.error(`Failed to delete dashboard: ${error.message}`);
        }
        return false;
      }
      console.debug("[dashboards] Dashboard deleted successfully");
      setDashboards((prev) => prev.filter((d) => d.id !== id));
      return true;
    } catch (e: any) {
      console.error("[dashboards] Unexpected delete error:", e);
      toast.error("Failed to delete dashboard");
      return false;
    }
  }, []);

  return { dashboards, loading, refetch: fetchAll, create, update, remove };
}

/**
 * Fetch a single dashboard by ID.
 * Used by the Builder to load existing dashboards.
 * Safe to use from server-side code (checks if window exists).
 */
export async function fetchDashboard(id: string): Promise<Dashboard | null> {
  console.debug("[dashboards] Fetching dashboard:", id);
  try {
    const { data, error } = await supabase.from("dashboards").select("*").eq("id", id).maybeSingle();
    if (error) {
      console.error("[dashboards] fetchDashboard error:", error.message, error);
      toast.error(`Failed to load dashboard: ${error.message}`);
      return null;
    }
    console.debug("[dashboards] Dashboard loaded successfully");
    return data as Dashboard | null;
  } catch (e: any) {
    console.error("[dashboards] Unexpected fetchDashboard error:", e);
    toast.error("Failed to load dashboard");
    return null;
  }
}
