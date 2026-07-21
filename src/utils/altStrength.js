/**
 * 알트 상대강도(RS) + 셋업 스크리너 엔진
 *
 * ① 상대강도: BTC 대비 초과수익률 — RS = ((1+코인수익률)/(1+BTC수익률) - 1)
 *    RS점수 = 24H×20% + 7D×40% + 30D×40%
 * ② TOTAL 프록시: 상위 코인 시총(또는 거래대금) 가중 수익률
 *    TOTAL(전체) / TOTAL2(BTC 제외) / TOTAL3(BTC·ETH 제외)
 * ③ 셋업 감지 (캔들 기반):
 *    - MSS: 직전 스윙 저점 하향 스윕 → 스윙 고점 상향 돌파 (상승 전환, 하락은 대칭)
 *    - OTE: MSS 임펄스 레그의 0.618~0.79 되돌림 존 진입 여부
 *    - 골든크로스: SMA50 / SMA200 상향 교차 및 정배열 여부
 */

// ── 섹터 매핑 (베이스 심볼 기준, 미등록 → 기타) ──────────
const SECTOR_MAP = {
  L1: ['ETH','SOL','BNB','ADA','AVAX','TRX','TON','NEAR','APT','SUI','SEI','ATOM','DOT','ICP','KAS','HBAR','ALGO','EGLD','XTZ','ETC','FLOW','INJ','TIA','S','BERA','VET','EOS'],
  L2: ['POL','MATIC','ARB','OP','STRK','ZK','MNT','METIS','BLAST','MOVE','TAIKO','SCR','LINEA'],
  DeFi: ['UNI','AAVE','MKR','LDO','CRV','COMP','SNX','SUSHI','CAKE','JUP','RAY','PENDLE','ENA','DYDX','GMX','1INCH','JTO','EIGEN','MORPHO','HYPE','KMNO','ETHFI','LISTA','AERO','VELO','RUNE','OSMO','WOO'],
  'AI': ['TAO','RENDER','RNDR','FET','GRT','WLD','VIRTUAL','AI16Z','ARKM','AKT','IO','KAITO','ATH','PROMPT'],
  '밈': ['DOGE','SHIB','PEPE','WIF','BONK','FLOKI','BRETT','POPCAT','MEW','PNUT','MOODENG','TRUMP','MELANIA','FARTCOIN','SPX','TURBO','DOGS','NEIRO','BOME','MEME','ORDI','SATS','GOAT','PENGU','HIPPO','CHILLGUY','ACT'],
  '결제': ['XRP','XLM','LTC','BCH','DASH','XMR','ZEC'],
  '게임/NFT': ['IMX','GALA','SAND','MANA','AXS','APE','ENJ','RON','PRIME','BEAM','NOT','PIXEL','PORTAL','YGG','ILV','GMT','BIGTIME','ACE','XAI','HMSTR'],
  '인프라/오라클': ['LINK','PYTH','BAND','API3','FIL','AR','HNT','IOTX','ANKR','GLM','W','ZRO','AXL','QNT','ENS','TRB','STX','CKB','JASMY','THETA'],
  RWA: ['ONDO','OM','POLYX','USUAL','PLUME','RSR'],
  '거래소': ['OKB','CRO','BGB','GT','KCS','MX'],
}

const BASE_TO_SECTOR = {}
Object.entries(SECTOR_MAP).forEach(([sec, arr]) => arr.forEach(b => { BASE_TO_SECTOR[b] = sec }))

export function sectorOf(base) { return BASE_TO_SECTOR[base] || '기타' }

export const SECTOR_LIST = [...Object.keys(SECTOR_MAP), '기타']

// 스테이블·랩·금 등 제외
export const EXCLUDE_BASES = new Set([
  'USDC','USDE','DAI','FDUSD','TUSD','PYUSD','USTC','BUSD','USD1','USDS','USDY',
  'EUR','GBP','BRZ','XAUT','PAXG','WBTC','WETH','STETH','CBBTC','SUSDE','GOLD',
])

// 바이빗 심볼 → 베이스 (1000PEPE → PEPE, SHIB1000 → SHIB)
export function cleanBase(symbol) {
  let b = symbol.replace(/USDT$/, '')
  b = b.replace(/^1(0+)(?=[A-Z])/, '')
  b = b.replace(/1(0+)$/, '')
  return b
}

