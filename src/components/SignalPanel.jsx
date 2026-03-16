import { useState, useEffect } from 'react'
import { CHECKLIST, OI_CASES } from '../utils/constants'
import { fp, fmtV } from '../utils/format'

function Mc({ label, value, color, large }) {
  return (
    <div className="mc">
      <div className="mc-t">{label}</div>
      <div className="mc-v" style={{ color: color || 'var(--text)', fontSize: large ? 15 : 13 }}>{value}</div>
    </div>
  )
}

function Zrow({ label, value, color }) {
  return (
    <div className="zrow">
      <span className="zrow-label">{label}</span>
      <span style={{ fontFamily:'var(--font-mono)', fontWeight:500, color: color || 'var(--text)', fontSize:12 }}>{value}</span>
    </div>
  )
}

export default function SignalPanel({ sym, data, onAlert }) {
  const [ck, setCk] = useState({ htf:false, liq:false, mss:false, ob:false, oi:false, cvd:false, fr:false })

  useEffect(() => {
    if (!data) return
    const { d1Bias, d7Bias, mss, choch, dir, oiChg, cvd, fr } = data
    setCk({
      htf:  (d1Bias==='BULLISH'&&d7Bias==='BULLISH')||(d1Bias==='BEARISH'&&d7Bias==='BEARISH'),
      liq:  mss !== '없음',
      mss:  choch === '확인됨',
      ob:   true,
      oi:   (dir==='LONG'&&oiChg>=0)||(dir==='SHORT'&&oiChg<0),
      cvd:  (dir==='LONG'&&cvd>0)||(dir==='SHORT'&&cvd<0),
      fr:   fr >= -0.01 && fr < 0.1,
    })
  }, [data])

  useEffect(() => {
    if (!data) return
    const score = Object.values(ck).filter(Boolean).length
    if (score >= 5) onAlert?.(sym, data, score)
  }, [ck, data, sym, onAlert])

  if (!data) return (
    <div style={{ padding:40, textAlign:'center', color:'var(--dim)', fontSize:12 }}>
      데이터 로딩 중...
    </div>
  )

  const { price, chg24, chg7d=0, high24, low24, vol24, oi, oiChg, fr, cvd, swH, swL, d1Bias, d7Bias, dir, mss, choch, ez, slp, tp, frHist=[], isSim } = data
  const score = Object.values(ck).filter(Boolean).length
  const scoreColor = score >= 5 ? 'var(--G)' : score >= 3 ? 'var(--Y)' : 'var(--R)'

  const marketCase = OI_CASES.find(c => c.match(chg24, chg7d, oiChg > 0, fr)) || OI_CASES[5]

  const frStatus = fr >= 0.1
    ? { label:`FR ${fr.toFixed(4)}% — 롱 과열! 진입 금지`, cls:'pill-r' }
    : fr <= -0.01
    ? { label:`FR ${fr.toFixed(4)}% — 숏커버 반등 위험`,   cls:'pill-y' }
    : fr >= 0.05
    ? { label:`FR ${fr.toFixed(4)}% — 약간 과열. 주의`,    cls:'pill-y' }
    : { label:`FR ${fr.toFixed(4)}% — 정상 범위. 진입 가능`, cls:'pill-g' }

  return (
    <div>
      {/* 시뮬레이션 안내 */}
      {isSim && (
        <div style={{ background:'rgba(245,183,49,0.08)', border:'0.5px solid rgba(245,183,49,0.2)', borderRadius:10, padding:'9px 14px', marginBottom:10, fontSize:11, color:'var(--Y)', display:'flex', alignItems:'center', gap:8 }}>
          <span>⚡</span>
          <span>현재 시뮬레이션 모드 — Netlify 배포 후 바이빗 실제 데이터로 자동 전환됩니다.</span>
        </div>
      )}

      {/* 실시간 선물 데이터 */}
      <div className="card">
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:10 }}>
          <div className="lbl" style={{ marginBottom:0 }}>바이빗 선물 실시간</div>
          <span style={{ fontSize:10, color:'var(--dim)', fontFamily:'var(--font-mono)' }}>
            {new Date().toLocaleTimeString('ko-KR',{hour:'2-digit',minute:'2-digit',second:'2-digit'})}
          </span>
        </div>
        <div className="g5" style={{ marginBottom:8 }}>
          <Mc label="현재가 (선물)" value={fp(price, sym)} color={chg24>=0?'var(--G)':'var(--R)'} large />
          <Mc label="24H 변동"     value={(chg24>=0?'+':'')+chg24.toFixed(2)+'%'} color={chg24>=0?'var(--G)':'var(--R)'} />
          <Mc label="OI 미결제"   value={fmtV(oi)} color={oiChg>0?'var(--G)':oiChg<0?'var(--R)':'var(--text)'} />
          <Mc label={<>펀딩비 FR <span style={{fontSize:8,color:'var(--G)'}}>실제값</span></>}
              value={(fr>=0?'+':'')+fr.toFixed(4)+'%'} color={fr>=0.1?'var(--R)':fr<0?'var(--Y)':'var(--G)'} large />
          <Mc label="24H 거래량"  value={fmtV(vol24)} />
        </div>
        <div className="g3">
          <Mc label="24H 고가" value={fp(high24, sym)} color="var(--G)" />
          <Mc label="24H 저가" value={fp(low24,  sym)} color="var(--R)" />
          <Mc label="OI 방향"  value={oiChg>0?'↑ 증가':oiChg<0?'↓ 감소':'→ 보합'} color={oiChg>0?'var(--G)':oiChg<0?'var(--R)':'var(--muted)'} />
        </div>
      </div>

      {/* HTF + 구조 */}
      <div className="g2">
        <div className="card">
          <div className="lbl">HTF 주문흐름</div>
          <div className="g2" style={{ marginBottom:10 }}>
            <Mc label="7D 추세"  value={d7Bias} color={d7Bias==='BULLISH'?'var(--G)':'var(--R)'} />
            <Mc label="24H 추세" value={d1Bias} color={d1Bias==='BULLISH'?'var(--G)':'var(--R)'} />
          </div>
          <Zrow label="BSL (스윙 고점)" value={fp(swH, sym)} color="var(--B)" />
          <Zrow label="현재가"          value={fp(price, sym)} />
          <Zrow label="SSL (스윙 저점)" value={fp(swL, sym)}  color="var(--R)" />
        </div>
        <div className="card">
          <div className="lbl">구조 분석</div>
          <div className="g2" style={{ marginBottom:10 }}>
            <Mc label="MSS"   value={mss}   color={mss==='상승 MSS'?'var(--G)':mss==='하락 MSS'?'var(--R)':'var(--muted)'} />
            <Mc label="CHoCH" value={choch} color={choch==='확인됨'?'var(--G)':'var(--muted)'} />
          </div>
          <Zrow label="스윙 고점" value={fp(swH, sym)} color="var(--R)" />
          <Zrow label="스윙 저점" value={fp(swL, sym)} color="var(--G)" />
          <Zrow label="방향" value={
            <span className={`pill ${dir==='LONG'?'pill-g':'pill-r'}`}>{dir==='LONG'?'상승':'하락'}</span>
          } />
        </div>
      </div>

      {/* OI/CVD/FR */}
      <div className="card">
        <div className="lbl">
          OI · CVD · FR 분석 <span style={{ color:'var(--G)', fontSize:9, fontWeight:700 }}>바이빗 실제값</span>
        </div>
        <div className="g2" style={{ gap:12 }}>
          <div>
            <div className="g3" style={{ marginBottom:8 }}>
              <Mc label="OI 방향" value={oiChg>0?'↑ 증가':oiChg<0?'↓ 감소':'→ 보합'} color={oiChg>0?'var(--G)':oiChg<0?'var(--R)':'var(--muted)'} />
              <Mc label="CVD"     value={(cvd>=0?'+':'')+cvd.toFixed(2)} color={cvd>0.2?'var(--G)':cvd<-0.2?'var(--R)':'var(--muted)'} />
              <Mc label="FR (실제)" value={(fr>=0?'+':'')+fr.toFixed(4)+'%'} color={fr>=0.1?'var(--R)':fr<0?'var(--Y)':'var(--G)'} />
            </div>
            <span className={`pill ${frStatus.cls}`} style={{ width:'100%', textAlign:'center', padding:'6px', fontSize:11, display:'block' }}>
              {frStatus.label}
            </span>
            <div style={{ marginTop:8, background:'rgba(77,142,255,0.06)', borderRadius:8, padding:'9px 10px', fontSize:11, color:'var(--muted)', lineHeight:1.7, border:'0.5px solid rgba(77,142,255,0.15)' }}>
              <span style={{ color:'var(--B)', fontWeight:600 }}>FR(펀딩비)란?</span> 바이빗 선물에서 8시간마다 롱/숏 간 주고받는 수수료.{' '}
              <span style={{ color:'var(--G)' }}>양수</span>=롱 과열 / <span style={{ color:'var(--R)' }}>음수</span>=숏 과열 / <span style={{ color:'var(--Y)' }}>0~0.1%</span>=정상
            </div>
          </div>
          <div style={{ background:'rgba(128,128,128,0.05)', borderRadius:10, padding:10 }}>
            <div style={{ fontSize:10, color:'var(--dim)', marginBottom:5, fontFamily:'var(--font-ui)' }}>시장 상황 판단</div>
            <div style={{ fontSize:13, fontWeight:700, marginBottom:4, color: marketCase.good ? 'var(--G)' : 'var(--R)' }}>{marketCase.ko}</div>
            <div style={{ fontSize:11, color:'var(--muted)', lineHeight:1.6, marginBottom:10 }}>{marketCase.desc}</div>
            <div style={{ fontSize:10, color:'var(--dim)', marginBottom:5, fontFamily:'var(--font-ui)' }}>FR 히스토리</div>
            {frHist.length === 0
              ? <div style={{ fontSize:11, color:'var(--dim)' }}>배포 후 실제 데이터 표시</div>
              : frHist.map((f, i) => {
                  const r = parseFloat(f.fundingRate) * 100
                  const ts = new Date(parseInt(f.fundingRateTimestamp)).toLocaleString('ko-KR',{month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit'})
                  return (
                    <div key={i} style={{ display:'flex', justifyContent:'space-between', padding:'2px 0', fontSize:10 }}>
                      <span style={{ color:'var(--dim)' }}>{ts}</span>
                      <span style={{ color: r>=0.1?'var(--R)':r<=-0.01?'var(--Y)':'var(--G)', fontWeight:600, fontFamily:'var(--font-mono)' }}>
                        {r>=0?'+':''}{r.toFixed(4)}%
                      </span>
                    </div>
                  )
                })
            }
          </div>
        </div>
      </div>

      {/* 체크리스트 */}
      <div className="card">
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:10 }}>
          <div className="lbl" style={{ marginBottom:0 }}>진입 체크리스트</div>
          <div style={{ display:'flex', alignItems:'center', gap:10 }}>
            <div style={{ width:44, height:44, borderRadius:'50%', border:`2.5px solid ${scoreColor}`, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', transition:'border-color .3s' }}>
              <span style={{ fontSize:17, fontWeight:700, lineHeight:1, color:scoreColor, fontFamily:'var(--font-mono)' }}>{score}</span>
              <span style={{ fontSize:9, color:'var(--dim)' }}>/7</span>
            </div>
            <span style={{ fontSize:13, fontWeight:700, color:scoreColor, fontFamily:'var(--font-ui)' }}>
              {score >= 5 ? '진입 가능' : score >= 3 ? '조건 부족' : '진입 금지'}
            </span>
          </div>
        </div>
        {CHECKLIST.map((item, i) => {
          const on = ck[item.id]
          return (
            <div key={item.id} className="chk-row" onClick={() => setCk(s => ({ ...s, [item.id]: !s[item.id] }))}>
              <div className={`chk-box ${on ? 'on' : ''}`}>
                {on && (
                  <svg width="10" height="10" viewBox="0 0 10 10">
                    <path d="M2 5l2.5 2.5L8 3" stroke="var(--G)" strokeWidth="1.5" fill="none" strokeLinecap="round" />
                  </svg>
                )}
              </div>
              <span style={{ fontSize:12, flex:1, color: on ? 'var(--text)' : 'var(--muted)' }}>{item.label}</span>
              <span className={`pill ${on ? 'pill-g' : 'pill-n'}`} style={{ fontSize:9 }}>{item.tag}</span>
            </div>
          )
        })}
      </div>

      {/* 진입 셋업 */}
      <div className="card">
        <div className="lbl">진입 셋업 (1M~5M)</div>
        <div className="notebox">
          <span style={{ color:'var(--Y)', fontWeight:700 }}>1M~5M 진입이란?</span>{' '}
          HTF 방향 → MSS/CHoCH → <span style={{ color:'var(--B)' }}>1~5분봉</span> OB+FVG 겹치는 구간. 스윕 직후 FVG 안 반응 확인 후 진입.
        </div>
        <div style={{ fontSize:13, fontWeight:700, marginBottom:10, color: dir==='LONG'?'var(--G)':'var(--R)' }}>
          {dir === 'LONG' ? '🟢 Bull OB+FVG 중첩' : '🔴 Bear OB+FVG 중첩'}
        </div>
        <div className="g3" style={{ marginBottom:8 }}>
          <Mc label="진입 존" value={fp(ez, sym)}  color="var(--B)" />
          <Mc label="SL"     value={fp(slp, sym)} color="var(--R)" />
          <Mc label="TP"     value={fp(tp, sym)}  color="var(--G)" />
        </div>
        <div className="g3">
          <Mc label="R:R"    value="3.0:1"   color="var(--G)" />
          <Mc label="리스크"  value="2%"     color="var(--Y)" />
          <Mc label="방향"    value={dir}    color={dir==='LONG'?'var(--G)':'var(--R)'} />
        </div>
      </div>
    </div>
  )
}
