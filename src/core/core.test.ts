import { describe, expect, it } from 'vitest'
import { DT, N, PASS, indexOf, timeOf } from './constants'
import { completeFree, diff, emptyFree, freeCoverage, gauss, integrate, polyCoverage, polyCurve, polySlope, smoothFree, smoothSlope, stroke, valueAt, type Curve, type Node } from './curve'
import { buildMotion, curveOf, splitTask, type Problem } from './motion'
import { HINTS, corr, detectPattern } from './patterns'
import { LiveFilter, finalize, resample } from './record'
import { rangeOf, samples, score, worstInterval } from './score'
import { END_X, PROBLEMS, PROMPTS, problemById } from '../data/problems'

const zero: Curve = { y: Array.from({ length: N }, () => 0), jumps: {} }
const KIND = { xt: 'x', vt: 'v', at: 'a' } as const

/** 問題の定義から、正解の折れ線（v-t）の節点をつくる。区間の頭で速度が切り替わるところは、同じ時刻に2点 */
function vNodes(p: Problem): Node[] {
  const nodes: Node[] = []
  let t = 0
  let v = p.v0 ?? 0
  p.segments.forEach((s, k) => {
    const v0 = s.v !== undefined ? s.v : v
    if (k === 0) nodes.push({ t: 0, y: v0 })
    else if (v0 !== v) nodes.push({ t, y: v }, { t, y: v0 })
    v = v0 + (s.v !== undefined ? 0 : (s.a ?? 0)) * s.dur
    t += s.dur
    nodes.push({ t, y: v })
  })
  // 途中の、傾きが変わらない節点も残してある（結果は同じ）
  return nodes.filter((n, i) => i === 0 || !(n.t === nodes[i - 1].t && n.y === nodes[i - 1].y))
}

describe('折れ線', () => {
  it('節点の間を直線でつなぎ、最後の値を10秒までのばす', () => {
    const c = polyCurve([{ t: 0, y: 0 }, { t: 4, y: 2 }, { t: 6, y: -1 }])
    expect(c.y[indexOf(2)]).toBeCloseTo(1, 12)
    expect(c.y[indexOf(5)]).toBeCloseTo(0.5, 12)
    expect(c.y[indexOf(10)]).toBe(-1)
    expect(c.jumps).toEqual({})
  })
  it('同じ時刻に節点が2つあると段差になる', () => {
    const c = polyCurve([{ t: 0, y: 0.5 }, { t: 4, y: 0.5 }, { t: 4, y: 1.5 }, { t: 8, y: 1.5 }])
    expect(c.y[indexOf(4) - 1]).toBe(0.5)
    expect(c.y[indexOf(4)]).toBe(1.5)
    expect(c.jumps[indexOf(4)]).toBe(0.5)
    expect(valueAt(c, 3.99)).toBeCloseTo(0.5, 9)
    expect(valueAt(c, 4)).toBe(1.5)
  })
  it('傾きは区間ごとに一定で、最後の節点より後ろは0', () => {
    const s = polySlope([{ t: 0, y: -4 }, { t: 4, y: -2 }, { t: 8, y: 4 }])
    expect(s.y[0]).toBe(0.5)
    expect(s.y[indexOf(4)]).toBe(1.5)
    expect(s.jumps[indexOf(4)]).toBe(0.5)
    expect(s.y[indexOf(8)]).toBe(0)
    expect(s.jumps[indexOf(8)]).toBe(1.5)
    expect(polySlope([{ t: 0, y: 0 }, { t: 10, y: 5 }]).y[N - 1]).toBe(0.5)
  })
  it('描いた範囲の割合', () => {
    expect(polyCoverage([{ t: 0, y: 0 }], 10)).toBe(0)
    expect(polyCoverage([{ t: 0, y: 0 }, { t: 7.5, y: 1 }], 8)).toBeCloseTo(0.9375)
  })
})

