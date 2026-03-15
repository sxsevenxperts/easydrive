# 🚕 Integração 99/Uber — Sincronização de Viagens

## 📋 Visão Geral

EasyDrive agora integra com **99 Táxi** e **Uber** para:
- ✅ Pegar dados de viagens ativas em tempo real
- ✅ Monitorar localização do motorista
- ✅ Rastrear distância, ETA, tarifa
- ✅ Sincronizar automaticamente com o store

---

## 🔌 Setup

### 1. Obter Token API

#### 99 Táxi:
```bash
# Credentials
API_TOKEN=seu_token_99
API_BASE_URL=https://api.99taxi.com
```

#### Uber:
```bash
# Credentials
API_TOKEN=seu_token_uber
API_BASE_URL=https://api.uber.com/v1
```

### 2. Adicionar ao .env

```env
# .env.local
VITE_RIDESHARE_TOKEN=seu_token_aqui
VITE_RIDESHARE_API=https://api.99taxi.com  # ou uber
VITE_RIDESHARE_WEBHOOK=wss://api.99taxi.com/ws/trips
```

---

## 🔄 Polling vs WebSocket

### Opção 1: Polling (Simples) — 5s de intervalo
```javascript
import { useSyncRideShare } from '@/utils/rideshare-sync'

export default function App() {
  const tripId = 'trip-12345'
  const apiToken = import.meta.env.VITE_RIDESHARE_TOKEN

  // Auto-sincroniza a cada 5 segundos
  useSyncRideShare(tripId, apiToken)

  return <TripStatus />
}
```

**Prós:** Simples, sem dependências
**Contras:** ~2s de latência, mais requisições

### Opção 2: WebSocket (Recomendado) — Tempo Real
```javascript
import { setupRideShareWebhook } from '@/utils/rideshare-sync'

export default function App() {
  useEffect(() => {
    const ws = setupRideShareWebhook(
      'trip-12345',
      import.meta.env.VITE_RIDESHARE_TOKEN
    )

    return () => ws.close()
  }, [])

  return <TripStatus />
}
```

**Prós:** Tempo real, menos requisições
**Contras:** Requer suporte WebSocket na API

---

## 📊 Estrutura de Dados

### Viagem Ativa (da 99/Uber)
```javascript
{
  trip: {
    id: "trip-123",
    status: "ongoing",                    // ongoing | completed | cancelled

    // Localizações
    pickup: {
      lat: -23.5505,
      lon: -46.6333,
      address: "Rua A, 100 - São Paulo"
    },
    destination: {
      lat: -23.5605,
      lon: -46.6433,
      address: "Rua B, 200 - Rio de Janeiro"
    },

    // Motorista
    driver: {
      id: "driver-456",
      name: "João Silva",
      phone: "+5511999999999",
      rating: 4.8,
      vehicle_id: "vehicle-789"
    },

    // Passageiro
    passenger: {
      id: "passenger-111",
      name: "Maria Santos",
      phone: "+5511988888888"
    },

    // Veículo
    vehicle: {
      id: "vehicle-789",
      model: "Honda Civic 2023",
      plate: "ABC-1234",
      color: "Preto"
    },

    // Tarifa
    fare: {
      base: 10.00,           // R$10
      distance: 8.75,        // R$8.75 (3.5km × 2.5/km)
      surge: 0,              // Surge pricing
      total: 18.75           // Total
    },

    // Métricas
    eta_minutes: 12,         // Tempo estimado
    distance_km: 3.5,        // Distância total
    duration_seconds: 120,   // Tempo decorrido

    // Timestamps
    startTime: 1705000000000,
    currentLocation: {
      lat: -23.5550,
      lon: -23.5550,
      ts: 1705000060000
    }
  }
}
```

---

## 🔄 Fluxo de Sincronização

```
┌─ API 99/Uber ──────────────┐
│  (WebSocket ou Polling)    │
└────────────┬────────────────┘
             │
             ↓
┌─ syncRideShareToStore() ───┐
│  ✓ Atualiza location       │
│  ✓ Atualiza activeTrip     │
│  ✓ Atualiza vehicle        │
└────────────┬────────────────┘
             │
             ↓
┌─ Zustand Store ────────────┐
│  location: { lat, lon }    │
│  activeTrip: { ... }       │
│  settings.vehicle: { ... } │
└────────────┬────────────────┘
             │
             ↓
┌─ UI Components ────────────┐
│  ✓ TripStatus              │
│  ✓ RouteMapImproved        │
│  ✓ POIAlertsList           │
│  ✓ QuickExpenses           │
└────────────────────────────┘
```

