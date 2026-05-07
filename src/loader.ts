import type { WordList } from './types';

// ============================================================
// 纯函数：文本 → 字表
// ============================================================

/**
 * 从 tupa.dict.yaml 的原始文本解析为 WordList。
 * 仅保留单字条目（无空格发音）。
 */
export function parseTupa(text: string): WordList {
  const lines = text.split('\n');
  let inHeader = true;
  const entries: WordList = [];

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    if (trimmed === '...') {
      inHeader = false;
      continue;
    }
    if (inHeader) continue;

    const [char, pron] = trimmed.split('\t');
    if (!char || pron === undefined) continue;
    const p = pron.trim();
    if (!p || p.includes(' ')) continue; // 排除多字词

    entries.push({ char, pron: p });
  }

  return entries;
}
