// 進度の保存（localStorage が使えなくても動く）
const KEY = 'motion_graph_sketch.v1'

export type Progress = {
  /** ステップ学習：終えたステップの番号 */
  steps: number[]
  /** 予想チャレンジ：「問題id|タスク」ごとの最高点 */
  predict: Record<string, number>
  /** グラフ合わせ：「問題id|x か v」ごとの最高点 */
  match: Record<string, number>
}

const empty = (): Progress => ({ steps: [], predict: {}, match: {} })

export function loadProgress(): Progress {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return empty()
    const p = JSON.parse(raw) as Partial<Progress>
    return {
      steps: Array.isArray(p.steps) ? p.steps.filter((n) => Number.isInteger(n)) : [],
      predict: p.predict && typeof p.predict === 'object' ? p.predict : {},
      match: p.match && typeof p.match === 'object' ? p.match : {},
    }
  } catch {
    return empty()
  }
}

export function saveProgress(p: Progress) {
  try {
    localStorage.setItem(KEY, JSON.stringify(p))
  } catch {
    // 保存できなくても続行する
  }
}

/** 最高点を更新して保存する */
export function recordBest(kind: 'predict' | 'match', key: string, value: number): Progress {
  const p = loadProgress()
  if (!(p[kind][key] >= value)) p[kind][key] = value
  saveProgress(p)
  return p
}

export function markStep(n: number): Progress {
  const p = loadProgress()
  if (!p.steps.includes(n)) p.steps.push(n)
  saveProgress(p)
  return p
}
