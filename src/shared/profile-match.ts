import type { DebloatListSummary, Probe } from './api'

const normalized = (value: string): string => value.trim().toLowerCase()
const genericModel = /^(smart\s*tv|android\s*tv|google\s*tv|tv|unknown|generic)$/i
const contains = (text: string, value: string): boolean => {
  const token = normalized(value)
  if (token.length < 3) return false
  return new RegExp(`(^|[^a-z0-9])${token.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}([^a-z0-9]|$)`, 'i').test(text)
}

/** Only declared model metadata or a platform-named profile can be selected automatically. */
export function profileMatch(profile: {id:string; tv:string; brand:string; os:string}, probe: Probe): DebloatListSummary['match'] {
  if (!normalized(profile.brand) || normalized(profile.brand) !== normalized(probe.manufacturer)) return undefined
  const version = /(?:Android|Google TV|Android TV)\s+(\d+)/i.exec(profile.os)?.[1]
  if (version && version !== probe.release.split('.')[0]) return undefined
  if (!genericModel.test(probe.model.trim()) && contains(profile.tv, probe.model)) return 'model'
  // A G10 mentioned by several retail-model profiles must not select one of those models.
  if (contains(profile.id, probe.device) && contains(profile.tv, probe.device)) return 'platform'
  return undefined
}

export function recommendedProfile(lists: DebloatListSummary[]): DebloatListSummary | undefined {
  const exact = lists.filter(list => list.match === 'model')
  if (exact.length) return exact.length === 1 ? exact[0] : undefined
  const platforms = lists.filter(list => list.match === 'platform')
  return platforms.length === 1 ? platforms[0] : undefined
}
