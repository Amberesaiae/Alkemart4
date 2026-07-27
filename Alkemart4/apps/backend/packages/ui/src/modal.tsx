"use client"
import * as React from "react"
import * as DialogPrimitive from "@radix-ui/react-dialog"
import { X } from "lucide-react"
import { cn } from "./cn"

interface LegacyModalProps {
  isOpen: boolean
  onClose: () => void
  title?: string
  children: React.ReactNode
  footer?: React.ReactNode
  className?: string
}

function Modal({ isOpen, onClose, title, children, footer, className }: LegacyModalProps) {
  return (
    <DialogPrimitive.Root open={isOpen} onOpenChange={(open) => { if (!open) onClose() }}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay
          aria-hidden="true"
          className={cn(
            "fixed inset-0 z-50 bg-ink/50 backdrop-blur-sm",
            "data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
          )}
        />
        <DialogPrimitive.Content
          role="dialog"
          aria-modal="true"
          className={cn(
            "fixed left-1/2 top-1/2 z-50 w-full max-w-lg -translate-x-1/2 -translate-y-1/2 rounded-xl border border-border bg-card text-card-foreground shadow-lg",
            "data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
            "data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95",
            className,
          )}
        >
          {title && (
            <div className="flex items-center justify-between p-6 border-b">
              <h2 className="text-lg font-semibold">{title}</h2>
              <DialogPrimitive.Close className="rounded-full h-8 w-8 inline-flex items-center justify-center opacity-70 hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring">
                <X className="h-4 w-4" />
              </DialogPrimitive.Close>
            </div>
          )}
          <div className="p-6">{children}</div>
          {footer && (
            <div className="px-6 py-4 border-t bg-muted/20 flex items-center justify-end gap-3 rounded-b-xl">
              {footer}
            </div>
          )}
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  )
}

const ModalTrigger = DialogPrimitive.Trigger
ModalTrigger.displayName = "ModalTrigger"

const ModalClose = DialogPrimitive.Close
ModalClose.displayName = "ModalClose"

export { Modal, ModalTrigger, ModalClose }
