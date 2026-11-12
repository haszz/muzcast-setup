/** Conservative choices for the beginner flow; unknown apps remain an explicit decision. */
export function protectedApp(pkg: string): boolean {
  return /launcher|tvhome|setup|systemui|permission|packageinstaller|providers|settings|inputmethod|bluetooth|cast|remote|voice|assistant|accessibility|\.tts$|airplay|co\.muzcast/.test(
    pkg,
  )
}
export function appExplanation(pkg: string): {
  title: string
  description: string
} {
  if (/promo|advert|sponsor/.test(pkg))
    return {
      title: 'Recommandations promotionnelles',
      description:
        'Peut retirer des suggestions commerciales de l’accueil constructeur.',
    }
  if (/analytics|telemetry/.test(pkg))
    return {
      title: 'Statistiques d’utilisation',
      description:
        'Service qui recueille des informations sur l’utilisation de la TV. Certaines fonctions de diagnostic peuvent en dépendre.',
    }
  if (/discovery|discover/.test(pkg))
    return {
      title: 'Suggestions de contenus',
      description:
        'Peut masquer une rubrique de découverte proposée par le fabricant.',
    }
  if (/smarthelp|\.help/.test(pkg))
    return {
      title: 'Aide du fabricant',
      description:
        'Le guide d’aide intégré ne sera plus accessible tant que cette application est désactivée.',
    }
  if (/dream|screensaver/.test(pkg))
    return {
      title: 'Économiseur d’écran',
      description:
        'L’écran de veille fourni par cette application ne fonctionnera plus. Gardez-le si vous l’utilisez.',
    }
  if (/album|gallery/.test(pkg))
    return {
      title: 'Galerie de photos',
      description:
        'La galerie intégrée ne sera plus disponible. Cela ne supprime pas vos photos.',
    }
  return {
    title: pkg,
    description:
      'Application préinstallée. Si vous ne reconnaissez pas son rôle, laissez-la activée.',
  }
}
