# Effacer les données de test (Services et boutiques clientes)

Par conception, l'administration **n'efface rien** : un dossier de paiement, un paiement, un ajustement, une boutique
cliente et leurs journaux ne se suppriment pas depuis le site (la base de données elle-même refuse). C'est voulu pour
les vrais clients ; cela veut dire que le nettoyage des essais se fait **à la main, dans la base de PRÉVISUALISATION
seulement**.

## Sur la prévisualisation (Preview)

La prévisualisation utilise une base **séparée** de la vraie (variable `PREVIEW_DATABASE_URL` : le code refuse de se
connecter à la base de production). Les essais n'y touchent donc jamais vos vraies données.

Pour repartir de zéro, dans l'éditeur SQL de la base de prévisualisation (Neon → la base de prévisualisation → SQL
Editor) — **vérifiez d'abord que c'est la bonne base** : `SELECT current_database();` ne doit PAS être celle de la
production :

```sql
DROP TABLE IF EXISTS client_shop_events, client_shops, service_events, service_adjustments,
  service_payments, service_installments, service_accounts CASCADE;
DELETE FROM signed_contracts WHERE company_name LIKE '%(TEST)%' OR client_name LIKE '%(TEST)%';
```

Les tables se recréent vides, toutes seules, au prochain affichage d'une page d'administration. Les contrats de test
se suppriment aussi depuis « Contrats signés » (bouton de suppression existant).

## En production

N'y créez **aucun** dossier de test : une fois créé, il ne se supprime pas depuis l'administration. Si cela arrive, le
nettoyage demande de désactiver temporairement les garde-fous de la base (opération à préparer ensemble, avec votre
accord, après une sauvegarde).
