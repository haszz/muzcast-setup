import { testFilteringDns } from './filtering-dns'
import { revealWindow } from './window-lifecycle'
import * as telemetry from './telemetry'
import { app, BrowserWindow, dialog, ipcMain, session, shell } from 'electron'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { configurePaths, paths } from './paths'
import { log, setSinks } from './log'
import * as T from './tv'
import * as debloat from './debloat'
import { appMetadata } from './app-metadata'
import * as launcher from './launcher'
import * as system from './system'
import * as optimization from './optimization'
import * as sideload from './sideload'
import * as muzcast from './muzcast'
import * as tools from './toolchain'
import { discover, stopDiscovery } from './discover'
import { localSubnets, scan } from './scan'
import { reconnect } from './reconnect'
import { bootCheck } from './bootcheck'
import { check as checkUpdate, type UpdateCache } from './updates'
import { autoConnect, forgetTv, listTvs, rememberTv, setThumb } from './tvlist'
import * as web from './web'
import * as home from './home'
import * as themes from './themes'
import { THEME_EXT, themeFileName } from '@shared/themes'
import { bugReport } from './report'
import type { CheckItem, ConnStatus, CytvApi, KnownTv } from '@shared/api'

let win: BrowserWindow | null = null
let exiting = false

interface Settings {
  lastHost?: string
  /** The TV that answered there, to notice a different device at the same address. */
  lastDevice?: string
  lastModel?: string
  /** Every TV connected before. With more than one, the app waits for the user to pick. */
  tvs?: KnownTv[]
  update?: UpdateCache
}

function readSettings(): Settings {
  try { return JSON.parse(readFileSync(paths.settings, 'utf8')) } catch { return {} }
}

function writeSettings(s: Settings): void {
  mkdirSync(paths.data, { recursive: true })
  writeFileSync(paths.settings, JSON.stringify(s, null, 2))
}

const knownTvs = (): KnownTv[] => listTvs(readSettings())
const remember = (host: string, st: ConnStatus): void => writeSettings(rememberTv(readSettings(), host, st))

async function checks(): Promise<CheckItem[]> {
  const st = T.getStatus()
  const connected = st.state === 'connected'
  return [
    {
      id: 'network', label: 'Local network',
      ...(localSubnets().length
        ? { status: 'ok', detail: `This computer is on ${localSubnets().map((n) => n + '.x').join(', ')}.` }
        : { status: 'missing', detail: 'No home network found. Join the same Wi-Fi or Ethernet as the TV.' })
    },
    {
      id: 'tv', label: 'TV with network debugging on',
      ...(connected
        ? { status: 'ok', detail: `${st.probe?.manufacturer} ${st.probe?.model} at ${st.host}` }
        : { status: 'missing', detail: 'Turn on Developer options and USB debugging on the TV, then find it below.' })
    },
    {
      id: 'auth', label: 'This computer allowed on the TV',
      ...(connected
        ? { status: 'ok', detail: 'The TV accepted this computer.' }
        : st.state === 'waiting-auth'
          ? { status: 'checking', detail: 'Choose Allow on the TV.' }
          : { status: 'missing', detail: 'The TV asks once, the first time you connect.' })
    },
    {
      id: 'platform-tools', label: "Google's adb (only for Wireless debugging pairing)",
      ...(tools.platformToolsReady() ? { status: 'ok', detail: tools.adbPath() } : { status: 'optional', detail: 'About 15 MB. Some Google TVs need a one-time pairing code.', download: 'platform-tools' })
    }
  ] as CheckItem[]
}

type Handlers = { [K in keyof CytvApi as CytvApi[K] extends (...a: never[]) => Promise<unknown> ? K : never]: CytvApi[K] }

