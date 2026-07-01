import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Upload } from "lucide-react";
import { Button } from "@/components/ui/button";

export type PetBirthFormValues = {
  dateOfBirth: string;
  sex: string;
  birthLocation: string;
  birthWeight: string;
  birthHeight: string;
  eyeColor: string;
  breederName: string;
  sirePetId: string;
  damPetId: string;
  sireName: string;
  damName: string;
};

type PetOption = { id: string; name: string; pet_code?: string | null };

type Props = {
  values: PetBirthFormValues;
  onChange: (patch: Partial<PetBirthFormValues>) => void;
  myPets?: PetOption[];
  sirePhotoPreview?: string | null;
  damPhotoPreview?: string | null;
  onSirePhoto?: (file: File) => void;
  onDamPhoto?: (file: File) => void;
  compact?: boolean;
};

export const emptyBirthForm: PetBirthFormValues = {
  dateOfBirth: "",
  sex: "",
  birthLocation: "",
  birthWeight: "",
  birthHeight: "",
  eyeColor: "",
  breederName: "",
  sirePetId: "",
  damPetId: "",
  sireName: "",
  damName: "",
};

export default function PetBirthFields({
  values,
  onChange,
  myPets = [],
  sirePhotoPreview,
  damPhotoPreview,
  onSirePhoto,
  onDamPhoto,
  compact,
}: Props) {
  const content = (
    <div className={`grid gap-4 ${compact ? "grid-cols-1 sm:grid-cols-2" : "grid-cols-1 md:grid-cols-2"}`}>
      <div>
        <Label>Date of birth *</Label>
        <Input type="date" value={values.dateOfBirth} onChange={(e) => onChange({ dateOfBirth: e.target.value })} />
      </div>
      <div>
        <Label>Sex</Label>
        <Select value={values.sex || "none"} onValueChange={(v) => onChange({ sex: v === "none" ? "" : v })}>
          <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="none">—</SelectItem>
            <SelectItem value="Male">Male</SelectItem>
            <SelectItem value="Female">Female</SelectItem>
            <SelectItem value="Unknown">Unknown</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div>
        <Label>Place of birth</Label>
        <Input value={values.birthLocation} onChange={(e) => onChange({ birthLocation: e.target.value })} placeholder="Kennel, city, country" />
      </div>
      <div>
        <Label>Weight at birth</Label>
        <Input value={values.birthWeight} onChange={(e) => onChange({ birthWeight: e.target.value })} placeholder="e.g. 2.5 lbs" />
      </div>
      <div>
        <Label>Height at birth</Label>
        <Input value={values.birthHeight} onChange={(e) => onChange({ birthHeight: e.target.value })} placeholder="e.g. 6 inches" />
      </div>
      <div>
        <Label>Eye color</Label>
        <Input value={values.eyeColor} onChange={(e) => onChange({ eyeColor: e.target.value })} />
      </div>
      <div className="md:col-span-2">
        <Label>Breeder / kennel name</Label>
        <Input value={values.breederName} onChange={(e) => onChange({ breederName: e.target.value })} />
      </div>
      <div>
        <Label>Sire (father) — registered pet</Label>
        <Select value={values.sirePetId || "none"} onValueChange={(v) => onChange({ sirePetId: v === "none" ? "" : v })}>
          <SelectTrigger><SelectValue placeholder="Optional link" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="none">Not in registry</SelectItem>
            {myPets.map((p) => (
              <SelectItem key={p.id} value={p.id}>{p.name} {p.pet_code ? `(${p.pet_code})` : ""}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div>
        <Label>Sire name (if not registered)</Label>
        <Input value={values.sireName} onChange={(e) => onChange({ sireName: e.target.value })} disabled={!!values.sirePetId} />
      </div>
      <div>
        <Label>Dam (mother) — registered pet</Label>
        <Select value={values.damPetId || "none"} onValueChange={(v) => onChange({ damPetId: v === "none" ? "" : v })}>
          <SelectTrigger><SelectValue placeholder="Optional link" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="none">Not in registry</SelectItem>
            {myPets.map((p) => (
              <SelectItem key={p.id} value={p.id}>{p.name} {p.pet_code ? `(${p.pet_code})` : ""}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div>
        <Label>Dam name (if not registered)</Label>
        <Input value={values.damName} onChange={(e) => onChange({ damName: e.target.value })} disabled={!!values.damPetId} />
      </div>
      {(onSirePhoto || onDamPhoto) && (
        <>
          <div>
            <Label>Sire photo (optional)</Label>
            {sirePhotoPreview && <img src={sirePhotoPreview} alt="Sire" className="h-16 w-16 rounded object-cover mb-2 border" />}
            {onSirePhoto && (
              <Button type="button" variant="outline" size="sm" className="gap-2" asChild>
                <label className="cursor-pointer">
                  <Upload className="h-4 w-4" /> Upload
                  <input type="file" accept="image/*" className="hidden" onChange={(e) => e.target.files?.[0] && onSirePhoto(e.target.files[0])} />
                </label>
              </Button>
            )}
          </div>
          <div>
            <Label>Dam photo (optional)</Label>
            {damPhotoPreview && <img src={damPhotoPreview} alt="Dam" className="h-16 w-16 rounded object-cover mb-2 border" />}
            {onDamPhoto && (
              <Button type="button" variant="outline" size="sm" className="gap-2" asChild>
                <label className="cursor-pointer">
                  <Upload className="h-4 w-4" /> Upload
                  <input type="file" accept="image/*" className="hidden" onChange={(e) => e.target.files?.[0] && onDamPhoto(e.target.files[0])} />
                </label>
              </Button>
            )}
          </div>
        </>
      )}
    </div>
  );

  if (compact) return content;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Birth &amp; breeding details</CardTitle>
      </CardHeader>
      <CardContent>{content}</CardContent>
    </Card>
  );
}

export function birthFormToPetPayload(values: PetBirthFormValues, extras?: {
  sire_photo_url?: string | null;
  dam_photo_url?: string | null;
}) {
  const base: Record<string, unknown> = {
    date_of_birth: values.dateOfBirth || null,
    sex: values.sex || null,
    birth_location: values.birthLocation || null,
    birth_weight: values.birthWeight || null,
    birth_height: values.birthHeight || null,
    eye_color: values.eyeColor || null,
    breeder_name: values.breederName || null,
    sire_pet_id: values.sirePetId || null,
    dam_pet_id: values.damPetId || null,
    sire_name: values.sirePetId ? null : (values.sireName || null),
    dam_name: values.damPetId ? null : (values.damName || null),
  };
  if (extras?.sire_photo_url !== undefined) base.sire_photo_url = extras.sire_photo_url;
  if (extras?.dam_photo_url !== undefined) base.dam_photo_url = extras.dam_photo_url;
  return base;
}

export function petToBirthForm(pet: any): PetBirthFormValues {
  return {
    dateOfBirth: pet?.date_of_birth?.slice?.(0, 10) || pet?.date_of_birth || "",
    sex: pet?.sex || "",
    birthLocation: pet?.birth_location || "",
    birthWeight: pet?.birth_weight || "",
    birthHeight: pet?.birth_height || "",
    eyeColor: pet?.eye_color || "",
    breederName: pet?.breeder_name || "",
    sirePetId: pet?.sire_pet_id || "",
    damPetId: pet?.dam_pet_id || "",
    sireName: pet?.sire_name || "",
    damName: pet?.dam_name || "",
  };
}
