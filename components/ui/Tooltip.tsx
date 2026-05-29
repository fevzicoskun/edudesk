'use client'

import { useState } from 'react'

export default function Tooltip({
  children,
  content,
  position = 'top',
}: {
  children: React.ReactNode
  content: string
  position?: 'top' | 'bottom'
}) {
  const [show, setShow] = useState(false)

  return (
    <span className="relative inline-flex items-center">
      <span
        onMouseEnter={() => setShow(true)}
        onMouseLeave={() => setShow(false)}
        onFocus={() => setShow(true)}
        onBlur={() => setShow(false)}
        className="cursor-help"
      >
        {children}
      </span>
      {show && (
        <span
          className={`absolute z-50 w-max max-w-64 px-2.5 py-1.5 bg-gray-900 dark:bg-slate-700 text-white text-xs rounded-lg shadow-lg leading-snug pointer-events-none ${
            position === 'top'
              ? 'bottom-full left-1/2 -translate-x-1/2 mb-1.5'
              : 'top-full left-1/2 -translate-x-1/2 mt-1.5'
          }`}
        >
          {content}
          <span
            className={`absolute left-1/2 -translate-x-1/2 border-4 border-transparent ${
              position === 'top'
                ? 'top-full border-t-gray-900 dark:border-t-slate-700'
                : 'bottom-full border-b-gray-900 dark:border-b-slate-700'
            }`}
          />
        </span>
      )}
    </span>
  )
}
