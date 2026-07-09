import { useState, useEffect, useRef, useCallback } from 'react'
import { createBybitClient, roundStep } from '../utils/bybitApi'
import { analyzeStrategy, parseKlines } from '../utils/strategy'
import { BYBIT_REST, SYMBOLS } from '../utils/constants'

// 자동매매 엔진 — 회사형 구조
//  🔍 차트 탐색: 전체 심볼 스캔 → 셋업 후보 랭킹
//  📊 분석: 장기추세선 이탈 + MSS + OTE (+쐐기/헤드앤숄더/유동성 스윕)
//  🛡️ 리스크: FR 과열·일일 한도·손실 한도·사이징 (거부권)
//  📚 학습: 거래 이력 승률 분석 → 연속 손실 시 기준 강화
//  🏛️ 회의: 전원 승인 시에만 진입

export const DEFAULT_CFG = {
  env: 'paper',       // paper | demo | live
  apiKey: '',
  apiSecret: '',
  riskPct: 1,         // 1회 손실 허용 (자산 대비 %)
  leverage: 3,
  minScore: 3,        // 진입 최소 전략 점수 (/6, 3 = 필수조건만)
  cooldownMin: 30,    // 심볼별 청산 후 재진입 대기 (분)
  maxDaily: 5,        // 일일 최대 진입 횟수
  paperEquity: 10000,
  htfInterval: 'D',   // 장기추세선 타임프레임 (D | W)
  ltfInterval: '15',  // 진입 타임프레임 (분)
}

const TAKER_FEE = 0.00055  // 페이퍼 수수료 가정 (편도 0.055%)
const SCAN_MS   = 120000   // 스캔 주기
const MEMBERS   = { scan: '🔍 차트탐색', anal: '📊 분석', risk: '🛡️ 리스크', learn: '📚 학습' }

function loadJSON(key, fallback) {
  try {
    const v = JSON.parse(localStorage.getItem(key))
    return v ?? fallback
  } catch { return fallback }
}

async function fetchTicker(sym) {
  const r = await fetch(`${BYBIT_REST}/v5/market/tickers?category=linear&symbol=${sym}`)
  const j = await r.json()
  const t = j.result?.list?.[0]
  if (!t) return null
  return { price: parseFloat(t.lastPrice), fr: parseFloat(t.fundingRate) * 100 }
}

async function fetchAnalysis(sym, htfI, ltfI) {
  const [h, l] = await Promise.all([
    fetch(`${BYBIT_REST}/v5/market/kline?category=linear&symbol=${sym}&interval=${htfI}&limit=200`).then(r => r.json()),
    fetch(`${BYBIT_REST}/v5/market/kline?category=linear&symbol=${sym}&interval=${ltfI}&limit=200`).then(r => r.json()),
  ])
  const htf = parseKlines(h.result?.list || [])
  const ltf = parseKlines(l.result?.list || [])
  if (!htf.length || !ltf.length) return null
  return analyzeStrategy(htf, ltf)
}

