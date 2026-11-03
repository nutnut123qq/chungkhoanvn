// Build-time loader for the `vn30-web-data/v2` contract. Every file is validated and any mismatch throws with the
// file and field, so a bad export fails `next build` loudly; a v1 data set fails on its schema name, because v2
// changed what `notes`, `score` and `thesis` mean.
import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";

export const SCHEMA = "vn30-web-data/v2";

/** The site shows and scores 20-session notes only (the exporter drops every other horizon). */
export const NOTE_HORIZON = 20;
/** At most this many notes per ticker, newest first; the score counts the whole journal, not only these. */
export const NOTE_LIMIT = 60;
export const CANDLE_LIMIT = 260;
/** A longer thesis is cut to THESIS_MAX - 1 characters followed by THESIS_CUT_MARK. */
export const THESIS_MAX = 1500;
export const THESIS_CUT_MARK = "…";

export const PARTS = ["candles", "technical", "notes"] as const;
export type Part = (typeof PARTS)[number];

export const DIRECTIONS = ["up", "down", "sideways", "no-view"] as const;
export type Direction = (typeof DIRECTIONS)[number];

/** Export statuses: the backend's "resolved" is exported as "scored"; superseded and retrospective notes are dropped. */
export const NOTE_STATUSES = [
  "pending", "scored", "no-view", "out-of-window-not-scored", "window-undetermined-not-scored",
] as const;
export type NoteStatus = (typeof NOTE_STATUSES)[number];

export const PENDING_REASONS = ["immature", "target-bar-missing", "calendar-coverage-expired", "signal-bar-missing"] as const;
export type PendingReason = (typeof PENDING_REASONS)[number];

/** The backend's H=20 horizon status: no-data, insufficient-sample (nEffective below its minimum) or ok. */
export const SAMPLE_STATUSES = ["no-data", "insufficient-sample", "ok"] as const;
export type SampleStatus = (typeof SAMPLE_STATUSES)[number];

/** The exporter ends an unavailable part's reason with one of these when it kept, or had nothing to keep. */
export const KEPT_SUFFIX = "; giữ dữ liệu lượt trước";
export const NOTHING_KEPT_SUFFIX = "; chưa có dữ liệu lượt trước";

export type Horizon = "3" | "6" | "12";
export type Returns = Record<Horizon, number | null>;

export type UnavailableEntry = { symbol: string; part: Part; reason: string };

export type Meta = {
  schema: string;
  generatedAtUtc: string;
  session: string;
  symbols: string[];
  unavailable: UnavailableEntry[];
  source: string;
};

export type ScreenRow = {
  symbol: string;
  close: number | null;
  returns: Returns;
  excessVsIndex: Returns;
  rank: number | null;
  top: boolean;
};

export type Screen = {
  session: string;
  basket: { effectiveDate: string | null; possiblyStale: boolean };
  indexReturns: Returns;
  rankingMonths: number;
  topK: number;
  missingSessionBar: string[];
  notUpToDate: string[];
  rows: ScreenRow[];
};

/** [date, open, high, low, close, volume] */
export type Candle = [string, number, number, number, number, number];

export const INDICATOR_KEYS = [
  "close", "sma50", "sma200", "ema12", "ema26", "ema50", "ema200", "rsi14",
  "macd", "macdSignal", "macdHistogram",
  "bollingerUpper", "bollingerMiddle", "bollingerLower", "atr14",
] as const;

export type Indicators = { date: string | null } & Record<(typeof INDICATOR_KEYS)[number], number | null>;

export type Note = {
  signalDate: string;
  horizonSessions: number;
  direction: Direction;
  thesis: string | null;
  status: NoteStatus;
  pendingReason: PendingReason | null;
  targetDate: string | null;
  returnPct: number | null;
  hit: boolean | null;
};

/** The backend's whole-journal H=20 totals: hits of the notes and of the rule's prior baseline on the same scored set. */
export type Score = { scored: number; hits: number; baselineHits: number; sampleStatus: SampleStatus };

