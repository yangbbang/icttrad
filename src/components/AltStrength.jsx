import { useMemo, useState } from 'react'
import { useAltStrength } from '../hooks/useAltStrength'
import { buildOverview, buildSectors, altseasonIndex, passMSS, passOTE, passGC, SECTOR_LIST } from '../utils/altStrength'
import { fp, fmtV } from '../utils/format'

const TFS = [
  { k: 'h24', label: '24H' },
  { k: 'd7',  label: '7D'  },
  { k: 'd30', label: '30D' },
]
const INTERVALS = [
  { k: 'D',   label: '일봉' },
  { k: '240', label: '4H'  },
]

const pct = (v, dec = 1) => (v == null || !isFinite(v)) ? '—' : (v >= 0 ? '+' : '') + v.toFixed(dec) + '%'
const clr = v => (v == null || !isFinite(v)) ? 'var(--muted)' : v >= 0 ? 'var(--G)' : 'var(--R)'

function Badge({ t, children, title }) {
  const map = {
    g: ['var(--gBg)', 'var(--G)'], r: ['var(--rBg)', 'var(--R)'],
    y: ['var(--yBg)', 'var(--Y)'], b: ['var(--bBg)', 'var(--B)'],
    n: ['rgba(128,128,128,0.10)', 'var(--muted)'],
  }
  const [bg, cl] = map[t]
  return (
    <span title={title} style={{ background: bg, color: cl, padding: '1px 6px', borderRadius: 4, fontSize: 9, fontWeight: 700, whiteSpace: 'nowrap', fontFamily: 'var(--font-mono)' }}>
      {children}
    </span>
  )
}

function Chip({ on, onClick, children }) {
  return (
    <button onClick={onClick}
      style={{
        padding: '4px 11px', borderRadius: 6, cursor: 'pointer', fontSize: 11, fontWeight: 600,
        fontFamily: 'var(--font-mono)', transition: 'all .15s', whiteSpace: 'nowrap',
        border: `0.5px solid ${on ? 'var(--B)' : 'var(--border)'}`,
        background: on ? 'var(--bBg)' : 'transparent',
        color: on ? 'var(--B)' : 'var(--muted)',
      }}>
      {children}
    </button>
  )
}

function SetupBadges({ setup, interval }) {
  if (!setup) return <Badge t="n">—</Badge>
  const unit = interval === 'D' ? '일' : '봉'
  const out = []
  if (setup.mss === 'bull') out.push(<Badge key="m" t="g" title="상승 추세전환 (스윕 → 구조 돌파)">MSS↑ {setup.mssAgo}{unit}전</Badge>)
  if (setup.mss === 'bear') out.push(<Badge key="m" t="r" title="하락 추세전환">MSS↓ {setup.mssAgo}{unit}전</Badge>)
  const o = setup.ote
  if (o?.side === 'long') {
    if (o.state === 'in')   out.push(<Badge key="o" t="g" title={`롱 OTE 존 ${fp(o.lo)}~${fp(o.hi)} · 0.705 = ${fp(o.entry)}`}>OTE존</Badge>)
    if (o.state === 'wait') out.push(<Badge key="o" t="y" title={`아직 미되돌림 — 존 ${fp(o.lo)}~${fp(o.hi)}`}>OTE대기</Badge>)
    if (o.state === 'deep') out.push(<Badge key="o" t="n" title="0.79 이탈 — 무효화 주의">OTE이탈</Badge>)
  }
  if (o?.side === 'short' && o.state === 'in') out.push(<Badge key="o" t="r" title="숏 OTE 존 진입">OTE·S</Badge>)
  const g = setup.gc
  if (g) {
    if (g.above && g.crossUpAgo != null && g.crossUpAgo <= 30)
      out.push(<Badge key="g" t="g" title="SMA50이 SMA200을 최근 상향 돌파">골크 {g.crossUpAgo}{unit}전</Badge>)
    else if (g.above)
      out.push(<Badge key="g" t="b" title="SMA50 > SMA200 유지 중">정배열</Badge>)
    else if (g.crossDnAgo != null && g.crossDnAgo <= 30)
      out.push(<Badge key="g" t="r" title="SMA50이 SMA200을 최근 하향 돌파">데크 {g.crossDnAgo}{unit}전</Badge>)
    else
      out.push(<Badge key="g" t="n">역배열</Badge>)
  }
  if (!out.length) return <Badge t="n">—</Badge>
  return <span style={{ display: 'inline-flex', gap: 4, flexWrap: 'wrap' }}>{out}</span>
}

