import { Globe, ArrowRight } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import CountrySelect from "@/components/CountrySelect";
import { toast } from "sonner";
import type { BrowseCountryMode } from "@/hooks/useBrowseCountryFilter";

type BrowseCountryBarProps = {
  mode: BrowseCountryMode;
  selectedCountryValue: string;
  activeLabel: string | null;
  isFiltering: boolean;
  sharePath: string | null;
  onSelectCountry: (country: string) => void;
  onShowAllCountries: () => void;
  className?: string;
};

const BrowseCountryBar = ({
  mode,
  selectedCountryValue,
  activeLabel,
  isFiltering,
  sharePath,
  onSelectCountry,
  onShowAllCountries,
  className = "",
}: BrowseCountryBarProps) => {
  const navigate = useNavigate();

  const handleShareLocalFeed = () => {
    if (!sharePath) {
      toast.error("Select a country first to open a local feed");
      return;
    }
    navigate(sharePath);
  };

  return (
    <div className={`flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center ${className}`}>
      <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2 sm:gap-3">
        <div className="flex min-w-[200px] max-w-full flex-1 items-center gap-2 sm:max-w-xs">
          <Globe className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
          <CountrySelect
            value={selectedCountryValue}
            onChange={onSelectCountry}
            placeholder="All countries"
            className="h-9"
          />
        </div>

        <button
          type="button"
          onClick={onShowAllCountries}
          className={`text-sm font-medium transition-colors ${
            mode === "all"
              ? "text-primary"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          Show all countries
        </button>

        {isFiltering && activeLabel && (
          <Badge variant="outline" className="font-normal">
            {activeLabel}
          </Badge>
        )}
      </div>

      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="h-9 shrink-0 gap-1 px-2 text-sm font-medium text-primary hover:text-primary"
        onClick={handleShareLocalFeed}
        disabled={!sharePath}
      >
        Share local feed
        <ArrowRight className="h-3.5 w-3.5" />
      </Button>
    </div>
  );
};

export default BrowseCountryBar;