const handlers: Omit<Handlers, 'onLog' | 'onProgress' | 'onStatus'> = {
  tvDiagnostics: () => optimization.diagnostics(),
  restoreOptimization: () => optimization.restore(),
  setMuzcastHome: () => muzcast.setHome(),
  telemetryStatus: async () => telemetry.status(),
  telemetryPreference: async (enabled,code) => telemetry.preference(enabled,code),
  muzcastStatus: () => muzcast.inspect(),
  installMuzcast: (product) => muzcast.install(product),
  openMuzcast: (product) => muzcast.open(product),
  scan: () => scan(),
  discover: () => discover(),
  stopDiscovery: async () => stopDiscovery(),
  connect: async (host) => {
    const s = await T.connect(host)
    if (s.state === 'connected') remember(host.trim(), s)
    return s
  },
  // Only the saved address; T.connect, not handlers.connect, so a wrong device is never saved. With more
  // than one TV known, nothing connects by itself: the user picks.
  reconnect: async () => {
    if (!autoConnect(readSettings())) return null
    const s = await reconnect(readSettings(), { connect: T.connect, disconnect: T.disconnect, report: T.report })
    if (s?.state === 'connected') remember(s.host ?? readSettings().lastHost!, s)
    return s
  },
  knownTvs: async () => knownTvs(),
  connectKnown: async (host) => {
    const tv = knownTvs().find((t) => t.host === host)
    if (!tv) throw new Error('That TV is not in the list.')
    const s = await reconnect({ lastHost: tv.host, lastDevice: tv.device, lastModel: tv.model }, { connect: T.connect, disconnect: T.disconnect, report: T.report })
    if (s?.state === 'connected') remember(tv.host, s)
    return s ?? T.getStatus()
  },
  forgetTv: async (host) => {
    writeSettings(forgetTv(readSettings(), host))
    return knownTvs()
  },
  saveTvThumb: async (host, dataUrl) => {
    writeSettings(setThumb(readSettings(), host, dataUrl))
    return knownTvs()
  },

  disconnect: async () => T.disconnect(),
  status: async () => T.getStatus(),
  lastHost: async () => readSettings().lastHost ?? null,
  checkAdbClosed: (host) => system.adbClosed(host),
  bootCheck: () => bootCheck(),
  checkUpdate: async () => {
    const s = readSettings()
    const { info, cache } = await checkUpdate(app.getVersion(), s.update ?? {})
    if (cache !== s.update) writeSettings({ ...readSettings(), update: cache })
    return info
  },
  // The pairing form connects once this returns. Connecting here too would do it twice.
  pair: (host, pairPort, code, connectPort) => tools.pair(host, pairPort, code, connectPort),
  bugReport: () => bugReport(app.getVersion()),
  checks,
  download: (tool) => tools.get(tool),
  recoveryLists: async () => debloat.recoveryLists(),
  lists: async () => debloat.lists(T.getStatus().probe),
  plan: (id) => debloat.plan(id),
  tvPackages: () => debloat.tvPackages(),
  applyDebloat: (req) => debloat.apply(req),
  restore: (id) => debloat.restore(id),
  useStockLauncher: () => launcher.useStock(),
  removeOldLauncher: () => launcher.removeOld(),
  homeStatus: () => home.status(),
  installHome: (stock) => home.install(typeof stock === 'string' ? stock : undefined),
  useHome: async (stock) => {
    const st = await home.status()
    if (!st.installed) return { ok: false, summary: 'CleanMyTV Home is not installed yet.', warnings: [] }
    return launcher.switchTo(`${launcher.HOME_PKG}/.MainActivity`, typeof stock === 'string' ? stock : undefined)
  },
  appMetadata,
  homeApps: () => home.apps(),
  readHomeConfig: () => home.readConfig(),
  setRemoteButtons: (on) => home.setRemoteButtons(on === true),
  setLockPin: (pin) => home.setLockPin(String(pin ?? '')),
  setAppLock: (on) => home.setAppLock(on === true),
  clearAppLock: () => home.clearAppLock(),
  themePackBegin: () => home.themePackBegin(),
  themePackPut: (item) => home.themePackPut(item),
  themePackEnd: (order) => home.themePackEnd(order),
  setSlides: (jpegs) => home.setSlides(jpegs),
  fireplace: (action) => home.fireplace(action === 'put' || action === 'saver' || action === 'remove' ? action : 'show'),
  homeKeys: () => home.keys(),
  setHomeConfig: (change) => home.setConfig(change ?? {}),
  setHomeWallpaper: (jpeg) => home.setWallpaper(jpeg),
  applyHomeTheme: (theme) => themes.apply(theme),
  themeBackup: () => themes.backup(),
  restoreThemeBackup: () => themes.restore(),
  forgetThemeBackup: async () => themes.forget(),
  saveHomeTheme: (name) =>
    themes.save(String(name ?? ''), async (n) => {
      const opts = { title: 'Save the theme', defaultPath: join(app.getPath('documents'), themeFileName(n)), filters: [{ name: 'CleanMyTV theme', extensions: [THEME_EXT] }] }
      const r = win && !win.isDestroyed() ? await dialog.showSaveDialog(win, opts) : await dialog.showSaveDialog(opts)
      return r.canceled || !r.filePath ? null : r.filePath
    }),
  screenshot: () => system.screenshot(),
  // Nobody asked for this one, so a TV that can't take it (a Mi Box S, on first connect) gets a note, not an error.
  thumbShot: () => system.screenshot().catch((e: Error) => {
    log('screenshot', 'info', `no picture of the TV screen for the list this time: ${e.message}`)
    return null
  }),
  webGet: (url) => web.get(String(url)),
  systemState: () => system.state(),
  testFilteringDns,
  setPrivateDns: (host) => optimization.dns(host),
  setAnimationScale: (s) => optimization.animations(s),
  fixScreensaver: () => system.fixScreensaver(),
  sideloadInfo: (path) => sideload.inspect(String(path)),
  sideload: (path) => sideload.install(String(path)),
  clearCaches: () => system.clearCaches(),
  key: (code) => system.key(code),
  reboot: () => system.reboot()
}

