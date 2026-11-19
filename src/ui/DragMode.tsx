// 「動かす」：台車を指で動かして、その運動をグラフにする。お手本に合わせて点数を出す「グラフ合わせ」つき
import { useEffect, useMemo, useRef, useState } from 'react'
import { COLOR, N, T_MAX, indexOf, type Kind } from '../core/constants'
import { maxAbs, valueAt, type Curve } from '../core/curve'
import { buildMotion } from '../core/motion'
import { LiveFilter, finalize, type Sample } from '../core/record'
import { passed, score, worstInterval } from '../core/score'
import { loadProgress, recordBest } from '../core/storage'
import { strobeMarks } from '../core/strobe'
import { PROBLEMS, problemById } from '../data/problems'
import type { Layer } from './GraphView'
import { Stage, Transport, type Panel } from './Stage'
import { Btn, Card, Header, Segmented, Toggle } from './common'
import { pickLim, usePlayer, useStrobe } from './hooks'

type Phase = 'idle' | 'count' | 'rec' | 'done'
type Result = { x: Curve; v: Curve; a: Curve }

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v))
const blank = () => Array.from({ length: N }, () => 0)

export function DragMode({ onHome }: { onHome: () => void }) {
  const [sub, setSub] = useState<'free' | 'match'>('free')
  const [pid, setPid] = useState('p01')
  const [mk, setMk] = useState<'x' | 'v'>('x')
  const [hideX, setHideX] = useState(false)
  const [phase, setPhase] = useState<Phase>('idle')
  const [count, setCount] = useState(3)
  const [cart, setCart] = useState(0)
  const [result, setResult] = useState<Result | null>(null)
  const [verdict, setVerdict] = useState<{ score: number; band: [number, number] | null } | null>(null)
  const [best, setBest] = useState(() => loadProgress().match)
  const [main, setMain] = useState<Kind>('x')
  const [strobe, setStrobe] = useStrobe()

  const problem = sub === 'match' ? problemById(pid) : null
  const m = useMemo(() => (problem ? buildMotion(problem) : null), [problem])
  const dur = m ? m.dur : T_MAX
  const player = usePlayer(dur)

  const cartRef = useRef(0)
  const phaseRef = useRef<Phase>('idle')
  phaseRef.current = phase
  const live = useRef({ x: blank(), v: blank(), last: -1, vNow: 0 })
  const timers = useRef<{ raf: number; iv: number }>({ raf: 0, iv: 0 })

  const stop = () => {
    cancelAnimationFrame(timers.current.raf)
    window.clearInterval(timers.current.iv)
  }
  useEffect(() => stop, [])

  const place = (x: number) => {
    cartRef.current = x
    setCart(x)
  }
  // 条件を変えたら、記録は消してはじめから
  const resetAll = (x0: number) => {
    stop()
    setPhase('idle')
    setResult(null)
    setVerdict(null)
    live.current = { x: blank(), v: blank(), last: -1, vNow: 0 }
    player.reset()
    place(x0)
  }
  useEffect(() => {
    resetAll(m ? m.x.y[0] : 0)
    setMain(sub === 'match' ? mk : 'x')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sub, pid, mk])

  const record = () => {
    const raw: Sample[] = []
    const filter = new LiveFilter()
    const t0 = performance.now()
    live.current = { x: blank(), v: blank(), last: -1, vNow: 0 }
    setPhase('rec')
    const loop = (now: number) => {
      const tr = (now - t0) / 1000
      const tt = Math.min(tr, dur)
      raw.push({ t: tt, x: cartRef.current })
      const f = filter.push(tt, cartRef.current)
      const L = live.current
      const i = Math.min(indexOf(dur), Math.floor(tt / 0.05 + 1e-9))
      for (let j = L.last + 1; j <= i; j++) {
        L.x[j] = f.x
        L.v[j] = f.v
      }
      L.last = Math.max(L.last, i)
      L.vNow = f.v
      player.setT(tt)
      if (tr < dur) {
        timers.current.raf = requestAnimationFrame(loop)
        return
      }
      const res = finalize(raw, dur)
      setResult(res)
      setPhase('done')
      if (m) {
        const mine = mk === 'x' ? res.x : res.v
        const goal = mk === 'x' ? m.x : m.v
        const s = score(mine, goal, mk, dur)
        setVerdict({ score: s, band: passed(s) ? null : worstInterval(mine, goal, mk, dur) })
        setBest(recordBest('match', `${pid}|${mk}`, s).match)
      }
    }
    timers.current.raf = requestAnimationFrame(loop)
  }

  const begin = () => {
    resetAll(m ? m.x.y[0] : cartRef.current)
    setPhase('count')
    setCount(3)
    let n = 3
    timers.current.iv = window.setInterval(() => {
      n -= 1
      setCount(n)
      if (n <= 0) {
        window.clearInterval(timers.current.iv)
        record()
      }
    }, 1000)
  }

  const onDrag = (dx: number) => {
    const ph = phaseRef.current
    // グラフ合わせでは、記録が始まるまで台車をはじめの位置に止めておく
    if (ph === 'rec' || (ph !== 'done' && sub === 'free')) place(clamp(cartRef.current + dx, -5, 5))
  }

  const t = player.t
  const L = live.current
  const liveX: Curve = { y: L.x, jumps: {} }
  const liveV: Curve = { y: L.v, jumps: {} }
  const recTo = phase === 'rec' ? t : 0
  const xHidden = sub === 'match' && mk === 'v' && hideX && phase !== 'done'
  const vLim = Math.max(m ? pickLim('v', maxAbs(m.v, indexOf(dur))) : 2, pickLim('v', result ? maxAbs(result.v, indexOf(dur)) : Math.max(...L.v.map(Math.abs))))
  const goal = (k: 'x' | 'v'): Layer[] => (m && mk === k ? [{ curve: k === 'x' ? m.x : m.v, color: COLOR[k], alpha: 0.3, width: 9 }] : [])
  const mine = (k: 'x' | 'v'): Layer[] =>
    result
      ? [{ curve: result[k], color: COLOR[k], main: true }]
      : phase === 'rec'
        ? [{ curve: k === 'x' ? liveX : liveV, color: COLOR[k], to: recTo, main: true }]
        : []
  const base = { dur, cursor: phase === 'rec' || phase === 'done' ? t : null, onScrub: phase === 'done' ? player.scrub : undefined }
  const legend = m ? [{ text: 'お手本', color: '#94a3b8' }, { text: '自分の運動', color: COLOR[mk] }] : undefined
  const panels: Record<Kind, Panel> = {
    x: { ...base, lim: 5, layers: [...goal('x'), ...mine('x')], hidden: xHidden ? 'x-t はかくしています' : null, band: mk === 'x' ? verdict?.band : null, legend: mk === 'x' ? legend : undefined },
    v: { ...base, lim: vLim, layers: [...goal('v'), ...mine('v')], band: mk === 'v' && sub === 'match' ? verdict?.band : null, legend: mk === 'v' && sub === 'match' ? legend : undefined },
    a: { ...base, lim: 2, layers: result ? [{ curve: result.a, color: COLOR.a, main: true }] : [], hidden: result ? null : '記録のあとに表示します' },
  }
  const busy = phase === 'count' || phase === 'rec'

  return (
    <div className="min-h-dvh">
      <Header title="運動 → グラフ（動かす）" onHome={onHome} />
      <main className="mx-auto flex max-w-6xl flex-col gap-2 p-2">
        <Card className="flex flex-col gap-2">
          <div className="flex flex-wrap items-center gap-2">
            <Segmented label="あそび方" value={sub} options={[['free', '自由に動かす'], ['match', 'グラフ合わせ']]} onChange={(v) => !busy && setSub(v)} />
            {sub === 'match' && (
              <>
                <select value={pid} onChange={(e) => setPid(e.target.value)} disabled={busy} aria-label="お手本" className="h-11 min-w-0 flex-1 basis-48 rounded-lg border border-slate-300 bg-white px-2 text-sm">
                  {PROBLEMS.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.id}　{p.title}
                      {best[`${p.id}|${mk}`] !== undefined ? `（最高 ${best[`${p.id}|${mk}`]} 点）` : ''}
                    </option>
                  ))}
                </select>
                <Segmented label="合わせるグラフ" value={mk} options={[['x', 'x-t に合わせる'], ['v', 'v-t に合わせる']]} onChange={(v) => !busy && setMk(v)} />
                {mk === 'v' && <Toggle on={hideX} onClick={() => setHideX(!hideX)} disabled={busy}>x-t をかくす</Toggle>}
              </>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Btn kind="primary" onClick={begin} disabled={busy}>
              {phase === 'done' ? `● もう一度記録（${dur}秒）` : `● 記録（${dur}秒）`}
            </Btn>
            <p className="text-sm text-slate-700" role="status">
              {phase === 'idle' && (sub === 'match' ? '「記録」を押すと 3・2・1 のあとに始まります。うすい線に重なるように、台車を左右に動かそう。' : '「記録」を押すと 3・2・1 のあとに始まります。台車を指で左右に動かそう。')}
              {phase === 'count' && <b className="text-vel">台車に指を置いて… {count}</b>}
              {phase === 'rec' && <b className="text-vel">記録中　残り {Math.max(0, Math.ceil(dur - t))} 秒</b>}
              {phase === 'done' && !verdict && '記録しました。「再生」で台車の動きを見直せます。'}
              {phase === 'done' && verdict && (
                <b className={passed(verdict.score) ? 'text-acc' : 'text-vel'}>
                  <span data-testid="match-score">{verdict.score}</span> 点　{passed(verdict.score) ? '合格！' : 'もう少し。赤い帯のあたりがずれています。'}
                </b>
              )}
            </p>
          </div>
        </Card>
        <Stage
          title={m && problem ? `グラフ合わせ ${problem.id} ${problem.title}` : '運動→グラフ'}
          track={{
            x: phase === 'done' && result ? valueAt(result.x, t) : cart,
            v: phase === 'done' && result ? valueAt(result.v, t) : phase === 'rec' ? L.vNow : null,
            lim: 5,
            onDrag: phase === 'done' ? undefined : onDrag,
            badge: phase === 'count' ? String(count) : null,
            marks: strobe && phase === 'done' && result ? strobeMarks(result.x, t) : strobe && phase === 'rec' ? strobeMarks(liveX, Math.min(t, (L.last * 0.05))) : null,
          }}
          panels={panels}
          main={main}
          onMain={setMain}
          bar={phase === 'done' ? <Transport player={player} dur={dur} strobe={{ on: strobe, set: setStrobe }} /> : null}
        />
      </main>
    </div>
  )
}
