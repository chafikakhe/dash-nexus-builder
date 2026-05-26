import { useMemo } from "react";
import { useAuth } from "@/contexts/AuthContext";

export function useWorkspacePermissions() {
  const { orgs, currentOrgId } = useAuth();
  const currentOrg = orgs.find((org) => org.id === currentOrgId) ?? null;
  const role = currentOrg?.role ?? null;

  return useMemo(() => {
    const canManageWorkspace = role === "owner" || role === "admin";
    const canCreateContent = role === "owner" || role === "admin";
    const canEditWorkspaceContent = role === "owner" || role === "admin";
    const isReadOnlyMember = Boolean(role && role !== "owner" && role !== "admin");

    return {
      role,
      isOwner: role === "owner",
      isAdmin: role === "admin",
      canManageWorkspace,
      canInvite: role === "owner" || role === "admin",
      canCreateContent,
      canEditWorkspaceContent,
      canViewMembers: role === "owner" || role === "admin",
      isReadOnlyMember,
    };
  }, [role]);
}
