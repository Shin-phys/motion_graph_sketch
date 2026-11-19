// グラフ1枚（Canvas）。曲線の表示・時間カーソル・接線・面積と、折れ線／フリーハンドの入力を受け持つ
import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { COLOR, DT, N, SNAP, SNAP_T, T_MAX, UNIT, type Kind } from '../core/constants'
import { leftValue, valueAt, type Curve, type Node } from '../core/curve'
import { fmt, signed } from './common'

export type Layer = {
  curve: Curve
  color: string
  width?: number
  dash?: number[]
  alpha?: number
  /** 描く時刻の範囲（省略すると 0〜運動の長さ） */
  from?: number
  to?: number
  /** 補った標本（点線にする） */
  filled?: boolean[]
  /** 時間カーソルの位置に点を打ち、値を読み上げる */
  main?: boolean
}

export type Edit =
  | { tool: 'poly'; nodes: Node[]; onNodes: (n: Node[]) => void; lockFirst?: boolean; /** 最後の節点を t = 10 s に固定する（縦にだけ動き、消せない） */ lockLast?: boolean }
  | { tool: 'free'; onStroke: (t0: number, y0: number, t1: number, y1: number) => void; onEnd: () => void }

export type GraphProps = {
  kind: Kind
  /** 縦軸の範囲（±） */
  lim: number
  height: number
  layers: Layer[]
  cursor: number | null
  /** 運動の長さ。これより後ろは網かけ */
  dur: number
  /** グラフを見せないとき、代わりに出す文 */
  hidden?: string | null
  /** ずれが大きい区間（赤い帯） */
  band?: [number, number] | null
  /** x-t の接線 */
  tangent?: { t: number; y: number; slope: number } | null
  /** v-t の面積（0〜to を符号つきで塗る） */
  area?: { curve: Curve; to: number } | null
  /** はじめの位置の印 */
  dot?: { t: number; y: number } | null
  edit?: Edit | null
  onScrub?: (t: number) => void
  /** 右上に出す凡例 */
  legend?: { text: string; color: string; dash?: boolean }[]
}

const FONT = '"BIZ UDPGothic", "Hiragino Sans", "Noto Sans JP", sans-serif'
export const ML = 40
export const MR = 12
const MT = 10
const MB = 20
const MAX_NODES = 24
const NAME: Record<Kind, string> = { x: 'x', v: 'v', a: 'a' }

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v))
const snap = (v: number, step: number) => Math.round(v / step) * step

function gridStep(lim: number): { line: number; label: number } {
  if (lim <= 2) return { line: 0.5, label: 1 }
  if (lim <= 5) return { line: 1, label: lim === 5 ? 5 : 2 }
  if (lim <= 10) return { line: 2, label: 10 }
  return { line: 5, label: 20 }
}

