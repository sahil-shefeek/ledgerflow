"use client"

import * as React from "react"
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from "@/components/ui/drawer"
import { Button } from "@/components/ui/button"
import { Icon } from "@/components/ui/icon"
import { HugeiconsIcon } from "@hugeicons/react"
import { MoreHorizontalIcon, MoreVerticalIcon } from "@hugeicons/core-free-icons"
import { cn } from "@/lib/utils"

export type ActionDrawerIcon =
  | React.ComponentProps<typeof HugeiconsIcon>["icon"]
  | React.ReactNode

export interface ActionDrawerItem {
  label: string
  icon?: ActionDrawerIcon
  description?: string
  onClick?: () => void
  variant?: "default" | "destructive" | "outline" | "secondary" | "ghost"
  disabled?: boolean
  className?: string
  closeOnClick?: boolean
}

export interface ActionDrawerProps {
  open?: boolean
  onOpenChange?: (open: boolean) => void
  title?: React.ReactNode
  description?: React.ReactNode
  trigger?: React.ReactNode
  triggerVariant?: "ghost" | "outline" | "default" | "secondary"
  triggerOrientation?: "horizontal" | "vertical"
  triggerClassName?: string
  triggerAriaLabel?: string
  actions?: ActionDrawerItem[]
  children?: React.ReactNode
  showCancel?: boolean
  cancelText?: string
  className?: string
}

export function ActionDrawer({
  open,
  onOpenChange,
  title,
  description,
  trigger,
  triggerVariant = "ghost",
  triggerOrientation = "horizontal",
  triggerClassName,
  triggerAriaLabel = "More options",
  actions = [],
  children,
  showCancel = true,
  cancelText = "Cancel",
  className,
}: ActionDrawerProps) {
  const [internalOpen, setInternalOpen] = React.useState(false)
  const isControlled = open !== undefined
  const isOpen = isControlled ? open : internalOpen

  const handleOpenChange = React.useCallback(
    (nextOpen: boolean) => {
      if (!isControlled) {
        setInternalOpen(nextOpen)
      }
      onOpenChange?.(nextOpen)
    },
    [isControlled, onOpenChange]
  )

  const TriggerIcon = triggerOrientation === "vertical" ? MoreVerticalIcon : MoreHorizontalIcon

  const defaultTrigger = (
    <Button
      variant={triggerVariant}
      size="icon"
      aria-label={triggerAriaLabel}
      data-slot="mobile-action-trigger"
      data-testid="mobile-action-trigger"
      className={cn(
        "h-10 w-10 min-h-12 min-w-12 sm:min-h-8 sm:min-w-8 sm:h-8 sm:w-8 relative text-muted-foreground hover:text-foreground",
        triggerClassName
      )}
    >
      <Icon icon={TriggerIcon} className="h-5 w-5 sm:h-4 sm:w-4" />
    </Button>
  )

  return (
    <Drawer open={isOpen} onOpenChange={handleOpenChange} showSwipeHandle={true}>
      {trigger !== null && (
        <DrawerTrigger render={trigger ? (trigger as React.ReactElement) : defaultTrigger} />
      )}
      <DrawerContent data-testid="action-drawer" className={cn("max-h-[90dvh]", className)}>
        <div className="mx-auto w-full max-w-sm flex flex-col min-h-0">
          {(title || description) && (
            <DrawerHeader className="text-left pb-2">
              {title && (
                <DrawerTitle className="text-base font-semibold text-foreground">
                  {title}
                </DrawerTitle>
              )}
              {description && (
                <DrawerDescription className="text-xs text-muted-foreground">
                  {description}
                </DrawerDescription>
              )}
            </DrawerHeader>
          )}

          <div className="p-4 space-y-2 overflow-y-auto flex-1 min-h-0">
            {actions.map((action, index) => {
              const isDestructive = action.variant === "destructive"
              const shouldClose = action.closeOnClick ?? true

              const renderIcon = () => {
                if (!action.icon) return null
                if (React.isValidElement(action.icon)) {
                  return <span className="me-3 shrink-0">{action.icon}</span>
                }
                return (
                  <Icon
                    icon={action.icon as React.ComponentProps<typeof HugeiconsIcon>["icon"]}
                    className="me-3 h-5 w-5 shrink-0"
                  />
                )
              }

              return (
                <button
                  key={index}
                  type="button"
                  disabled={action.disabled}
                  onClick={() => {
                    action.onClick?.()
                    if (shouldClose) {
                      handleOpenChange(false)
                    }
                  }}
                  className={cn(
                    "flex w-full items-center justify-start rounded-xl px-4 py-3 min-h-12 text-sm font-medium transition-colors text-left select-none outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50",
                    isDestructive
                      ? "text-destructive bg-destructive/5 hover:bg-destructive/10 active:bg-destructive/20 focus-visible:bg-destructive/15"
                      : "text-foreground bg-muted/40 hover:bg-muted active:bg-muted/80 focus-visible:bg-muted",
                    action.className
                  )}
                >
                  {renderIcon()}
                  <div className="flex flex-col items-start flex-1 min-w-0">
                    <span className="truncate w-full">{action.label}</span>
                    {action.description && (
                      <span className="text-xs text-muted-foreground font-normal truncate w-full">
                        {action.description}
                      </span>
                    )}
                  </div>
                </button>
              )
            })}

            {children}
          </div>

          {showCancel && (
            <DrawerFooter className="pt-2 pb-6">
              <DrawerClose render={<Button variant="outline" className="w-full min-h-12 h-12 text-sm" />}>
                {cancelText}
              </DrawerClose>
            </DrawerFooter>
          )}
        </div>
      </DrawerContent>
    </Drawer>
  )
}
