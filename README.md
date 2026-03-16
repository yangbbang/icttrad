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

## 프로젝트 구조

```
src/
├── components/
│   ├── Navbar.jsx        # 상단 네비게이션
│   ├── SignalPanel.jsx   # 분석 패널 (메인)
│   ├── Backtest.jsx      # 백테스팅
│   ├── Guide.jsx         # ICT 가이드
│   └── TelegramModal.jsx # 텔레그램 알람 설정
├── hooks/
│   ├── useBybit.js       # Bybit WS + REST 훅
│   └── useTelegram.js    # 텔레그램 훅
├── utils/
│   ├── constants.js      # 심볼, 폴백 가격 등
│   ├── format.js         # 가격 포맷, 유틸
│   └── ictBacktest.js    # ICT 백테스팅 엔진
├── App.jsx
├── main.jsx
└── index.css
```

## ICT 백테스팅 조건

1. HTF 방향 일치 (앞쪽 20% 캔들 기준)
2. 스윙 고저점 돌파 → MSS 감지 (3봉 고정)
3. Bull/Bear OB 확인 (직전 4봉 탐색)
4. FVG 겹침 → 진입 존 정밀화
5. 진입: OB+FVG 중앙 / SL: OB 하단 -0.5% / TP: R:R 3:1
