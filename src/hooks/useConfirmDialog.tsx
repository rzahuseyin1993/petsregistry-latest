import { useCallback, useRef, useState } from "react";
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

export type ConfirmOptions = {
  title: string;
  description: string;
  confirmLabel?: string;
  cancelLabel?: string;
  /** Defaults to destructive (red) for delete-style actions */
  variant?: "destructive" | "default";
};

/**
 * Promise-based confirm dialog matching the app's AlertDialog style
 * (same look as Pet Health "Delete this record?").
 *
 * Usage:
 *   const { confirm, dialog } = useConfirmDialog();
 *   if (!(await confirm({ title: "...", description: "..." }))) return;
 *   // ... and render `{dialog}` once in the component tree
 */
export function useConfirmDialog() {
  const [options, setOptions] = useState<ConfirmOptions | null>(null);
  const resolveRef = useRef<((value: boolean) => void) | null>(null);

  const confirm = useCallback((opts: ConfirmOptions) => {
    return new Promise<boolean>((resolve) => {
      resolveRef.current = resolve;
      setOptions(opts);
    });
  }, []);

  const close = useCallback((value: boolean) => {
    resolveRef.current?.(value);
    resolveRef.current = null;
    setOptions(null);
  }, []);

  const destructive = (options?.variant ?? "destructive") === "destructive";

  const dialog = (
    <AlertDialog
      open={!!options}
      onOpenChange={(open) => {
        if (!open) close(false);
      }}
    >
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{options?.title}</AlertDialogTitle>
          <AlertDialogDescription>{options?.description}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={() => close(false)}>
            {options?.cancelLabel || "Cancel"}
          </AlertDialogCancel>
          <AlertDialogAction
            className={
              destructive
                ? "bg-destructive text-destructive-foreground hover:bg-destructive/90"
                : undefined
            }
            onClick={(e) => {
              e.preventDefault();
              close(true);
            }}
          >
            {options?.confirmLabel || "Delete"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );

  return { confirm, dialog };
}
