import { readFileSync } from 'node:fs'
import { randomUUID } from 'node:crypto'
import { join } from 'node:path'
import * as T from './tv'
import { paths } from './paths'
import type { AppMetadata } from '@shared/api'

export function parseAppMetadata(output: string, requested: Set<string>): AppMetadata[] {
  const result = new Map<string, AppMetadata>()
  for (const line of output.split(/\r?\n/)) {
    if (line.length > 40000 || !line.startsWith('{')) continue
    try {
      const row = JSON.parse(line)
      if (typeof row.pkg !== 'string' || !requested.has(row.pkg) || typeof row.label !== 'string') continue
      const label = row.label.replace(/[\u0000-\u001f\u007f]/g, '').trim().slice(0, 100) || row.pkg
      const icon = typeof row.icon === 'string' && row.icon.length <= 33000 && /^data:image\/png;base64,iVBORw0KGgo[A-Za-z0-9+/]*={0,2}$/.test(row.icon) ? row.icon : undefined
      result.set(row.pkg, {pkg:row.pkg, label, icon, system:row.system===true})
    } catch { /* app_process may write diagnostic lines alongside JSON. */ }
  }
  return [...result.values()]
}

export async function appMetadata(packages: string[]): Promise<AppMetadata[]> {
  if (!Array.isArray(packages) || packages.length > 500 || packages.some(pkg => typeof pkg !== 'string' || pkg.length > 255 || !T.PACKAGE_RE.test(pkg))) throw new Error('Liste d’applications invalide.')
  const names = [...new Set(packages)]
  if (!names.length) return []
  const client = T.tv()
  const remote = `/data/local/tmp/muzcast-metadata-${randomUUID()}.dex`
  const result: AppMetadata[] = []
  try {
    await T.pushB64('app-metadata',readFileSync(join(paths.resources,'app-metadata.dex')),remote)
    for (let index=0; index<names.length; index+=24) {
      if (T.tv() !== client) throw new Error('Le téléviseur a changé pendant la lecture.')
      const batch=names.slice(index,index+24)
      const output=await client.shell(`CLASSPATH=${remote} app_process / co.muzcast.setup.AppMetadata ${batch.join(' ')}`,30000)
      result.push(...parseAppMetadata(output,new Set(batch)))
    }
    return result
  } finally {
    await client.shell(`rm -f ${remote} ${remote}.b64`,5000).catch(()=>{})
  }
}
