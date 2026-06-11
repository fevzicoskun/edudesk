export default function SectionHeader({ label, count, color }: { label: string; count: number; color: string }) {
  return (
    <div className="flex items-center gap-2 mb-3">
      <span className={`w-1.5 h-4 ${color} rounded-full`} />
      <h2 className="text-xs font-semibold text-gray-500 dark:text-slate-400 uppercase tracking-wider">
        {label} · {count}
      </h2>
    </div>
  )
}
