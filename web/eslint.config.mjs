import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    // Regression guard: crypto.randomUUID() is undefined outside secure
    // contexts (e.g. a phone on http://<LAN-IP>:3000). Calling it right
    // after creating a Feed post silently dropped the post's photo/video.
    // Use randomId() from src/lib/randomId.ts, which falls back safely.
    rules: {
      "no-restricted-properties": [
        "error",
        {
          object: "crypto",
          property: "randomUUID",
          message:
            "crypto.randomUUID() is unavailable on plain-HTTP origins. Use randomId() from @/lib/randomId instead.",
        },
      ],
    },
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // supabase/functions runs on Deno, not Node — separate runtime globals
    // (Deno.serve, Deno.env, remote ESM imports) this toolchain doesn't know.
    "supabase/functions/**",
  ]),
]);

export default eslintConfig;
