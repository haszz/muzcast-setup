import { beforeEach, expect, it, vi } from 'vitest'
const mock = vi.hoisted(() => ({
  status: { state: 'connected', host: 'tv:5555', probe: { sdk: 30 } },
  shell: vi.fn(),
  install: vi.fn(),
  verify: vi.fn(),
}))
vi.mock('../src/main/tv', () => ({
  getStatus: () => mock.status,
  tv: () => ({ shell: mock.shell }),
}))
vi.mock('../src/main/sideload', () => ({ install: mock.install }))
vi.mock('../src/main/muzcast-release', () => ({
  PRODUCTS: {
    launcher: { name: 'Muzcast TV', manifest: 'manifest', package: 'com.gathin.tvhome' },
    muzcast: {
      name: 'Muzcast',
      manifest: 'manifest',
      package: 'co.muzcast.tv',
    },
  },
  download: async () => Buffer.from('{}'),
  release: () => ({ url: 'apk', name: '1.0', versionCode: 29 }),
  verifyApk: mock.verify,
}))
import { install, open } from '../src/main/muzcast'
beforeEach(() => {
  vi.resetAllMocks()
  mock.status.state = 'connected'
  mock.status.probe.sdk = 30
  mock.install.mockResolvedValue({ ok: true })
  mock.shell.mockResolvedValue('versionCode=29 minSdk=26')
})
it('installs and verifies the version returned by the TV', async () => {
  await expect(install('muzcast')).resolves.toEqual({ version: '1.0' })
  expect(mock.verify).toHaveBeenCalled()
  expect(mock.install).toHaveBeenCalledOnce()
  expect(mock.shell).toHaveBeenCalledWith('dumpsys package co.muzcast.tv')
})
it('does not claim success when the installed version differs', async () => {
  mock.shell.mockResolvedValue('versionCode=28 minSdk=26')
  await expect(install('muzcast')).rejects.toThrow('non confirmée')
})
it('rejects disconnected or incompatible TVs before installing', async () => {
  mock.status.probe.sdk = 25
  await expect(install('muzcast')).rejects.toThrow('Android 8')
  expect(mock.install).not.toHaveBeenCalled()
})
it('keeps installation failures visible and allows a retry', async () => {
  mock.install.mockResolvedValueOnce({
    ok: false,
    summary: 'Échec',
    warnings: ['Stockage insuffisant'],
  })
  await expect(install('muzcast')).rejects.toThrow('Stockage insuffisant')
  await expect(install('muzcast')).resolves.toEqual({ version: '1.0' })
})

it('opens the resolved TV activity, not the phone launcher category', async () => {
  mock.shell.mockResolvedValueOnce('co.muzcast.tv/.TvActivity').mockResolvedValueOnce('Status: ok\nActivity: co.muzcast.tv/.TvActivity')
  await expect(open('muzcast')).resolves.toBeUndefined()
  expect(mock.shell).toHaveBeenLastCalledWith('am start -W -a android.intent.action.MAIN -c android.intent.category.LEANBACK_LAUNCHER -n co.muzcast.tv/.TvActivity')
})
it('explains an absent app without attempting to launch it', async () => {
  mock.shell.mockResolvedValueOnce('No activity found').mockResolvedValueOnce('No activities found').mockResolvedValueOnce('')
  await expect(open('muzcast')).rejects.toThrow('Installer Muzcast')
  expect(mock.shell).toHaveBeenCalledTimes(3)
})
it('does not claim that a rejected TV launch succeeded', async () => {
  mock.shell.mockResolvedValueOnce('co.muzcast.tv/.TvActivity').mockResolvedValueOnce('Error: Permission Denial')
  await expect(open('muzcast')).rejects.toThrow('Applications → Muzcast')
})

it('opens the home instead of Adhkar when Android resolves to its chooser', async () => {
  mock.shell.mockResolvedValueOnce('android/com.android.internal.app.ResolverActivity')
    .mockResolvedValueOnce('2 activities found:\ncom.gathin.tvhome/.AdhkarApp\ncom.gathin.tvhome/.MainActivity')
    .mockResolvedValueOnce('Status: ok');
  await expect(open('launcher')).resolves.toBeUndefined()
  expect(mock.shell).toHaveBeenLastCalledWith('am start -W -a android.intent.action.MAIN -c android.intent.category.LEANBACK_LAUNCHER -n com.gathin.tvhome/.MainActivity')
})
it('does not report an installed app as absent when no safe entry can be identified', async () => {
  mock.shell.mockResolvedValueOnce('No activity found').mockResolvedValueOnce('No activities found')
    .mockResolvedValueOnce('package:/data/app/base.apk')
  await expect(open('muzcast')).rejects.toThrow('est installé')
  expect(mock.shell.mock.calls.some(([cmd]) => cmd.startsWith('am start'))).toBe(false)
})
