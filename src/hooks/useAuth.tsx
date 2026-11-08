import { useEffect, useState, createContext, useContext } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { User, Session } from "@supabase/supabase-js";

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  signUp: (email: string, password: string, businessName: string) => Promise<void>;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const SIGN_OUT_TIMEOUT_MS = 4000;

/** Removes Supabase's saved session from this browser. */
function clearStoredSession() {
  try {
    for (const key of Object.keys(localStorage)) {
      if (/^sb-.+-auth-token$/.test(key)) localStorage.removeItem(key);
    }
  } catch {
    /* storage blocked */
  }
}

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);
    });

    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const signUp = async (email: string, password: string, businessName: string) => {
    // The business row is created by the on_auth_user_created database
    // trigger, which reads business_name from the user metadata.
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { business_name: businessName.trim() },
        emailRedirectTo: `${window.location.origin}/login`,
      },
    });
    if (error) throw error;
  };

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
  };

  // Logging out must always work on this device, even if the server call
  // fails or stalls (e.g. an expired session or a stuck token refresh).
  const signOut = async () => {
    const timedOut = new Promise<{ error: Error }>((resolve) =>
      setTimeout(() => resolve({ error: new Error("sign-out timed out") }), SIGN_OUT_TIMEOUT_MS)
    );
    try {
      const { error } = await Promise.race([supabase.auth.signOut({ scope: "local" }), timedOut]);
      if (error) console.warn("Sign-out request failed; clearing the session locally:", error.message);
    } catch (e) {
      console.warn("Sign-out request failed; clearing the session locally:", e);
    } finally {
      clearStoredSession();
      setSession(null);
      setUser(null);
    }
  };

  return (
    <AuthContext.Provider value={{ user, session, loading, signUp, signIn, signOut }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used within AuthProvider");
  return context;
};
