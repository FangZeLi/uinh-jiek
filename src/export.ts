import fs from 'node:fs';
import { parseTupa } from './loader';
import { applyRule } from './transform';
import { RULES } from './rules';
import { INITIAL_TAGGERS } from './taggers';
import type { WordList, Phonology, TaggerDef } from './types';

// ---- 预计算所有音节及其标记 ----
interface SyllableEntry {
  pron: string;
  tags: Record<string, string>;
}

interface StageData {
  index: number;
  name: string;
  taggers: TaggerDef[];
  syllables: SyllableEntry[];
}

const tupaText = fs.readFileSync('tupa.dict.yaml', 'utf-8');
const base = parseTupa(tupaText);

let current: WordList = base;
let currentTaggers = INITIAL_TAGGERS;
const stages: StageData[] = [];

// 前切韵音系
{
  const syllMap = new Map<string, SyllableEntry>();
  for (const e of current) {
    if (!syllMap.has(e.pron)) {
      const tags: Record<string, string> = {};
      for (const t of currentTaggers) tags[t.id] = t.tag(e.pron);
      syllMap.set(e.pron, { pron: e.pron, tags });
    }
  }
  const syllables = [...syllMap.values()].sort((a, b) => a.pron.localeCompare(b.pron));
  stages.push({ index: 0, name: '前切韵音系', taggers: currentTaggers, syllables });
  console.log(`Stage 0: 前切韵音系 — ${syllables.length} syllables`);
}

for (let i = 0; i < RULES.length; i++) {
  const rule = RULES[i];
  current = applyRule(current, rule.apply);
  currentTaggers = currentTaggers.map(rule.taggerUpdate);

  const syllMap = new Map<string, SyllableEntry>();
  for (const e of current) {
    if (!syllMap.has(e.pron)) {
      const tags: Record<string, string> = {};
      for (const t of currentTaggers) tags[t.id] = t.tag(e.pron);
      syllMap.set(e.pron, { pron: e.pron, tags });
    }
  }
  const syllables = [...syllMap.values()].sort((a, b) => a.pron.localeCompare(b.pron));
  stages.push({ index: i + 1, name: rule.name, taggers: currentTaggers, syllables });
  console.log(`Stage ${i + 1}: ${rule.name} — ${syllables.length} syllables`);
}

fs.mkdirSync('output', { recursive: true });
fs.writeFileSync('output/all_stages.json', JSON.stringify(stages, null, 2), 'utf-8');
console.log('\nExported to output/all_stages.json');
