# Tests de bout en bout (e2e)

Ces scripts pilotent un vrai navigateur (Chromium, via Playwright) sur une **copie locale** de la boutique :

- base de données PostgreSQL **locale et jetable** (`akani_e2e`), recréée à chaque lancement ;
- faux Stripe, PayPal et Resend (un petit serveur local) : **aucun vrai paiement, aucun vrai courriel** ;
- jamais la production, aucune clé réelle (toutes les valeurs sont dans `lib/env.sh` et sont fausses).

## Lancer

```bash
npm ci                       # une fois
e2e/run.sh                   # tout : build + les 3 specs (≈ 10 minutes)
e2e/run.sh legal             # un seul spec (noms des fichiers de specs/, sans .cjs)
e2e/run.sh legal zones       # plusieurs
E2E_SKIP_BUILD=1 e2e/run.sh legal    # réutilise le build .next existant (plus rapide)
```

Le script : crée la base, construit le site (`npm run build`), démarre les faux services et le site (port 4603),
lance les specs, puis arrête tout. Code de sortie 0 = tout passe. Les captures d'écran et les journaux
(`server.log`, `build.log`, appels aux faux paiements) sont écrits dans `$TMPDIR/africakani-e2e`
(`/tmp/africakani-e2e` par défaut ; changer avec `E2E_OUT`).

Pour relancer **un seul fichier** à la main (le site doit déjà tourner, voir `lib/env.sh`) :
`node e2e/specs/legal.cjs`.

## Ce qu'il faut sur la machine

| Besoin | Comment |
|---|---|
| Node 22 et les dépendances du projet | `npm ci` |
| PostgreSQL local | `pg_isready` doit répondre. En `root`, le script utilise l'utilisateur système `postgres` ; sinon `E2E_ADMIN_URL=postgres://postgres@localhost/postgres e2e/run.sh` |
| Playwright + Chromium | `npm i -g playwright && npx playwright install chromium` (ou `PLAYWRIGHT_MODULE=/chemin/vers/playwright`, `CHROMIUM_PATH=/chemin/vers/chrome`) |

Réglages possibles : `E2E_PORT` (4603), `E2E_MOCK_PORT` (4810), `E2E_OUT`, `E2E_DB_URL`.

## Les specs (`specs/`)

| Spec | Ce qu'il vérifie |
|---|---|
| `legal` | 4 pages légales : texte identique au texte validé (`tests/fixtures/pages-legales.md`), titres, liens du pied de page dans les 3 zones, liens près du bouton de paiement, plan du site, 320/375/768/1280 px, contraste, hors ligne, paiements toujours fonctionnels |
| `analytics` | Vercel Web Analytics : adresses nettoyées (rien après « ? »), admin jamais compté, `/_vercel/` hors maintenance, site utilisable sans le script, hors ligne, commande complète |
| `zones` | Visibilité des produits par zone, lien direct « Non disponible dans votre zone », panier au changement de zone, pays de livraison cohérent avec la zone pour WhatsApp / Mobile Money / Stripe / PayPal (commandes falsifiées refusées, aucun appel au fournisseur), 320–1280 px, hors ligne |

`tools/measure.cjs` n'est pas un spec : il mesure le poids du JavaScript et les temps d'affichage
(`node e2e/tools/measure.cjs <nom> [stub]`, le site doit tourner).

## Limites à connaître

- **Script de Vercel Analytics** : le vrai (`/_vercel/insights/script.js`) n'existe que chez Vercel ; `lib/fake-analytics-script.js`
  le remplace en respectant le contrat de `@vercel/analytics`. Le composant et le filtre testés sont les vrais.
- **Plan du site** : il est construit au moment du `build` ; les produits de test ajoutés ensuite par un spec n'y figurent pas.
- **Hors ligne** : le site n'a pas de service worker. Une page déjà chargée continue de naviguer grâce aux pages
  préchargées ; un rechargement complet sans réseau échoue sur tout le site. Les specs comparent donc les nouvelles
  pages au comportement de « Nos services ».
- Les anciens specs de lots précédents (prix, bandeau, accueil, en-tête, services, contrat…) ont été perdus lors
  d'une réinitialisation de l'environnement de travail et ne sont pas dans le dépôt. Les tests unitaires
  (`npm test`) couvrent leurs règles de calcul.
- Les tests unitaires (`npm test`, dossier `tests/`) sont séparés : ils ne lancent ni navigateur ni base.
