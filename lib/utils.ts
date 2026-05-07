export function getEgitimYili(): string {
  const now = new Date()
  const ay = now.getMonth() + 1
  const yil = now.getFullYear()
  return ay >= 9 ? `${yil}-${yil + 1}` : `${yil - 1}-${yil}`
}
