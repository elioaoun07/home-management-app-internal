import * as esbuild from "esbuild";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const HERE = dirname(fileURLToPath(import.meta.url));

function options({ minify = false, plugins = [] } = {}) {
  return {
    entryPoints: [join(HERE, "src", "main.jsx"), join(HERE, "src", "styles", "index.css")],
    outdir: "pm-bundle",
    bundle: true,
    format: "iife",
    target: "es2020",
    write: false,
    minify,
    sourcemap: minify ? false : "inline",
    jsx: "automatic",
    jsxImportSource: "preact",
    loader: { ".woff2": "dataurl" },
    logLevel: "silent",
    plugins,
  };
}

function bundleFrom(result) {
  const js = result.outputFiles.find((file) => file.path.endsWith(".js"));
  const css = result.outputFiles.find((file) => file.path.endsWith(".css"));
  if (!js || !css) throw new Error("PM UI build did not emit both JavaScript and CSS");
  return { js: js.text, css: css.text };
}

export async function buildBundle({ minify = false } = {}) {
  return bundleFrom(await esbuild.build(options({ minify })));
}

export async function createBundleWatcher(onRebuild = () => {}) {
  let currentBundle = null;
  const cachePlugin = {
    name: "pm-ui-memory-cache",
    setup(build) {
      build.onEnd((result) => {
        if (result.errors.length) return;
        currentBundle = bundleFrom(result);
        onRebuild(currentBundle);
      });
    },
  };
  const ctx = await esbuild.context(options({ minify: false, plugins: [cachePlugin] }));
  await ctx.rebuild();
  await ctx.watch();
  return {
    current() {
      if (!currentBundle) throw new Error("PM UI bundle is not ready");
      return currentBundle;
    },
    dispose: () => ctx.dispose(),
  };
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const bundle = await buildBundle({ minify: true });
  process.stdout.write(`PM UI bundle ready: ${bundle.js.length} B JS + ${bundle.css.length} B CSS\n`);
}

