const WA_MESSAGE = 'EduDesk hakkında bilgi almak istiyorum'

export function getWhatsAppHref(): string {
  const number = process.env.NEXT_PUBLIC_WHATSAPP_NUMBER ?? '905000000000'
  return `https://wa.me/${number}?text=${encodeURIComponent(WA_MESSAGE)}`
}
