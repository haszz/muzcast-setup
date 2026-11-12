import { mkdtemp, writeFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import * as T from './tv'
import * as sideload from './sideload'
import { progress } from './log'
import {
  PRODUCTS,
  download,
  release,
  verifyApk,
  type Product,
} from './muzcast-release'
let busy = false
export async function install(product: Product): Promise<{ version: string }> {
  if (!Object.hasOwn(PRODUCTS, product)) throw Error('Application inconnue.')
  if (busy) throw Error('Une installation est déjà en cours.')
  const status = T.getStatus()
  if (status.state !== 'connected' || !status.probe || status.probe.sdk < 26)
    throw Error('Connectez une TV Android 8 ou plus récente.')
  busy = true
  let dir: string | undefined
  try {
    progress({
      tool: 'sideload',
      received: 0,
      total: 0,
      phase: 'download',
      message: `Téléchargement de ${PRODUCTS[product].name}`,
    })
    const m = release(
      product,
      JSON.parse(
        (await download(PRODUCTS[product].manifest, 1024 * 1024)).toString(),
      ),
    )
    const data = await download(m.url)
    verifyApk(product, data, m)
    if (
      T.getStatus().host !== status.host ||
      T.getStatus().state !== 'connected'
    )
      throw Error('La connexion à la TV a changé. Reconnectez-la.')
    dir = await mkdtemp(join(tmpdir(), 'muzcast-'))
    const file = join(dir, `${product}.apk`)
    await writeFile(file, data)
    const result = await sideload.install(file)
    if (!result.ok) throw Error([result.summary, ...result.warnings].join(' '))
    const installed = await T.tv().shell(
      `dumpsys package ${PRODUCTS[product].package}`,
    )
    if (!new RegExp(`versionCode=${m.versionCode}(?:\\s|$)`).test(installed))
      throw Error(
        'Installation envoyée, mais version non confirmée sur la TV. Réessayez.',
      )
    return { version: m.name }
  } finally {
    busy = false
    if (dir) await rm(dir, { recursive: true, force: true })
  }
}
export async function open(product: Product): Promise<void> {
  if (!Object.hasOwn(PRODUCTS, product) || busy)
    throw Error('Action indisponible.')
  const result = await T.tv().shell(
    `monkey -p ${PRODUCTS[product].package} -c android.intent.category.LAUNCHER 1`,
  )
  if (/No activities|aborted|Error/i.test(result))
    throw Error(
      'Impossible d’ouvrir l’application. Ouvrez-la avec la télécommande.',
    )
}
