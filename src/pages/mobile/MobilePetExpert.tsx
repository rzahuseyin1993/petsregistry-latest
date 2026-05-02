import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Sparkles } from "lucide-react";

const MobilePetExpert = () => {
  return (
    <div className="p-4">
      <div className="flex items-center gap-2 mb-4">
        <Link to="/m">
          <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <h1 className="font-display text-lg font-bold text-foreground flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-purple-500" /> AI Pet Expert
        </h1>
      </div>
      {/* Embed the desktop pet expert in an iframe-like approach or redirect */}
      <div className="rounded-xl border border-border overflow-hidden">
        <iframe src="/pet-expert" className="w-full h-[calc(100vh-180px)] border-0" title="Pet Expert" />
      </div>
    </div>
  );
};

export default MobilePetExpert;
