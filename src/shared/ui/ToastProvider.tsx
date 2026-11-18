import { CheckCircle2, Info, X, XCircle } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { useCallback, useMemo, useState, type ReactNode } from 'react';
import { ToastContext, type ToastPayload, type ToastTone } from './useToast';

interface ToastItem extends ToastPayload {
  id: string;
  tone: ToastTone;
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const dismiss = useCallback((id: string) => {
    setToasts((prev) => prev.filter((item) => item.id !== id));
  }, []);

  const pushToast = useCallback(
    (payload: ToastPayload) => {
      const id = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
      const item: ToastItem = {
        id,
        title: payload.title,
        description: payload.description,
        tone: payload.tone ?? 'info',
      };
      setToasts((prev) => [...prev.slice(-3), item]);
      window.setTimeout(() => dismiss(id), 4500);
    },
    [dismiss],
  );

  const value = useMemo(() => ({ pushToast }), [pushToast]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div
        aria-live="polite"
        className="pointer-events-none fixed right-4 bottom-4 z-50 flex w-full max-w-sm flex-col gap-2"
      >
        <AnimatePresence>
          {toasts.map((toast) => (
            <motion.div
              key={toast.id}
              initial={{ opacity: 0, y: 12, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 8, scale: 0.97 }}
              transition={{ duration: 0.16 }}
              className="bg-panel border-edge pointer-events-auto flex items-start gap-3 rounded-xl border p-3.5 shadow-xl"
            >
              <span className="mt-0.5 shrink-0">
                {toast.tone === 'success' ? (
                  <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                ) : toast.tone === 'error' ? (
                  <XCircle className="h-4 w-4 text-rose-500" />
                ) : (
                  <Info className="text-ink-secondary h-4 w-4" />
                )}
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-ink text-xs font-semibold">{toast.title}</p>
                {toast.description ? (
                  <p className="text-ink-muted mt-0.5 text-xs leading-snug">{toast.description}</p>
                ) : null}
              </div>
              <button
                type="button"
                onClick={() => dismiss(toast.id)}
                aria-label="Dismiss notification"
                className="text-ink-muted hover:text-ink rounded p-0.5"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </ToastContext.Provider>
  );
}
