import { useEffect, useRef } from "react";

export type ToastKind = "info" | "success" | "error" | "warning";

export interface ToastMessage {
  id: string;
  message: string;
  kind?: ToastKind;
}

interface ToastProps {
  toasts: ToastMessage[];
  onDismiss: (id: string) => void;
}

const ICONS: Record<ToastKind, string> = {
  success: "✓",
  error: "✕",
  warning: "⚠",
  info: "✦",
};

function ToastItem({ toast, onDismiss }: { toast: ToastMessage; onDismiss: (id: string) => void }) {
  const kind = toast.kind ?? "info";
  const timerRef = useRef<number | null>(null);

  useEffect(() => {
    timerRef.current = window.setTimeout(() => onDismiss(toast.id), 4200);
    return () => { if (timerRef.current !== null) window.clearTimeout(timerRef.current); };
  }, [toast.id, onDismiss]);

  return (
    <div className={`toast toast-${kind}`} role="status" aria-live="polite">
      <span className="toast-icon">{ICONS[kind]}</span>
      <span className="toast-message">{toast.message}</span>
      <button
        className="toast-dismiss"
        aria-label="Dismiss notification"
        onClick={() => onDismiss(toast.id)}
        type="button"
      >
        ×
      </button>
    </div>
  );
}

export default function Toast({ toasts, onDismiss }: ToastProps) {
  if (toasts.length === 0) return null;
  return (
    <div className="toast-container" aria-label="Notifications">
      {toasts.map((t) => (
        <ToastItem key={t.id} toast={t} onDismiss={onDismiss} />
      ))}
    </div>
  );
}

/** Convenience hook — call addToast(message, kind) anywhere you have the setter */
export function useToast() {
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const addToast = (message: string, kind: ToastKind = "info") => {
    const id = `${Date.now()}-${Math.random()}`;
    setToasts((prev) => [...prev, { id, message, kind }]);
  };
  const dismissToast = (id: string) => setToasts((prev) => prev.filter((t) => t.id !== id));
  return { toasts, addToast, dismissToast };
}

// useState is used inside the hook so we need this import at the top-level too.
import { useState } from "react";

