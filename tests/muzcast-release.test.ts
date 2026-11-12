import { describe, expect, it } from 'vitest'
import {
  allowedUrl,
  download,
  release,
  verifyApk,
} from '../src/main/muzcast-release'
const sha256 = 'a'.repeat(64)
describe('Muzcast official releases', () => {
  it('accepts both manifest formats', () => {
    expect(
      release('launcher', {
        apk: 'https://www.muzcast.co/tv/a.apk',
        sha256,
        versionCode: 2,
      }).versionCode,
    ).toBe(2)
    expect(
      release('muzcast', {
        url: 'https://www.muzcast.co/a.apk',
        packageName: 'co.muzcast.tv',
        sha256,
        versionCode: 29,
      }).versionCode,
    ).toBe(29)
  })
  it('rejects missing hashes, wrong packages and insecure sources', () => {
    expect(() =>
      release('launcher', {
        apk: 'https://www.muzcast.co/a.apk',
        versionCode: 2,
      }),
    ).toThrow()
    expect(() =>
      release('muzcast', {
        url: 'https://www.muzcast.co/a.apk',
        sha256,
        versionCode: 2,
        packageName: 'bad.app',
      }),
    ).toThrow()
    for (const u of [
      'http://www.muzcast.co/a.apk',
      'https://evil.com/a.apk',
      'https://www.muzcast.co.evil.com/a',
      'https://user@www.muzcast.co/a',
      'https://other.r2.cloudflarestorage.com/a',
    ])
      expect(() => allowedUrl(u)).toThrow()
  })
  it('checks redirect targets before fetching', async () => {
    let calls = 0
    const fetcher = (async () => {
      calls++
      return new Response(null, {
        status: 302,
        headers: { location: 'https://evil.com/a.apk' },
      })
    }) as typeof fetch
    await expect(
      download('https://www.muzcast.co/a.apk', 100, fetcher),
    ).rejects.toThrow('non autorisée')
    expect(calls).toBe(1)
  })
  it('bounds streamed downloads and handles service errors', async () => {
    await expect(
      download(
        'https://www.muzcast.co/a',
        2,
        (async () => new Response('oversize')) as typeof fetch,
      ),
    ).rejects.toThrow('volumineux')
    await expect(
      download(
        'https://www.muzcast.co/a',
        100,
        (async () => new Response(null, { status: 503 })) as typeof fetch,
      ),
    ).rejects.toThrow('503')
  })
  it('rejects a corrupted APK', () =>
    expect(() =>
      verifyApk('launcher', Buffer.from('broken'), {
        sha256,
        url: '',
        versionCode: 2,
        name: '2',
      }),
    ).toThrow('modifié'))
})
