import assert from "node:assert/strict";
import { pathToFileURL } from "node:url";
import { resolveConfig, optimizeDeps } from "vite";

// Exercita a conversão usada pelo navegador no modo dev, sem abrir portas.
const config = await resolveConfig({ logLevel: "error" }, "serve");
const dependencies = await optimizeDeps(config, true);
const optimized = dependencies.optimized.echarts;
assert.ok(optimized, "ECharts local precisa participar da conversão para ESM");
const module = await import(pathToFileURL(optimized.file).href);
assert.equal(typeof module.default.init, "function");
assert.equal(typeof module.default.registerMap, "function");
console.log(
  "ECharts no modo dev: módulo ESM carregado com init e registerMap.",
);
