import { forwardRef, type InputHTMLAttributes, type SelectHTMLAttributes, type TextareaHTMLAttributes, type LabelHTMLAttributes, type ReactNode } from 'react'
import { cn } from '@/lib/utils'

const fieldBase = 'w-full rounded-2xl border border-line bg-panel px-4 text-sm text-ink shadow-none transition-colors placeholder:text-muted/65 focus:border-plum/30 focus:bg-surface focus:outline-none focus:ring-4 focus:ring-plum/8 disabled:opacity-60'

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(function Input({ className, ...props }, ref) {
  return <input ref={ref} className={cn(fieldBase, 'h-11', className)} {...props} />
})

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement>>(function Textarea({ className, ...props }, ref) {
  return <textarea ref={ref} className={cn(fieldBase, 'min-h-28 py-3 leading-6', className)} {...props} />
})

export const Select = forwardRef<HTMLSelectElement, SelectHTMLAttributes<HTMLSelectElement>>(function Select({ className, children, ...props }, ref) {
  return (
    <select ref={ref} className={cn(fieldBase, 'h-11 appearance-none bg-[url("data:image/svg+xml;utf8,<svg xmlns=%27http://www.w3.org/2000/svg%27 width=%2716%27 height=%2716%27 fill=%27%23776d70%27 viewBox=%270 0 16 16%27><path d=%27M4 6l4 4 4-4z%27/></svg>")] bg-[length:16px] bg-[right_1rem_center] bg-no-repeat pr-10', className)} {...props}>
      {children}
    </select>
  )
})

export function Label({ className, ...props }: LabelHTMLAttributes<HTMLLabelElement>) {
  return <label className={cn('mb-2 block text-[13px] font-medium text-plum', className)} {...props} />
}

export function Field({ label, hint, children, className }: { label: string; hint?: string; children: ReactNode; className?: string }) {
  return (
    <div className={className}>
      <Label>{label}</Label>
      {children}
      {hint ? <p className="mt-2 text-xs text-muted">{hint}</p> : null}
    </div>
  )
}
