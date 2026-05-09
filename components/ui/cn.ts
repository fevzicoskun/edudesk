import { twMerge } from 'tailwind-merge'

export function cn(...classes: (string | undefined | false | null | 0)[]): string {
  return twMerge(...(classes.filter(Boolean) as string[]))
}
