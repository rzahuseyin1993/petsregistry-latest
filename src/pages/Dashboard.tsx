import DashboardSidebar from "@/components/DashboardSidebar";
import PetCard from "@/components/PetCard";
import MembershipBadge from "@/components/MembershipBadge";
import { Button } from "@/components/ui/button";
import { PlusCircle, AlertTriangle, FileDown, Pencil } from "lucide-react";
import { Link } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useState } from "react";
import ReportLostDialog from "@/components/ReportLostDialog";
import { generateLostFlyer } from "@/lib/generateLostFlyer";
import CompleteProfilePrompt from "@/components/CompleteProfilePrompt";

const Dashboard = () => {
  const { user, membership } = useAuth();
  const queryClient = useQueryClient();
  const [reportLostPet, setReportLostPet] = useState<{ id: string; name: string } | null>(null);

  const { data: pets = [], isLoading, isError, refetch } = useQuery({
    queryKey: ["my-pets", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data: petsData, error } = await supabase
        .from("pets")
        .select("*, pet_images(image_url, sort_order)")
        .eq("owner_id", user!.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return petsData;
    },
  });

  const handleStatusChange = async (petId: string, newStatus: "registered" | "lost" | "found") => {
    if (newStatus === "lost") {
      const pet = pets.find((p: any) => p.id === petId);
      if (pet) {
        setReportLostPet({ id: petId, name: pet.name });
        return;
      }
    }
    const { error } = await supabase
      .from("pets")
      .update({ status: newStatus })
      .eq("id", petId)
      .eq("owner_id", user!.id);
    if (error) {
      toast.error("Failed to update status");
      return;
    }
    // Keep lost reports in sync: pet is no longer lost, so close any active report
    if (newStatus === "found" || newStatus === "registered") {
      const { error: reportError } = await supabase
        .from("lost_reports")
        .update({ status: newStatus === "found" ? "found" : "closed", updated_at: new Date().toISOString() })
        .eq("pet_id", petId)
        .eq("status", "active");
      if (reportError) {
        toast.error("Pet status updated, but the lost report could not be closed. Please update it on the Lost Reports page.");
      }
    }
    toast.success(`Pet marked as ${newStatus}!`);
    queryClient.invalidateQueries({ queryKey: ["my-pets"] });
    queryClient.invalidateQueries({ queryKey: ["my-lost-reports"] });
  };

  const handleDownloadFlyer = async (pet: any) => {
    try {
      const firstImage = pet.pet_images?.sort((a: any, b: any) => a.sort_order - b.sort_order)[0];
      await generateLostFlyer({
        petName: pet.name,
        species: pet.species,
        breed: pet.breed || "",
        color: pet.color || undefined,
        petId: pet.id,
        imageUrl: firstImage?.image_url,
      });
      toast.success("Flyer downloaded!");
    } catch (err: any) {
      toast.error(err.message || "Failed to generate flyer");
    }
  };

  return (
    <div className="flex min-h-screen">
      <CompleteProfilePrompt />
      <DashboardSidebar />
      <main className="flex-1 bg-background p-6 md:p-8">
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="font-display text-2xl font-bold text-foreground">My Pets</h1>
              {membership && <MembershipBadge planType={membership.planType} planName={membership.planName} badgeIconUrl={membership.badgeIconUrl} size="sm" />}
            </div>
            <p className="text-sm text-muted-foreground">Manage your registered pets</p>
          </div>
          <Link to="/dashboard/register-pet">
            <Button className="gap-2"><PlusCircle className="h-4 w-4" /> Register Pet</Button>
          </Link>
        </div>
        {isLoading ? (
          <div className="mt-12 flex justify-center">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
          </div>
        ) : isError ? (
          <div className="mt-16 text-center">
            <p className="text-lg text-muted-foreground">Could not load your pets. Please check your connection.</p>
            <Button variant="outline" className="mt-4" onClick={() => refetch()}>Try again</Button>
          </div>
        ) : pets.length === 0 ? (
          <div className="mt-16 text-center">
            <p className="text-lg text-muted-foreground">No pets registered yet.</p>
            <Link to="/dashboard/register-pet">
              <Button className="mt-4 gap-2"><PlusCircle className="h-4 w-4" /> Register Your First Pet</Button>
            </Link>
          </div>
        ) : (
          <div className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {pets.map((pet) => {
              const firstImage = pet.pet_images?.sort((a, b) => a.sort_order - b.sort_order)[0];
              return (
                <div key={pet.id} className="space-y-2">
                  <PetCard
                    id={pet.id}
                    name={pet.name}
                    species={pet.species}
                    breed={pet.breed || ""}
                    image={firstImage?.image_url || "/placeholder.svg"}
                    petCode={(pet as any).pet_code}
                    status={pet.status as "registered" | "lost" | "found"}
                    ownerMembership={membership ? { planType: membership.planType, planName: membership.planName, badgeIconUrl: membership.badgeIconUrl } : null}
                    showStatusToggle
                    onStatusChange={handleStatusChange}
                  />
                  <Link to={`/dashboard/pets/${pet.id}/edit`} className="block">
                    <Button variant="outline" size="sm" className="w-full gap-2">
                      <Pencil className="h-3.5 w-3.5" /> Edit Pet
                    </Button>
                  </Link>
                  {pet.status === "lost" && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="w-full gap-2 border-destructive/30 text-destructive"
                      onClick={() => handleDownloadFlyer(pet)}
                    >
                      <FileDown className="h-3.5 w-3.5" /> Download Lost Flyer
                    </Button>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {reportLostPet && (
          <ReportLostDialog
            open={!!reportLostPet}
            onOpenChange={(open) => !open && setReportLostPet(null)}
            petId={reportLostPet.id}
            petName={reportLostPet.name}
            onReported={() => {
              setReportLostPet(null);
              queryClient.invalidateQueries({ queryKey: ["my-pets"] });
            }}
          />
        )}
      </main>
    </div>
  );
};

export default Dashboard;
