// 「つくる」：グラフを描いて、台車の運動と残りのグラフを確かめる
import { useEffect, useMemo, useRef, useState } from 'react'
import { COLOR, SIGMA, SNAP, T_MAX, type Kind } from '../core/constants'
import { integrate, maxAbs, polySlope, smoothSlope, valueAt, type Curve } from '../core/curve'
import { buildMotion } from '../core/motion'
import { passed, score, worstInterval } from '../core/score'
import { PROMPTS, problemById } from '../data/problems'
import { Stage, Transport, type Panel } from './Stage'
import { Btn, Card, Segmented, Toggle } from './common'
import { pickLim, usePlayer, useSketch } from './hooks'

type Props = {
  title: string
  /** 描くグラフを固定する（ステップ学習で使う） */
  fixedSource?: 'x' | 'v'
  /** お題をえらべるようにする */
  prompts?: boolean
  /** くらべるために薄く残す x-t */
  ghostX?: Curve | null
  /** 再生して3秒たったときに知らせる */
  onPlayed?: (r: { x: Curve; v: Curve }) => void
  aids?: { tangent?: boolean; area?: boolean }
  /** はじめから t = 10 s に節点を置いておく（ステップ学習で使う） */
  endNode?: boolean
}

type Verdict = { score: number; band: [number, number] | null }

