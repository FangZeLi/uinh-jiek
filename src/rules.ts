import type { Rule, NamedRule } from "./types";
import { parseMedialVowel, getRest } from "./taggers";

// ============================================================
// 共享工具：中古音解析
// ============================================================

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
  "zj",
  "tj",
  "tsh",
  "dz",
  "ts",
  "ph",
  "th",
  "kh",
  "ng",
  "nj",
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
];

const MC_MEDIALS = ["wi", "w", "i", "y", "u"];
const MC_VOWELS = ["oeu", "ee", "eo", "ou", "ae", "i", "y", "u", "e", "o", "a"];
const MC_FINALS = ["ng", "j", "w", "m", "n", "p", "t", "k"];

function parseMC(s: string) {
  let rem = s;
  let init = "";
  for (const c of MC_INITIALS) {
    if (rem.startsWith(c)) {
      init = c;
      rem = rem.slice(c.length);
      break;
    }
  }
  if (!init) init = "∅";
  let med = "";
  for (const c of MC_MEDIALS) {
    if (rem.startsWith(c)) {
      const t = rem.slice(c.length);
      for (const v of MC_VOWELS) {
        if (t.startsWith(v)) {
          med = c;
          rem = t;
          break;
        }
      }
      if (med) break;
    }
  }
  if (!med) med = "∅";
  let vow = "";
  for (const c of MC_VOWELS) {
    if (rem.startsWith(c)) {
      vow = c;
      rem = rem.slice(c.length);
      break;
    }
  }
  let fin = "";
  for (const c of MC_FINALS) {
    if (rem.startsWith(c)) {
      fin = c;
      rem = rem.slice(c.length);
      break;
    }
  }
  if (!fin) fin = "∅";
  const tone = rem === "q" || rem === "h" ? rem : "∅";
  return { init, med, vow, fin, tone };
}

function isThirdC(s: string): boolean {
  const { med, vow } = parseMC(s);
  const HIGH = new Set(["i", "y", "u"]);
  const THIRD_MED = new Set(["i", "wi", "y", "u"]);
  if (!(HIGH.has(vow) || THIRD_MED.has(med))) return false;
  if (
    med === "i" ||
    med === "wi" ||
    (med === "w" && vow === "i") ||
    (med === "∅" && vow === "i")
  )
    return false;
  if (
    (med === "y" || med === "u") &&
    (vow === "i" || vow === "e" || vow === "ae")
  )
    return false;
  return true;
}

const YANG_VOICED = new Set([
  "b",
  "d",
  "dr",
  "g",
  "gh",
  "dz",
  "dj",
  "dzr",
  "z",
  "zj",
  "zr",
  "bv",
]);
const YANG_SONORANT = new Set([
  "m",
  "n",
  "nr",
  "ng",
  "l",
  "nj",
  "j",
  "mh",
  "∅",
]);

// ============================================================
//幽部豪肴与宵部豪肴合并
//    一等 ow → aw, 二等 eew → aew
// ============================================================

export const youXiaoMerge: Rule = (p) =>
  p.replace(/ow(?=[qh]?$)/, "aw").replace(/eew(?=[qh]?$)/, "aew");

// ============================================================
//支部齐并入脂祭部齐
//    四等 e → ej
//    排除三等 ie/wie/ye/ue、二等 ee/wee
// ============================================================

export const zhiToZhiJi: Rule = (p) =>
  p.replace(/we(?=[hq]?$)/, "wej").replace(/(?<![iwyuaeo])e(?=[hq]?$)/, "ej");

// ============================================================
//益石对立中和
//    入声: iek→iaek, wiek→wiaek, yek→yaek, uek→uaek
//    阳声: ieng→iaeng, wieng→wiaeng, yeng→yaeng, ueng→uaeng
// ============================================================

export const yiShiNeutralize: Rule = (p) =>
  p
    .replace(/wi(ek[qh]?)$/, "wia$1")
    .replace(/wi(eng[qh]?)$/, "wia$1")
    .replace(/(?<![w])i(ek[qh]?)$/, "ia$1")
    .replace(/(?<![w])i(eng[qh]?)$/, "ia$1")
    .replace(/y(ek[qh]?)$/, "ya$1")
    .replace(/y(eng[qh]?)$/, "ya$1")
    .replace(/u(ek[qh]?)$/, "ua$1")
    .replace(/u(eng[qh]?)$/, "ua$1");

// ============================================================
//之脂合并
//    之韵 y → i（仅之韵开口，无韵尾，排除 yj/yk/yn/yng/yt）
//    庄组后 y → yi
// ============================================================

export const zhiMainVowelMerge: Rule = (p) => {
  const zhuang = ["tsrh", "tsr", "dzr", "sr", "zr"];
  if (zhuang.some((c) => p.startsWith(c))) {
    return p.replace(/y(?=[qh]?$)/, "yi");
  }
  return p.replace(/y(?=[qh]?$)/, "i");
};

// ============================================================
//佳韵解体
//    ee → eej（仅无韵尾的 ee，排除 eek/eem/een/eeng/eet）
// ============================================================

export const jiaSplit: Rule = (p) => p.replace(/ee(?=[qh]?$)/, "eej");

// ============================================================
//二等重韵合并
//    ee → ae
// ============================================================

export const division2Merge: Rule = (p) => p.replace(/ee/g, "ae");

// ============================================================
//轻唇化启动
//    帮组 p ph b + 无重纽三等 → pf pfh bv
//    明母 m 不参与
// ============================================================

export const lightLip: Rule = (p) => {
  const init =
    [...MC_INITIALS]
      .sort((a, b) => b.length - a.length)
      .find((c) => p.startsWith(c)) || "";
  if (!["p", "ph", "b"].includes(init)) return p;
  if (!isThirdC(p)) return p;
  const map: Record<string, string> = { p: "pf", ph: "pfh", b: "bv" };
  return map[init] + p.slice(init.length);
};

// ============================================================
//东一冬合并
//    uong → ung, uok → uk, ong → oung, ok → ouk
// ============================================================

export const dongDongMerge: Rule = (p) =>
  p
    .replace(/uong(?=[qh]?$)/, "ung")
    .replace(/uok(?=[qh]?$)/, "uk")
    .replace(/(?<![e])ong(?=[qh]?$)/, "oung")
    .replace(/(?<![ueo])ok(?=[qh]?$)/, "ouk");

// ============================================================
//尤东三裂化
//    尤韵 u → yw, 东三 ung → yung, uk → yuk
//    唇音（帮非组）后不变
// ============================================================

export const youDongSplit: Rule = (p) => {
  const fei = ["pfh", "pf", "bv"];
  if (fei.some((c) => p.startsWith(c))) return p;
  return p
    .replace(/(?<![aeoiy])u(?=[qh]?$)/, "yw")
    .replace(/(?<![oe])ung/, "yung")
    .replace(/(?<![oe])uk/, "yuk");
};

// ============================================================
//一等重韵合并
//    覃 om→am /op→ap, 谈 am/ap 不变（排除 yom/uom 严凡）
//    咍 eoj→aj, 泰开口非唇音 aj→aj（不变）
//    泰合口→灰: 唇音+aj→oj, waj→oj, 灰 oj→oj（不变）
// ============================================================

export const div1Merge: Rule = (p) => {
  // 覃→谈
  p = p.replace(/(?<![yu])om(?=[qh]?$)/, "am");
  p = p.replace(/(?<![yu])op(?=[qh]?$)/, "ap");
  // 咍→泰开口
  p = p.replace(/eoj(?=[qh]?$)/, "aj");
  // 泰合口→灰
  p = p.replace(/waj(?=[qh]?$)/, "oj");
  // 唇音+泰→灰
  const labials = ["pfh", "pf", "bv", "p", "ph", "b", "m"];
  for (const l of labials) {
    if (p.startsWith(l) && p.slice(l.length).startsWith("aj")) {
      p = l + "oj" + p.slice(l.length + 2);
      break;
    }
  }
  return p;
};

// ============================================================
//阴阳分化
//     清声母 → 阴（不变）
//     全浊   → 阳（加 v）
//     次浊   → 平/去 阳(v)，上/入 阴（不变）
//     云母 ∅ 归次浊
// ============================================================

export const yinYangSplit: Rule = (p) => {
  const init =
    [...MC_INITIALS]
      .sort((a, b) => b.length - a.length)
      .find((c) => p.startsWith(c)) || "∅";
  const rest = p.slice(init === "∅" ? 0 : init.length);
  let tone: string;
  if (rest.endsWith("h")) tone = "h";
  else if (rest.endsWith("q")) tone = "q";
  else if (/[ptk]$/.test(rest)) tone = "enter";
  else tone = "level";
  if (YANG_VOICED.has(init)) return p + "v";
  if (YANG_SONORANT.has(init)) {
    if (tone === "level" || tone === "h") return p + "v";
  }
  return p;
};

// ============================================================
//支韵并入脂韵
//    wie → wi, ue → ui, ye → yi, ie → i
// ============================================================

export const zhiZhiMerge: Rule = (p) =>
  p
    .replace(/wie(?=[qh]?v?$)/, "wi")
    .replace(/ue(?=[qh]?v?$)/, "ui")
    .replace(/ye(?=[qh]?v?$)/, "yi")
    .replace(/(?<![w])ie(?=[qh]?v?$)/, "i");

// ============================================================
//精组止开变为一等
//    ts tsh dz s z + 止开 i → oi
// ============================================================

export const jingZhiOpen: Rule = (p) => {
  const jing = ["tsh", "ts", "dz", "s", "z"];
  const init = jing.find((c) => p.startsWith(c));
  if (!init) return p;
  const rest = p.slice(init.length);
  if (/^i[qh]?v?$/.test(rest)) return init + "o" + rest;
  return p;
};

// ============================================================
//全浊上去合并
//    qv → hv（阳上 → 阳去）
// ============================================================

export const voicedShangToQu: Rule = (p) => p.replace(/q(?=v$)/, "h");

// ============================================================
//常船、崇俟合并
//    zj → dj, zr → dzr
// ============================================================

export const changChuanMerge: Rule = (p) =>
  p.replace(/^zj/, "dj").replace(/^zr/, "dzr");

// ============================================================
//轻唇化完成
//    明母 m + u → mv
// ============================================================

export const lightLipComplete: Rule = (p) => {
  if (p.startsWith("m") && /^u/.test(p.slice(1))) return "mv" + p.slice(1);
  return p;
};

