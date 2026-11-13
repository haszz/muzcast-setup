// Use macOS's shared Bonjour daemon when raw multicast sockets miss TV announcements.
import { spawn, type ChildProcess } from 'node:child_process'
import type { Advert } from './discover'
import { isPrivateIpv4 } from './scan'

const SERVICE = '_adb._tcp.local'
export function browseInstances(output: string): string[] {
  return [...new Set(output.split('\n').flatMap(line => {
    const m = /\bAdd\s+\S+\s+\d+\s+local\.\s+_adb\._tcp\.\s+(.+?)\s*$/.exec(line)
    return m && m[1].length <= 255 ? [m[1]] : []
  }))].slice(0, 16)
}
export function resolveEndpoint(output: string): { host: string; port: number } | null {
  const m = /can be reached at ([A-Za-z0-9._-]+):(\d+)\s/.exec(output)
  const port = Number(m?.[2])
  return m && port > 0 && port <= 65535 ? {host:m[1],port} : null
}
export function resolveAddresses(output: string): string[] {
  return [...new Set(output.split('\n').flatMap(line => {
    const m = /\bAdd\s+\S+\s+\d+\s+\S+\s+(\d+\.\d+\.\d+\.\d+)\s+\d+/.exec(line)
    return m && m[1].split('.').every(x => Number(x) <= 255) && isPrivateIpv4(m[1]) ? [m[1]] : []
  }))]
}
export class MacAdbDiscovery {
  private children = new Set<ChildProcess>()
  private generation = 0
  private running = false
  private nextRun = 0
  private results: Advert[] = []
  private expires = 0

  private command(args: string[], duration: number, generation: number): Promise<string> {
    if (generation !== this.generation) return Promise.resolve('')
    return new Promise(resolve => {
      const child = spawn('/usr/bin/dns-sd',args,{stdio:['ignore','pipe','ignore']})
      this.children.add(child)
      let output = '', done = false
      const finish = (): void => {
        if (done) return
        done = true
        clearTimeout(timer)
        child.kill('SIGTERM')
        this.children.delete(child)
        resolve(generation === this.generation ? output : '')
      }
      const timer = setTimeout(finish,duration)
      child.stdout?.on('data',chunk => {
        output += chunk.toString()
        if (output.length > 65536) { output = ''; finish() }
      })
      child.on('error',finish)
      child.on('close',finish)
    })
  }
  private async refresh(generation: number): Promise<void> {
    const names = browseInstances(await this.command(['-B','_adb._tcp','local.'],2000,generation))
    const found: Advert[] = []
    // Bound child processes, even on networks with many adverts.
    for (let i=0;i<names.length;i+=4) {
      await Promise.all(names.slice(i,i+4).map(async instance => {
        const endpoint = resolveEndpoint(await this.command(['-L',instance,'_adb._tcp','local.'],2500,generation))
        if (!endpoint) return
        const ips = resolveAddresses(await this.command(['-G','v4',endpoint.host],1500,generation))
        for (const ip of ips) found.push({service:SERVICE,instance,ip,port:endpoint.port})
      }))
    }
    if (generation === this.generation) {
      this.results = found
      this.expires = Date.now()+30000
    }
  }
  adverts(): Advert[] {
    if (!this.running && Date.now() >= this.nextRun) {
      const generation = this.generation
      this.running = true
      this.nextRun = Date.now()+15000
      void this.refresh(generation).catch(()=>{}).finally(()=>{
        if (generation === this.generation) this.running = false
      })
    }
    return Date.now() < this.expires ? this.results : []
  }
  stop(): void {
    this.generation++
    for (const child of this.children) child.kill('SIGTERM')
    this.children.clear()
    this.running = false
    this.nextRun = 0
    // Keep the last adverts until their expiry across a connection attempt.
  }
}
