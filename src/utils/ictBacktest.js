/**
 * ICT 백테스팅 엔진
 * 조건:
 * ① HTF 방향 일치 (앞쪽 20% 캔들)
 * ② 스윙 고저점 돌파 → MSS 감지 (3봉 고정)
 * ③ Bull/Bear OB 확인 (직전 4봉 탐색)
 * ④ FVG 겹침 → 진입 존 정밀화
 * ⑤ 진입: OB+FVG 중앙 / SL: OB 하단 -0.5% / TP: R:R 3:1
 */
export function ictBacktest(candles) {
  const trades = []
  const n = candles.length
  let equity = 10000
  const SWING = 3

  const isSwH = i => {
    if (i < SWING || i >= n - SWING) return false
    const h = candles[i].h
    for (let j = i - SWING; j <= i + SWING; j++) {
      if (j !== i && candles[j].h >= h) return false
    }
    return true
  }
  const isSwL = i => {
    if (i < SWING || i >= n - SWING) return false
    const l = candles[i].l
    for (let j = i - SWING; j <= i + SWING; j++) {
      if (j !== i && candles[j].l <= l) return false
    }
    return true
  }
  const bullFVG = i => {
    if (i < 1 || i >= n - 1) return null
    const g = candles[i + 1].l - candles[i - 1].h
    return g > 0 ? { lo: candles[i - 1].h, hi: candles[i + 1].l } : null
  }
  const bearFVG = i => {
    if (i < 1 || i >= n - 1) return null
    const g = candles[i - 1].l - candles[i + 1].h
    return g > 0 ? { lo: candles[i + 1].h, hi: candles[i - 1].l } : null
  }
  const bullOB = i => {
    for (let j = i - 1; j >= Math.max(0, i - 4); j--) {
      if (candles[j].c < candles[j].o) return { lo: candles[j].l, hi: candles[j].c }
    }
    return null
  }
  const bearOB = i => {
    for (let j = i - 1; j >= Math.max(0, i - 4); j--) {
      if (candles[j].c > candles[j].o) return { lo: candles[j].c, hi: candles[j].h }
    }
    return null
  }

  // 스윙 목록
  const swH = [], swL = []
  for (let i = SWING; i < n - SWING; i++) {
    if (isSwH(i)) swH.push({ i, p: candles[i].h })
    if (isSwL(i)) swL.push({ i, p: candles[i].l })
  }

  // HTF 방향 (앞쪽 20%)
  const htfSlice = candles.slice(0, Math.max(5, Math.floor(n * 0.2)))
  const htfBull = htfSlice.filter(c => c.c > c.o).length > htfSlice.length / 2

  for (let i = SWING + 3; i < n - 8; i++) {
    const c = candles[i]
    const rH = swH.filter(s => s.i < i).slice(-3)
    const rL = swL.filter(s => s.i < i).slice(-3)
    if (!rH.length || !rL.length) continue

    const lH = rH[rH.length - 1]
    const lL = rL[rL.length - 1]
    const isBull = c.c > lH.p
    const isBear = c.c < lL.p
    if (!isBull && !isBear) continue
    if (isBull && !htfBull) continue
    if (isBear &&  htfBull) continue

    if (isBull) {
      const ob = bullOB(i); if (!ob) continue
      const fvg = bullFVG(i - 1)
      let eLo = ob.lo, eHi = ob.hi, setup = 'Bull OB'
      if (fvg) {
        const oLo = Math.max(ob.lo, fvg.lo), oHi = Math.min(ob.hi, fvg.hi)
        if (oHi > oLo) { eLo = oLo; eHi = oHi; setup = 'Bull OB+FVG' }
      }
      const entry = (eLo + eHi) / 2
      const sl = eLo * 0.995
      const tp = entry + (entry - sl) * 3
      if (sl >= entry || tp <= entry) continue
      let win = null
      for (let j = i + 1; j < Math.min(i + 15, n); j++) {
        if (candles[j].l <= sl) { win = false; break }
        if (candles[j].h >= tp) { win = true;  break }
      }
      if (win === null) continue
      const pnl = win ? equity * 0.02 * 3 : -equity * 0.02
      equity += pnl
      trades.push({ date: c.date, month: c.month, dir: 'LONG', setup, entry, sl, tp, win, pnl: Math.round(pnl), equity: Math.round(equity) })
    }

    if (isBear) {
      const ob = bearOB(i); if (!ob) continue
      const fvg = bearFVG(i - 1)
      let eLo = ob.lo, eHi = ob.hi, setup = 'Bear OB'
      if (fvg) {
        const oLo = Math.max(ob.lo, fvg.lo), oHi = Math.min(ob.hi, fvg.hi)
        if (oHi > oLo) { eLo = oLo; eHi = oHi; setup = 'Bear OB+FVG' }
      }
      const entry = (eLo + eHi) / 2
      const sl = eHi * 1.005
      const tp = entry - (sl - entry) * 3
      if (sl <= entry || tp >= entry) continue
      let win = null
      for (let j = i + 1; j < Math.min(i + 15, n); j++) {
        if (candles[j].h >= sl) { win = false; break }
        if (candles[j].l <= tp) { win = true;  break }
      }
      if (win === null) continue
      const pnl = win ? equity * 0.02 * 3 : -equity * 0.02
      equity += pnl
      trades.push({ date: c.date, month: c.month, dir: 'SHORT', setup, entry, sl, tp, win, pnl: Math.round(pnl), equity: Math.round(equity) })
    }
  }
  return trades
}

export function calcStats(trades) {
  if (!trades.length) return null
  const wins = trades.filter(t => t.win).length
  const tot  = trades.length
  const wr   = (wins / tot * 100).toFixed(1)
  const ev   = ((parseFloat(wr) / 100) * 3 - (1 - parseFloat(wr) / 100)).toFixed(2)
  let mW = 0, mL = 0, cW = 0, cL = 0
  trades.forEach(t => {
    if (t.win) { cW++; cL = 0; mW = Math.max(mW, cW) }
    else       { cL++; cW = 0; mL = Math.max(mL, cL) }
  })
  const bySetup = {}
  trades.forEach(t => {
    if (!bySetup[t.setup]) bySetup[t.setup] = { w: 0, l: 0, pnl: 0 }
    t.win ? bySetup[t.setup].w++ : bySetup[t.setup].l++
    bySetup[t.setup].pnl += t.pnl
  })
  const byMonth = {}
  trades.forEach(t => {
    if (!byMonth[t.month]) byMonth[t.month] = { w: 0, l: 0 }
    t.win ? byMonth[t.month].w++ : byMonth[t.month].l++
  })
  return { wr, ev, tot, wins, mW, mL, bySetup, byMonth }
}