describe('収録問題', () => {
  it('16問あり、id が p01〜p16', () => {
    expect(PROBLEMS.map((p) => p.id)).toEqual(Array.from({ length: 16 }, (_, i) => `p${String(i + 1).padStart(2, '0')}`))
    for (const pr of PROMPTS) expect(problemById(pr.id)).not.toBeNull()
  })
  it('x が常に −5〜+5 m に収まり、終わりの x が表と一致する', () => {
    for (const p of PROBLEMS) {
      const m = buildMotion(p)
      expect([8, 10]).toContain(m.dur)
      for (const x of samples(m.x, m.dur)) expect(Math.abs(x)).toBeLessThanOrEqual(5 + 1e-9)
      expect(m.x.y[indexOf(m.dur)]).toBeCloseTo(END_X[p.id], 9)
    }
  })
  it('折れ線の v-t から求めた x が、解析解と 1e-6 m 以内で一致する', () => {
    for (const p of PROBLEMS) {
      const m = buildMotion(p)
      const v = polyCurve(vNodes(p))
      const x = integrate(v, p.x0)
      for (let i = 0; i <= indexOf(m.dur); i++) expect(Math.abs(x.y[i] - m.x.y[i])).toBeLessThan(1e-6)
      // 折れ線の v と、その傾き a も解析解と一致する
      expect(samples(v, m.dur).every((y, i) => Math.abs(y - samples(m.v, m.dur)[i]) < 1e-9)).toBe(true)
      if (p.level >= 3) {
        const a = polySlope(vNodes(p))
        expect(samples(a, m.dur).every((y, i) => Math.abs(y - samples(m.a, m.dur)[i]) < 1e-9)).toBe(true)
      }
    }
  })
  it('節点の値がすべて吸着の格子に乗っている（正解を折れ線で正確に描ける）', () => {
    for (const p of PROBLEMS) {
      const m = buildMotion(p)
      let t = 0
      for (const s of p.segments) {
        t += s.dur
        expect((t / 0.5) % 1).toBe(0)
        expect(Math.abs((m.v.y[indexOf(t)] / 0.5) % 1)).toBeLessThan(1e-9)
        if (s.a !== undefined) expect(Math.abs((s.a / 0.25) % 1)).toBe(0)
        else expect(Math.abs((m.x.y[indexOf(t)] / 0.5) % 1)).toBeLessThan(1e-9)
      }
      expect(Math.abs((p.x0 / 0.5) % 1)).toBe(0)
    }
  })
})

describe('採点', () => {
  it('正解そのものを入力すると100点（全問・全タスク）', () => {
    for (const p of PROBLEMS) {
      const m = buildMotion(p)
      for (const task of p.tasks) {
        const { ask } = splitTask(task)
        expect(score(curveOf(m, ask)!, curveOf(m, ask)!, KIND[ask], m.dur)).toBe(100)
      }
      // 折れ線ツールで描いた正解も100点
      expect(score(polyCurve(vNodes(p)), m.v, 'v', m.dur)).toBe(100)
      if (p.level >= 3) expect(score(polySlope(vNodes(p)), m.a, 'a', m.dur)).toBe(100)
      else expect(score(integrate(polyCurve(vNodes(p)), p.x0), m.x, 'x', m.dur)).toBe(100)
    }
  })
  it('全区間0の入力は、16問すべての x-t・v-t で30点未満', () => {
    for (const p of PROBLEMS) {
      const m = buildMotion(p)
      expect(score(zero, m.x, 'x', m.dur)).toBeLessThan(30)
      expect(score(zero, m.v, 'v', m.dur)).toBeLessThan(30)
    }
  })
  it('運動の終わりで線を0に落としても減点しない', () => {
    const p = problemById('p09')!
    const m = buildMotion(p)
    expect(score(polyCurve([{ t: 0, y: 0 }, { t: 8, y: 2 }, { t: 8, y: 0 }]), m.v, 'v', m.dur)).toBe(100)
  })
  it('段差を0.5秒かけた斜めの線で描いても合格する', () => {
    const m = buildMotion(problemById('p02')!)
    const s = score(polyCurve([{ t: 0, y: 0.5 }, { t: 4, y: 0.5 }, { t: 4.5, y: 1.5 }, { t: 8, y: 1.5 }, { t: 8.5, y: 0 }]), m.v, 'v', m.dur)
    expect(s).toBeGreaterThanOrEqual(PASS)
    expect(s).toBeLessThan(100)
    // 段差をまたぐ向きに斜めにしたものは、ずれが採点の外に収まる
    expect(score(polyCurve([{ t: 0, y: 0.5 }, { t: 3.75, y: 0.5 }, { t: 4.25, y: 1.5 }, { t: 7.75, y: 1.5 }, { t: 8.25, y: 0 }]), m.v, 'v', m.dur)).toBe(100)
    // 速さの値がちがえば、段差の位置が合っていても合格しない
    expect(score(polyCurve([{ t: 0, y: 1 }, { t: 4, y: 1 }, { t: 4, y: 0.5 }, { t: 8, y: 0.5 }, { t: 8, y: 0 }]), m.v, 'v', m.dur)).toBeLessThan(PASS)
  })
  it('R の下限（一定値のお手本でも採点できる）', () => {
    const m = buildMotion(problemById('p01')!)
    expect(rangeOf(m.v, 'v', m.dur)).toBe(1)
    expect(rangeOf(m.x, 'x', m.dur)).toBe(5)
    expect(score({ y: m.v.y.map(() => 0.6), jumps: {} }, m.v, 'v', m.dur)).toBe(75)
  })
  it('ずれが最も大きい区間', () => {
    const m = buildMotion(problemById('p05')!)
    const wrong = polyCurve([{ t: 0, y: 1 }, { t: 4, y: 1 }, { t: 4, y: 2 }, { t: 7, y: 2 }, { t: 7, y: 0 }])
    const w = worstInterval(wrong, m.v, 'v', m.dur)!
    expect(w[0]).toBeGreaterThanOrEqual(4)
    expect(w[1]).toBeLessThanOrEqual(7.05)
    expect(worstInterval(m.v, m.v, 'v', m.dur)).toBeNull()
  })
})

