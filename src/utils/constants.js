export const BYBIT_REST = 'https://api.bybit.com'
export const BYBIT_WS   = 'wss://stream.bybit.com/v5/public/linear'
export const CG         = 'https://api.coingecko.com/api/v3'

export const SYMBOLS = ['BTCUSDT','ETHUSDT','SOLUSDT','XRPUSDT','BNBUSDT','DOGEUSDT','ADAUSDT','AVAXUSDT','LINKUSDT']

export const SHORT = {
  BTCUSDT:'BTC', ETHUSDT:'ETH', SOLUSDT:'SOL', XRPUSDT:'XRP',
  BNBUSDT:'BNB', DOGEUSDT:'DOGE', ADAUSDT:'ADA', AVAXUSDT:'AVAX', LINKUSDT:'LINK'
}

export const CG_ID = {
  BTCUSDT:'bitcoin', ETHUSDT:'ethereum', SOLUSDT:'solana', XRPUSDT:'ripple',
  BNBUSDT:'binancecoin', DOGEUSDT:'dogecoin', ADAUSDT:'cardano',
  AVAXUSDT:'avalanche-2', LINKUSDT:'chainlink'
}

// 폴백 가격 (API 실패 시 / 로컬 개발용)
export const FALLBACK = {
  BTCUSDT:  { price:84200,  chg24:1.2,  chg7d:3.5,   high24:85800, low24:82900, vol24:2.1e9, oi:8.2e9,  fr:0.0100 },
  ETHUSDT:  { price:1940,   chg24:-0.8, chg7d:-2.1,  high24:1980,  low24:1910,  vol24:8.5e8, oi:3.1e9,  fr:0.0082 },
  SOLUSDT:  { price:128,    chg24:2.1,  chg7d:5.2,   high24:132,   low24:125,   vol24:4.2e8, oi:9.5e8,  fr:0.0120 },
  XRPUSDT:  { price:2.21,   chg24:0.5,  chg7d:1.8,   high24:2.28,  low24:2.15,  vol24:3.1e8, oi:5.8e8,  fr:0.0095 },
  BNBUSDT:  { price:592,    chg24:0.9,  chg7d:2.3,   high24:602,   low24:582,   vol24:1.8e8, oi:4.2e8,  fr:0.0088 },
  DOGEUSDT: { price:0.168,  chg24:-1.2, chg7d:-3.4,  high24:0.174, low24:0.162, vol24:2.9e8, oi:3.8e8,  fr:0.0105 },
  ADAUSDT:  { price:0.718,  chg24:1.5,  chg7d:4.1,   high24:0.738, low24:0.705, vol24:1.5e8, oi:2.9e8,  fr:0.0092 },
  AVAXUSDT: { price:19.2,   chg24:-0.6, chg7d:-1.9,  high24:19.8,  low24:18.7,  vol24:9.5e7, oi:2.1e8,  fr:0.0088 },
  LINKUSDT: { price:13.1,   chg24:1.8,  chg7d:3.2,   high24:13.6,  low24:12.8,  vol24:1.1e8, oi:2.4e8,  fr:0.0096 },
}

export const CHECKLIST = [
  { id:'htf',  label:'HTF 7D/24H 방향 일치',  tag:'HTF' },
  { id:'liq',  label:'BSL/SSL 스윕 확인',      tag:'LIQ' },
  { id:'mss',  label:'MSS/CHoCH 발생',         tag:'MSS' },
  { id:'ob',   label:'OB+FVG 진입 존',         tag:'OB'  },
  { id:'oi',   label:'OI 방향 일치',           tag:'OI'  },
  { id:'cvd',  label:'CVD 방향 일치',          tag:'CVD' },
  { id:'fr',   label:'FR 정상 (0~0.1%)',       tag:'FR'  },
]

export const OI_CASES = [
  { ko:'강한 상승',    match:(p24,p7,oiUp,fr)=> p24>1&&p7>3&&oiUp&&fr>=-0.01&&fr<0.1,  desc:'건전한 상승 — 지속 가능성 높음', good:true  },
  { ko:'상승 과열',    match:(p24,p7,oiUp,fr)=> p24>1&&fr>=0.1,                          desc:'롱 과열 — 진입 금지',           good:false },
  { ko:'단기 반등',    match:(p24,p7,oiUp,fr)=> p7<0&&p24>0.5&&!oiUp,                   desc:'숏커버 반등 — 신뢰도 낮음',     good:false },
  { ko:'바닥 신호',    match:(p24,p7,oiUp,fr)=> p7<-5&&p24>0&&fr<-0.01,                 desc:'숏 과열 후 반등 가능',          good:true  },
  { ko:'강한 하락',    match:(p24,p7,oiUp,fr)=> p24<-1&&p7<-3&&oiUp,                    desc:'추가 하락 가능성 높음',         good:false },
  { ko:'횡보 중립',    match:()=>true,                                                    desc:'방향성 불명확 — 대기 권장',     good:false },
]
