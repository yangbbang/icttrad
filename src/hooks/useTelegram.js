import { useState, useCallback, useRef } from 'react'

export function useTelegram() {
  const [token,   setToken]   = useState(() => localStorage.getItem('tg_tok') || '')
  const [chatId,  setChatId]  = useState(() => localStorage.getItem('tg_cid') || '')
  const [enabled, setEnabled] = useState(() => localStorage.getItem('tg_on') === 'true')
  const lastAt = useRef({})

  const save = useCallback((tok, cid) => {
    if (!tok || !cid) return false
    localStorage.setItem('tg_tok', tok)
    localStorage.setItem('tg_cid', cid)
    localStorage.setItem('tg_on', 'true')
    setToken(tok); setChatId(cid); setEnabled(true)
    return true
  }, [])

  const disable = useCallback(() => {
    localStorage.setItem('tg_on', 'false')
    setEnabled(false)
  }, [])

  const send = useCallback(async (msg, tok = token, cid = chatId) => {
    if (!tok || !cid) return false
    try {
      const r = await fetch(`https://api.telegram.org/bot${tok}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chat_id: cid, text: msg, parse_mode: 'HTML' }),
      })
      const d = await r.json()
      return d.ok
    } catch { return false }
  }, [token, chatId])

  const sendAlert = useCallback((sym, data, score) => {
    if (!enabled) return
    const now = Date.now()
    if (lastAt.current[sym] && now - lastAt.current[sym] < 300000) return
    lastAt.current[sym] = now
    const d = data
    const msg = `📊 <b>ICT 셋업 감지!</b>\n\n${d.dir === 'LONG' ? '🟢' : '🔴'} ${d.dir} <b>${sym} (Bybit)</b>\n현재가: ${d.price?.toFixed(2)}\n진입: ${d.ez?.toFixed(2)} | SL: ${d.slp?.toFixed(2)} | TP: ${d.tp?.toFixed(2)}\nFR: ${(d.fr >= 0 ? '+' : '') + d.fr?.toFixed(4)}%\nR:R: 3:1 | 체크리스트: ${score}/7\n⏰ ${new Date().toLocaleTimeString('ko-KR')}`
    send(msg)
  }, [enabled, send])

  return { token, chatId, enabled, save, disable, send, sendAlert }
}
