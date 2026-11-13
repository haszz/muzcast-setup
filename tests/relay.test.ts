import {describe,it,expect} from 'vitest'
import {shouldUseRelay} from '../src/main/relay'
describe('automatic relay eligibility',()=>{
 it('falls back for typical Mac routing failures and timeouts on private TVs',()=>{
  for(const errno of ['EHOSTUNREACH','ENETUNREACH','EACCES','EPERM'])expect(shouldUseRelay({code:'unreachable',message:`(${errno})`},'192.168.31.184','darwin')).toBe(true)
  expect(shouldUseRelay({code:'timeout'},'10.1.2.3','darwin')).toBe(true)
 })
 it('never loops through a relay, or targets public or invalid hosts',()=>{
  for(const host of ['127.0.0.1','localhost','8.8.8.8','192.168.999.1','evil.example','172.32.0.1'])expect(shouldUseRelay({code:'timeout'},host,'darwin')).toBe(false)
 })
 it('does not retry refused debugging, pairing or authentication using another route',()=>{
  for(const code of ['refused','auth','tls','closed','protocol'])expect(shouldUseRelay({code},'192.168.31.184','darwin')).toBe(false)
  expect(shouldUseRelay({code:'timeout'},'192.168.31.184','win32')).toBe(false)
 })
})
