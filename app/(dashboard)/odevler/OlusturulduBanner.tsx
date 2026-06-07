interface Props {
  olusturuldu: string | undefined
  hatali: string | undefined
}

export default function OlusturulduBanner({ olusturuldu, hatali }: Props) {
  const count = parseInt(olusturuldu ?? '0')
  if (!count) return null

  const isPartial = Boolean(hatali)
  return (
    <div className={`mb-4 flex items-start gap-2 border text-sm px-4 py-3 rounded-xl ${
      isPartial
        ? 'bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-800 text-amber-800 dark:text-amber-300'
        : 'bg-green-50 dark:bg-green-950/30 border-green-200 dark:border-green-800 text-green-800 dark:text-green-300'
    }`}>
      <svg className={`w-4 h-4 shrink-0 mt-0.5 ${isPartial ? 'text-amber-500' : 'text-green-500'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d={isPartial
          ? 'M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z'
          : 'M5 13l4 4L19 7'} />
      </svg>
      <div>
        <p>{count === 1 ? 'Ödev başarıyla oluşturuldu.' : `${count} sınıf için ödev oluşturuldu.`}</p>
        {isPartial && (
          <p className="text-xs mt-0.5 opacity-80">{parseInt(hatali!)} sınıf için oluşturulamadı.</p>
        )}
      </div>
    </div>
  )
}
