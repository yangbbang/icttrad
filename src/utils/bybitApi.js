// Bybit V5 개인 API 클라이언트 (브라우저 전용 — Web Crypto HMAC-SHA256 서명)
// 키는 localStorage에만 저장되며 어떤 서버로도 전송되지 않음 (Bybit 제외)

const HOSTS = {
  live: 'https://api.bybit.com',
  demo: 'https://api-demo.bybit.com',
}

const RECV_WINDOW = '5000'

async function hmacHex(secret, payload) {
  const enc = new TextEncoder()
  const key = await crypto.subtle.importKey(
    'raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode(payload))
  return [...new Uint8Array(sig)].map(b => b.toString(16).padStart(2, '0')).join('')
}

// 수량/가격을 스텝 단위로 내림 (예: step "0.001" → 소수 3자리)
export function roundStep(value, step) {
  const s = parseFloat(step)
  if (!s || !isFinite(value)) return String(value)
  const dec = (String(step).split('.')[1] || '').length
  return (Math.floor(value / s + 1e-9) * s).toFixed(dec)
}

export function createBybitClient({ apiKey, apiSecret, env = 'demo' }) {
  const host = HOSTS[env] || HOSTS.demo

  async function request(method, path, params = {}) {
    const ts = Date.now().toString()
    let url = host + path
    let body
    let payload
    if (method === 'GET') {
      const qs = new URLSearchParams(params).toString()
      if (qs) url += '?' + qs
      payload = ts + apiKey + RECV_WINDOW + qs
    } else {
      body = JSON.stringify(params)
      payload = ts + apiKey + RECV_WINDOW + body
    }
    const sign = await hmacHex(apiSecret, payload)
    const res = await fetch(url, {
      method,
      body,
      headers: {
        'X-BAPI-API-KEY': apiKey,
        'X-BAPI-TIMESTAMP': ts,
        'X-BAPI-SIGN': sign,
        'X-BAPI-RECV-WINDOW': RECV_WINDOW,
        ...(method === 'POST' ? { 'Content-Type': 'application/json' } : {}),
      },
    })
    const json = await res.json()
    if (json.retCode !== 0) {
      const err = new Error(json.retMsg || `Bybit 오류 ${json.retCode}`)
      err.retCode = json.retCode
      throw err
    }
    return json.result
  }

  return {
    // USDT 기준 총 자산 (통합계좌)
    async getEquity() {
      const r = await request('GET', '/v5/account/wallet-balance', { accountType: 'UNIFIED' })
      return parseFloat(r.list?.[0]?.totalEquity || 0)
    },

    // 심볼의 현재 포지션 (없으면 null)
    async getPosition(symbol) {
      const r = await request('GET', '/v5/position/list', { category: 'linear', symbol })
      const p = r.list?.[0]
      if (!p || !parseFloat(p.size)) return null
      return {
        side: p.side,                       // Buy | Sell
        qty: parseFloat(p.size),
        entry: parseFloat(p.avgPrice),
        unrealisedPnl: parseFloat(p.unrealisedPnl),
        stopLoss: parseFloat(p.stopLoss || 0),
        takeProfit: parseFloat(p.takeProfit || 0),
      }
    },

    // 최근 청산 실현손익
    async getLastClosedPnl(symbol) {
      const r = await request('GET', '/v5/position/closed-pnl', { category: 'linear', symbol, limit: '1' })
      const p = r.list?.[0]
      return p ? parseFloat(p.closedPnl) : null
    },

    async setLeverage(symbol, leverage) {
      try {
        await request('POST', '/v5/position/set-leverage', {
          category: 'linear', symbol,
          buyLeverage: String(leverage), sellLeverage: String(leverage),
        })
      } catch (e) {
        if (e.retCode !== 110043) throw e // 110043 = 이미 동일 레버리지
      }
    },

    // 수량 스텝 / 최소 수량 / 가격 틱 (공개 엔드포인트)
    async getInstrument(symbol) {
      const res = await fetch(`${host}/v5/market/instruments-info?category=linear&symbol=${symbol}`)
      const json = await res.json()
      const it = json.result?.list?.[0]
      if (!it) throw new Error('심볼 정보 조회 실패')
      return {
        qtyStep: it.lotSizeFilter.qtyStep,
        minQty: parseFloat(it.lotSizeFilter.minOrderQty),
        tickSize: it.priceFilter.tickSize,
      }
    },

    // 시장가 진입 + 서버측 SL/TP 동시 설정
    async marketOrder({ symbol, side, qty, stopLoss, takeProfit }) {
      return request('POST', '/v5/order/create', {
        category: 'linear', symbol, side,
        orderType: 'Market', qty: String(qty),
        positionIdx: 0, tpslMode: 'Full',
        stopLoss: String(stopLoss), takeProfit: String(takeProfit),
        slTriggerBy: 'LastPrice', tpTriggerBy: 'LastPrice',
      })
    },

    // 시장가 전량 청산 (reduceOnly)
    async closePosition({ symbol, side, qty }) {
      return request('POST', '/v5/order/create', {
        category: 'linear', symbol,
        side: side === 'Buy' ? 'Sell' : 'Buy',
        orderType: 'Market', qty: String(qty),
        positionIdx: 0, reduceOnly: true,
      })
    },
  }
}
