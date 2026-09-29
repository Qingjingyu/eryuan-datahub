import { useState, type ReactNode } from 'react'
import { cn } from '@/lib/utils'

export interface TabItem {
  id: string
  label: string
  content: ReactNode
}

export function Tabs({ items, className, initial }: { items: TabItem[]; className?: string; initial?: string }) {
  const [active, setActive] = useState(initial || items[0]?.id)
  return (
    <div className={className}>
      <div className="mb-5 inline-flex max-w-full gap-1 overflow-x-auto rounded-full border border-line bg-surface p-1">
        {items.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => setActive(item.id)}
            className={cn(
              'h-9 whitespace-nowrap rounded-full px-4 text-sm transition-colors',
              active === item.id ? 'bg-plum text-white' : 'text-muted hover:bg-plum-soft/70 hover:text-plum',
            )}
          >
            {item.label}
          </button>
        ))}
      </div>
      <div className="fade-in">{items.find((item) => item.id === active)?.content}</div>
    </div>
  )
}
