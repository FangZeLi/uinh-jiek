import type { WordList, WordEntry, Rule, NamedRule } from './types';

// ============================================================
// 纯函数：音变引擎
// ============================================================

/** 对字表应用一条规则，返回新字表 */
export function applyRule(list: WordList, rule: Rule): WordList {
  return list.map(({ char, pron }) => ({
    char,
    pron: rule(pron),
  }));
}

/** 对字表链式应用多条规则 */
export function applyChain(list: WordList, rules: (Rule | NamedRule)[]): WordList {
  return rules.reduce(
    (acc, r) => applyRule(acc, 'apply' in r ? r.apply : r),
    list,
  );
}

// ============================================================
// 组合子
// ============================================================

/** 将多条规则合并为一条（依次应用） */
export function compose(...rules: Rule[]): Rule {
  return (pron: string) => rules.reduce((p, r) => r(p), pron);
}

/** 仅当条件满足时才应用规则，否则原样返回 */
export function when(pred: (pron: string) => boolean, rule: Rule): Rule {
  return (pron: string) => (pred(pron) ? rule(pron) : pron);
}

/** 仅在声母匹配时应用元音/韵尾变换（避免误伤声母部分） */
export function afterInitial(rule: Rule): Rule {
  return (pron: string) => {
    // 声母后第一个元音/介音位置
    const m = pron.match(/^[a-z]+?(?=[aeoiuyəɛɔæɑɨ])/);
    if (!m) return rule(pron);
    const initLen = m[0].length;
    return pron.slice(0, initLen) + rule(pron.slice(initLen));
  };
}

// ============================================================
// 工具
// ============================================================

/** 对字表分组：按语音演变结果聚合同音字 */
export function groupByPron(list: WordList): Map<string, string[]> {
  const map = new Map<string, string[]>();
  for (const { char, pron } of list) {
    const chars = map.get(pron) ?? [];
    chars.push(char);
    map.set(pron, chars);
  }
  return map;
}

/** 字表中所有不重复的音节 */
export function uniqueSet(list: WordList): Set<string> {
  const s = new Set<string>();
  for (const e of list) s.add(e.pron);
  return s;
}

// ============================================================
// 音变分析
// ============================================================

/** 音节变化映射 pron_before → Set(pron_after) */
export function diff(
  before: WordList,
  after: WordList,
): Map<string, Set<string>> {
  const m = new Map<string, Set<string>>();
  for (let i = 0; i < before.length; i++) {
    const pb = before[i].pron;
    const pa = after[i].pron;
    if (pb === pa) continue;
    const targets = m.get(pb) ?? new Set();
    targets.add(pa);
    m.set(pb, targets);
  }
  return m;
}

/** 消失的音节：变前存在，变后不存在 */
export function vanished(before: WordList, after: WordList): string[] {
  const aSet = uniqueSet(after);
  return [...uniqueSet(before)].filter(p => !aSet.has(p)).sort();
}

/** 新生的音节：变后存在，变前不存在 */
export function emerged(before: WordList, after: WordList): string[] {
  const bSet = uniqueSet(before);
  return [...uniqueSet(after)].filter(p => !bSet.has(p)).sort();
}

/** 合流：多个变前音节 → 同一个变后音节。返回 Map<结果, 来源[]> */
export function mergers(before: WordList, after: WordList): Map<string, string[]> {
  // 构建 变后音节 → Set(变前音节)，包含所有条目（含未变的）
  const rev = new Map<string, Set<string>>();
  for (let i = 0; i < before.length; i++) {
    const pb = before[i].pron;
    const pa = after[i].pron;
    const sources = rev.get(pa) ?? new Set();
    sources.add(pb);
    rev.set(pa, sources);
  }
  // 保留有 >=2 个来源 (含未变的) 且至少一个发生了变化
  const result = new Map<string, string[]>();
  for (const [target, sources] of rev) {
    if (sources.size < 2) continue;
    const all = [...sources].sort();
    const hasChange = all.some(s => s !== target);
    if (hasChange) {
      result.set(target, all);
    }
  }
  return result;
}

/** 完整的音变报告 */
export function analyze(
  before: WordList,
  after: WordList,
): {
  vanished: string[];
  emerged: string[];
  mergers: Map<string, string[]>;
  changed: number;
  unchanged: number;
} {
  let changed = 0;
  let unchanged = 0;
  for (let i = 0; i < before.length; i++) {
    if (before[i].pron === after[i].pron) unchanged++;
    else changed++;
  }
  return {
    vanished: vanished(before, after),
    emerged: emerged(before, after),
    mergers: mergers(before, after),
    changed,
    unchanged,
  };
}
