# ICT Chart — Bybit Futures Dashboard

React + Vite 기반 ICT 단타 대시보드 + 자동매매

## 자동매매 (회사형 구조)

`자동매매` 탭에서 ICT + OTE + 패턴 전략 기반 자동매매를 실행할 수 있습니다.
4개 역할이 회의를 통해 진입을 의결하는 구조입니다:

| 역할 | 담당 |
|------|------|
| 🔍 차트 탐색 | 전체 심볼(9개) 2분 주기 스캔 → 셋업 후보 랭킹 |
| 📊 분석 | 장기추세선 이탈 → MSS → OTE 존 + 쐐기/헤드앤숄더/유동성 스윕 |
| 🛡️ 리스크 | FR 과열·일일 한도·손실 한도·R:R 검사 + 포지션 사이징 (거부권) |
| 📚 학습 | 거래 이력 승률 분석, 3연패 시 진입 기준 자동 강화 |
| 🏛️ 회의 | 전원 승인 시에만 진입 실행, 회의록 기록 |

### 전략 (진입 필수 조건 3가지)

1. **장기추세선 이탈** — 일봉/주봉 하락 저항선 상방 돌파(LONG) 또는 상승 지지선 하방 이탈(SHORT). 가장 중요한 방향 게이트
2. **MSS 방향 일치** — LTF(기본 15분) 구조 돌파가 같은 방향
3. **OTE 존 진입** — 임펄스 레그의 0.62~0.79 되돌림 존 안에 현재가 위치. SL = 1.13 확장, TP = -0.5 확장 (≈R:R 2.8:1)

가산점: 유동성 스윕(Turtle Soup), 하락/상승 쐐기, (역)헤드앤숄더 넥라인 이탈.
TP는 추정 청산 클러스터(코인글래스 히트맵 근사, 유동성 자석)로 보정됩니다.

### 실행 모드

- **페이퍼** (기본): 브라우저 시뮬레이션, 가상 자산. API 키 불필요
- **데모**: Bybit 데모 서버(api-demo) 실주문 — 데모 계정 API 키 필요
- **실거래**: 실계좌 주문. ⚠️ **출금 권한 없는 API 키** + IP 제한 필수

API 키는 브라우저 localStorage에만 저장되며 Bybit 외 어디에도 전송되지 않습니다.
자동매매는 원금 손실 위험이 있습니다 — 투자 권유가 아니며 사용 책임은 본인에게 있습니다.

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
