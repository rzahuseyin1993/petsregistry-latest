import { Navigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useIsMobileRoute } from "@/hooks/useIsMobileRoute";

const ProtectedRoute = ({ children, adminOnly = false }: { children: React.ReactNode; adminOnly?: boolean }) => {
  const { user, isStaff, loading, rolesLoading } = useAuth();
  const isMobile = useIsMobileRoute();

  if (loading || (adminOnly && user && rolesLoading && !isStaff)) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  if (!user) return <Navigate to={adminOnly ? "/admin/login" : isMobile ? "/m/login" : "/login"} replace />;
  if (adminOnly && !isStaff) return <Navigate to="/admin/login" replace />;

  return <>{children}</>;
};

export default ProtectedRoute;
