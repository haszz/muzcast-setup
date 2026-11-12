import { useEffect, useState } from 'react'
import { protectedApp, appExplanation } from '@shared/cleanup'
import type { DebloatListSummary, DebloatPlan } from '@shared/api'
export function Clean({
  onNext,
  setParentBusy,
  host,
}: {
  onNext: () => void
  setParentBusy: (b: boolean) => void
  host: string
}) {
  const [lists, setLists] = useState<DebloatListSummary[]>([]),
    [plan, setPlan] = useState<DebloatPlan | null>(null),
    [chosen, setChosen] = useState<string[]>([]),
    [busy, setBusy] = useState(false),
    [review, setReview] = useState(false),
    [message, setMessage] = useState(''),
    [error, setError] = useState(''),
    [query, setQuery] = useState('')
  useEffect(() => {
    setPlan(null)
    setChosen([])
    window.cytv.lists().then(setLists, (e) => setError(String(e)))
  }, [host])
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
        <label>
          Profil du téléviseur
          <select
            disabled={busy}
            value={plan?.listId || ''}
            onChange={(e) => {
              const id = e.target.value
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
                {l.score > 0 ? ' · correspondance possible' : ''}
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
            <label>
              Rechercher une application
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Nom ou identifiant…"
              />
            </label>
            <div className="mz-packages">
              {plan.entries
                .filter(
                  (e) =>
                    e.state === 'enabled' &&
                    !protectedApp(e.pkg) &&
                    (!query ||
                      `${e.pkg} ${e.note}`
                        .toLowerCase()
                        .includes(query.toLowerCase())),
                )
                .map((e) => (
                  <label key={e.pkg} className="mz-package">
                    <input
                      type="checkbox"
                      checked={chosen.includes(e.pkg)}
                      disabled={busy}
                      onChange={(ev) => {
                        setReview(false)
                        setChosen((s) =>
                          ev.target.checked
                            ? [...s, e.pkg]
                            : s.filter((p) => p !== e.pkg),
                        )
                      }}
                    />
                    <span>
                      <b>{appExplanation(e.pkg).title}</b>
                      <small>{appExplanation(e.pkg).description}</small>
                      <small>{e.pkg}</small>
                    </span>
                  </label>
                ))}
            </div>
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
                      {appExplanation(p).title} · {p}
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