// ============================================================
//四等并入三A
//    四等 e → ie, we → wie
//    三A ie → ie, wie → wie（不变）
//    不论后接什么韵尾
// ============================================================

export const div3A4Merge: Rule = (p) =>
  p.replace(/we(?!e|i|o)/g, "wie").replace(/(?<![aeoiwyu])e(?![eo])/g, "ie");

// ============================================================
//清青合并
//    三四等: iaek→iek, wiaek→wiek, yaek→yek, uaek→uek
//            iaeng→ieng, wiaeng→wieng, yaeng→yeng, uaeng→ueng
//    二→四: aek→eek, waek→week, aeng→eeng, waeng→weeng
// ============================================================

export const qingQingMerge: Rule = (p) =>
  p
    .replace(/wiaek(?=[qh]?v?$)/, "wiek")
    .replace(/iaek(?=[qh]?v?$)/, "iek")
    .replace(/yaek(?=[qh]?v?$)/, "yek")
    .replace(/uaek(?=[qh]?v?$)/, "uek")
    .replace(/wiaeng(?=[qh]?v?$)/, "wieng")
    .replace(/iaeng(?=[qh]?v?$)/, "ieng")
    .replace(/yaeng(?=[qh]?v?$)/, "yeng")
    .replace(/uaeng(?=[qh]?v?$)/, "ueng")
    .replace(/waek(?=[qh]?v?$)/, "week")
    .replace(/waeng(?=[qh]?v?$)/, "weeng")
    .replace(/aek(?=[qh]?v?$)/, "eek")
    .replace(/aeng(?=[qh]?v?$)/, "eeng");

// ============================================================
//喉牙3C3B对立中和
//    yit→yt, yin→yn, uit→ut, uin→un, yiw→yw
//    yik→yk, yj→yi, yo→ye, ying→yng
//    uj→ui, uo→ue, uik→uk
// ============================================================

export const div3BCMerge: Rule = (p) =>
  p
    .replace(/yit(?=[qh]?v?$)/, "yt")
    .replace(/yin(?=[qh]?v?$)/, "yn")
    .replace(/yik(?=[qh]?v?$)/, "yk")
    .replace(/yj(?=[qh]?v?$)/, "yi")
    .replace(/yot(?=[qh]?v?$)/, "yet")
    .replace(/yon(?=[qh]?v?$)/, "yen")
    .replace(/yop(?=[qh]?v?$)/, "yep")
    .replace(/yom(?=[qh]?v?$)/, "yem")
    .replace(/yoj(?=[qh]?v?$)/, "yej")
    .replace(/ying(?=[qh]?v?$)/, "yng")
    .replace(/uit(?=[qh]?v?$)/, "ut")
    .replace(/uin(?=[qh]?v?$)/, "un")
    .replace(/uj(?=[qh]?v?$)/, "ui")
    .replace(/uot(?=[qh]?v?$)/, "uet")
    .replace(/uon(?=[qh]?v?$)/, "uen")
    .replace(/uoj(?=[qh]?v?$)/, "uej")
    .replace(/uom(?=[qh]?v?$)/, "uem")
    .replace(/uop(?=[qh]?v?$)/, "uep")
    .replace(/uik(?=[qh]?v?$)/, "uyk")
    .replace(/yiw(?=[qh]?v?$)/, "yw")
    // 深摄
    .replace(/oym(?=[qh]?v?$)/, "eom")
    .replace(/yim(?=[qh]?v?$)/, "ym")
    .replace(/yip(?=[qh]?v?$)/, "yp");

// ============================================================
// [OLD] 锐音三四等合并
//    a.精组 ts tsh dz s z 后: yak→iak, yo→io, uk→iuk, uo→wio...
//    b.章组 tj tjh dj sj nj 后: i→yi, ie→ye, iae→ya, wi→ui, wie→ue...
//    c.以母 j 后: 按精组变换韵母后删除 j（云以合流）
//    d.知组 tr trh dr nr 后: 按章组规则
// ============================================================

export const coronal34Merge: Rule = (p) => {
  const jing = ["tsh", "ts", "dz", "s", "z"];
  const jInit = jing.find(
    (c) =>
      p.startsWith(c) &&
      !(c === "s" && p[1] === "j") &&
      !(c === "z" && p[1] === "j"),
  );
  if (jInit) {
    const rest = p.slice(jInit.length);
    const m: Record<string, string> = {
      yak: "iak",
      yang: "iang",
      yiw: "iw",
      yk: "iyk",
      yng: "iyng",
      yo: "io",
      uk: "iuk",
      ung: "iung",
      uo: "wio",
    };
    for (const [from, to] of Object.entries(m)) {
      if (rest.startsWith(from)) return jInit + to + rest.slice(from.length);
    }
    return p;
  }

  const zhang = ["tjh", "tj", "dj", "sj", "nj"];
  const zInit = zhang.find((c) => p.startsWith(c));
  if (zInit) {
    const r = p.slice(zInit.length);
    if (r.startsWith("wie")) return zInit + "ue" + r.slice(3);
    if (r.startsWith("wia")) return zInit + "ua" + r.slice(3);
    if (r.startsWith("wi")) return zInit + "ui" + r.slice(2);
    if (r.startsWith("iae")) return zInit + "ya" + r.slice(3);
    if (r.startsWith("ie")) return zInit + "ye" + r.slice(2);
    if (r.startsWith("ia")) return zInit + "ya" + r.slice(2);
    if (r.startsWith("i")) return zInit + "yi" + r.slice(1);
    if (r.startsWith("ung")) return zInit + "yung" + r.slice(3);
    if (r.startsWith("uk")) return zInit + "yuk" + r.slice(2);
  }

  const zhi = ["trh", "tr", "dr", "nr"];
  const zhiInit = zhi.find((c) => p.startsWith(c));
  if (zhiInit) {
    const r = p.slice(zhiInit.length);
    if (r.startsWith("wie")) return zhiInit + "ue" + r.slice(3);
    if (r.startsWith("wia")) return zhiInit + "ua" + r.slice(3);
    if (r.startsWith("wi")) return zhiInit + "ui" + r.slice(2);
    if (r.startsWith("iae")) return zhiInit + "ya" + r.slice(3);
    if (r.startsWith("ie")) return zhiInit + "ye" + r.slice(2);
    if (r.startsWith("ia")) return zhiInit + "ya" + r.slice(2);
    if (r.startsWith("i")) return zhiInit + "yi" + r.slice(1);
    if (r.startsWith("ung")) return zhiInit + "yung" + r.slice(3);
    if (r.startsWith("uk")) return zhiInit + "yuk" + r.slice(2);
    return p;
  }

  if (p.startsWith("j")) {
    const rest = p.slice(1);
    const m: Record<string, string> = {
      yak: "iak",
      yang: "iang",
      yiw: "iw",
      yk: "iyk",
      yng: "iyng",
      yo: "io",
      uk: "iuk",
      ung: "iung",
      uo: "wio",
    };
    for (const [from, to] of Object.entries(m)) {
      if (rest.startsWith(from)) return to + rest.slice(from.length);
    }
    return rest;
  }

  return p;
};

// ============================================================
//三等由隐性特征变为显性特征
//    1. 庄三化二
//    2. 知四化三
//    3. 精三化四
//    4. 章四化三
//    5. 云以合流
//    6. 二等介音产生
//    7. 拼写调整
// ============================================================

