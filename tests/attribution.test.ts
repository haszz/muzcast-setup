import {describe,it,expect} from 'vitest'
import {parseLink,codeFromFilename,codeFromUrl} from '../src/shared/attribution'
const id='11111111-1111-4111-8111-111111111111', now=Date.now(),code=`MTV1.${id}.${now}`
describe('installer attribution',()=>{
 it('accepts only a recent anonymous UUID',()=>{expect(parseLink(code,now)).toBe(id);expect(parseLink(`MTV1.${id}.${now-31*86400000}`,now)).toBeNull();expect(parseLink(`MTV1.${id}.${now+600000}`,now)).toBeNull();expect(parseLink('MTV1.user@example.com.123')).toBeNull()})
 it('reads exact Windows and Mac filenames, without unrelated files',()=>{for(const suffix of ['.exe','-mac-arm64.dmg','-mac-x64.dmg']){const dot=suffix.lastIndexOf('.');expect(codeFromFilename(`Muzcast-Setup-0.1.5${suffix.slice(0,dot)}--${id}--${now}${suffix.slice(dot)}`)).toBe(code)}expect(codeFromFilename('OtherApp.exe')).toBeNull()})
 it('accepts only link protocol, never an action or remote host',()=>{expect(codeFromUrl('muzcastsetup://link?code='+code)).toBe(code);expect(codeFromUrl('https://link?code='+code)).toBeNull();expect(codeFromUrl('muzcastsetup://install?code='+code)).toBeNull()})
})
