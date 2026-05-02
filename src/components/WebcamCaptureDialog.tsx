import { useEffect, useRef, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Camera, RotateCcw, X } from "lucide-react";
import { toast } from "sonner";

interface WebcamCaptureDialogProps {
  open: boolean;
  onClose: () => void;
  onCapture: (file: File, dataUrl: string) => void;
}

const WebcamCaptureDialog = ({ open, onClose, onCapture }: WebcamCaptureDialogProps) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [capturedFile, setCapturedFile] = useState<File | null>(null);
  const [starting, setStarting] = useState(false);

  const stopStream = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
  };

  const startStream = async () => {
    setStarting(true);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment", width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: false,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
    } catch (err: any) {
      console.error("Camera error:", err);
      toast.error(err.message || "Could not access camera. Please check browser permissions.");
      onClose();
    } finally {
      setStarting(false);
    }
  };

  useEffect(() => {
    if (open) {
      setPreviewUrl(null);
      setCapturedFile(null);
      startStream();
    } else {
      stopStream();
      setPreviewUrl(null);
      setCapturedFile(null);
    }
    return () => stopStream();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const takePhoto = () => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return;
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.drawImage(video, 0, 0);
    canvas.toBlob((blob) => {
      if (!blob) return;
      const file = new File([blob], `pet-photo-${Date.now()}.jpg`, { type: "image/jpeg" });
      const url = URL.createObjectURL(blob);
      setPreviewUrl(url);
      setCapturedFile(file);
      stopStream();
    }, "image/jpeg", 0.9);
  };

  const retake = () => {
    setPreviewUrl(null);
    setCapturedFile(null);
    startStream();
  };

  const usePhoto = () => {
    if (!capturedFile || !previewUrl) return;
    // Convert preview blob URL → base64 data URL for the AI message
    const reader = new FileReader();
    reader.onload = () => {
      onCapture(capturedFile, reader.result as string);
      onClose();
    };
    reader.readAsDataURL(capturedFile);
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Camera className="h-5 w-5 text-primary" /> Take a Photo
          </DialogTitle>
        </DialogHeader>
        <div className="relative w-full aspect-video bg-muted rounded-lg overflow-hidden">
          {previewUrl ? (
            <img src={previewUrl} alt="Captured" className="absolute inset-0 w-full h-full object-contain" />
          ) : (
            <video ref={videoRef} className="absolute inset-0 w-full h-full object-cover" playsInline muted />
          )}
          {starting && (
            <div className="absolute inset-0 flex items-center justify-center bg-background/60">
              <p className="text-sm text-muted-foreground">Starting camera...</p>
            </div>
          )}
        </div>
        <canvas ref={canvasRef} className="hidden" />
        <div className="flex justify-end gap-2">
          {previewUrl ? (
            <>
              <Button variant="outline" onClick={retake} className="gap-2">
                <RotateCcw className="h-4 w-4" /> Retake
              </Button>
              <Button onClick={usePhoto} className="gap-2">
                Use this photo
              </Button>
            </>
          ) : (
            <>
              <Button variant="outline" onClick={onClose} className="gap-2">
                <X className="h-4 w-4" /> Cancel
              </Button>
              <Button onClick={takePhoto} disabled={starting} className="gap-2">
                <Camera className="h-4 w-4" /> Capture
              </Button>
            </>
          )}
        </div>
        <p className="text-xs text-muted-foreground text-center">
          📸 Photos are auto-deleted within 24 hours · Used only to help diagnose your pet
        </p>
      </DialogContent>
    </Dialog>
  );
};

export default WebcamCaptureDialog;
