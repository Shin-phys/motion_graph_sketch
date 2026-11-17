// 予想チャレンジ：問題の一覧と、1問ずつの出題
import { useMemo, useState } from 'react'
import { PASS } from '../core/constants'
import type { Task } from '../core/motion'
import { loadProgress } from '../core/storage'
import { PROBLEMS, problemById } from '../data/problems'
import { PredictTask, taskLabel } from './PredictTask'
import { Btn, Card, Header } from './common'

type Current = { pid: string; task: Task }

const ALL: Current[] = PROBLEMS.flatMap((p) => p.tasks.map((task) => ({ pid: p.id, task })))
const LEVEL = ['', 'レベル1　一定の速さ', 'レベル2　向きが変わる', 'レベル3　だんだん速く・遅く', 'レベル4　折り返し・総合']

export function PredictMode({ initialId, onHome }: { initialId: string | null; onHome: () => void }) {
  const [cur, setCur] = useState<Current | null>(() => {
    const p = problemById(initialId)
    return p ? { pid: p.id, task: p.tasks[0] } : null
  })
  const [progress, setProgress] = useState(loadProgress)
  const problem = cur ? problemById(cur.pid) : null
  const next = useMemo(() => {
    if (!cur) return null
    const i = ALL.findIndex((c) => c.pid === cur.pid && c.task === cur.task)
    return ALL[i + 1] ?? null
  }, [cur])

  if (cur && problem) {
    return (
      <div className="min-h-dvh">
        <Header title={`${problem.id}　${problem.title}`} onHome={() => { setProgress(loadProgress()); setCur(null) }} />
        <main className="mx-auto max-w-6xl p-2">
          <PredictTask
            key={`${cur.pid}|${cur.task}`}
            problem={problem}
            task={cur.task}
            onResult={() => setProgress(loadProgress())}
            onNext={() => { setProgress(loadProgress()); setCur(next) }}
            nextLabel={next ? '次の問題へ' : '一覧へもどる'}
          />
        </main>
      </div>
    )
  }

  return (
    <div className="min-h-dvh">
      <Header title="予想チャレンジ" onHome={onHome} />
      <main className="mx-auto flex max-w-3xl flex-col gap-3 p-3">
        <p className="text-sm leading-relaxed text-slate-700">
          運動やグラフを1つ見て、別のグラフを<b>予想して描いて</b>から、答え合わせをします。{PASS} 点以上で合格です。
        </p>
        {[1, 2, 3, 4].map((lv) => (
          <Card key={lv}>
            <h2 className="mb-2 text-sm font-bold text-slate-700">{LEVEL[lv]}</h2>
            <ul className="flex flex-col gap-2">
              {PROBLEMS.filter((p) => p.level === lv).map((p) => (
                <li key={p.id} className="flex flex-wrap items-center gap-2 border-t border-slate-100 pt-2 first:border-0 first:pt-0">
                  <span className="w-full text-sm font-bold text-slate-900 sm:w-56">
                    <span className="mr-2 text-xs font-normal text-slate-500">{p.id}</span>
                    {p.title}
                  </span>
                  {p.tasks.map((task) => {
                    const best = progress.predict[`${p.id}|${task}`]
                    const ok = best !== undefined && best >= PASS
                    return (
                      <button
                        key={task}
                        onClick={() => setCur({ pid: p.id, task })}
                        className={`min-h-11 rounded-lg border px-3 text-sm ${ok ? 'border-acc bg-emerald-50 text-emerald-900' : 'border-slate-300 bg-white text-slate-700'}`}
                      >
                        {taskLabel(task)}
                        {best !== undefined && <span className="ml-1 text-xs font-bold">{ok ? '✓' : ''}{best}点</span>}
                      </button>
                    )
                  })}
                </li>
              ))}
            </ul>
          </Card>
        ))}
        <div><Btn onClick={onHome}>トップへもどる</Btn></div>
      </main>
    </div>
  )
}
