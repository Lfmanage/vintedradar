# VintedRadar

Outil personnel de sourcing : il filtre, classe et repère les opportunités de revente parmi des annonces de seconde main.

En ligne : https://lffood.github.io/vintedradar/

## Structure

```
index.html           L'appli (écrans, aperçu). Le moteur sera branché à l'étape « écrans ».
src/
  moteur/            Analyse, indépendante de toute marketplace
    texte.js         Normalisation, marques, clubs, types d'articles, saisons, états, tailles
    recherche.js     Compréhension d'une recherche + filtres stricts
    scores.js        Pertinence, authenticité, estimation de revente, opportunité
    suivi.js         Dédoublonnage, statuts, notifications
    index.js         Chaîne complète : analyserLot()
  fournisseurs/      Sources d'annonces, interchangeables
    contrat.js       Format commun d'une annonce (tout champ inconnu = null)
    vinted.js        NON CONNECTÉ : aucun accès autorisé disponible
    import.js        Annonces fournies par l'utilisateur lui-même
tests/               node --test
```

## Lancer les tests

```
npm test
```

## Principes

- Aucune valeur inventée : prix, dates, liens ou estimations absents restent absents.
- Pertinence et opportunité sont deux scores séparés, chacun avec le détail qui l'explique.
- Le prix de revente est une **estimation** : médiane des prix demandés par des annonces comparables (pas des ventes conclues), ou la référence saisie pour la recherche.
- Une annonce douteuse est signalée « ⚠️ Authenticité à vérifier » et n'est jamais présentée comme une opportunité. L'appli n'affirme jamais qu'un article est authentique.
- Aucun secret dans le code : seules les clés publiques Supabase iront côté navigateur.

## Ce qui manque pour la surveillance automatique Vinted

Un accès autorisé par Vinted permettant de lire les résultats de recherche. Tant qu'il n'existe pas, `src/fournisseurs/vinted.js` refuse de fonctionner plutôt que de contourner les protections du site. Le jour où un tel accès existe, seule la fonction `rechercher()` de ce fichier est à écrire.
