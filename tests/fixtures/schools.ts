import { randomUUID } from 'crypto'

export interface MockSchool {
  id: string
  name: string
  created_at: string
}

export function makeSchool(name?: string): MockSchool {
  return {
    id:         randomUUID(),
    name:       name ?? `Test Okul ${randomUUID().slice(0, 4)}`,
    created_at: new Date().toISOString(),
  }
}

export const SCHOOL_ANKARA = makeSchool('Ankara Test Lisesi')
export const SCHOOL_IZMIR  = makeSchool('İzmir Test Lisesi')