export type SymbolData = {
  symbol: string;
  label: string;
  isBank: boolean;
  candles: Candle[];
  indicators: Indicators | null;
  relativeStrength: { "20": number | null; "60": number | null } | null;
  notes: Note[];
  /** null when the notes part could not be read and nothing was kept: unknown, never "not scored". */
  score: Score | null;
};

export type SiteData = { meta: Meta; screen: Screen; symbols: Record<string, SymbolData> };

// ---- validation helpers -------------------------------------------------------------

type Obj = Record<string, unknown>;
const DATE = /^\d{4}-\d{2}-\d{2}$/;
// Tickers become URL segments and file names: keep them strictly alphanumeric.
const TICKER = /^[A-Z0-9]{2,10}$/;

function fail(where: string, msg: string): never {
  throw new Error(`[data] ${where}: ${msg}`);
}

function obj(v: unknown, where: string): Obj {
  if (typeof v !== "object" || v === null || Array.isArray(v)) fail(where, "phải là object");
  return v as Obj;
}

function arr(v: unknown, where: string): unknown[] {
  if (!Array.isArray(v)) fail(where, "phải là mảng");
  return v;
}

function str(v: unknown, where: string): string {
  if (typeof v !== "string") fail(where, "phải là chuỗi");
  return v;
}

function strOrNull(v: unknown, where: string): string | null {
  return v === null ? null : str(v, where);
}

function date(v: unknown, where: string): string {
  const s = str(v, where);
  if (!DATE.test(s)) fail(where, `ngày không đúng dạng YYYY-MM-DD: ${s}`);
  return s;
}

function dateOrNull(v: unknown, where: string): string | null {
  return v === null ? null : date(v, where);
}

function num(v: unknown, where: string): number {
  if (typeof v !== "number" || !Number.isFinite(v)) fail(where, "phải là số hữu hạn");
  return v;
}

function numOrNull(v: unknown, where: string): number | null {
  return v === null ? null : num(v, where);
}

function int(v: unknown, where: string): number {
  const n = num(v, where);
  if (!Number.isInteger(n) || n < 0) fail(where, "phải là số nguyên không âm");
  return n;
}

function bool(v: unknown, where: string): boolean {
  if (typeof v !== "boolean") fail(where, "phải là true/false");
  return v;
}

function boolOrNull(v: unknown, where: string): boolean | null {
  return v === null ? null : bool(v, where);
}

function oneOf<T extends string>(v: unknown, allowed: readonly T[], where: string): T {
  const s = str(v, where);
  if (!(allowed as readonly string[]).includes(s)) fail(where, `giá trị không hợp lệ "${s}" (chỉ nhận ${allowed.join(", ")})`);
  return s as T;
}

/** The key must be present (a missing key is a schema mismatch; `null` is allowed where the contract says so). */
function field(o: Obj, key: string, where: string): unknown {
  if (!(key in o)) fail(where, `thiếu trường "${key}"`);
  return o[key];
}

function ticker(v: unknown, where: string): string {
  const s = str(v, where);
  if (!TICKER.test(s)) fail(where, `mã không hợp lệ: ${s}`);
  return s;
}

function returns(v: unknown, where: string): Returns {
  const o = obj(v, where);
  return {
    "3": numOrNull(field(o, "3", where), `${where}.3`),
    "6": numOrNull(field(o, "6", where), `${where}.6`),
    "12": numOrNull(field(o, "12", where), `${where}.12`),
  };
}

/** Length in characters (code points), the unit the exporter cuts the thesis in. */
function charLength(s: string): number {
  return [...s].length;
}

// ---- per-file parsers ---------------------------------------------------------------

