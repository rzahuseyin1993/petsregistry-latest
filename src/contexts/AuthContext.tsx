import { createContext, useContext, useEffect, useRef, useState, ReactNode } from "react";
import { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { canUpgradeMembership, hasTopMembership, pickPrimaryMembershipPlanType } from "@/lib/membership";

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
  isStaff: boolean; // admin OR moderator OR seo_admin
  rolesLoading: boolean;
  membership: MembershipInfo | null;
  canUpgradeMembership: boolean;
  hasTopMembership: boolean;
  loading: boolean;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  session: null, user: null, profile: null, isAdmin: false, isStaff: false, rolesLoading: true, membership: null, canUpgradeMembership: false, hasTopMembership: false, loading: true, signOut: async () => {}, refreshProfile: async () => {},
});

export const useAuth = () => useContext(AuthContext);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<AuthContextType["profile"]>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isStaff, setIsStaff] = useState(false);
  const [rolesLoading, setRolesLoading] = useState(true);
  const [membership, setMembership] = useState<MembershipInfo | null>(null);
  const [canUpgrade, setCanUpgrade] = useState(false);
  const [isTopMember, setIsTopMember] = useState(false);
  const [loading, setLoading] = useState(true);
  const [roleChecksAvailable, setRoleChecksAvailable] = useState(true);
  const [membershipChecksAvailable, setMembershipChecksAvailable] = useState(true);
  const rolesLoadedForUserId = useRef<string | null>(null);

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

  const userId = user?.id;

  useEffect(() => {
    if (!userId) {
      rolesLoadedForUserId.current = null;
      setProfile(null);
      setIsAdmin(false);
      setIsStaff(false);
      setRolesLoading(false);
      setMembership(null);
      setCanUpgrade(false);
      setIsTopMember(false);
      return;
    }
    // Fetch profile
    supabase.from("profiles").select("full_name, email, phone, show_name, show_phone, address, city, country").eq("user_id", userId).single()
      .then(({ data }) => { if (data) setProfile(data as any); });
    // Check role membership via user_roles table to avoid dependency on has_role RPC.
    if (roleChecksAvailable) {
      const rolesAlreadyLoaded = rolesLoadedForUserId.current === userId;
      if (!rolesAlreadyLoaded) setRolesLoading(true);
      supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", userId)
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
          rolesLoadedForUserId.current = userId;
        })
        .finally(() => setRolesLoading(false));
    } else {
      setRolesLoading(false);
    }
    // Fetch all active memberships (for badge + upgrade eligibility)
    if (membershipChecksAvailable) {
      supabase.from("memberships")
        .select("*, membership_plans(name, plan_type, badge_icon_url)")
        .eq("user_id", userId)
        .eq("status", "active")
        .gte("expires_at", new Date().toISOString())
        .order("created_at", { ascending: false })
        .then(({ data, error }) => {
          if (error) {
            setMembershipChecksAvailable(false);
            setMembership(null);
            setCanUpgrade(false);
            setIsTopMember(false);
            return;
          }
          const rows = data || [];
          const planTypes = rows
            .map((row) => (row as any).membership_plans?.plan_type as string | undefined)
            .filter((t): t is string => !!t);

          setCanUpgrade(canUpgradeMembership(planTypes));
          setIsTopMember(hasTopMembership(planTypes));

          const primaryType = pickPrimaryMembershipPlanType(planTypes);
          const primaryRow = rows.find(
            (row) => (row as any).membership_plans?.plan_type === primaryType,
          );

          if (primaryRow && (primaryRow as any).membership_plans) {
            setMembership({
              planType: (primaryRow as any).membership_plans.plan_type,
              planName: (primaryRow as any).membership_plans.name,
              badgeIconUrl: (primaryRow as any).membership_plans.badge_icon_url || null,
              expiresAt: primaryRow.expires_at,
            });
          } else {
            setMembership(null);
          }
        });
    }
  }, [userId, roleChecksAvailable, membershipChecksAvailable]);

  const refreshProfile = async () => {
    if (!userId) return;
    const { data } = await supabase
      .from("profiles")
      .select("full_name, email, phone, show_name, show_phone, address, city, country")
      .eq("user_id", userId)
      .single();
    if (data) setProfile(data as any);
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    setSession(null);
    setUser(null);
    setProfile(null);
    setIsAdmin(false);
    setIsStaff(false);
    setMembership(null);
    setCanUpgrade(false);
    setIsTopMember(false);
    rolesLoadedForUserId.current = null;
  };

  return (
    <AuthContext.Provider value={{ session, user, profile, isAdmin, isStaff, rolesLoading, membership, canUpgradeMembership: canUpgrade, hasTopMembership: isTopMember, loading, signOut, refreshProfile }}>
      {children}
    </AuthContext.Provider>
  );
};
