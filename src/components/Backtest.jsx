import { useState, useRef, useEffect } from 'react'
import { CG, CG_ID, SHORT } from '../utils/constants'
import { fp } from '../utils/format'
import { ictBacktest, calcStats } from '../utils/ictBacktest'

const MN = ['1월','2월','3월','4월','5월','6월','7월','8월','9월','10월','11월','12월']

function drawEquity(canvas, trades) {
  if (!canvas || !trades.length) return
  const dpr = window.devicePixelRatio || 1
  const W = canvas.parentElement.clientWidth
  canvas.width = W * dpr; canvas.height = 150 * dpr
  canvas.style.width = W + 'px'; canvas.style.height = '150px'
  const ctx = canvas.getContext('2d'); ctx.scale(dpr, dpr)
  const pts = trades.map(t => t.equity)
  const mn = Math.min(...pts) * 0.995, mx = Math.max(...pts) * 1.005, rng = mx - mn
  const PAD = { t:14, r:10, b:20, l:70 }
  const px = i => PAD.l + (i / (pts.length - 1 || 1)) * (W - PAD.l - PAD.r)
  const py = v => PAD.t + (mx - v) / rng * (150 - PAD.t - PAD.b)
  ctx.clearRect(0, 0, W, 150)
  for (let i = 0; i <= 4; i++) {
    const v = mn + rng * (i / 4), y = py(v)
    ctx.strokeStyle = 'rgba(128,128,128,0.08)'; ctx.lineWidth = 0.5
    ctx.beginPath(); ctx.moveTo(PAD.l, y); ctx.lineTo(W - PAD.r, y); ctx.stroke()
    ctx.fillStyle = 'rgba(128,128,128,0.5)'; ctx.font = '9px JetBrains Mono, monospace'; ctx.textAlign = 'right'
    ctx.fillText('$' + Math.round(v).toLocaleString(), PAD.l - 4, y + 3)
  }
  ctx.strokeStyle = 'rgba(128,128,128,0.2)'; ctx.setLineDash([3, 3]); ctx.lineWidth = 0.8
  ctx.beginPath(); ctx.moveTo(PAD.l, py(10000)); ctx.lineTo(W - PAD.r, py(10000)); ctx.stroke()
  ctx.setLineDash([])
  const lastV = pts[pts.length - 1], pos = lastV > 10000
  ctx.beginPath(); ctx.moveTo(px(0), py(pts[0])); pts.forEach((v, i) => { if (i > 0) ctx.lineTo(px(i), py(v)) })
  ctx.lineTo(px(pts.length - 1), 150 - PAD.b); ctx.lineTo(px(0), 150 - PAD.b); ctx.closePath()
  ctx.fillStyle = pos ? 'rgba(16,217,126,0.1)' : 'rgba(240,75,90,0.1)'; ctx.fill()
  ctx.beginPath(); ctx.moveTo(px(0), py(pts[0])); pts.forEach((v, i) => { if (i > 0) ctx.lineTo(px(i), py(v)) })
  ctx.strokeStyle = pos ? 'rgba(16,217,126,0.85)' : 'rgba(240,75,90,0.85)'; ctx.lineWidth = 1.5; ctx.stroke()
  ctx.fillStyle = pos ? '#10d97e' : '#f04b5a'
  ctx.beginPath(); ctx.arc(px(pts.length - 1), py(lastV), 3, 0, Math.PI * 2); ctx.fill()
  const ret = ((lastV - 10000) / 10000 * 100).toFixed(1)
  ctx.fillStyle = pos ? 'rgba(16,217,126,0.9)' : 'rgba(240,75,90,0.9)'
  ctx.font = 'bold 10px JetBrains Mono, monospace'; ctx.textAlign = 'left'
  ctx.fillText('$' + lastV.toLocaleString() + ' (' + (pos ? '+' : '') + ret + '%)', PAD.l, 12)
}