export function parseMeta(raw: unknown, where = "meta.json"): Meta {
  const o = obj(raw, where);
  const schema = str(field(o, "schema", where), `${where}.schema`);
  if (schema !== SCHEMA) fail(`${where}.schema`, `cần "${SCHEMA}", nhận "${schema}"`);
  const symbols = arr(field(o, "symbols", where), `${where}.symbols`).map((s, i) => ticker(s, `${where}.symbols[${i}]`));
  if (symbols.length === 0) fail(`${where}.symbols`, "rỗng");
  if (new Set(symbols).size !== symbols.length) fail(`${where}.symbols`, "có mã trùng");
  const known = new Set(symbols);
  return {
    schema,
    generatedAtUtc: str(field(o, "generatedAtUtc", where), `${where}.generatedAtUtc`),
    session: date(field(o, "session", where), `${where}.session`),
    symbols,
    unavailable: arr(field(o, "unavailable", where), `${where}.unavailable`).map((u, i) => {
      const w = `${where}.unavailable[${i}]`;
      const uo = obj(u, w);
      const symbol = ticker(field(uo, "symbol", w), `${w}.symbol`);
      if (!known.has(symbol)) fail(`${w}.symbol`, `mã ${symbol} không có trong symbols`);
      const reason = str(field(uo, "reason", w), `${w}.reason`);
      if (reason.trim() === "") fail(`${w}.reason`, "rỗng");
      return { symbol, part: oneOf(field(uo, "part", w), PARTS, `${w}.part`), reason };
    }),
    source: str(field(o, "source", where), `${where}.source`),
  };
}

export function parseScreen(raw: unknown, where = "screen.json"): Screen {
  const o = obj(raw, where);
  const basket = obj(field(o, "basket", where), `${where}.basket`);
  const strList = (key: string) =>
    arr(field(o, key, where), `${where}.${key}`).map((s, i) => str(s, `${where}.${key}[${i}]`));
  return {
    session: date(field(o, "session", where), `${where}.session`),
    basket: {
      effectiveDate: dateOrNull(field(basket, "effectiveDate", `${where}.basket`), `${where}.basket.effectiveDate`),
      possiblyStale: bool(field(basket, "possiblyStale", `${where}.basket`), `${where}.basket.possiblyStale`),
    },
    indexReturns: returns(field(o, "indexReturns", where), `${where}.indexReturns`),
    rankingMonths: int(field(o, "rankingMonths", where), `${where}.rankingMonths`),
    topK: int(field(o, "topK", where), `${where}.topK`),
    missingSessionBar: strList("missingSessionBar"),
    notUpToDate: strList("notUpToDate"),
    rows: arr(field(o, "rows", where), `${where}.rows`).map((r, i) => {
      const w = `${where}.rows[${i}]`;
      const ro = obj(r, w);
      const rank = field(ro, "rank", w);
      return {
        symbol: ticker(field(ro, "symbol", w), `${w}.symbol`),
        close: numOrNull(field(ro, "close", w), `${w}.close`),
        returns: returns(field(ro, "returns", w), `${w}.returns`),
        excessVsIndex: returns(field(ro, "excessVsIndex", w), `${w}.excessVsIndex`),
        rank: rank === null ? null : int(rank, `${w}.rank`),
        top: bool(field(ro, "top", w), `${w}.top`),
      };
    }),
  };
}

function parseCandle(v: unknown, where: string): Candle {
  const a = arr(v, where);
  if (a.length !== 6) fail(where, "nến phải có 6 phần tử [ngày, mở, cao, thấp, đóng, khối lượng]");
  const candle: Candle = [
    date(a[0], `${where}[0]`),
    num(a[1], `${where}[1]`),
    num(a[2], `${where}[2]`),
    num(a[3], `${where}[3]`),
    num(a[4], `${where}[4]`),
    num(a[5], `${where}[5]`),
  ];
  if (candle[5] <= 0) fail(`${where}[5]`, "khối lượng phải lớn hơn 0");
  return candle;
}

function parseIndicators(v: unknown, where: string): Indicators | null {
  if (v === null) return null;
  const o = obj(v, where);
  const out = { date: dateOrNull(field(o, "date", where), `${where}.date`) } as Indicators;
  for (const k of INDICATOR_KEYS) out[k] = numOrNull(field(o, k, where), `${where}.${k}`);
  return out;
}

/**
 * One exported note. Besides the enums, the combinations the backend never produces are rejected, so a page can
 * never show, say, "Không nhận định" next to "Đúng": hit is true/false exactly for scored notes; a scored note has
 * a return and a target date and no pending reason; a pending note has a reason; pending and scored notes have a
 * direction, and the no-view status goes with the no-view direction.
 */