export const hiddenToOvertNew: Rule = (p) => {
  let s = p;

  // 1. 庄三化二: 庄组后 y介音消失, u→w
  const zhuang = ["tsrh", "tsr", "dzr", "sr"];
  const zInit = zhuang.find((c) => s.startsWith(c));
  if (zInit) {
    const r = s.slice(zInit.length);
    if (r.startsWith("yw")) {
      s = zInit + "u" + r.slice(2);
    } else if (r.startsWith("yang")) {
      s = zInit + "aeng" + r.slice(4);
    } else if (r.startsWith("yak")) {
      s = zInit + "aek" + r.slice(3);
    } else if (r.startsWith("yeng")) {
      s = zInit + "eeng" + r.slice(4);
    } else if (r.startsWith("yek")) {
      s = zInit + "eek" + r.slice(3);
    } else if (r.startsWith("yej")) {
      s = zInit + "aej" + r.slice(3);
    } else if (r.startsWith("uej")) {
      s = zInit + "waej" + r.slice(3);
    } else if (r.startsWith("yem")) {
      s = zInit + "aem" + r.slice(3);
    } else if (r.startsWith("yen")) {
      s = zInit + "aen" + r.slice(3);
    } else if (r.startsWith("uen")) {
      s = zInit + "waen" + r.slice(3);
    } else if (r.startsWith("yep")) {
      s = zInit + "aep" + r.slice(3);
    } else if (r.startsWith("yet")) {
      s = zInit + "aet" + r.slice(3);
    } else if (r.startsWith("uet")) {
      s = zInit + "waet" + r.slice(3);
    } else if (r.startsWith("yung")) {
      s = zInit + "oung" + r.slice(4);
    } else if (r.startsWith("yuk")) {
      s = zInit + "ouk" + r.slice(3);
    } else if (r.startsWith("yo")) {
      s = zInit + "eo" + r.slice(2);
    } else if (r.startsWith("uo")) {
      s = zInit + "o" + r.slice(2);
    } else if (/^y[aei]/.test(r)) {
      s = zInit + r.slice(1);
    } else if (/^u[ei]/.test(r)) {
      s = zInit + "w" + r.slice(1);
    }
    const cr = s.slice(zInit.length);
    if (/^wi([hq]?v?)$/.test(cr)) {
      s = zInit + cr.replace(/^wi/, "woi");
    } else if (/^i([hq]?v?)$/.test(cr)) {
      s = zInit + cr.replace(/^i/, "oi");
    }
  }

  // 2. 知四化三: 知组四等并入三等
  const zhi = ["trh", "tr", "dr", "nr"];
  const zhiInit = zhi.find((c) => s.startsWith(c));
  if (zhiInit) {
    const r = s.slice(zhiInit.length);
    if (r.startsWith("wie")) s = zhiInit + "ue" + r.slice(3);
    else if (r.startsWith("wia")) s = zhiInit + "ua" + r.slice(3);
    else if (r.startsWith("wi")) s = zhiInit + "ui" + r.slice(2);
    else if (r.startsWith("iae")) s = zhiInit + "ya" + r.slice(3);
    else if (r.startsWith("ie")) s = zhiInit + "ye" + r.slice(2);
    else if (r.startsWith("ia")) s = zhiInit + "ya" + r.slice(2);
    else if (r.startsWith("i")) s = zhiInit + "yi" + r.slice(1);
    // else if (r.startsWith("ung")) s = zhiInit + "yung" + r.slice(3);
    // else if (r.startsWith("uk")) s = zhiInit + "yuk" + r.slice(2);
  }

  // 3. 精三化四: 精组三等 i 介音前移（排除庄组）
  const jing = ["tsh", "ts", "dz", "s", "z"];
  const jInit = jing.find(
    (c) =>
      s.startsWith(c) &&
      !["tsrh", "tsr", "dzr", "sr"].some((z) => s.startsWith(z)) &&
      !(c === "s" && s[1] === "j") &&
      !(c === "z" && s[1] === "j"),
  );
  if (jInit) {
    const r = s.slice(jInit.length);
    const m: Record<string, string> = {
      yak: "iak",
      yang: "iang",
      yw: "iw",
      yk: "iyk",
      yng: "iyng",
      yo: "io",
      yuk: "iuk",
      yung: "iung",
      uk: "wiuk",
      ung: "wiung",
      uo: "wio",
    };
    for (const [from, to] of Object.entries(m)) {
      if (r.startsWith(from)) {
        s = jInit + to + r.slice(from.length);
        break;
      }
    }
  }

  // 4. 章四化三: 章组四等并入三等（同知组规则）
  const zhang = ["tjh", "tj", "dj", "sj", "nj"];
  const zhangInit = zhang.find((c) => s.startsWith(c));
  if (zhangInit) {
    const r = s.slice(zhangInit.length);
    if (r.startsWith("wie")) s = zhangInit + "ue" + r.slice(3);
    else if (r.startsWith("wia")) s = zhangInit + "ua" + r.slice(3);
    else if (r.startsWith("wi")) s = zhangInit + "ui" + r.slice(2);
    else if (r.startsWith("iae")) s = zhangInit + "ya" + r.slice(3);
    else if (r.startsWith("ie")) s = zhangInit + "ye" + r.slice(2);
    else if (r.startsWith("ia")) s = zhangInit + "ya" + r.slice(2);
    else if (r.startsWith("i")) s = zhangInit + "yi" + r.slice(1);
    // else if (r.startsWith("ung")) s = zhangInit + "yung" + r.slice(3);
    // else if (r.startsWith("uk")) s = zhangInit + "yuk" + r.slice(2);
  }

  // 5. 云以合流: 以母 j 脱落，韵母按精组规则变换
  if (s.startsWith("j")) {
    const r = s.slice(1);
    if (r.startsWith("ye")) {
      s = "ie" + r.slice(2);
    } else {
      const m2: Record<string, string> = {
        yak: "iak",
        yang: "iang",
        yw: "iw",
        yk: "iyk",
        yng: "iyng",
        yo: "io",
        yuk: "iuk",
        yung: "iung",
        uk: "wiuk",
        ung: "wiung",
        uo: "wio",
      };
      let matched = false;
      for (const [from, to] of Object.entries(m2)) {
        if (r.startsWith(from)) {
          s = to + r.slice(from.length);
          matched = true;
          break;
        }
      }
      if (!matched) s = r;
    }
  }

  // 6. 拼写调整: 流摄 yw→yu, iw→iu
  s = s.replace(/yw/g, "yu").replace(/iw/g, "iu");
  // const labiodental = ["pfh", "pf", "bv", "mv"];
  // const ldInit = labiodental.find((c) => s.startsWith(c));
  // if (ldInit) {
  //   const r = s.slice(ldInit.length);
  //   const m: Record<string, string> = {
  //     uang: "ang",
  //     uak: "ak",
  //     uem: "em",
  //     uep: "ep",
  //     uen: "en",
  //     uet: "et",
  //     uo: "o",
  //     ua: "a",
  //   };
  //   for (const [from, to] of Object.entries(m)) {
  //     if (r.startsWith(from)) {
  //       s = ldInit + to + r.slice(from.length);
  //       break;
  //     }
  //   }
  // }

  return s;
};

// ============================================================
// [OLD] 三等从隐性特征变为显性特征
//    a.庄组二三等合并: y非主元音→删除, u非主元音→w
//    b.二等元音失去特殊性: iae→ia, ae→ra, ee→re, oeu→ro
//         庄知组: ae→a, ee→e, oeu→o
//    流摄: iw→iu, yiw→yu
// ============================================================

// export const hiddenToOvert: Rule = (p) => {
//   let s = p;

//   const zhuang = ["tsrh", "tsr", "dzr", "sr"];
//   const zInit = zhuang.find((c) => s.startsWith(c));
//   if (zInit) {
//     const r = s.slice(zInit.length);
//     if (
//       r.startsWith("ya") ||
//       r.startsWith("ye") ||
//       r.startsWith("yi") ||
//       r.startsWith("yo")
//     ) {
//       s = zInit + r.slice(1);
//     } else if (r.startsWith("ue") || r.startsWith("ui") || r.startsWith("uo")) {
//       s = zInit + "w" + r.slice(1);
//     }
//   }

//   const zhuangZhi = ["tsrh", "tsr", "dzr", "sr", "trh", "tr", "dr", "nr"];
//   const zzInit = zhuangZhi.find((c) => s.startsWith(c));
//   s = s.replace(/iae/g, "ia");
//   if (zzInit) {
//     s = s.replace(/ae/g, "a").replace(/ee/g, "e").replace(/oeu/g, "o");
//   } else {
//     s = s.replace(/ae/g, "ra").replace(/ee/g, "re").replace(/oeu/g, "ro");
//   }

//   s = s.replace(/yiw/g, "yu").replace(/iw/g, "iu");

//   return s;
// };

// ============================================================
//非敷合并
//    pf, pfh → f（唇齿清擦音）
//    bv → v（唇齿浊擦音）
// ============================================================

export const feiFuMerge: Rule = (p) => {
  if (p.startsWith("pfh")) return "f" + p.slice(3);
  if (p.startsWith("pf")) return "f" + p.slice(2);
  if (p.startsWith("bv")) return "v" + p.slice(2);
  return p;
};

// ============================================================
//曾梗合并
//    庄组: yng→eeng; yk→eek
//    三等: yeng→yng; yek→yk; ueng→uyng; uek→uyk
//    四等: ieng→iyng; iek→iyk; wieng→wiyng; wiek→wiyk
// ============================================================

export const zengGengMerge: Rule = (p) => {
  const sortedInits = [...MC_INITIALS].sort((a, b) => b.length - a.length);
  const init = sortedInits.find((c) => p.startsWith(c)) || "";
  const rest = p.slice(init.length);

  const zhuang = ["tsrh", "tsr", "dzr", "sr"];

  if (zhuang.includes(init)) {
    let r = rest;
    r = r.replace(/^yng/, "eeng").replace(/^yk/, "eek");
    return init + r;
  }

  let r = rest;
  r = r.replace(/^yeng/, "yng").replace(/^yek/, "yk");
  r = r.replace(/^ueng/, "uyng").replace(/^uek/, "uyk");
  r = r.replace(/^wieng/, "wiyng").replace(/^wiek/, "wiyk");
  r = r.replace(/^ieng/, "iyng").replace(/^iek/, "iyk");
  return init + r;
};

// ============================================================
//蟹摄三四等并入止摄
//    yej → yi; uej → ui; iej → i; wiej → wi
// ============================================================

export const xieToZhi: Rule = (p) =>
  p
    .replace(/wiej([hq]?v?)$/, "wi$1")
    .replace(/yej([hq]?v?)$/, "yi$1")
    .replace(/uej([hq]?v?)$/, "ui$1")
    .replace(/iej([hq]?v?)$/, "i$1");

// ============================================================
//流摄裂化
//    一等 ou → ow; 二等(庄组后) u → ow; 三等 yu → yow; 四等 iu → iow
// ============================================================

export const liuSplit: Rule = (p) => {
  if (["f", "v", "mv"].some((c) => p.startsWith(c))) return p;
  return p.replace(/ou([hq]?v?)$/, "ow$1").replace(/(?<!o)u([hq]?v?)$/, "ow$1");
};

// ============================================================
//遇摄高化
//    一等 o → ou; 二等(庄组) eo → y, o → u; 三等 yo → y, uo → u; 四等 io → iy, wio → wiu
// ============================================================

export const yuHigh: Rule = (p) => {
  const sortedInits = [...MC_INITIALS].sort((a, b) => b.length - a.length);
  const init = sortedInits.find((c) => p.startsWith(c)) || "";
  const zhuang = ["tsrh", "tsr", "dzr", "sr"];

  let s = p;
  s = s.replace(/wio([hq]?v?)$/, "wiu$1");
  s = s.replace(/io([hq]?v?)$/, "iy$1");
  s = s.replace(/uo([hq]?v?)$/, "u$1");
  s = s.replace(/yo([hq]?v?)$/, "y$1");
  if (zhuang.includes(init)) {
    s = s.replace(/eo([hq]?v?)$/, "y$1");
    s = s.replace(/o([hq]?v?)$/, "u$1");
  } else {
    s = s.replace(/o([hq]?v?)$/, "ou$1");
  }
  return s;
};

// ============================================================
//泥娘合并
//    nr → n
// ============================================================

export const nrToN: Rule = (p) => (p.startsWith("nr") ? "n" + p.slice(2) : p);

// ============================================================
//锐音三四等合并
//    端精章组(t th d n l ts tsh dz s z tj tjh dj sj nj)
//    y后接元音→y改i; yi→删y; ya→iae; y为主元音→前加i
//    u后接元音→u改wi; ui→w; ua→wiae; u为主元音→前加wi
// ============================================================

