// 曲線の表現と、グラフどうしの変換
import { DT, N, SIGMA, T_MAX, indexOf, timeOf } from './constants'

/**
 * 0〜10 s を 0.05 s 刻みで標本化した曲線。
 * 値が一瞬で変わる点（段差）は、その標本に「変わったあとの値」を入れ、
 * jumps に「変わる直前の値」を持たせる。
 */
export type Curve = { y: number[]; jumps: Record<number, number> }

/** 折れ線の節点 */
export type Node = { t: number; y: number }

const EPS = 1e-9

export const flat = (value: number): Curve => ({ y: Array.from({ length: N }, () => value), jumps: {} })

/** 標本 i での「直前の値」（段差がなければその値） */
export const leftValue = (c: Curve, i: number) => c.jumps[i] ?? c.y[i]

/** 時刻順に並べる（同じ時刻の節点は、置いた順を保つ） */
export function sortNodes(nodes: Node[]): Node[] {
  return nodes.map((n, i) => ({ n, i })).sort((a, b) => a.n.t - b.n.t || a.i - b.i).map((o) => o.n)
}

/** 時刻 t を含む区間の左側の節点（同じ時刻に2つあれば後ろの方） */
function segmentAt(nodes: Node[], t: number): number {
  let k = 0
  for (let j = 0; j < nodes.length; j++) if (nodes[j].t <= t + EPS) k = j
  return k
}

/**
 * 折れ線を標本化する。最後の節点より後ろは、最後の値を保つ。
 * 同じ時刻に節点が2つあると、そこで値が一瞬で変わる（段差）。
 */
export function polyCurve(nodes: Node[]): Curve {
  const y: number[] = []
  const jumps: Record<number, number> = {}
  for (let i = 0; i < N; i++) {
    const t = timeOf(i)
    const k = segmentAt(nodes, t)
    const a = nodes[k]
    const b = nodes[k + 1]
    y.push(b ? a.y + ((b.y - a.y) * (t - a.t)) / (b.t - a.t) : a.y)
  }
  for (let k = 1; k < nodes.length; k++) {
    if (Math.abs(nodes[k].t - nodes[k - 1].t) < EPS && nodes[k].y !== nodes[k - 1].y) jumps[indexOf(nodes[k].t)] = nodes[k - 1].y
  }
  return { y, jumps }
}

/** 折れ線の傾き（区間ごとに一定＝階段状）。最後の節点より後ろは 0 */
export function polySlope(nodes: Node[]): Curve {
  // 同じ時刻の節点（段差）は、傾きを決める区間から外す
  const segs: { t0: number; t1: number; s: number }[] = []
  for (let k = 0; k + 1 < nodes.length; k++) {
    const a = nodes[k]
    const b = nodes[k + 1]
    if (b.t - a.t > EPS) segs.push({ t0: a.t, t1: b.t, s: (b.y - a.y) / (b.t - a.t) })
  }
  const last = nodes[nodes.length - 1].t
  if (last < T_MAX - EPS) segs.push({ t0: last, t1: T_MAX, s: 0 })
  const y: number[] = []
  const jumps: Record<number, number> = {}
  for (let i = 0; i < N; i++) {
    const t = timeOf(i)
    // 右側の区間の値を入れる（最後の標本だけは、終わる区間の値）
    const seg = segs.find((s) => t >= s.t0 - EPS && t < s.t1 - EPS) ?? segs[segs.length - 1]
    y.push(seg ? seg.s : 0)
  }
  for (let k = 1; k < segs.length; k++) {
    if (Math.abs(segs[k].s - segs[k - 1].s) > EPS) jumps[indexOf(segs[k].t0)] = segs[k - 1].s
  }
  return { y, jumps }
}

/** v から x を求める（台形公式）。折れ線なら誤差なし */
export function integrate(v: Curve, x0: number): Curve {
  const y = [x0]
  for (let i = 1; i < N; i++) y.push(y[i - 1] + ((v.y[i - 1] + leftValue(v, i)) / 2) * DT)
  return { y, jumps: {} }
}

/** ガウス平滑化（位相のずれなし）。from〜to の標本だけを、その範囲の中の値でならす */
export function gauss(y: number[], sigma: number, from = 0, to = y.length - 1): number[] {
  const out = y.slice()
  if (!(sigma > 0) || to <= from) return out
  const s = sigma / DT
  const half = Math.ceil(3 * s)
  const w: number[] = []
  for (let k = -half; k <= half; k++) w.push(Math.exp(-(k * k) / (2 * s * s)))
  for (let i = from; i <= to; i++) {
    let sum = 0
    let wsum = 0
    for (let k = -half; k <= half; k++) {
      const j = i + k
      if (j < from || j > to) continue
      sum += y[j] * w[k + half]
      wsum += w[k + half]
    }
    out[i] = sum / wsum
  }
  return out
}

/** 中心差分（両端は片側差分） */
export function diff(y: number[]): number[] {
  const n = y.length
  return y.map((_, i) => (i === 0 ? (y[1] - y[0]) / DT : i === n - 1 ? (y[n - 1] - y[n - 2]) / DT : (y[i + 1] - y[i - 1]) / (2 * DT)))
}

