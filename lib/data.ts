// Build-time loader for the `vn30-web-data/v1` contract. Every file is validated and any
// mismatch throws with the file and field, so a bad export fails `next build` loudly.
import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";

export const SCHEMA = "vn30-web-data/v1";

export type Horizon = "3" | "6" | "12";
export type Returns = Record<Horizon, number | null>;

export type Meta = {
  schema: string;
  generatedAtUtc: string;
  session: string;
  symbols: string[];
  unavailable: { symbol: string; part: string; reason: string }[];
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

export type Direction = "up" | "down" | "sideways" | "no-view";

export type Note = {
  signalDate: string;
  horizonSessions: number;
  direction: Direction;
  thesis: string | null;
  status: string;
  pendingReason: string | null;
  targetDate: string | null;
  returnPct: number | null;
  hit: boolean | null;
};

export type SymbolData = {
  symbol: string;
  label: string;
  isBank: boolean;
  candles: Candle[];
  indicators: Indicators | null;
  relativeStrength: { "20": number | null; "60": number | null } | null;
  notes: Note[];
  score: { scored: number; hits: number };
};

export type SiteData = { meta: Meta; screen: Screen; symbols: Record<string, SymbolData> };

// ---- validation helpers -------------------------------------------------------------

type Obj = Record<string, unknown>;
const DATE = /^\d{4}-\d{2}-\d{2}$/;
// Tickers become URL segments and file names: keep them strictly alphanumeric.
const TICKER = /^[A-Z0-9]{2,10}$/;
const DIRECTIONS = new Set(["up", "down", "sideways", "no-view"]);

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

// ---- per-file parsers ---------------------------------------------------------------

export function parseMeta(raw: unknown, where = "meta.json"): Meta {
  const o = obj(raw, where);
  const schema = str(field(o, "schema", where), `${where}.schema`);
  if (schema !== SCHEMA) fail(`${where}.schema`, `cần "${SCHEMA}", nhận "${schema}"`);
  const symbols = arr(field(o, "symbols", where), `${where}.symbols`).map((s, i) => ticker(s, `${where}.symbols[${i}]`));
  if (symbols.length === 0) fail(`${where}.symbols`, "rỗng");
  if (new Set(symbols).size !== symbols.length) fail(`${where}.symbols`, "có mã trùng");
  return {
    schema,
    generatedAtUtc: str(field(o, "generatedAtUtc", where), `${where}.generatedAtUtc`),
    session: date(field(o, "session", where), `${where}.session`),
    symbols,
    unavailable: arr(field(o, "unavailable", where), `${where}.unavailable`).map((u, i) => {
      const w = `${where}.unavailable[${i}]`;
      const uo = obj(u, w);
      return {
        symbol: str(field(uo, "symbol", w), `${w}.symbol`),
        part: str(field(uo, "part", w), `${w}.part`),
        reason: str(field(uo, "reason", w), `${w}.reason`),
      };
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
  return [
    date(a[0], `${where}[0]`),
    num(a[1], `${where}[1]`),
    num(a[2], `${where}[2]`),
    num(a[3], `${where}[3]`),
    num(a[4], `${where}[4]`),
    num(a[5], `${where}[5]`),
  ];
}

function parseIndicators(v: unknown, where: string): Indicators | null {
  if (v === null) return null;
  const o = obj(v, where);
  const out = { date: dateOrNull(field(o, "date", where), `${where}.date`) } as Indicators;
  for (const k of INDICATOR_KEYS) out[k] = numOrNull(field(o, k, where), `${where}.${k}`);
  return out;
}

function parseNote(v: unknown, where: string): Note {
  const o = obj(v, where);
  const direction = str(field(o, "direction", where), `${where}.direction`);
  if (!DIRECTIONS.has(direction)) fail(`${where}.direction`, `hướng không hợp lệ: ${direction}`);
  return {
    signalDate: date(field(o, "signalDate", where), `${where}.signalDate`),
    horizonSessions: int(field(o, "horizonSessions", where), `${where}.horizonSessions`),
    direction: direction as Direction,
    thesis: strOrNull(field(o, "thesis", where), `${where}.thesis`),
    status: str(field(o, "status", where), `${where}.status`),
    pendingReason: strOrNull(field(o, "pendingReason", where), `${where}.pendingReason`),
    targetDate: dateOrNull(field(o, "targetDate", where), `${where}.targetDate`),
    returnPct: numOrNull(field(o, "returnPct", where), `${where}.returnPct`),
    hit: boolOrNull(field(o, "hit", where), `${where}.hit`),
  };
}

export function parseSymbol(raw: unknown, expected: string, where = `symbols/${expected}.json`): SymbolData {
  const o = obj(raw, where);
  const symbol = ticker(field(o, "symbol", where), `${where}.symbol`);
  if (symbol !== expected) fail(`${where}.symbol`, `cần "${expected}", nhận "${symbol}"`);
  const candles = arr(field(o, "candles", where), `${where}.candles`).map((c, i) => parseCandle(c, `${where}.candles[${i}]`));
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
  const score = obj(field(o, "score", where), `${where}.score`);
  const parsedScore = {
    scored: int(field(score, "scored", `${where}.score`), `${where}.score.scored`),
    hits: int(field(score, "hits", `${where}.score`), `${where}.score.hits`),
  };
  if (parsedScore.hits > parsedScore.scored) fail(`${where}.score`, "hits lớn hơn scored");
  return {
    symbol,
    label: str(field(o, "label", where), `${where}.label`),
    isBank: bool(field(o, "isBank", where), `${where}.isBank`),
    candles,
    indicators: parseIndicators(field(o, "indicators", where), `${where}.indicators`),
    relativeStrength,
    notes: arr(field(o, "notes", where), `${where}.notes`).map((n, i) => parseNote(n, `${where}.notes[${i}]`)),
    score: parsedScore,
  };
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
  for (const s of meta.symbols) symbols[s] = parseSymbol(readJson(dir, `symbols/${s}.json`), s);
  const data = { meta, screen, symbols };
  cache.set(dir, data);
  return data;
}
