// ストロボの足あと：一定の時間ごとの台車の位置
import type { Curve } from './curve'
import { valueAt } from './curve'

/** lane 0：右へ進んでいる（または止まっている）とき、lane 1：左へ戻っているとき */
export type Mark = { t: number; x: number; lane: 0 | 1 }

/** 止まっている間の点をまとめたもの（t0〜t1 は同じ位置） */
export type MarkGroup = { t0: number; t1: number; x: number; lane: 0 | 1 }

const EPS = 1e-6

/**
 * 0 から upTo までの、step 秒ごとの位置。
 * 段は「その点から次の点への向き」で決める（最後の点は前の点からの向き）。動かない区間は、直前の段を引き継ぐ。
 */
export function strobeMarks(x: Curve, upTo: number, step = 1): Mark[] {
  const n = Math.floor(upTo / step + EPS)
  const xs: number[] = []
  for (let k = 0; k <= n; k++) xs.push(valueAt(x, k * step))
  const out: Mark[] = []
  let lane: 0 | 1 = 0
  // はじめに動き出す向き（まだ動いていなければ右）
  for (let k = 1; k < xs.length; k++) {
    if (Math.abs(xs[k] - xs[0]) > EPS) {
      lane = xs[k] < xs[0] ? 1 : 0
      break
    }
  }
  for (let k = 0; k <= n; k++) {
    const d = k < n ? xs[k + 1] - xs[k] : k > 0 ? xs[k] - xs[k - 1] : 0
    if (Math.abs(d) > EPS) lane = d < 0 ? 1 : 0
    out.push({ t: k * step, x: xs[k], lane })
  }
  return out
}

/** 同じ段で、続けて同じ位置にある点を1つにまとめる */
export function groupMarks(marks: Mark[], tol = 0.02): MarkGroup[] {
  const out: MarkGroup[] = []
  for (const m of marks) {
    const last = out[out.length - 1]
    if (last && last.lane === m.lane && Math.abs(last.x - m.x) <= tol) last.t1 = m.t
    else out.push({ t0: m.t, t1: m.t, x: m.x, lane: m.lane })
  }
  return out
}
