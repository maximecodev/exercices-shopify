# Exercices Shopify - Dawn Theme

## Exercices Réalisés

### 1. Gestion des Prix et Promotions
Modification de l'affichage des prix avec gestion des promotions automatiques :
- Affichage du prix barré et prix remisé
- Gestion des promotions via metafields de collection
- Calcul dynamique des remises

#### Configuration des Promotions
- Les promotions sont configurées via les metafields de collection :
  - `collection.metafields.custom.promotions` : Pourcentage de remise
  - `collection.metafields.custom.titre_promotion` : Libellé de la promotion

#### Fonctionnalités
- Affichage automatique du prix barré et du prix remisé
- Calcul dynamique des remises basé sur le pourcentage configuré
- Support du format de devise configuré dans les paramètres du thème
- Affichage conditionnel du badge de promotion
- Gestion des prix variables pour les produits avec variants

#### Logique de Calcul des Remises
Le calcul du prix remisé suit la formule suivante :

1. Conversion du pourcentage en décimal :
   ```
   discount_decimal = pourcentage_remise / 100
   ```
   Par exemple : 30% → 0.30

2. Calcul du multiplicateur :
   ```
   multiplicateur = 1 - discount_decimal
   ```
   Par exemple : 1 - 0.30 = 0.70

3. Application de la remise :
   ```
   prix_remisé = prix_original × multiplicateur
   ```
   Par exemple : 100€ × 0.70 = 70€

Particularités :
- Le calcul est effectué sur le prix brut avant formatage monétaire
- La remise est appliquée uniformément sur tous les produits de la collection
- En cas de produit présent dans plusieurs collections avec des remises différentes, 
  la première remise trouvée est appliquée
- Le système respecte les paramètres de devise du thème pour l'affichage final

### 2. Gestion des Seuils Panier
Le système gère deux types de seuils dans le panier :
1. Un seuil pour la livraison gratuite
2. Un seuil pour l'ajout d'un produit cadeau

#### Configuration des Seuils
Chaque seuil est configuré avec :
- Un type ('delivery' ou 'gift')
- Une valeur de seuil en euros
- Un sélecteur pour l'affichage des messages
- Un format de message personnalisé

#### Vérification des Seuils
Le système utilise une méthode commune (`checkThreshold`) qui :
- Récupère automatiquement le total du panier
- Compare avec le seuil défini
- Affiche un message approprié selon le contexte
- Permet des actions supplémentaires selon le type de seuil

#### Déclenchement
Les vérifications sont effectuées automatiquement :
- À chaque mise à jour du panier
- Lors de l'initialisation du composant
- Après chaque modification de quantité

### 3. Notifications
- Un système de notification apparaît en bas à droite de l'écran
- Les notifications disparaissent automatiquement après 6 secondes
- L'utilisateur peut fermer manuellement les notifications


## Installation et Tests

1. Installation de Shopify CLI
```bash
npm install -g @shopify/cli @shopify/theme
```

2. Connexion à la boutique
```bash
shopify theme dev --store=url-du-site
```

3. Test des fonctionnalités
- Ajoutez des produits au panier jusqu'à dépasser 100€
- Vérifiez l'ajout automatique du produit cadeau
- Réduisez le montant sous 100€ pour vérifier le retrait automatique
- Testez les notifications

## Structure des Fichiers
- `assets/cart.js` : Logique principale de gestion du panier et du cadeau
- `assets/notification.js` : Gestion des notifications
- `snippets/notification.liquid` : Template des notifications
- `snippets/cart-drawer.liquid` : Drawer du panier incluant les notifications
- `snippets/price.liquid` : Gestion de l'affichage des prix et promotions

## Notes Techniques
- Les requêtes AJAX utilisent l'API Fetch
- Le système utilise un système de publication/abonnement pour les mises à jour du panier
- Les propriétés personnalisées (`_gift: true`) sont utilisées pour identifier le produit cadeau
