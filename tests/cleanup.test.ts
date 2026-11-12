import { expect, it } from 'vitest'
import { protectedApp, appExplanation } from '../src/shared/cleanup'
it('keeps home, casting, speech and accessibility out of the simplified list', () => {
  for (const p of [
    'com.gathin.tvhome',
    'co.muzcast.tv',
    'com.google.android.tts',
    'com.sony.dtv.airplayapp',
    'com.google.android.apps.tv.launcherx',
    'com.android.tv.settings',
  ])
    expect(protectedApp(p)).toBe(true)
  expect(protectedApp('com.sony.dtv.promos')).toBe(false)
})
it('explains known apps in French and asks caution for unknown packages', () => {
  expect(appExplanation('com.sony.dtv.promos').title).toBe(
    'Recommandations promotionnelles',
  )
  expect(appExplanation('vendor.unknown').description).toContain(
    'laissez-la activée',
  )
})
