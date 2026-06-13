import type { Metadata } from 'next'
import DemoPlayer from './DemoPlayer'

export const metadata: Metadata = {
  title: 'EduDesk Demo - Interaktif Tur',
  description: 'EduDesk ozelliklerini interaktif demomuzla kesfedin: odev takibi, yoklama, mudur paneli ve veli portali.',
}

export default function DemoPage() {
  return <DemoPlayer />
}