function send(channel: string, value: unknown): void {
  if (win && !win.isDestroyed() && !win.webContents.isDestroyed()) win.webContents.send(channel, value)
}

// The dev server URL is honoured only in a dev run; an installed app always loads its own files.
const devUrl = !app.isPackaged ? process.env.ELECTRON_RENDERER_URL : undefined
const appPage = (): string => pathToFileURL(join(__dirname, '../renderer/index.html')).href

/** The bridge controls the TV, so only the app's own page may use it: never a navigated-to or framed page. */
function isAppUrl(url: string | undefined): boolean {
  if (!url) return false
  const bare = url.split('#')[0].split('?')[0]
  return devUrl ? new URL(url).origin === new URL(devUrl).origin : bare === appPage()
}

function createWindow(): void {
  win = new BrowserWindow({
    width: 1240,
    height: 820,
    minWidth: 960,
    minHeight: 640,
    title: 'Muzcast · À la maison',
    backgroundColor: '#FFFFFF',
    show: false,
    webPreferences: { preload: join(__dirname, '../preload/index.js'), sandbox: true, contextIsolation: true, nodeIntegration: false, webviewTag: false }
  })
  // Nothing in the app navigates; links open in the system browser instead (below).
  win.webContents.on('will-navigate', (e, url) => { if (!isAppUrl(url)) e.preventDefault() })
  win.webContents.on('will-redirect', (e, url) => { if (!isAppUrl(url)) e.preventDefault() })
  win.webContents.on('will-attach-webview', (e) => e.preventDefault())
  const created = win
  created.once('closed', () => { if (win === created) win = null })
  created.once('ready-to-show', () => { if (!exiting && !created.isDestroyed()) created.show() })
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https:\/\//.test(url)) shell.openExternal(url)
    return { action: 'deny' }
  })
  if (devUrl) win.loadURL(devUrl)
  else win.loadFile(join(__dirname, '../renderer/index.html'))
}

// One copy at a time: two would race on the key file and on the same TV connection.
const primary = app.requestSingleInstanceLock()
if (!primary) app.quit()
const revealMainWindow = (): void => revealWindow(win, createWindow, primary && app.isReady(), exiting)
app.on('open-url', (event,url) => {event.preventDefault();telemetry.receive(url);revealMainWindow()})
app.on('second-instance', (_event,argv) => {
  for(const arg of argv)if(arg.startsWith('muzcastsetup:'))telemetry.receive(arg)
  revealMainWindow()
})

app.whenReady().then(() => {
  if (!primary) return
  // The app needs no camera, microphone, notifications or other web permissions.
  session.defaultSession.setPermissionRequestHandler((_wc, _perm, cb) => cb(false))
  // Packaged: lists and the APK sit in Contents/Resources (mac) or resources\ (Windows).
  configurePaths(app.isPackaged ? process.resourcesPath : join(app.getAppPath(), 'resources'), app.getPath('userData'))
  telemetry.init()
  for(const arg of process.argv)if(arg.startsWith('muzcastsetup:'))telemetry.receive(arg)
  if(app.isPackaged)app.setAsDefaultProtocolClient('muzcastsetup')
  setSinks((line) => send('log', line), (p) => send('progress', p))
  T.init(paths.adbKey, (s: ConnStatus) => send('status', s))
  for (const [name, fn] of Object.entries(handlers)) {
    ipcMain.handle(name, async (e, ...args: unknown[]) => {
      if (!isAppUrl(e.senderFrame?.url)) throw new Error('blocked: this request did not come from the app window')
      try {
        return await telemetry.operation(name,args,()=> (fn as (...a: unknown[]) => Promise<unknown>)(...args))
      } catch (e) {
        log(name, 'error', (e as Error).message)
        throw e
      }
    })
  }
  createWindow()
  app.on('activate', revealMainWindow)
})

app.on('window-all-closed', () => {
  T.disconnect()
  if (process.platform !== 'darwin') app.quit()
})

app.on("before-quit",event=>{if(exiting)return;event.preventDefault();exiting=true;void telemetry.flush().finally(()=>app.quit())})
