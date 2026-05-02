import { Shield, Crown, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";

interface MembershipBadgeProps {
  planType: "guardian" | "partner" | string;
  planName?: string;
  badgeIconUrl?: string | null;
  size?: "sm" | "md" | "lg";
  showLabel?: boolean;
  className?: string;
}

const MembershipBadge = ({ planType, planName, badgeIconUrl, size = "md", showLabel = true, className }: MembershipBadgeProps) => {
  const isPartner = planType === "partner";

  const sizeClasses = {
    sm: "px-2 py-0.5 text-[10px] gap-1",
    md: "px-2.5 py-1 text-xs gap-1.5",
    lg: "px-3 py-1.5 text-sm gap-2",
  };

  const iconSizes = {
    sm: "h-3 w-3",
    md: "h-3.5 w-3.5",
    lg: "h-4 w-4",
  };

  const imgSizes = {
    sm: "h-3.5 w-3.5",
    md: "h-4 w-4",
    lg: "h-5 w-5",
  };

  const Icon = isPartner ? Crown : Shield;
  const label = planName || (isPartner ? "Verified Partner" : "Guardian Member");

  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full font-semibold border",
        sizeClasses[size],
        isPartner
          ? "bg-accent/15 text-accent border-accent/30"
          : "bg-primary/15 text-primary border-primary/30",
        className
      )}
    >
      {badgeIconUrl ? (
        <img src={badgeIconUrl} alt="" className={cn(imgSizes[size], "rounded-full object-cover")} />
      ) : (
        <Icon className={iconSizes[size]} />
      )}
      {showLabel && <span>{label}</span>}
      <Sparkles className={cn(iconSizes[size], "opacity-60")} />
    </span>
  );
};

export default MembershipBadge;
