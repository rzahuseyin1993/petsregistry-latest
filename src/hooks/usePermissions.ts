import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export type Resource =
  | "dashboard" | "members" | "pets" | "orders" | "products"
  | "memberships" | "donations" | "directory" | "lost_reports"
  | "contacts" | "flyer_templates" | "page_builder" | "payments"
  | "settings" | "permissions" | "certificates" | "blog" | "seo";

export interface Permission {
  resource: Resource;
  can_view: boolean;
  can_create: boolean;
  can_edit: boolean;
  can_delete: boolean;
}

export const usePermissions = () => {
  const { user, isAdmin } = useAuth();

  const { data: userRole } = useQuery({
    queryKey: ["user-role", user?.id],
    queryFn: async () => {
      if (!user) return null;
      const { data } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id)
        .order("role") // admin > moderator > user priority
        .limit(1)
        .maybeSingle();
      return data?.role || "user";
    },
    enabled: !!user,
  });

  const { data: permissions = [], isLoading } = useQuery({
    queryKey: ["role-permissions", userRole],
    queryFn: async () => {
      if (!userRole) return [];
      const { data } = await supabase
        .from("role_permissions" as any)
        .select("resource, can_view, can_create, can_edit, can_delete")
        .eq("role", userRole);
      return (data || []) as unknown as Permission[];
    },
    enabled: !!userRole,
  });

  const can = (resource: Resource, action: "view" | "create" | "edit" | "delete"): boolean => {
    // Admin role always has full access as a fallback
    if (isAdmin) return true;
    const perm = permissions.find((p) => p.resource === resource);
    if (!perm) return false;
    switch (action) {
      case "view": return perm.can_view;
      case "create": return perm.can_create;
      case "edit": return perm.can_edit;
      case "delete": return perm.can_delete;
      default: return false;
    }
  };

  const canView = (resource: Resource) => can(resource, "view");
  const canCreate = (resource: Resource) => can(resource, "create");
  const canEdit = (resource: Resource) => can(resource, "edit");
  const canDelete = (resource: Resource) => can(resource, "delete");

  return { permissions, can, canView, canCreate, canEdit, canDelete, userRole, isLoading };
};

// Hook to fetch ALL role permissions (for the admin settings page)
export const useAllRolePermissions = () => {
  return useQuery({
    queryKey: ["all-role-permissions"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("role_permissions" as any)
        .select("*")
        .order("role")
        .order("resource");
      if (error) throw error;
      return (data || []) as unknown as Array<Permission & { id: string; role: string }>;
    },
  });
};
