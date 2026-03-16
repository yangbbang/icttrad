import { useState } from 'react'

export default function TelegramModal({ open, onClose, tg }) {
  const [tok, setTok] = useState(tg.token)
  const [cid, setCid] = useState(tg.chatId)
  const [msg, setMsg] = useState('')

  async function handleTest() {
    setMsg('전송 중...')
    const ok = await tg.send('✅ ICT Chart (Bybit) 연결 성공!\n\n셋업 감지 예시:\n🟢 LONG BTCUSDT\n진입: $84,000 | SL: $82,200 | TP: $89,600\nFR: +0.0100% | R:R: 3:1 | 체크리스트: 6/7', tok, cid)
    setMsg(ok ? '✓ 테스트 성공!' : '❌ 실패 — Token/Chat ID 확인')
    setTimeout(() => setMsg(''), 3000)
  }
  function handleSave() {
    if (tg.save(tok, cid)) { setMsg('✓ 저장 완료!'); setTimeout(() => { setMsg(''); onClose() }, 1000) }
    else setMsg('❌ Token과 Chat ID를 입력하세요')
  }

  if (!open) return null
  return (
    <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.75)', zIndex:100, display:'flex', alignItems:'center', justifyContent:'center', padding:16 }}
         onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={{ background:'var(--nav)', border:'1px solid var(--border)', borderRadius:18, padding:22, maxWidth:440, width:'100%', maxHeight:'90vh', overflowY:'auto' }}>
        <div style={{ fontSize:16, fontWeight:800, marginBottom:6, fontFamily:'var(--font-ui)' }}>📱 텔레그램 알람 설정</div>
        <div style={{ fontSize:11, color:'var(--muted)', marginBottom:16, lineHeight:1.7 }}>
          ICT 셋업 점수 5/7 이상 시 자동 알람.
        </div>

        {/* 가이드 */}
        <div style={{ background:'rgba(77,142,255,0.07)', border:'0.5px solid rgba(77,142,255,0.2)', borderRadius:10, padding:12, marginBottom:16, fontSize:11, color:'var(--muted)', lineHeight:2 }}>
          <div style={{ color:'var(--B)', fontWeight:700, marginBottom:4 }}>🤖 Bot Token 발급</div>
          <div>1. 텔레그램 → <b style={{ color:'var(--text)' }}>@BotFather</b> → /newbot</div>
          <div>2. 봇 이름 설정 후 Token 복사</div>
          <div style={{ marginTop:8, color:'var(--B)', fontWeight:700, marginBottom:4 }}>🆔 Chat ID 확인</div>
          <div>1. 만든 봇에게 아무 메시지 전송</div>
          <div>2. 브라우저에서:</div>
          <div style={{ background:'rgba(0,0,0,0.3)', borderRadius:5, padding:'4px 8px', margin:'3px 0', wordBreak:'break-all', color:'var(--Y)', fontSize:10 }}>
            https://api.telegram.org/bot<b>TOKEN</b>/getUpdates
          </div>
          <div>3. "id" 값이 Chat ID</div>
        </div>

        <div style={{ marginBottom:10 }}>
          <div style={{ fontSize:11, color:'var(--dim)', marginBottom:5 }}>Bot Token</div>
          <input value={tok} onChange={e => setTok(e.target.value)}
            placeholder="1234567890:AAF-xxx..."
            style={{ width:'100%', padding:'9px 11px', borderRadius:9, border:'0.5px solid var(--border)', background:'var(--bg)', color:'var(--text)', fontSize:12, fontFamily:'var(--font-mono)', outline:'none' }} />
        </div>
        <div style={{ marginBottom:16 }}>
          <div style={{ fontSize:11, color:'var(--dim)', marginBottom:5 }}>Chat ID</div>
          <input value={cid} onChange={e => setCid(e.target.value)}
            placeholder="123456789"
            style={{ width:'100%', padding:'9px 11px', borderRadius:9, border:'0.5px solid var(--border)', background:'var(--bg)', color:'var(--text)', fontSize:12, fontFamily:'var(--font-mono)', outline:'none' }} />
        </div>

        {msg && <div style={{ textAlign:'center', fontSize:12, color: msg.startsWith('✓') ? 'var(--G)' : 'var(--R)', marginBottom:10, fontWeight:600 }}>{msg}</div>}

        <div style={{ display:'flex', gap:8 }}>
          <button onClick={handleTest}
            style={{ flex:1, padding:'9px', borderRadius:9, border:'0.5px solid var(--B)', background:'var(--bBg)', color:'var(--B)', fontSize:12, fontWeight:700, cursor:'pointer', fontFamily:'var(--font-ui)' }}>
            테스트
          </button>
          <button onClick={handleSave}
            style={{ flex:1, padding:'9px', borderRadius:9, border:'0.5px solid var(--G)', background:'var(--gBg)', color:'var(--G)', fontSize:12, fontWeight:700, cursor:'pointer', fontFamily:'var(--font-ui)' }}>
            저장 활성화
          </button>
          <button onClick={onClose}
            style={{ padding:'9px 14px', borderRadius:9, border:'0.5px solid var(--border)', background:'transparent', color:'var(--muted)', fontSize:12, cursor:'pointer', fontFamily:'var(--font-ui)' }}>
            닫기
          </button>
        </div>
      </div>
    </div>
  )
}
