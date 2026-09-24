"use client"
import * as React from "react"
import * as DialogPrimitive from "@radix-ui/react-dialog"
import { X } from "@phosphor-icons/react"
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
          className={cn(
            "fixed inset-0 z-50 bg-black/60 backdrop-blur-xs",
          )}
        />
        <DialogPrimitive.Content
          style={{ position: "fixed", top: "50%", left: "50%", transform: "translate(-50%, -50%)" }}
          className={cn(
            "fixed left-1/2 top-1/2 z-50 w-[calc(100%-2rem)] max-w-lg max-h-[85vh] overflow-y-auto rounded-lg border border-border bg-background p-6 text-foreground shadow-2xl",
            className,
          )}
        >
          <DialogPrimitive.Close className="absolute top-4 right-4 rounded-lg h-8 w-8 inline-flex items-center justify-center text-muted-foreground opacity-70 hover:opacity-100 hover:bg-muted hover:text-foreground focus:outline-none focus:ring-2 focus:ring-ring">
            <X className="h-4 w-4" />
          </DialogPrimitive.Close>

          {title && (
            <div className="pb-4 mb-4 border-b border-border pr-8">
              <h2 className="text-lg font-bold tracking-tight text-foreground">{title}</h2>
            </div>
          )}
          <div className="space-y-4">{children}</div>
          {footer && (
            <div className="-mx-6 -mb-6 mt-6 px-6 py-4 bg-muted/30 flex items-center justify-end gap-3 rounded-b-2xl">
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
