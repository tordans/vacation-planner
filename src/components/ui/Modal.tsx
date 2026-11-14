import { Dialog, DialogBackdrop, DialogPanel, DialogTitle } from '@headlessui/react'
import type { ReactNode } from 'react'
import { cn } from '@/lib/cn'

type ModalProps = {
  open: boolean
  onClose: () => void
  title: string
  children: ReactNode
  /** `lg` for longer texts. */
  size?: 'md' | 'lg'
}

/** A small dialog with a title; the body brings its own buttons. */
export function Modal({ open, onClose, title, children, size = 'md' }: ModalProps) {
  return (
    <Dialog open={open} onClose={onClose} className="relative z-40">
      <DialogBackdrop
        transition
        className="fixed inset-0 bg-zinc-950/30 transition duration-150 data-closed:opacity-0"
      />
      <div className="fixed inset-0 overflow-y-auto p-4">
        <div className="flex min-h-full items-start justify-center sm:items-center">
          <DialogPanel
            transition
            className={cn(
              'w-full space-y-4 rounded-xl bg-white p-6 shadow-xl transition duration-150 data-closed:scale-95 data-closed:opacity-0',
              size === 'lg' ? 'max-w-2xl' : 'max-w-lg',
            )}
          >
            <DialogTitle className="text-lg font-semibold tracking-tight">{title}</DialogTitle>
            {children}
          </DialogPanel>
        </div>
      </div>
    </Dialog>
  )
}
