import { AnimatePresence, useReducedMotion } from 'motion/react'
import { useId, useRef, useState, type PointerEvent, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { cn } from '@/lib/cn'
import { MotionDiv } from './motion'

const SHOW_DELAY_MS = 150
const TOUCH_VISIBLE_MS = 2500
const GAP = 8
const EDGE_ZONE = 140
const MIN_SPACE_ABOVE = 72

type Anchor = {
  top: number
  bottom: number
  left: number
  right: number
  center: number
  viewportWidth: number
}

type TooltipProps = {
  content: ReactNode
  children: ReactNode
  className?: string
}

/**
 * Hover, focus and tap tooltip. Rendered in a portal with fixed positioning, so it is never
 * clipped by scroll containers; near the viewport edges it aligns to the trigger's edge.
 */
export function Tooltip({ content, children, className }: TooltipProps) {
  const id = useId()
  const [anchor, setAnchor] = useState<Anchor | null>(null)
  // Keeps the portal mounted until the exit animation is done; closed tooltips render none.
  const [isMounted, setIsMounted] = useState(false)
  const timeoutRef = useRef<number | null>(null)
  const prefersReducedMotion = useReducedMotion() === true

  function clearTimer() {
    if (timeoutRef.current !== null) {
      window.clearTimeout(timeoutRef.current)
      timeoutRef.current = null
    }
  }

  function measure(element: HTMLElement): Anchor {
    const bounds = element.getBoundingClientRect()
    return {
      top: bounds.top,
      bottom: bounds.bottom,
      left: bounds.left,
      right: bounds.right,
      center: bounds.left + bounds.width / 2,
      viewportWidth: window.innerWidth,
    }
  }

  function show(element: HTMLElement, delay: number) {
    clearTimer()
    timeoutRef.current = window.setTimeout(() => {
      timeoutRef.current = null
      setIsMounted(true)
      setAnchor(measure(element))
    }, delay)
  }

  function hide() {
    clearTimer()
    setAnchor(null)
  }

  function handlePointerEnter(event: PointerEvent<HTMLSpanElement>) {
    if (event.pointerType === 'touch') return
    show(event.currentTarget, SHOW_DELAY_MS)
  }

  function handlePointerDown(event: PointerEvent<HTMLSpanElement>) {
    if (event.pointerType !== 'touch') {
      // A press starts a click or drag; the tooltip would be in the way.
      hide()
      return
    }
    setIsMounted(true)
    setAnchor(measure(event.currentTarget))
    clearTimer()
    timeoutRef.current = window.setTimeout(hide, TOUCH_VISIBLE_MS)
  }

  const placeAbove = anchor !== null && anchor.top >= MIN_SPACE_ABOVE
  const align =
    anchor === null
      ? 'center'
      : anchor.center < EDGE_ZONE
        ? 'left'
        : anchor.center > anchor.viewportWidth - EDGE_ZONE
          ? 'right'
          : 'center'

  return (
    <span
      className={cn('inline-flex', className)}
      aria-describedby={anchor ? id : undefined}
      onPointerEnter={handlePointerEnter}
      onPointerLeave={(event) => {
        if (event.pointerType !== 'touch') hide()
      }}
      onPointerDown={handlePointerDown}
      onFocus={(event) => show(event.currentTarget, 0)}
      onBlur={hide}
    >
      {children}
      {isMounted &&
        createPortal(
          <AnimatePresence
            onExitComplete={() => {
              // Reopened while fading out: keep the portal.
              if (anchor === null) setIsMounted(false)
            }}
          >
            {anchor && (
              <div
                className="pointer-events-none fixed z-50 flex"
                style={{
                  top: placeAbove ? anchor.top - GAP : anchor.bottom + GAP,
                  left: align === 'left' ? Math.max(anchor.left, GAP) : undefined,
                  right:
                    align === 'right'
                      ? Math.max(anchor.viewportWidth - anchor.right, GAP)
                      : undefined,
                  ...(align === 'center' ? { left: anchor.center } : {}),
                }}
              >
                <MotionDiv
                  id={id}
                  role="tooltip"
                  className="max-w-72 rounded-md bg-zinc-900 px-2.5 py-1.5 text-xs/5 font-medium text-white shadow-lg"
                  style={{
                    x: align === 'center' ? '-50%' : 0,
                    transformOrigin: placeAbove ? 'bottom' : 'top',
                  }}
                  initial={{ opacity: 0, y: placeAbove ? '-90%' : '-10%', scale: 0.96 }}
                  animate={{ opacity: 1, y: placeAbove ? '-100%' : '0%', scale: 1 }}
                  exit={{ opacity: 0, scale: 0.96 }}
                  transition={{ duration: prefersReducedMotion ? 0 : 0.14, ease: 'easeOut' }}
                >
                  {content}
                </MotionDiv>
              </div>
            )}
          </AnimatePresence>,
          document.body,
        )}
    </span>
  )
}
