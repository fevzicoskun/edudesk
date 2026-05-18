export function getEgitimYili(): string {
  const now = new Date()
  const ay = now.getMonth() + 1
  const yil = now.getFullYear()
  return ay >= 9 ? `${yil}-${yil + 1}` : `${yil - 1}-${yil}`
}

export function schoolYearStart(): string {
  const now = new Date()
  const year = now.getMonth() >= 8 ? now.getFullYear() : now.getFullYear() - 1
  return `${year}-09-01`
}
