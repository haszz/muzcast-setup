import { mkdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import { createHash } from 'node:crypto'
import * as T from './tv'
import * as system from './system'
import { paths } from './paths'
import type { ApplyResult, TvDiagnostics } from '@shared/api'

const keys = ['private_dns_mode', 'private_dns_specifier', 'window_animation_scale', 'transition_animation_scale', 'animator_duration_scale']
function file(): string {
  const p = T.getStatus().probe
  if (!p || T.getStatus().state !== 'connected') throw Error('Connectez la TV avant de continuer.')
  const id = createHash('sha256').update(`${p.host}|${p.manufacturer}|${p.model}|${p.device}`).digest('hex')
  return join(paths.data, 'optimization', `${id}.json`)
}
async function backup(): Promise<void> {
  const path = file()
  if (existsSync(path)) return
  const values: Record<string,string> = {}
  for (const key of keys) values[key] = (await T.tv().shell(`settings get global ${key}`)).trim()
  mkdirSync(join(paths.data, 'optimization'), { recursive:true })
  writeFileSync(path, JSON.stringify(values), { flag:'wx', mode:0o600 })
}
export async function dns(host: string|null): Promise<ApplyResult> {
  await backup(); return system.privateDns(host)
}
export async function animations(scale: number): Promise<ApplyResult> {
  await backup(); return system.animationScale(scale)
}
export async function restore(): Promise<ApplyResult> {
  const path = file()
  if (!existsSync(path)) return {ok:false,summary:'Aucun réglage sauvegardé pour cette TV à cette adresse.',warnings:[]}
  const values = JSON.parse(readFileSync(path,'utf8')) as Record<string,string>
  // Validate the whole record before changing anything; never interpolate arbitrary settings.
  for (const key of keys) {
    const value=values[key]
    if (typeof value !== 'string' || !/^[a-zA-Z0-9._-]*$/.test(value)) throw Error('Sauvegarde des réglages invalide.')
  }
  for (const key of keys) {
    const value=values[key]
    await T.tv().shell(value === 'null' || value === '' ? `settings delete global ${key}` : `settings put global ${key} '${value}'`)
    const actual=(await T.tv().shell(`settings get global ${key}`)).trim()
    if (actual !== (value === '' ? 'null' : value)) throw Error('La TV n’a pas confirmé la restauration. Réessayez.')
  }
  return {ok:true,summary:'DNS et animations rétablis à leur état initial.',warnings:[]}
}
export async function diagnostics(): Promise<TvDiagnostics> {
  const errors: string[]=[]
  const read=async(command:string)=>{try{return await T.tv().shell(command,30000)}catch{errors.push(command.split(' ')[0]);return ''}}
  const packages=(await read('pm list packages')).split('\n').map(s=>s.replace(/^package:/,'').trim()).filter(s=>T.PACKAGE_RE.test(s))
  const voice=(await read('settings get secure voice_interaction_service')).trim()
  const assistant=(await read('settings get secure assistant')).trim()
  const findings: TvDiagnostics['findings']=[]
  for(const pkg of packages){
    const nominated=voice.startsWith(pkg+'/')||assistant.startsWith(pkg+'/')
    const known=pkg==='tv.inscape.tvclient.inscapeacr'
    if(nominated||known||/analytics|telemetry|tracking|\.acr|voice|katniss/i.test(pkg)) findings.push({pkg,evidence:nominated?'Déclaré comme assistant vocal dans les réglages de la TV.':known?'Client Inscape ACR connu : reconnaissance des contenus affichés.':'Nom évocateur uniquement : rôle à confirmer, aucune activité de suivi prouvée.'})
  }
  const start=Date.now(); await read('echo muzcast'); const roundTripMs=Date.now()-start
  const mem=await read('cat /proc/meminfo')
  const memoryAvailableKb=Number(mem.match(/^MemAvailable:\s+(\d+)/m)?.[1])||null
  const home=await T.homeComponent().catch(()=>null)
  const pkg=home?.split('/')[0]
  const frames=pkg&&T.PACKAGE_RE.test(pkg)?await read(`dumpsys gfxinfo ${pkg}`):''
  return {findings,roundTripMs,memoryAvailableKb,home,frames:frames.split('\n').filter(l=>/Total frames rendered:|Janky frames:|percentile:/.test(l)).map(l=>l.trim()).slice(0,8),warnings:errors.length?['Certaines mesures ne sont pas disponibles sur cette TV.']:[],measuredAt:new Date().toISOString()}
}
