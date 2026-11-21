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
function roomOptions(plugins = []) {
  return { ...options(plugins), entryPoints: [join(HERE, "app/brain/world.ts")], outfile: "brain-room.js", outdir: undefined };
}
function assets(result) {
  const js = result.outputFiles.find((file) => file.path.endsWith(".js"))?.text,
    css = result.outputFiles.find((file) => file.path.endsWith(".css"))?.text;
  if (!js || !css) throw new Error("PM app build is incomplete");
  return { js, css };
}
export async function buildApp() {
  const [main, room] = await Promise.all([esbuild.build(options()), esbuild.build(roomOptions())]);
  return { ...assets(main), room: room.outputFiles[0].text };
}
export async function createAppWatcher(onRebuild = () => {}) {
  let main, room, published;
  const publish = () => {
    if (!main || !room) return;
    if (published?.js === main.js && published.css === main.css && published.room === room) return;
    const changed = !!published;
    published = { ...main, room };
    if (changed) onRebuild();
  };
  const ctx = await esbuild.context(
    options([
      {
        name: "pm-app-cache",
        setup(build) {
          build.onEnd((result) => {
            if (!result.errors.length) {
              main = assets(result);
              publish();
            }
          });
        },
      },
    ]),
  );
  const world = await esbuild.context(roomOptions([{
    name: "pm-room-cache",
    setup(build) {
      build.onEnd((result) => {
        if (!result.errors.length) { room = result.outputFiles[0].text; publish(); }
      });
    },
  }]));
  await Promise.all([ctx.rebuild(), world.rebuild()]);
  await Promise.all([ctx.watch(), world.watch()]);
  return { current: () => published, dispose: () => Promise.all([ctx.dispose(), world.dispose()]) };
}
if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const result = await buildApp();
  process.stdout.write(
    `PM React app ready: ${result.js.length} B JS + ${result.css.length} B CSS\n`,
  );
}
