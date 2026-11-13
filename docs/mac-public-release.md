# Distribution Mac sans exception Gatekeeper

Les builds locaux `dist:mac` ne sont pas destinés au public. Une signature Apple Development ne remplace pas Developer ID Application. Ne pas demander aux utilisateurs de supprimer la quarantaine ou de désactiver Gatekeeper.

## Prérequis de publication

- Certificat **Developer ID Application** et sa clé privée dans le trousseau du Mac de publication (création depuis le compte Apple Developer autorisé).
- Identifiants de notarisation enregistrés avec `xcrun notarytool store-credentials` dans le trousseau. Ne jamais ajouter de mot de passe ou de clé privée dans Git, dans la documentation ou dans un message.
- Définir `MUZCAST_DEVELOPER_ID` avec le nom exact du certificat, et `APPLE_KEYCHAIN_PROFILE` avec le nom du profil notarytool. `APPLE_KEYCHAIN` est facultatif pour un trousseau spécifique.

## Construire et vérifier

```sh
npm run release:mac -- --preflight
npm run release:mac
```

La commande refuse l'absence des prérequis avant compilation. Elle construit arm64 et Intel avec le runtime renforcé, demande la notarisation de l'application puis des DMG, agrafe les tickets Apple, monte chaque DMG et vérifie signature, ticket et acceptation Gatekeeper de l'application embarquée. Elle conserve les empreintes et les identifiants de notarisation dans `dist/public-mac-*/verified-mac-release.json`, créé uniquement après réussite complète.

La validation inclut les composants imbriqués : relais Swift et Python embarqué. Un démarrage réussi ne remplace pas les contrôles de notarisation et Gatekeeper. Conserver la distinction entre test Intel sous Rosetta et test sur un Mac Intel physique.

## Publier

Publier uniquement les deux fichiers désignés dans ce rapport, vérifier leurs SHA-256 après téléchargement public, puis mettre à jour le manifeste, le site et les guides agents. Ne déclarer `notarized: true` qu'après ces validations. La commande ne publie rien elle-même.

Avant annonce publique, tester également une copie téléchargée depuis le site, depuis Finder, sur un Mac de test avec les réglages Gatekeeper ordinaires. Tester le lancement, le relais réseau et l'autorisation réseau local. Les autorisations normales de macOS restent nécessaires ; aucune exception de sécurité ne doit être requise pour ouvrir l'installateur.

Référence : https://developer.apple.com/documentation/security/notarizing-macos-software-before-distribution
