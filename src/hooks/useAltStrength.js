import { useState, useEffect, useRef, useCallback } from 'react'
import { BYBIT_REST, CG } from '../utils/constants'
import { cleanBase, sectorOf, EXCLUDE_BASES, computeChg, relStrength, rsScoreOf, detectSetups } from '../utils/altStrength'

// 인터벌별 봉 수 (24H / 7D / 30D 수익률 계산용)
const BARS = {
  'D':   { h24: 1, d7: 7,  d30: 30,  limit: 400 },
  '240': { h24: 6, d7: 42, d30: 180, limit: 400 },
}

const REFRESH_MS = 180000  // 3분 자동 갱신
const TOP_N      = 50      // 거래대금 상위 알트 수
const CHUNK      = 10      // 캔들 동시 요청 수

export function useAltStrength(interval) {
  const [rows,     setRows]     = useState([])
  const [status,   setStatus]   = useState('loading') // loading | live | err
  const [progress, setProgress] = useState(0)
  const [updated,  setUpdated]  = useState(null)
  const [errMsg,   setErrMsg]   = useState('')
  const busy = useRef(false)
  const mcapRef = useRef({})   // 심볼 → 시총 (CoinGecko, 실패 시 빈 객체)

  const load = useCallback(async () => {
    if (busy.current) return
    busy.current = true
    setProgress(0)
    try {
      // ① 시총 조회 (CoinGecko 상위 100 — 실패해도 거래대금 가중으로 진행)
      if (!Object.keys(mcapRef.current).length) {
        try {
          const r = await fetch(`${CG}/coins/markets?vs_currency=usd&order=market_cap_desc&per_page=100&page=1&sparkline=false`)
          const js = await r.json()
          if (Array.isArray(js)) {
            const m = {}
            js.forEach(c => {
              const s = (c.symbol || '').toUpperCase()
              if (!(s in m)) m[s] = c.market_cap || 0
            })
            mcapRef.current = m
          }
        } catch (e) { /* 시총 없이 진행 */ }
      }

      // ② 바이빗 전체 티커 → 거래대금 상위 알트 유니버스
      const tr = await fetch(`${BYBIT_REST}/v5/market/tickers?category=linear`)
      const tj = await tr.json()
      const list = tj.result?.list || []
      if (!list.length) throw new Error('바이빗 티커 응답 없음')

      const perps = list
        .filter(t => t.symbol.endsWith('USDT'))
        .map(t => ({ sym: t.symbol, base: cleanBase(t.symbol), turnover: parseFloat(t.turnover24h) || 0 }))
        .filter(t => t.base && !EXCLUDE_BASES.has(t.base))
        .sort((a, b) => b.turnover - a.turnover)

      const btcT = perps.find(p => p.sym === 'BTCUSDT')
      if (!btcT) throw new Error('BTCUSDT 없음')
      const universe = [btcT, ...perps.filter(p => p.sym !== 'BTCUSDT').slice(0, TOP_N)]

      // ③ 캔들 배치 로드
      const bars = BARS[interval]
      const loaded = []
      for (let i = 0; i < universe.length; i += CHUNK) {
        const chunk = universe.slice(i, i + CHUNK)
        const res = await Promise.all(chunk.map(async u => {
          try {
            const kr = await fetch(`${BYBIT_REST}/v5/market/kline?category=linear&symbol=${u.sym}&interval=${interval}&limit=${bars.limit}`)
            const kj = await kr.json()
            const raw = kj.result?.list || []
            if (raw.length < 40) return null
            // 바이빗은 최신순 → 시간순으로 뒤집기
            const candles = raw.map(k => ({ t: +k[0], o: +k[1], h: +k[2], l: +k[3], c: +k[4] })).reverse()
            return { ...u, candles }
          } catch { return null }
        }))
        loaded.push(...res.filter(Boolean))
        setProgress(Math.round(Math.min(i + CHUNK, universe.length) / universe.length * 100))
      }

      const btcRow = loaded.find(r => r.sym === 'BTCUSDT')
      if (!btcRow) throw new Error('BTC 캔들 로드 실패')
      const btcChg = computeChg(btcRow.candles, bars)

      const next = loaded.map(r => {
        const chg = computeChg(r.candles, bars)
        const rs  = relStrength(chg, btcChg)
        return {
          sym: r.sym,
          base: r.base,
          sector: sectorOf(r.base),
          price: r.candles[r.candles.length - 1].c,
          turnover: r.turnover,
          mcap: mcapRef.current[r.base] || 0,
          chg, rs,
          rsScore: rsScoreOf(rs),
          setup: detectSetups(r.candles),
        }
      })

      setRows(next)
      setStatus('live')
      setUpdated(new Date())
      setErrMsg('')
    } catch (e) {
      setErrMsg(e.message || '로드 실패')
      setStatus(prev => prev === 'live' ? 'live' : 'err')
    } finally {
      busy.current = false
    }
  }, [interval])

  useEffect(() => {
    setStatus('loading')
    setRows([])
    load()
    const id = setInterval(load, REFRESH_MS)
    return () => clearInterval(id)
  }, [load])

  return { rows, status, progress, updated, errMsg, refresh: load }
}
