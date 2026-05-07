import type { TaggerDef, Tagger } from "./types";

// ---- 解析辅助 ----
const MC_INITIALS = [
  "trh",
  "dr",
  "nr",
  "tr",
  "tsrh",
  "dzr",
  "tsr",
  "sr",
  "zr",
  "tjh",
  "dj",
  "sj",
  "nj",
  "zj",
  "tj",
  "tsh",
  "dz",
  "ts",
  "pfh",
  "ph",
  "th",
  "kh",
  "ng",
  "nj",
  "mh",
  "pf",
  "bv",
  "mv",
  "p",
  "b",
  "m",
  "t",
  "d",
  "n",
  "k",
  "g",
  "q",
  "h",
  "s",
  "z",
  "l",
  "j",
  "gh",
  "f",
  "v",
  "wv",
  "r",
].sort((a, b) => b.length - a.length);
const MC_VOWELS = [
  "oeu",
  "ee",
  "eo",
  "ou",
  "oy",
  "oi",
  "ae",
  "i",
  "y",
  "u",
  "e",
  "o",
  "a",
];
const MC_MEDIALS = ["wi", "w", "i", "y", "u"];

function getInit(p: string): string {
  for (const c of MC_INITIALS) {
    if (p.startsWith(c)) return c;
  }
  return "∅";
}

export function getRest(p: string): string {
  const init = getInit(p);
  return p.slice(init === "∅" ? 0 : init.length).replace(/[qhv]+$/, "");
}

export function parseMedialVowel(p: string): { medial: string; vowel: string } {
  const rest = getRest(p);
  for (const c of MC_MEDIALS) {
    if (rest.startsWith(c)) {
      const t = rest.slice(c.length);
      for (const v of MC_VOWELS) {
        if (t.startsWith(v)) return { medial: c, vowel: v };
      }
    }
  }
  for (const v of MC_VOWELS) {
    if (rest.startsWith(v)) return { medial: "", vowel: v };
  }
  return { medial: "", vowel: "" };
}

export function parseRhyme(p: string): {
  medial: string;
  vowel: string;
  coda: string;
} {
  const { medial, vowel } = parseMedialVowel(p);
  const rest = getRest(p);
  let coda = "";
  if (medial) {
    coda = rest.slice(medial.length + vowel.length);
  } else if (vowel) {
    coda = rest.slice(vowel.length);
  }
  return { medial, vowel, coda };
}

// ---- Tagger 定义 ----
const place: Tagger = (p) => {
  const i = getInit(p);
  if (["p", "ph", "b", "m"].includes(i)) return "双唇";
  if (["t", "th", "d", "n", "ts", "tsh", "dz", "s", "z", "l"].includes(i))
    return "齿龈";
  if (["nj", "tj", "tjh", "dj", "sj", "zj", "j"].includes(i)) return "龈腭";
  if (["tr", "trh", "dr", "nr", "tsr", "tsrh", "dzr", "sr", "zr"].includes(i))
    return "卷舌";
  if (["k", "kh", "g", "ng"].includes(i) || i === "∅") return "软腭";
  return "喉"; // q h gh
};

const manner: Tagger = (p) => {
  const i = getInit(p);
  if (["p", "t", "tr", "k", "q"].includes(i)) return "清不送气塞音";
  if (["ph", "th", "trh", "kh"].includes(i)) return "清送气塞音";
  if (["b", "d", "dr", "g"].includes(i)) return "浊塞音";
  if (["m", "n", "nr", "nj", "ng"].includes(i)) return "鼻音";
  if (["ts", "tsr", "tj"].includes(i)) return "清不送气塞擦音";
  if (["tsh", "tsrh", "tjh"].includes(i)) return "清送气塞擦音";
  if (["dz", "dzr", "dj"].includes(i)) return "浊塞擦音";
  if (["s", "sr", "sj", "h"].includes(i)) return "清擦音";
  if (["z", "zr", "zj", "gh"].includes(i)) return "浊擦音";
  if (["l"].includes(i)) return "边近音";
  return "近音"; // j, ∅
};

