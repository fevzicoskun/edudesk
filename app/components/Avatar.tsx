// Baş-harf avatarı: isimden deterministik renkli daire. Foto yükleme yok (Storage
// gerektirir) — baş harfler perceived value'nun çoğunu sıfır altyapıyla verir.
const AVATAR_BG = [
  'bg-blue-500',
  'bg-emerald-500',
  'bg-amber-500',
  'bg-violet-500',
  'bg-rose-500',
  'bg-cyan-600',
  'bg-fuchsia-500',
  'bg-teal-500',
]

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return '?'
  const first = parts[0][0] ?? ''
  const last = parts.length > 1 ? parts[parts.length - 1][0] ?? '' : ''
  return (first + last).toLocaleUpperCase('tr-TR')
}

function bgFor(name: string): string {
  let h = 0
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0
  return AVATAR_BG[h % AVATAR_BG.length]
}

const SIZES = {
  sm: 'w-8 h-8 text-xs',
  md: 'w-9 h-9 text-sm',
  lg: 'w-16 h-16 text-xl',
}

export default function Avatar({
  name,
  size = 'md',
  src,
}: {
  name: string
  size?: keyof typeof SIZES
  src?: string | null
}) {
  const label = name.trim() || '?'
  if (src) {
    // eslint-disable-next-line @next/next/no-img-element -- avatar; küçük, Storage public URL, next/image domain config gereksiz
    return <img src={src} alt={label} title={label} className={`rounded-full object-cover shrink-0 ${SIZES[size]}`} />
  }
  return (
    <span
      title={label}
      aria-hidden="true"
      className={`inline-flex items-center justify-center rounded-full font-semibold text-white shrink-0 select-none ${SIZES[size]} ${bgFor(label)}`}
    >
      {initials(label)}
    </span>
  )
}
