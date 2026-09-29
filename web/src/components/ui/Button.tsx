import { forwardRef, type ButtonHTMLAttributes } from 'react'
import { Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'

type Variant = 'primary' | 'secondary' | 'outline' | 'ghost' | 'success' | 'danger'
type Size = 'sm' | 'md' | 'lg' | 'icon'

const variants: Record<Variant, string> = {
  primary: 'bg-[linear-gradient(135deg,#0f766e,#0d9488)] text-white hover:brightness-108 active:translate-y-px shadow-[0_12px_28px_-18px_rgba(15,118,110,.95)]',
  secondary: 'bg-plum-soft text-plum hover:bg-[#e9dcdc]',
  outline: 'bg-surface text-ink border border-line/90 shadow-sm hover:-translate-y-px hover:border-plum/25 hover:bg-panel hover:shadow-[var(--shadow-soft)]',
  ghost: 'text-muted hover:bg-plum-soft/70 hover:text-plum',
  success: 'bg-success/12 text-[#2b7a50] border border-success/22 hover:bg-success/18',
  danger: 'bg-danger/10 text-danger border border-danger/20 hover:bg-danger/16',
}

const sizes: Record<Size, string> = {
  sm: 'h-8 px-3 text-[13px]',
  md: 'h-10 px-4 text-sm',
  lg: 'h-11 px-5 text-[15px]',
  icon: 'h-9 w-9',
}

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant
  size?: Size
  loading?: boolean
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { className, variant = 'secondary', size = 'md', loading, disabled, children, ...props },
  ref,
) {
  return (
    <button
      ref={ref}
      className={cn(
        'inline-flex items-center justify-center gap-2 rounded-full font-medium transition-all',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-plum/20 focus-visible:ring-offset-2',
        'disabled:pointer-events-none disabled:opacity-55',
        variants[variant], sizes[size], className,
      )}
      disabled={disabled || loading}
      {...props}
    >
      {loading ? <Loader2 className="size-4 animate-spin" /> : null}
      {children}
    </button>
  )
})
