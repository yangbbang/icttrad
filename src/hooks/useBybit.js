import { useState, useEffect, useRef, useCallback } from 'react'
import { BYBIT_REST, BYBIT_WS, FALLBACK } from '../utils/constants'
import { fp, fmtV } from '../utils/format'

export function useBybit(sym) {
  const [data, setData]       = useState(null)
  const [status, setStatus]   = useState('connecting') // connecting | live | sim | err
  const [wsBadge, setWsBadge] = useState('connecting')
  const wsRef    = useRef(null)
  const prevOI   = useRef(0)
  const tickRef  = useRef(null)

  // ── 가격 틱 시뮬레이션 (폴백 모드) ──────────────
  const startTick = useCallback((basePrice) => {
    if (tickRef.current) clearInterval(tickRef.current)
    const VOL = { BTCUSDT:0.0003, ETHUSDT:0.0004, SOLUSDT:0.0007, XRPUSDT:0.0006,
                  BNBUSDT:0.0004, DOGEUSDT:0.001, ADAUSDT:0.0008, AVAXUSDT:0.0008, LINKUSDT:0.0007 }
    const v = VOL[sym] || 0.0005
    let p = basePrice
    tickRef.current = setInterval(() => {
      p = p * (1 + (Math.random() - 0.492) * v)
      setData(prev => prev ? { ...prev, price: p } : prev)
    }, 1500)
  }, [sym])

  // ── 폴백 데이터 적용 ────────────────────────────
  const applyFallback = useCallback(() => {
    const f = FALLBACK[sym]; if (!f) return
    const dir  = (f.chg24 > 0 && f.chg7d > 0) ? 'LONG' : 'SHORT'
    const mss  = f.chg24 > 2 ? '상승 MSS' : f.chg24 < -2 ? '하락 MSS' : '없음'
    const d = {
      ...f,
      oiChg: 0, cvd: f.chg24 > 0 ? 0.25 : -0.25,
      swH: f.high24 * 1.003, swL: f.low24 * 0.997,
      d1Bias: f.chg24 > 0 ? 'BULLISH' : 'BEARISH',
      d7Bias: f.chg7d > 0 ? 'BULLISH' : 'BEARISH',
      dir, mss, choch: Math.abs(f.chg24) > 2 ? '확인됨' : '미확인',
      ez:  dir === 'LONG' ? f.price * 0.992 : f.price * 1.008,
      slp: dir === 'LONG' ? f.price * 0.978 : f.price * 1.022,
      tp:  dir === 'LONG' ? f.price * 1.066 : f.price * 0.934,
      frHist: [], isSim: true,
    }
    setData(d)
    setStatus('sim')
    setWsBadge('err')
    startTick(f.price)
  }, [sym, startTick])

  // ── 바이빗 REST (FR / OI / 가격) ────────────────
  const fetchRest = useCallback(async () => {
    try {
      const [tickerRes, frHistRes] = await Promise.all([
        fetch(`${BYBIT_REST}/v5/market/tickers?category=linear&symbol=${sym}`),
        fetch(`${BYBIT_REST}/v5/market/funding/history?category=linear&symbol=${sym}&limit=3`),
      ])
      const tickerJson = await tickerRes.json()
      const frHistJson = await frHistRes.json()
      const t = tickerJson.result?.list?.[0]
      if (!t) throw new Error('ticker 없음')

      const price   = parseFloat(t.lastPrice)
      const chg24   = parseFloat(t.price24hPcnt) * 100
      const high24  = parseFloat(t.highPrice24h)
      const low24   = parseFloat(t.lowPrice24h)
      const vol24   = parseFloat(t.turnover24h)
      const oi      = parseFloat(t.openInterest) * price
      const fr      = parseFloat(t.fundingRate) * 100
      const oiChg   = oi - prevOI.current
      prevOI.current = oi
      const cvd     = chg24 > 0 ? (oiChg > 0 ? 0.4 : 0.15) : (oiChg < 0 ? -0.4 : -0.15)
      const swH     = high24 * 1.003
      const swL     = low24  * 0.997
      const d1Bias  = chg24 > 0 ? 'BULLISH' : 'BEARISH'
      const d7Bias  = d1Bias  // 7D는 별도 히스토리 API 필요 — 24H로 대체
      const dir     = (d1Bias === 'BULLISH' && oiChg >= 0) ? 'LONG' : 'SHORT'
      const mss     = chg24 > 2 ? '상승 MSS' : chg24 < -2 ? '하락 MSS' : '없음'
      const choch   = mss !== '없음' ? '확인됨' : '미확인'
      const frHist  = frHistJson.result?.list || []

      if (tickRef.current) { clearInterval(tickRef.current); tickRef.current = null }

      setData({
        price, chg24, chg7d: chg24, high24, low24, vol24,
        oi, oiChg, fr, cvd, swH, swL,
        d1Bias, d7Bias, dir, mss, choch,
        ez:  dir === 'LONG' ? price * 0.992 : price * 1.008,
        slp: dir === 'LONG' ? price * 0.978 : price * 1.022,
        tp:  dir === 'LONG' ? price * 1.066 : price * 0.934,
        frHist, isSim: false,
      })
      setStatus('live')
    } catch (e) {
      console.warn('Bybit REST 오류:', e.message)
      applyFallback()
    }
  }, [sym, applyFallback])

  // ── 바이빗 WebSocket ─────────────────────────────
  useEffect(() => {
    let ws
    let reconnectTimer

    const connect = () => {
      ws = new WebSocket(BYBIT_WS)
      wsRef.current = ws

      ws.onopen = () => {
        setWsBadge('live')
        ws.send(JSON.stringify({ op: 'subscribe', args: [`tickers.${sym}`] }))
      }
      ws.onmessage = (e) => {
        const msg = JSON.parse(e.data)
        if (msg.topic?.startsWith('tickers.') && msg.data) {
          const d = msg.data
          setData(prev => {
            if (!prev) return prev
            // 바이빗 WS는 스냅샷 이후 변경 필드만 보내는 delta — 있는 필드만 갱신
            const next = { ...prev }
            if (d.lastPrice     !== undefined) next.price  = parseFloat(d.lastPrice)
            if (d.price24hPcnt  !== undefined) next.chg24  = parseFloat(d.price24hPcnt) * 100
            if (d.highPrice24h  !== undefined) next.high24 = parseFloat(d.highPrice24h)
            if (d.lowPrice24h   !== undefined) next.low24  = parseFloat(d.lowPrice24h)
            if (d.turnover24h   !== undefined) next.vol24  = parseFloat(d.turnover24h)
            return next
          })
        }
      }
      ws.onerror   = () => setWsBadge('err')
      ws.onclose   = () => { setWsBadge('err'); reconnectTimer = setTimeout(connect, 3000) }
    }

    connect()
    fetchRest()
    const restInterval = setInterval(fetchRest, 15000)

    return () => {
      if (ws) { wsRef.current = null; try { ws.close() } catch (e) {} }
      clearTimeout(reconnectTimer)
      clearInterval(restInterval)
      if (tickRef.current) clearInterval(tickRef.current)
    }
  }, [sym, fetchRest])

  return { data, status, wsBadge }
}
