import DashboardSidebar from "@/components/DashboardSidebar";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { useEffect, useState } from "react";
import { format, differenceInDays, subDays } from "date-fns";
import {
  Heart, Plus, Weight, Ruler, Thermometer, Syringe, Bell,
  Calendar, FileText, TrendingUp, AlertTriangle, CheckCircle, Trash2,
  CalendarPlus, Inbox, Download
} from "lucide-react";

// Plausible ranges for pet vitals — values outside these are almost certainly typos.
const HEALTH_LIMITS = {
  weightKg: { min: 0.01, max: 500 },
  heightCm: { min: 0.1, max: 300 },
  temperatureC: { min: 20, max: 45 },
};

const todayStr = () => format(new Date(), "yyyy-MM-dd");

const PetHealth = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [selectedPetId, setSelectedPetId] = useState<string>("");
  const [healthDialogOpen, setHealthDialogOpen] = useState(false);
  const [vaccineDialogOpen, setVaccineDialogOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<{ kind: "health" | "vaccine"; id: string; label: string } | null>(null);

  // Health record form
  const [healthForm, setHealthForm] = useState({
    record_date: format(new Date(), "yyyy-MM-dd"),
    weight_kg: "",
    height_cm: "",
    temperature: "",
    notes: "",
  });

  // Vaccine form
  const [vaccineForm, setVaccineForm] = useState({
    vaccine_name: "",
    date_given: format(new Date(), "yyyy-MM-dd"),
    next_due_date: "",
    vet_name: "",
    notes: "",
  });

  const { data: pets = [] } = useQuery({
    queryKey: ["my-pets-health", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("pets")
        .select("id, name, species, breed")
        .eq("owner_id", user!.id)
        .order("name");
      if (error) throw error;
      return data;
    },
  });

  // Auto-select when the user has exactly one pet
  useEffect(() => {
    if (!selectedPetId && pets.length === 1) setSelectedPetId(pets[0].id);
  }, [pets, selectedPetId]);

  const { data: healthRecords = [] } = useQuery({
    queryKey: ["health-records", selectedPetId],
    enabled: !!selectedPetId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("pet_health_records")
        .select("*")
        .eq("pet_id", selectedPetId)
        .order("record_date", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const { data: vaccinations = [] } = useQuery({
    queryKey: ["vaccinations", selectedPetId],
    enabled: !!selectedPetId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("pet_vaccinations")
        .select("*")
        .eq("pet_id", selectedPetId)
        .order("date_given", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const validateHealthForm = (): string | null => {
    if (!healthForm.record_date) return "Please choose a date.";
    if (healthForm.record_date > todayStr()) return "Record date cannot be in the future.";

    const weight = healthForm.weight_kg ? Number(healthForm.weight_kg) : null;
    const height = healthForm.height_cm ? Number(healthForm.height_cm) : null;
    const temp = healthForm.temperature ? Number(healthForm.temperature) : null;

    if (weight === null && height === null && temp === null && !healthForm.notes.trim()) {
      return "Please fill in at least one measurement or a note.";
    }
    if (weight !== null) {
      if (Number.isNaN(weight) || weight <= 0) return "Weight must be a positive number.";
      if (weight < HEALTH_LIMITS.weightKg.min || weight > HEALTH_LIMITS.weightKg.max)
        return `Weight must be between ${HEALTH_LIMITS.weightKg.min} and ${HEALTH_LIMITS.weightKg.max} kg.`;
    }
    if (height !== null) {
      if (Number.isNaN(height) || height <= 0) return "Height must be a positive number.";
      if (height < HEALTH_LIMITS.heightCm.min || height > HEALTH_LIMITS.heightCm.max)
        return `Height must be between ${HEALTH_LIMITS.heightCm.min} and ${HEALTH_LIMITS.heightCm.max} cm.`;
    }
    if (temp !== null) {
      if (Number.isNaN(temp)) return "Temperature must be a number.";
      if (temp < HEALTH_LIMITS.temperatureC.min || temp > HEALTH_LIMITS.temperatureC.max)
        return `Temperature must be between ${HEALTH_LIMITS.temperatureC.min} and ${HEALTH_LIMITS.temperatureC.max} °C.`;
    }
    return null;
  };

  const handleAddHealthRecord = async () => {
    if (!selectedPetId) return;
    const validationError = validateHealthForm();
    if (validationError) { toast.error(validationError); return; }
    const { error } = await supabase.from("pet_health_records").insert({
      pet_id: selectedPetId,
      record_date: healthForm.record_date,
      weight_kg: healthForm.weight_kg ? Number(healthForm.weight_kg) : null,
      height_cm: healthForm.height_cm ? Number(healthForm.height_cm) : null,
      temperature: healthForm.temperature ? Number(healthForm.temperature) : null,
      notes: healthForm.notes || null,
    });
    if (error) { toast.error("Failed to add record"); return; }
    toast.success("Health record added!");
    setHealthDialogOpen(false);
    setHealthForm({ record_date: format(new Date(), "yyyy-MM-dd"), weight_kg: "", height_cm: "", temperature: "", notes: "" });
    queryClient.invalidateQueries({ queryKey: ["health-records", selectedPetId] });

    // Send notification confirming the action
    if (user && selectedPet) {
      supabase.rpc("insert_system_notification", {
        _user_id: user.id,
        _title: `📋 Health Record Added`,
        _message: `A new health record for ${selectedPet.name} has been saved (${format(new Date(healthForm.record_date), "PPP")}).`,
        _type: "health",
        _link: "/dashboard/health",
      }).then(() => {});
    }
  };

  const validateVaccineForm = (): string | null => {
    if (!vaccineForm.vaccine_name.trim() || vaccineForm.vaccine_name.trim().length < 2)
      return "Please enter the vaccine name (at least 2 characters).";
    if (!vaccineForm.date_given) return "Please choose the date the vaccine was given.";
    if (vaccineForm.date_given > todayStr()) return "Date given cannot be in the future.";
    if (vaccineForm.next_due_date && vaccineForm.next_due_date <= vaccineForm.date_given)
      return "Next due date must be after the date given.";
    return null;
  };

  const handleAddVaccination = async () => {
    if (!selectedPetId) return;
    const validationError = validateVaccineForm();
    if (validationError) { toast.error(validationError); return; }
    const { error } = await supabase.from("pet_vaccinations").insert({
      pet_id: selectedPetId,
      vaccine_name: vaccineForm.vaccine_name.trim(),
      date_given: vaccineForm.date_given,
      next_due_date: vaccineForm.next_due_date || null,
      vet_name: vaccineForm.vet_name || null,
      notes: vaccineForm.notes || null,
    });
    if (error) { toast.error("Failed to add vaccination"); return; }
    toast.success("Vaccination recorded!");
    setVaccineDialogOpen(false);
    setVaccineForm({ vaccine_name: "", date_given: format(new Date(), "yyyy-MM-dd"), next_due_date: "", vet_name: "", notes: "" });
    queryClient.invalidateQueries({ queryKey: ["vaccinations", selectedPetId] });

    // Send notification confirming vaccination was recorded
    if (user && selectedPet) {
      supabase.rpc("insert_system_notification", {
        _user_id: user.id,
        _title: `💉 Vaccination Recorded`,
        _message: `${vaccineForm.vaccine_name} vaccination for ${selectedPet.name} has been recorded.${vaccineForm.next_due_date ? ` Next due: ${format(new Date(vaccineForm.next_due_date), "PPP")}.` : ""}`,
        _type: "health",
        _link: "/dashboard/health",
      }).then(() => {});
    }
  };

  const handleConfirmedDelete = async () => {
    if (!confirmDelete) return;
    const table = confirmDelete.kind === "health" ? "pet_health_records" : "pet_vaccinations";
    const queryKey = confirmDelete.kind === "health" ? ["health-records", selectedPetId] : ["vaccinations", selectedPetId];
    const { error } = await supabase.from(table).delete().eq("id", confirmDelete.id);
    if (error) toast.error("Failed to delete");
    else { toast.success("Deleted"); queryClient.invalidateQueries({ queryKey }); }
    setConfirmDelete(null);
  };

  // Generate .ics calendar file for a vaccination reminder
  const handleDownloadCalendar = (vaccine: any, reminderDaysBefore: number = 3) => {
    if (!vaccine.next_due_date || !selectedPet) return;
    const dueDate = new Date(vaccine.next_due_date);
    // Don't create the reminder in the past when the due date is less than N days away
    let reminderDate = subDays(dueDate, reminderDaysBefore);
    if (reminderDate < new Date()) reminderDate = new Date();
    const dtStart = format(reminderDate, "yyyyMMdd");
    const dtEnd = format(reminderDate, "yyyyMMdd");
    const dueDtStr = format(dueDate, "PPP");
    const icsContent = [
      "BEGIN:VCALENDAR",
      "VERSION:2.0",
      "PRODID:-//PetsRegister//Vaccination Reminder//EN",
      "BEGIN:VEVENT",
      `DTSTART;VALUE=DATE:${dtStart}`,
      `DTEND;VALUE=DATE:${dtEnd}`,
      `SUMMARY:💉 ${vaccine.vaccine_name} reminder for ${selectedPet.name}`,
      `DESCRIPTION:Vaccination "${vaccine.vaccine_name}" for ${selectedPet.name} is due on ${dueDtStr}. ${vaccine.vet_name ? `Vet: ${vaccine.vet_name}` : ''}`,
      "BEGIN:VALARM",
      "TRIGGER:-PT0M",
      "ACTION:DISPLAY",
      `DESCRIPTION:Vaccination reminder for ${selectedPet.name}`,
      "END:VALARM",
      "END:VEVENT",
      "END:VCALENDAR",
    ].join("\r\n");

    const blob = new Blob([icsContent], { type: "text/calendar;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${selectedPet.name}-${vaccine.vaccine_name}-reminder.ics`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("Calendar reminder downloaded! Open it to add to your calendar.");
  };

  // Send in-app notification reminder
  const handleSendInboxReminder = async (vaccine: any, reminderDaysBefore: number = 3) => {
    if (!vaccine.next_due_date || !user || !selectedPet) return;
    const dueDtStr = format(new Date(vaccine.next_due_date), "PPP");
    // Send bell notification
    const { error: notifError } = await supabase.rpc("insert_system_notification", {
      _user_id: user.id,
      _title: `💉 Vaccination Reminder: ${vaccine.vaccine_name}`,
      _message: `Your pet ${selectedPet.name}'s ${vaccine.vaccine_name} vaccination is due on ${dueDtStr}. Please schedule an appointment.`,
      _type: "health",
      _link: "/dashboard/health",
    });

    // Also send to member inbox
    const { error: inboxError } = await supabase.from("admin_messages").insert({
      sender_id: user.id,
      recipient_id: user.id,
      subject: `💉 Vaccination Reminder: ${vaccine.vaccine_name}`,
      message: `<p>Hi there,</p><p>This is a reminder that <strong>${selectedPet.name}</strong>'s <strong>${vaccine.vaccine_name}</strong> vaccination is due on <strong>${dueDtStr}</strong>.</p><p>Please schedule an appointment with your vet.${vaccine.vet_name ? ` Previous vet: <strong>${vaccine.vet_name}</strong>.` : ""}</p><p>— PetsRegistry</p>`,
      is_html: true,
    });

    if (notifError && inboxError) {
      toast.error("Failed to send reminder");
    } else if (inboxError) {
      toast.success("Reminder sent to your notifications (inbox delivery failed)");
    } else if (notifError) {
      toast.success("Reminder sent to your inbox (bell notification failed)");
    } else {
      toast.success("Reminder sent to your notifications & inbox!");
    }
  };

  // Upcoming reminders
  const upcomingVaccines = vaccinations.filter((v: any) => {
    if (!v.next_due_date) return false;
    const daysUntil = differenceInDays(new Date(v.next_due_date), new Date());
    return daysUntil >= 0 && daysUntil <= 30;
  });

  const overdueVaccines = vaccinations.filter((v: any) => {
    if (!v.next_due_date) return false;
    return differenceInDays(new Date(v.next_due_date), new Date()) < 0;
  });

  const latestRecord = healthRecords[0];
  const selectedPet = pets.find((p: any) => p.id === selectedPetId);

  return (
    <div className="flex min-h-screen">
      <DashboardSidebar />
      <main className="flex-1 bg-background p-6 md:p-8">
        <div className="mb-6">
          <h1 className="font-display text-2xl font-bold text-foreground flex items-center gap-2">
            <Heart className="h-6 w-6 text-rose-500" /> Pet Health Tracker
          </h1>
          <p className="text-sm text-muted-foreground">Track weight, height, vaccinations & set reminders</p>
        </div>

        {/* Pet Selector */}
        <div className="mb-6 max-w-xs">
          <Label className="text-sm font-medium">Select Pet</Label>
          <Select value={selectedPetId} onValueChange={setSelectedPetId}>
            <SelectTrigger className="mt-1">
              <SelectValue placeholder="Choose a pet..." />
            </SelectTrigger>
            <SelectContent>
              {pets.map((pet: any) => (
                <SelectItem key={pet.id} value={pet.id}>
                  {pet.name} ({pet.species})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {!selectedPetId ? (
          <div className="mt-12 text-center">
            <Heart className="mx-auto h-16 w-16 text-muted-foreground/30" />
            <p className="mt-4 text-lg text-muted-foreground">Select a pet to view health records</p>
          </div>
        ) : (
          <>
            {/* Summary Cards */}
            <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <Card className="border-border">
                <CardContent className="flex items-center gap-3 p-4">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-100 text-blue-600">
                    <Weight className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Latest Weight</p>
                    <p className="font-display text-lg font-bold text-foreground">
                      {latestRecord?.weight_kg ? `${latestRecord.weight_kg} kg` : "—"}
                    </p>
                  </div>
                </CardContent>
              </Card>
              <Card className="border-border">
                <CardContent className="flex items-center gap-3 p-4">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-100 text-emerald-600">
                    <Ruler className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Latest Height</p>
                    <p className="font-display text-lg font-bold text-foreground">
                      {latestRecord?.height_cm ? `${latestRecord.height_cm} cm` : "—"}
                    </p>
                  </div>
                </CardContent>
              </Card>
              <Card className="border-border">
                <CardContent className="flex items-center gap-3 p-4">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-100 text-amber-600">
                    <Syringe className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Vaccinations</p>
                    <p className="font-display text-lg font-bold text-foreground">{vaccinations.length}</p>
                  </div>
                </CardContent>
              </Card>
              <Card className="border-border">
                <CardContent className="flex items-center gap-3 p-4">
                  <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${overdueVaccines.length > 0 ? 'bg-destructive/10 text-destructive' : upcomingVaccines.length > 0 ? 'bg-amber-100 text-amber-600' : 'bg-emerald-100 text-emerald-600'}`}>
                    <Bell className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Reminders</p>
                    <p className="font-display text-lg font-bold text-foreground">
                      {overdueVaccines.length > 0 ? `${overdueVaccines.length} overdue` : upcomingVaccines.length > 0 ? `${upcomingVaccines.length} upcoming` : "All clear"}
                    </p>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Reminders Banner */}
            {(overdueVaccines.length > 0 || upcomingVaccines.length > 0) && (
              <div className="mb-6 space-y-2">
                {overdueVaccines.map((v: any) => (
                  <div key={v.id} className="flex items-center gap-3 rounded-lg border border-destructive/30 bg-destructive/5 p-3">
                    <AlertTriangle className="h-4 w-4 text-destructive" />
                    <span className="text-sm text-foreground">
                      <strong>{v.vaccine_name}</strong> was due on {format(new Date(v.next_due_date), "PPP")} — overdue!
                    </span>
                  </div>
                ))}
                {upcomingVaccines.map((v: any) => (
                  <div key={v.id} className="flex items-center gap-3 rounded-lg border border-amber-300/30 bg-amber-50 p-3">
                    <Bell className="h-4 w-4 text-amber-600" />
                    <span className="text-sm text-foreground">
                      <strong>{v.vaccine_name}</strong> due on {format(new Date(v.next_due_date), "PPP")} — {differenceInDays(new Date(v.next_due_date), new Date())} days left
                    </span>
                  </div>
                ))}
              </div>
            )}

            <Tabs defaultValue="records" className="w-full">
              <TabsList>
                <TabsTrigger value="records" className="gap-2"><TrendingUp className="h-4 w-4" /> Health Records</TabsTrigger>
                <TabsTrigger value="vaccinations" className="gap-2"><Syringe className="h-4 w-4" /> Vaccinations</TabsTrigger>
              </TabsList>

              {/* Health Records Tab */}
              <TabsContent value="records">
                <div className="mb-4 flex items-center justify-between">
                  <h3 className="font-display text-lg font-semibold text-foreground">Weight, Height & Vitals</h3>
                  <Dialog open={healthDialogOpen} onOpenChange={setHealthDialogOpen}>
                    <DialogTrigger asChild>
                      <Button size="sm" className="gap-2"><Plus className="h-4 w-4" /> Add Record</Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>Add Health Record for {selectedPet?.name}</DialogTitle>
                      </DialogHeader>
                      <div className="space-y-4 pt-2">
                        <div>
                          <Label>Date</Label>
                          <Input type="date" max={todayStr()} value={healthForm.record_date} onChange={e => setHealthForm({...healthForm, record_date: e.target.value})} />
                        </div>
                        <div className="grid grid-cols-3 gap-3">
                          <div>
                            <Label>Weight (kg)</Label>
                            <Input type="number" step="0.1" min={HEALTH_LIMITS.weightKg.min} max={HEALTH_LIMITS.weightKg.max} placeholder="e.g. 5.2" value={healthForm.weight_kg} onChange={e => setHealthForm({...healthForm, weight_kg: e.target.value})} />
                            <p className="mt-1 text-[11px] text-muted-foreground">Up to {HEALTH_LIMITS.weightKg.max} kg</p>
                          </div>
                          <div>
                            <Label>Height (cm)</Label>
                            <Input type="number" step="0.1" min={HEALTH_LIMITS.heightCm.min} max={HEALTH_LIMITS.heightCm.max} placeholder="e.g. 35" value={healthForm.height_cm} onChange={e => setHealthForm({...healthForm, height_cm: e.target.value})} />
                            <p className="mt-1 text-[11px] text-muted-foreground">Up to {HEALTH_LIMITS.heightCm.max} cm</p>
                          </div>
                          <div>
                            <Label>Temp (°C)</Label>
                            <Input type="number" step="0.1" min={HEALTH_LIMITS.temperatureC.min} max={HEALTH_LIMITS.temperatureC.max} placeholder="e.g. 38.5" value={healthForm.temperature} onChange={e => setHealthForm({...healthForm, temperature: e.target.value})} />
                            <p className="mt-1 text-[11px] text-muted-foreground">{HEALTH_LIMITS.temperatureC.min}–{HEALTH_LIMITS.temperatureC.max} °C</p>
                          </div>
                        </div>
                        <div>
                          <Label>Notes</Label>
                          <Textarea placeholder="Any observations..." value={healthForm.notes} onChange={e => setHealthForm({...healthForm, notes: e.target.value})} />
                        </div>
                        <Button className="w-full" onClick={handleAddHealthRecord}>Save Record</Button>
                      </div>
                    </DialogContent>
                  </Dialog>
                </div>

                {healthRecords.length === 0 ? (
                  <Card className="border-dashed">
                    <CardContent className="py-12 text-center">
                      <FileText className="mx-auto h-10 w-10 text-muted-foreground/30" />
                      <p className="mt-3 text-muted-foreground">No health records yet. Add your first record!</p>
                    </CardContent>
                  </Card>
                ) : (
                  <div className="space-y-3">
                    {healthRecords.map((record: any) => (
                      <Card key={record.id} className="border-border">
                        <CardContent className="flex items-center justify-between p-4">
                          <div className="flex items-center gap-4">
                            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                              <Calendar className="h-5 w-5 text-primary" />
                            </div>
                            <div>
                              <p className="font-medium text-foreground">{format(new Date(record.record_date), "PPP")}</p>
                              <div className="mt-1 flex flex-wrap gap-3 text-sm text-muted-foreground">
                                {record.weight_kg && <span className="flex items-center gap-1"><Weight className="h-3 w-3" /> {record.weight_kg} kg</span>}
                                {record.height_cm && <span className="flex items-center gap-1"><Ruler className="h-3 w-3" /> {record.height_cm} cm</span>}
                                {record.temperature && <span className="flex items-center gap-1"><Thermometer className="h-3 w-3" /> {record.temperature}°C</span>}
                              </div>
                              {record.notes && <p className="mt-1 text-xs text-muted-foreground">{record.notes}</p>}
                            </div>
                          </div>
                          <Button variant="ghost" size="icon" onClick={() => setConfirmDelete({ kind: "health", id: record.id, label: `health record from ${format(new Date(record.record_date), "PPP")}` })}>
                            <Trash2 className="h-4 w-4 text-muted-foreground" />
                          </Button>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}
              </TabsContent>

              {/* Vaccinations Tab */}
              <TabsContent value="vaccinations">
                <div className="mb-4 flex items-center justify-between">
                  <h3 className="font-display text-lg font-semibold text-foreground">Vaccination Records</h3>
                  <Dialog open={vaccineDialogOpen} onOpenChange={setVaccineDialogOpen}>
                    <DialogTrigger asChild>
                      <Button size="sm" className="gap-2"><Plus className="h-4 w-4" /> Add Vaccination</Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>Add Vaccination for {selectedPet?.name}</DialogTitle>
                      </DialogHeader>
                      <div className="space-y-4 pt-2">
                        <div>
                          <Label>Vaccine Name</Label>
                          <Input placeholder="e.g. Rabies, DHPP, FVRCP" value={vaccineForm.vaccine_name} onChange={e => setVaccineForm({...vaccineForm, vaccine_name: e.target.value})} />
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <Label>Date Given</Label>
                            <Input type="date" max={todayStr()} value={vaccineForm.date_given} onChange={e => setVaccineForm({...vaccineForm, date_given: e.target.value})} />
                          </div>
                          <div>
                            <Label>Next Due Date</Label>
                            <Input type="date" min={vaccineForm.date_given || undefined} value={vaccineForm.next_due_date} onChange={e => setVaccineForm({...vaccineForm, next_due_date: e.target.value})} />
                          </div>
                        </div>
                        <div>
                          <Label>Vet Name</Label>
                          <Input placeholder="Dr. Smith" value={vaccineForm.vet_name} onChange={e => setVaccineForm({...vaccineForm, vet_name: e.target.value})} />
                        </div>
                        <div>
                          <Label>Notes</Label>
                          <Textarea placeholder="Any notes..." value={vaccineForm.notes} onChange={e => setVaccineForm({...vaccineForm, notes: e.target.value})} />
                        </div>
                        <Button className="w-full" onClick={handleAddVaccination}>Save Vaccination</Button>
                      </div>
                    </DialogContent>
                  </Dialog>
                </div>

                {vaccinations.length === 0 ? (
                  <Card className="border-dashed">
                    <CardContent className="py-12 text-center">
                      <Syringe className="mx-auto h-10 w-10 text-muted-foreground/30" />
                      <p className="mt-3 text-muted-foreground">No vaccinations recorded yet.</p>
                    </CardContent>
                  </Card>
                ) : (
                  <div className="space-y-3">
                    {vaccinations.map((v: any) => {
                      const daysUntilDue = v.next_due_date ? differenceInDays(new Date(v.next_due_date), new Date()) : null;
                      const isOverdue = daysUntilDue !== null && daysUntilDue < 0;
                      const isUpcoming = daysUntilDue !== null && daysUntilDue >= 0 && daysUntilDue <= 30;

                      return (
                        <Card key={v.id} className={`border-border ${isOverdue ? 'border-destructive/30' : ''}`}>
                          <CardContent className="flex items-center justify-between p-4">
                            <div className="flex items-center gap-4">
                              <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${isOverdue ? 'bg-destructive/10 text-destructive' : isUpcoming ? 'bg-amber-100 text-amber-600' : 'bg-emerald-100 text-emerald-600'}`}>
                                <Syringe className="h-5 w-5" />
                              </div>
                              <div>
                                <div className="flex items-center gap-2">
                                  <p className="font-medium text-foreground">{v.vaccine_name}</p>
                                  {isOverdue && <Badge variant="destructive" className="text-xs">Overdue</Badge>}
                                  {isUpcoming && <Badge className="bg-amber-100 text-amber-700 text-xs">Due Soon</Badge>}
                                  {!isOverdue && !isUpcoming && v.next_due_date && <Badge className="bg-emerald-100 text-emerald-700 text-xs"><CheckCircle className="mr-1 h-3 w-3" />Up to date</Badge>}
                                </div>
                                <div className="mt-1 flex flex-wrap gap-3 text-sm text-muted-foreground">
                                  <span>Given: {format(new Date(v.date_given), "PP")}</span>
                                  {v.next_due_date && <span>Next: {format(new Date(v.next_due_date), "PP")}</span>}
                                  {v.vet_name && <span>Vet: {v.vet_name}</span>}
                              </div>
                              {v.notes && <p className="mt-1 text-xs text-muted-foreground">{v.notes}</p>}
                            </div>
                          </div>
                          <div className="flex items-center gap-1">
                            {v.next_due_date && (
                              <Popover>
                                <PopoverTrigger asChild>
                                  <Button variant="outline" size="sm" className="gap-1.5 text-xs">
                                    <Bell className="h-3.5 w-3.5" /> Remind
                                  </Button>
                                </PopoverTrigger>
                                <PopoverContent className="w-56 p-3" align="end">
                                  <p className="mb-2 text-sm font-medium text-foreground">Set Reminder</p>
                                  <div className="space-y-2">
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      className="w-full justify-start gap-2 text-sm"
                                      onClick={() => handleSendInboxReminder(v)}
                                    >
                                      <Inbox className="h-4 w-4" /> Send to Inbox
                                    </Button>
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      className="w-full justify-start gap-2 text-sm"
                                      onClick={() => handleDownloadCalendar(v)}
                                    >
                                      <CalendarPlus className="h-4 w-4" /> Add to Calendar (.ics)
                                    </Button>
                                  </div>
                                </PopoverContent>
                              </Popover>
                            )}
                            <Button variant="ghost" size="icon" onClick={() => setConfirmDelete({ kind: "vaccine", id: v.id, label: `vaccination "${v.vaccine_name}"` })}>
                              <Trash2 className="h-4 w-4 text-muted-foreground" />
                            </Button>
                          </div>
                          </CardContent>
                        </Card>
                      );
                    })}
                  </div>
                )}
              </TabsContent>
            </Tabs>
          </>
        )}

        <AlertDialog open={!!confirmDelete} onOpenChange={(open) => { if (!open) setConfirmDelete(null); }}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete this record?</AlertDialogTitle>
              <AlertDialogDescription>
                {confirmDelete ? `The ${confirmDelete.label} will be permanently deleted. This action cannot be undone.` : ""}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                onClick={handleConfirmedDelete}
              >
                Delete
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </main>
    </div>
  );
};

export default PetHealth;
