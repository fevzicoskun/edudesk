'use client'
import { useState } from 'react'
import { ChevronDown, ChevronUp } from 'lucide-react'

export default function HomeworkDescriptionToggle({ description }: { description: string }) {
  const [expanded, setExpanded] = useState(false)
  const isLong = description.length > 120
  const text = !isLong || expanded ? description : description.slice(0, 120) + '…'

  return (
    <div className="mt-1.5">
      <p className="text-xs text-gray-500 leading-relaxed">{text}</p>
      {isLong && (
        <button
          onClick={() => setExpanded(e => !e)}
          className="flex items-center gap-0.5 text-xs text-blue-500 mt-0.5 hover:text-blue-700"
        >
          {expanded ? 'Daha az' : 'Devamını gör'}
          {expanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
        </button>
      )}
    </div>
  )
}
