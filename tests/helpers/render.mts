// Renders the site's pages to static HTML for tests (module hooks in tsx-loader.mjs) and extracts the text a visitor
// reads. Pages load their data through loadSiteData(), so each render points DATA_DIR at the chosen data directory.
import { register } from "node:module";
import { cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

register("./tsx-loader.mjs", import.meta.url);

export const WEB_ROOT = join(import.meta.dirname, "..", "..");
export const FIXTURE = join(WEB_ROOT, "tests", "fixtures", "data");

const ENTITIES: Record<string, string> = {
  "&amp;": "&", "&lt;": "<", "&gt;": ">", "&quot;": "\"", "&#x27;": "'", "&#39;": "'", "&nbsp;": " ",
};

/**
 * Text as a visitor reads it: scripts dropped, inline tags removed (a span with the `block` class starts a new
 * line, so it counts as a space), other tags as spaces, entities decoded, whitespace collapsed.
 */
export function visibleText(markup: string): string {
  return markup
    .replace(/<(script|style)\b[\s\S]*?<\/\1>/g, " ")
    .replace(/<span\b[^>]*\bclass="(?:[^"]*\s)?block(?:\s[^"]*)?"[^>]*>/g, " ")
    .replace(/<\/?(?:span|a|abbr|strong|em|b|i)\b[^>]*>/g, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/&(?:amp|lt|gt|quot|#x27|#39|nbsp);/g, (e) => ENTITIES[e])
    .replace(/\s+/g, " ")
    .trim();
}

async function withDataDir<T>(dir: string, render: () => Promise<T>): Promise<T> {
  const before = process.env.DATA_DIR;
  process.env.DATA_DIR = dir;
  try {
    return await render();
  } finally {
    if (before === undefined) delete process.env.DATA_DIR;
    else process.env.DATA_DIR = before;
  }
}

export async function renderHome(dir = FIXTURE): Promise<string> {
  const { default: HomePage } = await import("../../app/page.tsx");
  return withDataDir(dir, async () => renderToStaticMarkup(createElement(HomePage)));
}

export async function renderTicker(ticker: string, dir = FIXTURE): Promise<string> {
  const { default: TickerPage } = await import("../../app/ma/[ticker]/page.tsx");
  return withDataDir(dir, async () => renderToStaticMarkup(await TickerPage({ params: Promise.resolve({ ticker }) })));
}

export async function renderMethod(dir = FIXTURE): Promise<string> {
  const { default: MethodPage } = await import("../../app/phuong-phap/page.tsx");
  return withDataDir(dir, async () => renderToStaticMarkup(createElement(MethodPage)));
}

export async function renderLayout(dir = FIXTURE): Promise<string> {
  const { default: RootLayout } = await import("../../app/layout.tsx");
  return withDataDir(dir, async () =>
    renderToStaticMarkup(createElement(RootLayout, { children: createElement("p", null, "NỘI DUNG TRANG") })));
}

type Files = { read: (rel: string) => any; write: (rel: string, value: unknown) => void };
const variants: string[] = [];

/** A copy of the fixture data set edited by `edit` (call cleanupVariants() after the tests). */
export function fixtureVariant(edit: (files: Files) => void): string {
  const dir = mkdtempSync(join(tmpdir(), "vn30-web-test-"));
  variants.push(dir);
  cpSync(FIXTURE, dir, { recursive: true });
  edit({
    read: (rel) => JSON.parse(readFileSync(join(dir, rel), "utf8")),
    write: (rel, value) => writeFileSync(join(dir, rel), JSON.stringify(value)),
  });
  return dir;
}

export function cleanupVariants(): void {
  for (const dir of variants.splice(0)) rmSync(dir, { recursive: true, force: true });
}
