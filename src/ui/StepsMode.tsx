// ステップ学習：操作課題 → 気づきを1文でえらぶ → 次へ
import { useEffect, useRef, useState } from 'react'
import type { Curve } from '../core/curve'
import { loadProgress, markStep } from '../core/storage'
import { problemById } from '../data/problems'
import { STEPS, type Played } from '../data/steps'
import { DrawLab } from './DrawLab'
import { PredictTask } from './PredictTask'
import { Btn, Card, Header } from './common'

type Props = { initialStep: number | null; onHome: () => void; onMode: (m: 'draw' | 'drag' | 'predict') => void }

export function StepsMode({ initialStep, onHome, onMode }: Props) {
  const [done, setDone] = useState<number[]>(() => loadProgress().steps)
  const [n, setN] = useState(() => {
    if (initialStep && initialStep >= 1 && initialStep <= STEPS.length) return initialStep
    const d = loadProgress().steps
    return STEPS.find((s) => !d.includes(s.n))?.n ?? 1
  })
  const [finished, setFinished] = useState(false)
  const step = STEPS[n - 1]

  // ステップごとの状態
  const [checkIdx, setCheckIdx] = useState(0)
  const [taskIdx, setTaskIdx] = useState(0)
  const [first, setFirst] = useState<Played | null>(null)
  const [ghost, setGhost] = useState<Curve | null>(null)
  const [miss, setMiss] = useState('')
  const [insight, setInsight] = useState(false)
  const [choice, setChoice] = useState<number | null>(null)
  const insightRef = useRef<HTMLDivElement>(null)

  const go = (k: number) => {
    setN(k)
    setCheckIdx(0)
    setTaskIdx(0)
    setFirst(null)
    setGhost(null)
    setMiss('')
    setInsight(false)
    setChoice(null)
    setFinished(false)
    window.scrollTo(0, 0)
  }
  useEffect(() => {
    if (insight) insightRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' })
  }, [insight])

  const onPlayed = (r: Played) => {
    const checks = step.checks ?? []
    const c = checks[checkIdx]
    if (!c) return
    if (!c.test(r, first)) {
      setMiss(c.miss)
      return
    }
    setMiss('')
    if (checkIdx === 0) {
      setFirst(r)
      if (checks.length > 1) setGhost(r.x)
    }
    if (checkIdx + 1 >= checks.length) setInsight(true)
    setCheckIdx(checkIdx + 1)
  }
  const next = () => {
    setDone(markStep(n).steps)
    if (n >= STEPS.length) setFinished(true)
    else go(n + 1)
  }

  const task = step.tasks?.[taskIdx]
  const problem = task ? problemById(task.pid) : null

  return (
    <div className="min-h-dvh">
      <Header title="ステップ学習" onHome={onHome} />
      <main className="mx-auto flex max-w-6xl flex-col gap-2 p-2">
        <nav className="flex flex-wrap gap-1.5" aria-label="ステップ">
          {STEPS.map((s) => (
            <button
              key={s.n}
              onClick={() => go(s.n)}
              aria-current={s.n === n ? 'step' : undefined}
              aria-label={`ステップ${s.n} ${s.title}${done.includes(s.n) ? '（済み）' : ''}`}
              className={`min-h-11 min-w-11 rounded-full border-2 px-2 text-sm font-bold ${s.n === n ? 'border-pos bg-pos text-white' : done.includes(s.n) ? 'border-acc bg-emerald-50 text-emerald-900' : 'border-slate-300 bg-white text-slate-600'}`}
            >
              {done.includes(s.n) && s.n !== n ? '✓' : s.n}
            </button>
          ))}
        </nav>

        {finished ? (
          <Card className="flex flex-col gap-3 text-center">
            <p className="text-lg font-bold text-slate-900">8つのステップが終わりました！</p>
            <p className="text-sm text-slate-700">x-t の傾きが v、v-t の傾きが a、v-t の面積が変位。このつながりを使って、ほかのモードにも挑戦しよう。</p>
            <div className="flex flex-wrap justify-center gap-2">
              <Btn kind="primary" onClick={() => onMode('predict')}>予想チャレンジへ</Btn>
              <Btn onClick={() => onMode('drag')}>グラフ合わせへ</Btn>
              <Btn onClick={() => onMode('draw')}>自由につくる</Btn>
            </div>
          </Card>
        ) : (
          <>
            <Card className="flex flex-col gap-2">
              <h2 className="text-base font-bold text-slate-900">
                ステップ{step.n}　{step.title}
              </h2>
              <p className="text-sm leading-relaxed text-slate-700">{step.intro}</p>
              {step.checks && (
                <ol className="flex flex-col gap-1 text-sm">
                  {step.checks.map((c, i) => (
                    <li key={i} className={`rounded-lg px-3 py-2 ${i < checkIdx ? 'bg-emerald-50 text-emerald-900' : i === checkIdx ? 'bg-sky-50 font-bold text-slate-900' : 'bg-slate-50 text-slate-500'}`}>
                      {i < checkIdx ? '✓ ' : `${i + 1}. `}
                      {c.text}
                    </li>
                  ))}
                </ol>
              )}
              {step.tasks && step.tasks.length > 1 && !insight && (
                <p className="text-sm font-bold text-slate-700">
                  {taskIdx + 1} / {step.tasks.length} 問目
                </p>
              )}
              {miss && <p className="text-sm text-vel" role="status">{miss}</p>}
            </Card>

            {insight && (
              <div ref={insightRef}>
                <Card className="flex flex-col gap-2 ring-2 ring-sky-200">
                  <p className="text-sm font-bold text-slate-900">気づいたことをえらぼう：{step.question}</p>
                  <div className="flex flex-col gap-2">
                    {step.choices.map((c, i) => (
                      <button
                        key={i}
                        onClick={() => setChoice(i)}
                        aria-pressed={choice === i}
                        className={`min-h-11 rounded-lg border-2 px-3 py-2 text-left text-sm ${choice === i ? (i === step.correct ? 'border-acc bg-emerald-50' : 'border-vel bg-orange-50') : 'border-slate-300 bg-white'}`}
                      >
                        {c}
                      </button>
                    ))}
                  </div>
                  {choice !== null && (
                    <p className={`text-sm ${choice === step.correct ? 'font-bold text-emerald-800' : 'text-vel'}`} role="status">
                      {choice === step.correct ? `そのとおり。${step.point}` : `もう一度確かめよう：${step.again}`}
                    </p>
                  )}
                  <div>
                    <Btn kind="primary" onClick={next} disabled={choice === null}>{n >= STEPS.length ? 'おわる' : '次のステップへ'}</Btn>
                  </div>
                </Card>
              </div>
            )}

            {step.checks && <DrawLab key={`s${n}`} title={`ステップ${step.n} ${step.title}`} fixedSource="v" ghostX={ghost} onPlayed={onPlayed} />}
            {task && problem && (
              <PredictTask
                key={`s${n}t${taskIdx}`}
                problem={problem}
                task={task.task}
                aids={step.aids}
                onNext={() => {
                  if (taskIdx + 1 < (step.tasks?.length ?? 0)) setTaskIdx(taskIdx + 1)
                  else setInsight(true)
                }}
                nextLabel={taskIdx + 1 < (step.tasks?.length ?? 0) ? '次のグラフへ' : '気づきをまとめる'}
              />
            )}
          </>
        )}
      </main>
    </div>
  )
}