export const ruiYinMerge: Rule = (p) => {
  const ruiInits = [
    "tjh",
    "trh",
    "tsh",
    "tj",
    "tr",
    "ts",
    "th",
    "dr",
    "dz",
    "dj",
    "nr",
    "sj",
    "nj",
    "t",
    "d",
    "n",
    "l",
    "s",
    "z",
  ];
  const sortedInits = [...MC_INITIALS].sort((a, b) => b.length - a.length);
  const init = sortedInits.find((c) => p.startsWith(c)) || "";
  if (!ruiInits.includes(init)) return p;
  const rest = p.slice(init.length);
  let r = rest;

  // y 系
  if (r.startsWith("y")) {
    r = r.replace(/^ya([hq]?v?)$/, "iae$1"); // 歌三
    r = r.replace(/^yi/, "i"); // yi → 删 y
    // y + 辅音韵尾(ng/k/n/t/m/p) → iy + 辅音韵尾（y 为主元音）
    r = r.replace(/^y(?=[ngkntmp])/, "iy");
    // y + 元音 → i + 元音
    r = r.replace(/^y(?=[aeiou])/, "i");
    // y 单独（y 为主元音，无韵尾）
    r = r.replace(/^y([hq]?v?)$/, "iy$1");
  }

  // u 系
  if (r.startsWith("u")) {
    r = r.replace(/^ua([hq]?v?)$/, "wiae$1"); // 歌三
    r = r.replace(/^ui/, "wi"); // ui → w
    // u + 辅音韵尾(ng/k/n/t) → wiu + 辅音韵尾（u 为主元音）
    r = r.replace(/^u(?=[ngknt])/, "wiu");
    // u + 元音 → wi + 元音
    r = r.replace(/^u(?=[aeiou])/, "wi");
    // u 单独（u 为主元音，无韵尾）
    r = r.replace(/^u([hq]?v?)$/, "wiu$1");
  }

  return init + r;
};

// ============================================================
//宕江合并
//    oeung → aeng; 知庄组 tr trh dr tsr tsrh dzr sr 后 oeung → waeng
// ============================================================

export const dangJiangMerge: Rule = (p) => {
  if (!p.includes("oeu")) return p;
  const sortedInits = [...MC_INITIALS].sort((a, b) => b.length - a.length);
  const init = sortedInits.find((c) => p.startsWith(c)) || "";
  const zhuangZhi = ["trh", "tr", "dr", "tsrh", "tsr", "dzr", "sr"];
  if (zhuangZhi.includes(init)) {
    return p.replace(/oeung/g, "waeng").replace(/oeuk/g, "waek");
  }
  return p.replace(/oeung/g, "aeng").replace(/oeuk/g, "aek");
};

// ============================================================
//微日去鼻化
//    mv → wv（唇齿近音）; nj → r（卷舌近音）
// ============================================================

export const weiRiDenasal: Rule = (p) => {
  if (p.startsWith("mv")) return "wv" + p.slice(2);
  if (p.startsWith("nj")) return "r" + p.slice(2);
  return p;
};

// ============================================================
//部分外转一等高化
//    蟹摄一等合口 oj → weoj
//    山摄一等 wan → on, 唇音 an → on（入声同）
//    果摄一等 a → eo; wa → o
// ============================================================

export const waiZhuanHigh: Rule = (p) => {
  const sortedInits = [...MC_INITIALS].sort((a, b) => b.length - a.length);
  const init = sortedInits.find((c) => p.startsWith(c)) || "";
  let s = p;

  // 蟹一合
  s = s.replace(/oj([hq]?v?)$/, "ouj$1");

  // 臻摄魂没
  s = s.replace(/(?<!e)on([hq]?v?)$/, "oun$1");
  s = s.replace(/(?<!e)ot([hq]?v?)$/, "out$1");

  // 山一合
  s = s.replace(/wan([hq]?v?)$/, "on$1");
  s = s.replace(/wat([hq]?v?)$/, "ot$1");
  if (["p", "ph", "b", "m"].includes(init)) {
    s = s.replace(/an([hq]?v?)$/, "on$1");
    s = s.replace(/at([hq]?v?)$/, "ot$1");
  }

  // 果一（排除 ya/ua）
  s = s.replace(/wa([hq]?v?)$/, "o$1");
  s = s.replace(
    /(?<![ywu])a([hq]?v?)$/,
    ["p", "ph", "b", "m"].includes(init) ? "o$1" : "eo$1",
  );

  return s;
};

// ============================================================
//锐音蟹山咸摄开口一等并入二等
//    t th d n ts tsh dz s z l 后 aj→aej; an→aen; am→aem
// ============================================================

export const ruiDiv1To2: Rule = (p) => {
  const ruiInits = ["tsh", "th", "ts", "dz", "t", "d", "n", "l", "s", "z"];
  const sortedInits = [...MC_INITIALS].sort((a, b) => b.length - a.length);
  const init = sortedInits.find((c) => p.startsWith(c)) || "";
  if (!ruiInits.includes(init)) return p;
  return p
    .replace(/aj([hq]?v?)$/, "aej$1")
    .replace(/an([hq]?v?)$/, "aen$1")
    .replace(/at([hq]?v?)$/, "aet$1")
    .replace(/am([hq]?v?)$/, "aem$1")
    .replace(/ap([hq]?v?)$/, "aep$1");
};

// ============================================================
//音系重分析之二
//    唇齿音 f v wv 后 u 介音/主元音调整
// ============================================================

export const reanalysis2: Rule = (p) => {
  if (!["f", "v", "wv"].some((c) => p.startsWith(c))) return p;
  const sortedInits = [...MC_INITIALS].sort((a, b) => b.length - a.length);
  const init = sortedInits.find((c) => p.startsWith(c)) || "";
  const rest = p.slice(init.length);
  let r = rest;

  // 止蟹摄 ui → i
  r = r.replace(/^ui/, "i");
  // 山咸摄
  r = r.replace(/^uen/, "aen");
  r = r.replace(/^uem/, "aem");
  r = r.replace(/^uet/, "aet");
  r = r.replace(/^uep/, "aep");
  // 歌三
  r = r.replace(/^ua([hq]?v?)$/, "ou$1");
  // 其余
  r = r.replace(/^uang/, "ang");
  r = r.replace(/^uak/, "ouk");
  r = r.replace(/^ung/, "oung");
  r = r.replace(/^uk/, "ouk");
  r = r.replace(/^un/, "eon");
  r = r.replace(/^ut/, "eot");
  r = r.replace(/^u([hq]?v?)$/, "ou$1");

  return init + r;
};

// ============================================================
//鱼虞合并
//    iy/wiu → iu; y/u → yu; 庄组 y → u
// ============================================================

export const yuYuMerge: Rule = (p) => {
  const zhuang = ["tsr", "tsrh", "dzr", "sr"];
  const sortedInits = [...MC_INITIALS].sort((a, b) => b.length - a.length);
  const init = sortedInits.find((c) => p.startsWith(c)) || "";
  const rest = p.slice(init.length);
  let r = rest;
  // iy/wiu → iu
  r = r.replace(/^iy([hq]?v?)$/, "iu$1");
  r = r.replace(/^wiu([hq]?v?)$/, "iu$1");
  // 庄组 y/u → ou
  if (zhuang.includes(init)) {
    r = r.replace(/^y([hq]?v?)$/, "ou$1");
    r = r.replace(/^u([hq]?v?)$/, "ou$1");
  } else {
    r = r.replace(/^y([hq]?v?)$/, "yu$1");
    r = r.replace(/^u([hq]?v?)$/, "yu$1");
  }
  if (r === rest) return p;
  return init + r;
};

// ============================================================
//麻三高化
//    iae → ie; wiae → wie; ya → ye; ua → ue
// ============================================================

export const maSanHigh: Rule = (p) =>
  p
    .replace(/wiae([hq]?v?)$/, "wie$1")
    .replace(/iae([hq]?v?)$/, "ie$1")
    .replace(/ua([hq]?v?)$/, "ue$1")
    .replace(/ya([hq]?v?)$/, "ye$1");

// ============================================================
//深臻曾梗咸山摄入声舒化
//    深摄 ip→i; 臻摄 eot/weot→eo/o yt/ut→yi/ui it/wit→i/wi
//    曾梗摄 eok/weok→eoj/weoj eek/week→aej/waej yk/uyk→yi/ui iyk/wiyk→i/wi
//    咸摄 ap→eo aep→ae yep→ye iep→ie
//    山摄 at/ot→eo/o aet/waet→ae/wae yet/uet→ye/ue iet/wiet→ie/wie
//    阳入→阳平(留v) 次浊入→阴去(+h) 阴入→上声(+q)
// ============================================================

export const ruShengShuHua: Rule = (p) => {
  const hasV = p.endsWith("v");
  const base = hasV ? p.slice(0, -1) : p;

  const sortedInits = [...MC_INITIALS].sort((a, b) => b.length - a.length);
  const init = sortedInits.find((c) => p.startsWith(c)) || "";
  const zhuang = ["tsr", "tsrh", "dzr", "sr"];
  const isZhuang = zhuang.includes(init);

  let s = base;
  // 深摄
  s = s.replace(/eop$/, "ou");
  s = s.replace(/yp$/, isZhuang ? "oi" : "yi");
  s = s.replace(/ip$/, "i");
  // 臻摄
  s = s.replace(/out$/, "ou");
  s = s.replace(/eot$/, "ou");
  s = s.replace(/ut$/, isZhuang ? "woi" : "ui");
  s = s.replace(/yt$/, isZhuang ? "oi" : "yi");
  s = s.replace(/wit$/, "wi");
  s = s.replace(/it$/, "i");
  // 曾梗摄
  s = s.replace(/weok$/, "ouj");
  s = s.replace(/eok$/, "eoj");
  s = s.replace(/week$/, "weej");
  s = s.replace(/eek$/, "eej");
  s = s.replace(/wiyk$/, "wi");
  s = s.replace(/iyk$/, "i");
  s = s.replace(/uyk$/, isZhuang ? "wi" : "ui");
  s = s.replace(/yk$/, isZhuang ? "i" : "yi");
  // 咸摄
  s = s.replace(/aep$/, "ae");
  s = s.replace(/yep$/, "ye");
  s = s.replace(/iep$/, "ie");
  s = s.replace(/ap$/, "eo");
  // 山摄
  s = s.replace(/waet$/, "wae");
  s = s.replace(/aet$/, "ae");
  s = s.replace(/uet$/, "ue");
  s = s.replace(/yet$/, "ye");
  s = s.replace(/wiet$/, "wie");
  s = s.replace(/iet$/, "ie");
  s = s.replace(/ot$/, "o");
  s = s.replace(/at$/, "eo");

  if (s === base) return p;

  const ciZhuo = ["m", "wv", "n", "r", "ng", "", "l"];

  let tone: string;
  if (hasV) {
    tone = "v";
  } else if (ciZhuo.includes(init)) {
    tone = "h";
  } else {
    tone = "q";
  }

  return s + tone;
};

