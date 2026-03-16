import { useState, useCallback } from 'react'
import Navbar from './components/Navbar'
import SignalPanel from './components/SignalPanel'
import Backtest from './components/Backtest'
import Guide from './components/Guide'
import TelegramModal from './components/TelegramModal'
import { useBybit } from './hooks/useBybit'
import { useTelegram } from './hooks/useTelegram'

const TABS = [
  { id:'signal',   label:'분석 패널' },
  { id:'backtest', label:'백테스팅'  },
  { id:'guide',    label:'ICT 가이드' },
]

export default function App() {
  const [sym,      setSym]      = useState('BTCUSDT')
  const [tab,      setTab]      = useState('signal')
  const [theme,    setTheme]    = useState('dark')
  const [tgOpen,   setTgOpen]   = useState(false)
  const [toasts,   setToasts]   = useState([])

  const { data, status, wsBadge } = useBybit(sym)
  const tg = useTelegram()

  function toggleTheme() {
    const next = theme === 'dark' ? 'light' : 'dark'
    setTheme(next)
    document.documentElement.setAttribute('data-theme', next)
  }

  function addToast(msg, type = 'g') {
    const id = Date.now()
    setToasts(prev => [...prev, { id, msg, type }])
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 3500)
  }

  const handleAlert = useCallback((s, d, score) => {
    tg.sendAlert(s, d, score)
    if (score >= 5) addToast(`${s} ICT 셋업 ${score}/7 감지!`, 'g')
  }, [tg])

  function handleSym(s) {
    setSym(s)
    setTab('signal')
  }

  return (
    <div data-theme={theme} style={{ minHeight:'100vh' }}>
      <Navbar
        sym={sym} onSym={handleSym}
        data={data} status={status} wsBadge={wsBadge}
        theme={theme} onTheme={toggleTheme}
        onTgOpen={() => setTgOpen(true)}
      />

      {/* 탭 바 */}
      <div style={{ display:'flex', background:'var(--nav)', borderBottom:'1px solid var(--border)', overflowX:'auto' }}>
        {TABS.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            style={{
              padding:'11px 18px',
              border:'none',
              borderBottom: `2px solid ${tab === t.id ? 'var(--B)' : 'transparent'}`,
              background:'transparent',
              color: tab === t.id ? 'var(--B)' : 'var(--muted)',
              cursor:'pointer',
              fontSize:12,
              fontWeight: tab === t.id ? 700 : 400,
              fontFamily:'var(--font-ui)',
              whiteSpace:'nowrap',
              flexShrink:0,
              transition:'all .15s',
            }}>
            {t.label}
          </button>
        ))}
      </div>

      {/* 콘텐츠 */}
      <div style={{ padding:'12px 16px', maxWidth:960, margin:'0 auto' }}>
        {tab === 'signal'   && <SignalPanel sym={sym} data={data} onAlert={handleAlert} />}
        {tab === 'backtest' && <Backtest sym={sym} />}
        {tab === 'guide'    && <Guide />}
      </div>

      <footer style={{ textAlign:'center', padding:'20px', fontSize:11, color:'var(--dim)', borderTop:'0.5px solid var(--border)' }}>
        <div style={{ marginBottom:3, fontFamily:'var(--font-ui)', fontWeight:600 }}>ICT Chart — Bybit Futures Dashboard</div>
        <div>실시간: Bybit WebSocket · FR/OI: Bybit REST · 백테스팅: CoinGecko OHLC · 투자 권유 아님</div>
      </footer>

      {/* 텔레그램 모달 */}
      <TelegramModal open={tgOpen} onClose={() => setTgOpen(false)} tg={tg} />

      {/* 토스트 */}
      {toasts.map((t, i) => (
        <div key={t.id} className="toast"
          style={{ bottom: 16 + i * 52, top:'auto', right:16, background: t.type === 'g' ? 'rgba(16,217,126,0.92)' : 'rgba(240,75,90,0.92)' }}>
          {t.msg}
        </div>
      ))}
    </div>
  )
}
