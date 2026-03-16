import { useState, useEffect } from 'react'
import { SYMBOLS, SHORT } from '../utils/constants'
import { fp, frTimeLeft } from '../utils/format'

const TICKER_VOLATILITY = { BTCUSDT:0.0003, ETHUSDT:0.0004, SOLUSDT:0.0007, XRPUSDT:0.0006, BNBUSDT:0.0004, DOGEUSDT:0.001, ADAUSDT:0.0008, AVAXUSDT:0.0008, LINKUSDT:0.0007 }

export default function Navbar({ sym, onSym, data, status, wsBadge, theme, onTheme, onTgOpen }) {
  const [frTimer, setFrTimer] = useState(frTimeLeft())

  useEffect(() => {
    const id = setInterval(() => setFrTimer(frTimeLeft()), 1000)
    return () => clearInterval(id)
  }, [])

  const price  = data?.price
  const chg24  = data?.chg24 || 0
  const bias   = data?.d7Bias === 'BULLISH' && data?.d1Bias === 'BULLISH' ? 'BULLISH'
               : data?.d7Bias === 'BEARISH' && data?.d1Bias === 'BEARISH' ? 'BEARISH' : 'NEUTRAL'

  const statusLabel = status === 'live' ? 'LIVE · Bybit' : status === 'sim' ? '시뮬레이션' : '연결 중...'
  const statusColor = status === 'live' ? 'var(--G)' : status === 'sim' ? 'var(--Y)' : 'var(--muted)'
  const dotAnim     = status === 'connecting'

  const wsBadgeStyle = wsBadge === 'live'
    ? { background:'rgba(16,217,126,0.15)', color:'var(--G)', border:'0.5px solid rgba(16,217,126,0.3)' }
    : { background:'rgba(240,75,90,0.15)',  color:'var(--R)', border:'0.5px solid rgba(240,75,90,0.3)' }

  return (
    <nav style={{ background:'var(--nav)', borderBottom:'1px solid var(--border)', padding:'0 16px', minHeight:52, display:'flex', alignItems:'center', justifyContent:'space-between', flexWrap:'wrap', gap:8, position:'sticky', top:0, zIndex:20 }}>
      {/* 왼쪽 */}
      <div style={{ display:'flex', alignItems:'center', gap:10, flexWrap:'wrap', padding:'6px 0' }}>
        {/* 로고 */}
        <div style={{ fontFamily:'var(--font-ui)', fontSize:16, fontWeight:800, letterSpacing:'-0.03em' }}>
          <span style={{ color:'var(--B)' }}>ICT</span>
          <span style={{ color:'var(--text)', fontWeight:400 }}> Chart</span>
        </div>

        {/* 바이빗 뱃지 */}
        <span style={{ ...wsBadgeStyle, padding:'2px 8px', borderRadius:5, fontSize:9, fontWeight:700, letterSpacing:'0.05em', fontFamily:'var(--font-ui)' }}>
          {wsBadge === 'live' ? 'WS LIVE' : 'WS 오류'}
        </span>

        <div style={{ width:1, height:16, background:'var(--border)' }} />

        {/* 상태 */}
        <div style={{ display:'flex', alignItems:'center', gap:5 }}>
          <div style={{ width:7, height:7, borderRadius:'50%', background:statusColor, flexShrink:0, animation: dotAnim ? 'pulse 1.5s infinite' : 'none' }} />
          <span style={{ fontSize:10, color:statusColor }}>{statusLabel}</span>
        </div>

        {/* 심볼 버튼 */}
        <div style={{ display:'flex', gap:4, flexWrap:'wrap' }}>
          {SYMBOLS.map(s => (
            <button key={s}
              onClick={() => onSym(s)}
              style={{ padding:'3px 10px', borderRadius:5, border:`0.5px solid ${s === sym ? 'var(--B)' : 'var(--border)'}`, background: s === sym ? 'var(--bBg)' : 'transparent', color: s === sym ? 'var(--B)' : 'var(--muted)', cursor:'pointer', fontSize:11, fontWeight:600, fontFamily:'var(--font-mono)', transition:'all .15s' }}>
              {SHORT[s]}
            </button>
          ))}
        </div>
      </div>

      {/* 오른쪽 */}
      <div style={{ display:'flex', alignItems:'center', gap:8, flexWrap:'wrap', padding:'6px 0' }}>
        {/* 가격 */}
        <div style={{ display:'flex', alignItems:'baseline', gap:7 }}>
          <span style={{ fontSize:20, fontWeight:700, fontFamily:'var(--font-mono)' }}>{fp(price, sym)}</span>
          <span style={{ fontSize:12, fontWeight:600, color: chg24 >= 0 ? 'var(--G)' : 'var(--R)' }}>
            {chg24 >= 0 ? '+' : ''}{chg24.toFixed(2)}%
          </span>
          <span className={`pill ${bias === 'BULLISH' ? 'pill-g' : bias === 'BEARISH' ? 'pill-r' : 'pill-y'}`}>{bias}</span>
        </div>

        {/* FR 타이머 */}
        <div style={{ fontSize:10, color:'var(--dim)', fontFamily:'var(--font-mono)', background:'rgba(128,128,128,0.07)', padding:'3px 8px', borderRadius:5, border:'0.5px solid var(--border)' }}>
          FR <span style={{ color:'var(--Y)' }}>{frTimer}</span>
        </div>

        <div style={{ width:1, height:16, background:'var(--border)' }} />

        <button onClick={onTgOpen} style={{ height:28, padding:'0 10px', borderRadius:6, border:'0.5px solid var(--border)', background:'transparent', color:'var(--muted)', cursor:'pointer', fontSize:11, fontFamily:'var(--font-mono)', whiteSpace:'nowrap' }}>
          📱 알람
        </button>
        <button onClick={onTheme} style={{ height:28, padding:'0 10px', borderRadius:6, border:'0.5px solid var(--border)', background:'transparent', color:'var(--muted)', cursor:'pointer', fontSize:14 }}>
          {theme === 'dark' ? '🌙' : '☀️'}
        </button>
      </div>
    </nav>
  )
}
