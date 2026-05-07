import express from 'express';
import fs from 'node:fs';
import { parseTupa } from './src/loader';
import { applyRule } from './src/transform';
import { RULES } from './src/rules';
import { INITIAL_TAGGERS } from './src/taggers';
import type { Phonology, TaggerDef } from './src/types';

// ---- 预计算 22 个阶段 ----
const tupaPath = ["./tupa.dict.yaml", "../tupa.dict.yaml"].find(p => fs.existsSync(p)) ?? "tupa.dict.yaml";
const viewerPath = ["./viewer", "../viewer/dist"].find(p => fs.existsSync(p));
const tupaText = fs.readFileSync(tupaPath, 'utf-8');
const base = parseTupa(tupaText);

const stages: Phonology[] = [];
let current = base;
let currentTaggers = INITIAL_TAGGERS;

// 前切韵音系
let currentStageGroup = '前《切韵》音系';
stages.push({
  name: '前《切韵》音系',
  stageGroup: currentStageGroup,
  ruleName: '前《切韵》音系',
  entries: current,
  taggers: currentTaggers,
});
console.log(`Stage 0: 前《切韵》音系 — ${[...new Set(current.map(e => e.pron))].length}`);

for (let i = 0; i < RULES.length; i++) {
  const rule = RULES[i];
  current = applyRule(current, rule.apply);
  currentTaggers = currentTaggers.map(rule.taggerUpdate);
  if (rule.stageGroup) currentStageGroup = rule.stageGroup;
  stages.push({
    name: rule.name,
    stageGroup: currentStageGroup,
    ruleName: rule.name,
    entries: current,
    taggers: currentTaggers,
  });
  console.log(`Stage ${i + 1}: ${rule.name} — ${[...new Set(current.map(e => e.pron))].length}`);
}

// ---- 矩阵计算 ----
function sortKeys(keys: string[], tdefs: TaggerDef[]): string[] {
  return keys.sort((a, b) => {
    const al = a.split('|'), bl = b.split('|');
    for (let i = 0; i < Math.min(al.length, bl.length); i++) {
      const ord = tdefs[i]?.order;
      if (ord) {
        const ai = ord.indexOf(al[i]), bi = ord.indexOf(bl[i]);
        if (ai !== bi) return (ai === -1 ? 999 : ai) - (bi === -1 ? 999 : bi);
      }
      if (al[i] < bl[i]) return -1;
      if (al[i] > bl[i]) return 1;
    }
    return al.length - bl.length;
  });
}

function buildMatrix(
  entries: { char: string; pron: string }[],
  rowFns: ((p: string) => string)[],
  colFns: ((p: string) => string)[],
  rowTdefs: TaggerDef[],
  colTdefs: TaggerDef[],
) {
  const pronChars = new Map<string, string[]>();
  const pronCount = new Map<string, number>();
  for (const e of entries) {
    if (!pronChars.has(e.pron)) pronChars.set(e.pron, []);
    pronChars.get(e.pron)!.push(e.char);
    pronCount.set(e.pron, (pronCount.get(e.pron) ?? 0) + 1);
  }

  const syllables = [...new Set(entries.map(e => e.pron))].sort();
  const tagged = syllables.map(syl => ({
    syl,
    rl: rowFns.map(fn => fn(syl)),
    cl: colFns.map(fn => fn(syl)),
  }));

  const rkSet = new Set(tagged.map(t => t.rl.join('|')));
  const ckSet = new Set(tagged.map(t => t.cl.join('|')));

  const sortedRows = sortKeys([...rkSet], rowTdefs);
  const sortedCols = sortKeys([...ckSet], colTdefs);

  const cellMap = new Map<string, string[]>();
  for (const t of tagged) {
    const ri = sortedRows.indexOf(t.rl.join('|'));
    const ci = sortedCols.indexOf(t.cl.join('|'));
    const ck = `${ri}|${ci}`;
    if (!cellMap.has(ck)) cellMap.set(ck, []);
    cellMap.get(ck)!.push(t.syl);
  }

  const rows = sortedRows.map(k => ({ key: k, labels: k.split('|') }));
  const cols = sortedCols.map(k => ({ key: k, labels: k.split('|') }));
  const cells = [...cellMap.entries()].map(([key, sylls]) => {
    const [ri, ci] = key.split('|').map(Number);
    const charCount = sylls.reduce((sum, s) => sum + (pronCount.get(s) ?? 0), 0);
    return { rowIdx: ri, colIdx: ci, count: sylls.length, charCount, syllables: sylls.map(s => ({ pron: s, chars: pronChars.get(s)! })) };
  });

  return { rows, cols, cells };
}

function colHeaders(keys: string[], tdefs: TaggerDef[]) {
  const depth = tdefs.length;
  const levels: { label: string; span: number }[][] = [];
  for (let lv = 0; lv < depth; lv++) {
    const spans: { label: string; span: number }[] = [];
    let i = 0;
    while (i < keys.length) {
      const label = keys[i].split('|')[lv];
      let span = 1;
      while (i + span < keys.length && keys[i + span].split('|')[lv] === label) span++;
      spans.push({ label, span });
      i += span;
    }
    levels.push(spans);
  }
  return levels;
}

