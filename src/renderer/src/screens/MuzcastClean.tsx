import { useEffect, useState } from 'react'
import { protectedApp } from '@shared/cleanup'
import { CleanupAppCard, cleanupAppTitle } from '../components/CleanupAppCard'
import { recommendedProfile } from '@shared/profile-match'
import type { DebloatListSummary, DebloatPlan, Probe, AppMetadata } from '@shared/api'
export function Clean({
  onNext,
  setParentBusy,
  host,
  probe,
}: {
  onNext: () => void
  setParentBusy: (b: boolean) => void
  host: string
  probe?: Probe
}) {
  const [lists, setLists] = useState<DebloatListSummary[]>([]),
    [plan, setPlan] = useState<DebloatPlan | null>(null),
    [chosen, setChosen] = useState<string[]>([]),
    [busy, setBusy] = useState(false),
    [review, setReview] = useState(false),
    [message, setMessage] = useState(''),
    [error, setError] = useState(''),
    [query, setQuery] = useState(''),
    [detecting, setDetecting] = useState(true),
    [automatic, setAutomatic] = useState<DebloatListSummary | undefined>(),
    [manual, setManual] = useState(false),
    [metadata, setMetadata] = useState<Record<string, AppMetadata>>({}),
    [readingApps, setReadingApps] = useState(false),
    [appReadError, setAppReadError] = useState(false),
    [onlySelected, setOnlySelected] = useState(false)
  useEffect(() => {
    let cancelled = false
    setPlan(null)
    setLists([])
    setChosen([])
    setReview(false)
    setMessage('')
    setError('')
    setAutomatic(undefined)
    setManual(false)
    setDetecting(true)
    void (async () => {
      try {
        const available = await window.cytv.lists()
        if (cancelled) return
        setLists(available)
        const selected = recommendedProfile(available)
        if (selected) {
          const detectedPlan = await window.cytv.plan(selected.id)
          if (cancelled) return
          setPlan(detectedPlan)
          setAutomatic(selected)
        }
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : String(e))
      } finally {
        if (!cancelled) setDetecting(false)
      }
    })()
    return () => { cancelled = true }
  }, [host, probe?.model, probe?.device, probe?.product, probe?.release])
  useEffect(() => {
    let cancelled = false
    setMetadata({})
    setAppReadError(false)
    setOnlySelected(false)
    const packages = plan?.entries.filter(entry => entry.state === 'enabled' && !protectedApp(entry.pkg)).map(entry => entry.pkg) || []
    if (!packages.length) { setReadingApps(false); return }
    setReadingApps(true)
    void window.cytv.appMetadata(packages).then(rows => {
      if (!cancelled) {
        setMetadata(Object.fromEntries(rows.map(row => [row.pkg,row])))
        setAppReadError(rows.length === 0)
      }
    }, () => { if (!cancelled) setAppReadError(true) }).finally(() => { if (!cancelled) setReadingApps(false) })
    return () => { cancelled = true }
  }, [plan, host])
  const available = plan?.entries.filter(entry => entry.state === 'enabled' && !protectedApp(entry.pkg)) || []
  const visible = available.filter(entry => (!onlySelected || chosen.includes(entry.pkg)) && (!query || `${cleanupAppTitle(entry.pkg,metadata[entry.pkg])} ${entry.pkg} ${entry.note}`.toLocaleLowerCase().includes(query.toLocaleLowerCase())))
  async function run(fn: () => Promise<void>) {
    setBusy(true)
    setParentBusy(true)
    setError('')
    try {
      await fn()
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(false)
      setParentBusy(false)
    }
  }
  return (
    <>
      <div className="mz-clean-intro">
        <div>
          <span className="mz-badge">UTILE · FACULTATIF</span>
          <h2>
            Moins d’apps inutiles.
            <br />
            Une TV plus sereine.
          </h2>
          <p>
            Certaines TV embarquent des applications promotionnelles ou des
            services que vous n’utilisez pas. Les désactiver peut réduire
            l’encombrement et l’activité en arrière-plan. Le résultat dépend de
            votre téléviseur.
          </p>
        </div>
        <div className="mz-note">
          <b>Désactiver, qu’est-ce que ça veut dire ?</b>
          <p>
            L’application reste sur la TV, mais ne fonctionne plus et disparaît
            généralement de l’accueil. Cela ne libère pas nécessairement
            beaucoup de stockage.
          </p>
          <b>Vous gardez la main</b>
          <p>
            Aucune application n’est cochée. Vous choisissez, puis vous
            confirmez. Vous pourrez rétablir les modifications depuis cet
            ordinateur ou les paramètres de la TV.
          </p>
        </div>
      </div>
      <div className="mz-action">
        <div>
          <strong>Installer Muzcast ne nécessite aucun nettoyage.</strong>
          <p>Vous pouvez le faire maintenant, ou revenir plus tard.</p>
        </div>
        <button disabled={busy} onClick={onNext}>
          Passer cette étape →
        </button>
      </div>
      <section className="mz-panel">
        <h2>Choisir ce que vous souhaitez alléger</h2>
        <p>
          Les profils sont fournis par la communauté CleanYourTV. Ils ne
          garantissent pas la compatibilité de chaque application avec votre
          modèle. En cas de doute, gardez-la activée.
        </p>
        <div className="mz-note" role="status">
          <b>{detecting ? 'Identification du profil…' : manual ? 'Profil choisi manuellement' : automatic ? 'Profil proposé automatiquement' : 'Votre téléviseur est identifié'}</b>
          {probe && <p>{probe.manufacturer} {probe.model} · Android {probe.release}{probe.device ? ` · Plateforme ${probe.device}` : ''}</p>}
          {!detecting && <p>{manual ? 'Vous avez choisi ce profil. Vérifiez les applications proposées avant de confirmer votre sélection.' : automatic
            ? automatic.match === 'model'
              ? 'La référence annoncée par votre TV correspond à ce profil. Vous pouvez en choisir un autre.'
              : `Ce profil correspond à la plateforme ${probe?.device || 'détectée'}, partagée par plusieurs modèles. La référence commerciale exacte n’est pas confirmée.`
            : 'Aucun profil unique ne correspond aux informations annoncées par la TV. Choisissez un profil ci-dessous ou passez cette étape.'}</p>}
          {!detecting && automatic && <p>Aucune application n’est sélectionnée pour être désactivée.</p>}
        </div>
        <label>
          Profil du téléviseur
          <select
            disabled={busy || detecting}
            value={plan?.listId || ''}
            onChange={(e) => {
              const id = e.target.value
              setManual(Boolean(id))
              if (!id) { setPlan(null); setChosen([]); setReview(false); return }
              if (id)
                void run(async () => {
                  setPlan(await window.cytv.plan(id))
                  setChosen([])
                  setReview(false)
                  setMessage('')
                })
            }}
          >
            <option value="">Choisir un profil…</option>
            {lists.map((l) => (
              <option key={l.id} value={l.id}>
                {l.title}
                {l.match === 'model' ? ' · modèle correspondant' : l.match === 'platform' ? ' · plateforme correspondante' : l.score > 0 ? ' · à vérifier' : ''}
              </option>
            ))}
          </select>
        </label>
        {error && (
          <p role="alert" className="mz-error">
            {error}
          </p>
        )}
        {message && (
          <p role="status" className="mz-note">
            {message}
          </p>
        )}
        {plan && (
          <>
            <p className="mz-note">
              L’accueil TV, la diffusion depuis le téléphone, la télécommande,
              la voix et les services système sensibles sont exclus des choix
              proposés.
            </p>
            <div className="mz-apps-toolbar">
              <div><h3>Applications présentes sur votre TV</h3><p>{available.length} applications dans ce profil · {chosen.length} sélectionnées</p></div>
              <label>Rechercher une application
                <input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Nom de l’application…" />
              </label>
            </div>
            <div className="mz-app-filters">
              <button type="button" aria-pressed={!onlySelected} onClick={()=>setOnlySelected(false)}>Toutes ({available.length})</button>
              <button type="button" aria-pressed={onlySelected} onClick={()=>setOnlySelected(true)}>Ma sélection ({chosen.length})</button>
            </div>
            {readingApps && <p className="mz-app-read-status" role="status">Lecture des noms et icônes depuis votre TV…</p>}
            {appReadError && <p className="mz-app-read-status">La TV n’a pas fourni les noms et icônes. Les identifiants restent disponibles dans les détails.</p>}
            <div className="mz-app-grid">
              {visible.map(entry => <CleanupAppCard key={entry.pkg} entry={entry} metadata={metadata[entry.pkg]} selected={chosen.includes(entry.pkg)} disabled={busy} onChange={checked=>{
                setReview(false)
                setChosen(current=>checked?[...current,entry.pkg]:current.filter(pkg=>pkg!==entry.pkg))
              }} />)}
            </div>
            {!visible.length && <p className="mz-app-empty">{onlySelected ? 'Votre sélection est vide. Toutes les applications sont conservées.' : query ? 'Aucune application ne correspond à cette recherche.' : 'Aucune application à alléger dans ce profil sur votre TV.'}</p>}
            <div className="mz-form">
              <button
                className="mz-primary"
                disabled={busy || !chosen.length}
                onClick={() => setReview(true)}
              >
                Vérifier ma sélection ({chosen.length})
              </button>
              <button
                disabled={busy}
                onClick={() =>
                  void run(async () => {
                    const r = await window.cytv.restore(plan.listId)
                    setMessage(
                      [
                        r.ok
                          ? 'Les modifications de ce profil ont été rétablies.'
                          : 'Certaines applications n’ont pas pu être rétablies.',
                        ...r.warnings,
                      ].join(' '),
                    )
                    setPlan(await window.cytv.plan(plan.listId))
                    setChosen([])
                  })
                }
              >
                Rétablir les modifications de ce profil
              </button>
            </div>
            {review && (
              <div
                className="mz-note"
                role="region"
                aria-label="Confirmer le nettoyage"
              >
                <h3>Désactiver ces {chosen.length} applications ?</h3>
                <p>
                  Elles ne pourront plus être utilisées tant que vous ne les
                  réactivez pas. Vérifiez la liste avant de confirmer.
                </p>
                <ul>
                  {chosen.map((p) => (
                    <li key={p}>
                      {cleanupAppTitle(p,metadata[p])} · {p}
                    </li>
                  ))}
                </ul>
                <div className="mz-form">
                  <button disabled={busy} onClick={() => setReview(false)}>
                    Revoir ma sélection
                  </button>
                  <button
                    className="mz-primary"
                    disabled={busy}
                    onClick={() =>
                      void run(async () => {
                        const r = await window.cytv.applyDebloat({
                          listId: plan.listId,
                          disable: chosen,
                          enable: [],
                        })
                        setMessage(
                          [
                            r.ok
                              ? 'Votre sélection a été appliquée. Vous pouvez rétablir ces applications à tout moment.'
                              : 'Certaines modifications n’ont pas pu être appliquées.',
                            ...r.warnings,
                          ].join(' '),
                        )
                        setReview(false)
                        setChosen([])
                        setPlan(await window.cytv.plan(plan.listId))
                      })
                    }
                  >
                    {busy
                      ? 'Modification en cours…'
                      : 'Confirmer la désactivation'}
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </section>
      <button disabled={busy} className="mz-link" onClick={onNext}>
        Terminer la configuration →
      </button>
    </>
  )
}
