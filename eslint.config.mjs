// eslint.config.mjs
import { FlatCompat } from "@eslint/eslintrc";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const compat = new FlatCompat({
  baseDirectory: __dirname,
});

const config = [
  // Flat config's built-in ignores cover node_modules/.git and nothing else, so
  // a bare `eslint` (this repo's `pnpm lint`) walked build output too: `.next`
  // alone held ~5,130 emitted JS files, all linted with the type-aware
  // next/typescript rules. The result was not a lint failure but a V8 OOM —
  // `pnpm lint` died with "Reached heap limit ... JavaScript heap out of memory"
  // (exit 134) after ~7.5 minutes, every single time.
  //
  // That had a governance consequence beyond the wasted time: the Delivery
  // pipeline's launch preflight runs the full validation ladder, so EVERY
  // delivery session saw a red baseline on `lint` and required the owner's
  // red-baseline acknowledgment for a failure that was never about the code.
  // A guard that always fires teaches you to wave it through.
  {
    ignores: [
      ".next/**",
      "out/**",
      "build/**",
      "coverage/**",
      "scripts/pm/dist/**",
      "public/atlas/**",
      "next-env.d.ts",
    ],
  },
  ...compat.extends("next/core-web-vitals", "next/typescript"),
  {
    rules: {
      "@typescript-eslint/no-explicit-any": "error",
      "@typescript-eslint/no-unused-vars": [
        "warn",
        { argsIgnorePattern: "^_" },
      ],
      "react/no-unescaped-entities": "off",
      "react-hooks/exhaustive-deps": "error",
    },
  },
  // DLV-52: standalone Node build/utility scripts are CommonJS by design — they
  // are run directly with `node`, never bundled, and `.cjs` is explicitly the
  // CommonJS extension. `no-require-imports` firing here is a false positive
  // about the module system these files are *supposed* to use, not debt: there
  // is nothing to burn down, only a rule pointed at the wrong files.
  //
  // Deliberately narrow — a path list, not a glob over `scripts/**` — so a new
  // ESM script under scripts/ is still linted normally.
  {
    files: [
      "scripts/generate-icons.cjs",
      "scripts/generate-catalogue-icons.js",
      "scripts/generate-vapid-keys.js",
    ],
    rules: {
      "@typescript-eslint/no-require-imports": "off",
    },
  },
];

export default config;