// ============================================================
//照组齐微部并入支思部
//    tj/tjh/dj/sj + i/wi → tsr/tsrh/dzr/sr
// ============================================================

export const zhaoZuZhiSiMerge: Rule = (p) => {
  const map: Record<string, string> = {
    tj: "tsr",
    tjh: "tsrh",
    dj: "dzr",
    sj: "sr",
  };
  const sortedInits = [...MC_INITIALS].sort((a, b) => b.length - a.length);
  const init = sortedInits.find((c) => p.startsWith(c)) || "";
  if (!(init in map)) return p;
  const rest = p.slice(init.length);
  const r = rest.replace(/^i([hq]?v?)$/, "oi$1");
  if (r !== rest) return map[init] + r;
  return p;
};

// ============================================================
//东三钟合并
//    ung/uk → yung/yuk; wiung/wiuk → iung/iuk
// ============================================================

export const dongSanZhongMerge: Rule = (p) => {
  const sortedInits = [...MC_INITIALS].sort((a, b) => b.length - a.length);
  const init = sortedInits.find((c) => p.startsWith(c)) || "";
  const zhangMap: Record<string, string> = { tj: "tsr", tjh: "tsrh", dj: "dzr", sj: "sr" };
  const rest = p.slice(init.length);
  let r = rest;

  // wiung/wiuk → iung/iuk
  r = r.replace(/^wiung([hq]?v?)$/, "iung$1");
  r = r.replace(/^wiuk([hq]?v?)$/, "iuk$1");

  // 裸 ung/uk → yung/yuk
  r = r.replace(/(?<![oiy])ung([hq]?v?)$/, "yung$1");
  r = r.replace(/(?<![oiy])uk([hq]?v?)$/, "yuk$1");

  // iung/yung → oung, iuk/yuk → ouk（除零声母）
  if (init !== "") {
    r = r.replace(/^(iung|yung)([hq]?v?)$/, "oung$2");
    r = r.replace(/^(iuk|yuk)([hq]?v?)$/, "ouk$2");
  }

  if (r === rest) return p;

  const newInit = zhangMap[init] || init;
  return newInit + r;
};

// ============================================================
//庄组支思部合口并入皆来部
//    庄组后 wi → waej
// ============================================================

export const zhuangZhiSiHeMerge: Rule = (p) => {
  const sortedInits = [...MC_INITIALS].sort((a, b) => b.length - a.length);
  const init = sortedInits.find((c) => p.startsWith(c)) || "";
  if (!["tsr", "tsrh", "dzr", "sr"].includes(init)) return p;
  const rest = p.slice(init.length);
  const r = rest.replace(/^woi([hq]?v?)$/, "waej$1");
  if (r === rest) return p;
  return init + r;
};

// ============================================================
//喉牙音二等开口并入四等
//    k/kh/g/ng 后 aew→iaw aej→iaj ae→ia aem→iam aen→ian eeng→iyng aeng→iang aek→iak
// ============================================================

export const jianZuKaiErXiYinHua: Rule = (p) => {
  const sortedInits = [...MC_INITIALS].sort((a, b) => b.length - a.length);
  const init = sortedInits.find((c) => p.startsWith(c)) || "";
  if (!["k", "kh", "g", "ng", "h", "gh"].includes(init)) return p;
  const rest = p.slice(init.length);
  let r = rest;
  r = r.replace(/^aew/, "iaw");
  r = r.replace(/^aej/, "iaj");
  r = r.replace(/^aem/, "iam");
  r = r.replace(/^aen/, "ian");
  r = r.replace(/^aeng/, "iang");
  r = r.replace(/^aek/, "iak");
  r = r.replace(/^ae/, "ia");
  r = r.replace(/^eeng/, "iyng");
  if (r === rest) return p;
  return init + r;
};

// ============================================================
//知照合并
//    tr/trh/dr 二等→tsr/tsrh/dzr 三等→tj/tjh/dj
// ============================================================

export const zhiZhaoMerge: Rule = (p) => {
  const sortedInits = [...MC_INITIALS].sort((a, b) => b.length - a.length);
  const init = sortedInits.find((c) => p.startsWith(c)) || "";
  if (!["tr", "trh", "dr"].includes(init)) return p;
  const rest = p.slice(init.length);
  const isThird = /^(i|wi)/.test(rest);
  const m: Record<string, string> = isThird
    ? { tr: "tj", trh: "tjh", dr: "dj" }
    : { tr: "tsr", trh: "tsrh", dr: "dzr" };
  return m[init] + rest;
};

// ============================================================
//疑喻合并
//    ng → ∅
// ============================================================

export const yiYuMerge: Rule = (p) => (p.startsWith("ng") ? p.slice(2) : p);

// ============================================================
//锐音歌戈部开合口合并
//    t/th/n/ts/tsh/s/l 后 eo → o
// ============================================================

export const ruiYinGeGeMerge: Rule = (p) => {
  const sortedInits = [...MC_INITIALS].sort((a, b) => b.length - a.length);
  const init = sortedInits.find((c) => p.startsWith(c)) || "";
  if (!["t", "th", "n", "ts", "tsh", "s", "l"].includes(init)) return p;
  const rest = p.slice(init.length);
  const r = rest.replace(/^eo([hq]?v?)$/, "o$1");
  if (r === rest) return p;
  return init + r;
};

// ============================================================
//通宕江摄入声舒化
//    通摄 ouk/uk/wiuk → 去k; 宕江摄 ak→aw 等
//    声调同上：阳入→阳平 次浊入→阴去 阴入→上声
// ============================================================

export const tongDangJiangRuShu: Rule = (p) => {
  const hasV = p.endsWith("v");
  const base = hasV ? p.slice(0, -1) : p;

  let s = base;
  // 宕江摄（开合不区分）
  s = s.replace(/wiak$/, "iaw");
  s = s.replace(/waek$/, "aew");
  s = s.replace(/wak$/, "aw");
  s = s.replace(/uak$/, "yaw");
  s = s.replace(/iak$/, "iaw");
  s = s.replace(/aek$/, "aew");
  s = s.replace(/yak$/, "yaw");
  s = s.replace(/ak$/, "aw");
  // 通摄
  s = s.replace(/wiuk$/, "wiu");
  s = s.replace(/ouk$/, "ou");
  s = s.replace(/uk$/, "u");

  if (s === base) return p;

  const sortedInits = [...MC_INITIALS].sort((a, b) => b.length - a.length);
  const init = sortedInits.find((c) => p.startsWith(c)) || "";
  const ciZhuo = ["m", "wv", "n", "r", "ng", "", "l"];

  let tone: string;
  if (hasV) {
    tone = "v";
  } else if (ciZhuo.includes(init)) {
    tone = "h";
  } else {
    tone = "q";
  }

  return s + tone;
};

// ============================================================
//齐微部三等非开口并入一等
//    ui/wi → weoj; p/ph/m后 yi → eoj; f/wv后 i → eoj
// ============================================================

export const qiWeiSanDengMerge: Rule = (p) => {
  const zhangMap: Record<string, string> = { tj: "tsr", tjh: "tsrh", dj: "dzr", sj: "sr" };
  const sortedInits = [...MC_INITIALS].sort((a, b) => b.length - a.length);
  const oldInit = sortedInits.find((c) => p.startsWith(c)) || "";
  const init = zhangMap[oldInit] || oldInit;
  const rest = p.slice(oldInit.length);
  let r = rest;
  r = r.replace(/^ui([hq]?v?)$/, "ouj$1");
  r = r.replace(/^wi([hq]?v?)$/, "ouj$1");
  if (["p", "ph", "m"].includes(init)) {
    r = r.replace(/^yi([hq]?v?)$/, "ouj$1");
  }
  if (["f", "wv"].includes(init)) {
    r = r.replace(/^i([hq]?v?)$/, "ouj$1");
  }
  if (r === rest) return p;
  return init + r;
};

// ============================================================
//帮组咸深摄变为山臻摄
//    p/ph/m/f/wv 后 -m → -n
// ============================================================

export const bangZuXianShenMerge: Rule = (p) => {
  const sortedInits = [...MC_INITIALS].sort((a, b) => b.length - a.length);
  const init = sortedInits.find((c) => p.startsWith(c)) || "";
  if (!["p", "ph", "m", "f", "wv"].includes(init)) return p;
  const rest = p.slice(init.length);
  let r = rest;
  r = r.replace(/m([hq]?v?)$/, "n$1");
  if (r === rest) return p;
  return init + r;
};

// ============================================================
//阴阳去合并
//    -hv → h
// ============================================================

export const yinYangQuMerge: Rule = (p) => p.replace(/hv$/, "h");

// ============================================================
//一二等合并
// ============================================================

export const yiErDengMerge: Rule = (p) => {
  const sortedInits = [...MC_INITIALS].sort((a, b) => b.length - a.length);
  const init = sortedInits.find((c) => p.startsWith(c)) || "";
  const rest = p.slice(init.length);
  let r = rest;

  // 庄组特殊
  if (["tsr", "tsrh", "sr"].includes(init)) {
    r = r.replace(/^ym([hq]?v?)$/, "eom$1");
    r = r.replace(/^yn([hq]?v?)$/, "eon$1");
    r = r.replace(/^yu([hq]?v?)$/, "ou$1");
    r = r.replace(/^yung/, "oung");
  }

  // 一般
  r = r.replace(/^aew/, "aw");
  r = r.replace(/^waej/, "waj");
  r = r.replace(/^aej/, "aj");
  r = r.replace(/^waen/, "wan");
  r = r.replace(/^aen/, "an");
  r = r.replace(/^waeng/, "wang");
  r = r.replace(/^aeng/, "ang");
  r = r.replace(/^wae/, "wa");
  r = r.replace(/^ae/, "a");
  r = r.replace(/^weeng/, "weong");
  r = r.replace(/^eeng/, "eong");
  r = r.replace(/^weej/, "wej");
  r = r.replace(/^eej/, "ej");
  r = r.replace(/^aem/, "am");

  if (r === rest) return p;
  return init + r;
};

// ============================================================
//钝音三四等合流
//    p/ph/m/k/kh/∅/q/h 后 三四等合并
// ============================================================

// ============================================================
//音系重分析之三
//    kaihe: 除歌戈部合口o/桓欢合口on外，w开头→合口，否则开口
// ============================================================

export const reanalysis3: Rule = (p) =>
  p.replace(/wiyng([hq]?v?)$/, "wing$1").replace(/iyng([hq]?v?)$/, "ing$1");

