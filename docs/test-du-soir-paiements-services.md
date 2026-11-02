# Test du Preview — Paiements de services (à l'ordinateur)

Adresse : `https://afric-akani-boutique-git-test-paiements-aka-gest.vercel.app`

**Règles pour tout le test** : données fictives uniquement (faux nom, faux numéro, faux code de transaction).
Aucun vrai paiement. Ne rien faire sur le site de production. Ne jamais écrire un mot de passe dans le chat.

## 0. Avant de commencer
1. Dans Vercel, `ADMIN_PASSWORD` doit exister pour **Preview uniquement** (votre mot de passe de test), ainsi que `ADMIN_SESSION_SECRET`, `PREVIEW_DATABASE_URL`, `RESEND_API_KEY`. Si vous avez changé une variable : **Redeploy** du Preview.
2. Ouvrez `/admin/login` : vous devez voir un bandeau « Prévisualisation » dans l'admin après connexion.

## 1. Connexion
- Mauvais mot de passe → message d'erreur, vous restez sur la page.
- Bon mot de passe → tableau de bord, bandeau « Prévisualisation » visible.

## 2. Créer un dossier (menu **Services → Nouveau**)
1. Client fictif : nom, e-mail **à vous** (les reçus du Preview vous sont envoyés, marqués [TEST], jamais au client), téléphone fictif.
2. Total 100 000 FCFA, acompte 5 000 FCFA, tranches : choisissez 2, 3 ou 4, saisissez les dates et étiquettes.
3. Vérifier : l'acompte est déduit du total ; les tranches se partagent le reste (la dernière absorbe l'arrondi).
4. Le lien privé s'affiche **une seule fois** : copiez-le (c'est lui qui sert au client). Un bouton WhatsApp prépare le message avec le lien. Si vous le perdez : « Créer un nouveau lien » dans le dossier (coche de confirmation obligatoire) ; l'ancien cesse de fonctionner.

## 3. Page privée du client (ouvrez le lien dans une fenêtre privée)
- Pas de menu, pas de pied de page, pas de panier du site : rien d'autre que le dossier.
- Montants, tranches, solde restant corrects ; contrat PDF en lecture seule si un contrat signé existe.
- Envoyer un paiement Mobile Money fictif (numéro + code de transaction). Il passe en « soumis ».
- Renvoyer le même code → refusé (code déjà utilisé).
- Sur mobile (ou fenêtre étroite) : rien ne déborde.

## 4. Côté admin — confirmer / rejeter
- Une notification arrive à votre e-mail ; le badge « Services » du menu compte les paiements à vérifier.
- **Confirmer** le paiement → le solde baisse, le statut de la tranche change.
- Reçu : la case « Envoyer le reçu » est cochée par défaut. Vous recevez un e-mail [TEST] ; vérifier : adresse de réponse `contact@akagest.com`, mention « Conditions de remboursement : celles de votre contrat signé. », phrase sur le lien de suivi WhatsApp, **aucun lien privé** dans le reçu.
- **Rejeter** un second paiement (avec motif) → solde inchangé.
- Paiement enregistré à la main (espèces / autre) → case reçu cochée, reçu envoyé.
- **Ajustements** : ajoutez une réduction puis une correction → les lignes restent visibles, rien ne s'efface ; le total ajusté change.
- Mettre une date de tranche dans le passé non payée → statut « en retard ».

## 5. Boutiques clientes (menu **Boutiques clientes**)
- Ajouter une boutique fictive (domaine fictif).
- Suspendre : le motif est obligatoire, une confirmation est demandée. Réactiver : un clic.
- Le journal garde chaque changement et ne peut pas être modifié.
- « Supprimé » n'est possible qu'après 6 mois de suspension.

## 6. Hors ligne (ordinateur)
- Dans le navigateur : F12 → Réseau → « Hors connexion ». Essayez d'envoyer un paiement ou une action admin : un message clair doit apparaître, rien ne doit être enregistré à moitié. Remettez « En ligne » puis réessayez.
- Un rechargement complet sans réseau échoue sur tout le site (normal : pas de mode hors ligne).

## 7. À me signaler
Toute page blanche, montant faux, message en anglais, texte qui déborde, reçu manquant ou envoyé au mauvais destinataire.

Après le test : suppression des données fictives selon `docs/nettoyage-donnees-de-test.md`.
