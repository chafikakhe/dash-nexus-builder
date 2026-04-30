import { createContext, useContext, useEffect, useState, ReactNode, useCallback } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";

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
    const list: Org[] = (data ?? [])
      .map((row: any) => row.orgs && { ...row.orgs, role: row.role })
      .filter(Boolean);
    setOrgs(list);
    if (list.length && (!currentOrgId || !list.find((o) => o.id === currentOrgId))) {
      setCurrentOrgId(list[0].id);
    }
  }, [currentOrgId, setCurrentOrgId]);

  useEffect(() => {
    // 1. Subscribe FIRST (avoids missing the SIGNED_IN event)
    const { data: sub } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession);
      setUser(newSession?.user ?? null);
      // Defer Supabase calls out of the listener to avoid deadlocks
      if (newSession?.user) {
        setTimeout(() => { refreshOrgs(); }, 0);
      } else {
        setOrgs([]);
      }
    });

    // 2. Then load existing session
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setUser(data.session?.user ?? null);
      setLoading(false);
      if (data.session?.user) refreshOrgs();
    });

    return () => sub.subscription.unsubscribe();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
    localStorage.removeItem(ORG_KEY);
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
