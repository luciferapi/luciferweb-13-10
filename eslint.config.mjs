import { defineConfig, globalIgnores } from "eslint/config"
import react from "eslint-plugin-react"
import reactHooks from "eslint-plugin-react-hooks"
import tseslint from "typescript-eslint"

export default defineConfig([
  globalIgnores([".next/**", "out/**", "build/**", "next-env.d.ts"]),
  ...tseslint.configs.recommended,
  {
    files: ["**/*.{js,jsx,ts,tsx}"],
    plugins: {
      react,
      "react-hooks": reactHooks,
    },
    languageOptions: {
      parserOptions: {
        ecmaFeatures: { jsx: true },
      },
    },
    settings: {
      react: { version: "detect" },
    },
    rules: {
      ...react.configs.recommended.rules,
      ...reactHooks.configs.flat.recommended.rules,
      "react/react-in-jsx-scope": "off",
      "react/prop-types": "off",
      // These effects synchronize async/browser state, which this rule cannot distinguish from render-derived state.
      "react-hooks/set-state-in-effect": "off",
    },
  },
])
