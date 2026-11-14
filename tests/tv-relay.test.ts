import {beforeEach,describe,it,expect,vi} from 'vitest'
const mocks=vi.hoisted(()=>({connect:vi.fn(),start:vi.fn(),stop:vi.fn(),close:vi.fn()}))
vi.mock('../src/main/adb/client',()=>({AdbClient:{connect:mocks.connect},AdbError:class extends Error{constructor(message:string,public code:string){super(message)}}}))
vi.mock('../src/main/adb/keys',()=>({loadKeys:()=>[]}))
vi.mock('../src/main/relay',async importOriginal=>({...await importOriginal<typeof import('../src/main/relay')>(),startRelay:mocks.start}))
vi.mock('../src/main/log',()=>({log:vi.fn()}))
import * as tv from '../src/main/tv'
beforeEach(()=>{tv.disconnect();vi.clearAllMocks();tv.init('/unused',()=>{});mocks.start.mockResolvedValue({port:19999,token:'abc',stop:mocks.stop})})
const client=()=>({close:mocks.close,shell:vi.fn().mockResolvedValue('Smart TV\nG10\nG10\nTCL\n12\n31\nbuild\n1'),onClose:undefined})
describe.skipIf(process.platform!=='darwin')('connection fallback',()=>{
 it('keeps the TV identity and changes only the transport after direct failure',async()=>{
  mocks.connect.mockRejectedValueOnce(Object.assign(new Error('(EHOSTUNREACH)'),{code:'unreachable'})).mockResolvedValueOnce(client())
  const status=await tv.connect('192.168.31.184:5555')
  expect(status).toMatchObject({state:'connected',host:'192.168.31.184:5555',transport:'relay',probe:{host:'192.168.31.184'}})
  expect(mocks.connect.mock.calls[1][0]).toMatchObject({host:'127.0.0.1',port:19999,relayToken:'abc'})
  tv.disconnect();expect(mocks.stop).toHaveBeenCalled()
 })
 it('does not start a relay after successful direct connection',async()=>{
  mocks.connect.mockResolvedValueOnce(client())
  expect(await tv.connect('192.168.31.184')).toMatchObject({state:'connected',transport:'direct'})
  expect(mocks.start).not.toHaveBeenCalled()
 })
 it('stops the owned relay when ADB fails',async()=>{
  mocks.connect.mockRejectedValueOnce(Object.assign(new Error('(EHOSTUNREACH)'),{code:'unreachable'})).mockRejectedValueOnce(Object.assign(new Error('auth refused'),{code:'auth'}))
  expect(await tv.connect('192.168.31.184')).toMatchObject({state:'error',error:expect.stringContaining('auth refused')})
  expect(mocks.stop).toHaveBeenCalled()
 })
 it('does not overwrite a newer connection when an old relay attempt fails',async()=>{
  let rejectOld!: (error:Error)=>void
  const oldHandshake=new Promise((_,reject)=>{rejectOld=reject})
  mocks.connect.mockRejectedValueOnce(Object.assign(new Error('(EHOSTUNREACH)'),{code:'unreachable'})).mockReturnValueOnce(oldHandshake).mockResolvedValueOnce(client())
  const first=tv.connect('192.168.31.184')
  await vi.waitFor(()=>expect(mocks.connect).toHaveBeenCalledTimes(2))
  await tv.connect('192.168.31.185')
  rejectOld(new Error('closed'))
  await first
  expect(tv.getStatus()).toMatchObject({state:'connected',host:'192.168.31.185',transport:'direct'})
 })

})

it('stops after an interrupted authorization instead of spawning a relay loop',async()=>{
 const states:string[]=[];tv.init('/unused',s=>states.push(s.state))
 mocks.connect.mockRejectedValueOnce(Object.assign(new Error('EHOSTUNREACH'),{code:'unreachable'}))
 .mockImplementationOnce(async options=>{options.onAuthPrompt();throw Object.assign(new Error('TV closed'),{code:'auth-interrupted'})})
 .mockResolvedValueOnce(client())
 expect(await tv.connect('192.168.31.184')).toMatchObject({state:'error'})
 expect(mocks.start).toHaveBeenCalledTimes(1)
 expect(mocks.connect).toHaveBeenCalledTimes(2)
 expect(states).toContain('error')
})