describe('誤答パターン', () => {
  const abs = (c: Curve): Curve => ({ y: c.y.map(Math.abs), jumps: Object.fromEntries(Object.entries(c.jumps).map(([k, v]) => [k, Math.abs(v)])) })
  const neg = (c: Curve): Curve => ({ y: c.y.map((v) => -v), jumps: Object.fromEntries(Object.entries(c.jumps).map(([k, v]) => [k, -v])) })
  it('正解の絶対値を入力すると「向きの無視」（負の速度を含む問題の v-t）', () => {
    for (const id of ['p04', 'p05', 'p06', 'p07', 'p08', 'p12', 'p13', 'p14', 'p15', 'p16']) {
      const p = problemById(id)!
      const m = buildMotion(p)
      for (const task of p.tasks.filter((t) => splitTask(t).ask === 'vt')) {
        expect([id, task, detectPattern(abs(m.v), task, m)]).toEqual([id, task, 'abs'])
      }
    }
  })
  it('正解そのものには、どの型も当てはまらない', () => {
    for (const p of PROBLEMS) {
      const m = buildMotion(p)
      for (const task of p.tasks) expect(detectPattern(curveOf(m, splitTask(task).ask)!, task, m)).toBeNull()
    }
  })
  it('元のグラフと同じ形・符号が逆・一段ずれ', () => {
    const m = buildMotion(problemById('p06')!)
    // x-t を見て、同じ形の v-t を描く（高さだけ縮めたもの）
    const same: Curve = { y: m.x.y.map((v) => v / 2), jumps: {} }
    expect(detectPattern(same, 'xt>vt', m)).toBe('same')
    const m13 = buildMotion(problemById('p13')!)
    expect(detectPattern(neg(m13.v), 'anim>vt', m13)).toBe('neg')
    const m16 = buildMotion(problemById('p16')!)
    expect(detectPattern(m16.v, 'vt>at', m16)).toBe('same')
    expect(detectPattern(m16.a, 'anim>vt', m16)).toBe('shift')
    for (const h of Object.values(HINTS)) expect(h.length).toBeGreaterThan(5)
  })
  it('まったく別の形や、一定の線には当てはめない', () => {
    const m = buildMotion(problemById('p05')!)
    expect(detectPattern(zero, 'xt>vt', m)).toBeNull()
    expect(corr([1, 1, 1], [1, 2, 3])).toBeNull()
  })
})

