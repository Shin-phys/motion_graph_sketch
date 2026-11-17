import type { ReactNode } from 'react'

export function Header({ title, onHome, right }: { title: string; onHome: () => void; right?: ReactNode }) {
  return (
    <header className="z-10 flex items-center gap-2 border-b border-slate-200 bg-white px-2 py-1 lg:sticky lg:top-0">
      <button onClick={onHome} className="min-h-11 rounded-lg px-2 text-sm text-slate-600 hover:bg-slate-100">
        ← もどる
      </button>
      <h1 className="flex-1 text-center text-base font-bold text-slate-800">{title}</h1>
      <div className="min-w-16 text-right">{right}</div>
    </header>
  )
}

export function Btn({ onClick, children, kind = 'ghost', disabled, label }: { onClick: () => void; children: ReactNode; kind?: 'primary' | 'ghost'; disabled?: boolean; label?: string }) {
  const cls = kind === 'primary' ? 'bg-pos text-white border-pos' : 'bg-white text-slate-700 border-slate-300'
  return (
    <button onClick={onClick} disabled={disabled} aria-label={label} className={`min-h-11 rounded-lg border px-3 text-sm font-bold active:translate-y-px disabled:opacity-40 ${cls}`}>
      {children}
    </button>
  )
}

/** 押すたびに切り替わるボタン */
export function Toggle({ on, onClick, children, disabled }: { on: boolean; onClick: () => void; children: ReactNode; disabled?: boolean }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      aria-pressed={on}
      className={`min-h-11 rounded-lg border px-3 text-sm font-bold disabled:opacity-40 ${on ? 'border-pos bg-pos text-white' : 'border-slate-300 bg-white text-slate-700'}`}
    >
      {children}
    </button>
  )
}

/** いくつかの中から1つをえらぶボタンの並び */
export function Segmented<T extends string>({ value, options, onChange, label }: { value: T; options: [T, string][]; onChange: (v: T) => void; label: string }) {
  return (
    <div className="inline-flex overflow-hidden rounded-lg border border-slate-300" role="group" aria-label={label}>
      {options.map(([v, text]) => (
        <button key={v} onClick={() => onChange(v)} aria-pressed={value === v} className={`min-h-11 px-3 text-sm font-bold ${value === v ? 'bg-pos text-white' : 'bg-white text-slate-700'}`}>
          {text}
        </button>
      ))}
    </div>
  )
}

export function Card({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <section className={`rounded-2xl border border-slate-200 bg-white p-3 shadow-sm ${className}`}>{children}</section>
}

export const fmt = (v: number, digits = 1) => {
  const s = v.toFixed(digits)
  return (Number(s) === 0 ? (0).toFixed(digits) : s).replace('-', '−')
}
export const signed = (v: number, digits = 1) => (Number(v.toFixed(digits)) > 0 ? `+${fmt(v, digits)}` : fmt(v, digits))
