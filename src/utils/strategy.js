// ICT + OTE + 패턴 전략 엔진
// 우선순위: ① 장기추세선 이탈(HTF, 필수) → ② MSS 방향 일치(LTF, 필수)
//          → ③ OTE 존(0.62~0.79) 진입(필수) → 쐐기/헤드앤숄더 컨플루언스(가산점)

// ── Bybit kline 파싱 (최신순 → 과거순 배열로 변환) ──
export function parseKlines(list) {
  return [...list].reverse().map(r => ({
    t: +r[0], o: +r[1], h: +r[2], l: +r[3], c: +r[4], v: +r[5],
  }))
}

// ── 피벗(스윙) 고저점 ──
export function findPivots(cs, left = 3, right = 3) {
  const highs = [], lows = []
  for (let i = left; i < cs.length - right; i++) {
    let isH = true, isL = true
    for (let k = i - left; k <= i + right; k++) {
      if (k === i) continue
      if (cs[k].h >= cs[i].h) isH = false
      if (cs[k].l <= cs[i].l) isL = false
      if (!isH && !isL) break
    }
    if (isH) highs.push({ i, p: cs[i].h, t: cs[i].t })
    if (isL) lows.push({ i, p: cs[i].l, t: cs[i].t })
  }
  return { highs, lows }
}

// ── 장기추세선 (가장 중요) ─────────────────────────────
// 주요 극점(전체 최고/최저 피벗)을 앵커로, 종가 위반이 거의 없고
// 터치가 가장 많은 선을 채택. kind='high' → 하락 저항선, 'low' → 상승 지지선
export function findTrendline(cs, pivots, kind) {
  const pts = kind === 'high' ? pivots.highs : pivots.lows
  const usable = pts.filter(p => p.i < cs.length - 5)
  if (usable.length < 2) return null

  const anchor = usable.reduce((m, p) =>
    kind === 'high' ? (p.p > m.p ? p : m) : (p.p < m.p ? p : m))

  const n = cs.length
  let best = null
  for (const b of usable) {
    if (b.i <= anchor.i + 2) continue
    const slope = (b.p - anchor.p) / (b.i - anchor.i)
    if (kind === 'high' && slope >= 0) continue
    if (kind === 'low'  && slope <= 0) continue

    const lineAt = i => anchor.p + slope * (i - anchor.i)

    // 마지막 연속 이탈 구간(신선한 돌파)은 위반으로 세지 않음
    let run = 0
    for (let i = n - 1; i >= anchor.i && run < 10; i--) {
      const v = lineAt(i)
      const beyond = kind === 'high' ? cs[i].c > v * 1.001 : cs[i].c < v * 0.999
      if (!beyond) break
      run++
    }

    let viol = 0, touch = 0
    for (let i = anchor.i; i < n - run; i++) {
      const v = lineAt(i)
      if (kind === 'high') {
        if (cs[i].c > v * 1.002) viol++
        else if (cs[i].h > v * 0.997) touch++
      } else {
        if (cs[i].c < v * 0.998) viol++
        else if (cs[i].l < v * 1.003) touch++
      }
      if (viol > 1) break
    }
    if (viol > 1) continue
    if (!best || touch > best.touch) best = { anchor, slope, touch, run }
  }
  if (!best || best.touch < 2) return null

  const now = n - 1
  const value = best.anchor.p + best.slope * (now - best.anchor.i)
  const last = cs[now]
  // 이탈: 종가가 선 너머 + 돌파가 신선(10봉 이내)할 때만
  const beyondNow = kind === 'high' ? last.c > value * 1.001 : last.c < value * 0.999
  const broken = beyondNow && best.run >= 1 && best.run < 10
  return {
    kind, value, slope: best.slope, touches: best.touch, broken,
    freshBars: best.run, ageBars: now - best.anchor.i,
  }
}

// ── MSS / BOS (LTF 구조 돌파) ──────────────────────────
// 확정된 직전 피벗 고점/저점을 종가로 돌파한 가장 최근 이벤트
export function detectMSS(cs, pivots, right = 3) {
  const { highs, lows } = pivots
  let event = null
  let hIdx = 0, lIdx = 0
  let lastH = null, lastL = null
  for (let i = 0; i < cs.length; i++) {
    while (hIdx < highs.length && highs[hIdx].i + right <= i) { lastH = highs[hIdx]; hIdx++ }
    while (lIdx < lows.length  && lows[lIdx].i  + right <= i) { lastL = lows[lIdx];  lIdx++ }
    if (lastH && cs[i].c > lastH.p) {
      event = { dir: 'bull', level: lastH.p, breakIdx: i }
      lastH = null
    } else if (lastL && cs[i].c < lastL.p) {
      event = { dir: 'bear', level: lastL.p, breakIdx: i }
      lastL = null
    }
  }
  return event
}

