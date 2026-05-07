/** 一个音节 → 一个标记值 */
export type Tagger = (pron: string) => string;

/** Tagger 定义 */
export interface TaggerDef {
  id: string;
  name: string;
  category: string;
  tag: Tagger;
  order: string[];
}

/** 音变规则：字符串 → 字符串 */
export type Rule = (pron: string) => string;

/** 对 tagger 的更新：逐个 tagger 调用，不改就原样返回 */
export type TaggerUpdate = (t: TaggerDef) => TaggerDef;

/** 一个共时音系的条目 */
export interface WordEntry {
  char: string;
  pron: string;
}

/** 一个共时音系 */
export type WordList = WordEntry[];

/** 一个共时音系（含 tagger） */
export interface Phonology {
  name: string;
  stageGroup: string;
  ruleName: string;
  entries: WordEntry[];
  taggers: TaggerDef[];
}

/** 带名称的规则 */
export interface NamedRule {
  name: string;
  stageGroup?: string;
  apply: Rule;
  taggerUpdate: TaggerUpdate;
}
