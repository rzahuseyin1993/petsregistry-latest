import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { MapPin, Loader2, AlertTriangle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { reverseGeocode, formatCoords } from "@/lib/geo";
import { toast } from "sonner";

interface ReportLostDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  petId: string;
  petName: string;
  onReported: () => void;
}

const ReportLostDialog = ({ open, onOpenChange, petId, petName, onReported }: ReportLostDialogProps) => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [locating, setLocating] = useState(false);
  const [form, setForm] = useState({
    last_seen_address: "",
    last_seen_lat: null as number | null,
    last_seen_lng: null as number | null,
    description: "",
    reward: "",
    contact_phone: "",
  });

  const handleGetLocation = () => {
    if (!navigator.geolocation) {
      toast.error("Geolocation not supported by your browser");
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const lat = pos.coords.latitude;
        const lng = pos.coords.longitude;
        setForm((f) => ({
          ...f,
          last_seen_lat: lat,
          last_seen_lng: lng,
          last_seen_address: f.last_seen_address || formatCoords(lat, lng),
        }));
        setLocating(false);
        toast.success("Location captured!");
        // Upgrade placeholder coords to real address
        const address = await reverseGeocode(lat, lng);
        if (address) {
          setForm((f) => ({
            ...f,
            last_seen_address:
              !f.last_seen_address || f.last_seen_address === formatCoords(lat, lng)
                ? address
                : f.last_seen_address,
          }));
        }
      },
      () => {
        setLocating(false);
        toast.error("Could not get your location");
      }
    );
  };

  const handleSubmit = async () => {
    if (!user) return;
    setLoading(true);
    try {
      // Create lost report
      const { error: reportError } = await supabase.from("lost_reports").insert({
        pet_id: petId,
        reporter_id: user.id,
        last_seen_lat: form.last_seen_lat,
        last_seen_lng: form.last_seen_lng,
        last_seen_address: form.last_seen_address || null,
        description: form.description || null,
        reward: form.reward || null,
        contact_phone: form.contact_phone || null,
      });
      if (reportError) throw reportError;

      // Update pet status to lost
      const { error: petError } = await supabase.from("pets").update({ status: "lost" }).eq("id", petId);
      if (petError) throw petError;

      // Create notifications for all registered users (nearby alert)
      const { data: allProfiles } = await supabase
        .from("profiles")
        .select("user_id")
        .neq("user_id", user.id);

      if (allProfiles && allProfiles.length > 0) {
        for (const p of allProfiles) {
          await supabase.rpc("insert_system_notification", {
            _user_id: p.user_id,
            _title: "🚨 Lost Pet Alert",
            _message: `${petName} has been reported lost${form.last_seen_address ? ` near ${form.last_seen_address}` : ""}. Please keep an eye out!`,
            _type: "lost_pet",
            _link: `/pet/${petId}`,
            _metadata: { pet_id: petId, lat: form.last_seen_lat, lng: form.last_seen_lng },
          });
        }
      }

      toast.success("Lost report created! All members have been notified.");
      onReported();
      onOpenChange(false);
    } catch (err: any) {
      toast.error(err.message || "Failed to create report");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-destructive">
            <AlertTriangle className="h-5 w-5" /> Report {petName} as Lost
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4 pt-2">
          <div>
            <Label>Last Seen Location</Label>
            <div className="mt-1 flex gap-2">
              <Input
                placeholder="e.g. Orchard Road, Singapore"
                value={form.last_seen_address}
                onChange={(e) => setForm({ ...form, last_seen_address: e.target.value })}
                className="flex-1"
              />
              <Button type="button" variant="outline" size="icon" onClick={handleGetLocation} disabled={locating}>
                {locating ? <Loader2 className="h-4 w-4 animate-spin" /> : <MapPin className="h-4 w-4" />}
              </Button>
            </div>
            {form.last_seen_lat && (
              <p className="mt-1 text-xs text-muted-foreground">
                📍 {form.last_seen_lat.toFixed(4)}, {form.last_seen_lng?.toFixed(4)}
              </p>
            )}
          </div>
          <div>
            <Label>Description</Label>
            <Textarea
              placeholder="What happened? Any distinguishing features, collar color, etc."
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Reward (optional)</Label>
              <Input placeholder="e.g. $50" value={form.reward} onChange={(e) => setForm({ ...form, reward: e.target.value })} />
            </div>
            <div>
              <Label>Contact Phone</Label>
              <Input placeholder="Your phone number" value={form.contact_phone} onChange={(e) => setForm({ ...form, contact_phone: e.target.value })} />
            </div>
          </div>
          <Button className="w-full gap-2" onClick={handleSubmit} disabled={loading}>
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <AlertTriangle className="h-4 w-4" />}
            Report Lost & Alert All Members
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default ReportLostDialog;