// ── OTE (Optimal Trade Entry) ──────────────────────────
// MSS 임펄스 레그의 0.62~0.79 되돌림 존. SL = 1.13 확장, TP = -0.5 확장 (≈R:R 2.8:1)
export function computeOTE(cs, mss, lookback = 30) {
  if (!mss) return null
  const { breakIdx, dir } = mss
  const last = cs[cs.length - 1]
  const from = Math.max(0, breakIdx - lookback)

  if (dir === 'bull') {
    let lo = Infinity
    for (let i = from; i <= breakIdx; i++) if (cs[i].l < lo) lo = cs[i].l
    let hi = -Infinity
    for (let i = breakIdx; i < cs.length; i++) if (cs[i].h > hi) hi = cs[i].h
    const range = hi - lo
    if (!(range > 0)) return null
    const zoneHi = hi - 0.62 * range
    const zoneLo = hi - 0.79 * range
    const sl = lo - 0.13 * range
    const tp = hi + 0.5 * range
    const inZone = last.c <= zoneHi && last.c >= zoneLo
    const invalid = last.c < sl
    return { dir: 'LONG', hi, lo, zoneHi, zoneLo, sl, tp, inZone, invalid }
  }

  let hi = -Infinity
  for (let i = from; i <= breakIdx; i++) if (cs[i].h > hi) hi = cs[i].h
  let lo = Infinity
  for (let i = breakIdx; i < cs.length; i++) if (cs[i].l < lo) lo = cs[i].l
  const range = hi - lo
  if (!(range > 0)) return null
  const zoneLo = lo + 0.62 * range
  const zoneHi = lo + 0.79 * range
  const sl = hi + 0.13 * range
  const tp = lo - 0.5 * range
  const inZone = last.c >= zoneLo && last.c <= zoneHi
  const invalid = last.c > sl
  return { dir: 'SHORT', hi, lo, zoneHi, zoneLo, sl, tp, inZone, invalid }
}

// ── 유동성 스윕 (Turtle Soup) ──────────────────────────
// 직전 피벗 저점/고점을 꼬리로 스윕 후 종가 회복 → 반전 신호
export function detectSweep(cs, pivots, window = 12) {
  const n = cs.length
  for (let i = n - 1; i >= Math.max(1, n - window); i--) {
    const c = cs[i]
    const pl = pivots.lows.filter(l => l.i < i - 1)
    if (pl.length) {
      const lv = pl[pl.length - 1].p
      if (c.l < lv && c.c > lv) return { dir: 'bull', level: lv, idx: i }
    }
    const ph = pivots.highs.filter(h => h.i < i - 1)
    if (ph.length) {
      const hv = ph[ph.length - 1].p
      if (c.h > hv && c.c < hv) return { dir: 'bear', level: hv, idx: i }
    }
  }
  return null
}

