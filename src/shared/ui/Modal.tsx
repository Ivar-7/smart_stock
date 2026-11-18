import { X } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { useEffect, type ReactNode } from 'react';
import { cn } from '../utils/cn';

export function Modal({
  isOpen,
  onClose,
  title,
  description,
  maxWidth = 'lg',
  children,
}: {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  maxWidth?: 'md' | 'lg' | '2xl';
  children: ReactNode;
}) {
  useEffect(() => {
    if (!isOpen) {
      return;
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isOpen, onClose]);

  const widthClass = maxWidth === 'md' ? 'max-w-md' : maxWidth === '2xl' ? 'max-w-2xl' : 'max-w-lg';

  return (
    <AnimatePresence>
      {isOpen ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="modal-title"
        >
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/60 backdrop-blur-xs"
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.97, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.97, y: 8 }}
            transition={{ duration: 0.16 }}
            className={cn(
              'bg-panel border-edge relative z-10 max-h-full w-full overflow-y-auto rounded-2xl border shadow-2xl',
              widthClass,
            )}
          >
            <div className="border-edge flex items-start justify-between gap-4 border-b px-6 py-4">
              <div>
                <h2 id="modal-title" className="text-ink text-base font-semibold tracking-tight">
                  {title}
                </h2>
                {description ? (
                  <p className="text-ink-muted mt-0.5 text-xs">{description}</p>
                ) : null}
              </div>
              <button
                type="button"
                onClick={onClose}
                aria-label="Close dialog"
                className="text-ink-muted hover:bg-panel-hover hover:text-ink rounded-lg p-1.5 transition-colors"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="p-6">{children}</div>
          </motion.div>
        </div>
      ) : null}
    </AnimatePresence>
  );
}
