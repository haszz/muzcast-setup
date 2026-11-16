import { useState, useRef, useEffect } from 'react'

import { Icon } from './Icon'

const steps = [
  { title: 'Votre TV est-elle compatible ?', text: 'Muzcast TV fonctionne sur Android TV et Google TV, ainsi que sur les boîtiers qui utilisent ces systèmes.' },
  { title: 'Allumez votre TV et prenez sa télécommande', text: 'Connectez la TV au même Wi-Fi que cet ordinateur. Un câble réseau connecté à la même box convient aussi. Évitez le réseau invité.' },
  { title: 'Activez les options développeur', text: 'Cette étape permet à votre ordinateur d’installer Muzcast TV. Elle ne réinitialise pas votre téléviseur.' },
  { title: 'Activez le débogage sur votre TV', text: 'Si les deux options sont présentes, essayez d’abord le débogage USB. Sur certaines TV, il permet la connexion par le réseau, même sans câble USB.' },
]
export function TvPreparation({ onReady }: { onReady: (wireless: boolean) => void }) {
  const [step, setStep] = useState(0)
  const [system, setSystem] = useState('')
  const [confirmed, setConfirmed] = useState(false)
  const [wireless, setWireless] = useState(false)
  const [help, setHelp] = useState(false)
  const heading = useRef<HTMLHeadingElement>(null)
  useEffect(() => { heading.current?.focus({preventScroll:true}) }, [step])
  const change = (next: number) => { setStep(next); setConfirmed(false); setHelp(false) }
  return <section className="mz-panel mz-preparation">
    <span className="mz-eyebrow">PRÉPARER MA TV · {step + 1} / {steps.length}</span>
    <ol className="mz-prep-progress" aria-label="Préparation de la TV">{['Compatibilité', 'Réseau', 'Réglages', 'Connexion'].map((name, i) => <li key={name} className={i < step ? 'complete' : i === step ? 'active' : ''} aria-current={i === step ? 'step' : undefined}><span><Icon name={i < step ? 'check' : (['tv', 'wifi', 'settings', 'cable'] as const)[i]} /></span>{name}</li>)}</ol>
    <h2 ref={heading} tabIndex={-1}>{steps[step].title}</h2><p>{steps[step].text}</p>
    <div className="mz-prep-content">{step === 0 ? <fieldset><legend>Quel système est indiqué sur votre TV ou votre boîtier ?</legend>
      {[
        ['android', 'Android TV ou Google TV'],
        ['unknown', 'Je ne sais pas'],
        ['other', 'Samsung Tizen, LG webOS, Apple TV ou autre'],
      ].map(([value, label]) => <label className="mz-guide-choice" key={value}><input type="radio" name="tv-system" value={value} checked={system === value} onChange={() => setSystem(value)} /><span>{label}</span></label>)}
      {system === 'unknown' && <div className="mz-note">Sur la TV, ouvrez Paramètres → Système (ou Préférences relatives à l’appareil) → À propos. Cherchez « Android TV » ou « Google TV ». La marque seule ne suffit pas. Quand vous l’avez trouvé, choisissez la première réponse.</div>}
      {system === 'other' && <div className="mz-note">L’installation directe n’est pas compatible avec ce système. Vous pouvez utiliser un boîtier Android TV ou Google TV branché en HDMI : reprenez alors ce guide pour ce boîtier.</div>}
    </fieldset> : <>
      {step === 1 && <div className="mz-note"><b>Où vérifier le Wi-Fi ?</b><p>Sur la TV : Paramètres → Réseau et Internet. Comparez le nom du réseau avec celui de votre ordinateur.</p></div>}
      {step === 2 && <ol className="mz-guide-list"><li>Sur la TV, ouvrez <b>Paramètres</b> (l’icône en forme de roue dentée).</li><li>Ouvrez <b>Système → À propos</b>, ou <b>Préférences relatives à l’appareil → À propos</b>.</li><li>Sélectionnez <b>Build</b>, <b>Numéro de build</b> ou <b>Build du système d’exploitation Android TV</b>.</li><li>Appuyez <b>7 fois sur OK</b>, jusqu’au message indiquant que vous êtes développeur. Si c’est déjà activé, passez à la suite.</li></ol>}
      {step === 3 && <>
        <p>Sur la TV : <b>Paramètres → Système</b> (ou <b>Préférences relatives à l’appareil</b>) → <b>Options pour les développeurs</b>.</p>
        {!wireless ? <>
          <ol className="mz-guide-list"><li>Activez <b>Débogage USB</b> et confirmez sur la TV.</li><li>Pour ce premier essai, vous n’avez pas besoin d’activer aussi <b>Débogage sans fil</b>.</li><li>Recherchez votre TV depuis cet assistant, puis acceptez <b>Autoriser le débogage USB</b> sur son écran si la demande apparaît.</li></ol>
          <p>Si la TV reste introuvable ou refuse la connexion, nous vous proposerons l’association sans fil par code. Le débogage USB ne donne pas accès au réseau sur tous les modèles.</p>
          <button className="mz-link" onClick={()=>{setWireless(true);setConfirmed(false)}}><Icon name="wifi"/> Je n’ai que le sans-fil, ou l’USB ne fonctionne pas</button>
        </> : <>
          <h3>Passer à l’association sans fil</h3>
          <ol className="mz-guide-list"><li>Activez <b>Débogage sans fil</b> sur votre réseau de confiance.</li><li>Ouvrez <b>Associer un appareil avec un code d’association</b> (le nom peut varier).</li><li>Gardez cet écran ouvert. À l’étape suivante, saisissez le code et les adresses affichées sur la TV.</li></ol>
          <button className="mz-link" onClick={()=>{setWireless(false);setConfirmed(false)}}><Icon name="left"/> Revenir à l’essai avec le débogage USB</button>
        </>}
        <p>Vous pourrez désactiver le débogage à la fin de l’installation.</p>
      </>}
      <label className="mz-guide-choice"><input type="checkbox" checked={confirmed} onChange={e => setConfirmed(e.target.checked)} /><span>{step === 1 ? 'Ma TV est allumée et sur le même réseau' : step === 2 ? 'Les options développeur sont activées' : wireless ? 'Le débogage sans fil est activé et l’écran d’association est ouvert' : 'Le débogage USB est activé sur ma TV'}</span></label>
      <button className="mz-link" onClick={() => setHelp(!help)} aria-expanded={help}><Icon name="help"/> Je ne trouve pas ce réglage</button>
      {help && <div className="mz-note">Les noms des menus varient selon le téléviseur. Consultez la rubrique « À propos » et le guide de votre fabricant. Si le débogage sans fil affiche un code, gardez cet écran ouvert : l’assistant proposera l’association après la recherche. <a href="https://tv.muzcast.co/depannage/" target="_blank" rel="noreferrer">Consulter l’aide détaillée <Icon name="arrow"/></a></div>}
    </>}</div>
    <div className="mz-action mz-prep-action"><span className="mz-prep-reassurance">{step === 3 ? (wireless ? 'Nous allons vous guider pour saisir le code.' : 'La recherche commence à l’étape suivante.') : 'Prenez votre temps, nous vous guidons.'}</span>{step > 0 && <button onClick={() => change(step - 1)}><Icon name="left"/> Précédent</button>}<button className="mz-primary" disabled={step === 0 ? system !== 'android' : !confirmed} onClick={() => step === 3 ? onReady(wireless) : change(step + 1)}>{step === 3 ? (wireless ? 'Associer ma TV par code' : 'Rechercher ma TV') : step === 2 ? 'Activer le débogage' : 'Continuer'} <Icon name={step === 3 ? 'search' : 'right'}/></button></div>
  </section>
}
