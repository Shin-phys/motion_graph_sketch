// ドラッグ記録：指で動かした台車の位置を、グラフにする
import { LIVE, N, SIGMA, indexOf, timeOf } from './constants'
import { diff, gauss, type Curve } from './curve'

export type Sample = { t: number; x: number }

/** 記録（時刻は不ぞろい）を 0.05 s 刻みに線形補間で取り直す。dur より後ろは終わりの値を保つ */
export function resample(raw: Sample[], dur: number): number[] {
  const out: number[] = []
  if (!raw.length) return Array.from({ length: N }, () => 0)
  const n = indexOf(dur)
  let k = 0
  for (let i = 0; i < N; i++) {
    const t = Math.min(timeOf(i), timeOf(n))
    while (k + 1 < raw.length && raw[k + 1].t <= t) k++
    const a = raw[k]
    const b = raw[k + 1]
    if (t <= a.t || !b) out.push(a.x)
    else out.push(a.x + ((b.x - a.x) * (t - a.t)) / (b.t - a.t))
  }
  return out
}

/** 記録中の表示用（遅れの小さい処理）：x は指数移動平均、v は直近の差分をならしたもの */
export class LiveFilter {
  private x: number | null = null
  private v = 0
  private t = 0
  private hist: Sample[] = []

  push(t: number, raw: number): { x: number; v: number } {
    if (this.x === null) {
      this.x = raw
      this.t = t
      this.hist = [{ t, x: raw }]
      return { x: raw, v: 0 }
    }
    const dt = Math.max(1e-4, t - this.t)
    this.t = t
    this.x += (raw - this.x) * (1 - Math.exp(-dt / LIVE.xTau))
    this.hist.push({ t, x: this.x })
    while (this.hist.length > 2 && this.hist[1].t <= t - LIVE.vWindow) this.hist.shift()
    const old = this.hist[0]
    const rawV = t - old.t > 1e-4 ? (this.x - old.x) / (t - old.t) : 0
    this.v += (rawV - this.v) * (1 - Math.exp(-dt / LIVE.vTau))
    return { x: this.x, v: this.v }
  }
}

/** 記録が終わったあと、全データを位相ずれのない平滑化で計算し直す */
export function finalize(raw: Sample[], dur: number): { x: Curve; v: Curve; a: Curve } {
  const xr = resample(raw, dur)
  const n = indexOf(dur)
  const x = gauss(xr, SIGMA.recX, 0, n)
  const v = gauss(diff(xr.slice(0, n + 1)).concat(Array.from({ length: N - n - 1 }, () => 0)), SIGMA.recV, 0, n)
  const a = gauss(diff(v.slice(0, n + 1)).concat(Array.from({ length: N - n - 1 }, () => 0)), SIGMA.recA, 0, n)
  return { x: { y: x, jumps: {} }, v: { y: v, jumps: {} }, a: { y: a, jumps: {} } }
}

