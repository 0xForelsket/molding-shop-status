// packages/web/src/components/ui/dialog.tsx
// Shadcn-style Dialog/Modal component

import { X } from 'lucide-react';
import type * as React from 'react';
import { cn } from '../../lib/utils';

interface DialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  children: React.ReactNode;
}

export function Dialog({ open, onOpenChange, children }: DialogProps) {
  if (!open) return null;

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      onOpenChange(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50" onKeyDown={handleKeyDown}>
      <div
        className="fixed inset-0 bg-black/50 backdrop-blur-sm"
        onClick={() => onOpenChange(false)}
        onKeyDown={(e) => e.key === 'Enter' && onOpenChange(false)}
        role="button"
        tabIndex={0}
        aria-label="Close dialog"
      />
      <div className="fixed inset-0 flex items-center justify-center p-4">
        <dialog
          open
          className="relative bg-slate-800 rounded-xl shadow-2xl border border-slate-700 max-h-[90vh] overflow-auto m-0"
          onClick={(e) => e.stopPropagation()}
          onKeyDown={(e) => e.stopPropagation()}
        >
          {children}
        </dialog>
      </div>
    </div>
  );
}

export function DialogContent({
  className,
  children,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn('p-6 min-w-[400px] max-w-lg', className)} {...props}>
      {children}
    </div>
  );
}

export function DialogHeader({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('mb-4', className)} {...props} />;
}

export function DialogTitle({ className, ...props }: React.HTMLAttributes<HTMLHeadingElement>) {
  return <h2 className={cn('text-lg font-semibold text-white', className)} {...props} />;
}

export function DialogDescription({
  className,
  ...props
}: React.HTMLAttributes<HTMLParagraphElement>) {
  return <p className={cn('text-sm text-slate-400', className)} {...props} />;
}

export function DialogClose({
  onClose,
  className,
}: {
  onClose: () => void;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClose}
      className={cn(
        'absolute right-4 top-4 rounded-sm opacity-70 hover:opacity-100 focus:outline-none',
        className
      )}
    >
      <X className="h-4 w-4" />
    </button>
  );
}
