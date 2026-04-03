// eslint.config.js
import next from "eslint-config-next";

export default [
  ...next,
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
];