const dengwei: Tagger = (p) => {
  const rest = getRest(p);
  const isThird = /^(wi|[iyu])/.test(rest);

  if (isThird) {
    const { medial, vowel } = parseMedialVowel(p);
    const front = ["i", "e", "ae"].includes(vowel);
    if (medial) {
      const m = rest.startsWith("wi") && medial === "w" ? "wi" : medial;
      if (["i", "wi"].includes(m)) return "重纽四等";
      if (["y", "u"].includes(m) && front) return "重纽三等";
      return "无重纽三等";
    }
    // 无介音，主元音自身 = i/y/u
    if (vowel === "i") return "重纽四等";
    if (vowel === "y" || vowel === "u") return "无重纽三等";
    return "无重纽三等";
  }

  const { vowel } = parseMedialVowel(p);
  if (["ee", "ae", "oeu"].includes(vowel)) return "二等";
  if (vowel === "e") return "四等";
  return "一等";
};

const kaihe: Tagger = (p) => {
  const r = parseRhyme(p);
  const mv = r.medial + r.vowel;
  if (["o", "ou", "oeu"].includes(mv)) return "合";

  const rest = getRest(p);
  const isThird = /^(wi|[iyu])/.test(rest);
  if (isThird) {
    if (/^(wi|u)/.test(rest)) return "合";
  } else {
    if (/^w/.test(rest)) return "合";
  }
  return "开";
};

const codaManner: Tagger = (p) => {
  const { coda } = parseRhyme(p);
  if (["", "w", "j"].includes(coda)) return "近音";
  if (["p", "t", "k"].includes(coda)) return "塞音";
  return "鼻音"; // m, n, ng
};

const codaPlace: Tagger = (p) => {
  const { coda } = parseRhyme(p);
  if (["w", "p", "m"].includes(coda)) return "唇音";
  if (["j", "t", "n"].includes(coda)) return "龈音";
  return "腭音"; // '', k, ng
};

const toneCategory: Tagger = (p) => {
  const s = p.endsWith("v") ? p.slice(0, -1) : p;
  if (/[ptk]$/.test(s)) return "入";
  if (s.endsWith("q")) return "上";
  if (s.endsWith("h")) return "去";
  return "平";
};

const toneRegister: Tagger = (p) => (p.endsWith("v") ? "阳" : "阴");

const she: Tagger = (p) => {
  const rest = getRest(p);
  const core = rest.replace(/[qhv]+$/, "");

  // 韵尾 j: yj/uj → 止摄（微韵）, 其他 → 蟹摄
  if (core.endsWith("j")) return /[yu]j$/.test(core) ? "止摄" : "蟹摄";
  // 韵尾 w: i/y 前 → 流摄, 其他 → 效摄
  if (core.endsWith("w")) return /[iy]w/.test(core) ? "流摄" : "效摄";

  // 韵尾 m/p: 咸摄(a/e/独立o韵腹) / 深摄(其他)
  if (core.endsWith("m") || core.endsWith("p")) {
    if (/eom|eop/.test(core)) return "深摄";
    return /[ae]/.test(core) ||
      (core.includes("o") && !core.includes("oy") && !core.includes("eo"))
      ? "咸摄"
      : "深摄";
  }

  // 韵尾 n/t: 山摄(a/e独立韵腹) / 臻摄(其他)
  if (core.endsWith("n") || core.endsWith("t"))
    return /[ae](?!o)/.test(core) ? "山摄" : "臻摄";

  // 韵尾 ng/k: 通/宕江/曾/梗
  if (core.endsWith("ng")) {
    const v = core.slice(0, -2);
    if (v === "u" || v === "ou" || v === "uo") return "通摄";
    if (v === "o") return "通摄";
    if (v === "oeu") return "宕江摄";
    if (/(i|y|u)ae/.test(v)) return "梗摄";
    if (v.endsWith("u") && !v.includes("a")) return "通摄";
    if (v.endsWith("a")) return "宕江摄";
    if (v === "ui" || v.includes("eo") || (v.includes("y") && !v.includes("e")))
      return "曾摄";
    return "梗摄";
  }
  if (core.endsWith("k")) {
    const v = core.slice(0, -1);
    if (v === "u" || v === "ou" || v === "uo") return "通摄";
    if (v === "o") return "通摄";
    if (v === "oeu") return "宕江摄";
    if (/(i|y|u)ae/.test(v)) return "梗摄";
    if (v.endsWith("u") && !v.includes("a")) return "通摄";
    if (v.endsWith("a")) return "宕江摄";
    if (v === "ui" || v.includes("eo") || (v.includes("y") && !v.includes("e")))
      return "曾摄";
    return "梗摄";
  }

  // 开尾韵
  if (core === "ou" || core.endsWith("u")) return "流摄";
  if (core === "oi" || core.endsWith("i")) return "止摄";
  if (core.endsWith("o")) return "遇摄";
  if (core.endsWith("a") || core.endsWith("ae")) return "果假摄";
  if (/(ie|ye|wie|ue)$/.test(core)) return "止摄";
  if (/(ee|e)$/.test(core)) return "蟹摄";

  return "止摄";
};

