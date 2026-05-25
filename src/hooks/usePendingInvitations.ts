import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/lib/supabase";

export type PendingInvitation = {
  id: string;
  email: string;
  role: "admin" | "member" | string;
  status: string;
  token: string;
  created_at: string;
  expires_at: string | null;
  org: { id: string; name: string } | null;
};

function normalizeInvitation(row: any): PendingInvitation {
  const org = Array.isArray(row.orgs) ? row.orgs[0] : row.orgs;
  return {
    id: row.id,
    email: row.email,
    role: row.role,
    status: row.status,
    token: row.token,
    created_at: row.created_at,
    expires_at: row.expires_at ?? null,
    org: org ? { id: org.id, name: org.name } : null,
  };
}

export function usePendingInvitations() {
  const { user, refreshOrgs, setCurrentOrgId } = useAuth();
  const navigate = useNavigate();
  const [invitations, setInvitations] = useState<PendingInvitation[]>([]);
  const [loading, setLoading] = useState(true);
  const [actingToken, setActingToken] = useState<string | null>(null);

  const refetch = useCallback(async () => {
    if (!user?.email) {
      setInvitations([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    const normalizedEmail = user.email.toLowerCase();
    const { data, error } = await supabase
      .from("invitations")
      .select("id, email, role, status, token, created_at, expires_at, orgs:org_id(id, name)")
      .ilike("email", normalizedEmail)
      .eq("status", "pending")
      .gt("expires_at", new Date().toISOString())
      .order("created_at", { ascending: false });

    if (error) {
      console.error("[invitations] pending invitation load failed", error);
      toast.error("Failed to load pending invitations.");
      setInvitations([]);
    } else {
      setInvitations((data ?? []).map(normalizeInvitation));
    }
    setLoading(false);
  }, [user?.email]);

  useEffect(() => {
    void refetch();
  }, [refetch]);

  const acceptInvitation = useCallback(
    async (token: string) => {
      setActingToken(token);
      const { data, error } = await supabase.rpc("accept_invitation", { p_token: token });
      if (error) {
        console.error("[invitations] accept failed", error);
        toast.error(error.message || "Unable to accept the invitation.");
        setActingToken(null);
        return false;
      }

      const accepted = Array.isArray(data) ? data[0] : data;
      await refreshOrgs();
      await refetch();
      if (accepted?.org_id) {
        setCurrentOrgId(accepted.org_id);
        navigate("/app", { replace: true });
      }
      toast.success("Invitation accepted. Workspace access is ready.");
      setActingToken(null);
      return true;
    },
    [navigate, refetch, refreshOrgs, setCurrentOrgId]
  );

  const declineInvitation = useCallback(
    async (token: string) => {
      setActingToken(token);
      const { error } = await supabase.rpc("decline_invitation", { p_token: token });
      if (error) {
        console.error("[invitations] decline failed", error);
        toast.error(error.message || "Unable to decline the invitation.");
        setActingToken(null);
        return false;
      }

      await refetch();
      toast.success("Invitation declined.");
      setActingToken(null);
      return true;
    },
    [refetch]
  );

  return {
    invitations,
    count: invitations.length,
    loading,
    actingToken,
    refetch,
    acceptInvitation,
    declineInvitation,
  };
}
