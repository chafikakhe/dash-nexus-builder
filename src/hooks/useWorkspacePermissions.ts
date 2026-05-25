import { useMemo } from "react";
import { useAuth } from "@/contexts/AuthContext";

export function useWorkspacePermissions() {
  const { orgs, currentOrgId } = useAuth();
  const currentOrg = orgs.find((org) => org.id === currentOrgId) ?? null;
  const role = currentOrg?.role ?? null;

  return useMemo(() => {
    const canManageWorkspace = role === "owner";
    const isReadOnlyMember = Boolean(role && role !== "owner" && role !== "admin");

    return {
      role,
      isOwner: role === "owner",
      isAdmin: role === "admin",
      canManageWorkspace,
      canInvite: role === "owner" || role === "admin",
      canCreateContent: canManageWorkspace,
      canEditWorkspaceContent: canManageWorkspace,
      canViewMembers: role === "owner" || role === "admin",
      isReadOnlyMember,
    };
  }, [role]);
}
