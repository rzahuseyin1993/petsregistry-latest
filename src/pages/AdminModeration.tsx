import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ShieldAlert, CheckCircle2, XCircle, RefreshCw, Loader2, ImageIcon } from "lucide-react";
import { toast } from "sonner";
import { useState } from "react";

const SEVERITY_COLOR: Record<string, string> = {
  high: "bg-destructive text-destructive-foreground",
  medium: "bg-accent text-accent-foreground",
  low: "bg-secondary text-secondary-foreground",
};

const ENTITY_LABEL: Record<string, string> = {
  profile: "User Profile",
  pet: "Pet",
  business_listing: "Business Listing",
  lost_report: "Lost Pet Report",
  contact_submission: "Contact Form",
  admin_message: "User Message",
};

const PHOTO_FLAG_LABEL: Record<string, string> = {
  ai_generated: "AI-generated photo",
  not_a_real_pet: "Not a real pet photo",
  species_mismatch: "Species mismatch",
  breed_mismatch: "Breed mismatch",
  color_mismatch: "Color mismatch",
  stock_photo: "Stock photo",
  inappropriate: "Inappropriate image",
  no_pet_visible: "No pet visible",
};

function getInspectedImages(flag: any): string[] {
  const fromDetails = flag?.details?.inspected_images;
  if (Array.isArray(fromDetails) && fromDetails.length) {
    return fromDetails.filter((u: unknown) => typeof u === "string");
  }
  const payload = flag?.details?.payload || {};
  const urls: string[] = [];
  if (Array.isArray(payload.image_urls)) urls.push(...payload.image_urls);
  if (typeof payload.guest_pet_photo_url === "string") urls.push(payload.guest_pet_photo_url);
  if (typeof payload.logo_url === "string") urls.push(payload.logo_url);
  if (typeof payload.new_image_url === "string") urls.push(payload.new_image_url);
  return [...new Set(urls.filter((u) => /^https?:\/\//i.test(u)))].slice(0, 3);
}

function getPhotoFlags(flag: any): string[] {
  if (Array.isArray(flag?.details?.photo_flags)) return flag.details.photo_flags;
  if (Array.isArray(flag?.details?.verdict?.photo_flags)) return flag.details.verdict.photo_flags;
  return [];
}

const AdminModeration = () => {
  const qc = useQueryClient();
  const [scanning, setScanning] = useState(false);

  const { data: flags = [], isLoading } = useQuery({
    queryKey: ["moderation-flags"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("moderation_flags" as any)
        .select("*")
        .order("created_at", { ascending: false })
        .limit(200);
      if (error) throw error;
      return data || [];
    },
  });

  const { data: queueStats } = useQuery({
    queryKey: ["moderation-queue-stats"],
    queryFn: async () => {
      const { count: pending } = await supabase
        .from("moderation_queue" as any)
        .select("*", { count: "exact", head: true })
        .eq("status", "pending");
      return { pending: pending || 0 };
    },
    refetchInterval: 10000,
  });

  const updateFlag = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const { error } = await supabase.from("moderation_flags" as any).update({
        status,
        resolved_at: new Date().toISOString(),
      }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["moderation-flags"] });
      toast.success("Updated");
    },
  });

  const pauseEntity = useMutation({
    mutationFn: async (flag: any) => {
      const map: Record<string, { table: string; col: string; value: any }> = {
        profile: { table: "profiles", col: "is_paused", value: true },
        pet: { table: "pets", col: "is_paused", value: true },
        business_listing: { table: "business_listings", col: "is_active", value: false },
        lost_report: { table: "lost_reports", col: "is_paused", value: true },
        admin_message: { table: "admin_messages", col: "is_paused", value: true },
      };
      const m = map[flag.entity_type];
      if (!m) throw new Error("Cannot pause this entity type");
      const { error } = await supabase.from(m.table as any).update({ [m.col]: m.value }).eq("id", flag.entity_id);
      if (error) throw error;
      await supabase.from("moderation_flags" as any).update({ status: "resolved", auto_paused: true }).eq("id", flag.id);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["moderation-flags"] });
      toast.success("Item paused and flag resolved");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const runScan = async () => {
    setScanning(true);
    try {
      const { data, error } = await supabase.functions.invoke("ai-moderation", { body: { trigger: "manual" } });
      if (error) throw error;
      toast.success(`Scanned ${data.processed} items — ${data.flagged} flagged, ${data.paused} auto-paused`);
      qc.invalidateQueries({ queryKey: ["moderation-flags"] });
      qc.invalidateQueries({ queryKey: ["moderation-queue-stats"] });
    } catch (e: any) {
      toast.error(e.message || "Scan failed");
    } finally {
      setScanning(false);
    }
  };

  const open = flags.filter((f: any) => f.status === "open" || f.status === "auto_paused");
  const resolved = flags.filter((f: any) => f.status === "resolved" || f.status === "dismissed");
  const photoOpen = open.filter((f: any) => getPhotoFlags(f).length > 0 || f.details?.has_photo_issue);

  return (
    <main className="flex-1 overflow-auto p-6">
      <div className="space-y-6">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="font-display text-2xl font-bold text-foreground flex items-center gap-2">
              <ShieldAlert className="h-6 w-6 text-destructive" />
              AI Moderation
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              AI scans new signups, pets, photos, listings, lost reports and messages for fake/spam content.
              {queueStats && queueStats.pending > 0 && (
                <span className="ml-2 text-accent-foreground font-medium">{queueStats.pending} item(s) in queue</span>
              )}
            </p>
          </div>
          <Button onClick={runScan} disabled={scanning} className="gap-2">
            {scanning ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
            Run scan now
          </Button>
        </div>

        <div className="grid gap-4 sm:grid-cols-4">
          <Card>
            <CardContent className="pt-6">
              <div className="text-3xl font-bold">{open.length}</div>
              <div className="text-sm text-muted-foreground">Open flags</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="text-3xl font-bold text-destructive">
                {open.filter((f: any) => f.severity === "high").length}
              </div>
              <div className="text-sm text-muted-foreground">High severity</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="text-3xl font-bold text-amber-600 flex items-center gap-2">
                <ImageIcon className="h-6 w-6" />
                {photoOpen.length}
              </div>
              <div className="text-sm text-muted-foreground">Photo issues</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="text-3xl font-bold text-primary">{resolved.length}</div>
              <div className="text-sm text-muted-foreground">Resolved</div>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader><CardTitle>Open flags ({open.length})</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {isLoading && <p className="text-sm text-muted-foreground">Loading…</p>}
            {!isLoading && open.length === 0 && (
              <p className="text-sm text-muted-foreground">No open flags. The system is clean ✨</p>
            )}
            {open.map((f: any) => {
              const photoFlags = getPhotoFlags(f);
              const images = getInspectedImages(f);
              return (
                <div key={f.id} className="rounded-lg border p-4 space-y-2">
                  <div className="flex items-start justify-between flex-wrap gap-2">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Badge className={SEVERITY_COLOR[f.severity] || ""}>{f.severity.toUpperCase()}</Badge>
                      <Badge variant="outline">{ENTITY_LABEL[f.entity_type] || f.entity_type}</Badge>
                      {f.auto_paused && <Badge variant="destructive">Auto-paused</Badge>}
                      {photoFlags.length > 0 && (
                        <Badge variant="secondary" className="gap-1">
                          <ImageIcon className="h-3 w-3" /> Photo issue
                        </Badge>
                      )}
                      <span className="text-xs text-muted-foreground">
                        {Math.round((f.confidence || 0) * 100)}% confidence
                      </span>
                    </div>
                    <span className="text-xs text-muted-foreground">
                      {new Date(f.created_at).toLocaleString()}
                    </span>
                  </div>
                  <p className="text-sm font-medium">{f.reason}</p>
                  {photoFlags.length > 0 && (
                    <div className="flex flex-wrap gap-1.5">
                      {photoFlags.map((flag: string) => (
                        <Badge key={flag} variant="outline" className="text-xs">
                          {PHOTO_FLAG_LABEL[flag] || flag}
                        </Badge>
                      ))}
                    </div>
                  )}
                  {images.length > 0 && (
                    <div className="flex flex-wrap gap-2 pt-1">
                      {images.map((url) => (
                        <a key={url} href={url} target="_blank" rel="noreferrer" className="block">
                          <img
                            src={url}
                            alt="Flagged submission"
                            className="h-20 w-20 rounded-md object-cover border border-border bg-muted"
                          />
                        </a>
                      ))}
                    </div>
                  )}
                  {f.details?.payload && (
                    <details className="text-xs text-muted-foreground">
                      <summary className="cursor-pointer">View content</summary>
                      <pre className="mt-2 p-2 bg-muted rounded overflow-x-auto whitespace-pre-wrap break-words">
                        {JSON.stringify(f.details.payload, null, 2)}
                      </pre>
                    </details>
                  )}
                  <div className="flex gap-2 flex-wrap pt-2">
                    {!f.auto_paused && (
                      <Button size="sm" variant="destructive" onClick={() => pauseEntity.mutate(f)} className="gap-1">
                        <ShieldAlert className="h-3 w-3" /> Pause this item
                      </Button>
                    )}
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => updateFlag.mutate({ id: f.id, status: "resolved" })}
                      className="gap-1"
                    >
                      <CheckCircle2 className="h-3 w-3" /> Mark resolved
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => updateFlag.mutate({ id: f.id, status: "dismissed" })}
                      className="gap-1"
                    >
                      <XCircle className="h-3 w-3" /> Dismiss (false positive)
                    </Button>
                  </div>
                </div>
              );
            })}
          </CardContent>
        </Card>

        {resolved.length > 0 && (
          <Card>
            <CardHeader><CardTitle className="text-base">Recently resolved</CardTitle></CardHeader>
            <CardContent className="space-y-2">
              {resolved.slice(0, 20).map((f: any) => (
                <div key={f.id} className="text-sm flex items-center justify-between p-2 rounded border">
                  <span>
                    <Badge variant="outline" className="mr-2">{ENTITY_LABEL[f.entity_type]}</Badge>
                    {getPhotoFlags(f).length > 0 && (
                      <Badge variant="secondary" className="mr-2 gap-1">
                        <ImageIcon className="h-3 w-3" /> Photo
                      </Badge>
                    )}
                    {f.reason}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {new Date(f.created_at).toLocaleDateString()}
                  </span>
                </div>
              ))}
            </CardContent>
          </Card>
        )}
      </div>
    </main>
  );
};

export default AdminModeration;