function parseNote(v: unknown, where: string): Note {
  const o = obj(v, where);
  const horizonSessions = int(field(o, "horizonSessions", where), `${where}.horizonSessions`);
  if (horizonSessions !== NOTE_HORIZON) {
    fail(`${where}.horizonSessions`, `trang chỉ nhận nhận định ${NOTE_HORIZON} phiên, nhận ${horizonSessions}`);
  }
  const direction = oneOf(field(o, "direction", where), DIRECTIONS, `${where}.direction`);
  const status = oneOf(field(o, "status", where), NOTE_STATUSES, `${where}.status`);
  const reasonRaw = field(o, "pendingReason", where);
  const pendingReason = reasonRaw === null ? null : oneOf(reasonRaw, PENDING_REASONS, `${where}.pendingReason`);
  const thesis = strOrNull(field(o, "thesis", where), `${where}.thesis`);
  if (thesis !== null && charLength(thesis) > THESIS_MAX) fail(`${where}.thesis`, `dài hơn ${THESIS_MAX} ký tự`);
  const note: Note = {
    signalDate: date(field(o, "signalDate", where), `${where}.signalDate`),
    horizonSessions,
    direction,
    thesis,
    status,
    pendingReason,
    targetDate: dateOrNull(field(o, "targetDate", where), `${where}.targetDate`),
    returnPct: numOrNull(field(o, "returnPct", where), `${where}.returnPct`),
    hit: boolOrNull(field(o, "hit", where), `${where}.hit`),
  };
  if ((status === "scored") !== (note.hit !== null)) fail(`${where}.hit`, `chỉ nhận định "scored" mới có true/false (status "${status}")`);
  if (status === "scored" && (pendingReason !== null || note.returnPct === null || note.targetDate === null)) {
    fail(where, "nhận định đã chấm phải có returnPct, targetDate và pendingReason null");
  }
  if (status === "pending" && pendingReason === null) fail(`${where}.pendingReason`, "nhận định đang chờ phải có lý do");
  if ((status === "scored" || status === "pending") && direction === "no-view") {
    fail(`${where}.direction`, `"no-view" không thể có status "${status}"`);
  }
  if (status === "no-view" && direction !== "no-view") fail(`${where}.status`, `status "no-view" cần direction "no-view", nhận "${direction}"`);
  return note;
}

function parseScore(v: unknown, where: string): Score | null {
  if (v === null) return null;
  const o = obj(v, where);
  const score: Score = {
    scored: int(field(o, "scored", where), `${where}.scored`),
    hits: int(field(o, "hits", where), `${where}.hits`),
    baselineHits: int(field(o, "baselineHits", where), `${where}.baselineHits`),
    sampleStatus: oneOf(field(o, "sampleStatus", where), SAMPLE_STATUSES, `${where}.sampleStatus`),
  };
  if (score.hits > score.scored) fail(`${where}.hits`, "lớn hơn scored");
  if (score.baselineHits > score.scored) fail(`${where}.baselineHits`, "lớn hơn scored");
  if ((score.scored === 0) !== (score.sampleStatus === "no-data")) {
    fail(`${where}.sampleStatus`, `"no-data" khi và chỉ khi scored = 0 (scored ${score.scored}, "${score.sampleStatus}")`);
  }
  return score;
}

