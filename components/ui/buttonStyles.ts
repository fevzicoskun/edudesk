export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger'
export type ButtonSize = 'sm' | 'md' | 'lg'

export const BUTTON_VARIANTS: Record<ButtonVariant, string> = {
  primary:   'bg-brand-600 text-white hover:bg-brand-700',
  secondary: 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50',
  ghost:     'text-gray-600 hover:bg-gray-100 hover:text-gray-900',
  danger:    'bg-danger-600 text-white hover:bg-danger-700',
}

export const BUTTON_SIZES: Record<ButtonSize, string> = {
  sm: 'h-8 px-3 text-xs',
  md: 'h-10 px-4 text-sm',
  lg: 'h-12 px-6 text-base',
}

export const BUTTON_BASE =
  'inline-flex items-center justify-center gap-2 rounded-lg font-medium transition-colors ' +
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2 ' +
  'disabled:opacity-50 disabled:cursor-not-allowed'
