# Système de Gestion des Seuils

## Contexte
Le système gère deux types de seuils dans le panier :
1. Un seuil pour la livraison gratuite
2. Un seuil pour l'ajout d'un produit cadeau

## Fonctionnement Global

### Configuration des Seuils
Chaque seuil est configuré avec :
- Un type ('delivery' ou 'gift')
- Une valeur de seuil en euros
- Un sélecteur pour l'affichage des messages
- Un format de message personnalisé

### Vérification des Seuils
Le système utilise une méthode commune (`checkThreshold`) qui :
- Récupère automatiquement le total du panier
- Compare avec le seuil défini
- Affiche un message approprié selon le contexte
- Permet des actions supplémentaires selon le type de seuil

### Déclenchement
Les vérifications sont effectuées automatiquement :
- À chaque mise à jour du panier
- Lors de l'initialisation du composant
- Après chaque modification de quantité

## Fonctionnement

### 1. Calcul du Total du Panier
- Le total du panier est récupéré via l'API Shopify Cart (`/cart.js`)
- La méthode `getCartContent()` effectue une requête AJAX pour obtenir les données actualisées du panier

### 2. Logique de Gestion du Cadeau
Le système :
- Vérifie si le seuil est atteint via `checkGiftThreshold()`
- Ajoute ou retire automatiquement le produit cadeau selon le total via `handleGiftBasedOnTotal()`
- Affiche une notification lors de l'ajout du cadeau

### 3. Notifications
- Un système de notification apparaît en bas à droite de l'écran
- Les notifications disparaissent automatiquement après 6 secondes
- L'utilisateur peut fermer manuellement les notifications

## Test en Local

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

## Notes Techniques
- Les requêtes AJAX utilisent l'API Fetch
- Le système utilise un système de publication/abonnement pour les mises à jour du panier
- Les propriétés personnalisées (`_gift: true`) sont utilisées pour identifier le produit cadeau
