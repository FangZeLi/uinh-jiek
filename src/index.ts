import fs from 'node:fs';
import { parseTupa } from './loader';
import { applyRule, analyze } from './transform';
import { stringify } from './io';
import { RULES } from './rules';
import type { WordList } from './types';

const tupaText = fs.readFileSync('tupa.dict.yaml', 'utf-8');
let current: WordList = parseTupa(tupaText);
console.log(`加载 tupa: ${current.length} 字\n`);

fs.mkdirSync('output', { recursive: true });

// stage0: 原始 tupa
fs.writeFileSync('output/stage0_tupa.dict.yaml', stringify(current, 'MC_stage0'), 'utf-8');
console.log(`保存: output/stage0_tupa.dict.yaml (${current.length} 字)`);

for (let i = 0; i < RULES.length; i++) {
  const prev = current;
  current = applyRule(current, RULES[i].apply);
  const file = `output/stage${i + 1}.dict.yaml`;
  fs.writeFileSync(file, stringify(current, RULES[i].name), 'utf-8');

  const report = analyze(prev, current);
  console.log(`\n==== ${RULES[i].name} ====`);
  console.log(`保存: ${file}`);
  console.log(`改变: ${report.changed} 字, 消失: ${report.vanished.length}, 新生: ${report.emerged.length}, 合流: ${report.mergers.size}`);

  for (const [target, sources] of report.mergers) {
    console.log(`  ${sources.join(', ')} -> ${target}`);
  }
}

console.log(`\n完成。最终字表: ${current.length} 字`);
