import { createContext, useContext, useEffect, useState, ReactNode, useCallback } from "react";
import type { User } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";

export type Workspace = {
  org_id: string;
  org_name: string;
  org_slug: string;
  role: "owner" | "admin" | "member" | "editor" | "viewer";
  plan: string;
};

type WorkspaceContextValue = {
  workspaces: Workspace[];
  activeWorkspace: Workspace | null;
  loading: boolean;
  createWorkspace: (name: string) => Promise<Workspace>;
  switchWorkspace: (orgId: string) => Promise<void>;
  refreshWorkspaces: () => Promise<void>;
};

const WorkspaceContext = createContext<WorkspaceContextValue | undefined>(undefined);

const ACTIVE_WORKSPACE_KEY = "dash-nexus.activeWorkspace";

export function WorkspaceProvider({
  children,
  user,
}: {
  children: ReactNode;
  user: User | null;
}) {
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [activeWorkspace, setActiveWorkspace] = useState<Workspace | null>(null);
  const [loading, setLoading] = useState(true);

  // Load workspaces from database
  const loadWorkspaces = useCallback(async () => {
    if (!user) {
      setWorkspaces([]);
      setActiveWorkspace(null);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);

      // Get all user workspaces
      const { data: workspacesData, error: workspacesError } = await supabase.rpc(
        "get_user_workspaces"
      );

      if (workspacesError) {
        console.error("[workspace] Error loading workspaces:", workspacesError);
        setWorkspaces([]);
        setActiveWorkspace(null);
        setLoading(false);
        return;
      }

      const userWorkspaces = (workspacesData as Workspace[]) || [];
      setWorkspaces(userWorkspaces);

      // Try to get active workspace from RPC
      const { data: activeData, error: activeError } = await supabase.rpc(
        "get_active_workspace"
      );

      let active: Workspace | null = null;

      if (!activeError && activeData && Array.isArray(activeData) && activeData.length > 0) {
        active = (activeData[0] as Workspace) || null;
      }

      // If no active workspace from RPC, check localStorage
      if (!active && typeof window !== "undefined") {
        const stored = localStorage.getItem(ACTIVE_WORKSPACE_KEY);
        if (stored) {
          try {
            const parsed = JSON.parse(stored);
            active = userWorkspaces.find((w) => w.org_id === parsed.org_id) || null;
          } catch {
            // Invalid stored data, ignore
          }
        }
      }

      // If still no active workspace, use first one
      if (!active && userWorkspaces.length > 0) {
        active = userWorkspaces[0];
      }

      // If user has no workspaces, create default one
      if (userWorkspaces.length === 0) {
        const email = user.email || "user";
        const name = `${email.split("@")[0]}'s workspace`;
        const created = await createNewWorkspace(name);
        if (created) {
          active = created;
          setWorkspaces([created]);
        }
      }

      setActiveWorkspace(active);

      // Persist active workspace
      if (active && typeof window !== "undefined") {
        localStorage.setItem(ACTIVE_WORKSPACE_KEY, JSON.stringify(active));
      }
    } catch (error) {
      console.error("[workspace] Unexpected error loading workspaces:", error);
      setWorkspaces([]);
      setActiveWorkspace(null);
    } finally {
      setLoading(false);
    }
  }, [user]);

  // Create new workspace
  const createNewWorkspace = useCallback(async (name: string): Promise<Workspace | null> => {
    try {
      const { data, error } = await supabase.rpc("create_workspace", {
        p_name: name,
      });

      if (error || !data) {
        console.error("[workspace] Error creating workspace:", error);
        return null;
      }

      const newWorkspace: Workspace = {
        org_id: data.org_id,
        org_name: data.org_name,
        org_slug: data.org_slug,
        role: data.role,
        plan: "free",
      };

      return newWorkspace;
    } catch (error) {
      console.error("[workspace] Unexpected error creating workspace:", error);
      return null;
    }
  }, []);

  const createWorkspace = useCallback(
    async (name: string): Promise<Workspace> => {
      const newWorkspace = await createNewWorkspace(name);
      if (!newWorkspace) {
        throw new Error("Failed to create workspace");
      }

      // Refresh workspaces list
      await loadWorkspaces();

      return newWorkspace;
    },
    [createNewWorkspace, loadWorkspaces]
  );

  const switchWorkspace = useCallback(
    async (orgId: string) => {
      try {
        const { data, error } = await supabase.rpc("set_active_workspace", {
          p_org_id: orgId,
        });

        if (error || !data) {
          console.error("[workspace] Error switching workspace:", error);
          throw new Error("Failed to switch workspace");
        }

        const switched: Workspace = {
          org_id: data.org_id,
          org_name: data.org_name,
          org_slug: data.org_slug,
          role: data.role,
          plan: "free",
        };

        setActiveWorkspace(switched);

        if (typeof window !== "undefined") {
          localStorage.setItem(ACTIVE_WORKSPACE_KEY, JSON.stringify(switched));
        }
      } catch (error) {
        console.error("[workspace] Unexpected error switching workspace:", error);
        throw error;
      }
    },
    []
  );

  const refreshWorkspaces = useCallback(async () => {
    await loadWorkspaces();
  }, [loadWorkspaces]);

  // Load workspaces when user changes
  useEffect(() => {
    void loadWorkspaces();
  }, [user, loadWorkspaces]);

  return (
    <WorkspaceContext.Provider
      value={{
        workspaces,
        activeWorkspace,
        loading,
        createWorkspace,
        switchWorkspace,
        refreshWorkspaces,
      }}
    >
      {children}
    </WorkspaceContext.Provider>
  );
}

export function useWorkspace() {
  const ctx = useContext(WorkspaceContext);
  if (!ctx) {
    throw new Error("useWorkspace must be used inside <WorkspaceProvider>");
  }
  return ctx;
}
