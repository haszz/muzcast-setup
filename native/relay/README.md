# Relais Python intégré à Muzcast

Le moteur est le script `tools/relay.py` de CleanMyTV : `python/upstream_relay.py` est une copie inchangée (SHA-256 `70fd0b0a54a40a5272264d39e8bc0dc48d0c44f02a58ed47e1d4dfb043877f39`). Licence MIT conservée dans `python/LICENSE` et dans le bundle. `session.py` réutilise sa fonction `pipe` dans les deux sens et le même `socket.create_connection(..., timeout=10)`.

L’adaptation ajoute une session privée : port éphémère sur 127.0.0.1, authentification locale par jeton, IPv4 RFC1918 uniquement, arrêt à la fermeture de la connexion, annulation ou disparition de l’installateur. L’adresse originale du téléviseur reste l’identité des réglages et restaurations. Aucun Terminal, service privilégié ni Python installé par le client n’est nécessaire. L’application native affiche le contexte de connexion puis lance le Python embarqué.

Le repli est automatique sur macOS après erreur réseau directe éligible. Il ne remplace pas un refus ADB, une erreur TLS ou une erreur de protocole. Windows conserve la connexion directe.

## Construction

`npm run build:relay` prépare un CPython officiel 3.14.10 universal2 dans `.release-python` (sans installation système), vérifie le SHA-256 du paquet, compile le lanceur Swift universal2 puis embarque Python avec PyInstaller. La licence PSF et les informations de provenance sont incluses dans le bundle. Le même script est utilisé par `dist:mac` et la CI. Aucun Python n’est requis chez l’utilisateur. Le paquet source téléchargé reste intact ; les chemins du framework de construction privé sont relocalisés avant empaquetage.

Le helper et l’application doivent être signés après empaquetage. Le build public reste non notarisé ; ne pas annoncer une signature Developer ID lorsqu’une signature Apple Development ou ad hoc a été utilisée.

## Validation réelle — 13 novembre 2026

La connexion autonome depuis `/Applications/MuzcastSetup.app` a réussi sur la TCL Smart TV G10, Android 12, à 192.168.31.184:5555. L’interface affiche « TV connectée · connexion de secours », puis l’utilisateur a poursuivi la configuration. Le statut de session a confirmé `engine: python`, `connected: true`, sur le port local éphémère 52767. Les processus observés provenaient du bundle installé ; l’ancien relais Terminal 15555 n’était pas utilisé.

L’utilisateur a accepté la demande macOS « MuzcastNetwork », puis la demande ADB sur la TV. L’autorisation est restée entre les mains de l’utilisateur ; aucun changement global de sécurité, privilège administrateur ou Terminal caché n’a été utilisé. Ne jamais annoncer une installation sans aucune autorisation : le consentement réseau macOS et celui du téléviseur restent nécessaires.

La combinaison validée utilise une application native au premier plan, une recherche Bonjour `_adb._tcp` déclarée, le moteur Python embarqué et une attente/reprise réseau pendant la demande. L’ancien moteur quittait trop vite après EHOSTUNREACH. Les doublons de builds avaient aussi été désenregistrés de Launch Services pendant le diagnostic, sans supprimer leurs fichiers. On ne peut pas attribuer le succès à un seul de ces changements isolément.

Tests : 203 tests TypeScript et 2 tests Python réussis. Les tests Python couvrent refus initial puis reprise, transfert TCP bidirectionnel réel, jeton incorrect, adresse publique refusée et fermeture des flux. Le runtime embarqué a aussi été lancé seul pour vérifier son démarrage sans Python système et son arrêt sur annulation. La signature du bundle installé a été vérifiée.

La reconnexion après fermeture complète n’a pas été testée sur la TV : l’utilisateur avait déjà poursuivi sa configuration. Ne pas interrompre ce parcours. Le paquet universal2 compile, mais la connexion réelle a été testée seulement sur le Mac Apple Silicon. Le runtime de distribution CPython 3.14.10 est vérifié sans Python système sur les deux architectures, Intel via Rosetta sur le Mac Apple Silicon. Cela ne remplace pas un essai de connexion sur un Mac Intel physique.
