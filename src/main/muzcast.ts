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
    const data = await download(m.url, undefined, undefined, (received,total) => progress({tool:"sideload",received,total,phase:"download",message:"Téléchargement de la version officielle"}))
    progress({tool:"sideload",received:0,total:0,phase:"verify",message:"Vérification de l’intégrité et de la version du fichier"})
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
    progress({tool:"sideload",received:0,total:0,phase:"verify",message:"Confirmation de la version installée sur votre TV"})
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
  const app = PRODUCTS[product]
  const category = 'android.intent.category.LEANBACK_LAUNCHER'
  const resolved = await T.tv().shell(
    `cmd package resolve-activity --brief -a android.intent.action.MAIN -c ${category} ${app.package}`,
  )
  const components = (output: string): string[] => output.trim().split(/\s+/).filter(value =>
    value.startsWith(`${app.package}/`) && /^[a-zA-Z0-9_.$/]+$/.test(value),
  )
  let component: string | undefined = components(resolved)[0]
  if (!component) {
    // Several TV entries can belong to one package (Muzcast TV + Adhkar).
    // In that case resolve-activity returns Android's chooser, not an absent app.
    const candidates = components(await T.tv().shell(
      `cmd package query-activities --brief -a android.intent.action.MAIN -c ${category} ${app.package}`,
    ))
    if (product === 'launcher') {
      component = candidates.find(value =>
        value === `${app.package}/.MainActivity` || value === `${app.package}/${app.package}.MainActivity`,
      )
    }
    if (!component && candidates.length === 1) component = candidates[0]
  }
  if (!component) {
    const installed = await T.tv().shell(`pm path ${app.package}`)
    if (!/^package:/m.test(installed))
      throw Error(`${app.name} n’est pas disponible sur la TV. Revenez à « Installer Muzcast » pour vérifier son installation.`)
    throw Error(`${app.name} est installé, mais son écran d’accueil n’a pas pu être identifié. Sur la TV, ouvrez Applications → ${app.name}.`)
  }
  const result = await T.tv().shell(
    `am start -W -a android.intent.action.MAIN -c ${category} -n ${component}`,
  )
  if (/Error|Exception|unable|not found/i.test(result) || !/Status:\s*ok/i.test(result))
    throw Error(`Impossible d’ouvrir ${app.name}. Sur la TV, ouvrez Applications → ${app.name}. Pour une ancienne version du launcher, cherchez aussi « Accueil ».`)
}
