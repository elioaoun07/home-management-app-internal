import * as esbuild from "esbuild";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
const HERE = dirname(fileURLToPath(import.meta.url));
const options = (plugins = []) => ({
  entryPoints: [join(HERE, "app/main.tsx")],
  outdir: "pm-app",
  bundle: true,
  format: "esm",
  target: "es2022",
  write: false,
  minify: true,
  jsx: "automatic",
  jsxImportSource: "react",
  tsconfig: join(HERE, "../../tsconfig.json"),
  define: { "process.env.NODE_ENV": '"production"' },
  loader: { ".woff2": "dataurl" },
  logLevel: "silent",
  plugins,
});
function assets(result) {
  const js = result.outputFiles.find((file) => file.path.endsWith(".js"))?.text,
    css = result.outputFiles.find((file) => file.path.endsWith(".css"))?.text;
  if (!js || !css) throw new Error("PM app build is incomplete");
  return { js, css };
}
export async function buildApp() {
  return assets(await esbuild.build(options()));
}
export async function createAppWatcher(onRebuild = () => {}) {
  let current;
  const ctx = await esbuild.context(
    options([
      {
        name: "pm-app-cache",
        setup(build) {
          build.onEnd((result) => {
            if (!result.errors.length) {
              current = assets(result);
              onRebuild();
            }
          });
        },
      },
    ]),
  );
  await ctx.rebuild();
  await ctx.watch();
  return { current: () => current, dispose: () => ctx.dispose() };
}
if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const result = await buildApp();
  process.stdout.write(
    `PM React app ready: ${result.js.length} B JS + ${result.css.length} B CSS\n`,
  );
}
