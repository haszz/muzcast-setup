import { spawn } from 'node:child_process'
import { randomBytes } from 'node:crypto'
import { chmodSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { paths } from './paths'

export function shouldUseRelay(error: {code?:string; message?:string}, host: string, platform = process.platform): boolean {
  const octets = host.split('.').map(Number)
  const local = /^\d+\.\d+\.\d+\.\d+$/.test(host) && octets.every(n => n>=0 && n<=255) &&
    (octets[0]===10 || (octets[0]===192 && octets[1]===168) || (octets[0]===172 && octets[1]>=16 && octets[1]<=31))
  return platform==='darwin' && local && (error.code==='timeout' ||
    (error.code==='unreachable' && /EHOSTUNREACH|ENETUNREACH|EACCES|EPERM/.test(error.message ?? '')))
}
export interface RelaySession {port:number; token:string; stop:()=>void; failure?:()=>string|undefined}
export async function startRelay(host: string, port: number, signal: AbortSignal): Promise<RelaySession> {
  const app = join(paths.resources,'relay','MuzcastNetwork.app')
  if (!existsSync(app)) throw new Error('Le composant de connexion de secours manque. Réinstallez l’assistant depuis tv.muzcast.co.')
  mkdirSync(paths.data,{recursive:true})
  const directory = mkdtempSync(join(paths.data,'relay-'))
  chmodSync(directory,0o700)
  const token = randomBytes(32).toString('hex')
  writeFileSync(join(directory,'config.json'),JSON.stringify({host,port,token,parent:process.pid}),{mode:0o600})
  let stopped = false
  const stop = ():void => {
    if(stopped)return
    stopped = true
    signal.removeEventListener('abort',stop)
    try { writeFileSync(join(directory,'stop'),'') } catch {}
    setTimeout(()=>rmSync(directory,{recursive:true,force:true}),2500).unref()
  }
  signal.addEventListener('abort',stop,{once:true})
  try {
    if(signal.aborted)throw new Error('Connexion annulée.')
    await new Promise<void>((resolve,reject)=>{
      const child=spawn('/usr/bin/open',['-n','-a',app,'--args',directory],{stdio:'ignore'})
      const timer=setTimeout(()=>{child.kill();reject(new Error('Le lancement du composant réseau a expiré.'))},10000)
      child.once('error',error=>{clearTimeout(timer);reject(error)})
      child.once('exit',code=>{clearTimeout(timer);code===0?resolve():reject(new Error('Le composant réseau n’a pas pu démarrer.'))})
    })
    const deadline=Date.now()+12000
    while(Date.now()<deadline && !signal.aborted){
      let state:{port?:number;error?:string}={}
      try{state=JSON.parse(readFileSync(join(directory,'status.json'),'utf8'))}catch{}
      if(state.error)throw new Error('La connexion de secours a été interrompue.')
      if(typeof state.port==='number' && Number.isInteger(state.port) && state.port>0 && state.port<=65535)return {port:state.port!,token,stop,failure:()=>{
        try {
          const last=JSON.parse(readFileSync(join(directory,'status.json'),'utf8'))
          if(last.error==='network_failed')return `Le relais Python intégré ne peut pas joindre la TV (erreur réseau ${last.errno ?? 'inconnue'}). Vérifiez que la TV est allumée. Si macOS ne propose aucune autorisation réseau, la connexion reste bloquée ; relancer la recherche ne résout pas ce refus.`
        } catch {}
        return undefined
      }}
      await new Promise(r=>setTimeout(r,100))
    }
    throw new Error(signal.aborted?'Connexion annulée.':'Le composant réseau ne répond pas.')
  } catch(error){stop();throw error}
}
