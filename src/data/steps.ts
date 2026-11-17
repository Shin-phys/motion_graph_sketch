// ステップ学習の内容：操作課題 → 気づきを3択でえらぶ
import { N } from '../core/constants'
import type { Curve } from '../core/curve'
import type { Task } from '../core/motion'

export type Played = { x: Curve; v: Curve }

export type Check = {
  text: string
  /** 再生した運動が課題に合っているか。first は、最初の課題で再生した運動 */
  test: (r: Played, first: Played | null) => boolean
  /** 合っていないときの声かけ */
  miss: string
}

export type Step = {
  n: number
  title: string
  intro: string
  /** 自分でグラフを描いて再生する課題 */
  checks?: Check[]
  /** 予想して描く課題 */
  tasks?: { pid: string; task: Task }[]
  aids?: { tangent?: boolean; area?: boolean }
  question: string
  choices: string[]
  correct: number
  /** 正解をえらんだあとに出す、まとめの1文 */
  point: string
  /** 誤答をえらんだときに促す操作 */
  again: string
}

const count = (v: number[], f: (y: number, i: number) => boolean) => v.filter(f).length
const isFlat = (v: number[]) => Math.max(...v) - Math.min(...v) < 0.05
/** 1秒＝20標本 */
const SEC = 20

export const STEPS: Step[] = [
  {
    n: 1,
    title: '等速で進む',
    intro: 'v-t グラフに水平な線を描くと、台車は同じ速さで進みます。x-t グラフがどうなるかを見よう。',
    checks: [
      { text: 'v-t に、0 でない高さの水平な線を描いて、再生する', test: (r) => isFlat(r.v.y) && Math.abs(r.v.y[0]) >= 0.2, miss: 'v-t の線が水平（0 以外の同じ高さ）になるように、t = 0 の点を上下に動かそう。' },
      {
        text: '速さを2倍（または半分）に変えて、もう一度再生する。前の x-t は灰色で残る',
        test: (r, first) => !!first && isFlat(r.v.y) && Math.abs(r.v.y[0]) >= 0.2 && (Math.abs(r.v.y[0] / first.v.y[0]) >= 1.5 || Math.abs(r.v.y[0] / first.v.y[0]) <= 0.67),
        miss: '水平な線のまま、高さを前の2倍（または半分）にしよう。',
      },
    ],
    question: '速さを2倍にすると、x-t グラフはどうなった？',
    choices: ['傾きが2倍の直線になった', '同じ傾きで、高い位置にずれた', '曲線になった'],
    correct: 0,
    point: '等速の運動の x-t グラフは直線で、速いほど傾きが大きくなります。',
    again: '速さを変えて再生し、灰色の線と今の線の「傾き」をくらべてみよう。',
  },
  {
    n: 2,
    title: '止まる・戻る',
    intro: 'v が 0 のとき、v が負のとき、台車と x-t グラフはどうなるでしょう。',
    checks: [
      {
        text: 'v-t に、「v = 0 の区間」と「v が負の区間」の両方がある折れ線を描いて、再生する',
        test: (r) => count(r.v.y, (y) => Math.abs(y) < 0.05) >= SEC && count(r.v.y, (y) => y <= -0.2) >= SEC,
        miss: 'v = 0 の区間（1秒以上）と、v が負の区間（1秒以上）の両方を入れよう。同じ時刻に点を2つ置くと、値を一瞬で変えられます。',
      },
    ],
    question: '台車が止まっているあいだ、x-t グラフはどうなっていた？',
    choices: ['水平な線になった', 'x = 0 まで下がった', '右下がりの線になった'],
    correct: 0,
    point: '静止しているあいだ x-t は水平、逆向きに進むあいだは右下がりになります。',
    again: '時刻のつまみを動かして、v = 0 の区間の x-t の形を見てみよう。',
  },
  {
    n: 3,
    title: '傾きを読む',
    intro: 'x-t グラフから v-t グラフをつくります。「接線」をオンにして、x-t をなぞると傾きの値が読めます。',
    tasks: [{ pid: 'p06', task: 'xt>vt' }],
    aids: { tangent: true },
    question: 'x-t グラフの「傾き」が表しているのは？',
    choices: ['速度', '位置', '加速度'],
    correct: 0,
    point: 'x-t グラフの傾きが、そのまま v の値になります。',
    again: 'x-t をなぞって、接線の傾きの値と v-t の値をくらべてみよう。',
  },
  {
    n: 4,
    title: '面積を読む',
    intro: 'v-t グラフから x-t グラフをつくります。「面積」をオンにして、v-t をなぞると 0 秒からの面積（変位）が読めます。',
    tasks: [{ pid: 'p05', task: 'vt>xt' }],
    aids: { area: true },
    question: 'v-t グラフで、t 軸より下の部分の面積は何を表す？',
    choices: ['負の向きへの変位（戻った分）', '正の向きへの変位', '変位とは関係がない'],
    correct: 0,
    point: 'v-t グラフの面積が変位です。t 軸より下の面積は、負の変位になります。',
    again: 'v が負の区間をなぞって、面積の値がどう変わるかを見てみよう。',
  },
  {
    n: 5,
    title: 'だんだん速く',
    intro: 'v-t グラフが右上がりの直線のとき、台車はだんだん速くなります。',
    checks: [
      {
        text: 'v-t に右上がりの直線を描いて、再生する',
        test: (r) => r.v.y[N - 1] - r.v.y[0] >= 1 && count(r.v.y, (y, i) => i > 0 && y - r.v.y[i - 1] > 1e-6) >= 5 * SEC && count(r.v.y, (y, i) => i > 0 && y - r.v.y[i - 1] < -1e-6) === 0,
        miss: 'v が少しずつ増えていく、右上がりの直線にしよう（5秒以上）。',
      },
    ],
    question: 'だんだん速くなる運動の x-t グラフは？',
    choices: ['曲線になり、傾きがだんだん大きくなる', '傾きが一定の直線になる', '水平な線になる'],
    correct: 0,
    point: '速度が増えていくと、x-t は曲線になり、接線の傾きが増えていきます。',
    again: '「接線」をオンにして時刻のつまみを動かし、傾きの値の変わり方を見てみよう。',
  },
  {
    n: 6,
    title: '減速と折り返し',
    intro: 'v が正から負へ変わると、台車は減速して止まり、逆向きに動き出します。',
    checks: [
      {
        text: 'v-t に、正の値から負の値へ下がっていく直線を描いて、再生する',
        test: (r) => r.v.y[0] >= 0.5 && r.v.y[N - 1] <= -0.5 && count(r.v.y, (y, i) => i > 0 && y - r.v.y[i - 1] < -1e-6) >= 5 * SEC && count(r.v.y, (y, i) => i > 0 && y - r.v.y[i - 1] > 1e-6) === 0,
        miss: 't = 0 で v を正に、終わりで v を負にして、右下がりの直線でつなごう。',
      },
    ],
    question: '台車が折り返す瞬間（v = 0）、加速度はどうなっている？',
    choices: ['0 ではない（v-t の傾きは変わらない）', '0 になる', '向きが逆になる'],
    correct: 0,
    point: 'v = 0 の瞬間も、v-t の傾き（加速度）は変わりません。',
    again: 'a-t グラフで、v = 0 になる時刻の値を見てみよう。',
  },
  {
    n: 7,
    title: '加速度のグラフ',
    intro: 'v-t グラフから a-t グラフをつくります。v-t の傾きが加速度です。',
    tasks: [{ pid: 'p14', task: 'vt>at' }],
    question: '負の向きに進みながら減速するとき、加速度の符号は？',
    choices: ['正', '負', '0'],
    correct: 0,
    point: '加速度の符号は、v-t の傾きで決まります。負の向きに進みながら減速すると、a は正です。',
    again: 'v-t の傾きが右上がりか右下がりかを確かめよう。',
  },
  {
    n: 8,
    title: '総合',
    intro: '台車の運動だけを見て、x-t・v-t・a-t を順に予想します。',
    tasks: [
      { pid: 'p16', task: 'anim>xt' },
      { pid: 'p16', task: 'anim>vt' },
      { pid: 'p16', task: 'anim>at' },
    ],
    question: '3つのグラフは、どうつながっている？',
    choices: ['x-t の傾きが v、v-t の傾きが a、v-t の面積が変位', 'x-t の面積が v、v-t の面積が a', '3つのグラフは同じ形になる'],
    correct: 0,
    point: 'x-t の傾きが v、v-t の傾きが a、v-t の面積が変位。3つのグラフは傾きと面積でつながっています。',
    again: '答え合わせのあと、「接線」と「面積」をオンにして時刻のつまみを動かしてみよう。',
  },
]
