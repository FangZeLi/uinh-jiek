import type { WordList } from './types';

/** 将字表序列化为 tupa.dict.yaml 格式 */
export function stringify(list: WordList, name: string): string {
  const header = [
    '# Rime dictionary',
    '# encoding: utf-8',
    '#',
    '# Auto-generated from sound change rules',
    '# Do NOT edit directly!',
    '',
    '---',
    `name: ${name}`,
    'version: "1.0"',
    'sort: by_weight',
    'use_preset_vocabulary: true',
    '...',
    '',
  ];

  const body = list.map(e => `${e.char}\t${e.pron}`).join('\n');
  return header.join('\n') + body + '\n';
}

/** 保存字表到文件 */
export function save(list: WordList, filepath: string, name: string): void {
  const fs = require('node:fs');
  fs.writeFileSync(filepath, stringify(list, name), 'utf-8');
}
