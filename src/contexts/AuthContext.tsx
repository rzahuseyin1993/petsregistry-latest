import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

interface MembershipInfo {
  planType: string;
  planName: string;
  badgeIconUrl: string | null;
  expiresAt: string;
}

interface AuthContextType {
  session: Session | null;
  user: User | null;
  profile: { full_name: string | null; email: string; phone: string | null; show_name: boolean; show_phone: boolean; address: string | null; city: string | null; country: string | null } | null;
  isAdmin: boolean;
  isStaff: boolean; // admin OR moderator
  membership: MembershipInfo | null;
  loading: boolean;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  session: null, user: null, profile: null, isAdmin: false, isStaff: false, membership: null, loading: true, signOut: async () => {},
});

export const useAuth = () => useContext(AuthContext);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<AuthContextType["profile"]>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isStaff, setIsStaff] = useState(false);
  const [membership, setMembership] = useState<MembershipInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [roleChecksAvailable, setRoleChecksAvailable] = useState(true);
  const [membershipChecksAvailable, setMembershipChecksAvailable] = useState(true);

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      setUser(session?.user ?? null);
    });

    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!user) {
      setProfile(null);
      setIsAdmin(false);
      setIsStaff(false);
      setMembership(null);
      return;
    }
    // Fetch profile
    supabase.from("profiles").select("full_name, email, phone, show_name, show_phone, address, city, country").eq("user_id", user.id).single()
      .then(({ data }) => { if (data) setProfile(data as any); });
    // Check role membership via user_roles table to avoid dependency on has_role RPC.
    if (roleChecksAvailable) {
      supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id)
        .then(({ data, error }) => {
          if (error) {
            setRoleChecksAvailable(false);
            setIsAdmin(false);
            setIsStaff(false);
            return;
          }
          const roles = new Set((data ?? []).map((row) => row.role));
          const admin = roles.has("admin");
          const staff = admin || roles.has("moderator") || roles.has("seo_admin");
          setIsAdmin(admin);
          setIsStaff(staff);
        });
    }
    // Fetch active membership
    if (membershipChecksAvailable) {
      supabase.from("memberships")
        .select("*, membership_plans(name, plan_type, badge_icon_url)")
        .eq("user_id", user.id)
        .eq("status", "active")
        .gte("expires_at", new Date().toISOString())
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle()
        .then(({ data, error }) => {
          if (error) {
            setMembershipChecksAvailable(false);
            setMembership(null);
            return;
          }
          if (data && (data as any).membership_plans) {
            setMembership({
              planType: (data as any).membership_plans.plan_type,
              planName: (data as any).membership_plans.name,
              badgeIconUrl: (data as any).membership_plans.badge_icon_url || null,
              expiresAt: data.expires_at,
            });
          } else {
            setMembership(null);
          }
        });
    }
  }, [user]);

  const signOut = async () => {
    await supabase.auth.signOut();
    setSession(null);
    setUser(null);
    setProfile(null);
    setIsAdmin(false);
    setIsStaff(false);
    setMembership(null);
  };

  return (
    <AuthContext.Provider value={{ session, user, profile, isAdmin, isStaff, membership, loading, signOut }}>
      {children}
    </AuthContext.Provider>
  );
};