// ── 청산 클러스터 추정 (코인글래스 히트맵 근사) ─────────
// 각 봉 종가에서 10/25/50/100x 진입 가정 → 청산가 산출,
// 이후 가격이 지나가며 소진된 레벨은 제외, 거래량 가중으로 집계
export function estimateLiqClusters(cs, binCount = 60) {
  const n = cs.length
  if (n < 20) return { above: [], below: [] }
  const price = cs[n - 1].c
  const lo = Math.min(...cs.map(c => c.l)) * 0.92
  const hi = Math.max(...cs.map(c => c.h)) * 1.08
  const bins = new Array(binCount).fill(0)
  const toIdx = p => Math.floor((p - lo) / (hi - lo) * binCount)

  // 각 봉 이후의 최저/최고 (청산 레벨 소진 판정용)
  const minAfter = new Array(n), maxAfter = new Array(n)
  let mn = Infinity, mx = -Infinity
  for (let i = n - 1; i >= 0; i--) {
    minAfter[i] = mn; maxAfter[i] = mx
    mn = Math.min(mn, cs[i].l); mx = Math.max(mx, cs[i].h)
  }

  const LEVS = [10, 25, 50, 100]
  for (let i = Math.max(0, n - 150); i < n; i++) {
    const c = cs[i]
    for (const lev of LEVS) {
      const w = c.v / Math.sqrt(lev)
      const liqLong = c.c * (1 - 1 / lev)   // 롱 청산 → 현재가 아래
      if (minAfter[i] > liqLong) {          // 아직 미소진
        const b = toIdx(liqLong)
        if (b >= 0 && b < binCount) bins[b] += w
      }
      const liqShort = c.c * (1 + 1 / lev)  // 숏 청산 → 현재가 위
      if (maxAfter[i] < liqShort) {
        const b = toIdx(liqShort)
        if (b >= 0 && b < binCount) bins[b] += w
      }
    }
  }

  const maxW = Math.max(...bins, 1)
  const all = bins.map((w, i) => ({ p: lo + (hi - lo) * (i + 0.5) / binCount, w: w / maxW }))
    .filter(b => b.w > 0.15)
  const above = all.filter(b => b.p > price * 1.002).sort((a, b) => b.w - a.w).slice(0, 3)
  const below = all.filter(b => b.p < price * 0.998).sort((a, b) => b.w - a.w).slice(0, 3)
  return { above, below }
}

// ── 최소자승 기울기 ──
function slopeFit(pts) {
  const n = pts.length
  const mx = pts.reduce((s, p) => s + p.i, 0) / n
  const my = pts.reduce((s, p) => s + p.p, 0) / n
  let num = 0, den = 0
  for (const p of pts) { num += (p.i - mx) * (p.p - my); den += (p.i - mx) ** 2 }
  return den ? num / den : 0
}

// ── 쐐기 패턴 ──────────────────────────────────────────
// 하락 쐐기(고점선이 저점선보다 가파르게 하락, 수렴) → 상방 이탈 시 LONG
// 상승 쐐기(저점선이 더 가파르게 상승, 수렴) → 하방 이탈 시 SHORT
export function detectWedge(cs, pivots) {
  const hs = pivots.highs.slice(-4)
  const ls = pivots.lows.slice(-4)
  if (hs.length < 3 || ls.length < 3) return null
  const sh = slopeFit(hs)
  const sl = slopeFit(ls)
  const last = cs[cs.length - 1]
  const norm = last.c
  const shn = sh / norm, sln = sl / norm

  if (shn < -0.0002 && sln < -0.0002 && sh < sl) {
    const b = hs[hs.length - 1]
    const upper = b.p + sh * (cs.length - 1 - b.i)
    return { type: 'falling', bias: 'LONG', line: upper, breakout: last.c > upper }
  }
  if (shn > 0.0002 && sln > 0.0002 && sl > sh) {
    const b = ls[ls.length - 1]
    const lower = b.p + sl * (cs.length - 1 - b.i)
    return { type: 'rising', bias: 'SHORT', line: lower, breakout: last.c < lower }
  }
  return null
}

// ── 헤드앤숄더 / 역헤드앤숄더 ──────────────────────────
export function detectHNS(cs, pivots) {
  const { highs, lows } = pivots
  const last = cs[cs.length - 1]

  if (highs.length >= 3) {
    const [ls_, head, rs] = highs.slice(-3)
    if (head.p > ls_.p && head.p > rs.p &&
        Math.abs(ls_.p - rs.p) / head.p < 0.03 &&
        (head.p - Math.max(ls_.p, rs.p)) / head.p > 0.004 &&
        rs.i > cs.length - 45) {
      const n1 = lows.find(l => l.i > ls_.i && l.i < head.i)
      const n2 = lows.find(l => l.i > head.i && l.i < rs.i + 8)
      if (n1 && n2 && n2.i > n1.i) {
        const slope = (n2.p - n1.p) / (n2.i - n1.i)
        const neck = n2.p + slope * (cs.length - 1 - n2.i)
        return { type: 'hs', bias: 'SHORT', neckline: neck, broken: last.c < neck }
      }
    }
  }
  if (lows.length >= 3) {
    const [ls_, head, rs] = lows.slice(-3)
    if (head.p < ls_.p && head.p < rs.p &&
        Math.abs(ls_.p - rs.p) / head.p < 0.03 &&
        (Math.min(ls_.p, rs.p) - head.p) / head.p > 0.004 &&
        rs.i > cs.length - 45) {
      const n1 = highs.find(h => h.i > ls_.i && h.i < head.i)
      const n2 = highs.find(h => h.i > head.i && h.i < rs.i + 8)
      if (n1 && n2 && n2.i > n1.i) {
        const slope = (n2.p - n1.p) / (n2.i - n1.i)
        const neck = n2.p + slope * (cs.length - 1 - n2.i)
        return { type: 'ihs', bias: 'LONG', neckline: neck, broken: last.c > neck }
      }
    }
  }
  return null
}