export const INITIAL_TAGGERS: TaggerDef[] = [
  {
    id: "place",
    name: "发音部位",
    category: "声母",
    tag: place,
    order: ["双唇", "齿龈", "龈腭", "卷舌", "软腭", "喉"],
  },
  {
    id: "manner",
    name: "发音方式",
    category: "声母",
    tag: manner,
    order: [
      "清不送气塞音",
      "清送气塞音",
      "浊塞音",
      "鼻音",
      "清不送气塞擦音",
      "清送气塞擦音",
      "浊塞擦音",
      "清擦音",
      "浊擦音",
      "近音",
      "边近音",
    ],
  },
  {
    id: "dengwei",
    name: "等位",
    category: "韵头",
    tag: dengwei,
    order: ["一等", "二等", "四等", "无重纽三等", "重纽三等", "重纽四等"],
  },
  {
    id: "kaihe",
    name: "开合",
    category: "韵头",
    tag: (p) => {
      const v = kaihe(p);
      return v === "开" ? "开口" : "合口";
    },
    order: ["开口", "合口"],
  },
  {
    id: "vowel_height",
    name: "元音高度",
    category: "韵腹",
    tag: (p) => {
      const rest = getRest(p);
      if (rest.includes("oy")) return "高元音";
      const { vowel } = parseMedialVowel(p);
      if (["i", "y", "u", "ou"].includes(vowel)) return "高元音";
      if (["ae", "a"].includes(vowel)) return "低元音";
      return "中元音";
    },
    order: ["高元音", "中元音", "低元音"],
  },
  {
    id: "coda_manner",
    name: "发音方式",
    category: "韵尾",
    tag: codaManner,
    order: ["近音", "塞音", "鼻音"],
  },
  {
    id: "coda_place",
    name: "发音部位",
    category: "韵尾",
    tag: codaPlace,
    order: ["唇音", "龈音", "腭音"],
  },
  {
    id: "she",
    name: "摄辙",
    category: "韵基",
    tag: she,
    order: [
      "流摄",
      "效摄",
      "遇摄",
      "止摄",
      "蟹摄",
      "果假摄",
      "咸摄",
      "深摄",
      "山摄",
      "臻摄",
      "曾摄",
      "梗摄",
      "通摄",
      "宕江摄",
    ],
  },
  {
    id: "tone_category",
    name: "平上去入",
    category: "声调",
    tag: toneCategory,
    order: ["平", "上", "去", "入"],
  },
  {
    id: "tone_register",
    name: "阴阳",
    category: "声调",
    tag: () => "阴阳",
    order: ["阴阳"],
  },
];
