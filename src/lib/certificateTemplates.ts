export interface CertificateTemplate {
  id: string;
  name: string;
  description: string;
  bgColor: string;
  borderColor: string;
  accentColor: string;
  textColor: string;
  headerColor: string;
  fontFamily: string;
  style: "classic" | "modern" | "elegant" | "playful" | "minimal" | "bold" | "nature" | "luxury" | "retro" | "official";
}

export const certificateTemplates: CertificateTemplate[] = [
  // ★ Recommended — premium official layout
  {
    id: "pets-registry-official",
    name: "Pets Registry Official",
    description: "★ Recommended — white & gold premium certificate with company logo",
    bgColor: "#FFFFFF",
    borderColor: "#B8860B",
    accentColor: "#8B6914",
    textColor: "#2C2416",
    headerColor: "#1A1408",
    fontFamily: "'Georgia', 'Times New Roman', serif",
    style: "luxury",
  },
  // 1 — Classic Cream
  {
    id: "classic-cream",
    name: "Classic Cream",
    description: "Traditional ivory with gold accents — timeless elegance",
    bgColor: "#FFFDF7",
    borderColor: "#C9B88C",
    accentColor: "#8B7355",
    textColor: "#2D2A26",
    headerColor: "#2D2A26",
    fontFamily: "'Georgia', serif",
    style: "classic",
  },
  // 2 — Royal Navy
  {
    id: "royal-navy",
    name: "Royal Navy",
    description: "Deep navy with gold trim — distinguished and formal",
    bgColor: "#0F1729",
    borderColor: "#D4AF37",
    accentColor: "#D4AF37",
    textColor: "#F0E6D0",
    headerColor: "#D4AF37",
    fontFamily: "'Georgia', serif",
    style: "luxury",
  },
  // 3 — Emerald Forest
  {
    id: "emerald-forest",
    name: "Emerald Forest",
    description: "Rich green tones with gold details — nature inspired",
    bgColor: "#0D3B2E",
    borderColor: "#B8860B",
    accentColor: "#B8860B",
    textColor: "#E8DCC8",
    headerColor: "#E8DCC8",
    fontFamily: "'Palatino', serif",
    style: "nature",
  },
  // 4 — Modern White
  {
    id: "modern-white",
    name: "Modern White",
    description: "Clean white with teal accents — contemporary design",
    bgColor: "#FFFFFF",
    borderColor: "#0D9488",
    accentColor: "#0D9488",
    textColor: "#1F2937",
    headerColor: "#0D9488",
    fontFamily: "'Helvetica Neue', Arial, sans-serif",
    style: "modern",
  },
  // 5 — Burgundy Elegance
  {
    id: "burgundy-elegance",
    name: "Burgundy Elegance",
    description: "Deep burgundy with cream text — sophisticated warmth",
    bgColor: "#4A0E2B",
    borderColor: "#D4A574",
    accentColor: "#D4A574",
    textColor: "#F5E6D3",
    headerColor: "#F5E6D3",
    fontFamily: "'Georgia', serif",
    style: "elegant",
  },
  // 6 — Paw Print Blue
  {
    id: "paw-blue",
    name: "Paw Print Blue",
    description: "Friendly sky blue with paw-inspired design — playful and light",
    bgColor: "#EFF6FF",
    borderColor: "#3B82F6",
    accentColor: "#2563EB",
    textColor: "#1E3A5F",
    headerColor: "#1E40AF",
    fontFamily: "'Trebuchet MS', sans-serif",
    style: "playful",
  },
  // 7 — Vintage Sepia
  {
    id: "vintage-sepia",
    name: "Vintage Sepia",
    description: "Warm sepia tones — nostalgic and classic feel",
    bgColor: "#F5ECD7",
    borderColor: "#8B6914",
    accentColor: "#6B4E1C",
    textColor: "#3D2E12",
    headerColor: "#3D2E12",
    fontFamily: "'Georgia', serif",
    style: "retro",
  },
  // 8 — Slate Official
  {
    id: "slate-official",
    name: "Slate Official",
    description: "Government-style document with slate gray — serious and official",
    bgColor: "#F8FAFC",
    borderColor: "#475569",
    accentColor: "#334155",
    textColor: "#1E293B",
    headerColor: "#0F172A",
    fontFamily: "'Courier New', monospace",
    style: "official",
  },
  // 9 — Rose Gold
  {
    id: "rose-gold",
    name: "Rose Gold",
    description: "Soft pink with rose gold accents — delicate and premium",
    bgColor: "#FFF5F5",
    borderColor: "#B76E79",
    accentColor: "#B76E79",
    textColor: "#4A2C2A",
    headerColor: "#8B4049",
    fontFamily: "'Palatino', serif",
    style: "elegant",
  },
  // 10 — Midnight Purple
  {
    id: "midnight-purple",
    name: "Midnight Purple",
    description: "Deep purple with silver accents — mysterious and regal",
    bgColor: "#1A0A2E",
    borderColor: "#C0C0C0",
    accentColor: "#9F7AEA",
    textColor: "#E2D6F5",
    headerColor: "#C0C0C0",
    fontFamily: "'Georgia', serif",
    style: "luxury",
  },
  // 11 — Sunset Orange
  {
    id: "sunset-orange",
    name: "Sunset Orange",
    description: "Warm sunset tones — energetic and cheerful",
    bgColor: "#FFF7ED",
    borderColor: "#EA580C",
    accentColor: "#C2410C",
    textColor: "#431407",
    headerColor: "#9A3412",
    fontFamily: "'Trebuchet MS', sans-serif",
    style: "playful",
  },
  // 12 — Arctic Mint
  {
    id: "arctic-mint",
    name: "Arctic Mint",
    description: "Cool mint green with clean lines — fresh and calming",
    bgColor: "#F0FDF4",
    borderColor: "#16A34A",
    accentColor: "#15803D",
    textColor: "#14532D",
    headerColor: "#166534",
    fontFamily: "'Helvetica Neue', Arial, sans-serif",
    style: "modern",
  },
  // 13 — Charcoal Minimal
  {
    id: "charcoal-minimal",
    name: "Charcoal Minimal",
    description: "Dark charcoal with minimal design — sleek and professional",
    bgColor: "#1F2937",
    borderColor: "#6B7280",
    accentColor: "#9CA3AF",
    textColor: "#E5E7EB",
    headerColor: "#F9FAFB",
    fontFamily: "'Helvetica Neue', Arial, sans-serif",
    style: "minimal",
  },
  // 14 — Ocean Blue
  {
    id: "ocean-blue",
    name: "Ocean Blue",
    description: "Deep ocean blue gradients — calm and trustworthy",
    bgColor: "#0C1B33",
    borderColor: "#38BDF8",
    accentColor: "#0EA5E9",
    textColor: "#BAE6FD",
    headerColor: "#E0F2FE",
    fontFamily: "'Verdana', sans-serif",
    style: "bold",
  },
  // 15 — Honey Gold
  {
    id: "honey-gold",
    name: "Honey Gold",
    description: "Warm honey tones with golden borders — rich and inviting",
    bgColor: "#FFFBEB",
    borderColor: "#B45309",
    accentColor: "#92400E",
    textColor: "#451A03",
    headerColor: "#78350F",
    fontFamily: "'Palatino', serif",
    style: "classic",
  },
  // 16 — Coral Reef
  {
    id: "coral-reef",
    name: "Coral Reef",
    description: "Vibrant coral and teal — lively and tropical",
    bgColor: "#FFF1F2",
    borderColor: "#FB7185",
    accentColor: "#E11D48",
    textColor: "#881337",
    headerColor: "#9F1239",
    fontFamily: "'Trebuchet MS', sans-serif",
    style: "playful",
  },
  // 17 — Mahogany Classic
  {
    id: "mahogany-classic",
    name: "Mahogany Classic",
    description: "Rich mahogany brown with cream — distinguished wooden feel",
    bgColor: "#FAF5EF",
    borderColor: "#6B3A2A",
    accentColor: "#8B4513",
    textColor: "#3C1E0F",
    headerColor: "#3C1E0F",
    fontFamily: "'Georgia', serif",
    style: "classic",
  },
  // 18 — Nordic Frost
  {
    id: "nordic-frost",
    name: "Nordic Frost",
    description: "Cool icy blue with silver — minimalist Scandinavian",
    bgColor: "#F0F9FF",
    borderColor: "#94A3B8",
    accentColor: "#64748B",
    textColor: "#334155",
    headerColor: "#1E293B",
    fontFamily: "'Helvetica Neue', Arial, sans-serif",
    style: "minimal",
  },
  // 19 — Cherry Blossom
  {
    id: "cherry-blossom",
    name: "Cherry Blossom",
    description: "Soft pink sakura-inspired — gentle and beautiful",
    bgColor: "#FDF2F8",
    borderColor: "#EC4899",
    accentColor: "#DB2777",
    textColor: "#831843",
    headerColor: "#9D174D",
    fontFamily: "'Palatino', serif",
    style: "elegant",
  },
  // 20 — Stealth Black
  {
    id: "stealth-black",
    name: "Stealth Black",
    description: "All black with white and gold details — ultra premium",
    bgColor: "#0A0A0A",
    borderColor: "#D4AF37",
    accentColor: "#D4AF37",
    textColor: "#E5E5E5",
    headerColor: "#FFFFFF",
    fontFamily: "'Georgia', serif",
    style: "luxury",
  },
];