// ============================================================
//双唇鼻音韵尾并入齿龈鼻音
//    -m → -n
// ============================================================

export const mToN: Rule = (p) => p.replace(/m([hq]?v?)$/, "n$1");

// ============================================================
//尖团合并
//    ts/k→tj, tsh/kh→tjh, s/h→sj   (在 i/wi 前)
// ============================================================

export const jianTuanMerge: Rule = (p) => {
  const map: Record<string, string> = {
    ts: "tj", tsh: "tjh", s: "sj",
    k: "tj", kh: "tjh", h: "sj",
  };
  const sortedInits = [...MC_INITIALS].sort((a, b) => b.length - a.length);
  const init = sortedInits.find((c) => p.startsWith(c)) || "";
  if (!(init in map)) return p;
  const rest = p.slice(init.length);
  if (/^(i|wi)/.test(rest)) return map[init] + rest;
  return p;
};

// ============================================================
//音系重分析之四
// ============================================================

export const reanalysis4: Rule = (p) =>
  p
    .replace(/iu([hq]?v?)$/, "wi$1")
    .replace(/ouj([hq]?v?)$/, "weoj$1")
    .replace(/oun([hq]?v?)$/, "weon$1")
    .replace(/iung([hq]?v?)$/, "wiung$1")
    .replace(/oung([hq]?v?)$/, "wung$1")
    .replace(/ou([hq]?v?)$/, "wu$1");

// ============================================================
//中低元音韵基合并
// ============================================================

export const zhongDiYuanYinMerge: Rule = (p) => {
  let s = p;
  s = s.replace(/ian([hq]?v?)$/, "ien$1");
  s = s.replace(/wen([hq]?v?)$/, "wan$1");
  s = s.replace(/wej([hq]?v?)$/, "waj$1");
  s = s.replace(/ej([hq]?v?)$/, "aj$1");
  s = s.replace(/ew([hq]?v?)$/, "aw$1");
  s = s.replace(/iew([hq]?v?)$/, "iaw$1");
  s = s.replace(/iaj([hq]?v?)$/, "ie$1");
  s = s.replace(/we([hq]?v?)$/, "o$1");
  s = s.replace(/(?<!i)en([hq]?v?)$/, "an$1");
  s = s.replace(/(?<![iw])e([hq]?v?)$/, "eo$1");
  return s;
};

// ============================================================
//照组细音并入洪音
//    tj/tjh/sj/r 后 i→oi; iu→ou; in/win→eon/oun; ing→eong; 其余去i
// ============================================================

export const zhaoZuXiYinMerge: Rule = (p) => {
  const sortedInits = [...MC_INITIALS].sort((a, b) => b.length - a.length);
  const init = sortedInits.find((c) => p.startsWith(c)) || "";
  if (!["tj", "tjh", "sj", "r"].includes(init)) return p;
  const zhangMap2: Record<string, string> = { tj: "tsr", tjh: "tsrh", sj: "sr" };
  const newInit = zhangMap2[init] || init;
  const rest = p.slice(init.length);
  let r = rest;
  r = r.replace(/^ing([hq]?v?)$/, "eong$1");
  r = r.replace(/^win([hq]?v?)$/, "oun$1");
  r = r.replace(/^in([hq]?v?)$/, "eon$1");
  r = r.replace(/^iu([hq]?v?)$/, "ou$1");
  r = r.replace(/^i([hq]?v?)$/, "oi$1");
  r = r.replace(/^wi/, "w");
  r = r.replace(/^i/, "");
  // roi → er (after vowel changes)
  if (init === "r" && /^oi([hq]?v?)$/.test(r)) {
    return "er" + (r.match(/([hq]?v?)$/)![1] ?? "");
  }
  if (r === rest && newInit === init) return p;
  return newInit + r;
};

// ============================================================
//庚青合口并入东钟
//    weong → oung; wing → iung
// ============================================================

// ============================================================
//微喻合并
//    wv → ∅
// ============================================================

export const weiYuMerge: Rule = (p) => (p.startsWith("wv") ? p.slice(2) : p);

// ============================================================
//庚青合口并入东钟
// ============================================================

export const gengQingHeMerge: Rule = (p) => {
  let s = p;
  s = s.replace(/weong([hq]?v?)$/, "wung$1");
  s = s.replace(/wing([hq]?v?)$/, "iung$1");
  const sortedInits = [...MC_INITIALS].sort((a, b) => b.length - a.length);
  const init = sortedInits.find((c) => s.startsWith(c)) || "";
  if (["p", "ph", "m", "f"].includes(init)) {
    s = s.replace(/wung([hq]?v?)$/, "eong$1");
  }
  return s;
};

// ============================================================
//桓欢并入寒山
//    on → wan
// ============================================================

export const huanHuanMerge: Rule = (p) =>
  p.replace(/(?<!e)on([hq]?v?)$/, "wan$1");

// ============================================================
//钝音三四等合流
//    p/ph/m/k/kh/∅/q/h 后 三四等合并
// ============================================================

export const dunYinSanSiMerge: Rule = (p) => {
  const dunInits = ["p", "ph", "m", "k", "kh", "", "q", "h"];
  const sortedInits = [...MC_INITIALS].sort((a, b) => b.length - a.length);
  const init = sortedInits.find((c) => p.startsWith(c)) || "";
  if (!dunInits.includes(init)) return p;
  const rest = p.slice(init.length);
  let r = rest;

  // y- 开头
  if (r.startsWith("y")) {
    r = r.replace(/^yen/, "ien");
    r = r.replace(/^yew/, "iew");
    r = r.replace(/^yow/, "iow");
    r = r.replace(/^yem/, "iem");
    r = r.replace(/^yang/, "iang");
    r = r.replace(/^yaw/, "iaw");
    r = r.replace(/^yung/, "iung");
    r = r.replace(/^yuk/, "iuk");
    r = r.replace(/^yng/, "iyng");
    r = r.replace(/^yn/, "in");
    r = r.replace(/^ym/, "im");
    r = r.replace(/^yu([hq]?v?)$/, "iu$1");
    r = r.replace(/^ye/, "ie");
    r = r.replace(/^yi/, "i");
  }

  // u- 开头
  if (r.startsWith("u")) {
    r = r.replace(/^uen/, "wien");
    r = r.replace(/^uang/, "wang");
    r = r.replace(/^uyng/, "wiyng");
    r = r.replace(/^ung/, "oung");
    r = r.replace(/^un/, "win");
    r = r.replace(/^ue/, "wie");
    // 帮组 u → ou, 其他 → wiu
    if (["p", "ph", "m"].includes(init)) {
      r = r.replace(/^u([hq]?v?)$/, "ou$1");
    } else {
      r = r.replace(/^u([hq]?v?)$/, "wiu$1");
    }
  }

  if (r === rest) return p;
  return init + r;
};

// ============================================================
//清浊合并
//    b/d/g/dz/dzr: 平→ph/th/kh/tsh/tsrh 仄→p/t/k/ts/tsr
//    z→s v→f gh→h
// ============================================================

export const qingZhuoMerge: Rule = (p) => {
  const sortedInits = [...MC_INITIALS].sort((a, b) => b.length - a.length);
  const init = sortedInits.find((c) => p.startsWith(c)) || "";

  if (init === "q") return p.slice(1);
  if (init === "z") return "s" + p.slice(1);
  if (init === "v") return "f" + p.slice(1);
  if (init === "gh") return "h" + p.slice(2);

  const ping: Record<string, string> = {
    b: "ph",
    d: "th",
    dj: "tjh",
    g: "kh",
    dz: "tsh",
    dzr: "tsrh",
  };
  if (!(init in ping)) return p;

  const ze: Record<string, string> = {
    b: "p",
    d: "t",
    dj: "tj",
    g: "k",
    dz: "ts",
    dzr: "tsr",
  };
  const isZe = /[qhptk]v$/.test(p);

  return (isZe ? ze[init] : ping[init]) + p.slice(init.length);
};

