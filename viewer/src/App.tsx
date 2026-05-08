import {
  useState,
  useEffect,
  useCallback,
  useRef,
  useLayoutEffect,
  useMemo,
} from "react";

interface TaggerDef {
  id: string;
  name: string;
  category: string;
  order: string[];
}
interface StageMeta {
  index: number;
  name: string;
  stageGroup: string;
  ruleName: string;
  count: number;
  taggers: TaggerDef[];
}
interface MatrixData {
  name: string;
  count: number;
  taggers: TaggerDef[];
  rows: { key: string; labels: string[] }[];
  cols: { key: string; labels: string[] }[];
  colHeaders: { label: string; span: number }[][];
  rowLabels: { label: string; rowSpan: number }[][];
  cells: {
    rowIdx: number;
    colIdx: number;
    count: number;
    charCount: number;
    syllables: { pron: string; chars: string[] }[];
  }[];
}

export default function App() {
  const [stages, setStages] = useState<StageMeta[]>([]);
  const [stageIdx, setStageIdx] = useState(0);
  const [rowIds, setRowIds] = useState<string[]>([]);
  const [colIds, setColIds] = useState<string[]>([]);
  const [matrix, setMatrix] = useState<MatrixData | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [stickyLefts, setStickyLefts] = useState<number[]>([0]);
  const tbodyRef = useRef<HTMLTableSectionElement>(null);
  const [filters, setFilters] = useState<Record<string, Set<string>>>({});
  const [filterOpen, setFilterOpen] = useState<string | null>(null);
  const [addOpenSide, setAddOpenSide] = useState<"row" | "col" | null>(null);
  const [queryChar, setQueryChar] = useState("");
  const [queryResult, setQueryResult] = useState<{
    char: string;
    pron: string;
    rowLabels: string[];
    colLabels: string[];
  } | null>(null);
  const [aboutOpen, setAboutOpen] = useState(false);
  const [queryNotFound, setQueryNotFound] = useState(false);
  const [queryMulti, setQueryMulti] = useState<{
    char: string;
    items: {
      pron: string;
      cellKey: string;
      rowLabels: string[];
      colLabels: string[];
    }[];
  } | null>(null);
  const [traceData, setTraceData] = useState<{
    traces: {
      char: string;
      stages: { stage: number; pron: string; rule?: string }[];
    }[];
    ruleNames: string[];
  } | null>(null);
  const [tracePron, setTracePron] = useState("");

  useLayoutEffect(() => {
    if (!matrix || !tbodyRef.current) return;
    const tds = tbodyRef.current
      .querySelector("tr")
      ?.querySelectorAll<HTMLTableCellElement>("td");
    if (!tds || tds.length === 0) return;
    const lefts = [0];
    let cum = 0;
    for (const td of tds) {
      if (!td.hasAttribute("data-rl")) break;
      cum += td.getBoundingClientRect().width;
      lefts.push(cum);
    }
    setStickyLefts(lefts);
  }, [matrix]);

  useEffect(() => {
    fetch("/api/stages")
      .then((r) => r.json())
      .then(setStages);
  }, []);

  useEffect(() => {
    if (!dragging) return;
    const prevent = (e: DragEvent) => e.preventDefault();
    document.addEventListener("dragover", prevent);
    document.addEventListener("drop", prevent);
    return () => {
      document.removeEventListener("dragover", prevent);
      document.removeEventListener("drop", prevent);
    };
  }, [dragging]);

  const fetchMatrix = useCallback(
    async (
      idx: number,
      rows: string[],
      cols: string[],
      flt?: Record<string, Set<string>>,
    ) => {
      setLoading(true);
      const f: Record<string, string[]> = {};
      if (flt)
        for (const [k, v] of Object.entries(flt)) if (v.size > 0) f[k] = [...v];
      const res = await fetch("/api/matrix", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          stageIdx: idx,
          rowTaggers: rows,
          colTaggers: cols,
          filters: f,
        }),
      });
      setMatrix(await res.json());
      setLoading(false);
    },
    [],
  );

  useEffect(() => {
    setSelected(null);
    setQueryResult(null);
    setQueryMulti(null);
    setQueryNotFound(false);
    setTraceData(null);
    setTracePron("");
  }, [rowIds, colIds]);
  useEffect(() => {
    setSelected(null);
    setQueryResult(null);
    setQueryMulti(null);
    setQueryNotFound(false);
    setTraceData(null);
    setTracePron("");
  }, [stageIdx]);
  useEffect(() => {
    fetchMatrix(stageIdx, rowIds, colIds, filters);
  }, [stageIdx, rowIds, colIds, filters, fetchMatrix]);

  const stage = stages[stageIdx];
  const available =
    matrix?.taggers.filter(
      (t) => !rowIds.includes(t.id) && !colIds.includes(t.id),
    ) ?? [];
  const taggers = matrix?.taggers ?? [];

  const selectedSylls = selected
    ? (matrix?.cells.find((c) => `${c.rowIdx}|${c.colIdx}` === selected)
        ?.syllables ?? [])
    : [];

  const fetchTrace = async (pron: string) => {
    const res = await fetch("/api/trace", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ stageIdx, syllables: [pron] }),
    });
    const data = await res.json();
    setTraceData(data);
    setTracePron(pron);
  };

  const doQuery = async () => {
    if (!queryChar || !matrix) return;
    const res = await fetch("/api/query", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        stageIdx,
        char: queryChar,
        rowTaggers: rowIds,
        colTaggers: colIds,
      }),
    });
    const data = await res.json();
    if (!data.results?.length) {
      setQueryResult(null);
      setQueryMulti(null);
      setQueryNotFound(true);
      setSelected(null);
      return;
    }
    setQueryNotFound(false);
    setDetailLoading(true);
    setTraceData(null);
    setTracePron("");

    // 计算每个结果对应的单元格
    const cellKeys = new Set<string>();
    const items: {
      pron: string;
      cellKey: string;
      rowLabels: string[];
      colLabels: string[];
    }[] = [];
    for (const r of data.results) {
      const ri =
        r.rowLabels.length === 0
          ? 0
          : matrix.rows.findIndex((row: any) =>
              row.labels.every((l: string, i: number) => l === r.rowLabels[i]),
            );
      const ci =
        r.colLabels.length === 0
          ? 0
          : matrix.cols.findIndex((col: any) =>
              col.labels.every((l: string, i: number) => l === r.colLabels[i]),
            );
      const ck = `${ri}|${ci}`;
      if (ri < 0 || ci < 0) continue;
      cellKeys.add(ck);
      // 展示用：每个读音都保留（按 pron+cellKey 去重）
      const key2 = `${ck}|${r.pron}`;
      if (!items.some((it) => `${it.cellKey}|${it.pron}` === key2)) {
        items.push({
          pron: r.pron,
          cellKey: ck,
          rowLabels: r.rowLabels,
          colLabels: r.colLabels,
        });
      }
    }

    if (cellKeys.size === 1) {
      const item = items[0];
      setQueryResult({
        char: queryChar,
        pron: item.pron,
        rowLabels: item.rowLabels,
        colLabels: item.colLabels,
      });
      setQueryMulti(null);
      setSelected(item.cellKey);
    } else if (cellKeys.size > 1) {
      setQueryResult(null);
      setQueryMulti({ char: queryChar, items });
      setSelected(null);
    } else {
      setQueryResult(null);
      setQueryMulti(null);
      setQueryNotFound(true);
    }
    requestAnimationFrame(() => setDetailLoading(false));
  };

  const groupStarts = useMemo(() => {
    const starts: number[] = [0];
    for (let i = 1; i < stages.length; i++) {
      if (stages[i].stageGroup !== stages[i - 1].stageGroup) starts.push(i);
    }
    return starts;
  }, [stages]);

  const curGroupStart = useMemo(() => {
    let gs = 0;
    for (const s of groupStarts) {
      if (s <= stageIdx) gs = s;
      else break;
    }
    return gs;
  }, [groupStarts, stageIdx]);

  const goPrevGroup = () => {
    const idx = groupStarts.indexOf(curGroupStart);
    if (idx > 0) {
      setStageIdx(groupStarts[idx - 1]);
      setSelected(null);
    }
  };
  const goNextGroup = () => {
    const idx = groupStarts.indexOf(curGroupStart);
    if (idx < groupStarts.length - 1) {
      setStageIdx(groupStarts[idx + 1]);
      setSelected(null);
    }
  };

  const moveTag = (
    id: string,
    to: "row" | "col" | "remove",
    atIdx?: number,
  ) => {
    const nr = rowIds.filter((x) => x !== id);
    const nc = colIds.filter((x) => x !== id);
    if (to === "row") {
      const i = atIdx ?? nr.length;
      setRowIds([...nr.slice(0, i), id, ...nr.slice(i)]);
      setColIds(nc);
    } else if (to === "col") {
      const i = atIdx ?? nc.length;
      setRowIds(nr);
      setColIds([...nc.slice(0, i), id, ...nc.slice(i)]);
    } else {
      setRowIds(nr);
      setColIds(nc);
    }
  };

  const reorder = (side: "row" | "col", fromIdx: number, toIdx: number) => {
    const ids = side === "row" ? [...rowIds] : [...colIds];
    const [moved] = ids.splice(fromIdx, 1);
    ids.splice(toIdx, 0, moved);
    side === "row" ? setRowIds(ids) : setColIds(ids);
  };

  const openFilter = (id: string) => setFilterOpen(id);
  const setFilter = (id: string, val: string, on: boolean) => {
    setFilters((prev) => {
      const next = { ...prev };
      const s = new Set(prev[id] ?? []);
      if (on) s.add(val);
      else s.delete(val);
      next[id] = s;
      return next;
    });
  };

  useEffect(() => {
    if (!filterOpen) return;
    const close = (e: MouseEvent) => {
      const t = e.target as HTMLElement;
      if (t.closest("[data-filter-panel]") || t.closest("[data-ft]")) return;
      setFilterOpen(null);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [filterOpen]);

  return (
    <>
      <style>{`
      button:not(:disabled):hover { color:#6366f1 !important; border-color:#6366f1 !important; }
      button:disabled { opacity:0.35; cursor:default; }
      tbody td:hover { filter:brightness(0.97); }
      [data-chip] { cursor:grab; user-select:none; }
      [data-chip]:hover { border-color:#6366f1 !important; }
      [data-chip]:hover .chip-name { color:#6366f1 !important; }
      [data-chip]:active { cursor:grabbing !important; }
      [data-add-item]:hover { background:#f3f0ff !important; color:#6366f1 !important; }
      [data-filter-item]:hover { background:#f3f0ff !important; }
      .back-arrow:hover { color:#6366f1 !important; }
      .outline-btn { cursor:pointer; padding:3px 12px; border-radius:12px; border:1px solid #6366f1; background:#fff; color:#6366f1; font-size:13px; transition:all .15s; }
      .outline-btn:hover:not(:disabled) { background:#f3f0ff; }
      .outline-btn:disabled { opacity:0.3; cursor:default; }
      [data-chip] button:hover { color:#ef4444 !important; border-color:transparent !important; }
      [data-chip].is-dragging { opacity:0.4; }
      [data-syl]:hover { filter:brightness(0.9); }
      ::-webkit-scrollbar { width:6px; height:6px; }
      ::-webkit-scrollbar-track { background:transparent; }
      ::-webkit-scrollbar-thumb { background:#cbd5e1; border-radius:3px; }
      ::-webkit-scrollbar-thumb:hover { background:#94a3b8; }
    `}</style>
      <div
        style={{
          height: "98vh",
          width: "98vw",
          margin: "0 auto",
          display: "flex",
          flexDirection: "column",
          fontFamily: "system-ui,-apple-system,sans-serif",
          padding: "8px 0 6px",
          boxSizing: "border-box",
          overflow: "hidden",
          background: "#f8f9fb",
          color: "#374151",
        }}
      >
        {/* 标题区 */}
        <div style={{ position: "absolute", top: 12, right: 16, zIndex: 5 }}>
          <span
            onClick={(e) => { e.stopPropagation(); setAboutOpen(true); }}
            className="outline-btn"
          >
            关于
          </span>
        </div>
        <div
          onClick={(e) => e.stopPropagation()}
          style={{ textAlign: "center", flexShrink: 0 }}
        >
          <div
            style={{
              display: "inline-block",
              padding: "3px 16px",
              borderRadius: 14,
              background: "#fff",
              border: "1px solid #6366f1",
              color: "#6366f1",
              fontSize: 16,
              fontWeight: 600,
              letterSpacing: 0.5,
            }}
          >
            {stage?.stageGroup ?? "加载中..."}
          </div>
          <div style={{ marginTop: 8, fontSize: 13, color: "#6b7280" }}>
            {stageIdx > 0 && (
              <>
                上一音变：<b>{stage?.ruleName}</b> &nbsp;{" "}
              </>
            )}
            {stageIdx < stages.length - 1 && (
              <>
                下一音变：<b>{stages[stageIdx + 1]?.ruleName}</b> &nbsp;{" "}
              </>
            )}
            <b>{matrix?.count ?? "-"}</b> 有效音节
            {loading && (
              <span style={{ marginLeft: 8, color: "#0d9488" }}>加载中...</span>
            )}
          </div>
        </div>

        {/* 标签 */}
        <div
          onClick={(e) => e.stopPropagation()}
          style={{
            display: "flex",
            gap: 8,
            marginTop: 8,
            flexShrink: 0,
            flexWrap: "wrap",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <DragPanel
            side="row"
            label="行标签"
            ids={rowIds}
            taggers={taggers}
            available={available}
            onReorder={(a, b) => reorder("row", a, b)}
            onMove={moveTag}
            onDragChange={setDragging}
            addOpenSide={addOpenSide}
            onSetAddOpenSide={setAddOpenSide}
            filters={filters}
            filterOpen={filterOpen}
            onOpenFilter={openFilter}
            onSetFilter={setFilter}
          />
          <DragPanel
            side="col"
            label="列标签"
            ids={colIds}
            taggers={taggers}
            available={available}
            onReorder={(a, b) => reorder("col", a, b)}
            onMove={moveTag}
            onDragChange={setDragging}
            addOpenSide={addOpenSide}
            onSetAddOpenSide={setAddOpenSide}
            filters={filters}
            filterOpen={filterOpen}
            onOpenFilter={openFilter}
            onSetFilter={setFilter}
          />
          {dragging && (
            <RemoveZone
              onDrop={(id) => moveTag(id, "remove")}
              onDragChange={setDragging}
            />
          )}
          <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
            <input
              value={queryChar}
              onChange={(e) => setQueryChar(e.target.value.slice(0, 1))}
              onKeyDown={(e) => {
                if (e.key === "Enter") doQuery();
              }}
              placeholder="字"
              style={{
                width: 28,
                padding: "3px 4px",
                border: "1px solid #e5e7eb",
                borderRadius: 6,
                fontSize: 13,
                textAlign: "center",
                outline: "none",
                fontFamily: "inherit",
                transition: "border-color .15s",
              }}
              onFocus={(e) => (e.target.style.borderColor = "#6366f1")}
              onBlur={(e) => (e.target.style.borderColor = "#e5e7eb")}
            />
            <button onClick={doQuery} style={{ ...navBtn, padding: "4px 6px" }}>
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                <circle
                  cx="6"
                  cy="6"
                  r="4.5"
                  stroke="currentColor"
                  strokeWidth="1.2"
                />
                <path
                  d="M9.5 9.5L13 13"
                  stroke="currentColor"
                  strokeWidth="1.2"
                  strokeLinecap="round"
                />
              </svg>
            </button>
          </div>
        </div>

        {/* 表格 + 详情 */}
        <div
          style={{
            flex: 1,
            minHeight: 0,
            display: "flex",
            flexDirection: "column",
            marginTop: 8,
            marginBottom: 8,
          }}
        >
          {matrix &&
            (() => {
              const colLv = matrix.colHeaders.length;
              const rowLv = matrix.rowLabels.length;
              const L = "#e5e7eb";

              const colBdry = (ci: number) => {
                if (ci + 1 >= matrix.cols.length) return -1;
                const a = matrix.cols[ci].labels,
                  b = matrix.cols[ci + 1].labels;
                for (let lv = 0; lv < a.length; lv++)
                  if (a[lv] !== b[lv]) return lv;
                return -1;
              };
              const rowBdry = (ri: number) => {
                if (ri + 1 >= matrix.rows.length) return -1;
                const a = matrix.rows[ri].labels,
                  b = matrix.rows[ri + 1].labels;
                for (let lv = 0; lv < a.length; lv++)
                  if (a[lv] !== b[lv]) return lv;
                return -1;
              };
              return (
                <>
                  <div
                    onClick={(e) => e.stopPropagation()}
                    style={{
                      overflowX: "auto",
                      overflowY: "auto",
                      flex: 1,
                      minHeight: 0,
                      maxHeight: selected ? "50vh" : undefined,
                      borderRadius: 6,
                    }}
                  >
                    <table
                      style={{
                        borderCollapse: "separate",
                        borderSpacing: 0,
                        fontSize: 12,
                        border: "1px solid #e5e7eb",
                        margin: "0 auto",
                        boxShadow: "0 1px 2px rgba(0,0,0,0.04)",
                      }}
                    >
                      <colgroup>
                        {rowIds.length > 0 &&
                          Array.from({ length: rowIds.length }, (_, i) => (
                            <col key={`rl-${i}`} />
                          ))}
                        {matrix.cols.map((_, ci) => (
                          <col key={ci} />
                        ))}
                      </colgroup>
                      <thead style={{ position: "sticky", top: 0, zIndex: 2 }}>
                        {matrix.colHeaders.map((spans, lv) => (
                          <tr key={lv}>
                            {lv === 0 &&
                              rowIds.length > 0 &&
                              colIds.length > 0 && (
                                <th
                                  rowSpan={colLv}
                                  colSpan={rowIds.length}
                                  style={{
                                    ...baseTh,
                                    position: "sticky",
                                    left: 0,
                                    zIndex: 4,
                                    minWidth: 60,
                                  }}
                                />
                              )}
                            {spans.map((s, i) => {
                              let p = 0;
                              for (let j = 0; j <= i; j++) p += spans[j].span;
                              const cb = colBdry(p - 1);
                              return (
                                <th
                                  key={i}
                                  colSpan={s.span}
                                  style={{
                                    ...baseTh,
                                    minWidth: 50,
                                    borderRight:
                                      cb >= 0
                                        ? `${colLv - cb}px solid ${L}`
                                        : undefined,
                                  }}
                                >
                                  {s.label}
                                </th>
                              );
                            })}
                          </tr>
                        ))}
                      </thead>
                      <tbody ref={tbodyRef}>
                        {matrix.rows.map((row, ri) => (
                          <tr key={row.key}>
                            {rowIds.length > 0 &&
                              matrix.rowLabels.map((cells, lv) => {
                                let acc = 0;
                                for (const c of cells) {
                                  if (ri >= acc && ri < acc + c.rowSpan) {
                                    if (ri === acc) {
                                      const rb = rowBdry(acc + c.rowSpan - 1);
                                      return (
                                        <td
                                          key={lv}
                                          rowSpan={c.rowSpan}
                                          data-rl=""
                                          style={{
                                            ...baseTh,
                                            position: "sticky",
                                            left: stickyLefts[lv] ?? 0,
                                            zIndex: 1,
                                            minWidth: 60,
                                            textAlign: "left",
                                            borderBottom:
                                              rb >= 0
                                                ? `${rowLv - rb}px solid ${L}`
                                                : undefined,
                                          }}
                                        >
                                          {c.label}
                                        </td>
                                      );
                                    }
                                    return null;
                                  }
                                  acc += c.rowSpan;
                                }
                                return null;
                              })}
                            {matrix.cols.map((_, ci) => {
                              const ck = `${ri}|${ci}`;
                              const cell = matrix.cells.find(
                                (c) => c.rowIdx === ri && c.colIdx === ci,
                              );
                              const cc = cell?.charCount ?? 0;
                              const sc = cell?.count ?? 0;
                              const sel = selected === ck;
                              const bg =
                                cc === 0
                                  ? "#fafafa"
                                  : sel
                                    ? "#eef2ff"
                                    : cc > 30
                                      ? "#ccfbf1"
                                      : cc > 10
                                        ? "#e6fffa"
                                        : cc > 3
                                          ? "#f0fdfa"
                                          : "#f8fafc";
                              const cb = colBdry(ci),
                                rb = rowBdry(ri);
                              return (
                                <td
                                  key={ci}
                                  onClick={() => {
                                    if (sel) {
                                      setSelected(null);
                                      setQueryResult(null);
                                      setQueryMulti(null);
                                      setQueryNotFound(false);
                                      setTraceData(null);
                                      setTracePron("");
                                      return;
                                    }
                                    setSelected(ck);
                                    setQueryResult(null);
                                    setQueryMulti(null);
                                    setQueryNotFound(false);
                                    setTraceData(null);
                                    setTracePron("");
                                    setDetailLoading(true);
                                    requestAnimationFrame(() =>
                                      setDetailLoading(false),
                                    );
                                  }}
                                  style={{
                                    ...baseTd,
                                    background: bg,
                                    cursor: cc > 0 ? "pointer" : "default",
                                    fontWeight: sel ? 700 : 400,
                                    borderRight:
                                      cb >= 0
                                        ? `${colLv - cb}px solid ${L}`
                                        : undefined,
                                    borderBottom:
                                      rb >= 0
                                        ? `${rowLv - rb}px solid ${L}`
                                        : undefined,
                                  }}
                                >
                                  {cc > 0 ? (
                                    <>
                                      <b>{cc}</b>
                                      <span
                                        style={{
                                          fontSize: 10,
                                          color: "#94a3b8",
                                        }}
                                      >
                                        /{sc}
                                      </span>
                                    </>
                                  ) : (
                                    ""
                                  )}
                                </td>
                              );
                            })}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  {(selected || queryResult || queryNotFound || queryMulti) && (
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "center",
                        flex: "1 1 0",
                        minHeight: 0,
                        marginTop: 6,
                      }}
                    >
                      <div
                        onClick={(e) => e.stopPropagation()}
                        style={{
                          padding: "6px 12px",
                          background: "#fff",
                          borderRadius: 8,
                          border: "1px solid #e5e7eb",
                          width: "100%",
                          boxSizing: "border-box",
                          boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
                          display: "flex",
                          flexDirection: "column",
                          overflow: "hidden",
                        }}
                      >
                        {traceData ? (
                          <TraceView
                            traces={traceData.traces}
                            ruleNames={traceData.ruleNames}
                            pron={tracePron}
                            onBack={() => {
                              setDetailLoading(true);
                              setTraceData(null);
                              setTracePron("");
                              requestAnimationFrame(() =>
                                setDetailLoading(false),
                              );
                            }}
                          />
                        ) : queryMulti ? (
                          <div
                            style={{
                              display: "flex",
                              flexDirection: "column",
                              alignItems: "center",
                              justifyContent: "center",
                              flex: 1,
                              gap: 8,
                            }}
                          >
                            <div
                              style={{
                                display: "flex",
                                alignItems: "center",
                                width: "100%",
                              }}
                            >
                              <div style={{ flex: 1 }} />
                              <span style={{ fontSize: 13, color: "#94a3b8" }}>
                                所查字有多个符合条件的读音
                              </span>
                              <div
                                style={{
                                  flex: 1,
                                  display: "flex",
                                  justifyContent: "flex-end",
                                }}
                              >
                                <span
                                  onClick={() => {
                                    setQueryMulti(null);
                                    setQueryNotFound(false);
                                  }}
                                  style={{
                                    cursor: "pointer",
                                    color: "#ef4444",
                                    lineHeight: 1,
                                    padding: "0 2px",
                                    display: "inline-flex",
                                    alignItems: "center",
                                  }}
                                >
                                  <svg
                                    width="16"
                                    height="16"
                                    viewBox="0 0 16 16"
                                    fill="none"
                                  >
                                    <path
                                      d="M4 4l8 8M12 4l-8 8"
                                      stroke="currentColor"
                                      strokeWidth="1.5"
                                      strokeLinecap="round"
                                    />
                                  </svg>
                                </span>
                              </div>
                            </div>
                            <div
                              style={{
                                display: "flex",
                                flexWrap: "wrap",
                                gap: 6,
                                justifyContent: "center",
                              }}
                            >
                              {queryMulti.items.map((item) => (
                                <span
                                  key={`${item.cellKey}|${item.pron}`}
                                  data-syl
                                  onClick={() => {
                                    setQueryResult({
                                      char: queryMulti.char,
                                      pron: item.pron,
                                      rowLabels: item.rowLabels,
                                      colLabels: item.colLabels,
                                    });
                                    setQueryMulti(null);
                                    setSelected(item.cellKey);
                                    setDetailLoading(true);
                                    requestAnimationFrame(() =>
                                      setDetailLoading(false),
                                    );
                                  }}
                                  style={{
                                    padding: "1px 5px",
                                    background: "#ccfbf1",
                                    borderRadius: 4,
                                    fontSize: 11,
                                    fontFamily: "monospace",
                                    whiteSpace: "nowrap",
                                    color: "#0f766e",
                                    cursor: "pointer",
                                  }}
                                >
                                  {item.pron}
                                </span>
                              ))}
                            </div>
                          </div>
                        ) : queryNotFound ? (
                          <>
                            <div
                              style={{
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "flex-end",
                                flexShrink: 0,
                                marginBottom: 4,
                              }}
                            >
                              <span
                                onClick={() => {
                                  setQueryNotFound(false);
                                  setQueryResult(null);
                                  setTraceData(null);
                                  setTracePron("");
                                }}
                                style={{
                                  cursor: "pointer",
                                  color: "#ef4444",
                                  lineHeight: 1,
                                  padding: "0 2px",
                                  display: "inline-flex",
                                  alignItems: "center",
                                }}
                              >
                                <svg
                                  width="16"
                                  height="16"
                                  viewBox="0 0 16 16"
                                  fill="none"
                                >
                                  <path
                                    d="M4 4l8 8M12 4l-8 8"
                                    stroke="currentColor"
                                    strokeWidth="1.5"
                                    strokeLinecap="round"
                                  />
                                </svg>
                              </span>
                            </div>
                            <div
                              style={{
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                flex: 1,
                                color: "#94a3b8",
                                fontSize: 13,
                              }}
                            >
                              所查字不符筛选或不存在
                            </div>
                          </>
                        ) : detailLoading ? (
                          <div
                            style={{
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                              flex: 1,
                              color: "#0d9488",
                              fontSize: 13,
                            }}
                          >
                            加载详情中...
                          </div>
                        ) : selectedSylls.length > 0 ? (
                          (() => {
                            const toneOrder = ["平", "上", "去", "入"];
                            const byTone: Record<string, typeof selectedSylls> =
                              {};
                            for (const s of selectedSylls) {
                              const core = s.pron.replace(/v$/, "");
                              let t: string;
                              if (/[ptk]$/.test(core)) t = "入";
                              else if (core.endsWith("q")) t = "上";
                              else if (core.endsWith("h")) t = "去";
                              else t = "平";
                              if (!byTone[t]) byTone[t] = [];
                              byTone[t].push(s);
                            }
                            const totalChars = selectedSylls.reduce(
                              (s, x) => s + x.chars.length,
                              0,
                            );
                            return (
                              <>
                                <div
                                  style={{
                                    display: "flex",
                                    alignItems: "center",
                                    justifyContent: "space-between",
                                    flexShrink: 0,
                                    marginBottom: 4,
                                  }}
                                >
                                  <h3
                                    style={{
                                      margin: 0,
                                      fontSize: 14,
                                      color: "#475569",
                                    }}
                                  >
                                    {totalChars} 字 / {selectedSylls.length}{" "}
                                    音节
                                  </h3>
                                  <span
                                    onClick={() => {
                                      setSelected(null);
                                      setQueryResult(null);
                                      setQueryMulti(null);
                                      setQueryNotFound(false);
                                      setTraceData(null);
                                      setTracePron("");
                                    }}
                                    style={{
                                      cursor: "pointer",
                                      color: "#ef4444",
                                      lineHeight: 1,
                                      padding: "0 2px",
                                      marginLeft: "auto",
                                      display: "inline-flex",
                                      alignItems: "center",
                                    }}
                                  >
                                    <svg
                                      width="16"
                                      height="16"
                                      viewBox="0 0 16 16"
                                      fill="none"
                                    >
                                      <path
                                        d="M4 4l8 8M12 4l-8 8"
                                        stroke="currentColor"
                                        strokeWidth="1.5"
                                        strokeLinecap="round"
                                      />
                                    </svg>
                                  </span>
                                </div>
                                {queryResult && (
                                  <div style={{ fontSize:12, fontWeight:600, color:"#475569", marginBottom:4 }}>
                                    查询结果
                                  </div>
                                )}
                                {queryResult && (
                                  <div
                                    style={{
                                      flexShrink: 0,
                                      marginBottom: 6,
                                      fontSize: 12,
                                      color: "#475569",
                                    }}
                                  >
                                    <div
                                      style={{
                                        display: "flex",
                                        flexDirection: "column",
                                        gap: 2,
                                      }}
                                    >
                                      {selectedSylls
                                        .filter((s) =>
                                          s.chars.includes(queryResult.char),
                                        )
                                        .map(({ pron, chars }) => (
                                          <div
                                            key={pron}
                                            style={{
                                              display: "flex",
                                              alignItems: "flex-start",
                                              gap: 6,
                                            }}
                                          >
                                            <span
                                              data-syl
                                              onClick={() => fetchTrace(pron)}
                                              style={{
                                                padding: "1px 5px",
                                                background: "#ccfbf1",
                                                borderRadius: 4,
                                                fontSize: 11,
                                                fontFamily: "monospace",
                                                whiteSpace: "nowrap",
                                                color: "#0f766e",
                                                flexShrink: 0,
                                                cursor: "pointer",
                                              }}
                                            >
                                              {pron}
                                            </span>
                                            <span
                                              style={{
                                                fontSize: 11,
                                                color: "#6b7280",
                                              }}
                                            >
                                              {chars
                                                .map((c) => (
                                                  <span
                                                    key={c}
                                                    style={
                                                      c === queryResult.char
                                                        ? {
                                                            color: "#6366f1",
                                                            fontWeight: 600,
                                                          }
                                                        : undefined
                                                    }
                                                  >
                                                    {c}
                                                  </span>
                                                ))
                                                .reduce((a, b) => (
                                                  <>
                                                    {a} {b}
                                                  </>
                                                ))}
                                            </span>
                                          </div>
                                        ))}
                                    </div>
                                  </div>
                                )}
                                <div
                                  style={{
                                    display: "flex",
                                    gap: 6,
                                    flexShrink: 0,
                                  }}
                                >
                                  {toneOrder.map((t) => (
                                    <div
                                      key={t}
                                      style={{
                                        flex: 1,
                                        minWidth: 0,
                                        fontSize: 12,
                                        fontWeight: 600,
                                        color: "#475569",
                                        marginBottom: 4,
                                      }}
                                    >
                                      {t}声
                                    </div>
                                  ))}
                                </div>
                                <div
                                  style={{
                                    display: "flex",
                                    gap: 6,
                                    overflowY: "auto",
                                    flex: 1,
                                  }}
                                >
                                  {toneOrder.map((t) => {
                                    const sylls = byTone[t];
                                    return (
                                      <div
                                        key={t}
                                        style={{ flex: 1, minWidth: 0 }}
                                      >
                                        <div
                                          style={{
                                            display: "flex",
                                            flexDirection: "column",
                                            gap: 2,
                                          }}
                                        >
                                          {(sylls || []).map(
                                            ({ pron, chars }) => (
                                              <div
                                                key={pron}
                                                style={{
                                                  display: "flex",
                                                  alignItems: "flex-start",
                                                  gap: 4,
                                                }}
                                              >
                                                <span
                                                  data-syl
                                                  onClick={() =>
                                                    fetchTrace(pron)
                                                  }
                                                  style={{
                                                    padding: "1px 5px",
                                                    background: "#ccfbf1",
                                                    borderRadius: 4,
                                                    fontSize: 11,
                                                    fontFamily: "monospace",
                                                    whiteSpace: "nowrap",
                                                    color: "#0f766e",
                                                    flexShrink: 0,
                                                    cursor: "pointer",
                                                  }}
                                                >
                                                  {pron}
                                                </span>
                                                <span
                                                  style={{
                                                    fontSize: 11,
                                                    color: "#6b7280",
                                                    wordBreak: "break-all",
                                                  }}
                                                >
                                                  {chars
                                                    .map((c) =>
                                                      queryResult &&
                                                      c === queryResult.char ? (
                                                        <span
                                                          key={c}
                                                          style={{
                                                            color: "#6366f1",
                                                            fontWeight: 600,
                                                          }}
                                                        >
                                                          {c}
                                                        </span>
                                                      ) : (
                                                        c
                                                      ),
                                                    )
                                                    .reduce((a, b) => (
                                                      <>
                                                        {a} {b}
                                                      </>
                                                    ))}
                                                </span>
                                              </div>
                                            ),
                                          )}
                                        </div>
                                      </div>
                                    );
                                  })}
                                </div>
                              </>
                            );
                          })()
                        ) : (
                          <>
                            <div
                              style={{
                                display: "flex",
                                justifyContent: "flex-end",
                                flexShrink: 0,
                                marginBottom: 4,
                              }}
                            >
                              <span
                                onClick={() => {
                                  setSelected(null);
                                  setQueryResult(null);
                                  setQueryMulti(null);
                                  setQueryNotFound(false);
                                  setTraceData(null);
                                  setTracePron("");
                                }}
                                style={{
                                  cursor: "pointer",
                                  color: "#ef4444",
                                  lineHeight: 1,
                                  padding: "0 2px",
                                  display: "inline-flex",
                                  alignItems: "center",
                                }}
                              >
                                <svg
                                  width="16"
                                  height="16"
                                  viewBox="0 0 16 16"
                                  fill="none"
                                >
                                  <path
                                    d="M4 4l8 8M12 4l-8 8"
                                    stroke="currentColor"
                                    strokeWidth="1.5"
                                    strokeLinecap="round"
                                  />
                                </svg>
                              </span>
                            </div>
                            <div
                              style={{
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                flex: 1,
                                color: "#94a3b8",
                                fontSize: 13,
                              }}
                            >
                              该格无音节
                            </div>
                          </>
                        )}
                      </div>
                    </div>
                  )}
                </>
              );
            })()}
        </div>

        {/* 控制栏 - 底部 */}
        <div
          onClick={(e) => e.stopPropagation()}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 6,
            padding: 0,
            flexShrink: 0,
            width: "100%",
          }}
        >
          <button
            onClick={goPrevGroup}
            disabled={curGroupStart === 0}
            className="outline-btn"
          >
            上一阶段
          </button>
          <button
            onClick={() => {
              setStageIdx(Math.max(0, stageIdx - 1));
              setSelected(null);
            }}
            disabled={stageIdx === 0}
            className="outline-btn"
          >
            上一音变
          </button>
          <input
            type="range"
            min={0}
            max={stages.length - 1}
            value={stageIdx}
            onChange={(e) => {
              setStageIdx(+e.target.value);
              setSelected(null);
            }}
            style={{ flex: 1, accentColor: "#6366f1" }}
          />
          <button
            onClick={() => {
              setStageIdx(Math.min(stages.length - 1, stageIdx + 1));
              setSelected(null);
            }}
            disabled={stageIdx === stages.length - 1}
            className="outline-btn"
          >
            下一音变
          </button>
          <button
            onClick={goNextGroup}
            disabled={curGroupStart === groupStarts[groupStarts.length - 1]}
            className="outline-btn"
          >
            下一阶段
          </button>
        </div>
      </div>
      {aboutOpen && (
        <div
          onClick={() => setAboutOpen(false)}
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.3)",
            zIndex: 100,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              background: "#fff",
              borderRadius: 12,
              padding: "28px 32px",
              maxWidth: 420,
              width: "90%",
              boxShadow: "0 8px 32px rgba(0,0,0,0.12)",
              fontSize: 14,
              lineHeight: 1.8,
              color: "#374151",
            }}
          >
            <div style={{ textAlign: "center", marginBottom: 16 }}>
              <div style={{ fontSize: 24, fontWeight: 700, color: "#6366f1", letterSpacing: 2, lineHeight: 1 }}>韵易</div>
              <div style={{ fontSize: 12, color: "#94a3b8", lineHeight: 1, marginTop: 0 }}>by Inflegza</div>
            </div>
            <p style={{ margin: "0 0 10px", fontSize: 13, lineHeight: 1.8, color: "#4b5563" }}>
              本软件以 GNU GPL 协议{" "}
              <a href="https://github.com/FangZeLi/uinh-jiek" target="_blank" style={{color:"#6366f1"}}>开源</a>。
            </p>
            <p style={{ margin: "0", fontSize: 13, lineHeight: 1.8, color: "#4b5563" }}>
              受限于作者学识与客观条件，本软件的内容不免有舛误之处。如发现错误或有改进建议，欢迎到 GitHub 仓库提交 Issue。
            </p>
            <div style={{ textAlign: "center", marginTop: 16 }}>
              <button
                onClick={() => setAboutOpen(false)}
                className="outline-btn"
              >
                关闭
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function avgBary(children: Set<string> | undefined, yMap: Map<string, number>) {
  if (!children || children.size === 0) return Infinity;
  let sum = 0;
  for (const c of children) sum += yMap.get(c) ?? 0;
  return sum / children.size;
}

// ---- Trace View ----
function TraceView({
  traces,
  ruleNames,
  pron,
  onBack,
}: {
  traces: {
    char: string;
    stages: { stage: number; pron: string; rule?: string }[];
  }[];
  ruleNames: string[];
  pron: string;
  onBack: () => void;
}) {
  const pad = 6,
    gap = 22,
    rowH = 22,
    nodeH = 18,
    charW = 6.8,
    nodePad = 8;
  const maxStage = Math.max(
    ...traces.flatMap((t) => t.stages.map((s) => s.stage)),
  );
  const [tooltip, setTooltip] = useState<{
    x: number;
    y: number;
    text: string;
  } | null>(null);
  const svgRef = useRef<HTMLDivElement>(null);

  // 密集化
  const denseTraces = traces.map((t) => {
    const prons: string[] = [];
    let si = 0;
    for (let s = 0; s <= maxStage; s++) {
      while (si < t.stages.length && t.stages[si].stage <= s) si++;
      prons.push(t.stages[si > 0 ? si - 1 : 0].pron);
    }
    return { char: t.char, prons };
  });

  // 筛选有音变的阶段
  const keepStages: number[] = [0];
  for (let s = 1; s <= maxStage; s++) {
    if (denseTraces.some((dt) => dt.prons[s] !== dt.prons[s - 1]))
      keepStages.push(s);
  }
  if (keepStages[keepStages.length - 1] !== maxStage) keepStages.push(maxStage);

  // 构建节点
  type NodeInfo = {
    pron: string;
    chars: string[];
    x: number;
    y: number;
    w: number;
    stage: number;
  };
  const stageNodes: NodeInfo[][] = keepStages.map((s, si) => {
    const map = new Map<string, string[]>();
    for (const dt of denseTraces) {
      const p = dt.prons[s];
      if (!map.has(p)) map.set(p, []);
      map.get(p)!.push(dt.char);
    }
    return [...map.entries()].map(([pron, chars], i) => ({
      pron,
      chars,
      x: 0,
      y: pad + i * rowH,
      w: 0,
      stage: s,
    }));
  });

  // 桶排序：末层固定，每往前一层按通向下层的顺序排
  const last = stageNodes.length - 1;
  let order = new Map<string, number>();
  stageNodes[last].forEach((n, i) => order.set(n.pron, i));
  for (let si = last - 1; si >= 0; si--) {
    const prevMap = new Map<string, Set<string>>();
    for (const dt of denseTraces) {
      const from = dt.prons[keepStages[si]];
      const to = dt.prons[keepStages[si + 1]];
      if (!prevMap.has(from)) prevMap.set(from, new Set());
      prevMap.get(from)!.add(to);
    }
    const next = new Map<string, number>();
    for (const [pron, children] of prevMap) {
      let min = Infinity;
      for (const c of children) min = Math.min(min, order.get(c) ?? Infinity);
      next.set(pron, min);
    }
    stageNodes[si].sort((a, b) => {
      const oa = next.get(a.pron) ?? Infinity;
      const ob = next.get(b.pron) ?? Infinity;
      return oa - ob;
    });
    order = new Map<string, number>();
    stageNodes[si].forEach((n, i) => order.set(n.pron, i));
  }
  // 重新分配 y
  for (const ns of stageNodes) {
    ns.forEach((n, i) => (n.y = pad + i * rowH));
  }

  // 每列宽度
  const colWidths = stageNodes.map((ns) => {
    const maxLen = Math.max(...ns.map((n) => n.pron.length), 1);
    return maxLen * charW + nodePad;
  });
  const colXs: number[] = [];
  let cx = pad;
  for (let si = 0; si < keepStages.length; si++) {
    colXs.push(cx);
    cx += colWidths[si] + gap;
  }
  for (let si = 0; si < stageNodes.length; si++) {
    for (const n of stageNodes[si]) {
      n.x = colXs[si];
      n.w = colWidths[si];
    }
  }

  const totalH =
    Math.max(...stageNodes.map((ns) => ns.length)) * rowH + pad * 2;
  const svgW = colXs[colXs.length - 1] + colWidths[colWidths.length - 1] + pad;

  // 构建边（去重），记录 keepIdx 用于查规则名
  const edgeSet = new Set<string>();
  const edges: {
    x1: number;
    y1: number;
    x2: number;
    y2: number;
    keepIdx: number;
  }[] = [];
  for (const dt of denseTraces) {
    for (let ki = 1; ki < keepStages.length; ki++) {
      const prevS = keepStages[ki - 1],
        curS = keepStages[ki];
      const n0 = stageNodes[ki - 1].find((n) => n.pron === dt.prons[prevS])!;
      const n1 = stageNodes[ki].find((n) => n.pron === dt.prons[curS])!;
      const key = `${n0.x},${n0.y}-${n1.x},${n1.y}`;
      if (!edgeSet.has(key)) {
        edgeSet.add(key);
        edges.push({
          x1: n0.x + n0.w / 2,
          y1: n0.y + nodeH / 2,
          x2: n1.x + n1.w / 2,
          y2: n1.y + nodeH / 2,
          keepIdx: ki,
        });
      }
    }
  }

  // 从 trace 数据中提取各阶段的真实规则名（强制最终阶段无规则则为空）
  const stageRules = new Map<number, string>();
  for (const t of traces) {
    for (const st of t.stages) {
      if (st.rule) stageRules.set(st.stage, st.rule);
    }
  }

  const uniqueChars = new Set(traces.map((t) => t.char)).size;
  const sourceSylCount = new Set(traces.map((t) => t.stages[0].pron)).size;

  const showTooltip = (e: React.MouseEvent, text: string) => {
    const el = svgRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    setTooltip({
      x: e.clientX - r.left + el.scrollLeft + 12,
      y: e.clientY - r.top + el.scrollTop - 8,
      text,
    });
  };

  return (
    <>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          flexShrink: 0,
          marginBottom: 4,
        }}
      >
        <div style={{ flex: 1 }} />
        <span style={{ fontSize: 13, color: "#475569" }}>
          <b>{sourceSylCount}</b> 来源音节 <b>{uniqueChars}</b> 字
        </span>
        <div style={{ flex: 1, display: "flex", justifyContent: "flex-end" }}>
          <span
            onClick={onBack}
            className="back-arrow"
            style={{
              cursor: "pointer",
              color: "#94a3b8",
              lineHeight: 1,
              padding: "0 2px",
              display: "inline-flex",
              alignItems: "center",
              transition: "color .15s",
            }}
          >
            <svg
              width="16"
              height="16"
              viewBox="0 0 16 16"
              fill="none"
            >
              <path
                d="M10 3L5 8l5 5"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </span>
        </div>
      </div>
      <div
        ref={svgRef}
        style={{
          position: "relative",
          overflow: "auto",
          flex: 1,
          display: "flex",
        }}
      >
        <svg
          width={svgW}
          height={totalH}
          style={{
            fontSize: 11,
            fontFamily: "system-ui, sans-serif",
            flexShrink: 0,
            margin: "auto",
          }}
        >
          {edges.map((e, i) => {
            const ruleName = stageRules.get(keepStages[e.keepIdx]) ?? "";
            return (
              <path
                key={i}
                d={`M${e.x1} ${e.y1} C${(e.x1 + e.x2) / 2} ${e.y1}, ${(e.x1 + e.x2) / 2} ${e.y2}, ${e.x2} ${e.y2}`}
                stroke="#cbd5e1"
                strokeWidth="4"
                fill="none"
                style={{ cursor: "default" }}
                onMouseEnter={
                  ruleName ? (ev) => showTooltip(ev, ruleName) : undefined
                }
                onMouseLeave={() => setTooltip(null)}
              />
            );
          })}
          {stageNodes.map((ns, si) =>
            ns.map((n) => {
              const charList = [...new Set(n.chars)].join(" ");
              return (
                <g
                  key={`${si}-${n.pron}`}
                  onMouseEnter={(ev) => showTooltip(ev, charList)}
                  onMouseLeave={() => setTooltip(null)}
                  style={{ cursor: "default" }}
                >
                  <rect
                    x={n.x}
                    y={n.y}
                    width={n.w}
                    height={nodeH}
                    rx={4}
                    fill="#ccfbf1"
                    stroke="#99f6e4"
                    strokeWidth="1"
                  />
                  <text
                    x={n.x + n.w / 2}
                    y={n.y + nodeH / 2 + 1}
                    textAnchor="middle"
                    dominantBaseline="middle"
                    fill="#0f766e"
                    fontFamily="monospace"
                    fontSize="11"
                  >
                    {n.pron}
                  </text>
                </g>
              );
            }),
          )}
        </svg>
        {tooltip && (
          <div
            style={{
              position: "absolute",
              left: tooltip.x,
              top: tooltip.y,
              padding: "4px 8px",
              background: "#fff",
              color: "#374151",
              borderRadius: 6,
              fontSize: 11,
              maxWidth: 280,
              pointerEvents: "none",
              zIndex: 10,
              border: "1px solid #e5e7eb",
              boxShadow: "0 4px 12px rgba(0,0,0,0.06)",
            }}
          >
            {tooltip.text}
          </div>
        )}
      </div>
    </>
  );
}

// ---- Drag Panel ----
function DragPanel({
  side,
  label,
  ids,
  taggers,
  available,
  onReorder,
  onMove,
  onDragChange,
  filters,
  filterOpen,
  onOpenFilter,
  onSetFilter,
  addOpenSide,
  onSetAddOpenSide,
}: {
  side: "row" | "col";
  label: string;
  ids: string[];
  taggers: TaggerDef[];
  available: TaggerDef[];
  onReorder: (a: number, b: number) => void;
  onMove: (id: string, to: "row" | "col" | "remove", atIdx?: number) => void;
  onDragChange: (v: boolean) => void;
  filters: Record<string, Set<string>>;
  filterOpen: string | null;
  onOpenFilter: (id: string) => void;
  onSetFilter: (id: string, val: string, on: boolean) => void;
  addOpenSide: "row" | "col" | null;
  onSetAddOpenSide: (v: "row" | "col" | null) => void;
}) {
  const byId = new Map(taggers.map((t) => [t.id, t]));
  const containerRef = useRef<HTMLDivElement>(null);
  const [over, setOver] = useState(false);
  const [insertIdx, setInsertIdx] = useState<number | null>(null);
  const [visualIdx, setVisualIdx] = useState<number | null>(null);
  const [dragMeta, setDragMeta] = useState<{
    side: string;
    idx: number;
  } | null>(null);
  const calcInsertIdx = (clientX: number): number => {
    const el = containerRef.current;
    if (!el) return ids.length;
    const chips = el.querySelectorAll<HTMLElement>("[data-chip]");
    for (let i = 0; i < chips.length; i++) {
      const r = chips[i].getBoundingClientRect();
      if (clientX < r.left + r.width / 2) return i;
    }
    return chips.length;
  };

  const start = (e: React.DragEvent, id: string, idx: number) => {
    onDragChange(true);
    setDragMeta({ side, idx });
    e.dataTransfer.setData("text/plain", id);
    e.dataTransfer.setData("from", side);
    e.dataTransfer.setData("idx", String(idx));
    (e.currentTarget as HTMLElement).classList.add("is-dragging");
  };

  const end = (e: React.DragEvent) => {
    setOver(false);
    setInsertIdx(null);
    setVisualIdx(null);
    setDragMeta(null);
    onDragChange(false);
    (e.currentTarget as HTMLElement).classList.remove("is-dragging");
  };

  useEffect(() => {
    if (addOpenSide !== side) return;
    const close = (e: MouseEvent) => {
      const t = e.target as HTMLElement;
      if (t.closest("[data-add-pop]") || t.closest("[data-add-btn]")) return;
      onSetAddOpenSide(null);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [addOpenSide, side, onSetAddOpenSide]);

  return (
    <div
      ref={containerRef}
      onDragOver={(e) => {
        e.preventDefault();
        e.stopPropagation();
        setOver(true);
        const raw = calcInsertIdx(e.clientX);
        let idx = raw;
        if (dragMeta && dragMeta.side === side && dragMeta.idx < raw) idx--;
        setInsertIdx(idx);
        setVisualIdx(raw);
      }}
      onDragLeave={(e) => {
        const el = containerRef.current;
        if (el && !el.contains(e.relatedTarget as Node)) {
          setOver(false);
          setInsertIdx(null);
        }
      }}
      onDrop={(e) => {
        e.preventDefault();
        e.stopPropagation();
        setOver(false);
        setInsertIdx(null);
        setDragMeta(null);
        onDragChange(false);
        const id = e.dataTransfer.getData("text/plain");
        const from = e.dataTransfer.getData("from");
        if (!id || !from) return;
        if (from === side) {
          const fi = Number(e.dataTransfer.getData("idx"));
          if (!isNaN(fi)) {
            let ti = calcInsertIdx(e.clientX);
            if (fi < ti) ti--;
            if (fi !== ti) onReorder(fi, ti);
          }
        } else {
          const ti = calcInsertIdx(e.clientX);
          onMove(id, side, ti);
        }
      }}
      style={{
        display: "flex",
        alignItems: "center",
        gap: 6,
        flexWrap: "wrap",
        padding: "6px 10px",
        borderRadius: 8,
        minHeight: 32,
        border: `2px dashed ${over ? "#6366f1" : "transparent"}`,
        transition: "border-color .15s",
      }}
    >
      <span
        style={{
          fontSize: 13,
          fontWeight: 600,
          color: "#6b7280",
          userSelect: "none",
        }}
      >
        {label}:
      </span>
      {ids.flatMap((id, idx) => {
        const t = byId.get(id);
        const items: React.ReactNode[] = [];
        if (visualIdx === idx)
          items.push(<i key={`i-${idx}`} style={insStyle} />);
        const sel = filters[id];
        const active =
          sel && sel.size > 0 && sel.size < (t?.order.length ?? 99);
        items.push(
          <span
            key={id}
            draggable
            data-chip
            onDragStart={(e) => start(e, id, idx)}
            onDragEnd={end}
            style={{
              position: "relative",
              padding: "0",
              background: active ? "#f3f0ff" : "#fff",
              border: active ? "1px solid #c4b5fd" : "1px solid #e5e7eb",
              borderRadius: 8,
              fontSize: 12,
              display: "inline-flex",
              alignItems: "stretch",
              boxShadow: "0 1px 2px rgba(0,0,0,0.04)",
              transition: "all .15s",
              cursor: "grab",
              lineHeight: "22px",
            }}
          >
            {t ? (
              <>
                <span
                  style={{
                    padding: "0 7px",
                    background: "#ccfbf1",
                    color: "#0f766e",
                    fontWeight: 600,
                    fontSize: 11,
                    whiteSpace: "nowrap",
                    display: "flex",
                    alignItems: "center",
                    borderRadius: "7px 0 0 7px",
                  }}
                >
                  {t.category}
                </span>
                <span
                  className="chip-name"
                  style={{
                    padding: "0 6px",
                    color: "#475569",
                    transition: "color .15s",
                    whiteSpace: "nowrap",
                    display: "flex",
                    alignItems: "center",
                  }}
                >
                  {t.name}
                </span>
              </>
            ) : (
              id
            )}
            <span
              data-ft
              onClick={() => onOpenFilter(filterOpen === id ? null : id)}
              style={{
                cursor: "pointer",
                padding: "0 2px",
                color: "#6366f1",
                display: "flex",
                alignItems: "center",
              }}
            >
              <svg width="12" height="14" viewBox="0 0 12 14" fill="none">
                <path
                  d="M1 2h10L7 6.5V13L5 10.5V6.5L1 2z"
                  stroke="currentColor"
                  strokeWidth="1.2"
                  strokeLinejoin="round"
                />
              </svg>
            </span>
            <button
              onClick={() => onMove(id, "remove")}
              style={{
                border: "none",
                background: "none",
                cursor: "pointer",
                fontSize: 16,
                lineHeight: "22px",
                padding: "0 4px",
                color: "#ef4444",
                display: "flex",
                alignItems: "center",
              }}
            >
              ×
            </button>
            {filterOpen === id && t && (
              <div
                data-filter-panel
                onClick={(e) => e.stopPropagation()}
                style={{
                  position: "absolute",
                  top: "100%",
                  left: 0,
                  zIndex: 200,
                  marginTop: 4,
                  padding: "4px 4px",
                  background: "#fff",
                  border: "1px solid #e5e7eb",
                  borderRadius: 8,
                  boxShadow: "0 4px 16px rgba(0,0,0,0.08)",
                  fontSize: 12,
                  display: "flex",
                  flexDirection: "column",
                  gap: 1,
                  whiteSpace: "nowrap",
                  width: "max-content",
                }}
              >
                {t.order.map((v) => {
                  const checked = sel?.has(v) ?? false;
                  return (
                    <div
                      key={v}
                      data-filter-item
                      onClick={() => onSetFilter(id, v, !checked)}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 4,
                        cursor: "pointer",
                        padding: "3px 8px",
                        borderRadius: 4,
                        userSelect: "none",
                        background: checked ? "#f3f0ff" : undefined,
                        color: checked ? "#6366f1" : undefined,
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        readOnly
                        style={{ pointerEvents: "none", width: 12, height: 12, margin: 0, flexShrink: 0 }}
                      />
                      {v}
                    </div>
                  );
                })}
              </div>
            )}
          </span>,
        );
        return items;
      })}
      {visualIdx === ids.length && ids.length > 0 && (
        <i key="i-end" style={insStyle} />
      )}
      {available.length > 0 && (
        <span style={{ position: "relative" }}>
          <button
            data-add-btn
            onClick={() => onSetAddOpenSide(addOpenSide === side ? null : side)}
            style={{
              fontSize: 12,
              padding: "3px 8px",
              borderRadius: 8,
              border: "1px solid #e5e7eb",
              background: "#fff",
              color: "#64748b",
              cursor: "pointer",
              fontFamily: "inherit",
              display: "inline-flex",
              alignItems: "center",
              gap: 3,
            }}
          >
            + 添加
          </button>
          {addOpenSide === side && (
            <div
              data-add-pop
              onClick={(e) => e.stopPropagation()}
              style={{
                position: "absolute",
                top: "100%",
                left: 0,
                zIndex: 200,
                marginTop: 4,
                padding: "4px 0",
                background: "#fff",
                border: "1px solid #e5e7eb",
                borderRadius: 8,
                boxShadow: "0 4px 16px rgba(0,0,0,0.08)",
                fontSize: 12,
                whiteSpace: "nowrap",
                width: "max-content",
              }}
            >
              {available.map((t) => (
                <div
                  key={t.id}
                  data-add-item
                  onClick={() => {
                    onMove(t.id, side);
                    onSetAddOpenSide(null);
                  }}
                  style={{
                    padding: "5px 12px",
                    cursor: "pointer",
                    color: "#475569",
                    transition: "all .1s",
                    display: "flex",
                    alignItems: "center",
                    gap: 6,
                  }}
                >
                  <span
                    style={{
                      padding: "0 5px",
                      borderRadius: 4,
                      background: "#ccfbf1",
                      color: "#0f766e",
                      fontWeight: 600,
                      fontSize: 11,
                      lineHeight: "20px",
                    }}
                  >
                    {t.category}
                  </span>
                  {t.name}
                </div>
              ))}
            </div>
          )}
        </span>
      )}
    </div>
  );
}

const insStyle: React.CSSProperties = {
  display: "inline-block",
  width: 2,
  height: 20,
  borderRadius: 1,
  background: "#6366f1",
  flexShrink: 0,
};

// ---- Remove Zone ----
function RemoveZone({
  onDrop,
  onDragChange,
}: {
  onDrop: (id: string) => void;
  onDragChange: (v: boolean) => void;
}) {
  const [over, setOver] = useState(false);
  return (
    <div
      onDragOver={(e) => {
        e.preventDefault();
        setOver(true);
      }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        e.stopPropagation();
        setOver(false);
        onDragChange(false);
        const id = e.dataTransfer.getData("text/plain");
        if (id) onDrop(id);
      }}
      style={{
        display: "flex",
        alignItems: "center",
        padding: "4px 12px",
        borderRadius: 8,
        border: `2px dashed ${over ? "#ef4444" : "#e5e7eb"}`,
        color: over ? "#ef4444" : "#9ca3af",
        fontSize: 12,
        background: over ? "#fef2f2" : "#fff",
        transition: "all .15s",
        minHeight: 32,
        cursor: "default",
      }}
    >
      拖到此处删除
    </div>
  );
}

const navBtn: React.CSSProperties = {
  border: "1px solid #e5e7eb",
  background: "#fff",
  borderRadius: 6,
  padding: "4px 10px",
  cursor: "pointer",
  fontSize: 13,
  lineHeight: 1,
  color: "#475569",
  fontWeight: 500,
  whiteSpace: "nowrap",
  boxShadow: "0 1px 2px rgba(0,0,0,0.04)",
  transition: "all .15s",
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
};
const baseTd: React.CSSProperties = {
  padding: "5px 8px",
  border: "1px solid #e5e7eb",
  textAlign: "center",
  fontVariantNumeric: "tabular-nums",
  fontSize: 12,
  background: "#fff",
};
const baseTh: React.CSSProperties = {
  padding: "5px 8px",
  border: "1px solid #e5e7eb",
  background: "#f5f3ff",
  textAlign: "center",
  fontWeight: 600,
  whiteSpace: "nowrap",
  fontSize: 12,
  color: "#475569",
};
