import { useEffect, useRef, useState } from 'react'

/** Avoids flashing a spinner for fast work and prevents a shown spinner from flickering away. */
export function useDelayedBusy(active: boolean, delayMs = 200, minimumVisibleMs = 350) {
  const [visible, setVisible] = useState(false)
  const shownAt = useRef(0)

  useEffect(() => {
    let timer: number | undefined
    if (active && !visible) {
      timer = window.setTimeout(() => {
        shownAt.current = performance.now()
        setVisible(true)
      }, delayMs)
    } else if (!active && visible) {
      const remaining = Math.max(0, minimumVisibleMs - (performance.now() - shownAt.current))
      timer = window.setTimeout(() => setVisible(false), remaining)
    }
    return () => window.clearTimeout(timer)
  }, [active, delayMs, minimumVisibleMs, visible])

  return visible
}
