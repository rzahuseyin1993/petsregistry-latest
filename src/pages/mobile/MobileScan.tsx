import { useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { X, ScanLine } from "lucide-react";
import { toast } from "sonner";
import BarcodeScanner from "react-qr-barcode-scanner";

const MobileScan = () => {
  const [scanning, setScanning] = useState(true);
  const navigate = useNavigate();

  const handleScanResult = useCallback((err: any, result: any) => {
    if (result) {
      const scannedText = result.getText();
      setScanning(false);
      const petIdMatch = scannedText.match(/\/pet\/([a-f0-9-]+)/i);
      if (petIdMatch) {
        toast.success("QR code scanned — opening pet profile...");
        navigate(`/m/pet/${petIdMatch[1]}`);
      } else if (scannedText.match(/^[a-f0-9-]{36}$/i)) {
        toast.success("QR code scanned — opening pet profile...");
        navigate(`/m/pet/${scannedText}`);
      } else {
        toast.info("QR scanned â€” searching...");
        navigate(`/m/search?q=${encodeURIComponent(scannedText)}`);
      }
    }
  }, [navigate]);

  return (
    <div className="flex flex-col items-center justify-center px-4 py-12 text-center">
      {scanning ? (
        <div className="w-full max-w-sm space-y-4">
          <h1 className="font-display text-lg font-bold text-foreground">Scan Pet QR Code</h1>
          <p className="text-sm text-muted-foreground">Point your camera at a PetsRegistry QR code</p>
          <div className="overflow-hidden rounded-2xl border border-border">
            <BarcodeScanner width={350} height={350} onUpdate={handleScanResult} />
          </div>
          <Button variant="outline" className="w-full gap-2" onClick={() => navigate("/m")}>
            <X className="h-4 w-4" /> Cancel
          </Button>
        </div>
      ) : (
        <div className="space-y-4">
          <ScanLine className="mx-auto h-16 w-16 text-primary/30" />
          <p className="text-sm text-muted-foreground">Processing scan...</p>
        </div>
      )}
    </div>
  );
};

export default MobileScan;
