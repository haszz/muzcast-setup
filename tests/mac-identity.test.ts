import {describe,it,expect} from 'vitest'
import {createRequire} from 'node:module'
const {patchMachOUuids}=createRequire(import.meta.url)('../scripts/mac-identity.cjs')
function thin(cpu=0x100000c){const b=Buffer.alloc(64,0);b.writeUInt32LE(0xfeedfacf,0);b.writeUInt32LE(cpu,4);b.writeUInt32LE(1,16);b.writeUInt32LE(24,20);b.writeUInt32LE(0x1b,32);b.writeUInt32LE(24,36);b.fill(17,40,56);return b}
describe('Mac app identity',()=>{
 it('changes only the UUID and is deterministic for this app/version/executable',()=>{
  const src=thin(),out=patchMachOUuids(src,'co.muzcast.setup:0.1.5:MuzcastSetup');
  expect(out.offsets).toEqual([40]);expect(out.data.subarray(0,40)).toEqual(src.subarray(0,40));expect(out.data.subarray(56)).toEqual(src.subarray(56));expect(out.data).not.toEqual(src);
  expect(patchMachOUuids(out.data,'co.muzcast.setup:0.1.5:MuzcastSetup').data).toEqual(out.data);
  expect(patchMachOUuids(src,'another-app').data).not.toEqual(out.data)
 })
 it('gives each architecture of a universal binary its own UUID',()=>{
  const b=Buffer.alloc(192);b.writeUInt32BE(0xcafebabe);b.writeUInt32BE(2,4);b.writeUInt32BE(64,16);b.writeUInt32BE(64,20);b.writeUInt32BE(128,36);b.writeUInt32BE(64,40);thin().copy(b,64);thin(0x1000007).copy(b,128);
  const out=patchMachOUuids(b,'app');expect(out.offsets).toEqual([104,168]);expect(out.data.subarray(104,120)).not.toEqual(out.data.subarray(168,184));
 })
 it('fails closed on corrupt or unsupported binaries',()=>{
  expect(()=>patchMachOUuids(Buffer.alloc(4),'app')).toThrow();const b=thin();b.writeUInt32LE(9999,36);expect(()=>patchMachOUuids(b,'app')).toThrow()
 })
})
