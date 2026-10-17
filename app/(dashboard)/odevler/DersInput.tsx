'use client'

import { dersEslestir } from '@/src/domains/homework/homeworkMath'

/** Ders alanı serbest kalır; yazarken okulda kullanılan dersler önerilir, alandan çıkınca yazım okulunkine oturur. */
export default function DersInput({ dersler, defaultValue, className, placeholder }: {
  dersler: string[]
  defaultValue: string
  className: string
  placeholder?: string
}) {
  return (
    <>
      <input
        name="subject" type="text" required maxLength={100} list="okul-dersleri" autoComplete="off"
        placeholder={placeholder} className={className} defaultValue={defaultValue}
        onBlur={e => { e.currentTarget.value = dersEslestir(e.currentTarget.value, dersler) }}
      />
      <datalist id="okul-dersleri">
        {dersler.map(d => <option key={d} value={d} />)}
      </datalist>
    </>
  )
}