// ── 종합 분석 ──────────────────────────────────────────
// htf: 장기추세선용 캔들 (1D/1W), ltf: 진입용 캔들 (5m~4h)
export function analyzeStrategy(htf, ltf) {
  if (!htf?.length || !ltf?.length || htf.length < 30 || ltf.length < 30) return null

  const hp = findPivots(htf, 3, 3)
  const lp = findPivots(ltf, 3, 3)

  const down = findTrendline(htf, hp, 'high') // 하락 저항 추세선
  const up   = findTrendline(htf, hp, 'low')  // 상승 지지 추세선

  // 추세선 이탈 방향 = 매매 방향 게이트
  const trendDir =
    down?.broken && !up?.broken ? 'LONG'  :
    up?.broken && !down?.broken ? 'SHORT' : null

  const mss = detectMSS(ltf, lp)
  const fresh = mss && mss.breakIdx >= ltf.length - 60 // 오래된 구조 돌파는 무시
  const ote = fresh ? computeOTE(ltf, mss) : null
  const wedge = detectWedge(ltf, lp)
  const hns = detectHNS(ltf, lp)
  const sweep = detectSweep(ltf, lp)
  const liq = estimateLiqClusters(ltf)

  const conds = {
    trendBreak: trendDir != null,
    mss: !!(fresh && trendDir &&
      ((trendDir === 'LONG' && mss.dir === 'bull') || (trendDir === 'SHORT' && mss.dir === 'bear'))),
    ote: !!(ote && trendDir && ote.dir === trendDir && ote.inZone && !ote.invalid),
    sweep: !!(sweep && trendDir &&
      ((trendDir === 'LONG' && sweep.dir === 'bull') || (trendDir === 'SHORT' && sweep.dir === 'bear'))),
    wedge: !!(wedge && trendDir && wedge.bias === trendDir),
    hns: !!(hns && trendDir && hns.bias === trendDir && hns.broken),
  }
  const score = ['trendBreak', 'mss', 'ote', 'sweep', 'wedge', 'hns'].filter(k => conds[k]).length

  const price = ltf[ltf.length - 1].c
  let signal = null
  if (conds.trendBreak && conds.mss && conds.ote) {
    const reasons = ['장기추세선 이탈', 'MSS 방향 일치', 'OTE 존 진입']
    if (conds.sweep) reasons.push('유동성 스윕 확인')
    if (conds.wedge) reasons.push(wedge.type === 'falling' ? '하락 쐐기' : '상승 쐐기')
    if (conds.hns) reasons.push(hns.type === 'hs' ? '헤드앤숄더 넥라인 이탈' : '역헤드앤숄더 돌파')

    // TP 보정: 가까운 대형 청산 클러스터(유동성 자석)가 있으면 그쪽으로 (R:R 1.5 이상 유지 시)
    let tp = ote.tp
    const risk = Math.abs(price - ote.sl)
    if (trendDir === 'LONG') {
      const magnet = [...liq.above].sort((a, b) => a.p - b.p).find(c => c.w >= 0.5 && c.p > price && c.p < ote.tp)
      if (magnet && (magnet.p - price) >= 1.5 * risk) { tp = magnet.p; reasons.push('TP→청산 클러스터') }
    } else {
      const magnet = [...liq.below].sort((a, b) => b.p - a.p).find(c => c.w >= 0.5 && c.p < price && c.p > ote.tp)
      if (magnet && (price - magnet.p) >= 1.5 * risk) { tp = magnet.p; reasons.push('TP→청산 클러스터') }
    }

    signal = { side: trendDir, entry: price, sl: ote.sl, tp, reasons, score }
  }

  return { price, trend: { down, up, dir: trendDir }, mss: fresh ? mss : null, ote, sweep, wedge, hns, liq, conds, score, signal }
}
