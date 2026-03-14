import { useEffect, useRef, useState } from 'react'
import { AlertTriangle, Phone, X } from 'lucide-react'
import { initiateEmergencyCall, getGoogleMapsShareLink } from '../utils/sos'
import { useStore } from '../store'

export default function SOSModal({ isOpen, onClose, currentLocation, emergencyContact, otherContacts = [] }) {
  const [holdProgress, setHoldProgress] = useState(0)
  const [isHolding, setIsHolding] = useState(false)
  const [sosType, setSOSType] = useState(null)
  const [shared, setShared] = useState(false)
  const holdTimerRef = useRef(null)

  const handleSOSPress = (type) => {
    setSOSType(type)
    setIsHolding(true)
    setHoldProgress(0)

    let progress = 0
    holdTimerRef.current = setInterval(() => {
      progress += 5
      setHoldProgress(progress)

      if (progress >= 100) {
        clearInterval(holdTimerRef.current)
        handleSOSConfirm(type)
      }
    }, 50) // 100 * 50ms = 5 segundos
  }

  const handleSOSRelease = () => {
    if (holdTimerRef.current) {
      clearInterval(holdTimerRef.current)
    }
    setIsHolding(false)
    setHoldProgress(0)
    setSOSType(null)
  }

  const handleSOSConfirm = (type) => {
    clearInterval(holdTimerRef.current)

    // Log do SOS no store
    useStore.getState().addAlert({
      title: `🚨 SOS ${type === '190' ? 'POLÍCIA' : 'SAMU'} ACIONADO!`,
      message: `Chamando ${type} com sua localização...`,
      type: 'error',
      duration: 7000,
    })

    // Compartilha localização
    const locationUrl = getGoogleMapsShareLink(currentLocation)
    if (navigator.share && locationUrl) {
      navigator.share({
        title: `🚨 SOS - ${type === '190' ? 'POLÍCIA' : 'SAMU'}`,
        text: `Emergência! Minha localização: ${locationUrl}`,
        url: locationUrl,
      }).catch(() => {
        // Fallback: copia para clipboard
        navigator.clipboard.writeText(locationUrl)
      })
    }

    // Inicia chamada
    initiateEmergencyCall(type, currentLocation)

    setShared(true)
    setSOSType(null)

    // Fecha o modal após 2 segundos
    setTimeout(() => {
      setShared(false)
      onClose()
    }, 2000)
  }

  if (!isOpen) return null

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: 'rgba(0,0,0,0.7)',
        display: 'flex',
        alignItems: 'flex-end',
        zIndex: 9999,
      }}
      onClick={onClose}
    >
      <div
        style={{
          width: '100%',
          background: 'var(--bg)',
          borderRadius: '24px 24px 0 0',
          padding: '24px 16px 32px',
          boxShadow: '0 -4px 24px rgba(0,0,0,0.3)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            marginBottom: 20,
            justifyContent: 'center',
          }}
        >
          <AlertTriangle size={28} color='#ef4444' />
          <h2 style={{ fontSize: 24, fontWeight: 800, color: '#ef4444', margin: 0 }}>EMERGÊNCIA</h2>
          <button
            onClick={onClose}
            style={{
              position: 'absolute',
              right: 16,
              top: 16,
              background: 'none',
              border: 'none',
              color: 'var(--text3)',
              cursor: 'pointer',
              padding: 0,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <X size={20} />
          </button>
        </div>

        {/* Status */}
        {shared ? (
          <div
            style={{
              background: '#22c55e12',
              border: '1px solid #22c55e40',
              borderRadius: 12,
              padding: '16px',
              marginBottom: 20,
              textAlign: 'center',
            }}
          >
            <p style={{ fontSize: 14, color: '#22c55e', fontWeight: 700, margin: 0 }}>
              ✅ SOS enviado com sucesso!
            </p>
            <p style={{ fontSize: 12, color: 'var(--text3)', margin: '4px 0 0', lineHeight: 1.4 }}>
              Sua localização foi compartilhada. Ajuda está a caminho.
            </p>
          </div>
        ) : (
          <>
            <p style={{ fontSize: 13, color: 'var(--text2)', marginBottom: 24, textAlign: 'center', lineHeight: 1.5 }}>
              Escolha qual emergência precisa. Mantenha pressionado por 5 segundos para confirmar.
            </p>

            {/* Localização */}
            {currentLocation && (
              <div
                style={{
                  background: 'var(--bg3)',
                  border: '1px solid var(--border)',
                  borderRadius: 12,
                  padding: '10px 14px',
                  marginBottom: 20,
                  display: 'flex',
                  gap: 8,
                  alignItems: 'center',
                }}
              >
                <span style={{ fontSize: 16 }}>📍</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ fontSize: 11, color: 'var(--text3)', fontWeight: 700, margin: 0 }}>LOCALIZAÇÃO</p>
                  <p
                    style={{
                      fontSize: 12,
                      color: 'var(--text)',
                      margin: '2px 0 0',
                      wordBreak: 'break-all',
                    }}
                  >
                    {currentLocation.lat.toFixed(6)}, {currentLocation.lon.toFixed(6)}
                  </p>
                </div>
              </div>
            )}

            {/* Botões SOS */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: otherContacts.length > 0 ? 'repeat(auto-fit, minmax(140px, 1fr))' : '1fr 1fr',
                gap: 12,
                marginBottom: 16,
              }}
            >
              {/* POLÍCIA 190 */}
              <div
                onMouseDown={() => handleSOSPress('190')}
                onMouseUp={handleSOSRelease}
                onMouseLeave={handleSOSRelease}
                onTouchStart={() => handleSOSPress('190')}
                onTouchEnd={handleSOSRelease}
                style={{
                  position: 'relative',
                  borderRadius: 16,
                  overflow: 'hidden',
                  cursor: sosType === '190' ? 'grabbing' : 'grab',
                  userSelect: 'none',
                }}
              >
                <button
                  style={{
                    width: '100%',
                    padding: '20px',
                    background: sosType === '190' ? '#f87171' : '#ef4444',
                    border: 'none',
                    borderRadius: 16,
                    color: '#fff',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: 8,
                    cursor: 'inherit',
                    fontWeight: 800,
                    fontSize: 16,
                    transition: 'all 0.1s',
                    transform: sosType === '190' ? 'scale(0.98)' : 'scale(1)',
                  }}
                  disabled={isHolding && sosType !== '190'}
                >
                  <Phone size={24} />
                  <div style={{ fontSize: 13 }}>POLÍCIA</div>
                  <div style={{ fontSize: 12, fontWeight: 600 }}>190</div>
                </button>

                {/* Progress bar */}
                {sosType === '190' && (
                  <div
                    style={{
                      position: 'absolute',
                      bottom: 0,
                      left: 0,
                      width: `${holdProgress}%`,
                      height: 4,
                      background: '#fbbf24',
                      transition: 'width 0.05s linear',
                    }}
                  />
                )}
              </div>

              {/* SAMU 192 */}
              <div
                onMouseDown={() => handleSOSPress('192')}
                onMouseUp={handleSOSRelease}
                onMouseLeave={handleSOSRelease}
                onTouchStart={() => handleSOSPress('192')}
                onTouchEnd={handleSOSRelease}
                style={{
                  position: 'relative',
                  borderRadius: 16,
                  overflow: 'hidden',
                  cursor: sosType === '192' ? 'grabbing' : 'grab',
                  userSelect: 'none',
                }}
              >
                <button
                  style={{
                    width: '100%',
                    padding: '20px',
                    background: sosType === '192' ? '#7f1d1d' : '#991b1b',
                    border: 'none',
                    borderRadius: 16,
                    color: '#fff',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: 8,
                    cursor: 'inherit',
                    fontWeight: 800,
                    fontSize: 16,
                    transition: 'all 0.1s',
                    transform: sosType === '192' ? 'scale(0.98)' : 'scale(1)',
                  }}
                  disabled={isHolding && sosType !== '192'}
                >
                  <Phone size={24} />
                  <div style={{ fontSize: 13 }}>SAMU</div>
                  <div style={{ fontSize: 12, fontWeight: 600 }}>192</div>
                </button>

                {/* Progress bar */}
                {sosType === '192' && (
                  <div
                    style={{
                      position: 'absolute',
                      bottom: 0,
                      left: 0,
                      width: `${holdProgress}%`,
                      height: 4,
                      background: '#fbbf24',
                      transition: 'width 0.05s linear',
                    }}
                  />
                )}
              </div>

              {/* Contatos adicionais cadastrados */}
              {otherContacts.map((contact, idx) => (
                <div
                  key={idx}
                  onMouseDown={() => handleSOSPress(contact.phone)}
                  onMouseUp={handleSOSRelease}
                  onMouseLeave={handleSOSRelease}
                  onTouchStart={() => handleSOSPress(contact.phone)}
                  onTouchEnd={handleSOSRelease}
                  style={{
                    position: 'relative',
                    borderRadius: 16,
                    overflow: 'hidden',
                    cursor: sosType === contact.phone ? 'grabbing' : 'grab',
                    userSelect: 'none',
                  }}
                >
                  <button
                    style={{
                      width: '100%',
                      padding: '16px 8px',
                      background: sosType === contact.phone ? '#7c3aed' : '#a855f7',
                      border: 'none',
                      borderRadius: 16,
                      color: '#fff',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      gap: 6,
                      cursor: 'inherit',
                      fontWeight: 700,
                      fontSize: 13,
                      transition: 'all 0.1s',
                      transform: sosType === contact.phone ? 'scale(0.98)' : 'scale(1)',
                    }}
                    disabled={isHolding && sosType !== contact.phone}
                  >
                    <Phone size={18} />
                    <div style={{ fontSize: 11, textAlign: 'center', lineHeight: 1.2 }}>{contact.name}</div>
                    <div style={{ fontSize: 10, fontWeight: 600, opacity: 0.8 }}>{contact.phone}</div>
                  </button>

                  {/* Progress bar */}
                  {sosType === contact.phone && (
                    <div
                      style={{
                        position: 'absolute',
                        bottom: 0,
                        left: 0,
                        width: `${holdProgress}%`,
                        height: 4,
                        background: '#fbbf24',
                        transition: 'width 0.05s linear',
                      }}
                    />
                  )}
                </div>
              ))}
            </div>

            {/* Informação de contato de emergência */}
            {emergencyContact?.phone && (
              <div
                style={{
                  background: '#0f172a80',
                  border: '1px solid #475569',
                  borderRadius: 10,
                  padding: '10px 12px',
                  fontSize: 11,
                  color: 'var(--text3)',
                  textAlign: 'center',
                }}
              >
                📞 Contato de emergência: {emergencyContact.phone}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
