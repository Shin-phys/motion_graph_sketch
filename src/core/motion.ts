// 収録問題の運動を、定義（区間ごとに速度または加速度が一定）から解析的に計算する
import { N, indexOf, timeOf } from './constants'
import type { Curve } from './curve'

/** v：その区間の一定速度（区間の頭で切り替わる）／a：一定加速度（速度は前の区間から連続） */
export type Segment = { dur: number; v?: number; a?: number }

export type Source = 'anim' | 'xt' | 'vt' | 'at'
export type Ask = 'xt' | 'vt' | 'at'
/** 「見せるもの>描かせるもの」 */
export type Task = `${Source}>${Ask}`

export type Problem = {
  id: string
  level: 1 | 2 | 3 | 4
  title: string
  x0: number
  v0?: number
  segments: Segment[]
  tasks: Task[]
}

export type Motion = { dur: number; x: Curve; v: Curve; a: Curve }

const EPS = 1e-9

export function buildMotion(p: Problem): Motion {
  // 区間ごとの「はじめの時刻・位置・速度・加速度」
  const parts: { t0: number; t1: number; x: number; v: number; a: number }[] = []
  let t = 0
  let x = p.x0
  let v = p.v0 ?? 0
  for (const s of p.segments) {
    const v0 = s.v !== undefined ? s.v : v
    const a = s.v !== undefined ? 0 : (s.a ?? 0)
    parts.push({ t0: t, t1: t + s.dur, x, v: v0, a })
    x += v0 * s.dur + 0.5 * a * s.dur * s.dur
    v = v0 + a * s.dur
    t += s.dur
  }
  const dur = t
  const at = (part: (typeof parts)[number], time: number) => {
    const d = time - part.t0
    return { x: part.x + part.v * d + 0.5 * part.a * d * d, v: part.v + part.a * d, a: part.a }
  }
  const X: number[] = []
  const V: number[] = []
  const A: number[] = []
  const end = at(parts[parts.length - 1], dur)
  for (let i = 0; i < N; i++) {
    const time = timeOf(i)
    if (time >= dur - EPS) {
      // 終わりの標本は最後の区間の値。運動が終わったあとは、その値を保つ（表示はしない）
      X.push(end.x)
      V.push(end.v)
      A.push(end.a)
      continue
    }
    const part = parts.find((q) => time >= q.t0 - EPS && time < q.t1 - EPS) ?? parts[parts.length - 1]
    const s = at(part, time)
    X.push(s.x)
    V.push(s.v)
    A.push(s.a)
  }
  // 区間の境目での段差（直前の値）
  const vj: Record<number, number> = {}
  const aj: Record<number, number> = {}
  for (let k = 1; k < parts.length; k++) {
    const before = at(parts[k - 1], parts[k].t0)
    const i = indexOf(parts[k].t0)
    if (Math.abs(before.v - parts[k].v) > EPS) vj[i] = before.v
    if (Math.abs(before.a - parts[k].a) > EPS) aj[i] = before.a
  }
  return { dur, x: { y: X, jumps: {} }, v: { y: V, jumps: vj }, a: { y: A, jumps: aj } }
}

export const curveOf = (m: Motion, g: Ask | Source): Curve | null => (g === 'xt' ? m.x : g === 'vt' ? m.v : g === 'at' ? m.a : null)

export const splitTask = (task: Task): { show: Source; ask: Ask } => {
  const [show, ask] = task.split('>') as [Source, Ask]
  return { show, ask }
}

/** x-t が曲線になる（加速度が0でない区間がある）か。フリーハンドを既定にする判断に使う */
export const hasCurve = (p: Problem) => p.segments.some((s) => s.a !== undefined && s.a !== 0)
