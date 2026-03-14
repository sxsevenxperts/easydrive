import { useEffect } from 'react'
import { useStore } from '../store'
import { getPermissionStatus } from '../utils/notifications'
import { addToastAlert } from '../utils/notifications'

export function useFatigueAlert() {
  useEffect(() => {
    if (getPermissionStatus() !== 'granted') return

    const { tripStatus, activeTrip, settings } = useStore.getState()

    // Só checa durante viagem ativa
    if (tripStatus !== 'trip' || !activeTrip?.startTime) return

    const checkFatigue = () => {
      const now = Date.now()
      const startTime = activeTrip.startTime
      const drivingTimeMs = now - startTime

      // Converte para horas (descontando pausas)
      const drivingHours = drivingTimeMs / (1000 * 60 * 60)

      const fatigueAlertHours = settings.fatigueAlertHours || 6

      // Se ultrapassou o limite de horas dirigindo
      if (drivingHours >= fatigueAlertHours) {
        const key = `fatigue-${new Date(now).toDateString()}-${Math.floor(drivingHours)}`

        // Evita disparar multiple vezes
        if (!window.__fatigueAlertCache) window.__fatigueAlertCache = {}
        if (window.__fatigueAlertCache[key]) return

        window.__fatigueAlertCache[key] = true

        // Toast + Push notification
        addToastAlert(
          `⏰ Você já dirigiu ${Math.floor(drivingHours)} horas!`,
          'Faça uma pausa de pelo menos 15 minutos. Sua segurança é nossa prioridade.',
          'warning',
          7000
        )

        // Push notification
        const { NOTIFY } = require('../utils/notifications')
        NOTIFY.fatigueAlert(Math.floor(drivingHours))
      }
    }

    // Verifica a cada 5 minutos
    const intervalId = setInterval(checkFatigue, 5 * 60 * 1000)

    // Checa imediatamente na primeira vez
    checkFatigue()

    return () => clearInterval(intervalId)
  }, [])
}
