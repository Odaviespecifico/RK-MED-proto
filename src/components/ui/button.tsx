import * as React from 'react'
import { Slot } from '@radix-ui/react-slot'
import { cn } from '../../lib/utils'

type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger'
  size?: 'default' | 'sm' | 'icon'
  asChild?: boolean
}
export function Button({ className, variant = 'primary', size = 'default', asChild = false, ...props }: ButtonProps) {
  const Comp = asChild ? Slot : 'button'
  return <Comp className={cn('button', `button-${variant}`, `button-${size}`, className)} {...props} />
}