function drawMonthly(canvas, byMonth) {
  if (!canvas) return
  const dpr = window.devicePixelRatio || 1, W = canvas.parentElement.clientWidth
  canvas.width = W * dpr; canvas.height = 120 * dpr
  canvas.style.width = W + 'px'; canvas.style.height = '120px'
  const ctx = canvas.getContext('2d'); ctx.scale(dpr, dpr)
  const months = Object.keys(byMonth).sort((a, b) => a - b)
  if (!months.length) return
  const PAD = { t:10, r:8, b:22, l:8 }, maxH = 120 - PAD.t - PAD.b
  ctx.clearRect(0, 0, W, 120)
  const bw = (W - PAD.l - PAD.r) / months.length
  months.forEach((m, i) => {
    const d = byMonth[m], tot = d.w + d.l, wr = tot ? d.w / tot : 0
    const bH = Math.max(4, wr * maxH), bx = PAD.l + i * bw + bw * 0.12, bww = bw * 0.76
    ctx.fillStyle = wr >= 0.55 ? 'rgba(16,217,126,0.8)' : wr >= 0.45 ? 'rgba(245,183,49,0.8)' : 'rgba(240,75,90,0.8)'
    ctx.fillRect(bx, 120 - PAD.b - bH, bww, bH)
    ctx.fillStyle = 'rgba(128,128,128,0.6)'; ctx.font = '8px Syne, sans-serif'; ctx.textAlign = 'center'
    ctx.fillText(MN[parseInt(m)], bx + bww / 2, 120 - PAD.b + 12)
    ctx.fillStyle = wr >= 0.55 ? 'rgba(16,217,126,1)' : wr >= 0.45 ? 'rgba(200,150,0,1)' : 'rgba(240,75,90,1)'
    ctx.font = 'bold 8px Syne, sans-serif'
    ctx.fillText(Math.round(wr * 100) + '%', bx + bww / 2, 120 - PAD.b - bH - 3)
  })
}

