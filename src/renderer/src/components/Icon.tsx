import { Tv, LayoutGrid, Gauge, HardDrive, Download, BrushCleaning, Play, Wifi, Check, ShieldCheck, CircleHelp, Info,
  ArrowUpRight, ArrowRight, ArrowLeft, Plus, X, Settings, Cable, Search, RefreshCw } from 'lucide-react'
const icons = { apps: LayoutGrid, speed: Gauge, storage: HardDrive, tv: Tv, download: Download, clean: BrushCleaning, play: Play, wifi: Wifi,
  check: Check, shield: ShieldCheck, help: CircleHelp, info: Info, arrow: ArrowUpRight,
  right: ArrowRight, left: ArrowLeft, plus: Plus, close: X, settings: Settings,
  cable: Cable, search: Search, refresh: RefreshCw }
export type IconName = keyof typeof icons
export function Icon({ name }: { name: IconName }) {
  const Glyph = icons[name]
  return <Glyph className="mz-icon" size={22} strokeWidth={1.75} aria-hidden="true" />
}
