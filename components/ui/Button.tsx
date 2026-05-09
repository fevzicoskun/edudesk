import type { ButtonHTMLAttributes, ReactNode } from 'react'
import { cn } from './cn'
import { BUTTON_BASE, BUTTON_SIZES, BUTTON_VARIANTS, type ButtonSize, type ButtonVariant } from './buttonStyles'

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant
  size?: ButtonSize
  loading?: boolean
  fullWidth?: boolean
  leftIcon?: ReactNode
  rightIcon?: ReactNode
}

export default function Button({
  variant = 'primary',
  size = 'md',
  loading = false,
  fullWidth = false,
  leftIcon,
  rightIcon,
  disabled,
  className,
  children,
  ...props
}: ButtonProps) {
  return (
    <button
      disabled={disabled || loading}
      className={cn(
        BUTTON_BASE,
        BUTTON_VARIANTS[variant],
        BUTTON_SIZES[size],
        fullWidth && 'w-full',
        className
      )}
      {...props}
    >
      {loading ? <Spinner /> : leftIcon}
      {children}
      {!loading && rightIcon}
    </button>
  )
}

function Spinner() {
  return (
    <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" className="opacity-25" />
      <path fill="currentColor" d="M4 12a8 8 0 018-8v3a5 5 0 00-5 5H4z" className="opacity-75" />
    </svg>
  )
}
