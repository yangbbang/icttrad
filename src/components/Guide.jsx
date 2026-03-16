export default function Guide() {
  const steps = [
    { n:1, color:'var(--B)', bg:'var(--bBg)', title:'유동성 파악 (Liquidity)',
      content: <><div style={{marginBottom:5}}><span style={{color:'var(--B)',fontWeight:700}}>BSL</span> — 스윙 고점 위 매수 Stop Loss. 돌파 → BSL 스윕 → 하락 신호.</div><div><span style={{color:'var(--R)',fontWeight:700}}>SSL</span> — 스윙 저점 아래 매도 Stop Loss. 이탈 → SSL 스윕 → 반등 신호.</div></> },
    { n:2, color:'var(--G)', bg:'var(--gBg)', title:'주문흐름 판단',
      content: <>HTF 방향 먼저 확인. SSL 스윕 → <span style={{color:'var(--G)'}}>매수 바이어스</span>, BSL 스윕 → <span style={{color:'var(--R)'}}>매도 바이어스</span>. MSS/CHoCH로 구조 전환 확인.</> },
    { n:3, color:'var(--Y)', bg:'var(--yBg)', title:'진입 존 도출 (OB + FVG)',
      content: <><div style={{marginBottom:5}}><span style={{color:'var(--Y)',fontWeight:700}}>OB</span> — 큰 이동 전 마지막 반대 캔들. 기관 포지션 흔적.</div><div style={{marginBottom:5}}><span style={{color:'var(--Y)',fontWeight:700}}>FVG</span> — 세 캔들 사이 가격 공백. 채우러 돌아오는 경향.</div><div><span style={{color:'var(--G)',fontWeight:700}}>최적 진입</span> — OB + FVG 겹치는 구간.</div></> },
    { n:4, color:'var(--R)', bg:'var(--rBg)', title:'트레이드 셋업',
      content: <div className="g2"><div style={{background:'rgba(128,128,128,0.05)',borderRadius:8,padding:10,textAlign:'center'}}><div style={{fontSize:10,color:'var(--dim)',marginBottom:3}}>최소 R:R</div><div style={{fontSize:20,fontWeight:800,color:'var(--G)',fontFamily:'var(--font-ui)'}}>3:1</div></div><div style={{background:'rgba(128,128,128,0.05)',borderRadius:8,padding:10,textAlign:'center'}}><div style={{fontSize:10,color:'var(--dim)',marginBottom:3}}>최대 리스크</div><div style={{fontSize:20,fontWeight:800,color:'var(--R)',fontFamily:'var(--font-ui)'}}>2%</div></div></div> },
  ]

  return (
    <div>
      <div className="card">
        <div style={{fontSize:17,fontWeight:800,marginBottom:5,fontFamily:'var(--font-ui)'}}>ICT 단타 전략 가이드</div>
        <div style={{fontSize:12,color:'var(--muted)'}}>Inner Circle Trader 기반 4단계 스캘핑 전략</div>
      </div>

      {steps.map(s => (
        <div key={s.n} className="card">
          <div style={{display:'flex',gap:11,alignItems:'center',marginBottom:11}}>
            <div style={{width:30,height:30,borderRadius:8,background:s.bg,color:s.color,display:'flex',alignItems:'center',justifyContent:'center',fontWeight:800,fontSize:15,flexShrink:0,fontFamily:'var(--font-ui)'}}>
              {s.n}
            </div>
            <div style={{fontSize:14,fontWeight:700,fontFamily:'var(--font-ui)'}}>{s.title}</div>
          </div>
          <div style={{fontSize:12,color:'var(--muted)',lineHeight:1.8}}>{s.content}</div>
        </div>
      ))}

      <div className="card" style={{borderColor:'rgba(77,142,255,0.2)',background:'rgba(77,142,255,0.04)'}}>
        <div style={{fontSize:13,fontWeight:700,color:'var(--B)',marginBottom:10,fontFamily:'var(--font-ui)'}}>📊 바이빗 FR(펀딩비) 해석</div>
        <div style={{fontSize:11,color:'var(--muted)',lineHeight:2.2}}>
          {[
            ['var(--G)', '0~0.05%',  '정상. 진입 가능 구간'],
            ['var(--Y)', '0.05~0.1%','약간 과열. 주의 필요'],
            ['var(--R)', '0.1% 초과','롱 과열. 진입 금지'],
            ['var(--R)', '음수(-)',  '숏 과열. 숏커버 반등 위험'],
          ].map(([c, fr, desc]) => (
            <div key={fr}>• FR <span style={{color:c,fontWeight:600}}>{fr}</span> — {desc}</div>
          ))}
          <div style={{marginTop:8,color:'var(--dim)',fontSize:10}}>※ 바이낸스 FR 기준(2.5%)과 다름 — 바이빗은 소수점 % 단위로 표시</div>
        </div>
      </div>
    </div>
  )
}
