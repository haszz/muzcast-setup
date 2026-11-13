import {app} from 'electron'
import {readFileSync,writeFileSync,mkdirSync,readdirSync,statSync} from 'node:fs'
import {join} from 'node:path'
import {randomUUID} from 'node:crypto'
import {PostHog} from 'posthog-node'
import {paths} from './paths'
import {parseLink,codeFromFilename,codeFromUrl,VISIT_PATTERN} from '@shared/attribution'
declare const __POSTHOG_KEY__:string
let client:PostHog|undefined, pending:string|null=null, loaded=false
let state:{enabled:boolean|null;id:string;linked:boolean}={enabled:null,id:randomUUID(),linked:false}
function save(){mkdirSync(paths.data,{recursive:true});writeFileSync(join(paths.data,'analytics.json'),JSON.stringify(state),{mode:0o600})}
export function init(){
 try{const s=JSON.parse(readFileSync(join(paths.data,'analytics.json'),'utf8'));if(VISIT_PATTERN.test(s.id)&&[true,false,null].includes(s.enabled))state=s}catch{}
 loaded=true
 if(state.enabled===null&&!pending){
  try{
   if(process.platform==='win32')pending=codeFromFilename(readFileSync(join(process.resourcesPath,'download-name.txt'),'utf8').trim())
   if(process.platform==='darwin'){
    const candidates=readdirSync(app.getPath('downloads')).map(name=>({name,code:codeFromFilename(name)})).filter(x=>x.code&&parseLink(x.code));
    // Ambiguous copies are never silently linked to whichever happened to be modified last.
    const ids=new Set(candidates.map(x=>parseLink(x.code!)));
    if(ids.size===1){candidates.sort((a,b)=>statSync(join(app.getPath('downloads'),b.name)).mtimeMs-statSync(join(app.getPath('downloads'),a.name)).mtimeMs);pending=candidates[0].code}
   }
  }catch{}
 }
 if(pending&&!parseLink(pending))pending=null
 if(state.enabled)capture('muzcast_setup_opened')
}
export function receive(raw:string){const code=codeFromUrl(raw);if(code)pending=code}
export function status(){return {enabled:state.enabled,pendingLink:!!pending,linked:state.linked}}
export function preference(enabled:boolean,code?:string){
 if(typeof enabled!=='boolean')throw Error('Choix invalide')
 if(enabled){const requested=code?.trim()||pending;const id=requested?parseLink(requested):null;if(requested&&!id)throw Error('Code de liaison invalide ou expiré. Copiez un nouveau code depuis le site.');if(id){state.id=id;state.linked=true}state.enabled=true;save();capture('muzcast_setup_opened');if(id)capture('muzcast_setup_linked')}
 else{state={enabled:false,id:randomUUID(),linked:false};save();client?.optOut()}
 pending=null;return status()
}
export function capture(event:string,properties:Record<string,string|number|boolean>={}){
 if(!loaded||!state.enabled||!__POSTHOG_KEY__)return
 try{client??=new PostHog(__POSTHOG_KEY__,{host:'https://beh.muzcast.co',flushAt:1,flushInterval:1000,requestTimeout:1500,fetchRetryCount:0,disableGeoip:true});client.optIn();client.capture({distinctId:state.id,event,properties:{app:'muzcast',surface:'tv_installer',app_version:app.getVersion(),platform:process.platform,linked:state.linked,is_test:process.env.MUZCAST_ANALYTICS_TEST==='1',...properties,$process_person_profile:false,$geoip_disable:true}})}catch{}
}
export async function flush(){try{await client?.shutdown(1500)}catch{}}
const operations:Record<string,string>={connect:'connection',connectKnown:'connection',reconnect:'connection',pair:'pairing',installMuzcast:'installation',openMuzcast:'app_open',applyDebloat:'cleanup',restore:'restore'}
export async function operation(name:string,args:unknown[],run:()=>Promise<unknown>){
 const op=operations[name];if(!op)return run();const started=Date.now();const props:Record<string,string|number|boolean>={operation:op};if(['installMuzcast','openMuzcast'].includes(name)&&['muzcast','launcher'].includes(String(args[0])))props.product=String(args[0]);capture('muzcast_setup_operation_started',props)
 try{const value=await run();const r=value as {ok?:boolean;state?:string;version?:string}|undefined;const ok=r?.ok!==false&&(!r?.state||r.state==='connected');capture('muzcast_setup_operation_finished',{...props,result:ok?'success':'incomplete',duration_ms:Date.now()-started});if(name==='installMuzcast'&&r?.version)capture('muzcast_setup_app_installed',{...props,version:r.version});return value}catch(e){capture('muzcast_setup_operation_finished',{...props,result:'error',duration_ms:Date.now()-started});throw e}
}
