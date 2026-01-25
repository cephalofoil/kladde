"use client"

import * as React from "react"
import * as TabsPrimitive from "@radix-ui/react-tabs"

import { cn } from "@/lib/utils"

const Tabs = TabsPrimitive.Root

type TabsChildProps = {
  onTabChange?: (value: string) => void
}

const TabsList = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.List>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.List>
>(({ className, children, ...props }, ref) => {
  const [activeTab, setActiveTab] = React.useState<string>("")
  const [highlightStyle, setHighlightStyle] = React.useState<React.CSSProperties>({})
  const listRef = React.useRef<HTMLDivElement>(null)
  const initializedRef = React.useRef(false)

  React.useEffect(() => {
    const listNode = listRef.current
    if (!listNode) return

    const getActiveButton = () =>
      listNode.querySelector<HTMLButtonElement>("[data-state='active']")
    const updateHighlight = () => {
      const activeButton = getActiveButton()
      if (activeButton) {
        const listRect = listNode.getBoundingClientRect()
        const buttonRect = activeButton.getBoundingClientRect()

        setHighlightStyle({
          width: buttonRect.width,
          height: buttonRect.height,
          transform: `translateX(${buttonRect.left - listRect.left}px)`,
        })
      }
    }

    if (!activeTab && !initializedRef.current) {
      const activeButton = getActiveButton()
      const nextValue =
        activeButton?.getAttribute("data-value") ||
        activeButton?.getAttribute("value") ||
        ""
      if (nextValue) {
        setActiveTab(nextValue)
        initializedRef.current = true
      }
    } else if (activeTab) {
      updateHighlight()
    }

    window.addEventListener('resize', updateHighlight)
    return () => window.removeEventListener('resize', updateHighlight)
  }, [activeTab])

  return (
    <TabsPrimitive.List
      ref={(node) => {
        if (typeof ref === 'function') ref(node)
        else if (ref) ref.current = node
        if (node) (listRef as React.MutableRefObject<HTMLDivElement>).current = node
      }}
      className={cn(
        "relative inline-flex h-9 w-fit items-center justify-center gap-1 text-muted-foreground",
        className
      )}
      {...props}
    >
      {activeTab && (
        <div
          className="absolute z-0 top-0 left-0 rounded-md bg-secondary transition-all duration-500 ease-out"
          style={highlightStyle}
        />
      )}
      {React.Children.map(children, (child) => {
        if (React.isValidElement(child)) {
          return React.cloneElement(child as React.ReactElement<TabsChildProps>, {
            onTabChange: setActiveTab,
          })
        }
        return child
      })}
    </TabsPrimitive.List>
  )
})
TabsList.displayName = TabsPrimitive.List.displayName

const TabsTrigger = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.Trigger>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.Trigger> & {
    onTabChange?: (value: string) => void
  }
>(({ className, onTabChange, value, ...props }, ref) => {
  return (
    <TabsPrimitive.Trigger
      ref={ref}
      value={value}
      className={cn(
        "relative z-10 inline-flex h-full items-center justify-center gap-1.5 rounded-md px-3 py-1 text-sm font-medium whitespace-nowrap transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 data-[state=active]:text-foreground data-[state=inactive]:text-muted-foreground",
        className
      )}
      onMouseDown={() => {
        if (value && onTabChange) {
          onTabChange(value as string)
        }
      }}
      {...props}
    />
  )
})
TabsTrigger.displayName = TabsPrimitive.Trigger.displayName

const TabsContent = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.Content>
>(({ className, ...props }, ref) => (
  <TabsPrimitive.Content
    ref={ref}
    className={cn(
      "mt-4 ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 data-[state=active]:animate-in data-[state=active]:fade-in-0 data-[state=active]:zoom-in-95 transition-all duration-200",
      className
    )}
    {...props}
  />
))
TabsContent.displayName = TabsPrimitive.Content.displayName

export { Tabs, TabsList, TabsTrigger, TabsContent }
