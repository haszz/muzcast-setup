import { resolve } from 'node:path'
import { defineConfig, loadEnv } from 'electron-vite'
import react from '@vitejs/plugin-react'

const env=loadEnv('production',process.cwd(),'POSTHOG_')
export default defineConfig({
  main: {
    define: {__POSTHOG_KEY__:JSON.stringify(process.env.POSTHOG_KEY||env.POSTHOG_KEY||'')},
    resolve: { alias: { '@shared': resolve('src/shared') } }
  },
  preload: {
    resolve: { alias: { '@shared': resolve('src/shared') } }
  },
  renderer: {
    resolve: { alias: { '@shared': resolve('src/shared'), '@': resolve('src/renderer/src') } },
    plugins: [react()]
  }
})
