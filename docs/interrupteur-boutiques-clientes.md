# Interrupteur des boutiques clientes — ce que doit faire chaque boutique

AfricAkani (admin → **Boutiques clientes**) tient l'état de chaque boutique que vous créez pour un client :
`actif`, `en retard`, `suspendu`, `supprimé`. Rien n'est automatique : vous suspendez et réactivez à la main,
avec un motif et un journal. Les données sont gardées 6 mois après une suspension avant qu'on puisse marquer la
boutique « supprimée ».

Chaque boutique cliente **demande** son état à AfricAkani et affiche une page neutre quand elle est suspendue.
Le client ne peut pas le modifier **tant que le code et l'hébergement restent à vous** (voir « Limites »).

## L'adresse de statut

`GET <site AfricAkani>/api/boutiques/<identifiant public>/statut`, affichée dans l'admin (bouton « Afficher
l'adresse et la clé de vérification »). Réponse :

```json
{ "shop": "<identifiant public>", "status": "active | late | suspended | deleted", "ts": 1800000000, "signature": "<64 hex>" }
```

`signature` = HMAC-SHA256, avec la **clé de vérification de cette boutique**, de la chaîne
`v1.<shop>.<status>.<ts>`. La clé est propre à chaque boutique (dérivée d'un secret d'AfricAkani) : elle se met
dans la configuration de la boutique cliente (variable d'environnement, jamais dans le code ni dans un message).

## La règle (déjà écrite et testée : `decideShopOpen` dans `src/lib/shop-status.ts`)

La boutique se ferme **uniquement** si la réponse est bien formée, pour cette boutique, signée avec sa clé, datée
de moins de 10 minutes **et** vaut `suspended` ou `deleted`. Dans tous les autres cas — `active`, `late`, pas de
réponse, erreur, délai dépassé, réponse falsifiée ou périmée — **la boutique reste ouverte**. Si AfricAkani est
injoignable, la boutique reste ouverte.

## Dans le modèle Next.js de la boutique cliente (à faire à sa construction)

- Un `proxy.ts` (ou middleware) qui, pour toutes les pages publiques, appelle l'adresse de statut avec un délai
  de 2 secondes (`AbortSignal.timeout(2000)`), garde la dernière réponse valide en mémoire ~60 s (pour ne pas
  interroger à chaque visite) et applique `decideShopOpen`.
- Fermée : réponse **503** avec `Retry-After`, page neutre « Cette boutique est temporairement indisponible. »
  (aucune mention de paiement, de motif ni d'AkaGest), `noindex`.
- Deux variables d'environnement dans le projet de la boutique cliente : l'adresse de statut et la clé de
  vérification (noms à fixer à ce moment-là ; valeurs saisies par vous dans Vercel, jamais dans le dépôt).

## Variante WordPress

Une petite extension « obligatoire » (dossier `mu-plugins`, que l'administrateur WordPress du client ne peut pas
désactiver depuis l'écran des extensions) qui fait la même demande (`wp_remote_get`, délai 2 s, mémoire ~60 s) et
la même règle.

## Limites

- « Le client ne peut pas le modifier » n'est vrai que si **vous** gardez la main sur le code, l'hébergement ou le
  domaine de la boutique. Un client qui contrôle son propre hébergement peut retirer la vérification : dans ce cas,
  la seule protection solide est de garder le domaine ou l'hébergement sous votre compte.
- La clé dérive de `ADMIN_SESSION_SECRET` : si ce secret change un jour, les clés des boutiques changent aussi ;
  les boutiques cesseraient de reconnaître les réponses (elles resteraient donc ouvertes) jusqu'à ce que vous
  remettiez la nouvelle clé dans leur configuration.
