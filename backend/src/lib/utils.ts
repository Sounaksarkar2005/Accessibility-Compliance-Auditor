import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function severityColor(severity: 'A' | 'AA' | 'AAA'): string {
  switch (severity) {
    case 'A': return 'bg-red-100 text-red-800 border-red-200';
    case 'AA': return 'bg-orange-100 text-orange-800 border-orange-200';
    case 'AAA': return 'bg-yellow-100 text-yellow-800 border-yellow-200';
    default: return 'bg-gray-100 text-gray-800 border-gray-200';
  }
}

export function severityIcon(severity: 'A' | 'AA' | 'AAA'): string {
  switch (severity) {
    case 'A': return '🔴';
    case 'AA': return '🟠';
    case 'AAA': return '🟡';
    default: return '⚪';
  }
}

export function formatDate(date: Date | string): string {
  return new Date(date).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function truncate(str: string, length: number): string {
  if (str.length <= length) return str;
  return str.slice(0, length - 3) + '...';
}