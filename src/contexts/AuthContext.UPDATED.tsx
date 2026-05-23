import { createContext, useContext, useEffect, useState, ReactNode, useCallback, useRef } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase, clearInvalidStoredSession } from "@/lib/supabase";

type AuthContextValue = {
  user: User | null;
  session: Session | null;
  loading: boolean;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const mountedRef = useRef(true);

  useEffect(() => {
    // 1. Cleanup any invalid sessions left by older SDKs or broken states.
    clearInvalidStoredSession();

    // 2. Subscribe FIRST (avoids missing the SIGNED_IN event)
    const { data: subscription } = supabase.auth.onAuthStateChange((_event, newSession) => {
      console.debug("[auth] onAuthStateChange", _event, !!newSession);
      if (mountedRef.current) {
        setSession(newSession);
        setUser(newSession?.user ?? null);
      }
    });

    // 3. Then load existing session
    (async () => {
      try {
        const { data } = await supabase.auth.getSession();
        if (mountedRef.current) {
          setSession(data.session);
          setUser(data.session?.user ?? null);
        }
      } catch (e) {
        console.debug("[auth] getSession error", e);
      } finally {
        if (mountedRef.current) {
          setLoading(false);
        }
      }
    })();

    return () => {
      mountedRef.current = false;
      try {
        subscription?.unsubscribe();
      } catch (e) {
        /* ignore */
      }
    };
  }, []);

  const signOut = useCallback(async () => {
    try {
      await supabase.auth.signOut();
    } catch (e) {
      console.debug("[auth] signOut error", e);
    }
    try {
      clearInvalidStoredSession();
    } catch (e) {
      /* ignore */
    }
  }, []);

  return (
    <AuthContext.Provider value={{ user, session, loading, signOut }}>
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
