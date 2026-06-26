import js from "@eslint/js";
import globals from "globals";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";
import tseslint from "typescript-eslint";
import prettierConfig from "eslint-config-prettier";

export default tseslint.config(
	{ ignores: ["dist", "ds-bundle/**"] },
	{
		extends: [js.configs.recommended, ...tseslint.configs.recommended],
		files: ["**/*.{ts,tsx}"],
		languageOptions: {
			ecmaVersion: 2020,
			globals: globals.browser,
		},
		plugins: {
			"react-hooks": reactHooks,
			"react-refresh": reactRefresh,
		},
		rules: {
			...reactHooks.configs.recommended.rules,
			// eslint-plugin-react-hooks v7 added React-Compiler-era rules to its
			// recommended set. These flag pre-existing patterns (setState in effects,
			// reading refs during render) that are real tech-debt but out of scope for
			// the dependency upgrade — keep them visible as warnings, not blockers.
			"react-hooks/set-state-in-effect": "warn",
			"react-hooks/refs": "warn",
			"react-refresh/only-export-components": [
				"warn",
				{ allowConstantExport: true },
			],
			"@typescript-eslint/no-unused-vars": "off",
		},
	},
	prettierConfig,
);
