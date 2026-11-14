import { useEffect, useRef, useState } from 'react'
import type { ApplyResult } from '@shared/api'
import { Icon } from './Icon'

export function TvHandoff({connected,setParentBusy,onNext}:{connected:boolean;setParentBusy:(v:boolean)=>void;onNext:()=>void}) {
  const [busy,setBusy]=useState(false),[message,setMessage]=useState(''),[confirmed,setConfirmed]=useState(false)
  return <section className="mz-panel"><span className="mz-eyebrow">PRENEZ VOTRE TÉLÉCOMMANDE</span><h2>La suite se passe sur votre TV.</h2><p>Le launcher vous guide pour choisir votre thème, relier votre compte et configurer les autorisations, l’accueil, le lieu et l’adhan. Les étapes déjà réalisées sont reconnues par le launcher.</p>
    <div className="mz-guided-actions"><button className="mz-primary" disabled={!connected||busy} onClick={async()=>{setBusy(true);setParentBusy(true);setMessage('');try{await window.cytv.openMuzcast('auto');setMessage('Muzcast a été ouvert sur la TV. Suivez les étapes avec votre télécommande, puis revenez ici.')}catch{setMessage('Ouverture non confirmée. Sur la TV, ouvrez Muzcast Launcher dans Applications, ou Muzcast si vous avez installé uniquement l’app.')}finally{setBusy(false);setParentBusy(false)}}}><Icon name="play"/>{busy?'Ouverture…':'Continuer sur la TV'}</button></div>
    <p role="status">{message}</p><p>Si votre TV est déjà configurée, le launcher ouvre directement votre accueil. Si vous avez choisi uniquement Muzcast app, ouvrez-la pour vérifier qu’elle fonctionne.</p>
    <label className="mz-checkbox"><input type="checkbox" checked={confirmed} disabled={busy} onChange={e=>setConfirmed(e.target.checked)}/>J’ai terminé la configuration sur la TV, ou elle était déjà configurée.</label>
    <div className="mz-guided-actions"><button className="mz-primary" disabled={busy||!confirmed} onClick={onNext}>Passer aux vérifications <Icon name="right"/></button><button disabled={busy} onClick={onNext}>Configurer ma TV plus tard</button></div>
  </section>
}

export function Recovery({connected,onClose,setParentBusy}:{connected:boolean;onClose:()=>void;setParentBusy:(v:boolean)=>void}) {
  const dialog=useRef<HTMLDialogElement>(null)
  const [busy,setBusy]=useState(false),[message,setMessage]=useState(''),[records,setRecords]=useState<{id:string;title:string}[]>([]),[loaded,setLoaded]=useState(false),[selected,setSelected]=useState('')
  useEffect(()=>{dialog.current?.showModal();return()=>dialog.current?.close()},[])
  async function run(fn:()=>Promise<ApplyResult>){setBusy(true);setParentBusy(true);setMessage('');try{const r=await fn();setMessage([r.summary,...r.warnings].join(' '))}catch{setMessage('Restauration non confirmée. Vérifiez la connexion à la TV puis réessayez.')}finally{setBusy(false);setParentBusy(false)}}
  return <dialog ref={dialog} className="mz-about mz-recovery" onCancel={e=>{e.preventDefault();if(!busy)onClose()}}><button disabled={busy} onClick={onClose} aria-label="Fermer la restauration"><Icon name="close"/> Fermer</button><h2>Retrouver vos réglages</h2><p>Choisissez ce que vous souhaitez rétablir. Les applications Muzcast restent installées.</p>
    {!connected&&<p role="status">Connectez votre TV pour accéder aux sauvegardes de cet ordinateur. Si le débogage a été fermé, réactivez-le sur la TV puis revenez à « Connecter ma TV ».</p>}
    <div className="mz-recovery-actions"><button disabled={busy||!connected} onClick={()=>void run(async()=>{const r=await window.cytv.useStockLauncher();return {...r,summary:r.ok?'L’accueil constructeur est rétabli. Muzcast reste installé.':'Restauration automatique indisponible. Choisissez l’accueil constructeur dans les paramètres de la TV.'}})}><Icon name="tv"/> Rétablir l’accueil constructeur</button><button disabled={busy||!connected} onClick={()=>void run(()=>window.cytv.restoreOptimization())}><Icon name="settings"/> Restaurer DNS et animations</button>
    <button disabled={busy||!connected} onClick={async()=>{setBusy(true);setParentBusy(true);try{const saved=await window.cytv.recoveryLists();setRecords(saved);setSelected(saved[0]?.id||'');setLoaded(true)}catch{setMessage('Impossible de lire les sauvegardes. Réessayez.')}finally{setBusy(false);setParentBusy(false)}}}><Icon name="apps"/> Retrouver les applications désactivées</button></div>
    {loaded&&(records.length?<div><label>Sauvegarde du nettoyage<select value={selected} disabled={busy} onChange={e=>setSelected(e.target.value)}>{records.map(r=><option key={r.id} value={r.id}>{r.title}</option>)}</select></label><p>Les applications seront remises dans leur état enregistré avant ce nettoyage.</p><button disabled={busy||!connected||!selected} onClick={()=>void run(()=>window.cytv.restore(selected))}>Restaurer cette sauvegarde</button></div>:<p>Aucune sauvegarde de nettoyage trouvée pour cette TV.</p>)}
    <p role="status">{busy?'Opération en cours…':message}</p><small>Les fichiers temporaires supprimés ne sont pas restaurables. Conservez les sauvegardes sur cet ordinateur.</small>
  </dialog>
}
