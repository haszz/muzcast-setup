import {describe,it,expect} from 'vitest'
import {browseInstances,resolveEndpoint,resolveAddresses} from '../src/main/mac-discovery'
describe('native Bonjour output',()=>{
 it('reads the TCL advert from dns-sd without assuming localhost is loopback',()=>{
  expect(browseInstances('2:00:52.324  Add        2  11 local.               _adb._tcp.           adb-180AC0C20270780DD')).toEqual(['adb-180AC0C20270780DD'])
  expect(resolveEndpoint('2:01:25.336  adb-180AC0C20270780DD._adb._tcp.local. can be reached at localhost.local.:5555 (interface 11)')).toEqual({host:'localhost.local.',port:5555})
  expect(resolveAddresses('2:01:38.116  Add  40000002      11  localhost.local.                       192.168.31.184                               120')).toEqual(['192.168.31.184'])
 })
 it('rejects removals, public addresses and invalid endpoints',()=>{
  expect(browseInstances('2:00:52 Rmv 2 11 local. _adb._tcp. old')).toEqual([])
  expect(resolveAddresses('2:01:38 Add 2 11 tv.local. 8.8.8.8 120')).toEqual([])
  expect(resolveEndpoint('can be reached at tv.local.:99999 (interface 11)')).toBeNull()
 })
})
