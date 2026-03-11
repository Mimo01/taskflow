import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

/**
 * Merges Tailwind CSS class names with clsx and tailwind-merge.
 * Resolves conflicts intelligently (e.g., bg-red-500 + bg-blue-500 → bg-blue-500).
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
