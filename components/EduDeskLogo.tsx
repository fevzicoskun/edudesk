interface Props {
  className?: string
  size?: 'sm' | 'md' | 'lg'
}

export default function EduDeskLogo({ className = '', size = 'md' }: Props) {
  const iconH = size === 'sm' ? 20 : size === 'lg' ? 32 : 26
  const iconW = Math.round(iconH * 0.96)

  return (
    <span className={`flex items-center gap-2 ${className}`}>
      <svg
        width={iconW}
        height={iconH}
        viewBox="0 0 25 27"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden="true"
      >
        {/* Sol sayfa - mor */}
        <path d="M0 7 L11 0 L11 26 L0 26 Z" fill="#7C3AED" />
        {/* Sırt - koyu */}
        <rect x="11" y="0" width="3" height="26" fill="#1a1035" />
        {/* Sağ sayfa - yeşil */}
        <path d="M14 0 L25 7 L25 26 L14 26 Z" fill="#10B981" />
      </svg>
      <span
        className={`font-bold tracking-tight text-gray-900 dark:text-slate-100 ${
          size === 'sm' ? 'text-sm' : size === 'lg' ? 'text-2xl' : 'text-base'
        }`}
      >
        edudesk
      </span>
    </span>
  )
}
