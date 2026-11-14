import { useEffect, useState } from 'react'
import type { ApplyResult, SystemState, TvDiagnostics, DnsCandidate } from '@shared/api'
import { Icon } from './Icon'

export function TvOptimization({ host, setParentBusy, category, onSummary }: {host:string;setParentBusy:(b:boolean)=>void;category:"performance"|"privacy";onSummary:(category:"performance"|"privacy",message:string)=>void}) {
  const [sys,setSys]=useState<SystemState|null>(null)
  const [busy,setBusy]=useState('')
  const [message,setMessage]=useState('')
  const [error,setError]=useState('')
  const [dns,setDns]=useState('')
  const [dnsTests,setDnsTests]=useState<DnsCandidate[]|null>(null)
  const [consent,setConsent]=useState(false)
  const [configureDns,setConfigureDns]=useState(false)
  const [report,setReport]=useState<TvDiagnostics|null>(null)
  const [before,setBefore]=useState<TvDiagnostics|null>(null)
  const refresh=async()=>setSys(await window.cytv.systemState())
  useEffect(()=>{let live=true;setSys(null);setReport(null);setBefore(null);setConsent(false);setDnsTests(null);setDns('');window.cytv.systemState().then(s=>{if(live)setSys(s)},()=>{if(live)setError('Impossible de lire les réglages. Réessayez.')});return()=>{live=false}},[host])
  async function run(label:string,fn:()=>Promise<ApplyResult|void>){
    setBusy(label);setParentBusy(true);setError('');setMessage('')
    try{const r=await fn();if(r){if(r.ok){setMessage([r.summary,...r.warnings].join(' '));onSummary(category,r.summary)}else setError([r.summary,...r.warnings].join(' '))}await refresh()}catch(e){setError(e instanceof Error?e.message:String(e))}finally{setBusy('');setParentBusy(false)}
  }
  return <section className="mz-panel mz-optimization">

    {busy&&<p role="status" className="mz-note">{busy}</p>}
    {error&&<p role="alert" className="mz-error">{error}</p>}
    {message&&<p role="status" className="mz-note">{message}</p>}
    {!sys?<button disabled={!!busy} onClick={()=>void run('Lecture des réglages…',refresh)}>Réessayer la lecture</button>:<>
    <div hidden={category!=="performance"}><div className="mz-tool-grid">
      <article><div className="mz-tool-heading"><Icon name="storage"/>{sys.storage&&sys.storage.freeKb/sys.storage.totalKb<0.15?<span className="mz-recommendation">Conseillé · espace faible</span>:<span className="mz-option-hint">Au besoin</span>}</div><h3>Libérer de l’espace</h3><p>Effacez les fichiers temporaires, sans déconnecter vos comptes.</p>
        {sys.storage&&<meter className="mz-storage-meter" min={0} max={sys.storage.totalKb} value={sys.storage.freeKb} aria-label="Espace libre"/>}
        <p className="mz-storage-value">{sys.storage?`${(sys.storage.freeKb/1048576).toFixed(1)} Go disponibles sur ${(sys.storage.totalKb/1048576).toFixed(1)} Go`:'Espace disponible non communiqué par la TV.'}</p>
        <button disabled={!!busy} onClick={()=>void run('Nettoyage des fichiers temporaires…',async()=>{const r=await window.cytv.clearCaches();const after=await window.cytv.systemState();const gain=sys.storage&&after.storage?Math.max(0,Math.round((after.storage.freeKb-sys.storage.freeKb)/1024)):null;return {...r,summary:r.ok?`Nettoyage terminé${gain===null?'':` · ${gain} Mo récupérés`}. Les caches ne peuvent pas être restaurés.`:'Le nettoyage n’a pas abouti.'}})}>Vider les caches</button>
      </article>
      <article><Icon name="speed"/><h3>Des menus plus rapides</h3><p>Réduisez la durée des animations. Cela ne change pas la puissance de la TV.</p>
        <div className="mz-speed-options">{[[1,'Normales'],[0.5,'Rapides'],[0,'Sans animation']].map(([value,label])=><button key={value} disabled={!!busy} aria-pressed={Number(sys.animationScale==='null'?1:sys.animationScale)===value} onClick={()=>void run('Réglage des animations…',async()=>{const r=await window.cytv.setAnimationScale(Number(value));return {...r,summary:r.ok?'Animations modifiées.':'La TV a refusé le réglage.'}})}><span>{label}</span><span className="mz-speed-meta">{value===0.5&&<span className="mz-recommendation">Conseillé</span>}<span className="mz-choice-radio">{Number(sys.animationScale==='null'?1:sys.animationScale)===value&&<Icon name="check"/>}</span></span></button>)}</div>
      </article>
    </div>
    </div><div hidden={category!=="privacy"}>
    <div className="mz-privacy-choice">
      <span className="mz-badge"><Icon name="shield"/> {sys.privateDnsMode==='hostname'?'DNS personnalisé actif':'Connexion habituelle'}</span>
      <h3>Moins de publicités, à votre choix.</h3>
      <p>Un filtre peut bloquer certains domaines publicitaires et traceurs. Les publicités YouTube restent présentes.</p>
      <div className="mz-tool-grid">
        <button className="mz-choice-tile mz-privacy-featured" disabled={!!busy||sys.sdk<28} aria-pressed={configureDns} aria-expanded={configureDns} aria-controls="mz-dns-explanation" onClick={()=>setConfigureDns(true)}><Icon name="shield"/><strong>Réduire les pubs et traceurs</strong><span>Filtrer certains domaines publicitaires sur la TV.</span><small>Comprendre avant d’activer <Icon name="right"/></small></button>
        <button className="mz-choice-tile" disabled={!!busy} aria-pressed={!configureDns} onClick={()=>{setConfigureDns(false);setConsent(false)}}><Icon name="wifi"/><strong>Garder ma connexion</strong><span>Aucun changement de DNS.</span></button>
      </div>
      {configureDns&&<div id="mz-dns-explanation" className="mz-dns-setup">
      <h4>{dnsTests?'2. Choisir un fournisseur vérifié':'1. Vérifier sans changer la connexion'}</h4>
      <p>Nous testons AdGuard et DNS Forge depuis la TV, sans modifier son DNS. Ces services recevront uniquement les requêtes de test vers Muzcast.</p>
      <button disabled={!!busy||sys.sdk<28} onClick={()=>void run('Test des connexions chiffrées depuis la TV…',async()=>{setDnsTests(null);setDns('');setConsent(false);const results=await window.cytv.testFilteringDns();setDnsTests(results);setDns(results.find(r=>r.ok)?.host||'')})}>{dnsTests?'Relancer les tests':'Tester les DNS filtrants'}</button>
      {dnsTests&&<>
        <div className="mz-dns-results">{dnsTests.map(r=><button key={r.host} className="mz-dns-result" disabled={!!busy||!r.ok} aria-pressed={dns===r.host} onClick={()=>{setDns(r.host);setConsent(false)}}><Icon name={r.ok?'shield':'wifi'}/><span><strong>{r.name}</strong><span>{r.ok?'Disponible sur votre TV':'Indisponible pour le moment'}</span><small>{r.detail}</small></span>{dns===r.host&&<Icon name="check"/>}</button>)}</div>
        {!dnsTests.some(r=>r.ok)?<p role="status">Aucun fournisseur n’a réussi le test. Votre connexion reste inchangée. Réessayez plus tard ou configurez le filtrage sur votre routeur avec son guide ; ne forcez pas un DNS indisponible sur la TV.</p>:<>
          <h4>3. Activer {dnsTests.find(r=>r.host===dns)?.name}</h4>
          <p>Ce fournisseur recevra les requêtes DNS de la TV. Le filtre ne supprime pas toutes les publicités, notamment celles de YouTube.</p>
          <details className="mz-advanced"><summary>Comment la connexion est protégée</summary><p>Un nouveau test précède l’activation. Nous vérifions ensuite l’accès à Muzcast. Si Android refuse le DNS, les réglages précédents sont restaurés. Une protection sur la TV restaure aussi ces réglages si l’installateur se ferme pendant la validation. Une brève interruption reste possible lors de la bascule.</p></details>
          <label className="mz-checkbox"><input type="checkbox" checked={consent} onChange={e=>setConsent(e.target.checked)} disabled={!!busy}/>J’accepte d’utiliser {dnsTests.find(r=>r.host===dns)?.name} pour le DNS de ma TV.</label>
          <button disabled={!!busy||!consent||!dns} onClick={()=>void run('Activation protégée et vérification de Muzcast…',()=>window.cytv.setPrivateDns(dns))}>Activer {dnsTests.find(r=>r.host===dns)?.name}</button>
        </>}
      </>}
      {sys.privateDnsMode==='hostname'&&<button disabled={!!busy} onClick={()=>void run('Retour au DNS automatique…',()=>window.cytv.setPrivateDns(null))}>Revenir au DNS automatique</button>}
      </div>}
      {sys.sdk<28&&<p>Le filtrage DNS nécessite Android 9 ou plus récent.</p>}
      {!configureDns&&sys.privateDnsMode==='hostname'&&<button disabled={!!busy} onClick={()=>void run('Retour au DNS automatique…',()=>window.cytv.setPrivateDns(null))}>Désactiver le DNS personnalisé</button>}
    </div>
    </div><details className="mz-advanced"><summary><Icon name="refresh"/> Restaurer les réglages et l’écran de veille</summary>
      <p>Restaurez les DNS et animations enregistrés avant la première modification sur cet ordinateur. Les caches supprimés ne sont pas récupérables.</p>
      <button disabled={!!busy} onClick={()=>void run('Restauration des réglages…',()=>window.cytv.restoreOptimization())}>Restaurer DNS et animations</button>
      <p>Si l’écran de veille Google a disparu, vous pouvez le réactiver. Cela remplace l’écran de veille actuel.</p>
      <button disabled={!!busy} onClick={()=>void run('Réactivation de l’écran de veille Google…',()=>window.cytv.fixScreensaver())}>Rétablir l’écran de veille Google</button>
    </details>
    <details className="mz-advanced"><summary><Icon name="search"/> Diagnostic de confidentialité et de performances</summary>
      <p>Lecture uniquement : aucune app n’est désactivée. Un nom évocateur ne prouve pas qu’une app vous suit ou utilise le microphone.</p>
      <button disabled={!!busy} onClick={()=>void run('Analyse de la TV…',async()=>{const next=await window.cytv.tvDiagnostics();setReport(next);if(!before)setBefore(next)})}>Analyser la TV</button>
      {report&&<div className="mz-diagnostic"><p>Mesuré à {new Date(report.measuredAt).toLocaleTimeString('fr-FR')} · aller-retour réseau : {report.roundTripMs} ms (ce n’est pas la latence de la télécommande).</p>
        <p>Mémoire disponible : {report.memoryAvailableKb===null?'non disponible':`${Math.round(report.memoryAvailableKb/1024)} Mo`}{before&&before!==report&&before.memoryAvailableKb!==null?` · première mesure : ${Math.round(before.memoryAvailableKb/1024)} Mo`:''}</p>
        <p>Accueil : {report.home||'non identifié'}</p>
        <p>Fluidité cumulée depuis le démarrage de l’app ; les mesures ne sont comparables que dans les mêmes conditions.</p>
        {report.frames.length?<ul>{report.frames.map(s=><li key={s}>{s}</li>)}</ul>:<p>La TV ne fournit pas les statistiques d’images de cet accueil.</p>}
        <h3>Services à examiner</h3>{report.findings.length?<ul>{report.findings.map(f=><li key={f.pkg}><strong>{f.pkg}</strong><p>{f.evidence}</p></li>)}</ul>:<p>Aucun candidat repéré par ces vérifications. Ce résultat n’est pas une garantie d’absence de suivi.</p>}
        {report.warnings.map(w=><p key={w}>{w}</p>)}
        <button onClick={()=>{const url=URL.createObjectURL(new Blob([JSON.stringify({before,after:report},null,2)],{type:'application/json'}));const a=document.createElement('a');a.href=url;a.download='muzcast-diagnostic.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000)}}>Enregistrer le rapport</button>
      </div>}
    </details>
    </>}
  </section>
}
