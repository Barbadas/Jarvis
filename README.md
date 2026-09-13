# Jarvis — Assistant personnel

PWA mobile (installable sur téléphone) qui regroupe tes **mails Gmail** et ton **Google Agenda** au même endroit : vue "Aujourd'hui", boîte de réception, agenda à venir, création d'événements.

Pas de serveur : l'app parle directement aux API Google depuis le téléphone, avec ton compte Google.

## 1. Créer l'identifiant OAuth Google (une seule fois)

1. Va sur [Google Cloud Console → Identifiants](https://console.cloud.google.com/apis/credentials) (crée un projet si besoin).
2. **Écran de consentement OAuth** : type "Externe", ajoute-toi comme utilisateur de test.
3. Active les API : **Gmail API** et **Google Calendar API** (menu "API et services → Bibliothèque").
4. **Créer des identifiants → ID client OAuth** :
   - Type : *Application Web*
   - **Origines JavaScript autorisées** : l'URL où l'app sera servie (ex: `https://barbadas.github.io`)
5. Copie le Client ID (`....apps.googleusercontent.com`) dans [`config.js`](./config.js), variable `GOOGLE_CLIENT_ID`.

Tant que l'écran de consentement reste en mode "Test", seuls les comptes Google ajoutés comme testeurs peuvent se connecter (jusqu'à 100 comptes) — largement suffisant pour un usage personnel.

## 2. Héberger l'app

C'est un site 100% statique (HTML/CSS/JS, aucun build). Le plus simple : **GitHub Pages**.

1. Repo → Settings → Pages → Source : `main` / dossier racine.
2. L'app sera servie sur `https://<utilisateur>.github.io/<repo>/`.
3. Ajoute cette URL exacte dans les "Origines JavaScript autorisées" de l'étape 1.

## 3. Installer sur le téléphone

Ouvre l'URL dans Chrome/Safari mobile → menu → **"Ajouter à l'écran d'accueil"**. L'app s'ouvre alors en plein écran comme une app native.

## Fonctionnalités

- **Aujourd'hui** : événements du jour + derniers mails non lus
- **Mail** : boîte de réception, marquer lu, archiver, ouvrir dans Gmail
- **Agenda** : événements à venir (14 jours), création rapide, suppression

## Sécurité

- Aucune donnée ne transite par un serveur tiers : uniquement ton navigateur ↔ Google.
- Le jeton d'accès est gardé en mémoire (`sessionStorage`), effacé à la fermeture de l'onglet.
- Le Client ID dans `config.js` n'est pas un secret (c'est un identifiant public d'application web), il peut être commité sans risque.

## Structure

```
index.html      shell de l'app
style.css       thème mobile (sombre/clair automatique)
config.js       Client ID Google + scopes à configurer
auth.js         connexion Google (OAuth2 / Google Identity Services)
gmail.js        appels Gmail API
calendar.js     appels Google Calendar API
app.js          logique de l'interface
manifest.json   PWA (icône, nom, affichage plein écran)
sw.js           service worker (mise en cache de l'app shell)
```
