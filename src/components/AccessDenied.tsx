import { ShieldX } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";

const AccessDenied = () => {
  const navigate = useNavigate();
  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <div className="text-center space-y-4">
        <ShieldX className="mx-auto h-16 w-16 text-destructive/60" />
        <h1 className="text-3xl font-bold text-foreground">Access Denied</h1>
        <p className="text-muted-foreground max-w-sm mx-auto">
          You don't have permission to view this page. Contact an administrator if you believe this is an error.
        </p>
        <Button variant="outline" onClick={() => navigate("/admin")}>
          Back to Dashboard
        </Button>
      </div>
    </div>
  );
};

export default AccessDenied;
