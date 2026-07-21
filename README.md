# ICT Chart — Bybit Futures Dashboard

React + Vite 기반 ICT 단타 대시보드

## 실행 방법

```bash
# 1. 의존성 설치
npm install

# 2. 개발 서버 시작 (http://localhost:5173)
npm run dev

# 3. 배포용 빌드
npm run build
```

## Netlify 배포

```bash
npm run build
```
→ `dist/` 폴더를 [app.netlify.com/drop](https://app.netlify.com/drop) 에 드래그앤드롭

## GitHub Pages 배포

```bash
npm install gh-pages --save-dev
```

`package.json`에 추가:
```json
"homepage": "https://유저명.github.io/ict-chart",
"scripts": {
  "predeploy": "npm run build",
  "deploy": "gh-pages -d dist"
}
```

```bash
npm run deploy
```

## 데이터 소스

| 항목 | 출처 |
|------|------|
| 실시간 가격 | Bybit WebSocket |
| FR (펀딩비) 실제값 | Bybit REST API |
| OI (미결제약정) | Bybit REST API |
| 백테스팅 OHLC | CoinGecko API |
| 알트 강도 캔들/티커 | Bybit REST API (거래대금 상위 50 알트) |
| 시가총액 (TOTAL 가중) | CoinGecko API (실패 시 거래대금 가중 폴백) |

## 프로젝트 구조

```
src/
├── components/
│   ├── Navbar.jsx        # 상단 네비게이션
│   ├── SignalPanel.jsx   # 분석 패널 (메인)
│   ├── AltStrength.jsx   # 알트 상대강도 + 셋업 스크리너
│   ├── Backtest.jsx      # 백테스팅
│   ├── Guide.jsx         # ICT 가이드
│   └── TelegramModal.jsx # 텔레그램 알람 설정
├── hooks/
│   ├── useBybit.js       # Bybit WS + REST 훅
│   ├── useAltStrength.js # 알트 강도 데이터 훅 (티커+캔들 배치 로드)
│   └── useTelegram.js    # 텔레그램 훅
├── utils/
│   ├── constants.js      # 심볼, 폴백 가격 등
│   ├── format.js         # 가격 포맷, 유틸
│   ├── altStrength.js    # RS 계산 + MSS/OTE/골든크로스 감지 + 섹터 매핑
│   └── ictBacktest.js    # ICT 백테스팅 엔진
├── App.jsx
├── main.jsx
└── index.css
```

## 알트 강도 (상대강도 분석 + 스크리너)

- **TOTAL 프록시**: 상위 코인 시총 가중 수익률 — TOTAL(전체) / TOTAL2(BTC 제외) / TOTAL3(BTC·ETH 제외). TOTAL2/3 > BTC 이면 알트 자금 유입
- **알트시즌 지수**: 상위 50 알트 중 30일 기준 BTC 아웃퍼폼 비율 (≥75 알트시즌 / ≤25 비트코인 시즌)
- **섹터 상대강도**: L1 / L2 / DeFi / AI / 밈 / 결제 / 게임 / 인프라 / RWA 별 BTC 대비 평균 초과수익
- **RS점수**: BTC 대비 초과수익률 가중평균 (24H×20% + 7D×40% + 30D×40%)
- **셋업 스크리너** (일봉 / 4H 선택):
  - `MSS↑` — 스윙 저점 유동성 스윕 후 구조 고점 상향 돌파 (추세전환)
  - `OTE존` — MSS 임펄스 레그의 0.618~0.79 되돌림 구간에 현재가 위치
  - `골든크로스` — SMA50이 SMA200을 최근 30봉 내 상향 돌파

## ICT 백테스팅 조건

1. HTF 방향 일치 (앞쪽 20% 캔들 기준)
2. 스윙 고저점 돌파 → MSS 감지 (3봉 고정)
3. Bull/Bear OB 확인 (직전 4봉 탐색)
4. FVG 겹침 → 진입 존 정밀화
5. 진입: OB+FVG 중앙 / SL: OB 하단 -0.5% / TP: R:R 3:1
