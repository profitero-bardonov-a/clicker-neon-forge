#!/usr/bin/env node
/**
 * Bundles the clicker into a single HTML file for offline Android / file:// use.
 * Usage: node build.mjs
 */
import { readFileSync, mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(fileURLToPath(import.meta.url));
const outDir = join(root, "dist");

function read(rel) {
  return readFileSync(join(root, rel), "utf8");
}

/** Strip ESM import/export so scripts run as classic inline JS. */
function demodule(code) {
  return (
    code
      // multi-line / single-line imports
      .replace(/^\s*import\s+[\s\S]*?from\s+["'][^"']+["']\s*;?\s*$/gm, "")
      .replace(/^\s*export\s+\{[^}]*\}\s*;?\s*$/gm, "")
      .replace(/\bexport\s+default\s+/g, "")
      .replace(/\bexport\s+(async\s+)?(function|class|const|let|var)\b/g, "$1$2")
  );
}

const css = read("css/styles.css");
const jsParts = [
  "js/math3d.js",
  "js/cube.js",
  "js/particles.js",
  "js/counter.js",
  "js/main.js",
].map((f) => `/* --- ${f} --- */\n${demodule(read(f))}`);

const js = jsParts.join("\n\n");

const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover, maximum-scale=1.0, user-scalable=no" />
  <meta name="mobile-web-app-capable" content="yes" />
  <meta name="apple-mobile-web-app-capable" content="yes" />
  <title>Clicker — Neon Forge</title>
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <link href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@500;700&family=Syne:wght@700;800&display=swap" rel="stylesheet" />
  <style>
${css}
  </style>
</head>
<body>
  <canvas id="stage" aria-label="Clicker canvas"></canvas>

  <div class="hud" aria-live="polite">
    <div class="brand">NEON FORGE</div>
    <div class="counter" id="counter">
      <span class="counter__label">CLICKS</span>
      <span class="counter__value" id="counter-value">0</span>
    </div>
  </div>

  <script>
${js}
  </script>
</body>
</html>
`;

mkdirSync(outDir, { recursive: true });
const outFile = join(outDir, "clicker.html");
writeFileSync(outFile, html, "utf8");
console.log(`Built ${outFile} (${(html.length / 1024).toFixed(1)} KB)`);
