// Configuration Jarvis
// 1. Va sur https://console.cloud.google.com/apis/credentials
// 2. Crée un "ID client OAuth" de type "Application Web"
// 3. Ajoute l'URL où l'app est hébergée dans "Origines JavaScript autorisées"
//    (ex: https://tonpseudo.github.io ou l'URL GitHub Pages du repo)
// 4. Colle l'ID client ci-dessous (se termine par .apps.googleusercontent.com)
export const GOOGLE_CLIENT_ID = '518365172293-3dsiagpc9gtoipi38dqhb7lho9rvlk8v.apps.googleusercontent.com';

// Droits demandés à Google. Lecture/envoi mail + agenda complet.
export const SCOPES = [
  'https://www.googleapis.com/auth/gmail.modify', // lire, marquer lu, archiver
  'https://www.googleapis.com/auth/gmail.send',   // envoyer / répondre
  'https://www.googleapis.com/auth/calendar',     // lire / créer des événements
].join(' ');
