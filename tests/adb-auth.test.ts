import {mkdtempSync,rmSync} from 'node:fs'
import {tmpdir} from 'node:os'
import {join} from 'node:path'
import {afterEach,expect,it} from 'vitest'
import {AdbClient} from '../src/main/adb/client'
import {loadKeys} from '../src/main/adb/keys'
import * as T from '../src/main/tv'
import {newTv,startFakeAdbd} from './fake-adbd'
import type {ConnStatus} from '../src/shared/api'
const cleanup:Array<()=>void>=[]
afterEach(()=>{T.disconnect();for(const fn of cleanup.splice(0))fn()})
async function setup(){
 const dir=mkdtempSync(join(tmpdir(),'muzcast-auth-test-'));cleanup.push(()=>rmSync(dir,{recursive:true,force:true}));
 const key=join(dir,'adbkey'),tv=newTv(),{server,port}=await startFakeAdbd(tv);cleanup.push(()=>server.close());
 return {tv,key,options:{host:'127.0.0.1',port,keys:loadKeys(key)}}
}
it('waits for a delayed Allow rather than reporting an early failure',async()=>{
 const {tv,options}=await setup();tv.authDelayMs=200;
 let prompted=false;const c=await AdbClient.connect({...options,authTimeoutMs:1000,onAuthPrompt:()=>{prompted=true}});
 expect(prompted).toBe(true);expect(c.closed).toBe(false);c.close()
})
it('does not misreport a connection interruption as user timeout',async()=>{
 const {tv,options}=await setup();tv.authDisconnects=1;
 await expect(AdbClient.connect(options)).rejects.toMatchObject({code:'auth-interrupted'})
})
it('reports actual authorization expiry in French',async()=>{
 const {tv,options}=await setup();tv.autoAccept=false;
 await expect(AdbClient.connect({...options,authTimeoutMs:80})).rejects.toMatchObject({code:'auth',message:expect.stringContaining('n’a pas été confirmée')})
})
it('does not reopen authorization after the TV closes the connection',async()=>{
 const {tv,key,options}=await setup();tv.authDisconnects=1;tv.authDelayMs=100;
 const states:ConnStatus[]=[];T.init(key,s=>states.push(s));
 expect(await T.connect(`127.0.0.1:${options.port}`)).toMatchObject({state:'error'});
 expect(tv.authPrompts).toBe(1);
 expect(states.some(s=>s.state==='waiting-auth')).toBe(true);expect(states.some(s=>s.state==='error')).toBe(true)
})
it('cancels the handshake while waiting for authorization',async()=>{
 const {tv,options}=await setup();tv.autoAccept=false;const controller=new AbortController();
 await expect(AdbClient.connect({...options,signal:controller.signal,onAuthPrompt:()=>setTimeout(()=>controller.abort(),20)})).rejects.toMatchObject({code:'auth-interrupted'})
})

it('signs a fresh challenge after Allow without prompting again',async()=>{
 const {tv,options}=await setup();tv.challengeAfterAllow=true;
 const c=await AdbClient.connect(options);
 expect(c.closed).toBe(false);expect(tv.authPrompts).toBe(1);c.close()
})

it('shares concurrent requests for the same TV while waiting for Allow',async()=>{
 const {tv,key,options}=await setup();tv.authDelayMs=150;T.init(key,()=>{});
 const address=`127.0.0.1:${options.port}`;const first=T.connect(address);
 expect(T.connect(address)).toBe(first);
 expect(await first).toMatchObject({state:'connected'});expect(tv.authPrompts).toBe(1)
})
