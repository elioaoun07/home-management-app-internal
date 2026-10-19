// Synthetic known-positive control, never copied into an application candidate.
const config = [
  { files: ["src/**/*.ts"] },
  {
    files: ["components", "features", "hooks", "contexts"].map(directory => `src/${directory}/**/*.ts`),
    rules: {
      "no-restricted-syntax": ["warn", {
        selector: "CallExpression[callee.name='fetch'] > ObjectExpression.arguments > Property[key.name='method'][value.value=/^(POST|PATCH|PUT|DELETE)$/]",
        message: "Use safeFetch",
      }],
    },
  },
];
export default config;
