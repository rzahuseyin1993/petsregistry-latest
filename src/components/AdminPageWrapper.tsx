import { usePermissions, Resource } from "@/hooks/usePermissions";
import AccessDenied from "@/components/AccessDenied";

interface AdminPageWrapperProps {
  resource: Resource;
  children: React.ReactNode;
}

/** Wraps an admin page and shows AccessDenied if the user lacks view permission. */
const AdminPageWrapper = ({ resource, children }: AdminPageWrapperProps) => {
  const { canView, isLoading, userRole } = usePermissions();

  if (isLoading || !userRole) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  if (!canView(resource)) return <AccessDenied />;

  return <>{children}</>;
};

export default AdminPageWrapper;
