import {
  readFileSync,
} from "node:fs"

import {
  fileURLToPath,
} from "node:url"

import {
  defineConfig,
} from "vite"

import react from
  "@vitejs/plugin-react"


const versionFile =
  fileURLToPath(
    new URL(
      "../VERSION",
      import.meta.url,
    )
  )


const appVersion =
  readFileSync(
    versionFile,
    "utf8",
  ).trim()


export default defineConfig({
  plugins: [
    react(),
  ],

  define: {
    __APP_VERSION__:
      JSON.stringify(
        appVersion
      ),
  },
})