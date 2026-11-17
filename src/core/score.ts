// 採点と、ずれが大きい区間さがし
import { DT, JUMP_MARGIN, PASS, SCORE_COEF, SCORE_FLOOR, indexOf, timeOf, type Kind } from './constants'
import { leftValue, type Curve } from './curve'

/** 運動の長さの範囲で使う値。終わりの標本は「直前の値」で比べる（終わりで線を落としても減点しない） */
export function samples(c: Curve, dur: number): number[] {
  const n = indexOf(dur)
  const out = c.y.slice(0, n + 1)
  out[n] = leftValue(c, n)
  return out
}

/** お手本の最大値と最小値の差（段差の直前の値も含める）。下限つき */
export function rangeOf(target: Curve, kind: Kind, dur: number): number {
  const n = indexOf(dur)
  let lo = Infinity
  let hi = -Infinity
  for (let i = 0; i <= n; i++) {
    for (const v of [i < n ? target.y[i] : leftValue(target, i), leftValue(target, i)]) {
      lo = Math.min(lo, v)
      hi = Math.max(hi, v)
    }
  }
  return Math.max(SCORE_FLOOR[kind], hi - lo)
}

export function rmse(a: number[], b: number[]): number {
  let s = 0
  for (let i = 0; i < a.length; i++) s += (a[i] - b[i]) ** 2
  return Math.sqrt(s / a.length)
}

/** 採点に使う標本（お手本の段差の前後 JUMP_MARGIN 秒は外す） */
export function scored(target: Curve, dur: number): boolean[] {
  const n = indexOf(dur)
  const use = Array.from({ length: n + 1 }, () => true)
  const m = Math.round(JUMP_MARGIN / DT)
  for (const k of Object.keys(target.jumps)) {
    const j = Number(k)
    if (j >= n) continue
    for (let i = Math.max(0, j - m); i <= Math.min(n, j + m); i++) use[i] = false
  }
  return use
}

/** 二乗誤差（採点から外す標本は 0） */
function squares(student: Curve, target: Curve, dur: number): { sq: number[]; count: number } {
  const a = samples(student, dur)
  const b = samples(target, dur)
  const use = scored(target, dur)
  return { sq: a.map((v, i) => (use[i] ? (v - b[i]) ** 2 : 0)), count: use.filter(Boolean).length }
}

/** 0〜100 点（整数） */
export function score(student: Curve, target: Curve, kind: Kind, dur: number): number {
  const { sq, count } = squares(student, target, dur)
  const e = Math.sqrt(sq.reduce((s, v) => s + v, 0) / count)
  return Math.round(100 * Math.max(0, 1 - e / (SCORE_COEF * rangeOf(target, kind, dur))))
}

export const passed = (s: number) => s >= PASS

/**
 * ずれが最も大きい区間（幅 width 秒の窓で、二乗誤差の平均が最大のところ）。
 * 全体としてほぼ合っている（その窓のRMSEが R の5%未満）ときは null。
 */
export function worstInterval(student: Curve, target: Curve, kind: Kind, dur: number, width = 1): [number, number] | null {
  const w = Math.max(1, Math.round(width / DT))
  const { sq } = squares(student, target, dur)
  let best = -1
  let at = 0
  let sum = 0
  for (let i = 0; i < sq.length; i++) {
    sum += sq[i]
    if (i >= w) sum -= sq[i - w]
    if (i >= w - 1 && sum > best) {
      best = sum
      at = i - w + 1
    }
  }
  if (best < 0) return null
  if (Math.sqrt(best / w) < 0.05 * rangeOf(target, kind, dur)) return null
  return [timeOf(at), timeOf(Math.min(sq.length - 1, at + w))]
}
