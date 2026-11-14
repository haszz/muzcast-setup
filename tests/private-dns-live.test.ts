// Explicit opt-in integration check against a connected TV. Always restores its prior DNS settings.
import {expect,it,vi} from 'vitest'
vi.mock('../src/main/tv',async()=>{
 const {execFile}=await import('node:child_process');const {promisify}=await import('node:util');const {writeFile,unlink}=await import('node:fs/promises');const {tmpdir}=await import('node:os');const {randomUUID}=await import('node:crypto')
 const exec=promisify(execFile)
 const adb=process.env.MUZCAST_TEST_ADB||'adb';const target=process.env.MUZCAST_TEST_TV||''
 const client={shell:async(command:string,timeout=15000)=>(await exec(adb,['-s',target,'shell',command],{timeout,maxBuffer:4*1024*1024})).stdout}
 return {tv:()=>client,getStatus:()=>({probe:{sdk:30}}),pushB64:async(_task:string,data:Buffer,remote:string)=>{const local=`${tmpdir()}/dns-live-${randomUUID()}.dex`;try{await writeFile(local,data);await exec(adb,['-s',target,'push',local,remote])}finally{await unlink(local)}}}
})
import * as T from '../src/main/tv'
import {activateDns,testFilteringDns} from '../src/main/filtering-dns'
it.runIf(!!process.env.MUZCAST_TEST_TV)('tests both DoT providers and activation on TV, restoring previous configuration',async()=>{
 const c=T.tv();const mode=(await c.shell('settings get global private_dns_mode')).trim();const host=(await c.shell('settings get global private_dns_specifier')).trim()
 if(![mode,host].every(v=>/^[a-zA-Z0-9._-]*$/.test(v)))throw Error('Unexpected DNS values')
 try {
  const candidates=await testFilteringDns();console.log('DNS preflight:',candidates)
  const candidate=candidates.find(c=>c.ok);expect(candidate).toBeDefined()
  const result=await activateDns(candidate!.host);console.log('Protected activation:',result);expect(result.ok).toBe(true)
 }finally{
  await c.shell(host==='null'?'settings delete global private_dns_specifier':`settings put global private_dns_specifier ${host}`)
  await c.shell(mode==='null'?'settings delete global private_dns_mode':`settings put global private_dns_mode ${mode}`)
  expect((await c.shell('settings get global private_dns_mode')).trim()).toBe(mode)
 }
},120000)