export function parseSymbol(raw: unknown, expected: string, where = `symbols/${expected}.json`): SymbolData {
  const o = obj(raw, where);
  const symbol = ticker(field(o, "symbol", where), `${where}.symbol`);
  if (symbol !== expected) fail(`${where}.symbol`, `cần "${expected}", nhận "${symbol}"`);
  const candles = arr(field(o, "candles", where), `${where}.candles`).map((c, i) => parseCandle(c, `${where}.candles[${i}]`));
  if (candles.length > CANDLE_LIMIT) fail(`${where}.candles`, `nhiều hơn ${CANDLE_LIMIT} nến`);
  for (let i = 1; i < candles.length; i++) {
    if (candles[i][0] <= candles[i - 1][0]) fail(`${where}.candles[${i}]`, "ngày phải tăng dần, không trùng");
  }
  const rsRaw = field(o, "relativeStrength", where);
  let relativeStrength: SymbolData["relativeStrength"] = null;
  if (rsRaw !== null) {
    const rs = obj(rsRaw, `${where}.relativeStrength`);
    relativeStrength = {
      "20": numOrNull(field(rs, "20", `${where}.relativeStrength`), `${where}.relativeStrength.20`),
      "60": numOrNull(field(rs, "60", `${where}.relativeStrength`), `${where}.relativeStrength.60`),
    };
  }
  const notes = arr(field(o, "notes", where), `${where}.notes`).map((n, i) => parseNote(n, `${where}.notes[${i}]`));
  if (notes.length > NOTE_LIMIT) fail(`${where}.notes`, `nhiều hơn ${NOTE_LIMIT} nhận định`);
  // Newest first: the home table and the ticker card show notes[0] as the latest call.
  for (let i = 1; i < notes.length; i++) {
    if (notes[i].signalDate > notes[i - 1].signalDate) {
      fail(`${where}.notes[${i}]`, `sai thứ tự: phải mới nhất trước (${notes[i].signalDate} đứng sau ${notes[i - 1].signalDate})`);
    }
  }
  const score = parseScore(field(o, "score", where), `${where}.score`);
  if (score === null && notes.length > 0) fail(`${where}.score`, "null nhưng notes không rỗng");
  return {
    symbol,
    label: str(field(o, "label", where), `${where}.label`),
    isBank: bool(field(o, "isBank", where), `${where}.isBank`),
    candles,
    indicators: parseIndicators(field(o, "indicators", where), `${where}.indicators`),
    relativeStrength,
    notes,
    score,
  };
}

// ---- what a part of a ticker may claim (meta.unavailable) ---------------------------

export type PartUnavailable = {
  /** The exporter kept the previous run's values: the page shows those. */
  kept: boolean;
  /** The exporter had nothing to keep and wrote the part empty. */
  nothingKept: boolean;
  /** The exporter's reasons without the kept/nothing-kept suffix, de-duplicated, in file order. */
  reasons: string[];
};

function stripSuffix(reason: string): string {
  for (const suffix of [KEPT_SUFFIX, NOTHING_KEPT_SUFFIX]) {
    if (reason.endsWith(suffix)) return reason.slice(0, -suffix.length).trim();
  }
  return reason.trim();
}

/** The part's own entries in meta.unavailable, or null when the latest export read it fresh. */
export function partUnavailable(meta: Meta, symbol: string, part: Part): PartUnavailable | null {
  const own = meta.unavailable.filter((u) => u.symbol === symbol && u.part === part);
  if (own.length === 0) return null;
  return {
    kept: own.some((u) => u.reason.endsWith(KEPT_SUFFIX)),
    nothingKept: own.some((u) => u.reason.endsWith(NOTHING_KEPT_SUFFIX)),
    reasons: [...new Set(own.map((u) => stripSuffix(u.reason)).filter((r) => r !== ""))],
  };
}

/**
 * fresh: read by the latest export; kept: the values are the previous export's; missing: not read this run and
 * nothing kept (including a part the backend does not serve, UNSUPPORTED_CAPABILITY). A candles failure keeps the
 * previous file whole, so the other parts of that ticker are then "kept" too.
 */
export type PartState = "fresh" | "kept" | "missing";

export function partState(meta: Meta, symbol: string, part: Part): PartState {
  const own = partUnavailable(meta, symbol, part);
  if (own) return own.kept ? "kept" : "missing";
  if (part !== "candles" && partUnavailable(meta, symbol, "candles")?.kept) return "kept";
  return "fresh";
}

/**
 * What the notes and the score of a ticker may claim. `known` is false when the notes part was not read and
 * nothing was kept, or the score is null: the pages then show "—" / "chưa lấy được", never "no notes" or
 * "not scored". `kept` marks values copied from the previous export.
 */
export type NotesView = { known: boolean; kept: boolean };

export function notesView(meta: Meta, symbol: string, score: Score | null): NotesView {
  const state = partState(meta, symbol, "notes");
  return { known: state !== "missing" && score !== null, kept: state === "kept" };
}

