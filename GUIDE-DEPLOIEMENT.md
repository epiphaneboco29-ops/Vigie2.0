# Guide : mettre Vigie en ligne, sur ton propre site (100% gratuit, sans carte bancaire)

Ce dossier contient tout le code prêt à déployer. Suis ces étapes dans l'ordre — ça prend environ 15-20 minutes la première fois.

## Étape 1 — Récupérer une clé API gratuite (Google Gemini)

Aucune carte bancaire nécessaire, juste un compte Google (Gmail).

1. Va sur **aistudio.google.com**
2. Connecte-toi avec un compte Google
3. Clique **Get API key → Create API key**
4. Copie la clé générée
5. Garde-la de côté, ne la partage avec personne, ne la mets jamais dans du code visible publiquement

C'est un accès gratuit et permanent (pas un essai limité dans le temps), avec des limites d'usage quotidiennes largement suffisantes pour un usage étudiant.

## Étape 2 — Mettre le code sur GitHub

1. Crée un nouveau dépôt sur GitHub (comme tu as déjà fait avant), nomme-le `vigie`
2. Depuis ton ordinateur (ou en uploadant les fichiers directement sur GitHub) :
   - Télécharge tous les fichiers de ce dossier
   - Mets-les dans ton dépôt `vigie`

## Étape 3 — Déployer sur Vercel (gratuit)

1. Va sur **vercel.com** → connecte-toi avec ton compte GitHub
2. Clique **Add New → Project**
3. Choisis ton dépôt `vigie`
4. Avant de cliquer "Deploy", va dans **Environment Variables** et ajoute :
   - Nom : `GEMINI_API_KEY`
   - Valeur : ta clé copiée à l'étape 1
5. Clique **Deploy**

Après 1-2 minutes, Vercel te donne un lien du genre `vigie-xyz.vercel.app` — c'est ton site, sans aucune mention de Claude ni de Google.

## Étape 4 (optionnel) — Ton propre nom de domaine

Si tu as un nom de domaine (ex: `vigie-epi.com`), dans Vercel : **Settings → Domains** → ajoute-le et suis les instructions DNS.

## Après le déploiement

- Chaque fois que tu modifies le code sur GitHub, Vercel republie automatiquement
- Coût : **0€**, tant que tu restes sous les limites gratuites (largement suffisant pour toi + tes camarades en usage normal)
- Si jamais la limite quotidienne est atteinte un jour très actif, l'app renverra une erreur temporaire — ça se réinitialise le lendemain

## Besoin d'aide en cours de route ?

Reviens me voir avec un screenshot de là où tu bloques, je t'aide à débugger.

