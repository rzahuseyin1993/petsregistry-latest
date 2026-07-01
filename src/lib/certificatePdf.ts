import jsPDF from "jspdf";
import html2canvas from "html2canvas";
import QRCode from "qrcode";
import { createRoot } from "react-dom/client";
import { renderCertificateView } from "@/lib/certificateRender";

export async function generateCertificatePdf(
  template: any,
  petData: Record<string, string>,
  petImageUrl: string | undefined,
  certificateNumber: string | null | undefined,
  origin: string,
  parentPhotos?: { sire?: string; dam?: string },
): Promise<jsPDF> {
  const container = document.createElement("div");
  container.style.width = "1123px";
  container.style.height = "794px";
  container.style.position = "fixed";
  container.style.top = "-9999px";
  container.style.left = "-9999px";
  container.style.containerType = "inline-size";
  document.body.appendChild(container);

  const root = createRoot(container);
  root.render(renderCertificateView(template, petData, petImageUrl, parentPhotos));

  await new Promise((r) => setTimeout(r, 600));
  const canvas = await html2canvas(container, { scale: 2, useCORS: true, allowTaint: true });
  root.unmount();
  document.body.removeChild(container);

  const pdf = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
  pdf.addImage(canvas.toDataURL("image/jpeg", 0.95), "JPEG", 0, 0, 297, 210);

  const certNumber = certificateNumber || petData.certificate_number || petData.pet_code;
  if (certNumber && certNumber !== "Pending issue") {
    const verifyUrl = `${origin}/verify?code=${encodeURIComponent(certNumber)}`;
    const qrDataUrl = await QRCode.toDataURL(verifyUrl, { margin: 1, width: 256 });
    pdf.addImage(qrDataUrl, "PNG", 260, 173, 25, 25);
    pdf.setFontSize(7);
    pdf.setTextColor(100);
    pdf.text("Scan to verify", 272.5, 202, { align: "center" });
    pdf.text(certNumber, 272.5, 205, { align: "center" });
  }

  return pdf;
}

export function downloadCertificatePdf(pdf: jsPDF, petName: string) {
  pdf.save(`Pet_Certificate_${petName || "certificate"}.pdf`);
}

export function printCertificatePdf(pdf: jsPDF) {
  const blob = pdf.output("blob");
  const url = URL.createObjectURL(blob);
  const win = window.open(url, "_blank");
  if (!win) {
    URL.revokeObjectURL(url);
    throw new Error("Pop-up blocked. Please allow pop-ups to print.");
  }
  win.addEventListener("load", () => {
    win.focus();
    win.print();
  });
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}
