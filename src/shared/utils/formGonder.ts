import { startTransition, type SubmitEvent } from 'react'

/** React 19 `<form action={fn}>` sunucu HATA döndürse de formu sıfırlar → defaultValue'lu alanlarda yazılan
 *  kaybolur (2026-10-17, e2e form-hata-veri-korunur). `onSubmit={formGonder(formAction)}` sıfırlamaz;
 *  başarıda temizlenmesi gereken form bunu kendisi yapar (`form.reset()`). */
export function formGonder(action: (fd: FormData) => void) {
  return (e: SubmitEvent<HTMLFormElement>) => {
    e.preventDefault()
    // submitter: birden çok gönder düğmeli formda düğmenin name/value'su da gitsin (action prop'u gibi)
    const fd = new FormData(e.currentTarget, e.nativeEvent.submitter)
    startTransition(() => action(fd))
  }
}