---

## 🎯 Exemplo Completo

```javascript
import React, { useEffect } from 'react'
import { useStore } from '@/store'
import { setupRideShareWebhook } from '@/utils/rideshare-sync'

// Componentes
import TripStatus from '@/components/TripStatus'
import RouteMapImproved from '@/components/RouteMapImproved'
import POIAlertsList from '@/components/POIAlertsList'

export default function App() {
  const { location, activeTrip, poiAlerts } = useStore()
  const tripId = new URLSearchParams(location.search).get('trip_id')
  const apiToken = import.meta.env.VITE_RIDESHARE_TOKEN

  // Conectar WebSocket quando tem trip_id
  useEffect(() => {
    if (!tripId || !apiToken) return

    console.log('🚕 Conectando com viagem:', tripId)
    const ws = setupRideShareWebhook(tripId, apiToken)

    return () => {
      console.log('🔌 Desconectando WebSocket')
      ws.close()
    }
  }, [tripId, apiToken])

  // Se não tem viagem, mostrar tela inicial
  if (!activeTrip) {
    return (
      <div style={{ padding: '40px', textAlign: 'center', color: '#fff' }}>
        <h2>Aguardando viagem...</h2>
        <p>Abra EasyDrive com um trip_id válido</p>
        <p>Exemplo: ?trip_id=trip-123</p>
      </div>
    )
  }

  // Viagem ativa: mostrar tudo
  return (
    <div style={{ padding: '20px', maxWidth: 900, margin: '0 auto' }}>
      <TripStatus />
      <RouteMapImproved
        currentLocation={location}
        destination={activeTrip.destination}
        currentCity="São Paulo"
      />
      {poiAlerts.length > 0 && <POIAlertsList alerts={poiAlerts} />}
    </div>
  )
}
```

### URLs Exemplo

```
# Polling (99)
http://localhost:5173/?trip_id=trip-123&provider=99

# WebSocket (Uber)
http://localhost:5173/?trip_id=trip-456&provider=uber
```

---

## 🔐 Autenticação

### Token Storage
```javascript
// Seguro: guardar em localStorage com expiração
localStorage.setItem('rideshare_token', token)
localStorage.setItem('rideshare_token_expires', Date.now() + 3600000) // 1h

// Verificar antes de usar
function getValidToken() {
  const token = localStorage.getItem('rideshare_token')
  const expires = localStorage.getItem('rideshare_token_expires')

  if (!token || Date.now() > expires) {
    // Token expirado, redirecionar para login
    window.location.href = '/login'
    return null
  }

  return token
}
```

---

## ✅ Checklist Integração

- [ ] Obter API tokens (99/Uber)
- [ ] Adicionar variáveis de ambiente
- [ ] Testar WebSocket connection
- [ ] Validar estrutura de dados (trip)
- [ ] Sincronizar location em tempo real
- [ ] Mostrar TripStatus correto
- [ ] Abrir Waze automaticamente
- [ ] Rastreamento POI funcionando
- [ ] Despesas sincronizando
- [ ] SOS compartilhando localização correta

---

## 🐛 Debug WebSocket

```javascript
// Em browser console:
const ws = new WebSocket('wss://api.99taxi.com/ws/trips')

ws.addEventListener('open', () => {
  console.log('✓ Conectado')
  ws.send(JSON.stringify({
    action: 'subscribe',
    trip_id: 'trip-123',
    token: 'seu_token'
  }))
})

ws.addEventListener('message', (e) => {
  console.log('📨 Mensagem:', JSON.parse(e.data))
})

ws.addEventListener('error', (e) => {
  console.error('❌ Erro:', e)
})
```

---

## 📝 Notas

- **Latência:** WebSocket ~100ms, Polling ~2-5s
- **Banda:** WebSocket melhor (push), Polling pior (pull)
- **Custo API:** Ambos cobram por requisição
- **Fallback:** Se WebSocket falhar, usar polling
- **Timeout:** Desconectar após 1h de inatividade

---

**Status:** ✅ Pronto para integração
**Próximo:** Fazer teste com 99/Uber API
