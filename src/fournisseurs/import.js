// Fournisseur « import » : les annonces sont fournies par l'utilisateur lui-même
// (par exemple via le favori de capture depuis son navigateur, étape suivante).
import { normaliserLot, ETATS_FOURNISSEUR } from './contrat.js';

export const fournisseurImport = {
  id: 'import',
  nom: 'Import manuel',
  mode: 'manuel',
  statut() { return { etat: ETATS_FOURNISSEUR.MANUEL, raison: 'Les annonces viennent de ce que tu captures toi-même.' }; },
  async rechercher(_criteres, { donnees = [], source = 'vinted' } = {}) {
    const { annonces, rejets } = normaliserLot(donnees, source);
    return { annonces, rejets, curseurSuivant: null, total: annonces.length };
  },
};
