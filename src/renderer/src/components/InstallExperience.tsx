import {useEffect,useState} from 'react'
import type {DownloadProgress} from '@shared/api'
import launcher from '../assets/launcher.webp'
import accueil from '../assets/accueil.webp'
import lecteur from '../assets/lecteur.webp'
import lens from '../assets/lens.webp'
import prieres from '../assets/prieres.webp'
import apparence from '../assets/apparence.webp'
import veille from '../assets/veille.webp'
import adhkar from '../assets/adhkar.webp'
import bibliotheque from '../assets/bibliotheque.webp'

const slides = [
  {image:launcher,tag:'VOTRE NOUVEL ACCUEIL',title:'La TV, à votre image.',text:'Retrouvez vos applications préférées, la prochaine prière et vos repères du quotidien sur un accueil personnalisé.'},
  {image:accueil,tag:'À ÉCOUTER ENSEMBLE',title:'Des récits à découvrir.',text:'Parcourez les collections, écoutez les aperçus et retrouvez vos épisodes pour continuer là où vous en étiez.'},
  {image:lecteur,tag:'UNE ÉCOUTE IMMERSIVE',title:'Les mots prennent vie.',text:'Le lecteur plein écran laisse place aux univers des albums. Les transcriptions disponibles suivent la lecture en temps réel.'},
  {image:lens,tag:'MUZCAST AI LENS',title:'Allez plus loin dans le récit.',text:'Sur les épisodes enrichis, découvrez des fiches pour comprendre une notion, situer un personnage ou approfondir un passage.'},
  {image:prieres,tag:'LES PRIÈRES AU QUOTIDIEN',title:'Un repère dans votre journée.',text:'Configurez votre ville et votre méthode de calcul. Choisissez les prières pour lesquelles vous souhaitez entendre l’adhan.'},
  {image:apparence,tag:'VOTRE UNIVERS',title:'Des couleurs qui vous ressemblent.',text:'Personnalisez les couleurs, les rosaces et l’apparence de votre TV. Muzcast propose aussi un thème adapté au moment de la journée.'},
  {image:veille,tag:'MÊME ENTRE DEUX ÉCOUTES',title:'Un écran qui reste beau.',text:'Le mode veille du launcher transforme votre télévision en un affichage apaisant, avec les repères utiles à la maison.'},
  {image:adhkar,tag:'UN MOMENT POUR SE RECENTRER',title:'Les rappels à portée de main.',text:'Retrouvez les adhkar et les repères du calendrier directement depuis l’accueil Muzcast TV.'},
  {image:bibliotheque,tag:'VOTRE BIBLIOTHÈQUE',title:'Gardez le fil de vos écoutes.',text:'Retrouvez vos contenus dans la bibliothèque et reprenez vos épisodes depuis la section dédiée de l’accueil.'},
  {image:launcher,tag:'VOTRE TÉLÉPHONE AUSSI',title:'Une télécommande à portée de main.',text:'Reliez Muzcast TV à votre compte pour retrouver les commandes depuis votre téléphone. Certaines commandes nécessitent des autorisations sur la TV.'},
  {image:launcher,tag:'APRÈS L’INSTALLATION · FACULTATIF',title:'Faites de la place à l’essentiel.',text:'L’étape « Alléger ma TV » vous aide à examiner les applications préinstallées et les options contre les publicités. Vous choisissez les changements, avec des possibilités de restauration.'},
]
const phaseNames: Record<DownloadProgress['phase'],string> = {download:'Téléchargement',extract:'Préparation',transfer:'Transfert vers la TV',verify:'Vérification',install:'Installation Android',done:'Installation terminée',error:'Installation interrompue'}
export function InstallExperience({name,progress,completed,total}:{name:string;progress:DownloadProgress|null;completed:number;total:number}) {
  const [index,setIndex]=useState(0),[paused,setPaused]=useState(()=>window.matchMedia('(prefers-reduced-motion: reduce)').matches)
  const [elapsed,setElapsed]=useState(0),[quiet,setQuiet]=useState(0)
  useEffect(()=>{setElapsed(0);const timer=setInterval(()=>setElapsed(v=>v+1),1000);return()=>clearInterval(timer)},[name])
  useEffect(()=>{setQuiet(0);const timer=setInterval(()=>setQuiet(v=>v+1),1000);return()=>clearInterval(timer)},[name,progress?.phase,progress?.received])
  useEffect(()=>{if(paused)return;const timer=setInterval(()=>setIndex(v=>(v+1)%slides.length),12000);return()=>clearInterval(timer)},[paused,index])
  const slide=slides[index],phase=progress?.phase??'download'
  const measurable=(phase==='download'||phase==='transfer')&&!!progress?.total
  const ratio=measurable?Math.min(1,Math.max(0,progress!.received/progress!.total)):undefined
  const bytes=phase==='download'&&progress?.total?`${(progress.received/1048576).toFixed(1)} / ${(progress.total/1048576).toFixed(1)} Mo`:null
  return <section className="mz-install-experience" aria-label="Installation en cours">
    <div className="mz-install-status">
      <div><span className="mz-eyebrow">APPLICATION {Math.min(completed+1,total)} SUR {total}</span><h2>Installation de {name}</h2><p role="status">{progress?.message||'Recherche de la version officielle…'}</p></div>
      <span className="mz-install-time">{Math.floor(elapsed/60)} min {String(elapsed%60).padStart(2,'0')} s écoulées</span>
      <div className="mz-install-meter"><div><strong>{phaseNames[phase]}</strong><span>{bytes}{ratio!==undefined?` · ${Math.round(ratio*100)} %`:''}</span></div><progress aria-label={phaseNames[phase]} max={1} value={ratio}/></div>
      <p className="mz-install-note">{quiet>=30?'Cette étape prend plus de temps. Gardez la TV allumée et l’ordinateur connecté au même réseau ; toute erreur sera affichée ici.':phase==='transfer'?'Le transfert peut être lent selon la TV et le réseau. Le pourcentage correspond au fichier réellement envoyé.':phase==='install'?'Le fichier est reçu. Android termine maintenant l’installation ; il ne fournit pas de pourcentage pour cette étape.':'Pendant ce temps, découvrez ce qui vous attend sur votre TV.'}</p>
    </div>
    <div className="mz-discovery" aria-roledescription="diaporama" aria-label="Découvrir Muzcast">
      <div className="mz-discovery-image"><img key={slide.image} src={slide.image} alt={`Aperçu : ${slide.title}`} /></div>
      <div className="mz-discovery-copy" key={index}><span className="mz-eyebrow">{slide.tag}</span><h2>{slide.title}</h2><p>{slide.text}</p></div>
      <div className="mz-discovery-controls"><span>{index+1} / {slides.length}</span><div><button type="button" aria-label="Présentation précédente" onClick={()=>{setPaused(true);setIndex(v=>(v+slides.length-1)%slides.length)}}>←</button><button type="button" aria-pressed={paused} onClick={()=>setPaused(v=>!v)}>{paused?'Lecture auto':'Pause'}</button><button type="button" aria-label="Présentation suivante" onClick={()=>{setPaused(true);setIndex(v=>(v+1)%slides.length)}}>→</button></div></div>
    </div>
  </section>
}
