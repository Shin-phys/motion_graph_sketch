// 収録問題。グラフの座標は持たせず、運動の定義だけを書く（x・v・a は core/motion.ts が計算する）
import type { Problem, Task } from '../core/motion'

const LOW: Task[] = ['anim>xt', 'xt>vt', 'vt>xt']
const HIGH: Task[] = ['anim>vt', 'vt>at', 'vt>xt', 'xt>vt']

export const PROBLEMS: Problem[] = [
  { id: 'p01', level: 1, title: '等速で進む', x0: -4, segments: [{ dur: 10, v: 0.5 }], tasks: LOW },
  { id: 'p02', level: 1, title: '遅い→速い→止まる', x0: -4, segments: [{ dur: 4, v: 0.5 }, { dur: 4, v: 1.5 }, { dur: 2, v: 0 }], tasks: LOW },
  { id: 'p03', level: 1, title: '進んで止まる', x0: -3, segments: [{ dur: 4, v: 1.5 }, { dur: 6, v: 0 }], tasks: LOW },
  { id: 'p04', level: 1, title: '逆向きに進む', x0: 4, segments: [{ dur: 8, v: -1 }, { dur: 2, v: 0 }], tasks: LOW },
  { id: 'p05', level: 2, title: '行って戻る', x0: 0, segments: [{ dur: 4, v: 1 }, { dur: 3, v: -2 }, { dur: 3, v: 0 }], tasks: LOW },
  { id: 'p06', level: 2, title: '止まってから戻る', x0: -2, segments: [{ dur: 4, v: 1.5 }, { dur: 2, v: 0 }, { dur: 4, v: -1 }], tasks: LOW },
  { id: 'p07', level: 2, title: '原点をまたいで戻る', x0: 3, segments: [{ dur: 4, v: -1.5 }, { dur: 6, v: 0.5 }], tasks: LOW },
  { id: 'p08', level: 2, title: '3段階の速さ', x0: -4, segments: [{ dur: 2, v: 2 }, { dur: 4, v: 0.5 }, { dur: 4, v: -1.5 }], tasks: LOW },
  { id: 'p09', level: 3, title: '静止から加速', x0: -4, v0: 0, segments: [{ dur: 8, a: 0.25 }], tasks: HIGH },
  { id: 'p10', level: 3, title: '加速→等速→減速', x0: -4, v0: 0, segments: [{ dur: 2, a: 0.5 }, { dur: 4, a: 0 }, { dur: 2, a: -0.5 }, { dur: 2, a: 0 }], tasks: HIGH },
  { id: 'p11', level: 3, title: '減速して止まる', x0: -4, v0: 2, segments: [{ dur: 8, a: -0.25 }, { dur: 2, a: 0 }], tasks: HIGH },
  { id: 'p12', level: 3, title: '負の向きに加速', x0: 4, v0: 0, segments: [{ dur: 8, a: -0.25 }], tasks: HIGH },
  { id: 'p13', level: 4, title: '進んでから戻ってくる', x0: -4, v0: 2, segments: [{ dur: 8, a: -0.5 }], tasks: HIGH },
  { id: 'p14', level: 4, title: '負の向きに進みながら減速', x0: 4, v0: -2, segments: [{ dur: 8, a: 0.25 }, { dur: 2, a: 0 }], tasks: HIGH },
  { id: 'p15', level: 4, title: '負の向きから折り返す', x0: 4, v0: -2, segments: [{ dur: 8, a: 0.5 }], tasks: HIGH },
  { id: 'p16', level: 4, title: '総合', x0: -4, v0: 0, segments: [{ dur: 2, a: 1 }, { dur: 2, a: 0 }, { dur: 4, a: -1 }, { dur: 2, a: 0 }], tasks: HIGH },
]

/** 表にある「終わりの x」（テストで照合する） */
export const END_X: Record<string, number> = {
  p01: 1, p02: 4, p03: 3, p04: -4, p05: -2, p06: 0, p07: 0, p08: -4,
  p09: 4, p10: 2, p11: 4, p12: -4, p13: -4, p14: -4, p15: 4, p16: -2,
}

export const problemById = (id: string | null | undefined) => PROBLEMS.find((p) => p.id === id) ?? null

/** 「つくる」モードのお題（収録問題を文章に直したもの） */
export const PROMPTS: { id: string; text: string }[] = [
  { id: 'p02', text: '0.5 m/s で4秒進み、次に 1.5 m/s で4秒進んで、止まる運動' },
  { id: 'p05', text: '1 m/s で4秒進み、2 m/s で3秒戻って、止まる運動' },
  { id: 'p06', text: '1.5 m/s で4秒進み、2秒止まってから、1 m/s で4秒戻る運動' },
  { id: 'p08', text: '2 m/s で2秒、0.5 m/s で4秒進んだあと、1.5 m/s で4秒戻る運動' },
  { id: 'p10', text: '静止から2秒かけて 1 m/s まで加速し、4秒そのまま進み、2秒かけて止まる運動' },
  { id: 'p13', text: '2 m/s で動き出し、一定の割合で減速して4秒後に折り返し、8秒後に出発点へ戻る運動' },
]
