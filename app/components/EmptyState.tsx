import Link from 'next/link'

export interface EmptyStateAction {
  label: string
  href: string
}

interface EmptyStateProps {
  icon?: React.ReactNode
  title: string
  description?: string
  action?: EmptyStateAction
  secondaryAction?: EmptyStateAction
}

const DEFAULT_ICON = (
  <svg className="w-8 h-8 text-gray-300 dark:text-slate-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
  </svg>
)

export default function EmptyState({ icon, title, description, action, secondaryAction }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-24 text-center">
      <div className="w-16 h-16 bg-gray-100 dark:bg-slate-800 rounded-2xl flex items-center justify-center mb-4">
        {icon ?? DEFAULT_ICON}
      </div>
      <p className="text-gray-900 dark:text-slate-100 font-semibold text-base">{title}</p>
      {description && <p className="text-gray-400 text-sm mt-1 max-w-xs">{description}</p>}
      {action && (
        <Link
          href={action.href}
          className="mt-5 inline-flex items-center gap-2 bg-gradient-to-r from-blue-600 to-blue-700 text-white px-5 py-2.5 rounded-xl text-sm font-semibold shadow-md shadow-blue-500/25"
        >
          {action.label}
        </Link>
      )}
      {secondaryAction && (
        <Link
          href={secondaryAction.href}
          className="mt-3 inline-flex items-center gap-2 border border-gray-200 dark:border-slate-700 text-gray-600 dark:text-slate-300 px-5 py-2.5 rounded-xl text-sm font-medium hover:bg-gray-50 dark:hover:bg-slate-800 transition-colors"
        >
          {secondaryAction.label}
        </Link>
      )}
    </div>
  )
}
