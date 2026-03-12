// EasyDrive — Service Worker
// Permite notificações em background quando o app está minimizado

const CACHE_NAME = 'easydrive-v1'

// ── INSTALAÇÃO ────────────────────────────────────────────────────
self.addEventListener('install', (e) => {
  self.skipWaiting()
})

self.addEventListener('activate', (e) => {
  e.waitUntil(self.clients.claim())
})

// ── RECEBE MENSAGEM DO APP → MOSTRA NOTIFICAÇÃO ──────────────────
self.addEventListener('message', (e) => {
  if (!e.data || e.data.type !== 'SHOW_NOTIFICATION') return

  const { title, body, options = {} } = e.data

  e.waitUntil(
    self.registration.showNotification(title, {
      body,
      icon: '/icon-192.png',
      badge: '/icon-192.png',
      lang: 'pt-BR',
      ...options,
    })
  )
})

// ── CLIQUE NA NOTIFICAÇÃO → ABRE O APP ───────────────────────────
self.addEventListener('notificationclick', (e) => {
  e.notification.close()

  const tag = e.notification.tag || ''
  let path = '/'

  // Direciona para aba correta conforme o tipo
  if (tag.startsWith('goal')) path = '/?tab=stats'
  else if (tag.startsWith('loss') || tag.startsWith('highcost')) path = '/?tab=dashboard'
  else if (tag.startsWith('safety')) path = '/?tab=trip'
  else if (tag.startsWith('streak')) path = '/?tab=dashboard'

  e.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
      // Foca uma aba já aberta se existir
      for (const client of clients) {
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          client.navigate(path)
          return client.focus()
        }
      }
      // Senão abre nova aba
      if (self.clients.openWindow) {
        return self.clients.openWindow(path)
      }
    })
  )
})

// ── PUSH (futuro: backend VAPID) ─────────────────────────────────
self.addEventListener('push', (e) => {
  if (!e.data) return

  let payload
  try { payload = e.data.json() } catch { payload = { title: 'EasyDrive', body: e.data.text() } }

  e.waitUntil(
    self.registration.showNotification(payload.title || 'EasyDrive', {
      body: payload.body || '',
      icon: '/icon-192.png',
      badge: '/icon-192.png',
      tag: payload.tag || 'push',
      data: payload,
    })
  )
})
