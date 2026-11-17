// 予想チャレンジの1問：見る → 予想して描く → 答え合わせ → 振り返り
import { useEffect, useMemo, useState } from 'react'
import { COLOR, COVERAGE, UNIT, type Kind } from '../core/constants'
import { valueAt } from '../core/curve'
import { buildMotion, curveOf, hasCurve, splitTask, type Problem, type Task } from '../core/motion'
import { HINTS, detectPattern } from '../core/patterns'
import { passed, score, worstInterval } from '../core/score'
import { recordBest } from '../core/storage'
import type { Layer } from './GraphView'
import { Stage, Transport, type Panel } from './Stage'
import { Btn, Card, Segmented, Toggle, fmt } from './common'
import { usePlayer, useSketch } from './hooks'

const KIND: Record<'xt' | 'vt' | 'at', Kind> = { xt: 'x', vt: 'v', at: 'a' }
const GRAPH: Record<Kind, string> = { x: 'x-t', v: 'v-t', a: 'a-t' }
const LIM: Record<Kind, number> = { x: 5, v: 2, a: 2 }
const STUDENT = '#475569'
const REFLECT = ['向きがちがった', '傾きの大きさがちがった', '形がちがった', '合っていた']

export const taskLabel = (task: Task) => {
  const { show, ask } = splitTask(task)
  return `${show === 'anim' ? '運動' : GRAPH[KIND[show]]} → ${GRAPH[KIND[ask]]}`
}

type Props = {
  problem: Problem
  task: Task
  aids?: { tangent?: boolean; area?: boolean }
  onResult?: (score: number) => void
  onNext?: () => void
  nextLabel?: string
}

