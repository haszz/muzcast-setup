import { createHash } from 'node:crypto'
import { apkInfo } from './apk'

export const PRODUCTS = {
  launcher: {
    name: 'Muzcast TV',
    package: 'com.gathin.tvhome',
    manifest: 'https://www.muzcast.co/tv/update.json',
  },
  muzcast: {
    name: 'Muzcast',
    package: 'co.muzcast.tv',
    manifest: 'https://www.muzcast.co/api/tv-updates',
  },
} as const
export type Product = keyof typeof PRODUCTS
const MAX = 250 * 1024 * 1024
export function allowedUrl(value: string): URL {
  const u = new URL(value)
  if (
    u.protocol !== 'https:' ||
    u.username ||
    u.password ||
    u.port ||
    !(
      u.hostname === 'www.muzcast.co' ||
      u.hostname === 'a6d3c2ff344f6719a2fdc1d3320f4aa5.r2.cloudflarestorage.com'
    )
  )
    throw Error('Source de téléchargement non autorisée.')
  return u
}
export async function download(
  url: string,
  limit = MAX,
  fetcher: typeof fetch = fetch,
): Promise<Buffer> {
  let u = allowedUrl(url)
  for (let i = 0; i < 5; i++) {
    const r = await fetcher(u, {
      redirect: 'manual',
      signal: AbortSignal.timeout(180000),
      cache: 'no-store',
    })
    if (r.status >= 300 && r.status < 400 && r.headers.get('location')) {
      u = allowedUrl(new URL(r.headers.get('location')!, u).href)
      continue
    }
    if (!r.ok || !r.body)
      throw Error(`Téléchargement indisponible (${r.status}). Réessayez.`)
    if (Number(r.headers.get('content-length')) > limit)
      throw Error('Fichier trop volumineux.')
    const chunks: Uint8Array[] = []
    let size = 0
    const reader = r.body.getReader()
    try {
      for (;;) {
        const { done, value } = await reader.read()
        if (done) break
        size += value.length
        if (size > limit) throw Error('Fichier trop volumineux.')
        chunks.push(value)
      }
    } finally {
      await reader.cancel()
    }
    return Buffer.concat(chunks)
  }
  throw Error('Trop de redirections.')
}
export function release(
  product: Product,
  m: Record<string, unknown>,
): { url: string; sha256: string; versionCode: number; name: string } {
  const url = product === 'launcher' ? m.apk : m.url
  if (
    typeof url !== 'string' ||
    typeof m.sha256 !== 'string' ||
    !/^[a-f0-9]{64}$/i.test(m.sha256) ||
    !Number.isSafeInteger(m.versionCode) ||
    Number(m.versionCode) < 1
  )
    throw Error('Version officielle invalide.')
  allowedUrl(url)
  if (product === 'muzcast' && m.packageName !== PRODUCTS[product].package)
    throw Error('Application inattendue.')
  return {
    url,
    sha256: m.sha256,
    versionCode: Number(m.versionCode),
    name: String(m.versionName ?? m.versionCode),
  }
}
export function verifyApk(
  product: Product,
  data: Buffer,
  manifest: ReturnType<typeof release>,
): void {
  if (
    createHash('sha256').update(data).digest('hex') !==
    manifest.sha256.toLowerCase()
  )
    throw Error('Le fichier reçu est incomplet ou a été modifié. Réessayez.')
  const info = apkInfo(data)
  if (
    info?.package !== PRODUCTS[product].package ||
    info.versionCode !== manifest.versionCode
  )
    throw Error('L’APK ne correspond pas à la version annoncée.')
}
