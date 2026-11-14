import { useState } from 'react'
import type { ConnStatus, ApplyResult } from '@shared/api'
import { Icon } from './Icon'

export function TvFinishChecks({status,setParentBusy}:{status:ConnStatus;setParentBusy:(b:boolean)=>void}) {
  const [busy,setBusy]=useState(''),[message,setMessage]=useState(''),[error,setError]=useState('')
  const [sawHome,setSawHome]=useState(false),[closed,setClosed]=useState(false),[confirmRestart,setConfirmRestart]=useState(false)
  // Keep the address when disabling debugging disconnects the TV.
  const [host]=useState(status.host||'')
  async function run(label:string,fn:()=>Promise<ApplyResult>){setBusy(label);setParentBusy(true);setError('');setMessage('');try{const r=await fn();(r.ok?setMessage:setError)([r.summary,...r.warnings].join(' '))}catch(e){setError(e instanceof Error?e.message:String(e))}finally{setBusy('');setParentBusy(false)}}
  return <div className="mz-finish-checks">
    <h3>Terminer la configuration</h3>
    {busy&&<p className="mz-note" role="status">{busy}</p>}{message&&<p role="status">{message}</p>}{error&&<p className="mz-error" role="alert">{error}</p>}
    <details className="mz-advanced"><summary><Icon name="tv"/> Retrouver Muzcast avec le bouton Accueil</summary>
      <p>Définissez Muzcast Launcher comme accueil. L’accueil constructeur reste disponible dans les paramètres.</p>
      <button disabled={!!busy||status.state!=='connected'} onClick={()=>void run('Configuration de l’accueil…',()=>window.cytv.setMuzcastHome())}>Utiliser Muzcast comme accueil</button>
    </details>
    <details className="mz-advanced"><summary><Icon name="check"/> Vérifier le redémarrage</summary>
      <p>Vérifiez que l’accueil revient après un redémarrage, avant de fermer le débogage.</p>
      {!confirmRestart?<button disabled={!!busy||status.state!=='connected'} onClick={()=>setConfirmRestart(true)}>Tester le redémarrage</button>:<div className="mz-note"><p>La TV va redémarrer. La vérification peut prendre plusieurs minutes et interrompra ce qui est en cours.</p><button disabled={!!busy} onClick={()=>{setConfirmRestart(false);void run('Redémarrage et vérification… Cela peut prendre plusieurs minutes.',async()=>{const r=await window.cytv.bootCheck();if(r.ok)setSawHome(true);return {ok:r.ok,summary:r.ok?'L’accueil fonctionne après redémarrage.':'La vérification automatique n’a pas abouti. Regardez la TV et reconnectez-la si nécessaire.',warnings:r.advice?[r.advice]:[]}})}}>Redémarrer maintenant</button><button disabled={!!busy} onClick={()=>setConfirmRestart(false)}>Annuler</button></div>}
      <label className="mz-checkbox"><input type="checkbox" checked={sawHome} disabled={!!busy} onChange={e=>setSawHome(e.target.checked)}/>J’ai redémarré la TV et son accueil s’affiche correctement.</label>
    </details>
    <details className="mz-advanced"><summary><Icon name="shield"/> Fermer l’accès de configuration</summary>
      {!sawHome?<p>Vérifiez d’abord le redémarrage de la TV ci-dessus.</p>:<><ol><li>Sur la TV, ouvrez les Options pour les développeurs.</li><li>Désactivez le débogage USB, réseau et sans fil proposés par votre TV.</li><li>Vérifiez ci-dessous, puis redémarrez la TV et vérifiez à nouveau.</li></ol><p>La déconnexion est normale. Les apps Muzcast et leurs mises à jour continuent de fonctionner.</p>
      <button disabled={!!busy||!host} onClick={()=>void run('Vérification de la fermeture du port…',async()=>{const r=await window.cytv.checkAdbClosed(host);setClosed(r.closed);return {ok:r.closed,summary:r.closed?'La TV refuse la connexion de débogage.':'Fermeture non confirmée : assurez-vous que la TV est allumée, puis vérifiez ses réglages.',warnings:[]}})}>Vérifier la fermeture</button>{closed&&<p><Icon name="check"/> Port fermé lors de la dernière vérification.</p>}</>}
    </details>
  </div>
}