export default function Backtest({ sym }) {
  const [days,    setDays]    = useState(30)
  const [trades,  setTrades]  = useState([])
  const [stats,   setStats]   = useState(null)
  const [filter,  setFilter]  = useState('all')
  const [loading, setLoading] = useState(false)
  const [msg,     setMsg]     = useState('')
  const [prog,    setProg]    = useState(0)
  const equityCv  = useRef(null)
  const monthlyCv = useRef(null)

  useEffect(() => {
    if (!stats) return
    drawEquity(equityCv.current, trades)
    drawMonthly(monthlyCv.current, stats.byMonth)
  }, [stats, trades])

  const tfLabel = days <= 30 ? '4H봉' : '1D봉'

  async function run() {
    setLoading(true); setProg(10); setMsg(`CoinGecko OHLC (${tfLabel}) 불러오는 중...`)
    setStats(null); setTrades([])
    try {
      const res = await fetch(`https://api.coingecko.com/api/v3/coins/${CG_ID[sym]}/ohlc?vs_currency=usd&days=${days}`, { signal: AbortSignal.timeout(10000) })
      if (!res.ok) throw new Error('HTTP ' + res.status)
      const raw = await res.json()
      setProg(55); setMsg('ICT 로직 분석 중...')
      const candles = raw.map(k => ({
        t: k[0], o: k[1], h: k[2], l: k[3], c: k[4],
        date: new Date(k[0]).toLocaleDateString('ko-KR', { month:'2-digit', day:'2-digit' }),
        month: new Date(k[0]).getMonth()
      }))
      await new Promise(r => setTimeout(r, 50))
      setProg(80)
      const result = ictBacktest(candles)
      if (!result.length) { alert('신호 없음. 기간을 늘려보세요 (90일/180일).'); setLoading(false); return }
      setTrades(result)
      setStats(calcStats(result))
      setProg(100)
    } catch (e) {
      alert('오류: ' + e.message)
    }
    setLoading(false)
  }

  const filtered = filter === 'win' ? trades.filter(t => t.win) : filter === 'loss' ? trades.filter(t => !t.win) : trades

  return (
    <div>
      {/* 설정 */}
      <div className="card">
        <div style={{ fontSize:13, fontWeight:700, marginBottom:5, fontFamily:'var(--font-ui)' }}>실제 OHLC 기반 ICT 백테스팅</div>
        <div style={{ fontSize:11, color:'var(--muted)', marginBottom:10, lineHeight:1.7 }}>
          CoinGecko 실제 과거 OHLC 캔들에 ICT 로직을 적용합니다.
        </div>

        {/* 적용 조건 요약 */}
        <div style={{ background:'rgba(16,217,126,0.06)', border:'0.5px solid rgba(16,217,126,0.2)', borderRadius:10, padding:'10px 12px', marginBottom:12 }}>
          <div style={{ fontSize:11, color:'var(--G)', fontWeight:700, marginBottom:6, fontFamily:'var(--font-ui)' }}>적용 ICT 조건</div>
          <div style={{ fontSize:11, color:'var(--muted)', lineHeight:2 }}>
            {['① HTF 방향 일치 (앞쪽 20% 캔들 기준)',
              '② 스윙 고저점 돌파 → MSS 감지 (3봉 고정)',
              '③ Bull/Bear OB 확인 (직전 4봉 탐색)',
              '④ FVG 겹침 → 진입 존 정밀화',
              '⑤ 진입: OB+FVG 중앙 / SL: OB 하단 -0.5% / TP: R:R 3:1'].map((c, i) => (
              <div key={i}>{c}</div>
            ))}
          </div>
        </div>

        <div className="g2" style={{ gap:10, marginBottom:0 }}>
          <div>
            <div style={{ fontSize:11, color:'var(--muted)', marginBottom:5 }}>기간 (타임프레임 자동)</div>
            <select value={days} onChange={e => setDays(parseInt(e.target.value))}
              style={{ width:'100%', padding:'9px 10px', borderRadius:9, border:'0.5px solid var(--border)', background:'var(--bg)', color:'var(--text)', fontSize:12, fontFamily:'var(--font-mono)', cursor:'pointer' }}>
              <option value={14}>4H봉 · 14일</option>
              <option value={30}>4H봉 · 30일</option>
              <option value={90}>1D봉 · 90일</option>
              <option value={180}>1D봉 · 180일</option>
            </select>
          </div>
          <div style={{ display:'flex', alignItems:'flex-end' }}>
            <button onClick={run} disabled={loading}
              style={{ width:'100%', padding:'9px', borderRadius:9, border:'1px solid var(--B)', background:'var(--bBg)', color:'var(--B)', fontSize:13, fontWeight:700, cursor:'pointer', fontFamily:'var(--font-ui)', opacity: loading ? 0.6 : 1 }}>
              {loading ? '실행 중...' : '백테스트 실행 ↗'}
            </button>
          </div>
        </div>

        {loading && (
          <div style={{ marginTop:10 }}>
            <div style={{ fontSize:11, color:'var(--muted)', marginBottom:5 }}>{msg}</div>
            <div className="prog-bar"><div className="prog-fill" style={{ width: prog + '%' }} /></div>
          </div>
        )}
      </div>

      {/* 결과 */}
      {stats && (
        <>
          {/* 요약 */}
          <div className="g4" style={{ marginBottom:10 }}>
            {[
              ['총 신호', stats.tot, 'var(--text)'],
              ['승률', stats.wr + '%', parseFloat(stats.wr) >= 50 ? 'var(--G)' : 'var(--R)'],
              ['R:R', '3.0:1', 'var(--text)'],
              ['기대값 EV', stats.ev, parseFloat(stats.ev) > 0 ? 'var(--G)' : 'var(--R)'],
            ].map(([label, value, color]) => (
              <div key={label} className="mc">
                <div className="mc-t">{label}</div>
                <div className="mc-v" style={{ fontSize:18, color }}>{value}</div>
              </div>
            ))}
          </div>
          <div className="g2" style={{ marginBottom:10 }}>
            <div className="mc"><div className="mc-t">최대 연속 익절</div><div className="mc-v" style={{ fontSize:16, color:'var(--G)' }}>{stats.mW}회</div></div>
            <div className="mc"><div className="mc-t">최대 연속 손절</div><div className="mc-v" style={{ fontSize:16, color:'var(--R)' }}>{stats.mL}회</div></div>
          </div>

          {/* 에쿼티 곡선 */}
          <div className="card">
            <div className="lbl">누적 손익 곡선 · {SHORT[sym]} {tfLabel} ({days}일) 실제 OHLC</div>
            <canvas ref={equityCv} style={{ display:'block', width:'100%' }} />
          </div>

          {/* 월별 */}
          <div className="card">
            <div className="lbl">월별 승률</div>
            <canvas ref={monthlyCv} style={{ display:'block', width:'100%' }} />
          </div>

          {/* 셋업 유형별 */}
          <div className="card">
            <div className="lbl">셋업 유형별 성과 · {SHORT[sym]}</div>
            <table style={{ width:'100%', borderCollapse:'collapse', fontSize:11 }}>
              <thead>
                <tr>{['셋업','횟수','승률','누적손익'].map(h => (
                  <th key={h} style={{ fontSize:9, color:'var(--dim)', textAlign:'left', padding:'4px 8px', borderBottom:'0.5px solid var(--border)', textTransform:'uppercase', fontFamily:'var(--font-ui)' }}>{h}</th>
                ))}</tr>
              </thead>
              <tbody>
                {Object.entries(stats.bySetup).map(([k, v]) => {
                  const tot = v.w + v.l, wr = tot ? (v.w / tot * 100).toFixed(0) : 0
                  return (
                    <tr key={k}>
                      <td style={{ padding:'6px 8px', fontFamily:'var(--font-mono)', borderBottom:'0.5px solid var(--border)' }}>{k}</td>
                      <td style={{ padding:'6px 8px', fontFamily:'var(--font-mono)', borderBottom:'0.5px solid var(--border)' }}>{tot}</td>
                      <td style={{ padding:'6px 8px', fontFamily:'var(--font-mono)', borderBottom:'0.5px solid var(--border)', color: parseFloat(wr) >= 50 ? 'var(--G)' : 'var(--R)' }}>{wr}%</td>
                      <td style={{ padding:'6px 8px', fontFamily:'var(--font-mono)', borderBottom:'0.5px solid var(--border)', color: v.pnl >= 0 ? 'var(--G)' : 'var(--R)' }}>{v.pnl >= 0 ? '+' : ''}${v.pnl.toLocaleString()}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          {/* 거래 내역 */}
          <div className="card">
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:10 }}>
              <div className="lbl" style={{ marginBottom:0 }}>거래 내역 (실제 OHLC)</div>
              <div style={{ display:'flex', gap:4 }}>
                {[['all','전체'],['win','익절'],['loss','손절']].map(([f, l]) => (
                  <button key={f} onClick={() => setFilter(f)}
                    style={{ padding:'2px 9px', borderRadius:5, border:`0.5px solid ${filter===f?'var(--B)':'var(--border)'}`, background: filter===f?'var(--bBg)':'transparent', color: filter===f?'var(--B)':'var(--muted)', cursor:'pointer', fontSize:10, fontFamily:'var(--font-mono)' }}>
                    {l}
                  </button>
                ))}
              </div>
            </div>
            <div style={{ overflowX:'auto' }}>
              <table style={{ width:'100%', borderCollapse:'collapse', fontSize:11 }}>
                <thead>
                  <tr>{['#','날짜','방향','셋업','진입','SL','TP','결과','손익'].map(h => (
                    <th key={h} style={{ fontSize:9, color:'var(--dim)', textAlign:'left', padding:'4px 8px', borderBottom:'0.5px solid var(--border)', textTransform:'uppercase', whiteSpace:'nowrap', fontFamily:'var(--font-ui)' }}>{h}</th>
                  ))}</tr>
                </thead>
                <tbody>
                  {filtered.slice().reverse().slice(0, 30).map((t, i) => (
                    <tr key={i} style={{ background: i % 2 === 0 ? 'transparent' : 'rgba(128,128,128,0.025)' }}>
                      <td style={{ padding:'6px 8px', fontFamily:'var(--font-mono)', borderBottom:'0.5px solid var(--border)', color:'var(--dim)' }}>{filtered.length - i}</td>
                      <td style={{ padding:'6px 8px', fontFamily:'var(--font-mono)', borderBottom:'0.5px solid var(--border)', whiteSpace:'nowrap' }}>{t.date}</td>
                      <td style={{ padding:'6px 8px', fontFamily:'var(--font-mono)', borderBottom:'0.5px solid var(--border)', color: t.dir==='LONG'?'var(--G)':'var(--R)', fontWeight:700 }}>{t.dir}</td>
                      <td style={{ padding:'6px 8px', fontFamily:'var(--font-mono)', borderBottom:'0.5px solid var(--border)', color:'var(--muted)', whiteSpace:'nowrap' }}>{t.setup}</td>
                      <td style={{ padding:'6px 8px', fontFamily:'var(--font-mono)', borderBottom:'0.5px solid var(--border)', whiteSpace:'nowrap' }}>{fp(t.entry, sym)}</td>
                      <td style={{ padding:'6px 8px', fontFamily:'var(--font-mono)', borderBottom:'0.5px solid var(--border)', color:'var(--R)', whiteSpace:'nowrap' }}>{fp(t.sl, sym)}</td>
                      <td style={{ padding:'6px 8px', fontFamily:'var(--font-mono)', borderBottom:'0.5px solid var(--border)', color:'var(--G)', whiteSpace:'nowrap' }}>{fp(t.tp, sym)}</td>
                      <td style={{ padding:'6px 8px', borderBottom:'0.5px solid var(--border)' }}>
                        <span className={`pill ${t.win?'pill-g':'pill-r'}`} style={{ fontSize:9 }}>{t.win?'익절':'손절'}</span>
                      </td>
                      <td style={{ padding:'6px 8px', fontFamily:'var(--font-mono)', borderBottom:'0.5px solid var(--border)', color: t.pnl>=0?'var(--G)':'var(--R)', fontWeight:600 }}>
                        {t.pnl >= 0 ? '+' : ''}${t.pnl.toLocaleString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
