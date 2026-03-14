// EasyDrive — Sistema SOS de Emergência
// Integra chamadas para emergência + compartilhamento de localização

export function initiateEmergencyCall(number, location, name = 'Motorista EasyDrive') {
  // Monta mensagem com localização
  const locationUrl = location?.lat && location?.lon
    ? `https://maps.google.com/?q=${location.lat},${location.lon}`
    : ''

  // Normaliza o número (remove caracteres especiais)
  const normalizedNumber = number.replace(/\D/g, '')

  // Disca o número
  if (normalizedNumber) {
    window.location.href = `tel:${normalizedNumber}`
  }

  // Se houver suporte a compartilhamento nativo, compartilha localização
  if (navigator.share && locationUrl) {
    setTimeout(() => {
      const typeLabel = number === '190' ? 'POLÍCIA' : number === '192' ? 'SAMU' : name || 'SOS'
      navigator.share({
        title: `🚨 SOS - ${typeLabel}`,
        text: `Localização de emergência: ${locationUrl}`,
        url: locationUrl,
      }).catch(() => {
        // Fallback: copia link para clipboard
        navigator.clipboard.writeText(locationUrl).catch(() => {})
      })
    }, 500)
  }

  return { number, timestamp: Date.now(), location }
}

export function formatEmergencyLocation(location) {
  if (!location?.lat || !location?.lon) return 'Localização indisponível'
  return `${location.lat.toFixed(6)}, ${location.lon.toFixed(6)}`
}

export function getGoogleMapsShareLink(location) {
  if (!location?.lat || !location?.lon) return null
  return `https://maps.google.com/?q=${location.lat},${location.lon}`
}

export function getWhatsAppEmergencyLink(emergencyContact, location, type = '190') {
  if (!emergencyContact?.phone) return null
  const typeLabel = type === '190' ? 'POLÍCIA' : 'SAMU'
  const locationUrl = getGoogleMapsShareLink(location)
  const message = encodeURIComponent(
    `🚨 SOS - ${typeLabel}\n\nMinha localização: ${locationUrl}\n\nEstou em emergência! Por favor, me socorra!\n\n(Mensagem enviada via EasyDrive)`
  )
  return `https://wa.me/${emergencyContact.phone}?text=${message}`
}
