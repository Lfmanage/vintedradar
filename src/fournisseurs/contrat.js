// Contrat commun à tous les fournisseurs d'annonces (Vinted, import manuel, autre marketplace…).
// Le moteur d'analyse ne connaît QUE ce format : il ne dépend jamais du fonctionnement interne d'un site.

export class ErreurFournisseur extends Error {
  constructor(code, message) { super(message); this.code = code; }
}

export const ETATS_FOURNISSEUR = {
  CONNECTE: 'connecte',            // récupération automatique autorisée et opérationnelle
  MANUEL: 'manuel',                // l'utilisateur fournit lui-même les annonces
  NON_DISPONIBLE: 'non_disponible', // aucune méthode autorisée pour l'instant
};

/**
 * Forme attendue d'un fournisseur :
 * {
 *   id: 'vinted', nom: 'Vinted', mode: 'automatique' | 'manuel',
 *   statut(): { etat, raison, manque? },
 *   rechercher(criteres, { curseur, donnees }): Promise<{ annonces: AnnonceNormalisee[], curseurSuivant: string|null, total: number|null }>
 * }
 * `curseurSuivant` permet de parcourir tous les résultats sans supposer un nombre fixe de pages.
 */

const texte = (v) => (typeof v === 'string' && v.trim() ? v.trim() : null);
const nombre = (v) => { if (v == null || v === '') return null; const n = Number(typeof v === 'string' ? v.replace(',', '.') : v); return Number.isFinite(n) && n >= 0 ? n : null; };
const urlHttps = (v) => (typeof v === 'string' && /^https:\/\/[^\s]+$/.test(v) ? v : null);
const date = (v) => { if (!v) return null; const d = new Date(v); return isNaN(d) ? null : d.toISOString(); };

/**
 * Annonce normalisée. Tout champ inconnu vaut null : on n'invente jamais une valeur.
 * Une annonce sans identifiant ou sans URL exacte est refusée (pas de lien approximatif).
 */
export function normaliserAnnonce(brute, source) {
  const id = brute?.id != null && String(brute.id).trim() ? String(brute.id).trim() : null;
  const url = urlHttps(brute?.url);
  if (!id) throw new ErreurFournisseur('annonce_invalide', 'Annonce sans identifiant : ignorée.');
  if (!url) throw new ErreurFournisseur('annonce_invalide', 'Annonce ' + id + ' sans URL exacte : ignorée.');
  return {
    source, id, cle: source + ':' + id, url,
    titre: texte(brute.titre),
    prix: nombre(brute.prix),
    devise: texte(brute.devise),
    marque: texte(brute.marque),
    taille: texte(brute.taille),
    etat: texte(brute.etat),
    description: texte(brute.description),
    images: Array.isArray(brute.images) ? brute.images.map(urlHttps).filter(Boolean) : [],
    vendeur: texte(brute.vendeur),
    datePublication: date(brute.datePublication),
  };
}

/** Normalise un lot : les annonces invalides sont écartées et comptées, jamais corrigées. */
export function normaliserLot(brutes, source) {
  const annonces = [], rejets = [];
  const vues = new Set();
  for (const b of brutes) {
    try {
      const a = normaliserAnnonce(b, source);
      if (vues.has(a.cle)) continue; // doublon dans le même lot
      vues.add(a.cle);
      annonces.push(a);
    } catch (e) { rejets.push(e.message); }
  }
  return { annonces, rejets };
}
