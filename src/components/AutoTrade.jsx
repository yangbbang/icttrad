import { useState } from 'react'
import { fp } from '../utils/format'
import { SHORT } from '../utils/constants'

const COND_LABELS = [
  { k: 'trendBreak', tag: '추세선' },
  { k: 'mss',        tag: 'MSS' },
  { k: 'ote',        tag: 'OTE' },
  { k: 'sweep',      tag: '스윕' },
  { k: 'wedge',      tag: '쐐기' },
  { k: 'hns',        tag: 'H&S' },
]

function Mc({ label, value, color }) {
  return (
    <div className="mc">
      <div className="mc-t">{label}</div>
      <div className="mc-v" style={{ color: color || 'var(--text)' }}>{value}</div>
    </div>
  )
}

const inputStyle = {
  width: '100%', padding: '8px 10px', borderRadius: 8,
  border: '0.5px solid var(--border)', background: 'var(--bg)',
  color: 'var(--text)', fontSize: 12, fontFamily: 'var(--font-mono)', outline: 'none',
}

function Field({ label, children }) {
  return (
    <div>
      <div style={{ fontSize: 10, color: 'var(--dim)', marginBottom: 4, fontFamily: 'var(--font-ui)' }}>{label}</div>
      {children}
    </div>
  )
}

