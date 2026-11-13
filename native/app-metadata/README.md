# Noms et icônes des applications de la TV

`AppMetadata.java` interroge le PackageManager de la TV via ADB : nom localisé, indicateur système et icône rendue en PNG 64 × 64. Aucun catalogue distant ni inventaire envoyé à un service tiers. Le code ne change aucun état d’application.

L’installateur copie temporairement le DEX fourni dans `/data/local/tmp`, l’exécute avec `app_process` puis supprime ses fichiers dans un `finally`. Les identifiants sont validés avant construction de la commande, les requêtes sont limitées à 500 paquets et exécutées par lots de 24. Les réponses acceptées sont limitées aux paquets demandés, avec des icônes PNG de taille bornée. Si l’accès aux API internes Android est incompatible avec un firmware, les cartes conservent leur texte et un pictogramme de remplacement.

Reconstruction : définir `JAVA_HOME` (JDK 17+) et `ANDROID_HOME`, puis `node scripts/build-app-metadata.mjs`. Le petit fichier `resources/app-metadata.dex` est livré avec les builds Mac et Windows ; les utilisateurs n’ont pas besoin du SDK Android.

Validation réelle : TCL G10 Android 12, noms et PNG récupérés pour Netflix, YouTube et TV. Aucune application installée, désactivée ou supprimée pour ce test ; seul le fichier temporaire de diagnostic a été transféré puis retiré.
