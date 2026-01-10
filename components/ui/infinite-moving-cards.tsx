"use client"

import { cn } from "@/lib/utils"
import { useEffect, useState, useRef } from "react"

interface InfiniteMovingCardsProps {
  items: {
    quote: string
    name: string
    title: string
  }[]
  direction?: "left" | "right"
  speed?: "fast" | "normal" | "slow"
  pauseOnHover?: boolean
  className?: string
}

export function InfiniteMovingCards({
  items,
  direction = "left",
  speed = "normal",
  pauseOnHover = true,
  className,
}: InfiniteMovingCardsProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const scrollerRef = useRef<HTMLUListElement>(null)
  const [start, setStart] = useState(false)

  useEffect(() => {
    addAnimation()
  }, [])

  function addAnimation() {
    if (containerRef.current && scrollerRef.current) {
      const scrollerContent = Array.from(scrollerRef.current.children)

      scrollerContent.forEach((item) => {
        const duplicatedItem = item.cloneNode(true)
        if (scrollerRef.current) {
          scrollerRef.current.appendChild(duplicatedItem)
        }
      })

      getDirection()
      getSpeed()
      setStart(true)
    }
  }

  function getDirection() {
    if (containerRef.current) {
      if (direction === "left") {
        containerRef.current.style.setProperty("--animation-direction", "forwards")
      } else {
        containerRef.current.style.setProperty("--animation-direction", "reverse")
      }
    }
  }

  function getSpeed() {
    if (containerRef.current) {
      if (speed === "fast") {
        containerRef.current.style.setProperty("--animation-duration", "20s")
      } else if (speed === "normal") {
        containerRef.current.style.setProperty("--animation-duration", "40s")
      } else {
        containerRef.current.style.setProperty("--animation-duration", "80s")
      }
    }
  }

  return (
    <div
      ref={containerRef}
      className={cn(
        "scroller relative z-20 max-w-7xl overflow-hidden [mask-image:linear-gradient(to_right,transparent,white_20%,white_80%,transparent)]",
        className
      )}
    >
      <ul
        ref={scrollerRef}
        className={cn(
          "flex min-w-full shrink-0 gap-4 py-4 w-max flex-nowrap",
          start && "animate-scroll",
          pauseOnHover && "hover:[animation-play-state:paused]"
        )}
      >
        {items.map((item, idx) => (
          <li
            key={idx}
            className="w-[350px] max-w-full relative rounded-2xl border border-comfort-sage-200 bg-white px-8 py-6 md:w-[450px] flex-shrink-0 shadow-sm hover:shadow-md transition-shadow"
          >
            <blockquote>
              <div className="relative z-20 text-sm leading-relaxed text-comfort-charcoal-600 font-normal">
                &ldquo;{item.quote}&rdquo;
              </div>
              <div className="relative z-20 mt-6 flex flex-row items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-comfort-sage-400 to-comfort-sage-600 flex items-center justify-center text-white font-semibold text-sm">
                  {item.name.charAt(0)}
                </div>
                <div className="flex flex-col">
                  <span className="text-sm font-semibold text-comfort-charcoal-800">
                    {item.name}
                  </span>
                  <span className="text-xs text-comfort-charcoal-500">
                    {item.title}
                  </span>
                </div>
                <span className="ml-auto text-comfort-terracotta-400 text-sm">★★★★★</span>
              </div>
            </blockquote>
          </li>
        ))}
      </ul>
    </div>
  )
}