export function GraphView(p: GraphProps) {
  const wrap = useRef<HTMLDivElement>(null)
  const canvas = useRef<HTMLCanvasElement>(null)
  const cache = useRef<{ key: string; el: HTMLCanvasElement } | null>(null)
  const [w, setW] = useState(0)
  const [readout, setReadout] = useState<Node | null>(null)
  const drag = useRef<{ mode: 'node'; k: number; moved: boolean; timer: number } | { mode: 'free'; t: number; y: number } | { mode: 'scrub' } | null>(null)
  const latest = useRef(p)
  latest.current = p

  useEffect(() => {
    const el = wrap.current
    if (!el) return
    const ro = new ResizeObserver(() => setW(Math.round(el.clientWidth)))
    ro.observe(el)
    setW(Math.round(el.clientWidth))
    return () => ro.disconnect()
  }, [])

  const h = p.height
  const px = (t: number) => ML + (t / T_MAX) * (w - ML - MR)
  const py = (y: number) => MT + ((p.lim - clamp(y, -p.lim, p.lim)) / (2 * p.lim)) * (h - MT - MB)
  const fromPx = (cx: number, cy: number) => ({
    t: clamp(((cx - ML) / Math.max(1, w - ML - MR)) * T_MAX, 0, T_MAX),
    y: clamp(p.lim - ((cy - MT) / Math.max(1, h - MT - MB)) * 2 * p.lim, -p.lim, p.lim),
  })

  useLayoutEffect(() => {
    const cv = canvas.current
    if (!cv || w <= 0) return
    const dpr = Math.min(3, window.devicePixelRatio || 1)
    if (cv.width !== Math.round(w * dpr) || cv.height !== Math.round(h * dpr)) {
      cv.width = Math.round(w * dpr)
      cv.height = Math.round(h * dpr)
    }
    const ctx = cv.getContext('2d')
    if (!ctx) return

    // ---- 動かない層（方眼・軸）は別のCanvasに描いておく ----
    const key = `${w}x${h}x${dpr}:${p.kind}:${p.lim}:${p.dur}`
    if (!cache.current || cache.current.key !== key) {
      const el = cache.current?.el ?? document.createElement('canvas')
      el.width = cv.width
      el.height = cv.height
      const g = el.getContext('2d')!
      g.setTransform(dpr, 0, 0, dpr, 0, 0)
      g.fillStyle = '#fff'
      g.fillRect(0, 0, w, h)
      const { line, label } = gridStep(p.lim)
      g.font = `11px ${FONT}`
      g.textBaseline = 'middle'
      for (let t = 0; t <= T_MAX; t++) {
        g.strokeStyle = t % 5 === 0 ? '#cbd5e1' : '#e8edf2'
        g.lineWidth = 1
        g.beginPath()
        g.moveTo(px(t) + 0.5, MT)
        g.lineTo(px(t) + 0.5, h - MB)
        g.stroke()
        if (t % 2 === 0) {
          g.fillStyle = '#475569'
          g.textAlign = 'center'
          g.fillText(String(t), px(t), h - MB + 10)
        }
      }
      for (let k = -Math.round(p.lim / line); k <= Math.round(p.lim / line); k++) {
        const y = k * line
        g.strokeStyle = y === 0 ? '#64748b' : Math.abs(y % label) < 1e-9 ? '#cbd5e1' : '#e8edf2'
        g.lineWidth = y === 0 ? 1.5 : 1
        g.beginPath()
        g.moveTo(ML, py(y) + 0.5)
        g.lineTo(w - MR, py(y) + 0.5)
        g.stroke()
        if (Math.abs(y % label) < 1e-9 || Math.abs(y) === p.lim) {
          g.fillStyle = '#475569'
          g.textAlign = 'right'
          g.fillText(String(y).replace('-', '−'), ML - 5, py(y))
        }
      }
      if (p.dur < T_MAX) {
        g.fillStyle = 'rgba(100,116,139,0.16)'
        g.fillRect(px(p.dur), MT, px(T_MAX) - px(p.dur), h - MT - MB)
      }
      g.strokeStyle = '#334155'
      g.lineWidth = 1
      g.strokeRect(ML + 0.5, MT + 0.5, w - ML - MR - 1, h - MT - MB - 1)
      g.fillStyle = COLOR[p.kind]
      g.font = `bold 13px ${FONT}`
      g.textAlign = 'left'
      g.fillText(`${NAME[p.kind]}〔${UNIT[p.kind]}〕`, ML + 6, MT + 11)
      g.fillStyle = '#64748b'
      g.font = `11px ${FONT}`
      g.textAlign = 'right'
      g.fillText('t〔s〕', w - MR - 4, h - MB - 8)
      cache.current = { key, el }
    }
    ctx.setTransform(1, 0, 0, 1, 0, 0)
    ctx.drawImage(cache.current.el, 0, 0)
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    ctx.font = `12px ${FONT}`

    if (p.hidden) {
      ctx.fillStyle = 'rgba(241,245,249,0.92)'
      ctx.fillRect(ML + 1, MT + 1, w - ML - MR - 2, h - MT - MB - 2)
      ctx.fillStyle = '#64748b'
      ctx.font = `bold 13px ${FONT}`
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.fillText(p.hidden, (ML + w - MR) / 2, (MT + h - MB) / 2)
      return
    }

    ctx.save()
    ctx.beginPath()
    ctx.rect(ML, MT, w - ML - MR, h - MT - MB)
    ctx.clip()

    if (p.band) {
      ctx.fillStyle = 'rgba(220,38,38,0.16)'
      ctx.fillRect(px(p.band[0]), MT, px(p.band[1]) - px(p.band[0]), h - MT - MB)
    }

    // ---- 面積（符号つき） ----
    if (p.area && p.area.to > 0) {
      const c = p.area.curve
      const n = Math.min(N - 1, Math.floor(p.area.to / DT + 1e-9))
      for (const sign of [1, -1]) {
        ctx.fillStyle = sign > 0 ? 'rgba(213,94,0,0.28)' : 'rgba(0,114,178,0.28)'
        ctx.beginPath()
        ctx.moveTo(px(0), py(0))
        const part = (v: number) => (sign > 0 ? Math.max(0, v) : Math.min(0, v))
        for (let i = 0; i <= n; i++) {
          if (i > 0 && c.jumps[i] !== undefined) ctx.lineTo(px(i * DT), py(part(c.jumps[i])))
          ctx.lineTo(px(i * DT), py(part(c.y[i])))
        }
        ctx.lineTo(px(p.area.to), py(part(valueAt(c, p.area.to))))
        ctx.lineTo(px(p.area.to), py(0))
        ctx.closePath()
        ctx.fill()
      }
    }

    // ---- 曲線 ----
    for (const L of p.layers) {
      const from = L.from ?? 0
      const to = Math.min(L.to ?? p.dur, T_MAX)
      if (to < from) continue
      const i0 = Math.ceil(from / DT - 1e-9)
      const i1 = Math.floor(to / DT + 1e-9)
      ctx.globalAlpha = L.alpha ?? 1
      ctx.strokeStyle = L.color
      ctx.lineWidth = L.width ?? 3
      ctx.lineJoin = 'round'
      ctx.lineCap = 'round'
      const c = L.curve
      // 補った部分（点線）と、描いた部分（実線または指定の破線）を分けて描く
      for (const pass of ['drawn', 'filled'] as const) {
        ctx.setLineDash(pass === 'filled' ? [2, 5] : (L.dash ?? []))
        ctx.beginPath()
        let pen = false
        for (let i = i0 + 1; i <= i1; i++) {
          const isFilled = !!L.filled && (L.filled[i - 1] || L.filled[i])
          if ((pass === 'filled') !== isFilled) {
            pen = false
            continue
          }
          if (!pen) ctx.moveTo(px((i - 1) * DT), py(c.y[i - 1]))
          ctx.lineTo(px(i * DT), py(leftValue(c, i)))
          // 段差のあとは、変わったあとの値から描き直す
          pen = c.jumps[i] === undefined
        }
        if (pass === 'drawn' && to > i1 * DT + 1e-9 && i1 >= i0 && !(L.filled && L.filled[i1])) {
          if (!pen) ctx.moveTo(px(i1 * DT), py(c.y[i1]))
          ctx.lineTo(px(to), py(valueAt(c, to)))
        }
        ctx.stroke()
      }
      // 段差は縦の破線でつなぐ
      ctx.setLineDash([3, 4])
      ctx.lineWidth = 1.5
      ctx.beginPath()
      for (let i = Math.max(1, i0); i <= i1; i++) {
        if (c.jumps[i] === undefined) continue
        ctx.moveTo(px(i * DT), py(c.jumps[i]))
        ctx.lineTo(px(i * DT), py(c.y[i]))
      }
      ctx.stroke()
      ctx.setLineDash([])
      ctx.globalAlpha = 1
    }

    // ---- 接線 ----
    if (p.tangent) {
      const { t, y, slope } = p.tangent
      ctx.strokeStyle = '#111827'
      ctx.lineWidth = 2
      ctx.beginPath()
      ctx.moveTo(px(t - 1.5), py(y - 1.5 * slope))
      ctx.lineTo(px(t + 1.5), py(y + 1.5 * slope))
      // 範囲の外へ出るときは、切りつめずに外まで引く
      ctx.stroke()
    }

    if (p.dot) {
      ctx.fillStyle = COLOR[p.kind]
      ctx.strokeStyle = '#fff'
      ctx.lineWidth = 2
      ctx.beginPath()
      ctx.arc(px(p.dot.t), py(p.dot.y), 6, 0, Math.PI * 2)
      ctx.fill()
      ctx.stroke()
    }
    ctx.restore()

    // ---- 時間カーソル ----
    const main = p.layers.find((L) => L.main)
    if (p.cursor !== null) {
      const cx = px(p.cursor)
      ctx.strokeStyle = '#111827'
      ctx.lineWidth = 1.5
      ctx.beginPath()
      ctx.moveTo(cx, MT)
      ctx.lineTo(cx, h - MB)
      ctx.stroke()
      if (main && p.cursor <= (main.to ?? p.dur) + 1e-9) {
        const v = valueAt(main.curve, p.cursor)
        ctx.fillStyle = main.color
        ctx.strokeStyle = '#fff'
        ctx.lineWidth = 2
        ctx.beginPath()
        ctx.arc(cx, py(v), 5, 0, Math.PI * 2)
        ctx.fill()
        ctx.stroke()
      }
    }

    // ---- 読み取りの文字（右上） ----
    const notes: { text: string; color: string }[] = []
    if (p.cursor !== null && main && p.cursor <= (main.to ?? p.dur) + 1e-9) {
      notes.push({ text: `t = ${fmt(p.cursor)} s　${NAME[p.kind]} = ${fmt(valueAt(main.curve, p.cursor), 2)} ${UNIT[p.kind]}`, color: '#111827' })
    }
    if (p.tangent) notes.push({ text: `接線の傾き = ${fmt(p.tangent.slope, 2)} m/s`, color: '#111827' })
    if (p.area) {
      let s = 0
      const c = p.area.curve
      const n = Math.min(N - 1, Math.floor(p.area.to / DT + 1e-9))
      for (let i = 1; i <= n; i++) s += ((c.y[i - 1] + leftValue(c, i)) / 2) * DT
      s += ((c.y[n] + valueAt(c, p.area.to)) / 2) * (p.area.to - n * DT)
      notes.push({ text: `面積 = ${signed(s, 2)} m（変位）`, color: '#111827' })
    }
    ctx.font = `bold 12px ${FONT}`
    ctx.textAlign = 'right'
    ctx.textBaseline = 'middle'
    notes.forEach((n, k) => {
      const tw = ctx.measureText(n.text).width
      ctx.fillStyle = 'rgba(255,255,255,0.88)'
      ctx.fillRect(w - MR - tw - 10, MT + 3 + k * 17, tw + 8, 16)
      ctx.fillStyle = n.color
      ctx.fillText(n.text, w - MR - 6, MT + 11 + k * 17)
    })

    // ---- 凡例（左下） ----
    if (p.legend?.length) {
      let lx = ML + 8
      const ly = h - MB - 10
      ctx.font = `11px ${FONT}`
      ctx.textAlign = 'left'
      for (const it of p.legend) {
        ctx.strokeStyle = it.color
        ctx.lineWidth = 2.5
        ctx.setLineDash(it.dash ? [5, 4] : [])
        ctx.beginPath()
        ctx.moveTo(lx, ly)
        ctx.lineTo(lx + 20, ly)
        ctx.stroke()
        ctx.setLineDash([])
        ctx.fillStyle = '#334155'
        ctx.fillText(it.text, lx + 24, ly)
        lx += 34 + ctx.measureText(it.text).width
      }
    }

    // ---- 折れ線の節点 ----
    if (p.edit?.tool === 'poly') {
      p.edit.nodes.forEach((n, k) => {
        ctx.fillStyle = k === 0 && p.edit?.tool === 'poly' && p.edit.lockFirst ? '#94a3b8' : '#fff'
        ctx.strokeStyle = COLOR[p.kind]
        ctx.lineWidth = 2.5
        ctx.beginPath()
        ctx.arc(px(n.t), py(n.y), 7, 0, Math.PI * 2)
        ctx.fill()
        ctx.stroke()
      })
      if (readout) {
        const text = `t = ${fmt(readout.t)} s　${NAME[p.kind]} = ${fmt(readout.y, 2)} ${UNIT[p.kind]}`
        ctx.font = `bold 13px ${FONT}`
        const tw = ctx.measureText(text).width
        const bx = clamp(px(readout.t) - tw / 2 - 6, ML + 2, w - MR - tw - 14)
        const by = py(readout.y) > MT + 50 ? py(readout.y) - 44 : py(readout.y) + 26
        ctx.fillStyle = '#111827'
        ctx.fillRect(bx, by, tw + 12, 20)
        ctx.fillStyle = '#fff'
        ctx.textAlign = 'left'
        ctx.textBaseline = 'middle'
        ctx.fillText(text, bx + 6, by + 10)
      }
    }
  })

  // ---- 入力 ----
  const local = (e: React.PointerEvent) => {
    const r = canvas.current!.getBoundingClientRect()
    return { cx: e.clientX - r.left, cy: e.clientY - r.top }
  }
  const stepY = SNAP[p.kind]

  /** 節点 k を (t, y) へ動かす（となりを追い越さない・同じ時刻は2つまで） */
  const moveNode = (nodes: Node[], k: number, t: number, y: number, lockFirst: boolean, lockLast = false): Node[] => {
    const out = nodes.map((n) => ({ ...n }))
    let nt = snap(t, SNAP_T)
    let ny = clamp(snap(y, stepY), -p.lim, p.lim)
    if (k === 0) {
      nt = 0
      if (lockFirst) ny = nodes[0].y
    } else if (lockLast && k === nodes.length - 1) {
      nt = T_MAX
    } else {
      const prev = out[k - 1]
      const next = out[k + 1]
      // t = 0 と、すでに2つ並んでいる時刻には重ねない
      let lo = Math.max(SNAP_T, prev.t)
      if (k >= 2 && out[k - 2].t === prev.t) lo = prev.t + SNAP_T
      let hi = next ? next.t : T_MAX
      if (next && out[k + 2] && out[k + 2].t === next.t) hi = next.t - SNAP_T
      if (lockLast) hi = Math.min(hi, T_MAX - SNAP_T)
      if (lo > hi) return nodes
      nt = clamp(nt, lo, hi)
    }
    out[k] = { t: nt, y: ny }
    return out
  }

  const onDown = (e: React.PointerEvent) => {
    if (p.hidden) return
    const { cx, cy } = local(e)
    const ed = p.edit
    if (!ed) {
      if (!p.onScrub) return
      e.currentTarget.setPointerCapture(e.pointerId)
      drag.current = { mode: 'scrub' }
      p.onScrub(clamp(fromPx(cx, cy).t, 0, p.dur))
      return
    }
    e.preventDefault()
    e.currentTarget.setPointerCapture(e.pointerId)
    const pos = fromPx(cx, cy)
    if (ed.tool === 'free') {
      drag.current = { mode: 'free', t: pos.t, y: pos.y }
      ed.onStroke(pos.t, pos.y, pos.t, pos.y)
      return
    }
    // 近くの節点があれば、それを動かす
    let k = -1
    let best = 24
    ed.nodes.forEach((n, i) => {
      const d = Math.hypot(px(n.t) - cx, py(n.y) - cy)
      if (d < best) {
        best = d
        k = i
      }
    })
    let nodes = ed.nodes
    let created = false
    const isLocked = (i: number, list: Node[]) => !!(ed.lockLast && i === list.length - 1)
    if (k < 0) {
      const t = ed.lockLast ? Math.min(snap(pos.t, SNAP_T), T_MAX - SNAP_T) : snap(pos.t, SNAP_T)
      const same = nodes.map((n, i) => (n.t === t ? i : -1)).filter((i) => i >= 0)
      if (t === 0) k = 0
      else if (same.length >= 2 || nodes.length >= MAX_NODES) {
        // これ以上増やせないときは、いちばん近い節点を動かす
        const pool = same.length >= 2 ? same : nodes.map((_, i) => i)
        k = pool.reduce((b, i) => (Math.hypot(px(nodes[i].t) - cx, py(nodes[i].y) - cy) < Math.hypot(px(nodes[b].t) - cx, py(nodes[b].y) - cy) ? i : b), pool[0])
      } else {
        let at = 0
        nodes.forEach((n, i) => {
          if (n.t <= t) at = i
        })
        k = at + 1
        nodes = [...nodes.slice(0, k), { t, y: clamp(snap(pos.y, stepY), -p.lim, p.lim) }, ...nodes.slice(k)]
        created = true
      }
    }
    if (!created) nodes = moveNode(nodes, k, k === 0 ? 0 : nodes[k].t, pos.y, !!ed.lockFirst, !!ed.lockLast)
    ed.onNodes(nodes)
    setReadout(nodes[k])
    const timer =
      !created && k > 0 && !isLocked(k, nodes)
        ? window.setTimeout(() => {
            const d = drag.current
            const cur = latest.current.edit
            if (d && d.mode === 'node' && !d.moved && cur?.tool === 'poly') {
              cur.onNodes(cur.nodes.filter((_, i) => i !== d.k))
              drag.current = null
              setReadout(null)
            }
          }, 600)
        : 0
    drag.current = { mode: 'node', k, moved: created, timer }
  }

  const onMove = (e: React.PointerEvent) => {
    const d = drag.current
    if (!d) return
    const ed = p.edit
    if (d.mode === 'scrub') {
      const { cx, cy } = local(e)
      p.onScrub?.(clamp(fromPx(cx, cy).t, 0, p.dur))
      return
    }
    if (d.mode === 'free' && ed?.tool === 'free') {
      const native = e.nativeEvent
      const list = typeof native.getCoalescedEvents === 'function' ? native.getCoalescedEvents() : []
      const r = canvas.current!.getBoundingClientRect()
      for (const ev of list.length ? list : [native]) {
        const pos = fromPx(ev.clientX - r.left, ev.clientY - r.top)
        ed.onStroke(d.t, d.y, pos.t, pos.y)
        d.t = pos.t
        d.y = pos.y
      }
      return
    }
    if (d.mode === 'node' && ed?.tool === 'poly') {
      const { cx, cy } = local(e)
      const pos = fromPx(cx, cy)
      const next = moveNode(ed.nodes, d.k, pos.t, pos.y, !!ed.lockFirst, !!ed.lockLast)
      if (next[d.k].t !== ed.nodes[d.k].t || next[d.k].y !== ed.nodes[d.k].y) {
        d.moved = true
        window.clearTimeout(d.timer)
        ed.onNodes(next)
        setReadout(next[d.k])
      }
    }
  }

  const onUp = () => {
    const d = drag.current
    if (!d) return
    if (d.mode === 'node') window.clearTimeout(d.timer)
    if (d.mode === 'free' && p.edit?.tool === 'free') p.edit.onEnd()
    drag.current = null
    setReadout(null)
  }

  /** パソコンでは、節点のダブルクリック・右クリックでも消せる */
  const removeAt = (e: React.MouseEvent) => {
    const ed = p.edit
    if (ed?.tool !== 'poly') return
    e.preventDefault()
    const r = canvas.current!.getBoundingClientRect()
    const cx = e.clientX - r.left
    const cy = e.clientY - r.top
    const k = ed.nodes.findIndex((n, i) => i > 0 && !(ed.lockLast && i === ed.nodes.length - 1) && Math.hypot(px(n.t) - cx, py(n.y) - cy) < 16)
    if (k > 0) ed.onNodes(ed.nodes.filter((_, i) => i !== k))
  }

  const label = `${NAME[p.kind]}-tグラフ`
  return (
    <div ref={wrap} className="w-full" data-graph={p.kind} data-editing={p.edit ? p.edit.tool : undefined}>
      <canvas
        ref={canvas}
        role="img"
        aria-label={p.hidden ? `${label}（${p.hidden}）` : label}
        style={{ width: '100%', height: h }}
        className={p.edit ? 'draw-surface cursor-crosshair' : p.onScrub ? 'scrub-surface cursor-ew-resize' : ''}
        onPointerDown={onDown}
        onPointerMove={onMove}
        onPointerUp={onUp}
        onPointerCancel={onUp}
        onDoubleClick={removeAt}
        onContextMenu={removeAt}
      />
    </div>
  )
}
