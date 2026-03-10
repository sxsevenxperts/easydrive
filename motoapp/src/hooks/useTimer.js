import { useState, useEffect, useRef } from 'react'
import { useStore } from '../store'

// Rastreia tempo: rodando, parado (< 5km/h), ocioso (sem viagem), pausado
export function useTimer() {
  const { tripStatus, activeTrip } = useStore()
  const [elapsed, setElapsed] = useState({ total: 0, moving: 0, stopped: 0, idle: 0, paused: 0 })
  const intervalRef = useRef(null)
  const startRef = useRef(Date.now())
  const snapshotRef = useRef({ total: 0, moving: 0, stopped: 0, idle: 0, paused: 0 })

  useEffect(() => {
    if (!activeTrip) {
      setElapsed({ total: 0, moving: 0, stopped: 0, idle: 0, paused: 0 })
      snapshotRef.current = { total: 0, moving: 0, stopped: 0, idle: 0, paused: 0 }
      return
    }

    startRef.current = Date.now()

    intervalRef.current = setInterval(() => {
      const delta = 1000 // 1 segundo
      setElapsed((prev) => {
        const next = { ...prev, total: prev.total + delta }
        if (tripStatus === 'waiting') next.idle = prev.idle + delta
        else if (tripStatus === 'paused') next.paused = prev.paused + delta
        else if (tripStatus === 'trip') {
          // diferencia movendo vs parado pelo campo km (simplificado)
          next.moving = prev.moving + delta
        }
        return next
      })
    }, 1000)

    return () => clearInterval(intervalRef.current)
  }, [activeTrip?.id, tripStatus])

  return elapsed
}