/** なめらかな曲線（フリーハンド・記録）の傾き：平滑化してから中心差分 */
export const smoothSlope = (y: number[], sigma: number): Curve => ({ y: diff(gauss(y, sigma)), jumps: {} })

// ---- フリーハンド ----

/** 描いていない標本は null */
export type Free = (number | null)[]

export const emptyFree = (): Free => Array.from({ length: N }, () => null)

/**
 * 指の動き (t0,y0)→(t1,y1) の間にある標本を、線形補間で埋める。
 * 左へ戻って描いたときも、その時刻の値を上書きするだけなので、常に t の1価関数になる。
 * 書き込んだ標本の範囲 [最小, 最大] を返す。
 */
export function stroke(free: Free, t0: number, y0: number, t1: number, y1: number): [number, number] {
  const clampT = (t: number) => Math.min(T_MAX, Math.max(0, t))
  const a = clampT(Math.min(t0, t1))
  const b = clampT(Math.max(t0, t1))
  const ya = t0 <= t1 ? y0 : y1
  const yb = t0 <= t1 ? y1 : y0
  let i0 = Math.ceil(a / DT - EPS)
  let i1 = Math.floor(b / DT + EPS)
  if (i1 < i0) {
    // 標本をまたがない小さな動き：いちばん近い標本が未記入なら、そこに書く
    const i = indexOf((a + b) / 2)
    if (free[i] === null) free[i] = (ya + yb) / 2
    return [i, i]
  }
  i0 = Math.max(0, i0)
  i1 = Math.min(N - 1, i1)
  for (let i = i0; i <= i1; i++) {
    const t = timeOf(i)
    free[i] = b - a < EPS ? yb : ya + ((yb - ya) * (t - a)) / (b - a)
  }
  return [i0, i1]
}

/** 指を離したとき、描いた範囲をならす */
export function smoothFree(free: Free, i0: number, i1: number): Free {
  // 範囲の中に未記入があれば、その手前・その先で分けてならす
  const out = free.slice()
  let s = -1
  for (let i = i0; i <= i1 + 1; i++) {
    const has = i <= i1 && free[i] !== null
    if (has && s < 0) s = i
    if (!has && s >= 0) {
      const part = gauss(free.map((v) => v ?? 0), SIGMA.free, s, i - 1)
      for (let j = s; j < i; j++) out[j] = part[j]
      s = -1
    }
  }
  return out
}

/**
 * 未記入の区間を補って曲線にする。中間の空白は両隣を直線でつなぎ、前後の空白は端の値を水平にのばす。
 * filled は補った標本（点線で表示する）。何も描いていなければ null。
 */
export function completeFree(free: Free): { curve: Curve; filled: boolean[] } | null {
  const idx = free.map((v, i) => (v === null ? -1 : i)).filter((i) => i >= 0)
  if (!idx.length) return null
  const y: number[] = []
  const filled: boolean[] = []
  let p = 0
  for (let i = 0; i < N; i++) {
    const v = free[i]
    if (v !== null) {
      y.push(v)
      filled.push(false)
      continue
    }
    filled.push(true)
    while (p < idx.length && idx[p] < i) p++
    const right = p < idx.length ? idx[p] : -1
    const left = p > 0 ? idx[p - 1] : -1
    if (left < 0) y.push(free[right] as number)
    else if (right < 0) y.push(free[left] as number)
    else y.push((free[left] as number) + (((free[right] as number) - (free[left] as number)) * (i - left)) / (right - left))
  }
  return { curve: { y, jumps: {} }, filled }
}

/** 0〜dur のうち、描いた標本の割合 */
export function freeCoverage(free: Free, dur: number): number {
  const n = indexOf(dur)
  let c = 0
  for (let i = 0; i <= n; i++) if (free[i] !== null) c++
  return c / (n + 1)
}

/** 折れ線で描いた範囲の割合（最後の節点の時刻 ÷ 運動の長さ） */
export const polyCoverage = (nodes: Node[], dur: number) => Math.min(1, nodes[nodes.length - 1].t / dur)

/** 時刻 t での値（標本の間は線形補間）。段差の直前では「直前の値」に向かう */
export function valueAt(c: Curve, t: number): number {
  const u = Math.min(T_MAX, Math.max(0, t)) / DT
  const i = Math.min(N - 2, Math.floor(u + EPS))
  const f = Math.min(1, Math.max(0, u - i))
  if (f < EPS) return c.y[i]
  return c.y[i] + (leftValue(c, i + 1) - c.y[i]) * f
}

/** 縦軸の範囲に収まるように値を切りつめる */
export const clampCurve = (c: Curve, lim: number): Curve => ({
  y: c.y.map((v) => Math.min(lim, Math.max(-lim, v))),
  jumps: Object.fromEntries(Object.entries(c.jumps).map(([k, v]) => [k, Math.min(lim, Math.max(-lim, v))])),
})

/** 絶対値の最大（段差の直前の値も含める） */
export function maxAbs(c: Curve, to = N - 1): number {
  let m = 0
  for (let i = 0; i <= to; i++) m = Math.max(m, Math.abs(c.y[i]), Math.abs(leftValue(c, i)))
  return m
}
