// Test-only module hooks (registered by tests/helpers/render.mts): compile the site's .tsx files with the project's
// TypeScript (JSX → react/jsx-runtime), resolve the extension-less "next/*" entry points and load CSS imports as
// empty modules, so node:test can render pages and components to static HTML without a Next build.
import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";

const ts = createRequire(import.meta.url)("typescript");

export async function resolve(specifier, context, nextResolve) {
  if (specifier === "next/link" || specifier === "next/navigation") return nextResolve(`${specifier}.js`, context);
  return nextResolve(specifier, context);
}

export async function load(url, context, nextLoad) {
  if (url.endsWith(".css")) return { format: "module", source: "export default {};", shortCircuit: true };
  if (!url.endsWith(".tsx")) return nextLoad(url, context);
  const source = await readFile(new URL(url), "utf8");
  const { outputText } = ts.transpileModule(source, {
    fileName: url,
    compilerOptions: { jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
  });
  return { format: "module", source: outputText, shortCircuit: true };
}
