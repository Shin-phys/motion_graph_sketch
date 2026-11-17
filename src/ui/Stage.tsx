// コースと3つのグラフ、操作バーを並べる
import { useRef, type ReactNode } from 'react'
import type { Kind } from '../core/constants'
import { GraphView, type GraphProps } from './GraphView'
import { Track } from './Track'
import { Btn, Segmented, fmt } from './common'
import { useWide, type Player } from './hooks'

export type Panel = Omit<GraphProps, 'kind' | 'height'>

type Props = {
  track: { x: number; v?: number | null; lim: number; onDrag?: (dx: number) => void; onGrab?: (h: boolean) => void; badge?: string | null }
  panels: Record<Kind, Panel>
  /** 大きく表示するグラフ */
  main: Kind
  onMain?: (k: Kind) => void
  /** 操作バー（グラフの下） */
  bar?: ReactNode
  /** 保存する画像の題 */
  title: string
}

const NAMES: Record<Kind, string> = { x: 'x-t', v: 'v-t', a: 'a-t' }

/** 画面の Canvas を1枚の画像にまとめて保存する */
function saveImage(root: HTMLElement, title: string) {
  const box = root.getBoundingClientRect()
  const scale = 2
  const pad = 12
  const head = 30
  const out = document.createElement('canvas')
  out.width = Math.round((box.width + pad * 2) * scale)
  out.height = Math.round((box.height + pad * 2 + head) * scale)
  const g = out.getContext('2d')
  if (!g) return
  g.scale(scale, scale)
  g.fillStyle = '#fff'
  g.fillRect(0, 0, box.width + pad * 2, box.height + pad * 2 + head)
  g.fillStyle = '#111827'
  g.font = 'bold 15px "BIZ UDPGothic", "Hiragino Sans", sans-serif'
  g.textBaseline = 'middle'
  g.fillText(title, pad, pad + head / 2 - 4)
  root.querySelectorAll('canvas').forEach((cv) => {
    const r = cv.getBoundingClientRect()
    g.drawImage(cv, pad + r.left - box.left, pad + head + r.top - box.top, r.width, r.height)
  })
  out.toBlob((blob) => {
    if (!blob) return
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${title.replace(/[\\/:*?"<>|\s]+/g, '_') || 'motion_graph'}.png`
    document.body.appendChild(a)
    a.click()
    a.remove()
    setTimeout(() => URL.revokeObjectURL(url), 1000)
  }, 'image/png')
}

export function Stage({ track, panels, main, onMain, bar, title }: Props) {
  const wide = useWide()
  const root = useRef<HTMLDivElement>(null)
  const others = (['x', 'v', 'a'] as Kind[]).filter((k) => k !== main)
  const frame = (k: Kind, height: number, small: boolean) => (
    <div key={k} className="relative overflow-hidden rounded-xl border border-slate-200 bg-white">
      <GraphView kind={k} height={height} {...panels[k]} />
      {small && onMain && !panels[k].hidden && (
        <button onClick={() => onMain(k)} aria-label={`${NAMES[k]} を大きく表示`} className="absolute top-2.5 left-[104px] min-h-8 rounded-md border border-slate-300 bg-white/90 px-2 text-xs font-bold text-slate-600">
          大きく
        </button>
      )}
    </div>
  )
  return (
    <div className="flex flex-col gap-2">
      <div ref={root} className="grid grid-cols-1 gap-2 lg:grid-cols-2">
        <div className="flex min-w-0 flex-col gap-2">
          <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
            <Track {...track} />
          </div>
          {frame(main, wide ? 330 : 230, false)}
        </div>
        <div className="flex min-w-0 flex-col gap-2">{others.map((k) => frame(k, wide ? 207 : 124, true))}</div>
      </div>
      {bar}
      <div className="flex justify-end">
        <Btn onClick={() => root.current && saveImage(root.current, title)}>画像で保存</Btn>
      </div>
    </div>
  )
}

/** 再生・時刻の操作バー */
export function Transport({ player, dur, canPlay = true, onClear, extra }: { player: Player; dur: number; canPlay?: boolean; onClear?: () => void; extra?: ReactNode }) {
  return (
    <div className="flex flex-wrap items-center gap-2 rounded-xl border border-slate-200 bg-white p-2">
      {canPlay && (
        <>
          <Btn kind="primary" onClick={() => (player.playing ? player.pause() : player.play())}>{player.playing ? '⏸ 一時停止' : '▶ 再生'}</Btn>
          <Btn onClick={player.reset} label="最初に戻す">⏮</Btn>
          <Segmented label="再生の速さ" value={player.speed === 1 ? 'x1' : 'x05'} options={[['x05', '×0.5'], ['x1', '×1']]} onChange={(v) => player.setSpeed(v === 'x1' ? 1 : 0.5)} />
        </>
      )}
      <label className="flex min-w-40 flex-1 items-center gap-2 text-sm text-slate-700">
        <input type="range" min={0} max={dur} step={0.05} value={Math.min(player.t, dur)} onChange={(e) => player.scrub(Number(e.target.value))} aria-label="時刻" className="h-11 min-w-0 flex-1 accent-[#111827]" />
        <span className="w-20 text-right tabular-nums">t = {fmt(player.t)} s</span>
      </label>
      {extra}
      {onClear && <Btn onClick={onClear}>やり直し</Btn>}
    </div>
  )
}
