import { supabase } from "@/lib/supabase";
import type { Workspace } from "@/contexts/WorkspaceContext";

/**
 * Fetch all workspaces for the current user
 */
export async function fetchUserWorkspaces(): Promise<Workspace[]> {
  try {
    const { data, error } = await supabase.rpc("get_user_workspaces");

    if (error) {
      console.error("[queries] Error fetching workspaces:", error);
      return [];
    }

    return (data as Workspace[]) || [];
  } catch (error) {
    console.error("[queries] Unexpected error fetching workspaces:", error);
    return [];
  }
}

/**
 * Fetch the user's active workspace
 */
export async function fetchActiveWorkspace(): Promise<Workspace | null> {
  try {
    const { data, error } = await supabase.rpc("get_active_workspace");

    if (error) {
      console.error("[queries] Error fetching active workspace:", error);
      return null;
    }

    if (!data || !Array.isArray(data) || data.length === 0) {
      return null;
    }

    return (data[0] as Workspace) || null;
  } catch (error) {
    console.error("[queries] Unexpected error fetching active workspace:", error);
    return null;
  }
}

/**
 * Create a new workspace
 */
export async function createNewWorkspace(name: string): Promise<Workspace | null> {
  try {
    const { data, error } = await supabase.rpc("create_workspace", {
      p_name: name,
    });

    if (error || !data) {
      console.error("[queries] Error creating workspace:", error);
      return null;
    }

    return {
      org_id: data.org_id,
      org_name: data.org_name,
      org_slug: data.org_slug,
      role: data.role,
      plan: "free",
    };
  } catch (error) {
    console.error("[queries] Unexpected error creating workspace:", error);
    return null;
  }
}

/**
 * Switch to a different workspace
 */
export async function switchToWorkspace(orgId: string): Promise<Workspace | null> {
  try {
    const { data, error } = await supabase.rpc("set_active_workspace", {
      p_org_id: orgId,
    });

    if (error || !data) {
      console.error("[queries] Error switching workspace:", error);
      return null;
    }

    return {
      org_id: data.org_id,
      org_name: data.org_name,
      org_slug: data.org_slug,
      role: data.role,
      plan: "free",
    };
  } catch (error) {
    console.error("[queries] Unexpected error switching workspace:", error);
    return null;
  }
}

/**
 * Fetch organization members with explicit aliases
 */
export async function fetchOrgMembers(orgId: string) {
  try {
    const { data, error } = await supabase
      .from("org_members")
      .select(
        `
        user_id,
        role,
        profiles:profiles(email, display_name)
      `
      )
      .eq("org_id", orgId)
      .order("role", { ascending: false });

    if (error) {
      console.error("[queries] Error fetching members:", error);
      return [];
    }

    return (
      (data as any[])?.map((m) => ({
        user_id: m.user_id,
        role: m.role,
        email: m.profiles?.email ?? "—",
        display_name: m.profiles?.display_name ?? m.profiles?.email?.split("@")[0] ?? "User",
      })) || []
    );
  } catch (error) {
    console.error("[queries] Unexpected error fetching members:", error);
    return [];
  }
}

/**
 * Fetch pending invitations for an organization using dedicated RPC
 */
export async function fetchOrgInvitations(orgId: string) {
  try {
    const { data, error } = await supabase.rpc("get_org_invitations", {
      p_org_id: orgId,
    });

    if (error) {
      console.error("[queries] Error fetching invitations:", error);
      return [];
    }

    return (
      (data as any[])?.map((invite) => ({
        id: invite.id,
        email: invite.email,
        role: invite.role,
        status: invite.status,
        created_at: invite.created_at,
        invited_by: invite.invited_by,
        inviter_name: invite.inviter_display_name ?? "Unknown",
        inviter_email: invite.inviter_email ?? "—",
        token: invite.token,
      })) || []
    );
  } catch (error) {
    console.error("[queries] Unexpected error fetching invitations:", error);
    return [];
  }
}

/**
 * Create an invitation
 */
export async function createInvitation(
  email: string,
  orgId: string,
  role: "owner" | "admin" | "member" | "editor" | "viewer" = "member",
  dashboardIds: string[] = []
) {
  try {
    const { data, error } = await supabase.rpc("create_invitation", {
      p_email: email,
      p_org_id: orgId,
      p_role: role,
      p_dashboard_ids: dashboardIds,
    });

    if (error) {
      console.error("[queries] Error creating invitation:", error);
      return null;
    }

    return data;
  } catch (error) {
    console.error("[queries] Unexpected error creating invitation:", error);
    return null;
  }
}

/**
 * Accept an invitation
 */
export async function acceptInvitation(token: string) {
  try {
    const { data, error } = await supabase.rpc("accept_invitation", {
      p_token: token,
    });

    if (error) {
      console.error("[queries] Error accepting invitation:", error);
      return null;
    }

    return data;
  } catch (error) {
    console.error("[queries] Unexpected error accepting invitation:", error);
    return null;
  }
}

/**
 * Reject an invitation
 */
export async function rejectInvitation(token: string) {
  try {
    const { data, error } = await supabase.rpc("reject_invitation", {
      p_token: token,
    });

    if (error) {
      console.error("[queries] Error rejecting invitation:", error);
      return null;
    }

    return data;
  } catch (error) {
    console.error("[queries] Unexpected error rejecting invitation:", error);
    return null;
  }
}
