# Muzcast · À la maison

Assistant Mac et Windows pour installer **Muzcast TV** (l’accueil, `com.gathin.tvhome`) et **Muzcast** (l’écoute, `co.muzcast.tv`) sur une TV Android 8+.

Fork de [CleanMyTV](https://github.com/wingedpanther/cleanmytv), sous licence MIT. Le copyright et la licence d’origine sont conservés dans LICENSE. Les profils communautaires proviennent de CleanYourTV, épinglés dans upstream.json.

## Parcours

1. Connexion sur le réseau local, découverte automatique, saisie d’adresse ou association par code.
2. Les deux applications sont sélectionnées par défaut. Téléchargement des versions officielles, vérification SHA-256, package et version de l’APK, installation puis vérification de la version sur la TV. Une installation partielle est conservée ; réessayer poursuit les apps restantes.
3. **Alléger ma TV** : étape importante mais facultative, sans présélection. Choix explicite, récapitulatif, confirmation et restauration. Les fonctions sensibles sont exclues du parcours simplifié. Aucun nettoyage n’est nécessaire à l’installation.
4. Ouverture des apps et explication du choix de l’accueil et de la fermeture du débogage.

Le launcher n’est pas imposé par désactivation de l’accueil constructeur. Les fichiers APK conservent leurs signatures officielles. Les identifiants R2 ne sont jamais embarqués ; le manifeste fournit une URL temporaire. Les téléchargements sont limités aux hôtes officiels, y compris après redirection. Les APK temporaires sont supprimés après utilisation.

## Développement

Node 22.12+ :

```sh
npm ci
npm run sync
npm run typecheck
npm test
npm run dev
```

Dans un navigateur seul, les données sont simulées et un bandeau le précise. Dans Electron, la connexion et les installations sont réelles.

```sh
npm run dist:mac
npm run dist:win
```

Les builds locaux Mac utilisent une signature ad hoc. Une distribution grand public nécessite la signature Developer ID et la notarisation, ainsi que la signature Windows. Aucun test sur TV physique n’est revendiqué pour cette première version.

## Sources officielles

- Launcher : https://www.muzcast.co/tv/update.json
- App : https://www.muzcast.co/api/tv-updates
- Guide : https://tv.muzcast.co

Les modules upstream avancés sont conservés pour faciliter les mises à jour du fork, mais ne sont pas exposés par l’interface simplifiée. Leurs textes internes de diagnostic restent parfois en anglais.

## Vérification du paquet natif

La version 0.1.1 corrige le crash avant affichage observé sur macOS 27 : noms internes ASCII cohérents pour le bundle, l’exécutable et les helpers Electron, avec nom français conservé dans CFBundleDisplayName. Les crédits sont dans À propos. La DA reprend les couleurs et le splash Corail de l’app Muzcast.

Après compilation : `node scripts/smoke-packaged.mjs "dist/mac-arm64/MuzcastSetup.app/Contents/MacOS/MuzcastSetup"`. Le test ouvre le vrai paquet, contrôle le bridge natif, À propos et la saisie manuelle. Il ne connecte ni ne modifie aucune TV.

## Aperçu

![Installation du pack Muzcast](docs/muzcast/installation.png)

![Nettoyage facultatif expliqué](docs/muzcast/nettoyage.png)

Captures de l’interface avec une TV simulée. La validation réelle du téléchargement des deux APK est disponible via `npx tsx scripts/verify-muzcast-releases.ts` ; elle ne modifie aucune TV.

## Compilation automatisée

`docs/muzcast/build-workflow.yml` contient le workflow adapté à Muzcast (sans recompiler le launcher de CleanMyTV). Le copier vers `.github/workflows/build.yml` avec un accès GitHub autorisé à modifier les workflows avant d’activer Actions. Le workflow upstream n’est pas utilisé pour distribuer cette version.

### Distribution Windows 0.1.1

Paquet NSIS x64 pour Windows 10/11 Intel/AMD : `Muzcast-Setup-0.1.1.exe`. Installation assistée par utilisateur, avec choix du dossier. Non signé Authenticode. Compilé depuis macOS ; structure PE x64 et contenu vérifiés, mais lancement/installation sur PC Windows réel non encore validés. Pas de paquet ARM64 ou 32 bits. Le guide publié explique SmartScreen et le réseau privé sans désactiver les protections.

### Mesure d’usage et liaison au site (0.1.2)

Consentement explicite dans « Mesure d’usage », modifiable ensuite. Identifiants aléatoires, aucun compte ni adresse de TV dans PostHog. Le même identifiant relie site et assistant seulement après confirmation. Windows conserve `$EXEFILE` via NSIS. Mac examine uniquement les noms de DMG Muzcast 0.1.3 dans Téléchargements ; plusieurs identités candidates ou accès refusé annulent la détection. Expiration 30 jours. Secours par protocole `muzcastsetup://link?code=MTV1.UUID.TIMESTAMP` ou code collé. Un lien n’effectue jamais d’installation ni d’action sur la TV.

Événements natifs : ouverture, liaison, début/résultat/durée de connexion, association, installation, nettoyage/restauration et ouverture d’app. `app_installed` est émis seulement après vérification du versionCode via ADB. Aucun suivi sans accord ; la révocation change l’identifiant. Les tests utilisent `is_test=true` et sont exclus du dashboard.

### Détection réseau (0.1.3)

La découverte inclut `_adb._tcp.local`, en plus des annonces Android TV et ADB sans fil. Le port ADB classique annoncé est utilisé, y compris hors 5555. Une annonce détectée ne garantit pas la connexion TCP : une TV inaccessible reste proposée pour réessayer sans demander une association TLS. Le correctif ne contourne pas les autorisations réseau de macOS.
