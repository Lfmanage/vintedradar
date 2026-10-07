// Fournisseur Vinted — NON CONNECTÉ.
//
// Pourquoi : Vinted ne propose pas d'accès autorisé à la recherche d'annonces pour ce type d'outil.
// Ses conditions d'utilisation interdisent les robots et outils automatisés, et l'API officielle
// (Vinted Pro) est réservée aux entreprises autorisées pour gérer leur propre stock.
// Ce fichier ne contient volontairement AUCUNE méthode de contournement.
//
// Pour le connecter plus tard, il suffira d'implémenter `rechercher()` avec un accès autorisé,
// en renvoyant des annonces au format de `normaliserAnnonce()`. Le reste de l'appli ne change pas.
import { ErreurFournisseur, ETATS_FOURNISSEUR } from './contrat.js';

export const fournisseurVinted = {
  id: 'vinted',
  nom: 'Vinted',
  mode: 'automatique',
  statut() {
    return {
      etat: ETATS_FOURNISSEUR.NON_DISPONIBLE,
      raison: 'Aucun accès autorisé à la recherche d’annonces Vinted n’est disponible.',
      manque: [
        'Un accès officiel accordé par Vinted permettant de lire les résultats de recherche (convention ou clé d’API).',
        'Les conditions d’utilisation de cet accès : fréquence autorisée, données accessibles, durée de conservation.',
      ],
    };
  },
  async rechercher() {
    throw new ErreurFournisseur('non_disponible', 'Surveillance automatique Vinted indisponible : aucun accès autorisé.');
  },
};
