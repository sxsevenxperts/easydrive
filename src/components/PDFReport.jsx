import { useState } from 'react'
import { X, Download } from 'lucide-react'
import { getMonthYear, getMonthStats, formatCurrency, formatKm } from '../utils/pdf'
import { fmt } from '../utils/format'

export default function PDFReport({ isOpen, onClose, trips, expenses, settings }) {
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth())
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear())

  if (!isOpen) return null

  const stats = getMonthStats(trips, expenses, selectedMonth, selectedYear)
  const monthName = new Date(selectedYear, selectedMonth).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })

  const handlePrint = () => {
    window.print()
  }

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      background: 'rgba(0,0,0,0.7)',
      display: 'flex',
      alignItems: 'flex-end',
      zIndex: 9998,
    }} onClick={onClose}>
      <div style={{
        width: '100%',
        maxHeight: '95vh',
        overflow: 'auto',
        background: 'var(--bg)',
        borderRadius: '20px 20px 0 0',
        padding: '20px 16px 32px',
      }} onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <h2 style={{ fontSize: 20, fontWeight: 800, color: 'var(--text)', margin: 0 }}>📄 Relatório Mensal</h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--text3)', cursor: 'pointer', fontSize: 20 }}>
            <X size={24} />
          </button>
        </div>

        {/* Seletor de Mês/Ano */}
        <div style={{ display: 'flex', gap: 12, marginBottom: 20 }}>
          <select value={selectedMonth} onChange={(e) => setSelectedMonth(parseInt(e.target.value))} style={{
            padding: '8px 12px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg3)', color: 'var(--text)', fontSize: 13,
          }}>
            {Array.from({ length: 12 }).map((_, i) => (
              <option key={i} value={i}>
                {new Date(selectedYear, i).toLocaleDateString('pt-BR', { month: 'long' })}
              </option>
            ))}
          </select>

          <select value={selectedYear} onChange={(e) => setSelectedYear(parseInt(e.target.value))} style={{
            padding: '8px 12px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg3)', color: 'var(--text)', fontSize: 13,
          }}>
            {[selectedYear - 2, selectedYear - 1, selectedYear, selectedYear + 1].map((year) => (
              <option key={year} value={year}>{year}</option>
            ))}
          </select>

          <button onClick={handlePrint} style={{
            background: '#22c55e', border: 'none', borderRadius: 8, color: '#fff', fontWeight: 700, fontSize: 13,
            padding: '9px 14px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, whiteSpace: 'nowrap',
          }}>
            <Download size={16} /> Imprimir/PDF
          </button>
        </div>

        {/* ═══════ RELATÓRIO PRINTÁVEL ═══════ */}
        <div id='pdf-report' style={{
          background: 'var(--bg2)', borderRadius: 12, padding: 20, marginBottom: 20,
          pageBreakAfter: 'auto',
        }} className='print-section'>

          {/* Header Relatório */}
          <div style={{ marginBottom: 24, textAlign: 'center', paddingBottom: 16, borderBottom: '2px solid var(--border)' }}>
            <h1 style={{ fontSize: 24, fontWeight: 900, color: 'var(--text)', margin: 0 }}>📊 EasyDrive</h1>
            <p style={{ fontSize: 14, color: 'var(--text2)', margin: '4px 0 0' }}>Relatório de Faturamento</p>
            <p style={{ fontSize: 16, fontWeight: 700, color: '#22c55e', margin: '8px 0 0' }}>{monthName}</p>
          </div>

          {/* Sumário 4-cards */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 24 }}>
            {/* Faturamento */}
            <div style={{
              background: 'var(--bg3)', borderRadius: 10, padding: 14, border: '1px solid var(--border)',
            }}>
              <p style={{ fontSize: 11, color: 'var(--text3)', fontWeight: 700, margin: 0 }}>FATURAMENTO</p>
              <p style={{ fontSize: 20, fontWeight: 900, color: '#22c55e', margin: '4px 0 0' }}>{formatCurrency(stats.revenue)}</p>
              <p style={{ fontSize: 11, color: 'var(--text3)', margin: '4px 0 0' }}>{stats.trips} corridas</p>
            </div>

            {/* Despesas */}
            <div style={{
              background: 'var(--bg3)', borderRadius: 10, padding: 14, border: '1px solid var(--border)',
            }}>
              <p style={{ fontSize: 11, color: 'var(--text3)', fontWeight: 700, margin: 0 }}>DESPESAS</p>
              <p style={{ fontSize: 20, fontWeight: 900, color: '#f97316', margin: '4px 0 0' }}>{formatCurrency(stats.totalExpenses)}</p>
              <p style={{ fontSize: 11, color: 'var(--text3)', margin: '4px 0 0' }}>Combustível + outros</p>
            </div>

            {/* Lucro */}
            <div style={{
              background: stats.profit >= 0 ? '#0c281815' : '#3f0f0f15',
              borderRadius: 10, padding: 14, border: `1px solid ${stats.profit >= 0 ? '#22c55e40' : '#ef444440'}`,
            }}>
              <p style={{ fontSize: 11, color: 'var(--text3)', fontWeight: 700, margin: 0 }}>LUCRO LÍQUIDO</p>
              <p style={{ fontSize: 20, fontWeight: 900, color: stats.profit >= 0 ? '#22c55e' : '#ef4444', margin: '4px 0 0' }}>
                {formatCurrency(stats.profit)}
              </p>
              <p style={{ fontSize: 11, color: 'var(--text3)', margin: '4px 0 0' }}>{stats.profitPercent}% de margem</p>
            </div>

            {/* KM */}
            <div style={{
              background: 'var(--bg3)', borderRadius: 10, padding: 14, border: '1px solid var(--border)',
            }}>
              <p style={{ fontSize: 11, color: 'var(--text3)', fontWeight: 700, margin: 0 }}>QUILOMETRAGEM</p>
              <p style={{ fontSize: 20, fontWeight: 900, color: '#3b82f6', margin: '4px 0 0' }}>{formatKm(stats.km)}</p>
              <p style={{ fontSize: 11, color: 'var(--text3)', margin: '4px 0 0' }}>{formatKm(stats.avgKmPerTrip)}/corrida</p>
            </div>
          </div>

          {/* Detalhes */}
          <div style={{ borderTop: '2px solid var(--border)', paddingTop: 16, marginBottom: 24 }}>
            <h3 style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)', marginBottom: 12 }}>📈 Detalhamento</h3>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div>
                <p style={{ fontSize: 12, color: 'var(--text3)', fontWeight: 600, margin: '0 0 4px' }}>💰 Ganho médio/corrida</p>
                <p style={{ fontSize: 16, fontWeight: 700, color: '#22c55e', margin: 0 }}>{formatCurrency(stats.avgEarningPerTrip)}</p>
              </div>
              <div>
                <p style={{ fontSize: 12, color: 'var(--text3)', fontWeight: 600, margin: '0 0 4px' }}>⛽ Custo/km</p>
                <p style={{ fontSize: 16, fontWeight: 700, color: '#f97316', margin: 0 }}>{formatCurrency(stats.costPerKm)}</p>
              </div>
              <div>
                <p style={{ fontSize: 12, color: 'var(--text3)', fontWeight: 600, margin: '0 0 4px' }}>🛢️ Combustível (mês)</p>
                <p style={{ fontSize: 16, fontWeight: 700, color: '#f97316', margin: 0 }}>{formatCurrency(stats.fuelCost)}</p>
              </div>
              <div>
                <p style={{ fontSize: 12, color: 'var(--text3)', fontWeight: 600, margin: '0 0 4px' }}>📌 Outras despesas</p>
                <p style={{ fontSize: 16, fontWeight: 700, color: '#f97316', margin: 0 }}>{formatCurrency(stats.otherExpenses)}</p>
              </div>
            </div>
          </div>

          {/* Footer */}
          <div style={{ textAlign: 'center', paddingTop: 16, borderTop: '1px solid var(--border)', fontSize: 11, color: 'var(--text3)' }}>
            <p style={{ margin: 0 }}>Relatório gerado em {new Date().toLocaleDateString('pt-BR', { year: 'numeric', month: 'long', day: 'numeric' })}</p>
            <p style={{ margin: '4px 0 0', fontSize: 10 }}>EasyDrive © Motorista App</p>
          </div>
        </div>

        {/* CSS para impressão */}
        <style>{`
          @media print {
            #pdf-report {
              background: white !important;
              color: black !important;
              border: none !important;
              padding: 40px !important;
              margin: 0 !important;
              box-shadow: none !important;
            }
            #pdf-report * {
              background: white !important;
              color: black !important;
              border-color: #ccc !important;
            }
            #pdf-report h1 {
              color: #333 !important;
            }
            #pdf-report h3 {
              color: #333 !important;
            }
            #pdf-report p {
              color: #555 !important;
            }
            #pdf-report div > p {
              color: #888 !important;
            }
            #pdf-report button,
            button:not(#pdf-report button) {
              display: none !important;
            }
            body > *:not(.pdf-modal) {
              display: none !important;
            }
          }
        `}</style>
      </div>
    </div>
  )
}