export function useAutoTrade({ notify }) {
  const [cfg, setCfg]           = useState(() => ({ ...DEFAULT_CFG, ...loadJSON('at_cfg', {}) }))
  const [running, setRunning]   = useState(false)
  const [position, setPosition] = useState(() => loadJSON('at_pos', null))
  const [equity, setEquity]     = useState(() => loadJSON('at_equity', DEFAULT_CFG.paperEquity))
  const [log, setLog]           = useState(() => loadJSON('at_log', []))
  const [hist, setHist]         = useState(() => loadJSON('at_hist', []))
  const [board, setBoard]       = useState([])      // [{sym, analysis}]
  const [meeting, setMeeting]   = useState(null)    // 최근 회의록
  const [scanAt, setScanAt]     = useState(null)

  const notifyRef  = useRef(notify);   notifyRef.current = notify
  const cfgRef     = useRef(cfg);      cfgRef.current = cfg
  const runningRef = useRef(running);  runningRef.current = running
  const posRef     = useRef(position); posRef.current = position
  const equityRef  = useRef(equity);   equityRef.current = equity
  const histRef    = useRef(hist);     histRef.current = hist
  const busyRef    = useRef(false)
  const lastClose  = useRef({})        // 심볼별 마지막 청산/시도 시각
  const lastReject = useRef({})        // 부결 회의록 로그 스팸 방지
  const daily      = useRef({ date: '', count: 0 })

  const addLog = useCallback((msg, type = 'n') => {
    setLog(prev => {
      const next = [{ t: Date.now(), msg, type }, ...prev].slice(0, 80)
      localStorage.setItem('at_log', JSON.stringify(next))
      return next
    })
  }, [])

  const savePos = useCallback((p) => {
    posRef.current = p
    setPosition(p)
    localStorage.setItem('at_pos', JSON.stringify(p))
  }, [])

  const saveEquity = useCallback((e) => {
    equityRef.current = e
    setEquity(e)
    localStorage.setItem('at_equity', JSON.stringify(e))
  }, [])

  const saveHist = useCallback((rec) => {
    setHist(prev => {
      const next = [rec, ...prev].slice(0, 50)
      histRef.current = next
      localStorage.setItem('at_hist', JSON.stringify(next))
      return next
    })
  }, [])

  const saveCfg = useCallback((next) => {
    setCfg(next)
    localStorage.setItem('at_cfg', JSON.stringify(next))
  }, [])

  const makeClient = useCallback(() => {
    const c = cfgRef.current
    return createBybitClient({ apiKey: c.apiKey.trim(), apiSecret: c.apiSecret.trim(), env: c.env })
  }, [])

  // ── 공통 헬퍼 ─────────────────────────────────────
  function todayStr() { return new Date().toLocaleDateString('ko-KR') }
  function underDailyLimit() {
    if (daily.current.date !== todayStr()) daily.current = { date: todayStr(), count: 0 }
    return daily.current.count < cfgRef.current.maxDaily
  }
  function todayPnl() {
    const today = todayStr()
    return histRef.current
      .filter(h => new Date(h.t).toLocaleDateString('ko-KR') === today)
      .reduce((s, h) => s + h.pnl, 0)
  }
  function lossStreak() {
    let n = 0
    for (const h of histRef.current) { if (h.pnl < 0) n++; else break }
    return n
  }

  // ── 청산 기록 ─────────────────────────────────────
  const recordClose = useCallback((pos, pnl, reason) => {
    lastClose.current[pos.sym] = Date.now()
    savePos(null)
    saveHist({ t: Date.now(), sym: pos.sym, side: pos.side, pnl, reason, env: pos.env, score: pos.score })
    const emoji = pnl >= 0 ? '🟢' : '🔴'
    const tag = pos.env === 'paper' ? '페이퍼' : pos.env === 'demo' ? '데모' : '실거래'
    addLog(`${emoji} [${tag}] ${pos.sym} ${reason} 청산 | PnL ${pnl >= 0 ? '+' : ''}${pnl.toFixed(2)} USDT`, pnl >= 0 ? 'g' : 'r')
    notifyRef.current?.(`${emoji} 자동매매 ${reason} 청산: ${pos.sym} PnL ${pnl >= 0 ? '+' : ''}${pnl.toFixed(2)} USDT`, pnl >= 0 ? 'g' : 'r')
  }, [addLog, saveHist, savePos])

  const closePaper = useCallback((exitPrice, reason) => {
    const pos = posRef.current
    if (!pos) return
    const sign = pos.side === 'Buy' ? 1 : -1
    const pnl = (exitPrice - pos.entry) * pos.qty * sign - (pos.entry + exitPrice) * pos.qty * TAKER_FEE
    saveEquity(equityRef.current + pnl)
    recordClose(pos, pnl, reason)
  }, [recordClose, saveEquity])

  // ── 진입 실행 ─────────────────────────────────────
  const enter = useCallback(async (sym, signal) => {
    const c = cfgRef.current
    const side = signal.side === 'LONG' ? 'Buy' : 'Sell'
    const { entry, sl, tp } = signal
    const why = signal.reasons.join(' + ')

    busyRef.current = true
    try {
      if (c.env === 'paper') {
        const eq = equityRef.current
        let qty = (eq * c.riskPct / 100) / Math.abs(entry - sl)
        qty = Math.min(qty, (eq * c.leverage) / entry)
        if (!(qty > 0)) return
        savePos({ sym, side, qty, entry, sl, tp, cur: entry, env: 'paper', time: Date.now(), score: signal.score })
        daily.current.count++
        addLog(`⚡ [페이퍼] ${sym} ${signal.side} 진입 @ ${entry.toFixed(4)} | SL ${sl.toFixed(4)} / TP ${tp.toFixed(4)} | ${why}`, 'g')
        notifyRef.current?.(`⚡ 자동매매 진입(페이퍼): ${sym} ${signal.side} @ ${entry.toFixed(4)}\n${why}`, 'g')
        return
      }

      const client = makeClient()
      const [eq, inst] = await Promise.all([client.getEquity(), client.getInstrument(sym)])
      if (!(eq > 0)) throw new Error('잔고 조회 실패 (0 USDT)')
      await client.setLeverage(sym, c.leverage)

      let qty = (eq * c.riskPct / 100) / Math.abs(entry - sl)
      qty = Math.min(qty, (eq * c.leverage * 0.95) / entry)
      const qtyStr = roundStep(qty, inst.qtyStep)
      if (parseFloat(qtyStr) < inst.minQty) throw new Error(`수량 ${qtyStr} < 최소 ${inst.minQty} — 자산 부족 또는 리스크% 부족`)

      await client.marketOrder({
        symbol: sym, side, qty: qtyStr,
        stopLoss: roundStep(sl, inst.tickSize),
        takeProfit: roundStep(tp, inst.tickSize),
      })
      const p = await client.getPosition(sym)
      savePos({
        sym, side, qty: p?.qty ?? parseFloat(qtyStr),
        entry: p?.entry ?? entry, sl, tp, env: c.env, time: Date.now(), score: signal.score,
      })
      saveEquity(eq)
      daily.current.count++
      const tag = c.env === 'live' ? '실거래' : '데모'
      addLog(`⚡ [${tag}] ${sym} ${signal.side} 진입 @ ${(p?.entry ?? entry).toFixed(4)} | 수량 ${qtyStr} | ${why}`, 'g')
      notifyRef.current?.(`⚡ 자동매매 진입(${tag}): ${sym} ${signal.side} @ ${entry.toFixed(4)}\n${why}`, 'g')
    } catch (e) {
      addLog(`❌ 진입 실패(${sym}): ${e.message}`, 'r')
      lastClose.current[sym] = Date.now() // 오류 반복 방지
    } finally {
      busyRef.current = false
    }
  }, [addLog, makeClient, saveEquity, savePos])

  // ── 🏛️ 회의: 4역할 의견 취합 → 만장일치 시 진입 ────
  const holdMeeting = useCallback(async (candidates) => {
    const c = cfgRef.current
    const votes = []
    let approved = true

    // 🔍 차트 탐색 보고
    const withSignal = candidates.filter(x => x.analysis?.signal)
    if (!withSignal.length) return
    withSignal.sort((a, b) => b.analysis.signal.score - a.analysis.signal.score)
    const top = withSignal[0]
    const sig = top.analysis.signal
    votes.push({ who: MEMBERS.scan, ok: true, note: `${SYMBOLS.length}개 스캔 → 셋업 ${withSignal.length}건, 최우선 ${top.sym} ${sig.side} (${sig.score}/6)` })

    // 📊 분석 보고
    votes.push({ who: MEMBERS.anal, ok: true, note: `${sig.reasons.join(' + ')} | 진입 ${sig.entry.toFixed(4)} / SL ${sig.sl.toFixed(4)} / TP ${sig.tp.toFixed(4)}` })

    // 📚 학습 보고 — 연속 손실 시 기준 강화
    const recent = histRef.current.slice(0, 10)
    const wins = recent.filter(h => h.pnl >= 0).length
    const streak = lossStreak()
    const effMin = c.minScore + (streak >= 3 ? 1 : 0)
    const learnOk = sig.score >= effMin
    votes.push({
      who: MEMBERS.learn, ok: learnOk,
      note: recent.length
        ? `최근 ${recent.length}건 승률 ${Math.round(wins / recent.length * 100)}%${streak >= 3 ? ` | ${streak}연패 → 기준 ${effMin}/6로 강화` : ''} → ${learnOk ? '승인' : `점수 미달 (${sig.score}<${effMin})`}`
        : `이력 없음 — 기준 ${effMin}/6 ${learnOk ? '충족, 승인' : `미달 (${sig.score})`}`,
    })
    if (!learnOk) approved = false

    // 🛡️ 리스크 보고 — 거부권
    const riskNotes = []
    let riskOk = true
    if (!underDailyLimit()) { riskOk = false; riskNotes.push(`일일 한도 ${c.maxDaily}회 소진`) }
    const cool = lastClose.current[top.sym]
    if (cool && Date.now() - cool < c.cooldownMin * 60000) { riskOk = false; riskNotes.push(`${top.sym} 쿨다운 중`) }
    const dayPnl = todayPnl()
    const dayLimit = -(equityRef.current * c.riskPct * 3 / 100)
    if (dayPnl < dayLimit) { riskOk = false; riskNotes.push(`일일 손실 한도 초과 (${dayPnl.toFixed(2)} USDT)`) }
    if (c.env !== 'paper' && (!c.apiKey.trim() || !c.apiSecret.trim())) { riskOk = false; riskNotes.push('API 키 미설정') }
    let fr = null
    if (riskOk) {
      const t = await fetchTicker(top.sym).catch(() => null)
      fr = t?.fr ?? null
      if (fr != null && !(fr >= -0.01 && fr < 0.1)) { riskOk = false; riskNotes.push(`FR ${fr.toFixed(4)}% 과열`) }
    }
    const rr = Math.abs(sig.tp - sig.entry) / Math.abs(sig.entry - sig.sl)
    if (riskOk && rr < 1.5) { riskOk = false; riskNotes.push(`R:R ${rr.toFixed(2)} 미달`) }
    votes.push({
      who: MEMBERS.risk, ok: riskOk,
      note: riskOk
        ? `FR ${fr != null ? fr.toFixed(4) + '%' : '—'} 정상 | R:R ${rr.toFixed(1)}:1 | 리스크 ${c.riskPct}% | 오늘 ${daily.current.count}/${c.maxDaily}회 → 승인`
        : riskNotes.join(', '),
    })
    if (!riskOk) approved = false

    const minutes = { t: Date.now(), sym: top.sym, side: sig.side, score: sig.score, votes, approved }
    setMeeting(minutes)

    if (approved) {
      addLog(`🏛️ 회의 만장일치 — ${top.sym} ${sig.side} 진입 의결 (${sig.score}/6)`, 'g')
      await enter(top.sym, sig)
    } else {
      const now = Date.now()
      if (!lastReject.current[top.sym] || now - lastReject.current[top.sym] > 600000) {
        lastReject.current[top.sym] = now
        const vetos = votes.filter(v => !v.ok).map(v => `${v.who}: ${v.note}`).join(' / ')
        addLog(`🏛️ 회의 부결 — ${top.sym} ${sig.side} | ${vetos}`, 'n')
      }
    }
  }, [addLog, enter])

  // ── 🔍 스캐너: 전체 심볼 주기 스캔 ─────────────────
  const scan = useCallback(async () => {
    const c = cfgRef.current
    const results = await Promise.all(SYMBOLS.map(async sym => {
      try {
        return { sym, analysis: await fetchAnalysis(sym, c.htfInterval, c.ltfInterval) }
      } catch { return { sym, analysis: null } }
    }))
    setBoard(results)
    setScanAt(Date.now())
    return results
  }, [])

  useEffect(() => {
    let alive = true
    const cycle = async () => {
      const b = await scan()
      if (!alive) return
      if (runningRef.current && !posRef.current && !busyRef.current) {
        await holdMeeting(b).catch(e => addLog(`⚠️ 회의 오류: ${e.message}`, 'r'))
      }
    }
    cycle()
    const id = setInterval(cycle, SCAN_MS)
    return () => { alive = false; clearInterval(id) }
  }, [scan, holdMeeting, addLog, cfg.htfInterval, cfg.ltfInterval])

  // ── 페이퍼 포지션 감시 (심볼 무관, 10초 폴링) ───────
  useEffect(() => {
    if (!running) return
    const id = setInterval(async () => {
      const pos = posRef.current
      if (!pos || pos.env !== 'paper') return
      const t = await fetchTicker(pos.sym).catch(() => null)
      if (!t?.price) return
      const price = t.price
      if (pos.side === 'Buy') {
        if (price <= pos.sl) return closePaper(pos.sl, 'SL')
        if (price >= pos.tp) return closePaper(pos.tp, 'TP')
      } else {
        if (price >= pos.sl) return closePaper(pos.sl, 'SL')
        if (price <= pos.tp) return closePaper(pos.tp, 'TP')
      }
      savePos({ ...pos, cur: price })
    }, 10000)
    return () => clearInterval(id)
  }, [running, closePaper, savePos])

  // ── 데모/실거래 포지션 폴링 (서버측 SL/TP 체결 감지) ──
  useEffect(() => {
    if (!running || cfg.env === 'paper') return
    const id = setInterval(async () => {
      const pos = posRef.current
      if (!pos || pos.env === 'paper' || busyRef.current) return
      try {
        const client = makeClient()
        const p = await client.getPosition(pos.sym)
        if (!p) {
          const pnl = await client.getLastClosedPnl(pos.sym).catch(() => null)
          recordClose(pos, pnl ?? 0, 'SL/TP')
          const eq = await client.getEquity().catch(() => null)
          if (eq != null) saveEquity(eq)
        } else {
          savePos({ ...pos, unrealised: p.unrealisedPnl, entry: p.entry, qty: p.qty })
        }
      } catch (e) {
        addLog(`⚠️ 포지션 조회 실패: ${e.message}`, 'r')
      }
    }, 20000)
    return () => clearInterval(id)
  }, [running, cfg.env, addLog, makeClient, recordClose, saveEquity, savePos])

  // ── 시작 / 정지 ───────────────────────────────────
  const start = useCallback(async () => {
    const c = cfgRef.current
    if (c.env !== 'paper') {
      if (!c.apiKey.trim() || !c.apiSecret.trim()) {
        addLog('❌ API Key/Secret을 입력하세요', 'r')
        return false
      }
      try {
        const client = makeClient()
        const eq = await client.getEquity()
        saveEquity(eq)
        addLog(`✅ ${c.env === 'live' ? '실거래' : '데모'} 연결 성공 — 자산 ${eq.toFixed(2)} USDT`, 'g')
      } catch (e) {
        addLog(`❌ API 연결 실패: ${e.message}`, 'r')
        return false
      }
    } else {
      if (!posRef.current) saveEquity(equityRef.current || c.paperEquity)
      addLog(`✅ 페이퍼 모드 시작 — 가상 자산 ${equityRef.current.toFixed(2)} USDT`, 'g')
    }
    setRunning(true)
    runningRef.current = true
    return true
  }, [addLog, makeClient, saveEquity])

  const stop = useCallback(() => {
    setRunning(false)
    runningRef.current = false
    addLog('⏸ 자동매매 정지 (보유 포지션은 유지됨)', 'n')
  }, [addLog])

  // ── 수동 청산 ─────────────────────────────────────
  const closeNow = useCallback(async () => {
    const pos = posRef.current
    if (!pos) return
    if (pos.env === 'paper') {
      const t = await fetchTicker(pos.sym).catch(() => null)
      closePaper(t?.price || pos.cur || pos.entry, '수동')
      return
    }
    busyRef.current = true
    try {
      const client = makeClient()
      await client.closePosition({ symbol: pos.sym, side: pos.side, qty: pos.qty })
      const pnl = await client.getLastClosedPnl(pos.sym).catch(() => null)
      recordClose(pos, pnl ?? 0, '수동')
    } catch (e) {
      addLog(`❌ 수동 청산 실패: ${e.message}`, 'r')
    } finally {
      busyRef.current = false
    }
  }, [addLog, closePaper, makeClient, recordClose])

  // ── 페이퍼 자산 초기화 ─────────────────────────────
  const resetPaper = useCallback(() => {
    if (posRef.current?.env === 'paper') savePos(null)
    saveEquity(cfgRef.current.paperEquity)
    addLog(`🔄 페이퍼 자산 초기화 → ${cfgRef.current.paperEquity} USDT`, 'n')
  }, [addLog, saveEquity, savePos])

  return {
    cfg, saveCfg, running, start, stop,
    position, equity, log, hist,
    board, meeting, scanAt,
    closeNow, resetPaper,
  }
}
