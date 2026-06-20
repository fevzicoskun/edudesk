// Her sınıf tutarlı bir renk alır — ders programı ızgarası ve dashboard "Bugünkü
// Programım" şeridi aynı paleti kullanır, böylece "9-A hep mavi" tutarlılığı her
// yerde korunur. Tam literal string'ler: Tailwind JIT dinamik sınıf adı üretmez.
export const CLASS_PALETTE = [
  'bg-blue-50 text-blue-700 ring-blue-200/70 dark:bg-blue-500/15 dark:text-blue-200 dark:ring-blue-400/20',
  'bg-emerald-50 text-emerald-700 ring-emerald-200/70 dark:bg-emerald-500/15 dark:text-emerald-200 dark:ring-emerald-400/20',
  'bg-amber-50 text-amber-700 ring-amber-200/70 dark:bg-amber-500/15 dark:text-amber-200 dark:ring-amber-400/20',
  'bg-violet-50 text-violet-700 ring-violet-200/70 dark:bg-violet-500/15 dark:text-violet-200 dark:ring-violet-400/20',
  'bg-rose-50 text-rose-700 ring-rose-200/70 dark:bg-rose-500/15 dark:text-rose-200 dark:ring-rose-400/20',
  'bg-cyan-50 text-cyan-700 ring-cyan-200/70 dark:bg-cyan-500/15 dark:text-cyan-200 dark:ring-cyan-400/20',
  'bg-fuchsia-50 text-fuchsia-700 ring-fuchsia-200/70 dark:bg-fuchsia-500/15 dark:text-fuchsia-200 dark:ring-fuchsia-400/20',
  'bg-teal-50 text-teal-700 ring-teal-200/70 dark:bg-teal-500/15 dark:text-teal-200 dark:ring-teal-400/20',
]

export function classColor(key: string): string {
  let h = 0
  for (let i = 0; i < key.length; i++) h = (h * 31 + key.charCodeAt(i)) >>> 0
  return CLASS_PALETTE[h % CLASS_PALETTE.length]
}
