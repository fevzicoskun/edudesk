import { createHmac } from 'crypto'

const secret = () => {
  const s = process.env.UNSUBSCRIBE_SECRET
  if (!s) throw new Error('UNSUBSCRIBE_SECRET env eksik')
  return s
}

export function signUnsubscribeToken(studentId: string): string {
  return createHmac('sha256', secret()).update(studentId).digest('hex')
}

export function verifyUnsubscribeToken(studentId: string, sig: string): boolean {
  const expected = createHmac('sha256', secret()).update(studentId).digest('hex')
  // timing-safe compare
  if (expected.length !== sig.length) return false
  let diff = 0
  for (let i = 0; i < expected.length; i++) diff |= expected.charCodeAt(i) ^ sig.charCodeAt(i)
  return diff === 0
}

export function unsubscribeUrl(studentId: string, baseUrl: string): string {
  const sig = signUnsubscribeToken(studentId)
  return `${baseUrl}/api/unsubscribe?id=${studentId}&sig=${sig}`
}
