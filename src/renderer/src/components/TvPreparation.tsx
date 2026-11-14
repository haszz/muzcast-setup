import { useState, useRef, useEffect } from 'react'

import { Icon } from './Icon'

const steps = [
  { title: 'Votre TV est-elle compatible ?', text: 'Muzcast TV fonctionne sur Android TV et Google TV, ainsi que sur les boîtiers qui utilisent ces systèmes.' },
  { title: 'Allumez votre TV et prenez sa télécommande', text: 'Connectez la TV au même Wi-Fi que cet ordinateur. Un câble réseau connecté à la même box convient aussi. Évitez le réseau invité.' },
  { title: 'Activez les options développeur', text: 'Cette étape permet à votre ordinateur d’installer Muzcast TV. Elle ne réinitialise pas votre téléviseur.' },
  { title: 'Autorisez la connexion de votre ordinateur', text: 'Dans les options développeur, activez « Débogage USB » ou « Débogage sans fil », selon ce que votre TV propose. Même sans câble USB, ce réglage peut être nécessaire.' },
]
export function TvPreparation({ onReady }: { onReady: () => void }) {
  const [step, setStep] = useState(0)
  const [system, setSystem] = useState('')
  const [confirmed, setConfirmed] = useState(false)
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
      {step === 3 && <div className="mz-note"><b>Où trouver ce réglage ?</b><p>Revenez dans Système ou Préférences relatives à l’appareil, puis ouvrez Options pour les développeurs. Acceptez l’avertissement seulement sur votre réseau de confiance.</p><p>Ensuite, nous rechercherons votre TV. Elle pourra vous demander d’autoriser cet ordinateur : vous validerez avec la télécommande. Vous pourrez désactiver le débogage à la fin.</p></div>}
      <label className="mz-guide-choice"><input type="checkbox" checked={confirmed} onChange={e => setConfirmed(e.target.checked)} /><span>{step === 1 ? 'Ma TV est allumée et sur le même réseau' : step === 2 ? 'Les options développeur sont activées' : 'Le débogage est activé sur ma TV'}</span></label>
      <button className="mz-link" onClick={() => setHelp(!help)} aria-expanded={help}><Icon name="help"/> Je ne trouve pas ce réglage</button>
      {help && <div className="mz-note">Les noms des menus varient selon le téléviseur. Consultez la rubrique « À propos » et le guide de votre fabricant. Si le débogage sans fil affiche un code, gardez cet écran ouvert : l’assistant proposera l’association après la recherche. <a href="https://tv.muzcast.co/depannage/" target="_blank" rel="noreferrer">Consulter l’aide détaillée <Icon name="arrow"/></a></div>}
    </>}</div>
    <div className="mz-action mz-prep-action"><span className="mz-prep-reassurance">{step === 3 ? 'La recherche commence à l’étape suivante.' : 'Prenez votre temps, nous vous guidons.'}</span>{step > 0 && <button onClick={() => change(step - 1)}><Icon name="left"/> Précédent</button>}<button className="mz-primary" disabled={step === 0 ? system !== 'android' : !confirmed} onClick={() => step === 3 ? onReady() : change(step + 1)}>{step === 3 ? 'Rechercher ma TV' : 'Continuer'} <Icon name={step === 3 ? 'search' : 'right'}/></button></div>
  </section>
}