describe('フリーハンド', () => {
  it('なぞった間の標本を線形補間で埋め、左へ戻ると上書きする', () => {
    const f = emptyFree()
    stroke(f, 1, 0, 2, 1)
    expect(f[indexOf(1.5)]).toBeCloseTo(0.5, 12)
    expect(f[indexOf(0.95)]).toBeNull()
    stroke(f, 2, 1, 1.5, 2)
    expect(f[indexOf(1.5)]).toBeCloseTo(2, 12)
    expect(f[indexOf(2)]).toBeCloseTo(1, 12)
    expect(f.filter((v) => v !== null).length).toBe(21)
  })
  it('未記入の区間：中間は直線でつなぎ、前後は水平にのばす', () => {
    const f = emptyFree()
    stroke(f, 2, 1, 3, 1)
    stroke(f, 5, 3, 6, 3)
    const c = completeFree(f)!
    expect(c.curve.y[0]).toBe(1)
    expect(c.curve.y[indexOf(4)]).toBeCloseTo(2, 12)
    expect(c.curve.y[N - 1]).toBe(3)
    expect(c.filled[indexOf(4)]).toBe(true)
    expect(c.filled[indexOf(2.5)]).toBe(false)
    expect(completeFree(emptyFree())).toBeNull()
    expect(freeCoverage(f, 10)).toBeCloseTo(42 / 201)
  })
  it('ならしても、直線はほぼ直線のまま。ぎざぎざは小さくなる', () => {
    const f = emptyFree()
    for (let i = 20; i <= 120; i++) f[i] = 0.5 * timeOf(i) + (i % 2 ? 0.1 : -0.1)
    const s = smoothFree(f, 20, 120)
    expect(Math.abs((s[70] as number) - 0.5 * timeOf(70))).toBeLessThan(0.02)
    expect(s[10]).toBeNull()
  })
  it('なめらかな曲線の傾き', () => {
    const x = Array.from({ length: N }, (_, i) => 0.25 * timeOf(i) ** 2)
    const v = smoothSlope(x, 0.2)
    expect(v.y[indexOf(4)]).toBeCloseTo(2, 2)
    expect(diff([0, DT, 2 * DT])).toEqual([1, 1, 1])
    expect(gauss([1, 1, 1, 1], 0.1)).toEqual([1, 1, 1, 1])
  })
})

describe('ドラッグ記録', () => {
  it('不ぞろいな時刻の記録を、0.05秒刻みに取り直す', () => {
    const x = resample([{ t: 0, x: 0 }, { t: 0.13, x: 1.3 }, { t: 1, x: 10 }], 10)
    expect(x[2]).toBeCloseTo(1, 9)
    expect(x[indexOf(0.5)]).toBeCloseTo(5, 9)
    expect(x[N - 1]).toBe(10)
  })
  it('指を止めると、表示の v が ±0.05 m/s 以内に落ち着く', () => {
    const f = new LiveFilter()
    let out = { x: 0, v: 0 }
    for (let k = 0; k <= 120; k++) out = f.push(k / 60, Math.min(2, (k / 60) * 2))
    // 1秒動かして（2 m/s）、そのあと1秒止めている
    expect(Math.abs(out.v)).toBeLessThan(0.05)
    expect(out.x).toBeCloseTo(2, 2)
  })
  it('等速で動かした記録から、x・v・a が求まる', () => {
    const raw = Array.from({ length: 601 }, (_, k) => ({ t: k / 60, x: -4 + 0.5 * (k / 60) }))
    const r = finalize(raw, 10)
    expect(r.x.y[indexOf(4)]).toBeCloseTo(-2, 6)
    expect(r.v.y[indexOf(4)]).toBeCloseTo(0.5, 6)
    expect(Math.abs(r.a.y[indexOf(4)])).toBeLessThan(1e-6)
    const m = buildMotion(problemById('p01')!)
    expect(score(r.x, m.x, 'x', m.dur)).toBe(100)
  })
})

describe('ストロボの足あと', () => {
  it('p16：加速で間隔が広がり、等速でそろい、折り返すと下の段へ移る', async () => {
    const { strobeMarks, groupMarks } = await import('./strobe')
    const m = buildMotion(problemById('p16')!)
    const marks = strobeMarks(m.x, m.dur)
    expect(marks.map((k) => Number(k.x.toFixed(6)))).toEqual([-4, -3.5, -2, 0, 2, 3.5, 4, 3.5, 2, 0, -2])
    // t = 6 s（いちばん右）までは右へ進む段、そのあとは戻る段
    expect(marks.map((k) => k.lane)).toEqual([0, 0, 0, 0, 0, 0, 1, 1, 1, 1, 1])
    // 途中までしか再生していなければ、そこまでの点だけ
    expect(strobeMarks(m.x, 2.7).length).toBe(3)
    expect(groupMarks(marks).length).toBe(11)
  })
  it('止まっている間の点は1つにまとめる', async () => {
    const { strobeMarks, groupMarks } = await import('./strobe')
    const m = buildMotion(problemById('p03')!)
    const g = groupMarks(strobeMarks(m.x, m.dur))
    expect(g[g.length - 1]).toEqual({ t0: 4, t1: 10, x: 3, lane: 0 })
    // はじめに左へ動き出す運動は、最初の点から戻る段
    const m4 = buildMotion(problemById('p04')!)
    expect(strobeMarks(m4.x, 1)[0].lane).toBe(1)
  })
})
