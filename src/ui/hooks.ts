import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { RANGES, type Kind } from '../core/constants'
import { completeFree, emptyFree, flat, freeCoverage, polyCoverage, polyCurve, smoothFree, stroke, type Curve, type Free, type Node } from '../core/curve'
import type { Edit } from './GraphView'

/** 再生の時計。t は 0〜dur */
export function usePlayer(dur: number) {
  const [t, setTState] = useState(0)
  const [playing, setPlaying] = useState(false)
  const [speed, setSpeed] = useState(1)
  const tRef = useRef(0)
  const setT = useCallback((v: number) => {
    tRef.current = v
    setTState(v)
  }, [])

  useEffect(() => {
    if (!playing) return
    let raf = 0
    let last = performance.now()
    const tick = (now: number) => {
      // タブを離れていた間のぶんは進めない
      const d = Math.min(0.1, (now - last) / 1000) * speed
      last = now
      const n = tRef.current + d
      if (n >= dur) {
        setT(dur)
        setPlaying(false)
        return
      }
      setT(n)
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [playing, speed, dur, setT])

  const play = useCallback(() => {
    if (tRef.current >= dur - 1e-9) setT(0)
    setPlaying(true)
  }, [dur, setT])
  const pause = useCallback(() => setPlaying(false), [])
  const reset = useCallback(() => {
    setPlaying(false)
    setT(0)
  }, [setT])
  const scrub = useCallback(
    (v: number) => {
      setPlaying(false)
      setT(Math.min(dur, Math.max(0, v)))
    },
    [dur, setT],
  )
  return { t, playing, speed, setSpeed, play, pause, reset, scrub, setT, setPlaying }
}

export type Player = ReturnType<typeof usePlayer>
export type Tool = 'poly' | 'free'

/**
 * 1枚のグラフに描く線（折れ線またはフリーハンド）。
 * curve は、未記入を補った曲線。drawn は「何か描いたか」。
 */
export function useSketch(opts: { tool: Tool; firstY?: number; lockFirst?: boolean }) {
  const first = opts.firstY ?? 0
  const [tool, setTool] = useState<Tool>(opts.tool)
  const [nodes, setNodes] = useState<Node[]>([{ t: 0, y: first }])
  const [free, setFree] = useState<Free>(emptyFree)
  const range = useRef<[number, number] | null>(null)
  const freeRef = useRef(free)
  freeRef.current = free

  const reset = useCallback(() => {
    setNodes([{ t: 0, y: first }])
    setFree(emptyFree())
  }, [first])

  const done = useMemo(() => (tool === 'free' ? completeFree(free) : null), [tool, free])
  const curve: Curve = useMemo(() => (tool === 'poly' ? polyCurve(nodes) : (done?.curve ?? flat(first))), [tool, nodes, done, first])
  const drawn = tool === 'poly' ? nodes.length > 1 || nodes[0].y !== first : done !== null
  const coverage = (dur: number) => (tool === 'poly' ? polyCoverage(nodes, dur) : freeCoverage(free, dur))

  const edit: Edit =
    tool === 'poly'
      ? { tool: 'poly', nodes, onNodes: setNodes, lockFirst: opts.lockFirst }
      : {
          tool: 'free',
          onStroke: (t0, y0, t1, y1) => {
            const next = freeRef.current.slice()
            // はじめの位置が決まっているときは、t = 0 の値を変えない
            const [i0, i1] = stroke(next, t0, y0, t1, y1)
            if (opts.lockFirst) next[0] = first
            range.current = range.current ? [Math.min(range.current[0], i0), Math.max(range.current[1], i1)] : [i0, i1]
            freeRef.current = next
            setFree(next)
          },
          onEnd: () => {
            const r = range.current
            range.current = null
            if (!r) return
            const next = smoothFree(freeRef.current, r[0], r[1])
            if (opts.lockFirst) next[0] = first
            freeRef.current = next
            setFree(next)
          },
        }

  return { tool, setTool, nodes, setNodes, free, curve, filled: tool === 'free' ? (done?.filled ?? undefined) : undefined, drawn, coverage, reset, edit }
}

export type Sketch = ReturnType<typeof useSketch>

/** 値が収まる、いちばん小さい表示範囲 */
export const pickLim = (kind: Kind, need: number) => RANGES[kind].find((r) => need <= r + 1e-9) ?? RANGES[kind][RANGES[kind].length - 1]

/** 画面が広い（Chromebook・投影）か */
export function useWide(): boolean {
  const query = '(min-width: 1024px)'
  const [wide, setWide] = useState(() => typeof matchMedia === 'function' && matchMedia(query).matches)
  useEffect(() => {
    const m = matchMedia(query)
    const on = () => setWide(m.matches)
    m.addEventListener('change', on)
    return () => m.removeEventListener('change', on)
  }, [])
  return wide
}
