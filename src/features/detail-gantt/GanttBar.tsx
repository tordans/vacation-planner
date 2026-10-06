import { useReducedMotion } from 'motion/react'
import type { KeyboardEvent, PointerEvent, ReactNode } from 'react'
import { MotionDiv } from '@/components/ui/motion'
import { Tooltip } from '@/components/ui/tooltip'
import { cn } from '@/lib/cn'

type GanttBarProps = {
  box: { left: number; width: number; clippedStart: boolean; clippedEnd: boolean }
  label: ReactNode
  tooltip: ReactNode
  ariaLabel: string
  className?: string
  isSelected: boolean
  /** True while this bar follows the pointer: no easing, it must stick to the cursor. */
  isDragging: boolean
  onMoveStart: (event: PointerEvent<HTMLDivElement>) => void
  onResizeStart: (event: PointerEvent<HTMLDivElement>) => void
  onResizeEnd: (event: PointerEvent<HTMLDivElement>) => void
  onKeyDown: (event: KeyboardEvent<HTMLDivElement>) => void
}

const handleClass =
  'absolute top-1/2 z-10 h-6 w-2 -translate-y-1/2 cursor-ew-resize touch-none rounded-full bg-white shadow-sm ring-1 ring-zinc-900/40 select-none'

/** An editable bar: drag the body to move, the pills at both ends to resize. */
export function GanttBar({
  box,
  label,
  tooltip,
  ariaLabel,
  className,
  isSelected,
  isDragging,
  onMoveStart,
  onResizeStart,
  onResizeEnd,
  onKeyDown,
}: GanttBarProps) {
  const prefersReducedMotion = useReducedMotion() === true
  return (
    <MotionDiv
      role="button"
      tabIndex={0}
      aria-label={ariaLabel}
      aria-pressed={isSelected}
      className={cn(
        'group/bar absolute inset-y-1.5 z-10 cursor-grab touch-none rounded-md text-xs font-medium text-white shadow-sm outline-none select-none focus-visible:ring-2 focus-visible:ring-zinc-900 focus-visible:ring-offset-1 active:cursor-grabbing',
        box.clippedStart && 'rounded-l-none',
        box.clippedEnd && 'rounded-r-none',
        isSelected && 'ring-2 ring-zinc-900 ring-offset-1',
        className,
      )}
      initial={false}
      animate={{ left: box.left, width: box.width }}
      transition={
        isDragging || prefersReducedMotion
          ? { duration: 0 }
          : { type: 'spring', stiffness: 520, damping: 42 }
      }
      onPointerDown={onMoveStart}
      onKeyDown={onKeyDown}
    >
      <Tooltip className="size-full items-center overflow-hidden px-2" content={tooltip}>
        <span className="truncate">{label}</span>
      </Tooltip>
      {!box.clippedStart && (
        <div
          className={cn(
            handleClass,
            'left-0 -translate-x-1/2',
            !isSelected && 'fine-pointer:opacity-0 fine-pointer:group-hover/bar:opacity-100',
          )}
          onPointerDown={onResizeStart}
        />
      )}
      {!box.clippedEnd && (
        <div
          className={cn(
            handleClass,
            'right-0 translate-x-1/2',
            !isSelected && 'fine-pointer:opacity-0 fine-pointer:group-hover/bar:opacity-100',
          )}
          onPointerDown={onResizeEnd}
        />
      )}
    </MotionDiv>
  )
}
