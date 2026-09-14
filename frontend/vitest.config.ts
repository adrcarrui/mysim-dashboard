import react from "@vitejs/plugin-react"
import {
  defineConfig,
} from "vitest/config"


export default defineConfig({
  plugins: [
    react(),
  ],

  test: {
    environment:
      "jsdom",

    setupFiles: [
      "./src/test/setup.ts",
    ],

    css:
      true,

    coverage: {
      provider: "v8",
      reporter: ["text", "html"],
      exclude: ["src/assets/**", "**/*.css"],
      thresholds: {
        statements: 80,
        branches: 70,
        functions: 80,
        lines: 80,
      },
    },
  },
})
