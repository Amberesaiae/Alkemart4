import React from "react"
import { cn } from "../../lib/utils"
import { Button } from "./Button"
import { X } from "lucide-react"

export interface ModalProps {
  isOpen: boolean
  onClose: () => void
  title: string
  children: React.ReactNode
  footer?: React.ReactNode
  className?: string
}

export function Modal({ isOpen, onClose, title, children, footer, className }: ModalProps) {
  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 sm:p-0">
      <div className={cn("bg-card text-card-foreground rounded-xl shadow-lg w-full max-w-lg overflow-hidden flex flex-col", className)}>
        <div className="flex items-center justify-between p-6 border-b">
          <h2 className="text-lg font-semibold">{title}</h2>
          <Button variant="ghost" size="icon" onClick={onClose} className="rounded-full h-8 w-8">
            <X className="h-4 w-4" />
          </Button>
        </div>
        <div className="p-6 flex-1 overflow-y-auto">
          {children}
        </div>
        {footer && (
          <div className="p-6 border-t bg-muted/20 flex items-center justify-end gap-3">
            {footer}
          </div>
        )}
      </div>
    </div>
  )
}
