import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState, useEffect } from "react";
import { toast } from "sonner";
import { Save, Mail, Globe, Bell, Lock, Smartphone, DollarSign, Server, Send, AlertTriangle } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { useAuth } from "@/contexts/AuthContext";

const AdminSettings = () => {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const [values, setValues] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  // Password change
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [changingPassword, setChangingPassword] = useState(false);

  const { data: settings = [], isLoading } = useQuery({
    queryKey: ["site-settings"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("site_settings")
        .select("*")
        .order("key");
      if (error) throw error;
      return data;
    },
  });

  useEffect(() => {
    if (settings.length > 0) {
      const map: Record<string, string> = {};
      settings.forEach((s: any) => { map[s.key] = s.value; });
      if (map.maintenance_mode == null) map.maintenance_mode = "false";
      setValues(map);
    }
  }, [settings]);

  const handleSave = async () => {
    setSaving(true);
    try {
      for (const [key, value] of Object.entries(values)) {
        const { error } = await supabase
          .from("site_settings")
          .upsert({ key, value, updated_at: new Date().toISOString() }, { onConflict: "key" });
        if (error) throw error;
      }
      toast.success("Settings saved successfully!");
      queryClient.invalidateQueries({ queryKey: ["site-settings"] });
      // The public footer/contact page cache the contact email under this key
      queryClient.invalidateQueries({ queryKey: ["site-email"] });
    } catch (err) {
      toast.error("Failed to save settings");
    } finally {
      setSaving(false);
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword !== confirmPassword) {
      toast.error("New passwords do not match");
      return;
    }
    if (newPassword.length < 6) {
      toast.error("Password must be at least 6 characters");
      return;
    }
    setChangingPassword(true);

    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: user?.email || "",
      password: currentPassword,
    });
    if (signInError) {
      setChangingPassword(false);
      toast.error("Current password is incorrect");
      return;
    }

    const { error } = await supabase.auth.updateUser({ password: newPassword });
    setChangingPassword(false);
    if (error) toast.error("Failed to change password: " + error.message);
    else {
      toast.success("Password changed successfully!");
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    }
  };

  const mobileEnabled = values["mobile_site_enabled"] !== "false";

  const handleMobileToggle = (checked: boolean) => {
    setValues((prev) => ({ ...prev, mobile_site_enabled: checked ? "true" : "false" }));
  };

  const maintenanceEnabled = values["maintenance_mode"] === "true";

  const handleMaintenanceToggle = async (checked: boolean) => {
    const value = checked ? "true" : "false";
    setValues((prev) => ({ ...prev, maintenance_mode: value }));
    try {
      const { error } = await supabase.from("site_settings").upsert(
        {
          key: "maintenance_mode",
          value,
          description: "When true, the public site shows the maintenance page.",
        },
        { onConflict: "key" },
      );
      if (error) throw error;
      toast.success(checked ? "Maintenance mode enabled" : "Site is now live");
      queryClient.invalidateQueries({ queryKey: ["site-settings"] });
    } catch {
      toast.error("Failed to update maintenance mode");
    }
  };

  const smtpEnabled = values["smtp_enabled"] === "true";
  const handleSmtpToggle = (checked: boolean) => {
    setValues((prev) => ({ ...prev, smtp_enabled: checked ? "true" : "false" }));
  };

  const handleTestSmtp = async () => {
    if (!values["smtp_host"] || !values["smtp_from_email"]) {
      toast.error("Please fill in SMTP host and from email first");
      return;
    }
    toast.info("Sending test email...");
    try {
      const { data, error } = await supabase.functions.invoke("send-smtp-email", {
        body: {
          to: values["smtp_from_email"],
          subject: "SMTP Test - PetsRegistry",
          html: "<h2>✅ SMTP is working!</h2><p>Your email configuration is correct.</p>",
        },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      toast.success("Test email sent successfully!");
    } catch (err: any) {
      toast.error("Test failed: " + (err.message || "Unknown error"));
    }
  };

  const settingGroups = [
    {
      title: "Pricing",
      description: "Manage fees for certificates, flyers, and other paid features",
      icon: DollarSign,
      fields: [
        { key: "certificate_fee", label: "Pet Certificate Fee ($)", placeholder: "20", description: "One-time fee per pet certificate (USD)" },
        { key: "flyer_fee", label: "Flyer Builder Fee ($)", placeholder: "2", description: "One-time fee for lifetime flyer builder access (USD)" },
        { key: "directory_per_page", label: "Directory Listings Per Page", placeholder: "8", description: "Number of business listings shown per page on the directory front page" },
      ],
    },
    {
      title: "Email Configuration",
      description: "Configure email addresses used across the platform",
      icon: Mail,
      fields: [
        { key: "site_email", label: "Site Email", placeholder: "support@petsregistry.org", description: "Main contact email displayed on the site (footer & contact page)" },
        { key: "notification_email", label: "Notification Sender Email", placeholder: "notifications@petsregistry.org", description: "From address for system notifications" },
        { key: "support_email", label: "Support Email", placeholder: "support@petsregistry.org", description: "Receives contact form submissions and support requests" },
      ],
    },
    {
      title: "Site Settings",
      description: "General site configuration",
      icon: Globe,
      fields: [
        { key: "site_name", label: "Site Name", placeholder: "PetsRegistry", description: "Displayed in headers and emails" },
      ],
    },
    {
      title: "Notification Settings",
      description: "Configure alert and notification behavior",
      icon: Bell,
      fields: [
        { key: "lost_pet_alert_radius_km", label: "Lost Pet Alert Radius (km)", placeholder: "5", description: "Radius in kilometers for sending lost pet alerts to nearby users" },
      ],
    },
  ];

  const handleGenerateVapid = async () => {
    try {
      toast.info("Generating VAPID keys...");
      const { data, error } = await supabase.functions.invoke("push-notifications", {
        body: { action: "generate-vapid" },
      });
      if (error) throw error;
      if (data?.publicKey) {
        setValues((prev) => ({ ...prev, vapid_public_key: data.publicKey }));
        toast.success("VAPID keys generated! Push notifications are now available.");
      }
    } catch (err: any) {
      toast.error("Failed to generate VAPID keys: " + (err.message || "Unknown error"));
    }
  };

  if (isLoading) {
    return (
              <main className="flex-1 bg-background p-6 md:p-8">
          <div className="flex justify-center pt-20">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
          </div>
        </main>
    );
  }

  return (
          <main className="flex-1 bg-background p-6 md:p-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="font-display text-2xl font-bold text-foreground">Settings</h1>
            <p className="text-sm text-muted-foreground">Manage site-wide configuration</p>
          </div>
          <Button onClick={handleSave} disabled={saving} className="gap-2">
            <Save className="h-4 w-4" />
            {saving ? "Saving..." : "Save Changes"}
          </Button>
        </div>

        <div className="mt-8 space-y-6">
          {/* Maintenance mode */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <AlertTriangle className="h-5 w-5 text-primary" />
                Maintenance Mode
              </CardTitle>
              <CardDescription>
                Show a maintenance page to all visitors. Overrides the build-time{" "}
                <code className="text-xs">VITE_MAINTENANCE_MODE</code> setting when saved here.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between max-w-md">
                <div>
                  <p className="text-sm font-medium">
                    {maintenanceEnabled ? "Maintenance mode is ON" : "Site is LIVE"}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Build default: {import.meta.env.VITE_MAINTENANCE_MODE === "true" ? "maintenance" : "live"}
                  </p>
                </div>
                <Switch checked={maintenanceEnabled} onCheckedChange={handleMaintenanceToggle} />
              </div>
            </CardContent>
          </Card>

          {/* Mobile Site Toggle */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <Smartphone className="h-5 w-5 text-primary" />
                Mobile Site
              </CardTitle>
              <CardDescription>Enable or disable the mobile version of the website (/m)</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between max-w-md">
                <div>
                  <p className="text-sm font-medium">{mobileEnabled ? "Mobile site is active" : "Mobile site is disabled"}</p>
                  <p className="text-xs text-muted-foreground">When disabled, visitors accessing /m will be redirected to the desktop site</p>
                </div>
                <Switch checked={mobileEnabled} onCheckedChange={handleMobileToggle} />
              </div>
            </CardContent>
          </Card>

          {/* SMTP Configuration */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <Server className="h-5 w-5 text-primary" />
                SMTP Email Server
              </CardTitle>
              <CardDescription>Configure your own SMTP server for sending emails (for cPanel or custom mail server)</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between max-w-md">
                <div>
                  <p className="text-sm font-medium">{smtpEnabled ? "SMTP sending is active" : "SMTP sending is disabled"}</p>
                  <p className="text-xs text-muted-foreground">Enable to send emails via your own SMTP server</p>
                </div>
                <Switch checked={smtpEnabled} onCheckedChange={handleSmtpToggle} />
              </div>
              <div className="grid gap-4 md:grid-cols-2 max-w-2xl">
                <div className="space-y-1.5">
                  <Label htmlFor="smtp_host">SMTP Host</Label>
                  <Input id="smtp_host" value={values["smtp_host"] || ""} placeholder="mail.yourdomain.com" onChange={(e) => setValues((p) => ({ ...p, smtp_host: e.target.value }))} />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="smtp_port">SMTP Port</Label>
                  <Input id="smtp_port" value={values["smtp_port"] || "587"} placeholder="587" onChange={(e) => setValues((p) => ({ ...p, smtp_port: e.target.value }))} />
                  <p className="text-xs text-muted-foreground">587 for TLS, 465 for SSL, 25 for unencrypted</p>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="smtp_username">SMTP Username</Label>
                  <Input id="smtp_username" value={values["smtp_username"] || ""} placeholder="user@yourdomain.com" onChange={(e) => setValues((p) => ({ ...p, smtp_username: e.target.value }))} />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="smtp_password">SMTP Password</Label>
                  <Input id="smtp_password" type="password" value={values["smtp_password"] || ""} placeholder="••••••••" onChange={(e) => setValues((p) => ({ ...p, smtp_password: e.target.value }))} />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="smtp_from_email">From Email</Label>
                  <Input id="smtp_from_email" value={values["smtp_from_email"] || ""} placeholder="noreply@yourdomain.com" onChange={(e) => setValues((p) => ({ ...p, smtp_from_email: e.target.value }))} />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="smtp_from_name">From Name</Label>
                  <Input id="smtp_from_name" value={values["smtp_from_name"] || ""} placeholder="PetsRegistry" onChange={(e) => setValues((p) => ({ ...p, smtp_from_name: e.target.value }))} />
                </div>
              </div>
              <Button variant="outline" className="gap-2" onClick={handleTestSmtp} disabled={!smtpEnabled}>
                <Send className="h-4 w-4" />
                Send Test Email
              </Button>
            </CardContent>
          </Card>

          {settingGroups.map((group) => {
            const Icon = group.icon;
            return (
              <Card key={group.title}>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <Icon className="h-5 w-5 text-primary" />
                    {group.title}
                  </CardTitle>
                  <CardDescription>{group.description}</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {group.fields.map((field) => (
                    <div key={field.key} className="space-y-1.5">
                      <Label htmlFor={field.key}>{field.label}</Label>
                      <Input
                        id={field.key}
                        value={values[field.key] || ""}
                        placeholder={field.placeholder}
                        onChange={(e) => setValues((prev) => ({ ...prev, [field.key]: e.target.value }))}
                      />
                      <p className="text-xs text-muted-foreground">{field.description}</p>
                    </div>
                  ))}
                </CardContent>
              </Card>
            );
          })}

          {/* Push Notifications */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <Bell className="h-5 w-5 text-primary" />
                Browser Push Notifications
              </CardTitle>
              <CardDescription>Enable browser push notifications so members get alerts even when the app is closed</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <p className="text-sm font-medium">VAPID Public Key</p>
                <Input value={values["vapid_public_key"] || ""} disabled placeholder="Not generated yet" className="font-mono text-xs" />
                <p className="text-xs text-muted-foreground">
                  {values["vapid_public_key"] ? "✅ VAPID keys are configured. Members can opt-in to push notifications." : "Generate VAPID keys to enable push notifications for members."}
                </p>
              </div>
              <Button variant="outline" className="gap-2" onClick={handleGenerateVapid}>
                <Bell className="h-4 w-4" />
                {values["vapid_public_key"] ? "Regenerate VAPID Keys" : "Generate VAPID Keys"}
              </Button>
            </CardContent>
          </Card>

          {/* Lost Report Auto-Cleanup */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <AlertTriangle className="h-5 w-5 text-primary" />
                Lost Report Retention
              </CardTitle>
              <CardDescription>Auto-delete old lost-pet reports to keep the system tidy. A daily job runs in the background.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4 max-w-md">
              <div className="space-y-1.5">
                <Label htmlFor="lost_report_retention_days">Delete reports older than (days)</Label>
                <Input
                  id="lost_report_retention_days"
                  type="number"
                  min={0}
                  value={values["lost_report_retention_days"] || ""}
                  placeholder="365"
                  onChange={(e) => setValues((p) => ({ ...p, lost_report_retention_days: e.target.value }))}
                />
                <p className="text-xs text-muted-foreground">e.g. 30 = 1 month, 365 = 1 year, 730 = 2 years. Set 0 to never delete.</p>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="lost_report_found_visible_days">Keep "Found" reports visible for (days)</Label>
                <Input
                  id="lost_report_found_visible_days"
                  type="number"
                  min={0}
                  value={values["lost_report_found_visible_days"] || ""}
                  placeholder="7"
                  onChange={(e) => setValues((p) => ({ ...p, lost_report_found_visible_days: e.target.value }))}
                />
                <p className="text-xs text-muted-foreground">After a pet is marked Found, the listing stays publicly visible (with a green "Found" badge) for this many days, then is auto-removed.</p>
              </div>
            </CardContent>
          </Card>

          {/* Change Password */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <Lock className="h-5 w-5 text-primary" />
                Change Password
              </CardTitle>
              <CardDescription>Update your admin account password</CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleChangePassword} className="max-w-md space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="admin-current-password">Current Password</Label>
                  <Input id="admin-current-password" type="password" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} required />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="admin-new-password">New Password</Label>
                  <Input id="admin-new-password" type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} required />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="admin-confirm-password">Confirm New Password</Label>
                  <Input id="admin-confirm-password" type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} required />
                </div>
                <Button type="submit" variant="outline" disabled={changingPassword} className="gap-2">
                  <Lock className="h-4 w-4" />
                  {changingPassword ? "Changing..." : "Change Password"}
                </Button>
              </form>
            </CardContent>
          </Card>
        </div>
      </main>
  );
};

export default AdminSettings;
