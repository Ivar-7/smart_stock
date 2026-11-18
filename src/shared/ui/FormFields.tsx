import type {
  InputHTMLAttributes,
  ReactNode,
  SelectHTMLAttributes,
  TextareaHTMLAttributes,
} from 'react';
import { cn } from '../utils/cn';

export function FieldLabel({
  htmlFor,
  children,
  hint,
}: {
  htmlFor?: string;
  children: ReactNode;
  hint?: string;
}) {
  return (
    <div className="mb-1.5 flex items-baseline justify-between gap-2">
      <label htmlFor={htmlFor} className="text-ink text-xs font-medium">
        {children}
      </label>
      {hint ? <span className="text-ink-muted text-xs">{hint}</span> : null}
    </div>
  );
}

export function FieldError({ message }: { message?: string | null }) {
  if (!message) {
    return null;
  }
  return <p className="mt-1 text-xs text-rose-600 dark:text-rose-400">{message}</p>;
}

const INPUT_BASE =
  'w-full rounded-lg border border-edge bg-panel-subtle px-3 py-2 text-sm text-ink placeholder:text-ink-muted transition-colors focus:border-edge-strong focus:bg-panel focus:outline-none disabled:cursor-not-allowed disabled:opacity-60';

export function Input({ className, ...rest }: InputHTMLAttributes<HTMLInputElement>) {
  return <input className={cn(INPUT_BASE, className)} {...rest} />;
}

export function Select({ className, children, ...rest }: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select className={cn(INPUT_BASE, 'cursor-pointer', className)} {...rest}>
      {children}
    </select>
  );
}

export function Textarea({ className, ...rest }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea className={cn(INPUT_BASE, 'min-h-20 resize-y', className)} {...rest} />;
}
