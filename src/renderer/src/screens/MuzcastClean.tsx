import { useEffect, useState, useRef } from 'react'
import { TvOptimization } from '../components/TvOptimization'
import { Icon } from '../components/Icon'
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
  const [stage, setStage] = useState<number | null>(null)
  const [reviewed, setReviewed] = useState<number[]>([])
  const [summaries,setSummaries] = useState<Record<number,string>>({})
  const stageHeading = useRef<HTMLHeadingElement>(null)
  const stages = [
    { title: 'Apps inutiles', description: 'Gardez ce qui vous sert.', icon: 'apps' as const },
    { title: 'Espace et fluidité', description: 'Retrouvez une TV plus agréable.', icon: 'speed' as const },
    { title: 'Publicités et confidentialité', description: 'Choisissez votre niveau de filtrage.', icon: 'shield' as const },
  ]
  useEffect(() => { setStage(null); setReviewed([]); setSummaries({}) }, [host])
  useEffect(() => { stageHeading.current?.focus(); window.scrollTo({top:0,behavior:'instant'}) }, [stage])
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
  const profileDetails = (<details className="mz-advanced" open={!plan ? true : undefined}><summary>{detecting?'Identification de votre TV…':automatic?'Profil détecté · '+(probe?.model||automatic.title):'Choisir le profil de votre TV'}</summary>
        <div role="status">
          <b>{detecting ? 'Identification du profil…' : manual ? 'Profil choisi manuellement' : automatic ? 'Profil proposé automatiquement' : 'Votre téléviseur est identifié'}</b>
          {probe && <p>{probe.manufacturer} {probe.model} · Android {probe.release}{probe.device ? ` · Plateforme ${probe.device}` : ''}</p>}
          {!detecting && <p>{manual ? 'Vous avez choisi ce profil. Vérifiez les applications proposées avant de confirmer votre sélection.' : automatic
            ? automatic.match === 'model'
              ? 'La référence annoncée par votre TV correspond à ce profil. Vous pouvez en choisir un autre.'
              : `Ce profil correspond à la plateforme ${probe?.device || 'détectée'}, partagée par plusieurs modèles. La référence commerciale exacte n’est pas confirmée.`
            : 'Aucun profil unique ne correspond aux informations annoncées par la TV. Choisissez un profil ci-dessous ou passez cette étape.'}</p>}
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
        </details> )
  return (
    <>
      <div hidden={stage===null} className="mz-opt-progress" aria-label="Progression de l’optimisation">
        {stages.map((item,index)=><button key={item.title} disabled={busy} aria-current={stage===index?'step':undefined} aria-label={`Étape ${index+1} : ${item.title}`} onClick={()=>setStage(index)}>
          <Icon name={reviewed.includes(index)?'check':item.icon}/><span>{item.title}</span>
        </button>)}
      </div>
      {stage===null && <section className="mz-panel mz-opt-overview">
        <h2 ref={stageHeading} tabIndex={-1}>{reviewed.length===3?'Votre TV, selon vos choix.':'Optimisons votre TV ensemble.'}</h2>
        <p>{reviewed.length===3?'Les trois étapes ont été examinées. Vous pouvez revoir vos choix.':'Trois étapes guidées. Vous décidez de chaque changement.'}</p>
        <div className="mz-opt-tiles">{stages.map((item,index)=><button key={item.title} disabled={busy} aria-label={`Étape ${index+1} : ${item.title}`} onClick={()=>setStage(index)}>
          <span className="mz-opt-symbol"><Icon name={item.icon}/></span><strong>{item.title}</strong><span>{reviewed.includes(index)?(summaries[index]||'Réglages conservés'):item.description}</span><small>{reviewed.includes(index)?'Choix examinés':'Étape '+(index+1)} <Icon name="right"/></small>
        </button>)}</div>
        <div className="mz-action"><span>{reviewed.length}/3 étapes examinées</span><button className="mz-primary" disabled={busy} onClick={()=>reviewed.length===3?onNext():setStage([0,1,2].find(n=>!reviewed.includes(n))??0)}>{reviewed.length===3?'Continuer sur la TV':'Commencer'+(reviewed.length?' la suite':'')} <Icon name="right"/></button></div>
      </section>}
      {stage!==null && <div className="mz-opt-stage-heading"><button className="mz-link" disabled={busy} onClick={()=>setStage(null)}><Icon name="left"/> Vue d’ensemble</button><span>Étape {stage+1} sur 3</span><h2 ref={stageHeading} tabIndex={-1}>{stages[stage].title}</h2></div>}
      <div hidden={stage!==0}>
      <section className="mz-panel mz-app-selection-panel">

        {!plan && profileDetails}
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
            {!!plan.cameBack?.length && <div className="mz-note"><strong>{plan.cameBack.length} apps désactivées auparavant sont de nouveau actives.</strong><p>Cela peut arriver après une mise à jour de la TV. Retrouvez-les ci-dessous et choisissez à nouveau celles à désactiver.</p><ul>{plan.cameBack.map(pkg=><li key={pkg}>{cleanupAppTitle(pkg,metadata[pkg])}</li>)}</ul></div>}

            <div className="mz-app-controls">
              <div className="mz-app-filters">
                <button type="button" aria-pressed={!onlySelected} onClick={()=>setOnlySelected(false)}>Toutes ({available.length})</button>
                <button type="button" aria-pressed={onlySelected} onClick={()=>setOnlySelected(true)}>Sélection ({chosen.length})</button>
              </div>
              <label className="mz-search-compact"><Icon name="search"/><input aria-label="Rechercher une application" value={query} onChange={e=>setQuery(e.target.value)} placeholder="Rechercher une app" /></label>
            </div>
            <p className="mz-app-guidance">Sélectionnez seulement les apps que vous n’utilisez pas.</p>
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
                        if(r.ok) setSummaries(current=>({...current,0:`${chosen.length} apps désactivées`} ))
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
        <div className="mz-app-secondary">
          <p className="mz-app-read-status"><Icon name="shield"/> Services essentiels protégés · désactivation réversible</p>
        <details className="mz-advanced"><summary>Comment ça marche ?</summary><p>Une app désactivée ne fonctionne plus. Son état initial est enregistré sur cet ordinateur avant modification. Les profils CleanYourTV servent de guide : en cas de doute, gardez l’app activée. Le gain de stockage ou de performances n’est pas garanti.</p></details>
          {plan && profileDetails}
        </div>
      </section>
      </div>
      <div hidden={stage!==1 && stage!==2}><TvOptimization onSummary={(category,summary)=>setSummaries(current=>({...current,[category==='privacy'?2:1]:summary}))} category={stage===2?'privacy':'performance'} host={host} setParentBusy={b=>{setBusy(b);setParentBusy(b)}} /></div>
      {stage!==null && <div className="mz-action mz-opt-next">
        <span>{stage===0&&chosen.length?'Une sélection reste à confirmer.': 'Vos réglages restent inchangés tant que vous ne les modifiez pas.'}</span>
        <button disabled={busy} className="mz-primary" onClick={()=>{if(stage===0&&chosen.length){setReview(true);requestAnimationFrame(()=>document.querySelector('[aria-label="Confirmer le nettoyage"]')?.scrollIntoView({block:'center'}));return}setReviewed(current=>current.includes(stage)?current:[...current,stage]);setStage(stage<2?stage+1:null)}}>
          {stage===0&&chosen.length?`Vérifier ${chosen.length} app${chosen.length>1?'s':''}`:stage===2?'Voir le récapitulatif':'Continuer'} <Icon name="right"/>
        </button>
      </div>}
    </>
  )
}
