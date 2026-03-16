export function fp(n, sym = '') {
  if (n === undefined || n === null || isNaN(n)) return '—'
  if (sym.includes('BTC') || sym.includes('ETH') || sym.includes('BNB'))
    return n >= 1000 ? '$' + Math.round(n).toLocaleString() : '$' + n.toFixed(2)
  if (sym.includes('SOL') || sym.includes('AVAX') || sym.includes('LINK'))
    return '$' + n.toFixed(2)
  if (n >= 100) return '$' + n.toFixed(2)
  if (n >= 1)   return '$' + n.toFixed(4)
  return '$' + n.toFixed(6)
}

export function fmtV(n) {
  if (!n) return '—'
  if (n >= 1e9) return '$' + (n / 1e9).toFixed(2) + 'B'
  if (n >= 1e6) return '$' + (n / 1e6).toFixed(2) + 'M'
  if (n >= 1e3) return '$' + (n / 1e3).toFixed(1) + 'K'
  return '$' + n.toFixed(0)
}

export function frTimeLeft() {
  const now = new Date()
  const h = now.getUTCHours(), m = now.getUTCMinutes(), s = now.getUTCSeconds()
  const next = [0, 8, 16].map(t => { let d = (t - h) * 3600 - m * 60 - s; return d <= 0 ? d + 86400 : d })
  const secs = Math.min(...next)
  const hh = Math.floor(secs / 3600), mm = Math.floor((secs % 3600) / 60), ss = secs % 60
  return `${String(hh).padStart(2,'0')}:${String(mm).padStart(2,'0')}:${String(ss).padStart(2,'0')}`
}

export function buildLiveData(sym, raw, prevOI = 0) {
  const price   = parseFloat(raw.lastPrice)
  const chg24   = parseFloat(raw.price24hPcnt) * 100
  const high24  = parseFloat(raw.highPrice24h)
  const low24   = parseFloat(raw.lowPrice24h)
  const vol24   = parseFloat(raw.turnover24h)
  const oi      = parseFloat(raw.openInterest) * price
  const fr      = parseFloat(raw.fundingRate) * 100
  const oiChg   = oi - prevOI
  const cvd     = chg24 > 0 ? (oiChg > 0 ? 0.4 : 0.15) : (oiChg < 0 ? -0.4 : -0.15)
  const swH     = high24 * 1.003
  const swL     = low24  * 0.997
  const d1Bias  = chg24 > 0 ? 'BULLISH' : 'BEARISH'
  const d7Bias  = 'BULLISH' // REST로 7D는 별도 조회 필요 (기본값)
  const dir     = (d1Bias === 'BULLISH' && oiChg > 0) ? 'LONG' : 'SHORT'
  const mss     = chg24 > 2 ? '상승 MSS' : chg24 < -2 ? '하락 MSS' : '없음'
  const choch   = mss !== '없음' ? '확인됨' : '미확인'
  const ez      = dir === 'LONG' ? price * 0.992 : price * 1.008
  const slp     = dir === 'LONG' ? price * 0.978 : price * 1.022
  const tp      = dir === 'LONG' ? price * 1.066 : price * 0.934
  return { price, chg24, high24, low24, vol24, oi, oiChg, fr, cvd, swH, swL, d1Bias, d7Bias, dir, mss, choch, ez, slp, tp }
}
