import { usePermissions, Resource } from "@/hooks/usePermissions";
import AccessDenied from "@/components/AccessDenied";

interface AdminPageWrapperProps {
  resource: Resource;
  children: React.ReactNode;
}

/** Wraps an admin page and shows AccessDenied if the user lacks view permission. */
const AdminPageWrapper = ({ resource, children }: AdminPageWrapperProps) => {
  const { canView, isLoading, userRole } = usePermissions();

  // Full-screen block only on first load when no cached role exists yet
  if (!userRole && isLoading) {
    return (
      <div className="flex flex-1 items-center justify-center p-8">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  if (userRole && !isLoading && !canView(resource)) return <AccessDenied />;

  return <>{children}</>;
};

export default AdminPageWrapper;
