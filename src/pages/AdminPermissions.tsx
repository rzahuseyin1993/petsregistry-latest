import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Shield, Save, Loader2 } from "lucide-react";
import { useAllRolePermissions, Resource } from "@/hooks/usePermissions";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

const RESOURCE_LABELS: Record<Resource, string> = {
  dashboard: "Dashboard Overview",
  members: "Members Management",
  pets: "All Pets",
  orders: "Store Orders",
  products: "Products",
  memberships: "Memberships",
  donations: "Donations",
  directory: "Business Directory",
  lost_reports: "Lost Reports",
  contacts: "Contact & Messages",
  flyer_templates: "Flyer Templates",
  page_builder: "Page Builder",
  payments: "Payment Settings",
  settings: "Site Settings",
  permissions: "Permissions",
  certificates: "Pet Certificates",
  blog: "Resources / Blog",
  seo: "SEO & Tracking",
};

const ACTIONS = [
  { key: "can_view", label: "View" },
  { key: "can_create", label: "Create" },
  { key: "can_edit", label: "Edit" },
  { key: "can_delete", label: "Delete" },
] as const;

const ROLE_META: Record<string, { label: string; color: string; description: string }> = {
  admin: { label: "Admin", color: "bg-destructive/10 text-destructive", description: "Full system access. Admin permissions cannot be restricted." },
  seo_admin: { label: "SEO Admin", color: "bg-blue-500/10 text-blue-600", description: "Access to Resources/Blog and SEO & Tracking only." },
  moderator: { label: "Moderator", color: "bg-amber-500/10 text-amber-600", description: "Configure which admin pages and actions moderators can access." },
  user: { label: "User", color: "bg-muted text-muted-foreground", description: "Regular users. Enable specific admin capabilities if needed." },
};

const AdminPermissions = () => {
  const { data: allPerms = [], isLoading } = useAllRolePermissions();
  const [changes, setChanges] = useState<Record<string, Record<string, boolean>>>({});
  const [saving, setSaving] = useState(false);
  const queryClient = useQueryClient();

  const getPermValue = (id: string, field: string, original: boolean): boolean => {
    return changes[id]?.[field] ?? original;
  };

  const handleToggle = (id: string, field: string, currentValue: boolean) => {
    setChanges((prev) => ({
      ...prev,
      [id]: { ...(prev[id] || {}), [field]: !currentValue },
    }));
  };

  const hasChanges = Object.keys(changes).length > 0;

  const handleSave = async () => {
    setSaving(true);
    try {
      for (const [id, fields] of Object.entries(changes)) {
        const { error } = await supabase
          .from("role_permissions" as any)
          .update(fields)
          .eq("id", id);
        if (error) throw error;
      }
      setChanges({});
      queryClient.invalidateQueries({ queryKey: ["all-role-permissions"] });
      queryClient.invalidateQueries({ queryKey: ["role-permissions"] });
      toast.success("Permissions saved successfully");
    } catch (err: any) {
      toast.error("Failed to save: " + err.message);
    } finally {
      setSaving(false);
    }
  };

  const rolePerms = (role: string) => allPerms.filter((p) => p.role === role);

  if (isLoading) {
    return (
              <main className="flex flex-1 items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </main>
    );
  }

  return (
          <main className="flex-1 overflow-auto p-6">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="flex items-center gap-2 text-2xl font-bold text-foreground">
              <Shield className="h-6 w-6 text-primary" /> Role Permissions
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Control what each role can see and do in the admin panel
            </p>
          </div>
          {hasChanges && (
            <Button onClick={handleSave} disabled={saving} className="gap-2">
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              Save Changes
            </Button>
          )}
        </div>

        <Tabs defaultValue="moderator">
          <TabsList className="mb-4">
            {["admin", "seo_admin", "moderator", "user"].map((role) => (
              <TabsTrigger key={role} value={role} className="gap-2">
                <Badge variant="outline" className={ROLE_META[role].color + " text-xs"}>
                  {ROLE_META[role].label}
                </Badge>
              </TabsTrigger>
            ))}
          </TabsList>

          {["admin", "seo_admin", "moderator", "user"].map((role) => (
            <TabsContent key={role} value={role}>
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Badge variant="outline" className={ROLE_META[role].color}>
                      {ROLE_META[role].label}
                    </Badge>
                    Permissions
                  </CardTitle>
                  <CardDescription>{ROLE_META[role].description}</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-border">
                          <th className="py-3 pr-4 text-left font-medium text-muted-foreground">Resource</th>
                          {ACTIONS.map((a) => (
                            <th key={a.key} className="px-4 py-3 text-center font-medium text-muted-foreground">{a.label}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {rolePerms(role).map((perm) => {
                          const isAdminRole = role === "admin";
                          return (
                            <tr key={perm.id} className="border-b border-border/50 last:border-0">
                              <td className="py-3 pr-4 font-medium text-foreground">
                                {RESOURCE_LABELS[perm.resource as Resource] || perm.resource}
                              </td>
                              {ACTIONS.map((action) => {
                                const value = getPermValue(perm.id, action.key, (perm as any)[action.key]);
                                return (
                                  <td key={action.key} className="px-4 py-3 text-center">
                                    <Switch
                                      checked={value}
                                      disabled={isAdminRole}
                                      onCheckedChange={() => handleToggle(perm.id, action.key, value)}
                                    />
                                  </td>
                                );
                              })}
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                  {role === "admin" && (
                    <p className="mt-4 text-xs text-muted-foreground italic">
                      Admin permissions are locked and cannot be modified for security.
                    </p>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          ))}
        </Tabs>
      </main>
  );
};

export default AdminPermissions;