function rowLabelCells(rows: { key: string; labels: string[] }[]) {
  const depth = rows[0]?.labels.length ?? 0;
  if (depth === 0) return [];
  const levels: { label: string; rowSpan: number }[][] = [];
  for (let lv = 0; lv < depth; lv++) {
    const cells: { label: string; rowSpan: number }[] = [];
    let i = 0;
    while (i < rows.length) {
      const label = rows[i].labels[lv];
      let span = 1;
      while (i + span < rows.length) {
        let same = true;
        for (let pl = 0; pl <= lv; pl++) {
          if (rows[i + span].labels[pl] !== rows[i].labels[pl]) { same = false; break; }
        }
        if (!same) break;
        span++;
      }
      cells.push({ label, rowSpan: span });
      i += span;
    }
    levels.push(cells);
  }
  return levels;
}

// ---- Express ----
const app = express();
app.use(express.json());

// 生产模式：serve 前端静态文件
if (viewerPath) {
  app.use(express.static(viewerPath));
}

app.get('/api/stages', (_req, res) => {
  res.json(stages.map((s, i) => ({
    index: i,
    name: s.name,
    stageGroup: s.stageGroup,
    ruleName: s.ruleName,
    count: [...new Set(s.entries.map(e => e.pron))].length,
    taggers: s.taggers,
  })));
});

app.post('/api/matrix', (req, res) => {
  const { stageIdx, rowTaggers, colTaggers, filters } = req.body as {
    stageIdx: number; rowTaggers: string[]; colTaggers: string[]; filters: Record<string, string[]>;
  };
  const stage = stages[stageIdx];
  if (!stage) return res.status(400).json({ error: 'invalid stageIdx' });

  const resolve = (id: string) => {
    const td = stage.taggers.find(t => t.id === id);
    return td?.tag ?? (() => '?');
  };
  const rowFns = rowTaggers.map(resolve);
  const colFns = colTaggers.map(resolve);
  const rowTdefs = rowTaggers.map(id => stage.taggers.find(t => t.id === id)!);
  const colTdefs = colTaggers.map(id => stage.taggers.find(t => t.id === id)!);

  // 筛选
  let entries = stage.entries;
  if (filters) {
    const allFns = [...rowTaggers.map((id, i) => [id, rowFns[i]] as const), ...colTaggers.map((id, i) => [id, colFns[i]] as const)];
    for (const [id, fn] of allFns) {
      const sel = filters[id];
      if (sel && sel.length > 0) {
        const set = new Set(sel);
        entries = entries.filter(e => set.has(fn(e.pron)));
      }
    }
  }

  const matrix = buildMatrix(entries, rowFns, colFns, rowTdefs, colTdefs);
  const colHdrs = colHeaders(matrix.cols.map(c => c.key), colTdefs);
  const rowLabels = rowLabelCells(matrix.rows);

  res.json({
    name: stage.name,
    count: [...new Set(stage.entries.map(e => e.pron))].length,
    taggers: stage.taggers,
    rows: matrix.rows,
    cols: matrix.cols,
    colHeaders: colHdrs,
    rowLabels,
    cells: matrix.cells,
  });
});

app.post('/api/query', (req, res) => {
  const { stageIdx, char, rowTaggers, colTaggers } = req.body as {
    stageIdx: number; char: string; rowTaggers: string[]; colTaggers: string[];
  };
  const stage = stages[stageIdx];
  if (!stage || !char) return res.status(400).json({ error: 'invalid params' });

  const resolve = (id: string) => stage.taggers.find(t => t.id === id)?.tag ?? (() => '?');
  const rowFns = rowTaggers.map(resolve);
  const colFns = colTaggers.map(resolve);

  const entries = stage.entries.filter(e => e.char === char);
  const results = entries.map(e => ({
    pron: e.pron,
    rowLabels: rowFns.map(fn => fn(e.pron)),
    colLabels: colFns.map(fn => fn(e.pron)),
  }));

  res.json({ char, results });
});

app.post('/api/trace', (req, res) => {
  const { stageIdx, syllables } = req.body as { stageIdx: number; syllables: string[] };
  if (!syllables?.length) return res.json({ traces: [] });
  const targetStage = stages[stageIdx];
  if (!targetStage) return res.status(400).json({ error: 'invalid stageIdx' });

  const sylSet = new Set(syllables);

  // 从目标阶段收集所有匹配的字
  const matchedChars = new Set<string>();
  for (const e of targetStage.entries) {
    if (sylSet.has(e.pron)) matchedChars.add(e.char);
  }

  const traces: { char: string; stages: { stage: number; pron: string; rule?: string }[] }[] = [];

  for (const ch of matchedChars) {
    // 在初始音系找到该字的全部读音
    const stage0Entries = stages[0].entries.filter(e => e.char === ch);

    for (const e0 of stage0Entries) {
      // stage 0 就检查是否匹配目标音节
      if (stageIdx === 0 && !sylSet.has(e0.pron)) continue;

      const chain: { stage: number; pron: string; rule?: string }[] = [{ stage: 0, pron: e0.pron }];
      let cur = e0.pron;
      let matched = true;

      for (let i = 0; i < RULES.length; i++) {
        const prev = cur;
        cur = RULES[i].apply(cur);
        if (cur !== prev) {
          chain.push({ stage: i + 1, pron: cur, rule: RULES[i].name });
        }
        // stageIdx > 0 时，在对应规则后检查是否匹配目标音节
        if (i === stageIdx - 1 && !sylSet.has(cur)) {
          matched = false;
          break;
        }
      }

      if (matched) {
        traces.push({ char: ch, stages: chain });
      }
    }
  }

  res.json({ traces, ruleNames: RULES.map(r => r.name) });
});

const port = 8732;
app.listen(port, () => console.log(`Server: http://localhost:${port}`));
