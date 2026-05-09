import Link from 'next/link'
import type { ComponentProps, ReactNode } from 'react'
import { cn } from './cn'
import { BUTTON_BASE, BUTTON_SIZES, BUTTON_VARIANTS, type ButtonSize, type ButtonVariant } from './buttonStyles'

interface ButtonLinkProps extends ComponentProps<typeof Link> {
  variant?: ButtonVariant
  size?: ButtonSize
  fullWidth?: boolean
  leftIcon?: ReactNode
  rightIcon?: ReactNode
}

export default function ButtonLink({
  variant = 'primary',
  size = 'md',
  fullWidth = false,
  leftIcon,
  rightIcon,
  className,
  children,
  ...props
}: ButtonLinkProps) {
  return (
    <Link
      className={cn(
        BUTTON_BASE,
        BUTTON_VARIANTS[variant],
        BUTTON_SIZES[size],
        fullWidth && 'w-full',
        className
      )}
      {...props}
    >
      {leftIcon}
      {children}
      {rightIcon}
    </Link>
  )
}