const PART_LABELS: Record<Part, string> = { candles: "nến", technical: "chỉ báo kỹ thuật", notes: "nhận định" };

function joinVi(items: string[]): string {
  return items.length <= 1 ? (items[0] ?? "") : `${items.slice(0, -1).join(", ")} và ${items[items.length - 1]}`;
}

/**
 * One Vietnamese sentence per group of unavailable parts of a ticker (parts with the same reasons share one
 * sentence), naming each part once and saying whether the page shows the previous run's values.
 */
export function unavailableLines(meta: Meta, symbol: string): string[] {
  const groups = new Map<string, { parts: Part[]; u: PartUnavailable }>();
  for (const part of PARTS) {
    const u = partUnavailable(meta, symbol, part);
    if (!u) continue;
    const key = JSON.stringify([u.kept, u.nothingKept, u.reasons]);
    const group = groups.get(key);
    if (group) group.parts.push(part);
    else groups.set(key, { parts: [part], u });
  }
  return [...groups.values()].map(({ parts, u }) => {
    const what = joinVi(parts.map((p) => PART_LABELS[p]));
    const why = u.reasons.length > 0 ? `: ${u.reasons.join("; ")}` : "";
    if (u.kept) {
      const shown = parts.includes("candles")
        ? "Biểu đồ, chỉ báo và nhận định trên trang này là của lượt cập nhật trước."
        : `Phần ${what} trên trang này là của lượt cập nhật trước.`;
      return `Lượt cập nhật gần nhất chưa lấy được ${what}${why}. ${shown}`;
    }
    if (u.nothingKept) return `Lượt cập nhật gần nhất chưa lấy được ${what}${why}. Chưa có dữ liệu lượt trước để hiện thay.`;
    return `Chưa lấy được ${what}${why}.`;
  });
}

/** True when the exporter cut the thesis (THESIS_MAX characters ending with the cut mark). */
export function thesisWasCut(thesis: string): boolean {
  return thesis.endsWith(THESIS_CUT_MARK) && charLength(thesis) === THESIS_MAX;
}

// ---- loading ------------------------------------------------------------------------

export function dataDir(): string {
  return resolve(process.cwd(), process.env.DATA_DIR || "data");
}

function readJson(dir: string, rel: string): unknown {
  const path = join(dir, rel);
  let text: string;
  try {
    text = readFileSync(path, "utf8");
  } catch (e) {
    fail(rel, `không đọc được ${path}: ${(e as Error).message}`);
  }
  try {
    return JSON.parse(text);
  } catch (e) {
    fail(rel, `JSON lỗi: ${(e as Error).message}`);
  }
}

/** Reads and validates the whole data set once per process (memoised per directory). */
const cache = new Map<string, SiteData>();

export function loadSiteData(dir = dataDir()): SiteData {
  const hit = cache.get(dir);
  if (hit) return hit;
  const meta = parseMeta(readJson(dir, "meta.json"));
  const screen = parseScreen(readJson(dir, "screen.json"));
  if (screen.session !== meta.session) fail("screen.json.session", `khác meta.json (${meta.session})`);
  const known = new Set(meta.symbols);
  for (const r of screen.rows) if (!known.has(r.symbol)) fail("screen.json.rows", `mã ${r.symbol} không có trong meta.symbols`);
  const symbols: Record<string, SymbolData> = {};
  for (const s of meta.symbols) {
    const rel = `symbols/${s}.json`;
    const data = parseSymbol(readJson(dir, rel), s);
    const notesState = partState(meta, s, "notes");
    // score null means "the notes part is unknown": meta.unavailable must say so.
    if (data.score === null && notesState === "fresh") fail(`${rel}.score`, "null nhưng meta.unavailable không có phần notes của mã này");
    // A part written empty (nothing kept, or not served) has no notes to show.
    if (notesState === "missing" && data.notes.length > 0) fail(`${rel}.notes`, "meta.unavailable ghi chưa lấy được nhận định nhưng notes không rỗng");
    symbols[s] = data;
  }
  const data = { meta, screen, symbols };
  cache.set(dir, data);
  return data;
}
