import { useRef, useState } from 'react'
import type { ConnStatus, ApplyResult } from '@shared/api'
import { Icon } from './Icon'

export function TvFinishChecks({status,setParentBusy,onNext}:{status:ConnStatus;setParentBusy:(b:boolean)=>void;onNext:()=>void}) {
  const operation = useRef(0)
  const [busy,setBusy]=useState(''),[message,setMessage]=useState(''),[error,setError]=useState('')
  const [sawHome,setSawHome]=useState(false),[closed,setClosed]=useState(false),[confirmRestart,setConfirmRestart]=useState(false),[closedBeforeRestart,setClosedBeforeRestart]=useState(false),[restarted,setRestarted]=useState(false)
  // Keep the address when disabling debugging disconnects the TV.
  const [host]=useState(status.host||'')
  async function run(label:string,fn:()=>Promise<ApplyResult>){const id=++operation.current;setBusy(label);setParentBusy(true);setError('');setMessage('');try{const r=await fn();if(id===operation.current)(r.ok?setMessage:setError)([r.summary,...r.warnings].join(' '))}catch(e){if(id===operation.current)setError(e instanceof Error?e.message:String(e))}finally{if(id===operation.current){setBusy('');setParentBusy(false)}}}
  async function confirmHome(){
    try { await window.cytv.cancelBootCheck() }
    catch { setError('Impossible d’arrêter la vérification. Réessayez dans un instant.'); return }
    ++operation.current
    setBusy('');setParentBusy(false);setError('');setSawHome(true)
    setMessage('Accueil confirmé par vous. Vous pouvez maintenant fermer l’accès de configuration.')
  }
  return <div className="mz-finish-checks">
    <h3>Terminer la configuration</h3>
    {busy&&<p className="mz-note" role="status">{busy}</p>}{message&&<p role="status">{message}</p>}{error&&<p className="mz-error" role="alert">{error}</p>}
    <section className="mz-check-stage"><h3><Icon name="check"/> 1. Vérifier le redémarrage</h3>
      <p>Vérifiez que l’accueil revient après un redémarrage, avant de fermer le débogage.</p>
      {!confirmRestart?<button disabled={!!busy||status.state!=='connected'} onClick={()=>setConfirmRestart(true)}>Tester le redémarrage</button>:<div className="mz-note"><p>La TV va redémarrer. La vérification peut prendre plusieurs minutes et interrompra ce qui est en cours.</p><button disabled={!!busy} onClick={()=>{setConfirmRestart(false);void run('La TV redémarre. L’installateur attend ensuite sa connexion de configuration, qui peut revenir plus tard que l’image.',async()=>{const id=operation.current;const r=await window.cytv.bootCheck();if(r.ok&&id===operation.current)setSawHome(true);return {ok:r.ok,summary:r.ok?'L’accueil fonctionne après redémarrage.':'La vérification automatique n’a pas abouti. Regardez la TV et reconnectez-la si nécessaire.',warnings:r.advice?[r.advice]:[]}})}}>Redémarrer maintenant</button><button disabled={!!busy} onClick={()=>setConfirmRestart(false)}>Annuler</button></div>}
      {busy.startsWith('La TV redémarre')&&<div className="mz-note"><p>L’accueil est déjà affiché sur votre TV ? Vous pouvez le confirmer sans attendre la reconnexion.</p><button onClick={()=>void confirmHome()}>L’accueil est revenu sur ma TV</button></div>}
      <label className="mz-checkbox"><input type="checkbox" checked={sawHome} disabled={!!busy} onChange={e=>setSawHome(e.target.checked)}/>J’ai redémarré la TV et son accueil s’affiche correctement.</label>
    </section>
    <section className="mz-check-stage"><h3><Icon name="shield"/> 2. Fermer l’accès de configuration</h3>
      {!sawHome?<p>Vérifiez d’abord le redémarrage de la TV ci-dessus.</p>:<><ol><li>Sur la TV, ouvrez les Options pour les développeurs.</li><li>Désactivez le débogage USB, réseau et sans fil proposés par votre TV.</li><li>Révoquez les autorisations de débogage si la TV propose cette option.</li><li>Vérifiez ci-dessous, puis redémarrez la TV et vérifiez à nouveau.</li></ol><p>La déconnexion est normale. Les apps Muzcast et leurs mises à jour continuent de fonctionner.</p>
      {closedBeforeRestart&&<label className="mz-checkbox"><input type="checkbox" checked={restarted} disabled={!!busy} onChange={e=>{setRestarted(e.target.checked);setClosed(false)}}/>J’ai redémarré la TV après fermeture du débogage ; elle est allumée et affiche son accueil.</label>}
      <button disabled={!!busy||!host||(closedBeforeRestart&&!restarted)} onClick={()=>void run('Vérification de la fermeture du port…',async()=>{const r=await window.cytv.checkAdbClosed(host);if(closedBeforeRestart&&restarted)setClosed(r.closed);else setClosedBeforeRestart(r.closed);return {ok:r.closed,summary:r.closed?'La TV refuse la connexion de débogage.':'Fermeture non confirmée : assurez-vous que la TV est allumée, puis vérifiez ses réglages.',warnings:[]}})}>{closedBeforeRestart?'Vérifier après redémarrage':'Vérifier la fermeture'}</button>{closed&&<p><Icon name="check"/> Port fermé lors de la dernière vérification.</p>}</>}
    </section>
    <div className="mz-guided-actions"><button className="mz-primary" disabled={!!busy||!sawHome||!closed} onClick={onNext}>Terminer <Icon name="check"/></button><button disabled={!!busy} onClick={onNext}>Terminer sans toutes les vérifications</button></div>
  </div>
}
