import { describe, it, expect } from 'vitest'
import { parseAppMetadata, appMetadata } from '../src/main/app-metadata'
describe('TV application metadata',()=>{
 it('keeps only requested packages and safe bounded PNG images',()=>{
  const image='data:image/png;base64,iVBORw0KGgo='
  const output=[
   'Android diagnostic',
   JSON.stringify({pkg:'com.test.app',label:'Test\u0000 app',icon:image,system:true}),
   JSON.stringify({pkg:'com.unrequested.app',label:'Unrequested'}),
   JSON.stringify({pkg:'com.test.other',label:'Other',icon:'https://external.invalid/icon.png'})
  ].join('\n')
  expect(parseAppMetadata(output,new Set(['com.test.app','com.test.other']))).toEqual([
   {pkg:'com.test.app',label:'Test app',icon:image,system:true},
   {pkg:'com.test.other',label:'Other',icon:undefined,system:false}
  ])
 })
 it('rejects commands and oversized requests before touching a TV',async()=>{
  await expect(appMetadata(['com.example;reboot'])).rejects.toThrow('invalide')
  await expect(appMetadata(Array(501).fill('com.example.app'))).rejects.toThrow('invalide')
  expect(await appMetadata([])).toEqual([])
 })
})