export function DrawLab({ title, fixedSource, prompts = false, ghostX = null, onPlayed, aids, endNode = false }: Props) {
  const [source, setSource] = useState<'x' | 'v'>(fixedSource ?? 'v')
  const sx = useSketch({ tool: 'poly', endNode })
  const sv = useSketch({ tool: 'poly', endNode })
  const sk = source === 'v' ? sv : sx
  const [x0, setX0] = useState(0)
  const rawX0 = useRef(0)
  const [tangent, setTangent] = useState(!!aids?.tangent)
  const [area, setArea] = useState(!!aids?.area)
  const [promptId, setPromptId] = useState('')
  const [verdict, setVerdict] = useState<Verdict | null>(null)
  const [main, setMain] = useState<Kind>(source)

  const target = useMemo(() => {
    const p = problemById(promptId)
    return p ? buildMotion(p) : null
  }, [promptId])
  const dur = target ? target.dur : T_MAX
  const player = usePlayer(dur)

  const g = useMemo(() => {
    if (source === 'v') {
      const v = sk.curve
      return { v, x: integrate(v, x0), a: sk.tool === 'poly' ? polySlope(sk.nodes) : smoothSlope(v.y, SIGMA.aFromV) }
    }
    const x = sk.curve
    const v = sk.tool === 'poly' ? polySlope(sk.nodes) : smoothSlope(x.y, SIGMA.vFromX)
    return { x, v, a: sk.tool === 'poly' ? null : smoothSlope(v.y, SIGMA.aFromX) }
  }, [source, sk.curve, sk.tool, sk.nodes, x0])

  // 描き直したら、判定は消す
  useEffect(() => setVerdict(null), [g, promptId])

  // 再生して3秒たったら知らせる（1回の再生につき1度）
  const fired = useRef(false)
  useEffect(() => {
    if (!player.playing || player.t < 0.2) fired.current = player.t >= 3
    if (player.playing && player.t >= 3 && !fired.current) {
      fired.current = true
      onPlayed?.({ x: g.x, v: g.v })
    }
  }, [player.playing, player.t, g, onPlayed])

  const xLim = source === 'x' ? 5 : pickLim('x', maxAbs(g.x))
  const vLim = source === 'v' ? 2 : pickLim('v', maxAbs(g.v))
  const t = player.t
  const canPlace = source === 'v' && !player.playing && t === 0

  const switchSource = (s: 'x' | 'v') => {
    setSource(s)
    setMain(s)
    player.reset()
  }
  const clear = () => {
    sk.reset()
    setX0(0)
    rawX0.current = 0
    player.reset()
  }
  const judge = () => {
    if (!target) return
    // x-t を描いたときは、はじめの位置をそろえて（変位で）くらべる
    const student: Curve = source === 'v' ? g.v : { y: g.x.y.map((y) => y - g.x.y[0] + target.x.y[0]), jumps: {} }
    const answer = source === 'v' ? target.v : target.x
    const s = score(student, answer, source, target.dur)
    setVerdict({ score: s, band: passed(s) ? null : worstInterval(student, answer, source, target.dur) })
  }

  const base = { cursor: t, dur, onScrub: player.scrub }
  const panels: Record<Kind, Panel> = {
    x: {
      ...base,
      lim: xLim,
      layers: [
        ...(ghostX ? [{ curve: ghostX, color: '#94a3b8', width: 2.5, dash: [6, 5] }] : []),
        { curve: g.x, color: COLOR.x, filled: source === 'x' ? sk.filled : undefined, main: true },
      ],
      tangent: tangent ? { t, y: valueAt(g.x, t), slope: valueAt(g.v, t) } : null,
      edit: source === 'x' ? sk.edit : null,
      band: source === 'x' ? verdict?.band : null,
      legend: ghostX ? [{ text: '前の運動', color: '#94a3b8', dash: true }, { text: '今の運動', color: COLOR.x }] : undefined,
    },
    v: {
      ...base,
      lim: vLim,
      layers: [{ curve: g.v, color: COLOR.v, filled: source === 'v' ? sk.filled : undefined, main: true }],
      area: area ? { curve: g.v, to: t } : null,
      edit: source === 'v' ? sk.edit : null,
      band: source === 'v' ? verdict?.band : null,
    },
    a: {
      ...base,
      lim: 2,
      layers: g.a ? [{ curve: g.a, color: COLOR.a, main: true }] : [],
      hidden: g.a ? null : 'a-t は表示しません',
    },
  }

  return (
    <div className="flex flex-col gap-2">
      <Card className="flex flex-col gap-2">
        <div className="flex flex-wrap items-center gap-2">
          {!fixedSource && <Segmented label="描くグラフ" value={source} options={[['v', 'v-t を描く'], ['x', 'x-t を描く']]} onChange={switchSource} />}
          <Segmented label="描き方" value={sk.tool} options={[['poly', '折れ線'], ['free', 'フリーハンド']]} onChange={sk.setTool} />
          <Toggle on={tangent} onClick={() => setTangent(!tangent)}>接線</Toggle>
          <Toggle on={area} onClick={() => setArea(!area)}>面積</Toggle>
        </div>
        <p className="text-xs leading-relaxed text-slate-600">
          {sk.tool === 'poly'
            ? `${endNode ? '両はしの○（0 s と 10 s）を上下にドラッグすると、線全体の形を変えられます。間をタップすると点が増え、' : 'グラフをタップして点を置き、'}ドラッグで動かします（長押しで消す）。同じ時刻にもう1つ点を置くと、値を一瞬で変えられます。点は 0.5 s・${SNAP[source]} ${source === 'v' ? 'm/s' : 'm'} きざみです。`
            : '指でなぞって描きます。左へ戻ってなぞると、そこから描き直せます。'}
          {source === 'v' && ' t = 0 のとき、台車をドラッグすると、はじめの位置を変えられます。'}
          {source === 'x' && sk.tool === 'poly' && ' 折れ線の x-t は、角のところで速度が一瞬で変わる運動になるので、a-t は表示しません。'}
        </p>
        {prompts && (
          <div className="flex flex-wrap items-center gap-2 border-t border-slate-100 pt-2">
            <label className="flex min-w-0 flex-1 basis-64 items-center gap-2 text-sm font-bold text-slate-700">
              お題
              <select value={promptId} onChange={(e) => setPromptId(e.target.value)} aria-label="お題" className="h-11 min-w-0 flex-1 rounded-lg border border-slate-300 bg-white px-2 text-sm font-normal">
                <option value="">なし（自由に描く）</option>
                {PROMPTS.map((p) => (
                  <option key={p.id} value={p.id}>{p.text}</option>
                ))}
              </select>
            </label>
            {target && <Btn kind="primary" onClick={judge} disabled={!sk.drawn}>判定する</Btn>}
            {verdict && (
              <p className={`w-full text-sm font-bold ${passed(verdict.score) ? 'text-acc' : 'text-vel'}`} role="status">
                {verdict.score} 点　{passed(verdict.score) ? '合格！ お題どおりの運動です。' : 'もう少し。赤い帯のあたりを見直そう。'}
              </p>
            )}
          </div>
        )}
      </Card>
      <Stage
        title={title}
        track={{
          x: valueAt(g.x, t),
          v: valueAt(g.v, t),
          lim: xLim,
          onDrag: canPlace
            ? (dx) => {
                rawX0.current = Math.min(5, Math.max(-5, rawX0.current + dx))
                setX0(Math.round(rawX0.current / 0.5) * 0.5)
              }
            : undefined,
        }}
        panels={panels}
        main={main}
        onMain={setMain}
        bar={<Transport player={player} dur={dur} onClear={clear} />}
      />
    </div>
  )
}
