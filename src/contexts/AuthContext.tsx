import { createContext, useContext, useEffect, useState, ReactNode, useCallback, useRef } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase, clearInvalidStoredSession } from "@/lib/supabase";

export type Org = { id: string; name: string; slug: string; plan: string; role: string };

type AuthContextValue = {
  user: User | null;
  session: Session | null;
  loading: boolean;
  orgs: Org[];
  currentOrgId: string | null;
  setCurrentOrgId: (id: string) => void;
  refreshOrgs: () => Promise<void>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

const ORG_KEY = "dashforge.currentOrg";

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [orgs, setOrgs] = useState<Org[]>([]);
  const [currentOrgId, setCurrentOrgIdState] = useState<string | null>(
    () => (typeof window !== "undefined" ? localStorage.getItem(ORG_KEY) : null),
  );

  const setCurrentOrgId = useCallback((id: string) => {
    setCurrentOrgIdState(id);
    localStorage.setItem(ORG_KEY, id);
  }, []);

  const refreshOrgs = useCallback(async () => {
    // Ensure we indicate loading while fetching orgs
    setLoading(true);
    try {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) {
        setOrgs([]);
        return;
      }

      const { data, error } = await supabase
        .from("org_members")
        .select("role, orgs:org_id (id, name, slug, plan)")
        .eq("user_id", userData.user.id);
      if (error) {
        console.error("[auth] refreshOrgs failed", error);
        return;
      }

      let list: Org[] = (data ?? [])
        .map((row: any) => row.orgs && { ...row.orgs, role: row.role })
        .filter(Boolean);

      // If user has no orgs, create a default org AND ensure org_members entry
      if (list.length === 0) {
        const username = userData.user.email?.split("@")[0] ?? "workspace";
        const slug = `${username.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "").slice(0, 30)}-${Math.random().toString(36).slice(2, 6)}`;
        const { data: createdOrg, error: orgErr } = await supabase
          .from("orgs")
          .insert({ name: `${username}'s workspace`, slug, owner_id: userData.user.id, created_by: userData.user.id })
          .select("id, name, slug, plan")
          .single();
        if (orgErr) {
          console.error("[auth] create default org failed", orgErr);
        } else if (createdOrg) {
          // Immediately insert org_members for the creator to avoid RLS race
          try {
            const { error: memberErr } = await supabase
              .from("org_members")
              .insert({ org_id: createdOrg.id, user_id: userData.user.id, role: "owner" })
              .select();
            if (memberErr) {
              // If insert fails due to RLS, log it; trigger may still create the member.
              console.error("[auth] create default org_members failed", memberErr);
            }
          } catch (e) {
            console.error("[auth] create default org_members unexpected error", e);
          }
          list = [{ ...createdOrg, role: "owner" }];
        }
      }

      setOrgs(list);
      if (list.length && (!currentOrgId || !list.find((o) => o.id === currentOrgId))) {
        setCurrentOrgId(list[0].id);
      }
    } finally {
      setLoading(false);
    }
  }, [currentOrgId, setCurrentOrgId]);

  useEffect(() => {
    // 1. Cleanup any invalid sessions left by older SDKs or broken states.
    clearInvalidStoredSession();

    // 2. Subscribe FIRST (avoids missing the SIGNED_IN event)
    const { data: subscription } = supabase.auth.onAuthStateChange((_event, newSession) => {
      console.debug("[auth] onAuthStateChange", _event, !!newSession);
      setSession(newSession);
      setUser(newSession?.user ?? null);
      // Refresh orgs when auth changes. refreshOrgs handles its own loading state.
      if (newSession?.user) {
        // Fire-and-forget; refreshOrgs toggles loading internally
        void refreshOrgs();
      } else {
        setOrgs([]);
      }
    });

    // 3. Then load existing session and ensure orgs are refreshed before marking loading false
    let mounted = true;
    (async () => {
      try {
        const { data } = await supabase.auth.getSession();
        if (!mounted) return;
        setSession(data.session);
        setUser(data.session?.user ?? null);
        if (data.session?.user) {
          await refreshOrgs();
        } else {
          setOrgs([]);
        }
      } catch (e) {
        console.debug("[auth] getSession error", e);
      }
    })();

    return () => {
      mounted = false;
      try { subscription?.unsubscribe(); } catch (e) { /* ignore */ }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const signOut = useCallback(async () => {
    try {
      await supabase.auth.signOut();
    } catch (e) {
      console.debug("[auth] signOut error", e);
    }
    // Remove persisted org selection and any stale auth session on sign out.
    try { localStorage.removeItem(ORG_KEY); } catch (e) { /* ignore */ }
    try { clearInvalidStoredSession(); } catch (e) { /* ignore */ }
    setCurrentOrgIdState(null);
  }, []);

  return (
    <AuthContext.Provider
      value={{ user, session, loading, orgs, currentOrgId, setCurrentOrgId, refreshOrgs, signOut }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside <AuthProvider>");
  return ctx;
}

export function useUser() {
  return useAuth().user;
}
