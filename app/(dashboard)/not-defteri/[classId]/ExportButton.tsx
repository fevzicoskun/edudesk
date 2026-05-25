'use client'

import Button from '@/components/ui/Button'

export default function ExportButton({ classId }: { classId: string }) {
  return (
    <a href={`/api/grades/export/${classId}`} download>
      <Button variant="secondary" size="sm">Excel İndir</Button>
    </a>
  )
}