export function PredictTask({ problem, task, aids, onResult, onNext, nextLabel = '次の問題へ' }: Props) {
  const m = useMemo(() => buildMotion(problem), [problem])
  const { show, ask } = splitTask(task)
  const kind = KIND[ask]
  const shown: Kind | null = show === 'anim' ? null : KIND[show]
  const answer = curveOf(m, ask)!
  // v-t から x-t を描くときは、はじめの位置を示して固定する
  const lockFirst = ask === 'xt' && show !== 'anim'
  const sk = useSketch({ tool: ask === 'xt' && hasCurve(problem) ? 'free' : 'poly', firstY: lockFirst ? problem.x0 : 0, lockFirst })
  const player = usePlayer(m.dur)
  const [phase, setPhase] = useState<'draw' | 'reveal' | 'done'>('draw')
  const [tangent, setTangent] = useState(!!aids?.tangent)
  const [area, setArea] = useState(!!aids?.area)
  const [reflect, setReflect] = useState<number | null>(null)
  const [main, setMain] = useState<Kind>(kind)

  const t = player.t
  const ready = sk.drawn && sk.coverage(m.dur) >= COVERAGE - 1e-9
  // グラフを見て x-t を描く問題では、答え合わせまで台車を動かさない（動きが答えそのものになるため）
  const animates = phase !== 'draw' || !(ask === 'xt' && show !== 'anim')

  const result = useMemo(() => {
    if (phase !== 'done') return null
    const s = score(sk.curve, answer, kind, m.dur)
    return {
      score: s,
      pattern: passed(s) ? null : detectPattern(sk.curve, task, m),
      band: passed(s) ? null : worstInterval(sk.curve, answer, kind, m.dur),
    }
  }, [phase, sk.curve, answer, kind, m, task])

  // 答えを描き終えたら、結果へ
  useEffect(() => {
    if (phase === 'reveal' && !player.playing && player.t >= m.dur - 1e-9) setPhase('done')
  }, [phase, player.playing, player.t, m.dur])
  useEffect(() => {
    if (!result) return
    recordBest('predict', `${problem.id}|${task}`, result.score)
    onResult?.(result.score)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [result])

  const check = () => {
    setPhase('reveal')
    player.setSpeed(1)
    player.setT(0)
    player.setPlaying(true)
  }
  const retry = () => {
    sk.reset()
    setReflect(null)
    setPhase('draw')
    setMain(kind)
    player.reset()
  }

  const open = phase !== 'draw'
  const upTo = phase === 'reveal' ? t : m.dur
  const panelOf = (k: Kind): Panel => {
    const base = { lim: LIM[k], dur: m.dur, cursor: t as number | null }
    const curve = k === 'x' ? m.x : k === 'v' ? m.v : m.a
    const extra = {
      tangent: k === 'x' && tangent && (open || shown === 'x') ? { t, y: valueAt(m.x, t), slope: valueAt(m.v, t) } : null,
      area: k === 'v' && area && (open || shown === 'v') ? { curve: m.v, to: t } : null,
    }
    if (k === kind) {
      const mine: Layer = { curve: sk.curve, color: open ? STUDENT : COLOR[k], dash: open ? [7, 5] : undefined, width: open ? 2.5 : 3, filled: sk.filled, to: m.dur }
      return {
        ...base,
        ...extra,
        cursor: open || show === 'anim' || shown !== null ? t : null,
        layers: open ? [mine, { curve, color: COLOR[k], to: upTo, main: true }] : sk.drawn || lockFirst ? [mine] : [],
        edit: open ? null : sk.edit,
        onScrub: open ? player.scrub : undefined,
        dot: lockFirst ? { t: 0, y: problem.x0 } : null,
        band: result?.band ?? null,
        legend: open ? [{ text: '予想', color: STUDENT, dash: true }, { text: '正解', color: COLOR[k] }] : undefined,
      }
    }
    if (!open && k !== shown) return { ...base, layers: [], hidden: '答え合わせのあとに表示' }
    return { ...base, ...extra, layers: [{ curve, color: COLOR[k], to: open ? upTo : m.dur, main: true }], onScrub: phase === 'reveal' ? undefined : player.scrub }
  }
  const panels: Record<Kind, Panel> = { x: panelOf('x'), v: panelOf('v'), a: panelOf('a') }
  const showTangent = open || shown === 'x'
  const showArea = open || shown === 'v'

  return (
    <div className="flex flex-col gap-2">
      <Card className="flex flex-col gap-2">
        <p className="text-sm font-bold text-slate-900" data-testid="task-instruction">
          {show === 'anim' ? '台車の運動を見て、' : `${GRAPH[KIND[show]]} グラフを見て、`}
          <span style={{ color: COLOR[kind] }}>{GRAPH[kind]} グラフ</span>を予想して描こう。
        </p>
        <p className="text-xs leading-relaxed text-slate-600">
          {show === 'anim' ? '「再生」で台車が動きます。何度でも見直せます。' : `${GRAPH[KIND[show]]} グラフをなぞると、時刻ごとの値を読めます。`}
          {lockFirst && ` はじめの位置は ${fmt(problem.x0)} ${UNIT.x}（●）です。`}
          {m.dur < 10 && ` 運動は ${m.dur} 秒で終わります（網かけの手前まで描こう）。`}
        </p>
        {phase === 'draw' && (
          <div className="flex flex-wrap items-center gap-2">
            <Segmented label="描き方" value={sk.tool} options={[['poly', '折れ線'], ['free', 'フリーハンド']]} onChange={sk.setTool} />
            {showTangent && <Toggle on={tangent} onClick={() => setTangent(!tangent)}>接線</Toggle>}
            {showArea && <Toggle on={area} onClick={() => setArea(!area)}>面積</Toggle>}
            <Btn onClick={sk.reset} disabled={!sk.drawn}>描き直す</Btn>
            <Btn kind="primary" onClick={check} disabled={!ready}>答え合わせ</Btn>
            {!ready && <span className="text-xs text-slate-500">運動の終わり（{m.dur} s）の近くまで描くと、答え合わせができます。</span>}
          </div>
        )}
        {phase === 'reveal' && (
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-bold text-slate-700">答え合わせ中… 正解のグラフが描かれていきます。</span>
            <Btn onClick={() => player.scrub(m.dur)}>最後まで進める</Btn>
          </div>
        )}
        {result && (
          <div className="flex flex-col gap-2 border-t border-slate-100 pt-2" role="status">
            <p className={`text-lg font-bold ${passed(result.score) ? 'text-acc' : 'text-vel'}`}>
              <span data-testid="score">{result.score}</span> 点　{passed(result.score) ? '合格！' : 'もう少し'}
            </p>
            {result.pattern && <p className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-900" data-testid="hint">ヒント：{HINTS[result.pattern]}</p>}
            {!result.pattern && result.band && <p className="text-sm text-slate-700">赤い帯のあたりで、予想（破線）と正解のずれが大きくなっています。</p>}
            <div>
              <p className="mb-1 text-sm font-bold text-slate-700">どこがちがった？</p>
              <div className="flex flex-wrap gap-2">
                {REFLECT.map((r, i) => (
                  <Toggle key={r} on={reflect === i} onClick={() => setReflect(i)}>{r}</Toggle>
                ))}
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <Toggle on={tangent} onClick={() => setTangent(!tangent)}>接線</Toggle>
              <Toggle on={area} onClick={() => setArea(!area)}>面積</Toggle>
              <Btn onClick={retry}>もう一度描く</Btn>
              {onNext && <Btn kind="primary" onClick={onNext} disabled={reflect === null}>{nextLabel}</Btn>}
            </div>
          </div>
        )}
      </Card>
      <Stage
        title={`${problem.id} ${problem.title}（${taskLabel(task)}）`}
        track={{ x: animates ? valueAt(m.x, t) : problem.x0, v: open ? valueAt(m.v, t) : null, lim: 5 }}
        panels={panels}
        main={main}
        onMain={open ? setMain : undefined}
        bar={phase === 'reveal' ? null : <Transport player={player} dur={m.dur} canPlay={animates} />}
      />
    </div>
  )
}
