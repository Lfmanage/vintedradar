// Compréhension d'une recherche et filtres stricts (ce qui écarte une annonce).
import {
  normaliser, mots, MOTS_VIDES, contient, trouverMarque, trouverClub, trouverCategorie,
  lireSaisons, niveauEtat, libelleEtat, lireTailles, marquesCompatibles, MARQUES, CLUBS,
} from './texte.js';

/**
 * « maillot Real Madrid 2026/2027 » →
 * { categorie: 'Maillot', club: 'Real Madrid', saison: { debut: 2026, libelle: '2026/2027' }, ... }
 * Chaque élément reconnu reste modifiable à la main dans la recherche.
 */
export function analyserRequete(texte) {
  const t = normaliser(texte);
  const marque = trouverMarque(t);
  const club = trouverClub(t);
  const categorie = trouverCategorie(t);
  const { saisons, annees } = lireSaisons(t);
  const saison = saisons.length ? { debut: saisons[0], libelle: saisons[0] + '/' + (saisons[0] + 1) } : null;

  // Mots déjà « expliqués » par la marque, le club, la catégorie ou la saison
  const expliques = new Set();
  const ajouterAlias = (liste, nom) => { for (const [n, alias] of liste) if (n === nom) for (const a of alias) mots(a).forEach((m) => expliques.add(m)); };
  if (marque) ajouterAlias(MARQUES, marque.nom);
  if (club) ajouterAlias(CLUBS, club.nom);
  if (categorie) mots(t).forEach((m) => { if (trouverCategorie(m) === categorie) expliques.add(m); });
  const nombresSaison = new Set();
  if (saison) [saison.debut, saison.debut + 1, saison.debut % 100, (saison.debut + 1) % 100].forEach((n) => nombresSaison.add(String(n)));
  annees.forEach((a) => nombresSaison.add(String(a)));

  const cles = mots(t).filter((m) => !MOTS_VIDES.has(m));
  const modele = cles.filter((m) => !expliques.has(m) && !nombresSaison.has(m) && !nombresSaison.has(String(+m)));
  return {
    texte: String(texte ?? '').trim(),
    cles,
    marque: marque?.nom ?? null,
    club: club?.nom ?? null,
    categorie,
    saison,
    annee: !saison && annees.length ? annees[0] : null,
    modele,
  };
}

/** Recherche avec toutes ses règles, valeurs par défaut comprises. */
export function completerRecherche(r) {
  return {
    id: r.id ?? null,
    nom: r.nom ?? r.motsCles ?? '',
    motsCles: r.motsCles ?? r.nom ?? '',
    prixMin: nombreOuNull(r.prixMin),
    prixMax: nombreOuNull(r.prixMax),
    margeMin: nombreOuNull(r.margeMin),
    tauxMargeMin: nombreOuNull(r.tauxMargeMin),
    etatMin: r.etatMin ?? null,
    tailles: (r.tailles ?? []).map((x) => String(x).toUpperCase()),
    marques: r.marques ?? [],
    obligatoires: r.obligatoires ?? [],
    exclus: r.exclus ?? [],
    prixReventeReference: nombreOuNull(r.prixReventeReference),
    active: r.active !== false,
    notifications: r.notifications !== false,
    requete: r.requete ?? analyserRequete(r.motsCles ?? r.nom ?? ''),
  };
}
function nombreOuNull(v) { if (v === '' || v == null) return null; const n = Number(v); return Number.isFinite(n) ? n : null; }

/**
 * Filtres stricts. Une donnée absente n'écarte jamais une annonce (sauf le prix,
 * indispensable pour juger une opportunité) : elle est signalée dans `notes`.
 */
export function appliquerFiltres(annonce, recherche) {
  const raisons = [], notes = [];
  const texte = normaliser((annonce.titre ?? '') + ' ' + (annonce.description ?? ''));

  if (annonce.prix == null) raisons.push('Prix indisponible');
  else {
    if (recherche.prixMin != null && annonce.prix < recherche.prixMin) raisons.push('Prix sous le minimum (' + recherche.prixMin + ' €)');
    if (recherche.prixMax != null && annonce.prix > recherche.prixMax) raisons.push('Prix au-dessus du maximum (' + recherche.prixMax + ' €)');
  }
  for (const mot of recherche.exclus) if (contient(texte, mot)) raisons.push('Mot exclu : « ' + mot + ' »');
  for (const mot of recherche.obligatoires) if (!contient(texte, mot)) raisons.push('Mot obligatoire absent : « ' + mot + ' »');

  if (recherche.tailles.length) {
    const t = lireTailles(annonce.taille);
    if (!t.size) notes.push('Taille non indiquée');
    else if (!recherche.tailles.some((x) => t.has(x))) raisons.push('Taille ' + annonce.taille + ' non acceptée');
  }
  if (recherche.etatMin != null) {
    const n = niveauEtat(annonce.etat);
    if (n == null) notes.push('État non indiqué');
    else if (n < recherche.etatMin) raisons.push('État inférieur à « ' + libelleEtat(recherche.etatMin) + ' »');
  }
  if (recherche.marques.length) {
    const m = annonce.marque ?? trouverMarque(texte)?.nom ?? null;
    if (!m) notes.push('Marque non indiquée');
    else if (!recherche.marques.some((x) => marquesCompatibles(x, m))) raisons.push('Marque ' + m + ' non recherchée');
  }
  return { garde: raisons.length === 0, raisons, notes };
}
