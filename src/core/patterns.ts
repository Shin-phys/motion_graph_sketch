// 誤答パターンの判定：生徒の曲線が、よくある誤答の型に近いかを調べる
import { PATTERN, type Kind } from './constants'
import type { Curve } from './curve'
import { curveOf, splitTask, type Motion, type Task } from './motion'
import { rangeOf, rmse, samples } from './score'

export type PatternId = 'same' | 'abs' | 'neg' | 'shift'

export const HINTS: Record<PatternId, string> = {
  same: '元のグラフの形をそのまま描いていませんか。見るのは高さではなく傾きです。',
  abs: '負の向きに進むとき、速度は負になります。',
  neg: '向きが逆です。右向きが正です。',
  shift: 'グラフの種類を確かめましょう。縦軸は何ですか。',
}

const mean = (v: number[]) => v.reduce((a, b) => a + b, 0) / v.length
function sdOf(v: number[]): number {
  const m = mean(v)
  return Math.sqrt(mean(v.map((x) => (x - m) ** 2)))
}
/** 相関係数。どちらかがほぼ一定なら null */
export function corr(a: number[], b: number[]): number | null {
  const ma = mean(a)
  const mb = mean(b)
  let sab = 0
  let saa = 0
  let sbb = 0
  for (let i = 0; i < a.length; i++) {
    sab += (a[i] - ma) * (b[i] - mb)
    saa += (a[i] - ma) ** 2
    sbb += (b[i] - mb) ** 2
  }
  if (saa < 1e-12 || sbb < 1e-12) return null
  return sab / Math.sqrt(saa * sbb)
}

const KIND: Record<'xt' | 'vt' | 'at', Kind> = { xt: 'x', vt: 'v', at: 'a' }

/**
 * 型との相関係数が 0.85 以上で、正解との相関より 0.15 以上大きい型を返す。
 * 複数あれば、生徒の曲線とのRMSEが最小の型（同じなら 表の上の型）。
 */
export function detectPattern(student: Curve, task: Task, m: Motion): PatternId | null {
  const { show, ask } = splitTask(task)
  const answer = samples(curveOf(m, ask)!, m.dur)
  const s = samples(student, m.dur)
  const R = rangeOf(curveOf(m, ask)!, KIND[ask], m.dur)
  const cands: [PatternId, number[] | null][] = [
    ['same', show === 'anim' ? null : samples(curveOf(m, show)!, m.dur)],
    ['abs', answer.map(Math.abs)],
    ['neg', answer.map((v) => -v)],
    ['shift', ask === 'vt' ? samples(m.a, m.dur) : ask === 'at' ? samples(m.v, m.dur) : null],
  ]
  const rAns = corr(s, answer) ?? 0
  let best: { id: PatternId; e: number } | null = null
  for (const [id, c] of cands) {
    if (!c) continue
    // ほぼ一定の型は、相関が決まらないので外す
    if (sdOf(c) < PATTERN.flat * R) continue
    const r = corr(s, c)
    if (r === null || r < PATTERN.r || r - rAns < PATTERN.margin) continue
    const e = rmse(s, c)
    if (!best || e < best.e - 1e-9) best = { id, e }
  }
  return best ? best.id : null
}
