// コース（台車が動く水平な直線）
import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { ML, MR } from './GraphView'

const FONT = '"BIZ UDPGothic", "Hiragino Sans", "Noto Sans JP", sans-serif'

type Props = {
  /** 台車の位置〔m〕 */
  x: number
  /** 速度〔m/s〕。矢印を出すときだけ渡す */
  v?: number | null
  /** 表示範囲（±）〔m〕 */
  lim: number
  /** 台車を指で動かせるとき。動かした量〔m〕を受け取る */
  onDrag?: (dx: number) => void
  onGrab?: (holding: boolean) => void
  /** 台車の上に出す文字（カウントダウンなど） */
  badge?: string | null
}

export const TRACK_H = 84

export function Track({ x, v = null, lim, onDrag, onGrab, badge }: Props) {
  const wrap = useRef<HTMLDivElement>(null)
  const canvas = useRef<HTMLCanvasElement>(null)
  const [w, setW] = useState(0)
  const last = useRef<number | null>(null)

  useEffect(() => {
    const el = wrap.current
    if (!el) return
    const ro = new ResizeObserver(() => setW(Math.round(el.clientWidth)))
    ro.observe(el)
    setW(Math.round(el.clientWidth))
    return () => ro.disconnect()
  }, [])

  const h = TRACK_H
  // 左右の余白はグラフとそろえる
  const scale = (w - ML - MR) / (2 * lim)
  const px = (m: number) => ML + (m + lim) * scale

  useLayoutEffect(() => {
    const cv = canvas.current
    if (!cv || w <= 0) return
    const dpr = Math.min(3, window.devicePixelRatio || 1)
    if (cv.width !== Math.round(w * dpr) || cv.height !== Math.round(h * dpr)) {
      cv.width = Math.round(w * dpr)
      cv.height = Math.round(h * dpr)
    }
    const g = cv.getContext('2d')
    if (!g) return
    g.setTransform(dpr, 0, 0, dpr, 0, 0)
    g.fillStyle = '#fff'
    g.fillRect(0, 0, w, h)
    const base = 56
    g.strokeStyle = '#334155'
    g.lineWidth = 2
    g.beginPath()
    g.moveTo(px(-lim) - 6, base)
    g.lineTo(px(lim) + 6, base)
    g.stroke()
    const tick = lim <= 5 ? 1 : lim <= 10 ? 2 : 5
    g.font = `11px ${FONT}`
    g.textAlign = 'center'
    g.textBaseline = 'top'
    for (let m = -lim; m <= lim + 1e-9; m += tick) {
      g.strokeStyle = '#334155'
      g.lineWidth = m === 0 ? 2 : 1
      g.beginPath()
      g.moveTo(px(m), base)
      g.lineTo(px(m), base + (m === 0 ? 9 : 6))
      g.stroke()
      g.fillStyle = m === 0 ? '#111827' : '#475569'
      g.fillText(m === 0 ? 'O' : String(m).replace('-', '−'), px(m), base + 11)
    }
    g.textAlign = 'right'
    g.fillStyle = '#64748b'
    g.fillText('x〔m〕', px(lim), 4)
    g.textAlign = 'left'
    g.fillText('正の向き →', px(-lim), 4)

    // 台車
    const cx = px(Math.min(lim, Math.max(-lim, x)))
    const bw = 38
    const bh = 18
    g.fillStyle = onDrag ? '#0072b2' : '#475569'
    g.beginPath()
    g.roundRect(cx - bw / 2, base - 8 - bh, bw, bh, 4)
    g.fill()
    g.fillStyle = '#111827'
    for (const dx of [-11, 11]) {
      g.beginPath()
      g.arc(cx + dx, base - 5, 5, 0, Math.PI * 2)
      g.fill()
    }
    // 位置の印（台車のまん中）
    g.strokeStyle = '#111827'
    g.lineWidth = 1.5
    g.beginPath()
    g.moveTo(cx, base - 8)
    g.lineTo(cx, base + 2)
    g.stroke()

    // 速度の矢印（朱）
    if (v !== null && Math.abs(v) > 0.02) {
      // 矢印は枠の中に収める（長さは速さに比例。収まらないときは縮める）
      const room = v > 0 ? w - 4 - cx - 7 : cx - 4 - 7
      const len = Math.sign(v) * Math.max(Math.min(10, room), Math.min(Math.abs(v) * scale * 0.9, w * 0.45, room))
      const y = base - 8 - bh - 9
      g.strokeStyle = '#d55e00'
      g.fillStyle = '#d55e00'
      g.lineWidth = 3
      g.beginPath()
      g.moveTo(cx, y)
      g.lineTo(cx + len, y)
      g.stroke()
      g.beginPath()
      g.moveTo(cx + len + Math.sign(len) * 7, y)
      g.lineTo(cx + len, y - 6)
      g.lineTo(cx + len, y + 6)
      g.closePath()
      g.fill()
    }
    if (badge) {
      g.font = `bold 22px ${FONT}`
      g.textAlign = 'center'
      g.textBaseline = 'middle'
      g.fillStyle = '#d55e00'
      g.fillText(badge, cx, base - 8 - bh - 14)
    } else if (onDrag) {
      g.font = `bold 11px ${FONT}`
      g.textAlign = 'center'
      g.textBaseline = 'middle'
      g.fillStyle = '#fff'
      g.fillText('⇔', cx, base - 8 - bh / 2)
    }
  })

  const down = (e: React.PointerEvent) => {
    if (!onDrag) return
    e.preventDefault()
    e.currentTarget.setPointerCapture(e.pointerId)
    last.current = e.clientX
    onGrab?.(true)
  }
  const move = (e: React.PointerEvent) => {
    if (!onDrag || last.current === null) return
    const native = e.nativeEvent
    const list = typeof native.getCoalescedEvents === 'function' ? native.getCoalescedEvents() : []
    for (const ev of list.length ? list : [native]) {
      onDrag((ev.clientX - last.current) / scale)
      last.current = ev.clientX
    }
  }
  const up = () => {
    if (last.current === null) return
    last.current = null
    onGrab?.(false)
  }

  return (
    <div ref={wrap} className="w-full" data-track={onDrag ? 'drag' : 'view'}>
      <canvas
        ref={canvas}
        role="img"
        aria-label="コース（台車が動く直線）"
        style={{ width: '100%', height: h }}
        className={onDrag ? 'draw-surface cursor-grab' : ''}
        onPointerDown={down}
        onPointerMove={move}
        onPointerUp={up}
        onPointerCancel={up}
      />
    </div>
  )
}
