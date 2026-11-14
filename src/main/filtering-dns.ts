import {readFileSync} from 'node:fs'
import {join} from 'node:path'
import {randomUUID} from 'node:crypto'
import * as T from './tv'
import {paths} from './paths'
import type {ApplyResult, DnsCandidate} from '@shared/api'

export const DNS_PROVIDERS = [
  {name:'AdGuard',host:'dns.adguard-dns.com'},
  {name:'DNS Forge',host:'dnsforge.de'}
] as const
const reasons: Record<string,string> = {
  resolve:'La TV ne trouve pas l’adresse du fournisseur.',
  tcp:'Le serveur ne répond pas sur le port du DNS chiffré (853).',
  tls:'La connexion chiffrée ou le certificat du fournisseur n’a pas pu être validé.',
  dns:'Le fournisseur n’a pas renvoyé de réponse DNS utilisable pour Muzcast.',
  https:'Muzcast n’est pas accessible en HTTPS depuis la TV.',
  unknown:'Le test n’a pas abouti. Aucun réglage n’a été modifié.'
}
export function parseDnsProbe(output:string): {ok:boolean;stage:string;elapsedMs:number} {
  const line=output.split('\n').find(s=>s.trim().startsWith('{'))
  try {const o=JSON.parse(line||'');if(typeof o.ok==='boolean'&&typeof o.stage==='string'&&Number.isFinite(o.elapsedMs))return o} catch{}
  return {ok:false,stage:'unknown',elapsedMs:0}
}
let busy=false
async function exclusive<T>(fn:()=>Promise<T>):Promise<T>{
  if(busy)throw Error('Une vérification DNS est déjà en cours.')
  busy=true;try{return await fn()}finally{busy=false}
}
async function withProbe<R>(fn:(shell:(s:string,t?:number)=>Promise<string>,probe:(host:string)=>Promise<ReturnType<typeof parseDnsProbe>>)=>Promise<R>):Promise<R>{
  const client=T.tv(), remote=`/data/local/tmp/muzcast-dns-${randomUUID()}.dex`
  const shell=(s:string,t=15000)=>client.shell(s,t)
  try {
    await T.pushB64('dns',readFileSync(join(paths.resources,'dns-probe.dex')),remote)
    if(T.tv()!==client)throw Error('La TV a changé. Recommencez la vérification.')
    const probe=async(host:string)=>parseDnsProbe(await shell(`CLASSPATH=${remote} app_process / co.muzcast.setup.DnsProbe ${host}`,45000))
    return await fn(shell,probe)
  }finally{await shell(`rm -f ${remote} ${remote}.b64`,5000).catch(()=>{})}
}
export async function testFilteringDns():Promise<DnsCandidate[]> {
  return exclusive(()=>withProbe(async(_shell,probe)=>{
    const result:DnsCandidate[]=[]
    for(const p of DNS_PROVIDERS){
      const r=await probe(p.host).catch(()=>({ok:false,stage:'unknown',elapsedMs:0}))
      result.push({...p,...r,detail:r.ok?'Connexion chiffrée et réponse DNS vérifiées depuis la TV.':reasons[r.stage]||reasons.unknown})
    }
    return result
  }))
}
export async function activateDns(host:string|null):Promise<ApplyResult>{
  if(host!==null&&(typeof host!=='string'||host.length>253||!/^[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(host)))throw Error('Adresse DNS invalide.')
  if(host && (T.getStatus().probe?.sdk??0)<28)throw Error('Le DNS privé nécessite Android 9 ou plus récent.')
  return exclusive(()=>withProbe(async(shell,probe)=>{
    if(host){
      const preflight=await probe(host)
      if(!preflight.ok)return {ok:false,summary:`${reasons[preflight.stage]||reasons.unknown} Votre connexion est conservée. Testez un autre fournisseur.`,warnings:[]}
    }
    const mode=(await shell('settings get global private_dns_mode')).trim()
    const previous=(await shell('settings get global private_dns_specifier')).trim()
    if(![mode,previous].every(v=>/^[a-zA-Z0-9._-]*$/.test(v)))throw Error('Impossible de sauvegarder les réglages DNS.')
    const restoreCommands=[['private_dns_specifier',previous],['private_dns_mode',mode]].map(([k,v])=>!v||v==='null'?`settings delete global ${k}`:`settings put global ${k} ${v}`)
    const base=`/data/local/tmp/muzcast-dns-guard-${randomUUID()}`
    // A TV-local watchdog survives installer crashes and a lost ADB connection. It never needs DNS.
    const started=Date.now()
    const guard=`sleep 60\nif mkdir ${base}.decision 2>/dev/null; then\n${restoreCommands.join('\n')}\nfi\nsleep 60\nrm -rf ${base}.decision ${base}.sh\n`
    await shell(`echo '${Buffer.from(guard).toString('base64')}' | base64 -d > ${base}.sh`)
    const armed=await shell(`nohup sh ${base}.sh >/dev/null 2>&1 </dev/null & p=$!; kill -0 $p && echo ARMED`)
    if(!armed.includes('ARMED'))throw Error('La protection de la connexion n’a pas pu démarrer. Aucun DNS modifié.')
    const restore=async()=>{
      for(const command of restoreCommands)await shell(command)
      if((await shell('settings get global private_dns_mode')).trim()!==(mode||'null')||(await shell('settings get global private_dns_specifier')).trim()!==(previous||'null'))throw Error('Restauration non confirmée. La protection locale réessaiera automatiquement.')
      await shell(`mkdir ${base}.decision 2>/dev/null || true`)
    }
    try {
      if(host)await shell(`settings put global private_dns_specifier ${host}`)
      await shell(`settings put global private_dns_mode ${host?'hostname':'opportunistic'}`)
      let valid=false
      for(let i=0;i<3;i++){
        await new Promise(r=>setTimeout(r,1500))
        const check=await probe('system')
        const actual=(await shell('settings get global private_dns_mode')).trim()
        const specifier=(await shell('settings get global private_dns_specifier')).trim()
        const connectivity=host?await shell('dumpsys connectivity'):''
        if(check.ok&&actual===(host?'hostname':'opportunistic')&&(!host||(specifier===host&&!connectivity.includes('PrivateDnsBroken')))){valid=true;break}
      }
      if(!valid || Date.now()-started>45000)throw Error('validation')
      const committed=await shell(`mkdir ${base}.decision 2>/dev/null && echo COMMITTED`)
      if(!committed.includes('COMMITTED'))throw Error('deadline')
      return {ok:true,summary:host?`${DNS_PROVIDERS.find(p=>p.host===host)?.name||host} activé. Muzcast est accessible depuis la TV.`:'DNS automatique rétabli et accès à Muzcast vérifié.',warnings:host?['Les publicités intégrées aux vidéos, notamment YouTube, ne sont pas toutes filtrées.']:[]}
    }catch{
      await restore()
      return {ok:false,summary:'Android n’a pas validé ce DNS. Votre configuration précédente a été rétablie. Vous pouvez essayer l’autre fournisseur.',warnings:[]}
    }
  }))
}