// ── 수익률 / 상대강도 ─────────────────────────────
export function computeChg(candles, bars) {
  const n = candles.length
  if (!n) return { h24: null, d7: null, d30: null }
  const last = candles[n - 1].c
  const ret = k => (n > k && candles[n - 1 - k].c > 0 ? (last / candles[n - 1 - k].c - 1) * 100 : null)
  return { h24: ret(bars.h24), d7: ret(bars.d7), d30: ret(bars.d30) }
}

export function relStrength(chg, btcChg) {
  const f = (a, b) => (a == null || b == null) ? null : ((1 + a / 100) / (1 + b / 100) - 1) * 100
  return { h24: f(chg.h24, btcChg.h24), d7: f(chg.d7, btcChg.d7), d30: f(chg.d30, btcChg.d30) }
}

export function rsScoreOf(rs) {
  const W = { h24: 0.2, d7: 0.4, d30: 0.4 }
  let s = 0, sw = 0
  for (const k of ['h24', 'd7', 'd30']) {
    if (rs[k] != null && isFinite(rs[k])) { s += W[k] * rs[k]; sw += W[k] }
  }
  return sw ? s / sw : null
}

// ── 시장 개요 (TOTAL 프록시) ──────────────────────
export function buildOverview(rows, tf) {
  if (!rows.length) return null
  const withMcap = rows.filter(r => r.mcap > 0)
  const useMcap = withMcap.length >= rows.length * 0.7
  const pool = useMcap ? withMcap : rows
  const w = r => useMcap ? r.mcap : r.turnover
  const agg = list => {
    let s = 0, sw = 0
    list.forEach(r => {
      const wt = w(r), v = r.chg[tf]
      if (wt > 0 && v != null && isFinite(v)) { s += wt * v; sw += wt }
    })
    return sw ? s / sw : null
  }
  const btc = rows.find(r => r.base === 'BTC')
  return {
    btc:    btc ? btc.chg[tf] : null,
    total:  agg(pool),
    total2: agg(pool.filter(r => r.base !== 'BTC')),
    total3: agg(pool.filter(r => r.base !== 'BTC' && r.base !== 'ETH')),
    weightLabel: useMcap ? '시가총액 가중' : '거래대금 가중',
  }
}

// 알트시즌 지수: 상위 50 알트 중 30일 RS > 0 (BTC 아웃퍼폼) 비율
export function altseasonIndex(rows) {
  const alts = rows
    .filter(r => r.base !== 'BTC' && r.rs.d30 != null)
    .sort((a, b) => (b.mcap || b.turnover) - (a.mcap || a.turnover))
    .slice(0, 50)
  if (!alts.length) return null
  const beat = alts.filter(r => r.rs.d30 > 0).length
  return Math.round(beat / alts.length * 100)
}

// 섹터별 평균 RS
export function buildSectors(rows, tf) {
  const g = {}
  rows.filter(r => r.base !== 'BTC').forEach(r => {
    const v = r.rs[tf]
    if (v == null || !isFinite(v)) return
    if (!g[r.sector]) g[r.sector] = { sector: r.sector, sum: 0, n: 0, top: null }
    g[r.sector].sum += v
    g[r.sector].n++
    if (!g[r.sector].top || v > g[r.sector].top.v) g[r.sector].top = { base: r.base, v }
  })
  return Object.values(g)
    .map(s => ({ sector: s.sector, avg: s.sum / s.n, n: s.n, top: s.top }))
    .sort((a, b) => b.avg - a.avg)
}

// ── 셋업 감지 ─────────────────────────────────────
const SWING = 3
const MSS_RECENT = 25   // MSS 유효 최근 봉 수
const GC_RECENT  = 30   // 골든크로스 "최근" 판정 봉 수

function findSwings(c) {
  const n = c.length, swH = [], swL = []
  for (let i = SWING; i < n - SWING; i++) {
    let isH = true, isL = true
    for (let j = i - SWING; j <= i + SWING; j++) {
      if (j === i) continue
      if (c[j].h >= c[i].h) isH = false
      if (c[j].l <= c[i].l) isL = false
      if (!isH && !isL) break
    }
    if (isH) swH.push({ i, p: c[i].h })
    if (isL) swL.push({ i, p: c[i].l })
  }
  return { swH, swL }
}

