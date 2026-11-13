import {generateKeyPairSync,randomBytes} from 'node:crypto'
import {describe,it,expect} from 'vitest'
import {AdbClient} from '../src/main/adb/client'
import {androidPublicKey} from '../src/main/adb/keys'
import {newTv,startFakeAdbd} from './fake-adbd'
const {privateKey}=generateKeyPairSync('rsa',{modulusLength:2048})
const keys=[{path:'',priv:privateKey,pub:androidPublicKey(privateKey)}]
describe('binary ADB sync upload',()=>{
 it.each([1024,4096,262144])('preserves bytes and acknowledgement progress with maximum payload %i',async maxData=>{
  const tv=newTv();tv.maxData=maxData
  const {server,port}=await startFakeAdbd(tv)
  const client=await AdbClient.connect({host:'127.0.0.1',port,keys})
  try{
   const data=randomBytes(150123),updates:number[]=[]
   await client.push(data,'/data/local/tmp/test.apk',(sent,total)=>{expect(total).toBe(data.length);updates.push(sent)})
   expect(tv.files.get('/data/local/tmp/test.apk')).toEqual(data)
   expect(updates.at(-1)).toBe(data.length)
   expect(updates.every((n,i)=>i===0||n>updates[i-1])).toBe(true)
   expect(tv.commands).toEqual([])
   await client.push(Buffer.alloc(0),'/data/local/tmp/empty.apk')
   expect(tv.files.get('/data/local/tmp/empty.apk')?.length).toBe(0)
   await expect(client.shell('getprop ro.product.model')).resolves.toContain('BRAVIA')
  }finally{client.close();await new Promise<void>(resolve=>server.close(()=>resolve()))}
 })
 it.each(['failure','disconnect'] as const)('rejects %s instead of claiming upload success',async mode=>{
  const tv=newTv();if(mode==='failure')tv.syncFailure='No space left';else tv.syncDisconnect=true
  const {server,port}=await startFakeAdbd(tv),client=await AdbClient.connect({host:'127.0.0.1',port,keys})
  try{await expect(client.push(randomBytes(20000),'/data/local/tmp/test.apk')).rejects.toThrow();expect(tv.files.size).toBe(0)}
  finally{client.close();await new Promise<void>(resolve=>server.close(()=>resolve()))}
 })
})
