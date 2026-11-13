import { useState } from 'react'
import type { AppMetadata, DebloatEntry } from '@shared/api'
import { appExplanation } from '@shared/cleanup'
import { monogram } from '../lib/apps'

const names: Record<string,string> = {
 'com.netflix.ninja':'Netflix', 'com.google.android.youtube.tv':'YouTube',
 'com.amazon.amazonvideo.livingroom':'Prime Video', 'com.disney.disneyplus':'Disney+',
 'com.spotify.tv.android':'Spotify', 'org.videolan.vlc':'VLC',
 'com.apple.atve.androidtv.appletv':'Apple TV', 'com.plexapp.android':'Plex',
 'com.tcl.channel':'TCL Channel'
}
export function cleanupAppTitle(pkg:string, metadata?:AppMetadata):string {
 const known=appExplanation(pkg).title
 return metadata?.label && metadata.label!==pkg ? metadata.label : names[pkg] || (known!==pkg ? known : 'Application à identifier')
}
export function CleanupAppCard({entry,metadata,selected,disabled,onChange}:{entry:DebloatEntry;metadata?:AppMetadata;selected:boolean;disabled:boolean;onChange:(selected:boolean)=>void}) {
 const [failed,setFailed]=useState(false)
 const title=cleanupAppTitle(entry.pkg,metadata)
 const explanation=appExplanation(entry.pkg)
 const media=!!names[entry.pkg]
 const description=media ? `Vous ne pourrez plus ouvrir ${title} tant que cette application sera désactivée.` : explanation.description
 return <article className={`mz-app-card${selected?' is-selected':''}`}>
  <label className="mz-app-card-heading">
   <span className="mz-app-art" aria-hidden="true">{metadata?.icon&&!failed
    ? <img src={metadata.icon} alt="" width="56" height="56" onError={()=>setFailed(true)} />
    : <span>{title==='Application à identifier'?'▦':monogram(title)}</span>}</span>
   <span className="mz-app-name"><b>{title}</b><small>{metadata?.system?'Application système':metadata?'Application installée':'Présente sur votre TV'}</small></span>
   <input type="checkbox" checked={selected} disabled={disabled} aria-label={`Sélectionner ${title} (${entry.pkg})`} onChange={event=>onChange(event.target.checked)} />
  </label>
  <p>{description}</p>
  <details><summary>Détails de l’application</summary><code>{entry.pkg}</code>{entry.note&&<p className="mz-community-note">Note du profil communautaire : {entry.note}</p>}</details>
  <span className="mz-app-selection">{selected?'Sélectionnée pour désactivation':'Conservée sur votre TV'}</span>
 </article>
}
