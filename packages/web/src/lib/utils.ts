// packages/web/src/lib/utils.ts
// Utility functions for Shadcn/ui components

import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
