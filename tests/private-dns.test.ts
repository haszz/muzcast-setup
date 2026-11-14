import {beforeEach,afterEach,expect,it,vi} from 'vitest'
const mock=vi.hoisted(()=>({shell:vi.fn(),push:vi.fn(),read:vi.fn(()=>Buffer.from('dex'))}))
vi.mock('node:fs',()=>({readFileSync:mock.read}))
vi.mock('../src/main/tv',()=>{const client={shell:mock.shell};return {tv:()=>client,pushB64:mock.push,getStatus:()=>({probe:{sdk:30}})}})
import {activateDns,testFilteringDns,parseDnsProbe} from '../src/main/filtering-dns'
let values:Record<string,string>, failedStage:string|null, systemOk:boolean, committed:boolean
beforeEach(()=>{
 vi.useFakeTimers();vi.clearAllMocks();failedStage=null;systemOk=true;committed=true
 values={private_dns_mode:'opportunistic',private_dns_specifier:'null'}
 mock.shell.mockImplementation(async(c:string)=>{
  const p=c.split(' ')
  if(p[0]==='settings') {if(p[1]==='get')return values[p[3]];values[p[3]]=p[1]==='delete'?'null':p[4];return ''}
  if(c.includes('app_process'))return JSON.stringify({ok:c.endsWith(' system')?systemOk:!failedStage,stage:failedStage||'complete',elapsedMs:200})
  if(c.startsWith('nohup'))return 'ARMED'
  if(c.includes('echo COMMITTED'))return committed?'COMMITTED':''
  return ''
 })
})
afterEach(()=>vi.useRealTimers())
it('tests both providers without changing settings',async()=>{
 const r=await testFilteringDns();expect(r).toHaveLength(2);expect(r.every(x=>x.ok)).toBe(true)
 expect(mock.shell.mock.calls.some(([c])=>c.startsWith('settings put'))).toBe(false)
})
it('does not activate a provider whose TLS preflight fails',async()=>{
 failedStage='tls';const r=await activateDns('dns.adguard-dns.com');expect(r.ok).toBe(false);expect(r.summary).toContain('certificat')
 expect(mock.shell.mock.calls.some(([c])=>c.startsWith('settings put'))).toBe(false)
})
it('arms TV watchdog before activating then commits only after HTTPS check',async()=>{
 const p=activateDns('dnsforge.de');await vi.runAllTimersAsync();expect((await p).ok).toBe(true)
 const calls=mock.shell.mock.calls.map(c=>c[0]);expect(calls.findIndex(c=>c.startsWith('nohup'))).toBeLessThan(calls.indexOf('settings put global private_dns_mode hostname'))
 expect(calls.findIndex(c=>c.endsWith(' system'))).toBeLessThan(calls.findIndex(c=>c.includes('echo COMMITTED')))
 expect(values.private_dns_specifier).toBe('dnsforge.de')
})
it('restores both original values if Android validation fails',async()=>{
 systemOk=false;values={private_dns_mode:'hostname',private_dns_specifier:'dns.example.org'}
 const p=activateDns('dnsforge.de');await vi.runAllTimersAsync();expect((await p).ok).toBe(false)
 expect(values).toEqual({private_dns_mode:'hostname',private_dns_specifier:'dns.example.org'})
})
it('does not report success after watchdog has claimed rollback',async()=>{
 committed=false;const p=activateDns('dnsforge.de');await vi.runAllTimersAsync();expect((await p).ok).toBe(false);expect(values.private_dns_mode).toBe('opportunistic')
})
it('refuses concurrent requests',async()=>{
 const p=activateDns('dnsforge.de');await expect(testFilteringDns()).rejects.toThrow('déjà en cours');await vi.runAllTimersAsync();await p
})
it('keeps failure closed if watchdog cannot start',async()=>{
 const original=mock.shell.getMockImplementation()!;mock.shell.mockImplementation(async(c:string)=>c.startsWith('nohup')?'':original(c))
 await expect(activateDns('dnsforge.de')).rejects.toThrow('protection')
 expect(values.private_dns_mode).toBe('opportunistic')
})
it('rejects command injection before contacting the TV',async()=>{
 await expect(activateDns('dnsforge.de;reboot')).rejects.toThrow('invalide');expect(mock.shell).not.toHaveBeenCalled()
})
it('rejects malformed helper output',()=>expect(parseDnsProbe('crash')).toMatchObject({ok:false,stage:'unknown'}))
