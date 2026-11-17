import { useEffect, useMemo, useState } from 'react'
import { DragMode } from './DragMode'
import { DrawLab } from './DrawLab'
import { Home, type Mode } from './Home'
import { PredictMode } from './PredictMode'
import { StepsMode } from './StepsMode'
import { Header } from './common'

/** URL：?mode=draw|drag|predict|steps　&id=p05（予想チャレンジ）　&step=3（ステップ学習）　&big=1（投影） */
function readUrl(): { mode: Mode | null; id: string | null; step: number | null; big: boolean } {
  const p = new URLSearchParams(location.search)
  const m = p.get('mode')
  const step = Number(p.get('step'))
  return {
    mode: m === 'draw' || m === 'drag' || m === 'predict' || m === 'steps' ? m : null,
    id: p.get('id'),
    step: Number.isInteger(step) && step >= 1 ? step : null,
    big: p.get('big') === '1',
  }
}

export default function App() {
  const init = useMemo(readUrl, [])
  const [mode, setMode] = useState<Mode | null>(init.mode)
  const [visit, setVisit] = useState(0)

  useEffect(() => {
    document.documentElement.classList.toggle('big', init.big)
  }, [init.big])
  useEffect(() => {
    window.scrollTo(0, 0)
  }, [mode])

  const open = (m: Mode | null) => {
    setVisit((v) => v + 1)
    setMode(m)
  }
  const home = () => open(null)
  // URLの id・step は、最初に開いた画面にだけ使う
  const fresh = visit === 0

  if (mode === 'steps') return <StepsMode key={visit} initialStep={fresh ? init.step : null} onHome={home} onMode={open} />
  if (mode === 'predict') return <PredictMode key={visit} initialId={fresh ? init.id : null} onHome={home} />
  if (mode === 'drag') return <DragMode key={visit} onHome={home} />
  if (mode === 'draw') {
    return (
      <div className="min-h-dvh">
        <Header title="グラフ → 運動（つくる）" onHome={home} />
        <main className="mx-auto max-w-6xl p-2">
          <DrawLab key={visit} title="グラフ→運動" prompts />
        </main>
      </div>
    )
  }
  return <Home onMode={open} />
}