export default function AutoTrade({ at, sym }) {
  const { cfg, saveCfg, running, start, stop, position, equity, log, hist, board, meeting, scanAt, closeNow, resetPaper } = at
  const [form, setForm] = useState(cfg)
  const [saved, setSaved] = useState('')
  const [confirmLive, setConfirmLive] = useState(false)

  const sel = board.find(b => b.sym === sym)?.analysis
  const wins = hist.filter(h => h.pnl >= 0).length
  const totalPnl = hist.reduce((s, h) => s + h.pnl, 0)

  function set(k, v) { setForm(f => ({ ...f, [k]: v })) }
  function handleSave() {
    const next = {
      ...form,
      riskPct: Math.min(5, Math.max(0.1, +form.riskPct || 1)),
      leverage: Math.min(20, Math.max(1, Math.round(+form.leverage || 3))),
      minScore: Math.min(6, Math.max(3, Math.round(+form.minScore || 3))),
      cooldownMin: Math.max(5, Math.round(+form.cooldownMin || 30)),
      maxDaily: Math.min(20, Math.max(1, Math.round(+form.maxDaily || 5))),
      paperEquity: Math.max(100, +form.paperEquity || 10000),
    }
    setForm(next)
    saveCfg(next)
    setSaved('✓ 저장 완료')
    setTimeout(() => setSaved(''), 2000)
  }

  async function handleToggle() {
    if (running) { stop(); return }
    if (cfg.env === 'live' && !confirmLive) { setConfirmLive(true); return }
    setConfirmLive(false)
    await start()
  }

  const envLabel = { paper: '페이퍼 (가상)', demo: '데모 서버', live: '⚠️ 실거래' }

  return (
    <div>
      {/* 경고 */}
      <div className="notebox" style={{ background: 'rgba(240,75,90,0.06)', borderLeftColor: 'var(--R)' }}>
        <span style={{ color: 'var(--R)', fontWeight: 700 }}>주의:</span>{' '}
        자동매매는 원금 손실 위험이 있습니다. 페이퍼/데모로 충분히 검증 후 사용하세요.
        API 키는 이 브라우저 <b>localStorage에만</b> 저장됩니다 — 반드시 <b>출금 권한 없는</b> 키를 사용하고 IP 제한을 설정하세요.
      </div>

      {/* 컨트롤 */}
      <div className="card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10 }}>
          <div>
            <div style={{ fontSize: 14, fontWeight: 800, fontFamily: 'var(--font-ui)', marginBottom: 3 }}>
              {running ? '🟢 가동 중' : '⏸ 정지됨'}
              <span className={`pill ${cfg.env === 'live' ? 'pill-r' : cfg.env === 'demo' ? 'pill-y' : 'pill-b'}`} style={{ marginLeft: 8 }}>
                {envLabel[cfg.env]}
              </span>
            </div>
            <div style={{ fontSize: 11, color: 'var(--muted)' }}>
              자산 <b style={{ color: 'var(--text)', fontFamily: 'var(--font-mono)' }}>{equity.toFixed(2)} USDT</b>
              {scanAt && <span style={{ marginLeft: 8, color: 'var(--dim)' }}>스캔 {new Date(scanAt).toLocaleTimeString('ko-KR')}</span>}
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            {position && (
              <button onClick={closeNow}
                style={{ padding: '10px 16px', borderRadius: 10, border: '0.5px solid var(--Y)', background: 'var(--yBg)', color: 'var(--Y)', fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'var(--font-ui)' }}>
                포지션 청산
              </button>
            )}
            <button onClick={handleToggle}
              style={{
                padding: '10px 22px', borderRadius: 10, fontSize: 13, fontWeight: 800, cursor: 'pointer', fontFamily: 'var(--font-ui)',
                border: `0.5px solid ${running ? 'var(--R)' : 'var(--G)'}`,
                background: running ? 'var(--rBg)' : 'var(--gBg)',
                color: running ? 'var(--R)' : 'var(--G)',
              }}>
              {running ? '정지' : confirmLive ? '실거래 확인 — 한번 더' : '자동매매 시작'}
            </button>
          </div>
        </div>
        {confirmLive && !running && (
          <div style={{ marginTop: 8, fontSize: 11, color: 'var(--R)', fontWeight: 600 }}>
            ⚠️ 실거래 모드입니다. 실제 주문이 나갑니다. 버튼을 한 번 더 누르면 시작됩니다.
          </div>
        )}
      </div>

      {/* 포지션 */}
      {position && (
        <div className="card" style={{ border: `0.5px solid ${position.side === 'Buy' ? 'var(--G)' : 'var(--R)'}` }}>
          <div className="lbl">보유 포지션 {position.env !== 'paper' && <span style={{ color: 'var(--Y)' }}>({position.env === 'live' ? '실거래' : '데모'})</span>}</div>
          <div className="g5">
            <Mc label="심볼" value={`${SHORT[position.sym] || position.sym} ${position.side === 'Buy' ? 'LONG' : 'SHORT'}`} color={position.side === 'Buy' ? 'var(--G)' : 'var(--R)'} />
            <Mc label="진입가" value={fp(position.entry, position.sym)} />
            <Mc label="SL" value={fp(position.sl, position.sym)} color="var(--R)" />
            <Mc label="TP" value={fp(position.tp, position.sym)} color="var(--G)" />
            <Mc label="미실현" value={
              position.unrealised != null ? `${position.unrealised >= 0 ? '+' : ''}${position.unrealised.toFixed(2)}`
              : position.cur ? `${((position.cur - position.entry) * position.qty * (position.side === 'Buy' ? 1 : -1)).toFixed(2)}`
              : '—'
            } color={(position.unrealised ?? ((position.cur || position.entry) - position.entry) * (position.side === 'Buy' ? 1 : -1)) >= 0 ? 'var(--G)' : 'var(--R)'} />
          </div>
        </div>
      )}

      {/* 🏛️ 팀 회의록 */}
      <div className="card">
        <div className="lbl">🏛️ 팀 회의 — 탐색·분석·리스크·학습 의결</div>
        {!meeting ? (
          <div style={{ fontSize: 11, color: 'var(--dim)', padding: '6px 0' }}>
            아직 회의 없음 — 셋업 후보(필수 3조건 충족)가 나오면 자동으로 소집됩니다.
          </div>
        ) : (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
              <span style={{ fontSize: 12, fontWeight: 700 }}>
                {meeting.sym} <span style={{ color: meeting.side === 'LONG' ? 'var(--G)' : 'var(--R)' }}>{meeting.side}</span> (점수 {meeting.score}/6)
              </span>
              <span className={`pill ${meeting.approved ? 'pill-g' : 'pill-r'}`}>{meeting.approved ? '가결 — 진입' : '부결'}</span>
            </div>
            {meeting.votes.map((v, i) => (
              <div key={i} style={{ display: 'flex', gap: 8, padding: '5px 0', borderBottom: '0.5px solid var(--border)', fontSize: 11 }}>
                <span style={{ flexShrink: 0, width: 86, color: 'var(--muted)', fontFamily: 'var(--font-ui)', fontWeight: 600 }}>{v.who}</span>
                <span style={{ flexShrink: 0, color: v.ok ? 'var(--G)' : 'var(--R)', fontWeight: 700 }}>{v.ok ? '✓' : '✗'}</span>
                <span style={{ color: 'var(--text)', lineHeight: 1.5 }}>{v.note}</span>
              </div>
            ))}
            <div style={{ fontSize: 10, color: 'var(--dim)', marginTop: 6 }}>{new Date(meeting.t).toLocaleString('ko-KR')}</div>
          </div>
        )}
      </div>

      {/* 🔍 시그널 보드 */}
      <div className="card">
        <div className="lbl">🔍 전 심볼 시그널 보드 — 추세선 이탈 → MSS → OTE (필수) + 스윕/쐐기/H&S</div>
        {board.length === 0 ? (
          <div style={{ fontSize: 11, color: 'var(--dim)' }}>스캔 중...</div>
        ) : (
          board.map(({ sym: s, analysis: a }) => (
            <div key={s} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 0', borderBottom: '0.5px solid var(--border)', opacity: a ? 1 : 0.4 }}>
              <span style={{ width: 46, fontSize: 12, fontWeight: 700, fontFamily: 'var(--font-mono)', color: s === sym ? 'var(--B)' : 'var(--text)' }}>{SHORT[s]}</span>
              <span style={{ width: 46, fontSize: 10, fontWeight: 700, color: a?.trend.dir === 'LONG' ? 'var(--G)' : a?.trend.dir === 'SHORT' ? 'var(--R)' : 'var(--dim)' }}>
                {a?.trend.dir || '대기'}
              </span>
              <div style={{ display: 'flex', gap: 3, flex: 1, flexWrap: 'wrap' }}>
                {a && COND_LABELS.map(({ k, tag }) => (
                  <span key={k} className={`pill ${a.conds[k] ? 'pill-g' : 'pill-n'}`} style={{ fontSize: 8, padding: '1px 6px' }}>{tag}</span>
                ))}
              </div>
              <span style={{ fontSize: 11, fontWeight: 700, fontFamily: 'var(--font-mono)', color: a?.signal ? 'var(--G)' : 'var(--muted)' }}>
                {a ? `${a.score}/6` : '—'}{a?.signal ? ' ⚡' : ''}
              </span>
            </div>
          ))
        )}
      </div>

      {/* 📊 선택 심볼 상세 */}
      {sel && (
        <div className="g2">
          <div className="card" style={{ marginBottom: 10 }}>
            <div className="lbl">📊 {SHORT[sym]} 구조 분석 ({cfg.htfInterval === 'W' ? '주봉' : '일봉'} 추세선 / {cfg.ltfInterval}분 진입)</div>
            <div className="g2" style={{ marginBottom: 8 }}>
              <Mc label="하락 추세선" value={sel.trend.down ? (sel.trend.down.broken ? '↗ 상방 이탈!' : fp(sel.trend.down.value, sym)) : '없음'}
                  color={sel.trend.down?.broken ? 'var(--G)' : 'var(--muted)'} />
              <Mc label="상승 지지선" value={sel.trend.up ? (sel.trend.up.broken ? '↘ 하방 이탈!' : fp(sel.trend.up.value, sym)) : '없음'}
                  color={sel.trend.up?.broken ? 'var(--R)' : 'var(--muted)'} />
            </div>
            <div className="g3">
              <Mc label="MSS" value={sel.mss ? (sel.mss.dir === 'bull' ? '상승' : '하락') : '—'} color={sel.mss ? (sel.mss.dir === 'bull' ? 'var(--G)' : 'var(--R)') : 'var(--dim)'} />
              <Mc label="스윕" value={sel.sweep ? (sel.sweep.dir === 'bull' ? 'SSL' : 'BSL') : '—'} color={sel.sweep ? 'var(--Y)' : 'var(--dim)'} />
              <Mc label="패턴" value={sel.wedge ? (sel.wedge.type === 'falling' ? '하락쐐기' : '상승쐐기') : sel.hns ? (sel.hns.type === 'hs' ? 'H&S' : '역H&S') : '—'}
                  color={sel.wedge || sel.hns ? 'var(--B)' : 'var(--dim)'} />
            </div>
            {sel.ote && (
              <div style={{ marginTop: 8, background: 'rgba(77,142,255,0.06)', border: '0.5px solid rgba(77,142,255,0.15)', borderRadius: 8, padding: '8px 10px', fontSize: 11, lineHeight: 1.8 }}>
                <span style={{ color: 'var(--B)', fontWeight: 700 }}>OTE 존 ({sel.ote.dir})</span>{' '}
                {fp(sel.ote.zoneLo, sym)} ~ {fp(sel.ote.zoneHi, sym)}
                <span className={`pill ${sel.ote.inZone ? 'pill-g' : 'pill-n'}`} style={{ marginLeft: 6, fontSize: 9 }}>{sel.ote.inZone ? '존 안' : '존 밖'}</span>
                <br />
                <span style={{ color: 'var(--muted)' }}>SL {fp(sel.ote.sl, sym)} (1.13) · TP {fp(sel.ote.tp, sym)} (-0.5)</span>
              </div>
            )}
          </div>
          <div className="card" style={{ marginBottom: 10 }}>
            <div className="lbl">💧 청산 유동성 추정 (코인글래스 히트맵 근사)</div>
            <div style={{ fontSize: 10, color: 'var(--dim)', marginBottom: 6 }}>▲ 위 = 숏 청산(BSL 자석) / ▼ 아래 = 롱 청산(SSL 자석)</div>
            {[...(sel.liq?.above || [])].sort((a, b) => b.p - a.p).map((c, i) => (
              <div key={'a' + i} style={{ display: 'flex', justifyContent: 'space-between', padding: '3px 0', fontSize: 11 }}>
                <span style={{ color: 'var(--G)' }}>▲ {fp(c.p, sym)}</span>
                <div style={{ flex: 1, margin: '5px 8px', height: 5, background: 'rgba(128,128,128,0.1)', borderRadius: 3 }}>
                  <div style={{ width: `${c.w * 100}%`, height: '100%', background: 'var(--G)', borderRadius: 3, opacity: 0.7 }} />
                </div>
                <span style={{ color: 'var(--dim)', fontSize: 10 }}>{Math.round(c.w * 100)}%</span>
              </div>
            ))}
            <div style={{ borderTop: '0.5px dashed var(--border2)', margin: '4px 0', paddingTop: 4, fontSize: 10, color: 'var(--muted)', textAlign: 'center' }}>현재가 {fp(sel.price, sym)}</div>
            {[...(sel.liq?.below || [])].sort((a, b) => b.p - a.p).map((c, i) => (
              <div key={'b' + i} style={{ display: 'flex', justifyContent: 'space-between', padding: '3px 0', fontSize: 11 }}>
                <span style={{ color: 'var(--R)' }}>▼ {fp(c.p, sym)}</span>
                <div style={{ flex: 1, margin: '5px 8px', height: 5, background: 'rgba(128,128,128,0.1)', borderRadius: 3 }}>
                  <div style={{ width: `${c.w * 100}%`, height: '100%', background: 'var(--R)', borderRadius: 3, opacity: 0.7 }} />
                </div>
                <span style={{ color: 'var(--dim)', fontSize: 10 }}>{Math.round(c.w * 100)}%</span>
              </div>
            ))}
            <div style={{ fontSize: 10, color: 'var(--dim)', marginTop: 6 }}>
              정밀 확인: <a href={`https://www.coinglass.com/pro/futures/LiquidationHeatMap`} target="_blank" rel="noreferrer" style={{ color: 'var(--B)' }}>코인글래스 청산 히트맵 ↗</a>
            </div>
          </div>
        </div>
      )}

      {/* 📚 성과 (학습 데이터) */}
      <div className="card">
        <div className="lbl">📚 거래 성과 — 학습 담당 참고 데이터</div>
        <div className="g3" style={{ marginBottom: hist.length ? 8 : 0 }}>
          <Mc label="총 거래" value={`${hist.length}건`} />
          <Mc label="승률" value={hist.length ? `${Math.round(wins / hist.length * 100)}%` : '—'} color={hist.length && wins / hist.length >= 0.5 ? 'var(--G)' : 'var(--R)'} />
          <Mc label="누적 PnL" value={`${totalPnl >= 0 ? '+' : ''}${totalPnl.toFixed(2)}`} color={totalPnl >= 0 ? 'var(--G)' : 'var(--R)'} />
        </div>
        {hist.slice(0, 8).map((h, i) => (
          <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', borderBottom: '0.5px solid var(--border)', fontSize: 11 }}>
            <span style={{ color: 'var(--muted)' }}>{new Date(h.t).toLocaleString('ko-KR', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })}</span>
            <span>{SHORT[h.sym]} {h.side === 'Buy' ? 'L' : 'S'} · {h.reason}</span>
            <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, color: h.pnl >= 0 ? 'var(--G)' : 'var(--R)' }}>
              {h.pnl >= 0 ? '+' : ''}{h.pnl.toFixed(2)}
            </span>
          </div>
        ))}
      </div>

      {/* ⚙️ 설정 */}
      <div className="card">
        <div className="lbl">⚙️ 설정</div>
        <div style={{ display: 'flex', gap: 6, marginBottom: 12 }}>
          {['paper', 'demo', 'live'].map(m => (
            <button key={m} onClick={() => set('env', m)}
              style={{
                flex: 1, padding: '8px', borderRadius: 8, fontSize: 11, fontWeight: 700, cursor: 'pointer', fontFamily: 'var(--font-ui)',
                border: `0.5px solid ${form.env === m ? (m === 'live' ? 'var(--R)' : 'var(--B)') : 'var(--border)'}`,
                background: form.env === m ? (m === 'live' ? 'var(--rBg)' : 'var(--bBg)') : 'transparent',
                color: form.env === m ? (m === 'live' ? 'var(--R)' : 'var(--B)') : 'var(--muted)',
              }}>
              {envLabel[m]}
            </button>
          ))}
        </div>

        {form.env !== 'paper' && (
          <div className="g2" style={{ marginBottom: 10 }}>
            <Field label={`API Key (${form.env === 'demo' ? '데모 계정용' : '⚠️ 실계좌'})`}>
              <input style={inputStyle} value={form.apiKey} onChange={e => set('apiKey', e.target.value)} placeholder="Bybit API Key" />
            </Field>
            <Field label="API Secret">
              <input style={inputStyle} type="password" value={form.apiSecret} onChange={e => set('apiSecret', e.target.value)} placeholder="Bybit API Secret" />
            </Field>
          </div>
        )}

        <div className="g4" style={{ marginBottom: 10 }}>
          <Field label="리스크 % / 회"><input style={inputStyle} type="number" step="0.1" value={form.riskPct} onChange={e => set('riskPct', e.target.value)} /></Field>
          <Field label="레버리지"><input style={inputStyle} type="number" value={form.leverage} onChange={e => set('leverage', e.target.value)} /></Field>
          <Field label="최소 점수 (3~6)"><input style={inputStyle} type="number" value={form.minScore} onChange={e => set('minScore', e.target.value)} /></Field>
          <Field label="쿨다운 (분)"><input style={inputStyle} type="number" value={form.cooldownMin} onChange={e => set('cooldownMin', e.target.value)} /></Field>
        </div>
        <div className="g4" style={{ marginBottom: 12 }}>
          <Field label="일일 최대 진입"><input style={inputStyle} type="number" value={form.maxDaily} onChange={e => set('maxDaily', e.target.value)} /></Field>
          <Field label="추세선 TF">
            <select style={inputStyle} value={form.htfInterval} onChange={e => set('htfInterval', e.target.value)}>
              <option value="D">일봉 (1D)</option>
              <option value="W">주봉 (1W)</option>
            </select>
          </Field>
          <Field label="진입 TF (분)">
            <select style={inputStyle} value={form.ltfInterval} onChange={e => set('ltfInterval', e.target.value)}>
              <option value="5">5분</option>
              <option value="15">15분</option>
              <option value="60">1시간</option>
              <option value="240">4시간</option>
            </select>
          </Field>
          <Field label="페이퍼 시작 자산"><input style={inputStyle} type="number" value={form.paperEquity} onChange={e => set('paperEquity', e.target.value)} /></Field>
        </div>

        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <button onClick={handleSave}
            style={{ padding: '9px 18px', borderRadius: 9, border: '0.5px solid var(--G)', background: 'var(--gBg)', color: 'var(--G)', fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'var(--font-ui)' }}>
            설정 저장
          </button>
          <button onClick={resetPaper}
            style={{ padding: '9px 14px', borderRadius: 9, border: '0.5px solid var(--border)', background: 'transparent', color: 'var(--muted)', fontSize: 12, cursor: 'pointer', fontFamily: 'var(--font-ui)' }}>
            페이퍼 초기화
          </button>
          {saved && <span style={{ fontSize: 12, color: 'var(--G)', fontWeight: 600 }}>{saved}</span>}
        </div>
      </div>

      {/* 로그 */}
      <div className="card">
        <div className="lbl">활동 로그</div>
        {log.length === 0 ? (
          <div style={{ fontSize: 11, color: 'var(--dim)' }}>기록 없음</div>
        ) : (
          <div style={{ maxHeight: 260, overflowY: 'auto' }}>
            {log.map((l, i) => (
              <div key={i} style={{ display: 'flex', gap: 8, padding: '4px 0', borderBottom: '0.5px solid var(--border)', fontSize: 11 }}>
                <span style={{ color: 'var(--dim)', flexShrink: 0, fontFamily: 'var(--font-mono)' }}>
                  {new Date(l.t).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })}
                </span>
                <span style={{ color: l.type === 'g' ? 'var(--G)' : l.type === 'r' ? 'var(--R)' : 'var(--muted)', lineHeight: 1.5 }}>{l.msg}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
