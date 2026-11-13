declare module '*.css'

declare module "*.svg" { const src: string; export default src }
declare module "*.webp" { const src: string; export default src }

declare module "*?raw" { const text: string; export default text }
