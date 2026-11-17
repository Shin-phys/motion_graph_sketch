// 調整用の定数。実機で使ってみて変えたくなる値は、ここにまとめる

/** 標本の刻み〔s〕・時間軸の長さ〔s〕・標本の数 */
export const DT = 0.05
export const T_MAX = 10
export const N = 201

export type Kind = 'x' | 'v' | 'a'

/** 折れ線の節点が吸着する刻み */
export const SNAP_T = 0.5
export const SNAP: Record<Kind, number> = { x: 0.5, v: 0.5, a: 0.25 }

/** 採点：得点 = 100 × max(0, 1 − RMSE / (COEF × R))。R の下限と合格点 */
export const SCORE_COEF = 0.4
export const SCORE_FLOOR: Record<Kind, number> = { x: 2, v: 1, a: 0.5 }
export const PASS = 70
/** お手本の値が一瞬で変わる点（段差）の前後、この秒数は採点から外す（段差を斜めの線で描いても大きく減点しないため） */
export const JUMP_MARGIN = 0.25

/** 「答え合わせ」を押せるようになる、描いた範囲の割合 */
export const COVERAGE = 0.9

/** ガウス平滑化の標準偏差〔s〕 */
export const SIGMA = {
  /** フリーハンドで描いた直後 */
  free: 0.15,
  /** フリーハンドの x から v、v から a、x から a（v をさらに平滑化） */
  vFromX: 0.2,
  aFromV: 0.25,
  aFromX: 0.3,
  /** ドラッグ記録のあとの計算し直し */
  recX: 0.1,
  recV: 0.15,
  recA: 0.3,
}

/** ドラッグ記録中の表示：x の指数移動平均の時定数、v の差分をとる幅と時定数〔s〕 */
export const LIVE = { xTau: 0.08, vWindow: 0.1, vTau: 0.15 }

/** 誤答パターン：相関係数の下限、正解との差の下限、「ほぼ一定」とみなす標準偏差（R に対する割合） */
export const PATTERN = { r: 0.85, margin: 0.15, flat: 0.05 }

/** 縦軸の表示範囲（±）。小さい順に、収まるものを使う */
export const RANGES: Record<Kind, number[]> = { x: [5, 10, 20], v: [2, 4], a: [2] }

export const UNIT: Record<Kind, string> = { x: 'm', v: 'm/s', a: 'm/s²' }
export const COLOR: Record<Kind, string> = { x: '#0072b2', v: '#d55e00', a: '#009e73' }

export const timeOf = (i: number) => i * DT
export const indexOf = (t: number) => Math.min(N - 1, Math.max(0, Math.round(t / DT)))
