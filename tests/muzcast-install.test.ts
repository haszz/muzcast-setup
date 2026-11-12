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
import { install } from '../src/main/muzcast'
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
