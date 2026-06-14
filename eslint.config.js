import js from "@eslint/js";
import tseslint from "typescript-eslint";

export default tseslint.config(
  {
    // `scolta-node-src/**` is the sibling binding CI checks out and builds to
    // resolve the unreleased `scolta` (see .github/workflows/ci.yml); it is not
    // this package's source and is linted by its own repo.
    ignores: ["dist/**", "node_modules/**", "examples/**", "coverage/**", "scolta-node-src/**"],
  },
  js.configs.recommended,
  ...tseslint.configs.recommendedTypeChecked,
  {
    languageOptions: {
      parserOptions: {
        projectService: {
          // Root config files live outside the tsconfig project.
          allowDefaultProject: ["*.config.ts"],
        },
        tsconfigRootDir: import.meta.dirname,
      },
    },
  },
  {
    // Plain-JS files are not part of the TS project — type-aware rules
    // cannot run on them.
    files: ["**/*.mjs", "**/*.js"],
    ...tseslint.configs.disableTypeChecked,
  },
  {
    // CI/maintenance scripts run under Node; expose the Node globals they use
    // so `no-undef` does not flag them.
    files: ["scripts/**/*.mjs"],
    languageOptions: {
      globals: { process: "readonly", console: "readonly" },
    },
  },
  {
    rules: {
      "@typescript-eslint/no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
      "@typescript-eslint/no-explicit-any": "warn",
    },
  },
  {
    // Payload documents are arbitrary CMS shapes; `any` in the public
    // callback signatures (url(doc)/filters(doc)) is deliberate API
    // ergonomics for consumers.
    files: ["src/payload/**"],
    rules: {
      "@typescript-eslint/no-explicit-any": "off",
    },
  },
  {
    // Tests poke at internals and fixtures through `any` on purpose; the
    // unsafe-* family would force casts with no safety gain. The high-value
    // type-aware rules (no-floating-promises, no-misused-promises) stay on.
    files: ["tests/**"],
    rules: {
      "@typescript-eslint/no-base-to-string": "off",
      "@typescript-eslint/no-explicit-any": "off",
      "@typescript-eslint/no-unsafe-argument": "off",
      "@typescript-eslint/no-unsafe-assignment": "off",
      "@typescript-eslint/no-unsafe-call": "off",
      "@typescript-eslint/no-unsafe-member-access": "off",
      "@typescript-eslint/no-unsafe-return": "off",
      "@typescript-eslint/require-await": "off",
      "@typescript-eslint/unbound-method": "off",
    },
  },
);
