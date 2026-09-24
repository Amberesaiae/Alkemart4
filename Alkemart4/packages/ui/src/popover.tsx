import * as React from "react"
import * as PopoverPrimitive from "@radix-ui/react-popover"
import { cn } from "./cn"

const Popover = PopoverPrimitive.Root
const PopoverTrigger = PopoverPrimitive.Trigger
const PopoverAnchor = PopoverPrimitive.Anchor

const PopoverContent = React.forwardRef<
  React.ElementRef<typeof PopoverPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof PopoverPrimitive.Content>
>(({ className, align = "start", sideOffset = 4, ...props }, ref) => (
  <PopoverPrimitive.Portal>
    <PopoverPrimitive.Content
      ref={ref}
      align={align}
      sideOffset={sideOffset}
      className={cn(
        "z-50 w-auto rounded-lg border border-border bg-popover p-0 text-popover-foreground shadow-md outline-none data-[state=open]: data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]: data-[state=closed]:zoom-out-95 data-[state=open]: data-[side=bottom]: data-[side=left]: data-[side=right]: data-[side=top]:",
        className
      )}
      {...props}
    />
  </PopoverPrimitive.Portal>
))
PopoverContent.displayName = PopoverPrimitive.Content.displayName

export { Popover, PopoverTrigger, PopoverContent, PopoverAnchor }
