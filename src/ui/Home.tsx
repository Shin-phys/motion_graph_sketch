import { loadProgress } from '../core/storage'
import { STEPS } from '../data/steps'

export type Mode = 'steps' | 'draw' | 'drag' | 'predict'

export function Home({ onMode }: { onMode: (m: Mode) => void }) {
  const done = loadProgress().steps.length
  const card = (mode: Mode, title: string, desc: string, action: string, primary = false) => (
    <div className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex-1">
        <p className="font-bold text-slate-900">{title}</p>
        <p className="mt-1 text-sm leading-relaxed text-slate-600">{desc}</p>
      </div>
      <button onClick={() => onMode(mode)} className={`min-h-14 shrink-0 rounded-xl px-5 font-bold shadow-sm active:translate-y-px ${primary ? 'bg-pos text-white' : 'border-2 border-pos bg-white text-pos'}`}>
        {action}
      </button>
    </div>
  )
  return (
    <div className="mx-auto flex max-w-xl flex-col gap-6 px-4 py-6">
      <header className="text-center">
        <h1 className="text-2xl font-bold text-slate-900">描いてわかる運動グラフ</h1>
        <p className="mt-1 text-sm leading-relaxed text-slate-600">
          グラフを描くと台車が動く。台車を動かすとグラフになる。
          <br />
          <b className="text-pos">x-t</b>・<b className="text-vel">v-t</b>・<b className="text-acc">a-t</b> のつながりを、手を動かしてつかもう
        </p>
      </header>
      <section className="flex flex-col gap-3">
        {card('steps', 'ステップ学習', `8つのステップで、グラフの読み方を順に身につける（約25分）${done > 0 ? `　${Math.min(done, STEPS.length)} / ${STEPS.length} 済み` : ''}`, done > 0 && done < STEPS.length ? 'つづきから' : 'はじめる', true)}
        {card('draw', 'グラフ → 運動（つくる）', 'x-t または v-t グラフを描いて、台車の動きと残りのグラフを確かめる。お題つき', 'つくる')}
        {card('drag', '運動 → グラフ（動かす）', '台車を指で動かして、その運動をグラフにする。お手本に合わせる「グラフ合わせ」で点数を競う', '動かす')}
        {card('predict', '予想チャレンジ', '運動やグラフを見て、別のグラフを予想して描いてから答え合わせ（16問）', '挑戦する')}
      </section>
      <footer className="text-center text-xs leading-relaxed text-slate-500">
        <p>右向きが正。位置 x〔m〕、速度 v〔m/s〕、加速度 a〔m/s²〕。</p>
        <p className="mt-1">進み具合は、この端末の中だけに保存されます。外部には何も送りません。</p>
      </footer>
    </div>
  )
}
