import { describe, expect, it } from 'vitest'
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { profileMatch, recommendedProfile } from '../src/shared/profile-match'
import type { DebloatListSummary, Probe } from '../src/shared/api'
const probe: Probe = {host:'192.168.31.184',manufacturer:'TCL',model:'Smart TV',device:'G10',product:'G10',release:'12',sdk:31,build:'',adbSecure:'1'}
const platform = {id:'tcl-g10-google-tv',tv:'TCL 55 inch (G10)',brand:'TCL',os:'Google TV 12'}
describe('automatic cleanup profile', () => {
 it('selects the actual bundled G10 platform rather than guessing a retail model', () => {
  const root=join(process.cwd(),'resources/upstream/examples')
  const lists: DebloatListSummary[]=readdirSync(root).flatMap(id=>{
   try {
    readFileSync(join(root,id,'debloat.txt'))
    const meta=JSON.parse(readFileSync(join(root,id,'tv.json'),'utf8'))
    return [{id,title:id,score:0,match:profileMatch({id,tv:meta.tv??'',brand:meta.brand??'',os:meta.os??''},probe)}]
   } catch { return [] }
  })
  expect(recommendedProfile(lists)).toMatchObject({id:'tcl-g10-google-tv',match:'platform'})
 })
 it('never calls a generic Smart TV label an exact model match', () => {
  expect(profileMatch({...platform,id:'tcl-55p7k',tv:'TCL Smart TV 55P7K (G10)'},probe)).toBeUndefined()
 })
 it('recognizes a declared retail model and rejects a different brand or Android version', () => {
  const retail={...platform,id:'tcl-55p7k',tv:'TCL 55P7K (G10)'}
  expect(profileMatch(retail,{...probe,model:'55P7K'})).toBe('model')
  expect(profileMatch({...retail,brand:'Sony'},{...probe,model:'55P7K'})).toBeUndefined()
  expect(profileMatch({...retail,os:'Google TV 14'},{...probe,model:'55P7K'})).toBeUndefined()
 })
 it('requires whole identifiers and leaves ambiguous matches for the user', () => {
  expect(profileMatch({...platform,id:'tcl-g100',tv:'TCL G100'},probe)).toBeUndefined()
  const row=(id:string,match:'model'|'platform'):DebloatListSummary=>({id,title:id,score:9,match})
  expect(recommendedProfile([row('a','model'),row('b','model'),row('c','platform')])).toBeUndefined()
  expect(recommendedProfile([row('a','platform'),row('b','platform')])).toBeUndefined()
  expect(recommendedProfile([row('a','model'),row('b','platform')])?.id).toBe('a')
  expect(recommendedProfile([{id:'brand',title:'TCL',score:10}])).toBeUndefined()
 })
})
