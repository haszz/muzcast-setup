export const VISIT_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/
export function parseLink(code: string, now=Date.now()): string | null {
 const match=/^MTV1\.([0-9a-f-]{36})\.(\d{13})$/.exec(code)
 if(!match||!VISIT_PATTERN.test(match[1]))return null
 const age=now-Number(match[2]);return age>=-300000&&age<30*86400000?match[1]:null
}
export function codeFromFilename(name:string):string|null {
 const match=/^Muzcast-Setup-0\.1\.6(?:-mac-(?:arm64|x64))?--([0-9a-f-]{36})--(\d{13})\.(?:exe|dmg)$/.exec(name)
 return match?`MTV1.${match[1]}.${match[2]}`:null
}
export function codeFromUrl(raw:string):string|null {
 try{const u=new URL(raw);if(u.protocol!=='muzcastsetup:'||u.hostname!=='link'||(u.pathname!==''&&u.pathname!=='/'))return null;const code=u.searchParams.get('code');return code&&parseLink(code)?code:null}catch{return null}
}