export default function AltStrength() {
  const [tf,       setTf]       = useState('d7')
  const [candleIv, setCandleIv] = useState('D')
  const [fMss,     setFMss]     = useState(false)
  const [fOte,     setFOte]     = useState(false)
  const [fGc,      setFGc]      = useState(false)
  const [sector,   setSector]   = useState('')
  const [sortKey,  setSortKey]  = useState('score')
  const [sortDir,  setSortDir]  = useState(-1)

  const { rows, status, progress, updated, errMsg, refresh } = useAltStrength(candleIv)

  const overview  = useMemo(() => buildOverview(rows, tf), [rows, tf])
  const altseason = useMemo(() => altseasonIndex(rows), [rows])
  const sectors   = useMemo(() => buildSectors(rows, tf), [rows, tf])

  const table = useMemo(() => {
    let list = rows.filter(r => r.base !== 'BTC')
    if (sector) list = list.filter(r => r.sector === sector)
    if (fMss)   list = list.filter(passMSS)
    if (fOte)   list = list.filter(passOTE)
    if (fGc)    list = list.filter(passGC)
    const val = r => sortKey === 'score' ? r.rsScore : r.chg[sortKey]
    return [...list].sort((a, b) => {
      const va = val(a), vb = val(b)
      if (va == null) return 1
      if (vb == null) return -1
      return (va - vb) * sortDir
    })
  }, [rows, sector, fMss, fOte, fGc, sortKey, sortDir])

  function clickSort(k) {
    if (sortKey === k) setSortDir(d => -d)
    else { setSortKey(k); setSortDir(-1) }
  }

  const altDiff = overview && overview.total3 != null && overview.btc != null ? overview.total3 - overview.btc : null
  const verdict = altDiff == null ? null
    : altDiff > 0.5  ? { label: `알트 우위 +${altDiff.toFixed(1)}%p`, cls: 'pill-g' }
    : altDiff < -0.5 ? { label: `BTC 우위 ${altDiff.toFixed(1)}%p`,  cls: 'pill-r' }
    :                  { label: '중립', cls: 'pill-y' }

  const gaugeColor = altseason == null ? 'var(--muted)' : altseason >= 75 ? 'var(--G)' : altseason <= 25 ? 'var(--R)' : 'var(--Y)'
  const maxSecAbs = Math.max(0.001, ...sectors.map(s => Math.abs(s.avg)))

  const thStyle = k => ({
    padding: '7px 8px', textAlign: 'right', cursor: 'pointer', whiteSpace: 'nowrap',
    color: sortKey === k ? 'var(--B)' : 'var(--dim)', fontSize: 10, fontWeight: 700, userSelect: 'none',
  })
  const arrow = k => sortKey === k ? (sortDir === -1 ? ' ↓' : ' ↑') : ''

  return (
    <div>
      {/* ── 컨트롤 바 ── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 10 }}>
        <span className="lbl" style={{ marginBottom: 0 }}>기준</span>
        <div style={{ display: 'flex', gap: 4 }}>
          {TFS.map(t => <Chip key={t.k} on={tf === t.k} onClick={() => setTf(t.k)}>{t.label}</Chip>)}
        </div>
        <div style={{ width: 1, height: 16, background: 'var(--border)' }} />
        <span className="lbl" style={{ marginBottom: 0 }}>차트</span>
        <div style={{ display: 'flex', gap: 4 }}>
          {INTERVALS.map(iv => <Chip key={iv.k} on={candleIv === iv.k} onClick={() => setCandleIv(iv.k)}>{iv.label}</Chip>)}
        </div>
        <div style={{ flex: 1 }} />
        <span style={{ fontSize: 10, color: 'var(--dim)' }}>
          {updated ? `업데이트 ${updated.toLocaleTimeString('ko-KR')}` : ''}
        </span>
        <Chip on={false} onClick={refresh}>⟳ 새로고침</Chip>
      </div>

      {/* ── 로딩 / 에러 ── */}
      {status === 'loading' && (
        <div className="card">
          <div style={{ fontSize: 12, color: 'var(--muted)' }}>바이빗 캔들 데이터 로딩 중... {progress}%</div>
          <div className="prog-bar"><div className="prog-fill" style={{ width: `${progress}%` }} /></div>
        </div>
      )}
      {status === 'err' && (
        <div className="card" style={{ borderColor: 'rgba(240,75,90,0.4)' }}>
          <div style={{ fontSize: 12, color: 'var(--R)' }}>데이터 로드 실패: {errMsg}</div>
          <button onClick={refresh} style={{ marginTop: 8, padding: '5px 14px', borderRadius: 6, border: '0.5px solid var(--border2)', background: 'transparent', color: 'var(--text)', cursor: 'pointer', fontSize: 11 }}>다시 시도</button>
        </div>
      )}

      {rows.length > 0 && (
        <>
          {/* ── ① 시장 개요 ── */}
          <div className="card">
            <div className="lbl">① 시장 상대강도 — TOTAL 프록시 ({TFS.find(t => t.k === tf).label} · {overview?.weightLabel})</div>
            <div className="g4">
              <div className="mc">
                <div className="mc-t">BTC</div>
                <div className="mc-v" style={{ color: clr(overview?.btc) }}>{pct(overview?.btc)}</div>
              </div>
              <div className="mc">
                <div className="mc-t">TOTAL (전체)</div>
                <div className="mc-v" style={{ color: clr(overview?.total) }}>{pct(overview?.total)}</div>
              </div>
              <div className="mc">
                <div className="mc-t">TOTAL2 (BTC 제외)</div>
                <div className="mc-v" style={{ color: clr(overview?.total2) }}>{pct(overview?.total2)}</div>
              </div>
              <div className="mc">
                <div className="mc-t">TOTAL3 (BTC·ETH 제외)</div>
                <div className="mc-v" style={{ color: clr(overview?.total3) }}>{pct(overview?.total3)}</div>
              </div>
            </div>
            {verdict && (
              <div style={{ marginTop: 10, display: 'flex', alignItems: 'center', gap: 8 }}>
                <span className={`pill ${verdict.cls}`}>{verdict.label}</span>
                <span style={{ fontSize: 10, color: 'var(--dim)' }}>TOTAL3 − BTC 수익률 차이 · TOTAL2/3이 클수록 알트 자금 유입</span>
              </div>
            )}
          </div>

          {/* ── ② 알트시즌 게이지 ── */}
          <div className="card">
            <div className="lbl">② 알트시즌 지수 — 상위 50 알트 중 30일 BTC 아웃퍼폼 비율</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <span style={{ fontSize: 26, fontWeight: 700, fontFamily: 'var(--font-mono)', color: gaugeColor, minWidth: 56 }}>
                {altseason == null ? '—' : altseason}
              </span>
              <div style={{ flex: 1 }}>
                <div style={{ height: 8, background: 'rgba(128,128,128,0.12)', borderRadius: 4, overflow: 'hidden' }}>
                  <div style={{ height: '100%', width: `${altseason ?? 0}%`, background: gaugeColor, borderRadius: 4, transition: 'width .3s' }} />
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 9, color: 'var(--dim)', marginTop: 4 }}>
                  <span>← 비트코인 시즌 (≤25)</span>
                  <span>중립</span>
                  <span>알트시즌 (≥75) →</span>
                </div>
              </div>
            </div>
          </div>

          {/* ── ③ 섹터 상대강도 ── */}
          <div className="card">
            <div className="lbl">③ 섹터 상대강도 (BTC 대비 평균 초과수익 · {TFS.find(t => t.k === tf).label})</div>
            {sectors.map(s => (
              <div key={s.sector} onClick={() => setSector(sector === s.sector ? '' : s.sector)}
                style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '5px 4px', cursor: 'pointer', borderRadius: 6, background: sector === s.sector ? 'var(--bBg)' : 'transparent' }}>
                <span style={{ width: 90, fontSize: 11, color: sector === s.sector ? 'var(--B)' : 'var(--text)', fontWeight: 600, flexShrink: 0 }}>
                  {s.sector} <span style={{ color: 'var(--dim)', fontWeight: 400 }}>({s.n})</span>
                </span>
                <div style={{ flex: 1, height: 6, background: 'rgba(128,128,128,0.08)', borderRadius: 3, overflow: 'hidden' }}>
                  <div style={{ height: '100%', width: `${Math.min(100, Math.abs(s.avg) / maxSecAbs * 100)}%`, background: s.avg >= 0 ? 'var(--G)' : 'var(--R)', borderRadius: 3 }} />
                </div>
                <span style={{ width: 58, textAlign: 'right', fontSize: 11, fontWeight: 700, color: clr(s.avg), fontFamily: 'var(--font-mono)', flexShrink: 0 }}>{pct(s.avg)}</span>
                <span style={{ width: 80, textAlign: 'right', fontSize: 10, color: 'var(--muted)', flexShrink: 0 }}>
                  🥇 {s.top?.base}
                </span>
              </div>
            ))}
            <div style={{ fontSize: 9, color: 'var(--dim)', marginTop: 6 }}>섹터 클릭 → 아래 스크리너 필터링</div>
          </div>

          {/* ── ④ 코인 스크리너 ── */}
          <div className="card">
            <div className="lbl">④ 코인 스크리너 — 거래대금 상위 {rows.length - 1} 알트 ({candleIv === 'D' ? '일봉' : '4시간봉'} 기준)</div>

            {/* 필터 칩 */}
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 10 }}>
              <Chip on={fMss} onClick={() => setFMss(v => !v)}>🔄 MSS 상승전환</Chip>
              <Chip on={fOte} onClick={() => setFOte(v => !v)}>🎯 OTE 진입존</Chip>
              <Chip on={fGc}  onClick={() => setFGc(v => !v)}>✨ 골든크로스</Chip>
              <select value={sector} onChange={e => setSector(e.target.value)}
                style={{ padding: '4px 8px', borderRadius: 6, border: '0.5px solid var(--border)', background: 'var(--card)', color: sector ? 'var(--B)' : 'var(--muted)', fontSize: 11, fontFamily: 'var(--font-mono)', cursor: 'pointer' }}>
                <option value="">전체 섹터</option>
                {SECTOR_LIST.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
              {(fMss || fOte || fGc || sector) && (
                <Chip on={false} onClick={() => { setFMss(false); setFOte(false); setFGc(false); setSector('') }}>✕ 초기화</Chip>
              )}
            </div>

            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11, fontFamily: 'var(--font-mono)', minWidth: 640 }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--border2)' }}>
                    <th style={{ ...thStyle(''), textAlign: 'left', cursor: 'default' }}>#</th>
                    <th style={{ ...thStyle(''), textAlign: 'left', cursor: 'default' }}>코인</th>
                    <th style={{ ...thStyle(''), textAlign: 'left', cursor: 'default' }}>섹터</th>
                    <th style={{ ...thStyle(''), cursor: 'default' }}>가격</th>
                    <th style={thStyle('h24')} onClick={() => clickSort('h24')}>24H{arrow('h24')}</th>
                    <th style={thStyle('d7')}  onClick={() => clickSort('d7')}>7D{arrow('d7')}</th>
                    <th style={thStyle('d30')} onClick={() => clickSort('d30')}>30D{arrow('d30')}</th>
                    <th style={thStyle('score')} onClick={() => clickSort('score')} title="BTC 대비 초과수익 가중평균 (24H 20% + 7D 40% + 30D 40%)">RS점수{arrow('score')}</th>
                    <th style={{ ...thStyle(''), textAlign: 'left', cursor: 'default' }}>셋업</th>
                  </tr>
                </thead>
                <tbody>
                  {table.map((r, i) => (
                    <tr key={r.sym} style={{ borderBottom: '0.5px solid var(--border)' }}>
                      <td style={{ padding: '7px 8px', color: 'var(--dim)' }}>{i + 1}</td>
                      <td style={{ padding: '7px 8px', fontWeight: 700 }}>
                        {r.base}
                        {r.mcap > 0 && <span style={{ fontSize: 9, color: 'var(--dim)', fontWeight: 400, marginLeft: 5 }}>{fmtV(r.mcap)}</span>}
                      </td>
                      <td style={{ padding: '7px 8px' }}><Badge t="n">{r.sector}</Badge></td>
                      <td style={{ padding: '7px 8px', textAlign: 'right' }}>{fp(r.price, r.sym)}</td>
                      <td style={{ padding: '7px 8px', textAlign: 'right', color: clr(r.chg.h24) }}>{pct(r.chg.h24)}</td>
                      <td style={{ padding: '7px 8px', textAlign: 'right', color: clr(r.chg.d7) }}>{pct(r.chg.d7)}</td>
                      <td style={{ padding: '7px 8px', textAlign: 'right', color: clr(r.chg.d30) }}>{pct(r.chg.d30)}</td>
                      <td style={{ padding: '7px 8px', textAlign: 'right', fontWeight: 700, color: clr(r.rsScore) }}>{pct(r.rsScore)}</td>
                      <td style={{ padding: '7px 8px' }}><SetupBadges setup={r.setup} interval={candleIv} /></td>
                    </tr>
                  ))}
                  {!table.length && (
                    <tr><td colSpan={9} style={{ padding: 18, textAlign: 'center', color: 'var(--muted)', fontSize: 12 }}>조건에 맞는 코인이 없습니다</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* ── 설명 ── */}
          <div className="notebox">
            <b>RS점수</b> = BTC 대비 초과수익률 가중평균 (24H×20% + 7D×40% + 30D×40%) — 양수면 BTC보다 강함<br />
            <b>MSS↑</b> = 스윙 저점 유동성 스윕 후 구조 고점 상향 돌파 (추세전환) · <b>OTE존</b> = MSS 임펄스 레그의 0.618~0.79 되돌림 구간에 현재가 위치<br />
            <b>골크</b> = SMA50이 SMA200을 최근 30봉 내 상향 돌파 · <b>정배열</b> = SMA50 &gt; SMA200 유지 중 · TOTAL 프록시는 상위 코인 가중 수익률 근사치이며 투자 권유가 아닙니다
          </div>
        </>
      )}
    </div>
  )
}
