import { useEffect, useState } from 'react'
import type {
  ConnStatus,
  FoundTv,
  HomeStatus,
  KnownTv,
  DownloadProgress,
} from '@shared/api'
import { Clean } from './screens/MuzcastClean'
import logo from './assets/logo.svg'
import launcher from './assets/launcher.webp'
import accueil from './assets/accueil.webp'
import './muzcast.css'
// Kept for the upstream screens, which remain available to maintainers.
export type StepId =
  | 'guided'
  | 'setup'
  | 'debloat'
  | 'home'
  | 'extras'
  | 'sideload'
  | 'finish'
export interface ScreenProps {
  status: ConnStatus
  go: (step: StepId) => void
  markDone: (step: StepId) => void
  tvs: KnownTv[]
  refreshTvs: () => void
  homeSeen: (hs: HomeStatus) => void
}
type Product = 'launcher' | 'muzcast'
const products = [
  {
    id: 'launcher' as Product,
    name: 'Muzcast TV',
    role: 'Un nouvel accueil pour votre TV',
    image: launcher,
    text: 'Vos applications, vos horaires de prière et un univers qui vous ressemble.',
  },
  {
    id: 'muzcast' as Product,
    name: 'Muzcast',
    role: 'Des récits à vivre en grand',
    image: accueil,
    text: 'Le catalogue audio, les transcriptions, Muzcast AI Lens et l’adhan complet.',
  },
]
const labels = [
  'Connecter ma TV',
  'Installer Muzcast',
  'Alléger ma TV',
  'En profiter',
]
export default function App() {
  const [step, setStep] = useState(0),
    [status, setStatus] = useState<ConnStatus>({ state: 'idle' })
  const [found, setFound] = useState<FoundTv[]>([]),
    [host, setHost] = useState(''),
    [busy, setBusy] = useState(false),
    [error, setError] = useState('')
  const [pairing, setPairing] = useState(false),
    [code, setCode] = useState(''),
    [pairPort, setPairPort] = useState(''),
    [port, setPort] = useState('')
  const [selected, setSelected] = useState<Product[]>(['launcher', 'muzcast']),
    [installed, setInstalled] = useState<Partial<Record<Product, string>>>({}),
    [active, setActive] = useState<Product | null>(null),
    [progress, setProgress] = useState<DownloadProgress | null>(null)
  useEffect(() => {
    setInstalled({})
    setError('')
  }, [status.host])
  const connected = status.state === 'connected'
  const demo = !navigator.userAgent.includes('Electron')
  useEffect(() => {
    window.cytv.status().then(setStatus)
    const stop = window.cytv.onStatus(setStatus)
    const off = window.cytv.onProgress(setProgress)
    return () => {
      stop()
      off()
    }
  }, [])
  useEffect(() => {
    if (connected || busy || step !== 0) return
    let live = true
    const discover = () =>
      window.cytv.discover().then(
        (x) => {
          if (live) setFound(x)
        },
        () => {},
      )
    discover()
    const id = setInterval(discover, 3000)
    return () => {
      live = false
      clearInterval(id)
      void window.cytv.stopDiscovery()
    }
  }, [connected, busy, step])
  async function run(action: () => Promise<void>) {
    setBusy(true)
    setError('')
    try {
      await action()
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(false)
    }
  }
  async function connect(address = host) {
    await run(async () => {
      const s = await window.cytv.connect(address.trim())
      setStatus(s)
      if (s.needsPairing) setPairing(true)
      if (s.state === 'error') throw Error(s.error || 'Connexion impossible.')
    })
  }
  async function install() {
    await run(async () => {
      for (const p of selected) {
        if (installed[p]) continue
        setActive(p)
        setProgress(null)
        const r = await window.cytv.installMuzcast(p)
        setInstalled((x) => ({ ...x, [p]: r.version }))
      }
      setActive(null)
      setStep(2)
    })
    setActive(null)
  }
  return (
    <div className="mz-app">
      <aside className="mz-sidebar">
        <img className="mz-logo" src={logo} alt="Muzcast" />
        <span className="mz-tag">À la maison</span>
        <p className="mz-intro">
          Votre univers Muzcast,
          <br />
          sur grand écran.
        </p>
        <nav aria-label="Étapes">
          {labels.map((l, i) => (
            <button
              key={l}
              disabled={busy || (i > 0 && !connected)}
              className={step === i ? 'current' : ''}
              onClick={() => {
                setError('')
                setStep(i)
              }}
              aria-current={step === i ? 'step' : undefined}
            >
              <span>{i + 1}</span>
              <div>
                {l}
                {i === 2 && <small>Un vrai plus · facultatif</small>}
              </div>
            </button>
          ))}
        </nav>
        <div className="mz-sidebar-bottom">
          <span className={'mz-dot ' + (connected ? 'online' : '')} />
          {connected
            ? status.probe?.model || 'TV connectée'
            : 'En attente de votre TV'}
          <a
            href="https://tv.muzcast.co/installer/"
            target="_blank"
            rel="noreferrer"
          >
            Besoin d’un coup de main ↗
          </a>
          <small>Fondé sur CleanMyTV · MIT</small>
        </div>
      </aside>
      <main className="mz-main">
        {demo && (
          <div className="mz-demo">
            Aperçu de l’interface · TV simulée, aucune installation réelle
          </div>
        )}
        <header className="mz-header">
          <span className="mz-eyebrow">MUZCAST À LA MAISON / 0{step + 1}</span>
          <h1>
            {
              [
                'Une nouvelle vie pour votre TV.',
                'Deux apps. Un même univers.',
                'Faites de la place à l’essentiel.',
                'Votre TV, à votre image.',
              ][step]
            }
          </h1>
          <p>
            {
              [
                'Quelques minutes pour réunir vos récits, vos prières et vos applications préférées.',
                'Le pack complet est sélectionné. Vous pouvez aussi choisir une seule application.',
                'Une étape utile pour réduire les applications inutiles, à votre rythme.',
                'Retrouvez Muzcast dans les applications de votre téléviseur.',
              ][step]
            }
          </p>
        </header>
        {error && (
          <div role="alert" className="mz-error">
            {error}
          </div>
        )}
        {step === 0 && (
          <>
            <div className="mz-instructions">
              <div>
                <b>1. Le même réseau</b>
                <p>
                  Allumez votre TV et connectez-la au même Wi-Fi ou réseau que
                  cet ordinateur.
                </p>
              </div>
              <div>
                <b>2. Une autorisation sur la TV</b>
                <p>
                  Dans Paramètres → À propos, appuyez 7 fois sur « Build ». Dans
                  Options développeur, activez le débogage USB ou sans fil.
                </p>
              </div>
              <div>
                <b>3. Acceptez la connexion</b>
                <p>
                  Choisissez votre TV ci-dessous, puis « Autoriser » sur son
                  écran.
                </p>
              </div>
            </div>
            <section className="mz-panel">
              <h2>
                {connected ? 'Votre TV est prête' : 'Trouver votre téléviseur'}
              </h2>
              {connected ? (
                <>
                  <p>
                    {status.probe?.manufacturer} {status.probe?.model} · Android{' '}
                    {status.probe?.release}
                  </p>
                  <button className="mz-primary" onClick={() => setStep(1)}>
                    Choisir mes applications →
                  </button>
                </>
              ) : (
                <>
                  {found.map((t) => (
                    <button
                      disabled={busy}
                      className="mz-device"
                      key={t.host}
                      onClick={() => {
                        setHost(t.host.split(':')[0])
                        setPairPort(String(t.pairPort || ''))
                        setPort(String(t.connectPort || ''))
                        if (t.ready) void connect(t.host)
                        else setPairing(true)
                      }}
                    >
                      ▣ <strong>{t.name || t.host}</strong>
                      <span>{t.ready ? 'Connecter →' : 'Associer →'}</span>
                    </button>
                  ))}
                  {!found.length && (
                    <p className="mz-muted">
                      Recherche des téléviseurs sur votre réseau…
                    </p>
                  )}
                  <details>
                    <summary>Ma TV n’apparaît pas</summary>
                    <p>
                      L’adresse IP se trouve dans Paramètres → Réseau sur la TV.
                    </p>
                    <div className="mz-form">
                      <label>
                        Adresse de la TV
                        <input
                          placeholder="192.168.1.50:5555"
                          value={host}
                          onChange={(e) => setHost(e.target.value)}
                        />
                      </label>
                      <button
                        disabled={busy || !host}
                        onClick={() => void connect()}
                      >
                        Connecter
                      </button>
                      <button
                        disabled={busy}
                        onClick={() =>
                          void run(async () => {
                            setFound(
                              (await window.cytv.scan()).map((t) => ({
                                ...t,
                                ready: true,
                                name: t.host,
                              })),
                            )
                          })
                        }
                      >
                        Rechercher à nouveau
                      </button>
                    </div>
                    <button
                      disabled={busy}
                      className="mz-link"
                      onClick={() => setPairing(!pairing)}
                    >
                      Ma TV affiche un code d’association
                    </button>
                  </details>
                  {pairing && (
                    <div className="mz-pair">
                      <h3>Associer avec le code de la TV</h3>
                      <p>
                        Ouvrez Débogage sans fil → Associer un appareil. Le port
                        d’association et le port de connexion sont différents.
                      </p>
                      <div className="mz-form">
                        {[
                          ['Adresse IP', host, setHost],
                          ['Port d’association', pairPort, setPairPort],
                          ['Code à 6 chiffres', code, setCode],
                          ['Port de connexion', port, setPort],
                        ].map(([name, value, set]) => (
                          <label key={String(name)}>
                            {String(name)}
                            <input
                              value={String(value)}
                              onChange={(e) =>
                                (set as (s: string) => void)(e.target.value)
                              }
                            />
                          </label>
                        ))}
                      </div>
                      <button
                        className="mz-primary"
                        disabled={
                          busy ||
                          !/^\d{6}$/.test(code) ||
                          !host ||
                          !pairPort ||
                          !port
                        }
                        onClick={() =>
                          void run(async () => {
                            await window.cytv.download('platform-tools')
                            const r = await window.cytv.pair(
                              host,
                              Number(pairPort),
                              code,
                              Number(port),
                            )
                            if (!r.ok)
                              throw Error([r.summary, ...r.warnings].join(' '))
                            setStatus(
                              await window.cytv.connect(`${host}:${port}`),
                            )
                          })
                        }
                      >
                        Associer ma TV
                      </button>
                    </div>
                  )}
                </>
              )}
              {status.state === 'waiting-auth' && (
                <p role="status">
                  Regardez votre TV : acceptez la demande d’autorisation.
                </p>
              )}
              {busy && <p role="status">Connexion en cours…</p>}
            </section>
          </>
        )}
        {step === 1 && (
          <>
            <div className="mz-products">
              {products.map((p) => (
                <label
                  className={
                    'mz-product ' + (selected.includes(p.id) ? 'selected' : '')
                  }
                  key={p.id}
                >
                  <img src={p.image} alt={p.role} />
                  <div>
                    <input
                      type="checkbox"
                      disabled={busy}
                      checked={selected.includes(p.id)}
                      onChange={(e) =>
                        setSelected((s) =>
                          e.target.checked
                            ? [...s, p.id]
                            : s.filter((x) => x !== p.id),
                        )
                      }
                    />
                    <span className="mz-eyebrow">
                      {p.id === 'launcher' ? 'L’ACCUEIL TV' : 'L’ÉCOUTE'}
                    </span>
                    <h2>{p.name}</h2>
                    <p>{p.text}</p>
                    {installed[p.id] && (
                      <strong className="mz-success">
                        ✓ Installée · {installed[p.id]}
                      </strong>
                    )}
                  </div>
                </label>
              ))}
            </div>
            <div className="mz-action">
              <div>
                <strong>
                  {active
                    ? `Installation de ${products.find((p) => p.id === active)?.name}`
                    : 'Le pack complet, simplement'}
                </strong>
                <p>
                  {active
                    ? progress?.phase === 'download'
                      ? 'Téléchargement de la version officielle…'
                      : 'Transfert et installation sur votre TV…'
                    : 'Vos applications actuelles restent en place. Les fichiers sont vérifiés avant installation.'}
                </p>
                {active && (
                  <progress
                    aria-label="Installation"
                    value={
                      progress?.total
                        ? progress.received / progress.total
                        : undefined
                    }
                    max="1"
                  />
                )}
              </div>
              <button
                className="mz-primary"
                disabled={busy || !selected.length || !connected}
                onClick={() => void install()}
              >
                {busy
                  ? 'Installation en cours…'
                  : selected.every((p) => installed[p])
                    ? 'Continuer →'
                    : `Installer ${selected.length === 2 ? 'les deux apps' : 'l’application'} →`}
              </button>
            </div>
          </>
        )}
        {step === 2 && (
          <Clean
            onNext={() => setStep(3)}
            setParentBusy={setBusy}
            host={status.host || ''}
          />
        )}
        {step === 3 && (
          <section className="mz-panel mz-finish">
            <span className="mz-eyebrow">BIENVENUE CHEZ VOUS</span>
            <h2>À vous le grand écran.</h2>
            <p>
              Ouvrez vos applications depuis la télécommande. Pour retrouver
              Muzcast TV avec le bouton Accueil, choisissez-le dans les
              paramètres des applications par défaut, si votre TV le permet.
            </p>
            <div className="mz-form">
              {products.map((p) => (
                <button
                  disabled={busy}
                  key={p.id}
                  className={p.id === 'launcher' ? 'mz-primary' : ''}
                  onClick={() => void run(() => window.cytv.openMuzcast(p.id))}
                >
                  Ouvrir {p.name} ↗
                </button>
              ))}
            </div>
            <div className="mz-note">
              <b>Une dernière chose</b>
              <p>
                Une fois terminé, vous pouvez désactiver le débogage dans les
                paramètres de la TV. Les mises à jour restent accessibles
                directement dans les apps.
              </p>
            </div>
            <a href="https://tv.muzcast.co" target="_blank" rel="noreferrer">
              Découvrir toutes les fonctionnalités →
            </a>
          </section>
        )}
      </main>
    </div>
  )
}