// 상승 MSS: 스윙 저점 스윕(s2 < s1) 후 직전 스윙 고점 종가 돌파
function findBullMSS(candles, swH, swL) {
  const n = candles.length
  for (let k = swL.length - 1; k >= 1; k--) {
    const s2 = swL[k], s1 = swL[k - 1]
    if (n - 1 - s2.i > MSS_RECENT + 20) break
    if (s2.p >= s1.p) continue
    const before  = swH.filter(h => h.i < s2.i)
    const between = before.filter(h => h.i > s1.i)
    const ref = between.length ? between[between.length - 1] : before[before.length - 1]
    if (!ref) continue
    for (let j = s2.i + 1; j < n; j++) {
      if (candles[j].l < s2.p) break                      // 스윕 저점 붕괴 → 무효
      if (candles[j].c > ref.p) {
        if (n - 1 - j <= MSS_RECENT) return { at: j, ago: n - 1 - j, low: s2.p, ref: ref.p }
        break                                             // 돌파가 너무 오래됨
      }
    }
  }
  return null
}

// 하락 MSS: 스윙 고점 스윕(s2 > s1) 후 직전 스윙 저점 종가 이탈
function findBearMSS(candles, swH, swL) {
  const n = candles.length
  for (let k = swH.length - 1; k >= 1; k--) {
    const s2 = swH[k], s1 = swH[k - 1]
    if (n - 1 - s2.i > MSS_RECENT + 20) break
    if (s2.p <= s1.p) continue
    const before  = swL.filter(l => l.i < s2.i)
    const between = before.filter(l => l.i > s1.i)
    const ref = between.length ? between[between.length - 1] : before[before.length - 1]
    if (!ref) continue
    for (let j = s2.i + 1; j < n; j++) {
      if (candles[j].h > s2.p) break
      if (candles[j].c < ref.p) {
        if (n - 1 - j <= MSS_RECENT) return { at: j, ago: n - 1 - j, high: s2.p, ref: ref.p }
        break
      }
    }
  }
  return null
}

export function detectSetups(candles) {
  const n = candles.length
  if (n < 60) return null
  const last = candles[n - 1].c
  const { swH, swL } = findSwings(candles)

  // ── MSS (상승/하락 중 더 최근 것) ──
  const bull = findBullMSS(candles, swH, swL)
  const bear = findBearMSS(candles, swH, swL)
  let mss = null, mssData = null
  if (bull && (!bear || bull.at >= bear.at)) { mss = 'bull'; mssData = bull }
  else if (bear)                             { mss = 'bear'; mssData = bear }

  // ── OTE: 임펄스 레그의 0.618~0.79 되돌림 ──
  let ote = null
  if (mss === 'bull') {
    const L = mssData.low
    let H = -Infinity
    for (let j = mssData.at; j < n; j++) H = Math.max(H, candles[j].h)
    if (H > L) {
      const hi = H - (H - L) * 0.618, lo = H - (H - L) * 0.79
      const state = last > hi ? 'wait' : last >= lo ? 'in' : last > L ? 'deep' : null
      if (state) ote = { side: 'long', state, hi, lo, entry: H - (H - L) * 0.705, sl: L }
    }
  } else if (mss === 'bear') {
    const H = mssData.high
    let L = Infinity
    for (let j = mssData.at; j < n; j++) L = Math.min(L, candles[j].l)
    if (H > L) {
      const lo = L + (H - L) * 0.618, hi = L + (H - L) * 0.79
      const state = last < lo ? 'wait' : last <= hi ? 'in' : last < H ? 'deep' : null
      if (state) ote = { side: 'short', state, hi, lo, entry: L + (H - L) * 0.705, sl: H }
    }
  }

  // ── SMA 50/200 골든크로스 ──
  let gc = null
  if (n >= 205) {
    const closes = candles.map(c => c.c)
    const sma = (p, i) => { let s = 0; for (let j = i - p + 1; j <= i; j++) s += closes[j]; return s / p }
    const start = Math.max(200, n - 60)
    let crossUpAgo = null, crossDnAgo = null
    let prev = sma(50, start - 1) - sma(200, start - 1)
    for (let i = start; i < n; i++) {
      const d = sma(50, i) - sma(200, i)
      if (prev <= 0 && d > 0) crossUpAgo = n - 1 - i
      if (prev >= 0 && d < 0) crossDnAgo = n - 1 - i
      prev = d
    }
    const s50 = sma(50, n - 1), s200 = sma(200, n - 1)
    gc = { above: s50 > s200, crossUpAgo, crossDnAgo, s50, s200 }
  }

  return { mss, mssAgo: mssData ? mssData.ago : null, ote, gc }
}

// 스크리너 필터 판정
export const passMSS = r => r.setup?.mss === 'bull'
export const passOTE = r => r.setup?.ote?.side === 'long' && r.setup.ote.state === 'in'
export const passGC  = r => {
  const g = r.setup?.gc
  return !!g && g.above && g.crossUpAgo != null && g.crossUpAgo <= GC_RECENT
}
export { GC_RECENT }
