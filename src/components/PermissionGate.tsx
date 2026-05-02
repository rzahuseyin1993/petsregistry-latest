import { usePermissions, Resource } from "@/hooks/usePermissions";

interface PermissionGateProps {
  resource: Resource;
  action: "view" | "create" | "edit" | "delete";
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

/** Conditionally renders children based on the current user's role permissions. */
const PermissionGate = ({ resource, action, children, fallback = null }: PermissionGateProps) => {
  const { can } = usePermissions();
  return can(resource, action) ? <>{children}</> : <>{fallback}</>;
};

export default PermissionGate;
