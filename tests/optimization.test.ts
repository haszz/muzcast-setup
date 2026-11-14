import { beforeEach, afterEach, expect, it, vi } from 'vitest'
import { mkdtempSync, rmSync, readdirSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
const mock=vi.hoisted(()=>({shell:vi.fn(),dns:vi.fn(),animations:vi.fn()}))
vi.mock('../src/main/tv',()=>({getStatus:()=>({state:'connected',probe:{host:'test',manufacturer:'Sony',model:'TV',device:'board'}}),tv:()=>({shell:mock.shell}),PACKAGE_RE:/^[a-z][\w]*(\.[\w]+)+$/,homeComponent:async()=>null}))
vi.mock('../src/main/system',()=>({privateDns:mock.dns,animationScale:mock.animations}))
import { configurePaths } from '../src/main/paths'
import { dns, animations, restore, diagnostics } from '../src/main/optimization'
let dir:string
let values:Record<string,string>
beforeEach(()=>{vi.clearAllMocks();dir=mkdtempSync(join(tmpdir(),'muz-opt-'));configurePaths(dir,dir);values={private_dns_mode:'opportunistic',private_dns_specifier:'null',window_animation_scale:'1',transition_animation_scale:'0.5',animator_duration_scale:'1'};mock.shell.mockImplementation(async(command:string)=>{const parts=command.split(' ');if(parts[0]==='settings'){if(parts[1]==='get')return values[parts[3]];values[parts[3]]=parts[1]==='delete'?'null':parts[4].replaceAll("'",'');return ''}return ''});mock.dns.mockImplementation(async()=>{values.private_dns_mode='hostname';return {ok:true,summary:'ok',warnings:[]}});mock.animations.mockResolvedValue({ok:true,summary:'ok',warnings:[]})})
afterEach(()=>rmSync(dir,{recursive:true,force:true}))
it('preserves the original settings across repeated changes and restores each animation independently',async()=>{await dns('dns.example.org');await animations(0);await restore();expect(values.private_dns_mode).toBe('opportunistic');expect(values.transition_animation_scale).toBe('0.5')})
it('never changes settings when there is no backup',async()=>{expect((await restore()).ok).toBe(false);expect(mock.shell).not.toHaveBeenCalled()})
it('rejects a corrupted backup before any shell mutation',async()=>{await dns('dns.example.org');const folder=join(dir,'optimization');writeFileSync(join(folder,readdirSync(folder)[0]),JSON.stringify({private_dns_mode:"x'; reboot"}));mock.shell.mockClear();await expect(restore()).rejects.toThrow('invalide');expect(mock.shell).not.toHaveBeenCalled()})
it('does not infer proven tracking from a package name',async()=>{mock.shell.mockImplementation(async(c:string)=>c==='pm list packages'?'package:com.vendor.analytics\npackage:com.safe.player':'');const r=await diagnostics();expect(r.findings).toHaveLength(1);expect(r.findings[0].evidence).toContain('aucune activité de suivi prouvée');expect(r.memoryAvailableKb).toBeNull()})
