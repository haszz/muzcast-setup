import { useEffect, useState, useRef } from 'react'
import license from '../../../LICENSE?raw'
import { version } from '../../../package.json'
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
function Icon({name}:{name:'tv'|'download'|'sparkles'|'play'|'wifi'|'check'|'shield'|'help'|'info'|'arrow'}) {
 const paths={help:<><circle cx="12" cy="12" r="9"/><path d="M9.5 9a2.5 2.5 0 0 1 5 0c0 2-2.5 2-2.5 4M12 16.5v.1"/></>,info:<><circle cx="12" cy="12" r="9"/><path d="M12 11v6M12 7v.1"/></>,arrow:<path d="M7 17 17 7M7 7h10v10"/>,tv:<><rect x="3" y="4" width="18" height="13" rx="3"/><path d="M8 21h8M12 17v4"/></>,download:<><path d="M12 3v12m-5-5 5 5 5-5M4 16v4h16v-4"/></>,sparkles:<><path d="m12 3 2.5 6.5L21 12l-6.5 2.5L12 21l-2.5-6.5L3 12l6.5-2.5Z"/></>,play:<path d="m8 5 11 7-11 7Z"/>,wifi:<><path d="M3 8a15 15 0 0 1 18 0M6 12a10 10 0 0 1 12 0m-9 4a5 5 0 0 1 6 0"/><circle cx="12" cy="20" r=".6"/></>,check:<path d="m5 12 4 4L19 6"/>,shield:<><path d="m12 3 8 3v6c0 5-8 9-8 9s-8-4-8-9V6Z"/><path d="m8 12 3 3 5-6"/></>}
 return <svg className="mz-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{paths[name]}</svg>
}
export default function App() {
  const [measurement,setMeasurement]=useState<{enabled:boolean|null;pendingLink:boolean;linked:boolean}|null>(null)
  const [measureOpen,setMeasureOpen]=useState(false),[linkCode,setLinkCode]=useState(''),[measureError,setMeasureError]=useState('')
  useEffect(()=>{if(!window.cytv.telemetryStatus)return;const check=()=>window.cytv.telemetryStatus().then(s=>{setMeasurement(s);if(s.enabled===null||s.pendingLink)setMeasureOpen(true)});void check();const timer=setInterval(check,1500);return()=>clearInterval(timer)},[])
  async function measurementChoice(enabled:boolean){try{setMeasurement(await window.cytv.telemetryPreference(enabled,linkCode));setMeasureOpen(false);setLinkCode('');setMeasureError('')}catch{setMeasureError('Code invalide ou expiré. Recopiez le code du site.')}}
  const about = useRef<HTMLDialogElement>(null)
  const [searchElapsed,setSearchElapsed]=useState(false)
  useEffect(()=>{const timer=setTimeout(()=>setSearchElapsed(true),8000);return()=>clearTimeout(timer)},[])
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
      {measureOpen&&measurement&&<section className="mz-measure" aria-label="Mesure d’usage"><h2>Nous aider à améliorer l’installation ?</h2><p>Avec votre accord : étapes, réussites et erreurs, sans adresse de TV, code d’association, contenu saisi ni enregistrement d’écran.</p>{measurement.pendingLink&&<p><strong>Un parcours du site a été retrouvé.</strong> Accepter le reliera à cet assistant. Refuser permet de continuer sans suivi.</p>}<label>Code du site (facultatif)<input value={linkCode} onChange={e=>setLinkCode(e.target.value)} placeholder="MTV1.…" /></label><p role="status">{measureError}</p><div><button onClick={()=>void measurementChoice(true)}>Accepter{measurement.pendingLink||linkCode?' et relier':''}</button><button onClick={()=>void measurementChoice(false)}>Refuser</button>{measurement.enabled!==null&&!measurement.pendingLink&&<button onClick={()=>setMeasureOpen(false)}>Fermer</button>}</div><a href="https://tv.muzcast.co/confidentialite/" target="_blank" rel="noreferrer">Confidentialité ↗</a></section>}

      <dialog ref={about} className="mz-about" aria-labelledby="about-title">
        <form method="dialog"><button aria-label="Fermer À propos">Fermer ×</button></form>
        <span className="mz-eyebrow">À PROPOS</span>
        <h2 id="about-title">Muzcast à la maison</h2>
        <button onClick={()=>{about.current?.close();setMeasureOpen(true)}}>Mesure d’usage</button><p>Version {version} · Votre univers Muzcast sur grand écran.</p>
        <p>Fondé sur <a href="https://github.com/wingedpanther/cleanmytv" target="_blank" rel="noreferrer">CleanMyTV</a>, sous licence MIT. Les profils communautaires de nettoyage proviennent de CleanYourTV.</p>
        <details><summary>Crédits et licence MIT</summary><pre>{license}</pre></details>
        <p><a href="https://github.com/haszz/muzcast-setup" target="_blank" rel="noreferrer">Code source du projet ↗</a></p>
      </dialog>
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
              <span className="mz-nav-icon"><Icon name={(['tv','download','sparkles','play'] as const)[i]}/></span>
              <div>
                {l}
                {i === 2 && <small>Un vrai plus · facultatif</small>}
              </div>
            </button>
          ))}
        </nav>
        <div className="mz-sidebar-bottom">
          <div className={'mz-sidebar-status' + (connected ? ' is-connected' : '')} role="status">
            <span className="mz-sidebar-status-icon"><Icon name="tv" /></span>
            <div><strong>{connected ? status.probe?.model || 'TV connectée' : 'Votre télévision'}</strong>
              <span><i className={'mz-dot ' + (connected ? 'online' : '')} />{connected ? 'Connectée' : 'En attente de connexion'}</span>
            </div>
          </div>
          <div className="mz-sidebar-actions">
            <a className="mz-sidebar-action mz-help-action" href="https://tv.muzcast.co/installer/" target="_blank" rel="noreferrer">
              <Icon name="help" /><span>Besoin d’aide ?</span><Icon name="arrow" />
            </a>
            <button className="mz-sidebar-action" onClick={()=>setMeasureOpen(true)}>
              <Icon name="shield" /><span>Mesure d’usage<small>{measurement?.enabled === true ? 'Activée · gérer mon choix' : measurement?.enabled === false ? 'Désactivée · gérer mon choix' : 'À votre choix'}</small></span>
            </button>
            <button className="mz-sidebar-action" onClick={() => about.current?.showModal()}>
              <Icon name="info" /><span>À propos</span><small className="mz-sidebar-version">{version}</small>
            </button>
          </div>
        </div>
      </aside>
      <main className="mz-main">
        {demo && (
          <div className="mz-demo">
            Aperçu de l’interface · TV simulée, aucune installation réelle
          </div>
        )}
        <header className="mz-header">
          <div className="mz-header-meta"><span className="mz-eyebrow">BIENVENUE CHEZ VOUS</span><span className="mz-step-count">Étape {step + 1} sur 4</span></div>
          <h1>
            {
              [
                'Installons Muzcast sur votre TV.',
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
          <div className="mz-connection-layout">
            <div className="mz-instructions"><h2>Préparez votre TV</h2><p className="mz-guide-intro">Prenez votre télécommande, on vous guide.</p>
              <div>
                <span className="mz-instruction-number">1</span><b>Le même réseau</b>
                <p>
                  Allumez votre TV et connectez-la au même Wi-Fi ou réseau que
                  cet ordinateur.
                </p>
              </div>
              <div>
                <span className="mz-instruction-number">2</span><b>Autorisez la connexion</b>
                <p>
                  Dans Paramètres → À propos, appuyez 7 fois sur « Build ». Dans
                  Options développeur, activez le débogage USB ou sans fil.
                </p>
              </div>
              <div>
                <span className="mz-instruction-number">3</span><b>Confirmez sur votre TV</b>
                <p>
                  Choisissez votre TV dans la liste, puis « Autoriser » sur son
                  écran.
                </p>
              </div>
            </div>
            <section className="mz-panel mz-connect-panel">
              <div className="mz-discovery-top"><span className="mz-device-icon"><Icon name={connected?'check':'tv'}/></span><span className="mz-detection"><span className={'mz-dot '+(connected?'online':'')}/>{connected?(status.transport === 'relay' ? 'TV connectée · connexion de secours' : 'TV connectée'):'Détection automatique'}</span></div>
              <h2>
                {connected ? 'Votre TV est prête' : 'Connecter votre TV'}
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
                        if (t.adbPort || t.ready) void connect(t.adbPort ? `${t.host}:${t.adbPort}` : t.host)
                        else setPairing(true)
                      }}
                    >
                      <Icon name="tv"/> <strong>{t.name || t.host}</strong>
                      <span>{t.ready ? 'Connecter →' : t.adbPort ? 'Réessayer la connexion →' : 'Associer →'}</span>
                    </button>
                  ))}
                  {!found.length && (
                    <div className="mz-discovery-state" role="status"><span className="mz-search-indicator"/><div><strong>{searchElapsed?'Aucune TV détectée pour le moment':'Recherche de votre téléviseur…'}</strong><p>Gardez votre TV allumée, sur le même réseau. Elle apparaîtra ici dès qu’elle sera détectée.</p></div></div>
                  )}
                  <details>
                    <summary><Icon name="wifi"/> Ma TV n’apparaît pas <span>＋</span></summary>
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
              {busy && <p role="status">{status.transport === 'relay' ? 'Connexion de secours automatique… Si macOS le demande, autorisez Muzcast · Connexion TV.' : 'Connexion en cours…'}</p>}
            </section>
          </div>
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
            probe={status.probe}
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