// ---- 所有规则 ----
export const RULES: NamedRule[] = [
  {
    name: "幽部豪肴与宵部豪肴合并",
    stageGroup: "前《切韵》音系至《切韵》音系",
    apply: youXiaoMerge,
    taggerUpdate: (t) => t,
  },
  { name: "支部齐并入脂祭部齐", apply: zhiToZhiJi, taggerUpdate: (t) => t },
  {
    name: "益石对立中和",
    stageGroup: "《切韵》音系",
    apply: yiShiNeutralize,
    taggerUpdate: (t) => t,
  },
  {
    name: "之脂合并",
    stageGroup: "《切韵》音系至慧琳音系",
    apply: zhiMainVowelMerge,
    taggerUpdate: (t) => t,
  },
  { name: "佳韵解体", apply: jiaSplit, taggerUpdate: (t) => t },
  { name: "二等重韵合并", apply: division2Merge, taggerUpdate: (t) => t },
  {
    name: "轻唇化启动",
    apply: lightLip,
    taggerUpdate: (t) => {
      if (t.id === "place") {
        const orig = t.tag;
        return {
          ...t,
          order: ["双唇", "唇齿", "齿龈", "龈腭", "卷舌", "软腭", "喉"],
          tag: (p) => {
            if (p.startsWith("pf") || p.startsWith("bv")) return "唇齿";
            return orig(p);
          },
        };
      }
      if (t.id === "manner") {
        const orig = t.tag;
        return {
          ...t,
          tag: (p) => {
            if (p.startsWith("pfh")) return "清送气塞擦音";
            if (p.startsWith("pf")) return "清不送气塞擦音";
            if (p.startsWith("bv")) return "浊塞擦音";
            return orig(p);
          },
        };
      }
      return t;
    },
  },
  { name: "尤东三裂化", apply: youDongSplit, taggerUpdate: (t) => t },
  { name: "东一冬合并", apply: dongDongMerge, taggerUpdate: (t) => t },
  { name: "一等重韵合并", apply: div1Merge, taggerUpdate: (t) => t },
  {
    name: "阴阳分化",
    apply: yinYangSplit,
    taggerUpdate: (t) => {
      if (t.id === "tone_register")
        return {
          ...t,
          order: ["阴", "阳"],
          tag: (p) => (p.endsWith("v") ? "阳" : "阴"),
        };
      return t;
    },
  },
  { name: "支韵并入脂韵", apply: zhiZhiMerge, taggerUpdate: (t) => t },
  {
    name: "精组止开变为一等",
    apply: jingZhiOpen,
    taggerUpdate: (t) => {
      if (t.id === "vowel_height") {
        const orig = t.tag;
        return {
          ...t,
          tag: (p) => {
            const { vowel } = parseMedialVowel(p);
            return vowel === "oi" ? "高元音" : orig(p);
          },
        };
      }
      return t;
    },
  },
  { name: "全浊上去合并", apply: voicedShangToQu, taggerUpdate: (t) => t },
  { name: "常船、崇俟合并", apply: changChuanMerge, taggerUpdate: (t) => t },
  {
    name: "轻唇化完成",
    apply: lightLipComplete,
    taggerUpdate: (t) => {
      if (t.id === "place") {
        const orig = t.tag;
        return {
          ...t,
          tag: (p) => {
            if (p.startsWith("mv")) return "唇齿";
            return orig(p);
          },
        };
      }
      if (t.id === "manner") {
        const orig = t.tag;
        return {
          ...t,
          tag: (p) => {
            if (p.startsWith("mv")) return "鼻音";
            return orig(p);
          },
        };
      }
      return t;
    },
  },
  {
    name: "四等并入三A",
    apply: div3A4Merge,
    taggerUpdate: (t) => {
      if (t.id === "dengwei") {
        const orig = t.tag;
        return {
          ...t,
          order: ["一等", "二等", "四等", "无重纽三等", "重纽三等"],
          tag: (p) => {
            const v = orig(p);
            return v === "重纽四等" ? "四等" : v;
          },
        };
      }
      return t;
    },
  },
  { name: "清青合并", apply: qingQingMerge, taggerUpdate: (t) => t },
  {
    name: "喉牙3C3B对立中和",
    apply: div3BCMerge,
    taggerUpdate: (t) => {
      if (t.id === "dengwei") {
        const orig = t.tag;
        return {
          ...t,
          order: ["一等", "二等", "三等", "四等"],
          tag: (p) => {
            const v = orig(p);
            if (v === "重纽三等" || v === "无重纽三等") return "三等";
            return v;
          },
        };
      }
      return t;
    },
  },
  // { name: '锐音三四等合并', apply: coronal34Merge, taggerUpdate: t => t },
  // { name: '三等隐性→显性', apply: hiddenToOvert, taggerUpdate: t => t },
  {
    name: "音系重分析之一",
    stageGroup: "慧琳音系",
    apply: hiddenToOvertNew,
    taggerUpdate: (t) => {
      if (t.id === "dengwei") {
        return {
          ...t,
          order: ["一等", "二等", "三等", "四等"],
          tag: (p) => {
            const rest = getRest(p);
            let base: string;
            if (/^(wi|i)/.test(rest)) base = "四等";
            else if (/^(y|u)/.test(rest)) base = "三等";
            else {
              const { vowel } = parseMedialVowel(p);
              base = ["ae", "ee", "oeu"].includes(vowel) ? "二等" : "一等";
            }

            const zhuang = ["tsrh", "tsr", "dzr", "sr"];
            const init = zhuang
              .sort((a, b) => b.length - a.length)
              .find((c) => p.startsWith(c));
            if (!init) return base;
            if (
              zhuang.includes(init) &&
              (base === "一等" || base === "三等" || base === "四等")
            )
              return "二等";
            return base;
          },
        };
      }
      if (t.id === "kaihe") {
        // 庄组三等看作二等后，u→w 介音转换已在 step 1 处理，kaihe 无需额外调整
        return t;
      }
      if (t.id === "she") {
        const orig = t.tag;
        return {
          ...t,
          tag: (p) => {
            const core = getRest(p).replace(/[qhv]+$/, "");
            const v = core.endsWith("ng")
              ? core.slice(0, -2)
              : core.endsWith("k")
                ? core.slice(0, -1)
                : "";
            if (v === "ae" || v === "wae") return "宕江摄";
            return orig(p);
          },
        };
      }
      return t;
    },
  },
  {
    name: "非敷合并",
    stageGroup: "慧琳音系至《声音唱和图》音系",
    apply: feiFuMerge,
    taggerUpdate: (t) => {
      if (t.id === "place") {
        const orig = t.tag;
        return {
          ...t,
          tag: (p) => {
            if (p.startsWith("f") || p.startsWith("v")) return "唇齿";
            return orig(p);
          },
        };
      }
      if (t.id === "manner") {
        const orig = t.tag;
        return {
          ...t,
          tag: (p) => {
            if (p.startsWith("f")) return "清擦音";
            if (p.startsWith("v")) return "浊擦音";
            return orig(p);
          },
        };
      }
      return t;
    },
  },
  {
    name: "曾梗合并",
    apply: zengGengMerge,
    taggerUpdate: (t) => {
      if (t.id === "she") {
        const orig = t.tag;
        return {
          ...t,
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
            "曾梗摄",
            "通摄",
            "宕江摄",
          ],
          tag: (p) => {
            const v = orig(p);
            return v === "曾摄" || v === "梗摄" ? "曾梗摄" : v;
          },
        };
      }
      return t;
    },
  },
  {
    name: "蟹摄三四等并入止摄",
    apply: xieToZhi,
    taggerUpdate: (t) => t,
  },
  {
    name: "流摄裂化",
    apply: liuSplit,
    taggerUpdate: (t) => {
      if (t.id === "she") {
        const orig = t.tag;
        return {
          ...t,
          tag: (p) => {
            const core = getRest(p).replace(/[qhv]+$/, "");
            if (core.endsWith("w"))
              return /[ioy]w$/.test(core) ? "流摄" : "效摄";
            return orig(p);
          },
        };
      }
      return t;
    },
  },
  {
    name: "遇摄高化",
    apply: yuHigh,
    taggerUpdate: (t) => {
      if (t.id === "she") {
        const orig = t.tag;
        return {
          ...t,
          order: t.order.map((v: string) =>
            v === "流摄" ? "尤侯" : v === "遇摄" ? "鱼模" : v,
          ),
          tag: (p) => {
            const core = getRest(p).replace(/[qhv]+$/, "");
            const raw =
              core.endsWith("u") || core.endsWith("y") ? "遇摄" : orig(p);
            return raw === "流摄" ? "尤侯" : raw === "遇摄" ? "鱼模" : raw;
          },
        };
      }
      return t;
    },
  },
  {
    name: "泥娘合并",
    apply: nrToN,
    taggerUpdate: (t) => t,
  },
  {
    name: "锐音三四等合并",
    apply: ruiYinMerge,
    taggerUpdate: (t) => t,
  },
  {
    name: "微日去鼻化",
    apply: weiRiDenasal,
    taggerUpdate: (t) => {
      if (t.id === "place") {
        const orig = t.tag;
        return {
          ...t,
          tag: (p) => {
            if (p.startsWith("wv")) return "唇齿";
            if (p.startsWith("r")) return "卷舌";
            return orig(p);
          },
        };
      }
      if (t.id === "manner") {
        const orig = t.tag;
        return {
          ...t,
          tag: (p) => {
            if (p.startsWith("wv") || p.startsWith("r")) return "近音";
            return orig(p);
          },
        };
      }
      return t;
    },
  },
  {
    name: "部分外转一等高化",
    apply: waiZhuanHigh,
    taggerUpdate: (t) => {
      if (t.id === "she") {
        const orig = t.tag;
        return {
          ...t,
          order: [
            "尤侯",
            "效摄",
            "鱼模",
            "齐微",
            "支思",
            "皆来",
            "歌戈",
            "果假摄",
            "咸摄",
            "深摄",
            "山摄",
            "臻摄",
            "曾梗摄",
            "通摄",
            "宕江摄",
          ],
          tag: (p) => {
            const v = orig(p);
            if (v === "止摄") {
              const core = getRest(p).replace(/[qhv]+$/, "");
              if (core === "oi" || core === "woi") return "支思";
              return "齐微";
            }
            if (v === "蟹摄") {
              const core = getRest(p).replace(/[qhv]+$/, "");
              if (core === "ouj") return "齐微";
              return "皆来";
            }
            // 果一高化后归入歌戈
            if (v === "鱼模") {
              const core = getRest(p).replace(/[qhv]+$/, "");
              if (core === "eo" || core === "o") return "歌戈";
            }
            // 山一合 on/ot 保持山摄
            if (v === "臻摄") {
              const core = getRest(p).replace(/[qhv]+$/, "");
              if (/^(on|ot)$/.test(core)) return "山摄";
            }
            return v;
          },
        };
      }
      return t;
    },
  },
  {
    name: "锐音蟹山咸摄开口一等并入二等",
    apply: ruiDiv1To2,
    taggerUpdate: (t) => t,
  },
  {
    name: "音系重分析之二",
    stageGroup: "《声音唱和图》音系",
    apply: reanalysis2,
    taggerUpdate: (t) => {
      if (t.id === "dengwei") {
        const ruiInits = [
          "tjh",
          "tsh",
          "trh",
          "tj",
          "tsr",
          "ts",
          "th",
          "dr",
          "dz",
          "dj",
          "sj",
          "nj",
          "nr",
          "tr",
          "t",
          "d",
          "n",
          "l",
          "s",
          "z",
          "r",
        ];
        const orig = t.tag;
        return {
          ...t,
          tag: (p) => {
            const v = orig(p);
            if (v !== "四等") return v;
            const sortedInits = [...MC_INITIALS].sort(
              (a, b) => b.length - a.length,
            );
            const init = sortedInits.find((c) => p.startsWith(c)) || "";
            return ruiInits.includes(init) ? "三等" : v;
          },
        };
      }
      return t;
    },
  },
  {
    name: "鱼虞合并",
    stageGroup: "《声音唱和图》音系至《蒙古字韵》音系",
    apply: yuYuMerge,
    taggerUpdate: (t) => t,
  },
  {
    name: "宕江合并",
    apply: dangJiangMerge,
    taggerUpdate: (t) => t,
  },
  {
    name: "麻三高化",
    apply: maSanHigh,
    taggerUpdate: (t) => {
      if (t.id === "she") {
        const orig = t.tag;
        return {
          ...t,
          order: [
            "尤侯",
            "效摄",
            "鱼模",
            "齐微",
            "支思",
            "皆来",
            "车遮",
            "歌戈",
            "家麻",
            "咸摄",
            "深摄",
            "山摄",
            "臻摄",
            "曾梗摄",
            "通摄",
            "宕江摄",
          ],
          tag: (p) => {
            const core = getRest(p).replace(/[qhv]+$/, "");
            if (["ie", "wie", "ye", "ue", "e", "we"].includes(core)) return "车遮";
            const v = orig(p);
            return v === "果假摄" ? "家麻" : v;
          },
        };
      }
      return t;
    },
  },
  {
    name: "深臻曾梗咸山摄入声舒化",
    apply: ruShengShuHua,
    taggerUpdate: (t) => {
      if (t.id === "she") {
        const orig = t.tag;
        return {
          ...t,
          order: (() => {
            const ord: string[] = [];
            for (const v of t.order) {
              if (v === "深摄") ord.push("侵寻");
              else if (v === "臻摄") ord.push("真文");
              else if (v === "咸摄") ord.push("监咸", "廉纤");
              else if (v === "山摄") ord.push("寒山", "桓欢", "先天");
              else if (v === "皆来") ord.push("皆来甲", "皆来乙");
              else ord.push(v);
            }
            return ord;
          })(),
          tag: (p) => {
            const v = orig(p);
            if (v === "深摄") return "侵寻";
            if (v === "臻摄") return "真文";
            if (v === "咸摄") {
              const core = getRest(p).replace(/[qhv]+$/, "");
              return core.endsWith("am") || core.endsWith("aem")
                ? "监咸"
                : "廉纤";
            }
            if (v === "山摄") {
              const core = getRest(p).replace(/[qhv]+$/, "");
              if (core.endsWith("on")) return "桓欢";
              if (core.endsWith("aen")) return "寒山";
              if (core.endsWith("en")) return "先天";
              return "寒山";
            }
            if (v === "皆来") {
              const core = getRest(p).replace(/[qhv]+$/, "");
              if (core.endsWith("eoj") || core.endsWith("ouj")) return "齐微";
              return core === "ej" || core === "wej"
                || core === "eej" || core === "weej"
                ? "皆来乙"
                : "皆来甲";
            }
            return v;
          },
        };
      }
      return t;
    },
  },
  {
    name: "照组齐微开口进入支思",
    apply: zhaoZuZhiSiMerge,
    taggerUpdate: (t) => t,
  },
  {
    name: "东三钟合并",
    apply: dongSanZhongMerge,
    taggerUpdate: (t) => t,
  },
  {
    name: "庄组支思合口并入皆来",
    apply: zhuangZhiSiHeMerge,
    taggerUpdate: (t) => t,
  },
  {
    name: "喉牙音二等开口并入四等",
    apply: jianZuKaiErXiYinHua,
    taggerUpdate: (t) => {
      if (t.id === "she") {
        const orig = t.tag;
        return {
          ...t,
          order: t.order.flatMap((v: string) =>
            v === "效摄" ? ["萧豪甲", "萧豪乙"] : [v],
          ),
          tag: (p) => {
            const v = orig(p);
            if (v === "效摄") {
              const core = getRest(p).replace(/[qhv]+$/, "");
              return core.endsWith("aew") || !core.endsWith("ew")
                ? "萧豪甲"
                : "萧豪乙";
            }
            return v;
          },
        };
      }
      return t;
    },
  },
  {
    name: "知照合并",
    stageGroup: "《蒙古字韵》音系",
    apply: zhiZhaoMerge,
    taggerUpdate: (t) => t,
  },
  {
    name: "清浊合并",
    stageGroup: "《蒙古字韵》音系至《中原音韵》音系",
    apply: qingZhuoMerge,
    taggerUpdate: (t) => t,
  },
  {
    name: "疑喻合并",
    apply: yiYuMerge,
    taggerUpdate: (t) => t,
  },
  {
    name: "锐音歌戈开合口合并",
    apply: ruiYinGeGeMerge,
    taggerUpdate: (t) => t,
  },
  {
    name: "通宕江摄入声舒化",
    apply: tongDangJiangRuShu,
    taggerUpdate: (t) => {
      if (t.id === "she") {
        const orig = t.tag;
        return {
          ...t,
          order: t.order.map((v: string) =>
            v === "曾梗摄"
              ? "庚青"
              : v === "通摄"
                ? "东钟"
                : v === "宕江摄"
                  ? "江阳"
                  : v,
          ),
          tag: (p) => {
            const v = orig(p);
            return v === "曾梗摄"
              ? "庚青"
              : v === "通摄"
                ? "东钟"
                : v === "宕江摄"
                  ? "江阳"
                  : v;
          },
        };
      }
      return t;
    },
  },
  {
    name: "齐微三等非开口并入一等",
    apply: qiWeiSanDengMerge,
    taggerUpdate: (t) => t,
  },
  {
    name: "帮组咸深摄变为山臻摄",
    apply: bangZuXianShenMerge,
    taggerUpdate: (t) => t,
  },
  {
    name: "阴阳去合并",
    apply: yinYangQuMerge,
    taggerUpdate: (t) => t,
  },
  {
    name: "一二等合并",
    apply: yiErDengMerge,
    taggerUpdate: (t) => {
      if (t.id === "dengwei") {
        const orig = t.tag;
        return {
          ...t,
          order: [
            "洪音",
            ...t.order.filter((v: string) => v !== "一等" && v !== "二等"),
          ],
          tag: (p) => {
            const v = orig(p);
            return v === "一等" || v === "二等" ? "洪音" : v;
          },
        };
      }
      return t;
    },
  },
  {
    name: "钝音三四等合流",
    apply: dunYinSanSiMerge,
    taggerUpdate: (t) => {
      if (t.id === "dengwei") {
        const orig = t.tag;
        return {
          ...t,
          order: ["洪音", "细音"],
          tag: (p) => {
            const v = orig(p);
            return v === "洪音" ? "洪音" : "细音";
          },
        };
      }
      return t;
    },
  },
  {
    name: "音系重分析之三",
    stageGroup: "《中原音韵》音系",
    apply: reanalysis3,
    taggerUpdate: (t) => {
      if (t.id === "kaihe") {
        return {
          ...t,
          tag: (p) => {
            const core = getRest(p).replace(/[qhv]+$/, "");
            if (/^(o|on|oun|ouj)$/.test(core)) return "合口";
            return /^w/.test(getRest(p)) ? "合口" : "开口";
          },
        };
      }
      return t;
    },
  },
  {
    name: "双唇鼻音韵尾并入齿龈鼻音",
    stageGroup: "《中原音韵》音系至《西儒耳目资》音系",
    apply: mToN,
    taggerUpdate: (t) => t,
  },
  {
    name: "桓欢并入寒山",
    apply: huanHuanMerge,
    taggerUpdate: (t) => t,
  },
  {
    name: "照组细音并入洪音",
    apply: zhaoZuXiYinMerge,
    taggerUpdate: (t) => {
      if (t.id === "she") {
        const orig = t.tag;
        return {
          ...t,
          order: [...t.order, "尔儿"],
          tag: (p) => {
            const core = getRest(p).replace(/[qhv]+$/, "");
            if (core === "er") return "尔儿";
            return orig(p);
          },
        };
      }
      return t;
    },
  },
  {
    name: "音系重分析之四",
    stageGroup: "《西儒耳目资》音系",
    apply: reanalysis4,
    taggerUpdate: (t) => {
      if (t.id === "she") {
        const orig = t.tag;
        return {
          ...t,
          order: (() => {
            const ord: string[] = [];
            for (const v of t.order) {
              if (v === "鱼模") ord.push("姑苏辙");
              else if (v === "真文") ord.push("人辰辙");
              else if (v === "江阳") ord.push("江阳辙");
              else if (v === "尤侯") ord.push("由求辙");
              else if (v === "家麻") ord.push("发花辙");
              else if (v === "支思") { ord.push("支思"); ord.push("一七辙"); }
              else if (v === "齐微") { ord.push("齐微"); ord.push("灰堆辙"); }
              else ord.push(v);
            }
            return ord;
          })(),
          tag: (p) => {
            const v = orig(p);
            const core = getRest(p).replace(/[qhv]+$/, "");
            if (v === "支思" && core === "oi") return "一七辙";
            if (v === "齐微") {
              if (core === "i" || core === "wi") return "一七辙";
              if (core === "eoj" || core === "weoj") return "灰堆辙";
            }
            if (v === "鱼模") {
              if (core === "wi") return "一七辙";
              return "姑苏辙";
            }
            if (v === "尤侯") return "由求辙";
            if (v === "家麻") return "发花辙";
            if (v === "真文") return "人辰辙";
            if (v === "江阳") return "江阳辙";
            return v;
          },
        };
      }
      return t;
    },
  },
  {
    name: "微喻合并",
    stageGroup: "《西儒耳目资》音系至北京官话音系",
    apply: weiYuMerge,
    taggerUpdate: (t) => t,
  },
  {
    name: "庚青合口并入东钟",
    apply: gengQingHeMerge,
    taggerUpdate: (t) => {
      if (t.id === "she") {
        const orig = t.tag;
        return {
          ...t,
          order: (() => {
            const ord: string[] = [];
            for (const v of t.order) {
              if (v === "庚青" || v === "东钟") {
                if (!ord.includes("中东辙")) ord.push("中东辙");
              } else {
                ord.push(v);
              }
            }
            return ord;
          })(),
          tag: (p) => {
            const v = orig(p);
            return v === "庚青" || v === "东钟" ? "中东辙" : v;
          },
        };
      }
      return t;
    },
  },
  {
    name: "中低元音韵基合并",
    apply: zhongDiYuanYinMerge,
    taggerUpdate: (t) => {
      if (t.id === "she") {
        const orig = t.tag;
        const rename: Record<string, string> = {
          萧豪甲: "遥条辙",
          皆来甲: "怀来辙",
          车遮: "乜斜辙",
          歌戈: "梭波辙",
        };
        return {
          ...t,
          order: (() => {
            const ord: string[] = [];
            for (const v of t.order) {
              if (v === "寒山" || v === "先天") {
                if (!ord.includes("言前辙")) ord.push("言前辙");
              } else {
                ord.push(rename[v] ?? v);
              }
            }
            return ord;
          })(),
          tag: (p) => {
            const v = orig(p);
            if (v === "寒山" || v === "先天") return "言前辙";
            return rename[v] ?? v;
          },
        };
      }
      return t;
    },
  },
  {
    name: "尖团合并",
    stageGroup: "北京官话音系",
    apply: jianTuanMerge,
    taggerUpdate: (t) => t,
  },
];
