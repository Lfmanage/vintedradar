// Scores du moteur. Chaque score est accompagné du détail qui l'explique.
import {
  normaliser, mots, MOTS_VIDES, contient, trouverMarque, trouverClub, trouverCategorie,
  relationCategories, lireSaisons, niveauEtat, lireTailles, marquesCompatibles,
} from './texte.js';

const borne = (x) => Math.max(0, Math.min(1, x));
const arrondi = (x) => Math.round(x * 100) / 100;

/** Ce que l'on sait d'une annonce, lu une seule fois. */
export function lireAnnonce(a) {
  const titre = normaliser(a.titre ?? '');
  const desc = normaliser(a.description ?? '');
  const tout = (titre + ' ' + desc).trim();
  return {
    titre, desc, tout,
    motsTitre: new Set(mots(titre)),
    motsDesc: new Set(mots(desc)),
    marque: a.marque ?? trouverMarque(titre)?.nom ?? null,
    marqueTitre: trouverMarque(titre)?.nom ?? null,
    club: trouverClub(tout)?.nom ?? null,
    categorie: trouverCategorie(titre) ?? trouverCategorie(desc),
    ...lireSaisons(tout),
  };
}

/* ---------- Pertinence ---------- */
/**
 * Score 0–100 : à quel point l'annonce correspond à ce qui est cherché.
 * Seuls les critères présents dans la recherche comptent. Un critère contredit
 * (autre saison, autre club, autre type d'article, autre marque) plafonne le score.
 */
export function pertinence(annonce, recherche, lue = lireAnnonce(annonce)) {
  const q = recherche.requete;
  const details = [];
  let contradiction = false;
  const ajouter = (critere, points, max, texte) => details.push({ critere, points: arrondi(points), max, texte });
  const couverture = (liste) => {
    if (!liste.length) return 1;
    let s = 0;
    for (const m of liste) s += lue.motsTitre.has(m) ? 1 : lue.motsDesc.has(m) ? 0.5 : 0;
    return s / liste.length;
  };

  const cles = q.cles.filter((m) => !MOTS_VIDES.has(m));
  if (cles.length) {
    const c = couverture(cles);
    ajouter('Mots-clés', 25 * c, 25, Math.round(c * 100) + ' % des mots-clés présents');
  }
  if (q.marque) {
    if (lue.marque && marquesCompatibles(q.marque, lue.marque)) ajouter('Marque', 15, 15, 'Marque ' + lue.marque);
    else if (lue.marque) { ajouter('Marque', 0, 15, 'Autre marque : ' + lue.marque); contradiction = true; }
    else ajouter('Marque', 6, 15, 'Marque non indiquée');
  }
  if (q.club) {
    if (lue.club === q.club) ajouter('Club', 15, 15, q.club);
    else if (lue.club) { ajouter('Club', 0, 15, 'Autre club : ' + lue.club); contradiction = true; }
    else ajouter('Club', 4, 15, 'Club non reconnu dans l’annonce');
  }
  if (q.modele.length) {
    const c = couverture(q.modele);
    ajouter('Modèle', 20 * c, 20, c === 1 ? 'Modèle « ' + q.modele.join(' ') + ' » présent' : Math.round(c * 100) + ' % du modèle présent');
  }
  if (q.saison) {
    const d = q.saison.debut;
    if (lue.saisons.includes(d)) ajouter('Saison', 15, 15, 'Saison ' + q.saison.libelle);
    else if (lue.saisons.length) { ajouter('Saison', 0, 15, 'Autre saison : ' + lue.saisons[0] + '/' + (lue.saisons[0] + 1)); contradiction = true; }
    else if (lue.annees.some((y) => y === d || y === d + 1)) ajouter('Saison', 8, 15, 'Année ' + lue.annees.find((y) => y === d || y === d + 1) + ' seulement (saison à confirmer)');
    else if (lue.annees.length) { ajouter('Saison', 0, 15, 'Autre année : ' + lue.annees[0]); contradiction = true; }
    else ajouter('Saison', 4, 15, 'Saison non précisée');
  } else if (q.annee) {
    if (lue.annees.includes(q.annee)) ajouter('Année', 15, 15, 'Année ' + q.annee);
    else if (lue.annees.length) { ajouter('Année', 0, 15, 'Autre année : ' + lue.annees[0]); contradiction = true; }
    else ajouter('Année', 4, 15, 'Année non précisée');
  }
  if (q.categorie) {
    const rel = relationCategories(q.categorie, lue.categorie);
    if (rel === 'identique') ajouter('Type d’article', 10, 10, q.categorie);
    else if (rel === 'proche') ajouter('Type d’article', 5, 10, lue.categorie + ' (proche de ' + q.categorie + ')');
    else if (rel === 'differente') { ajouter('Type d’article', 0, 10, 'Autre type : ' + lue.categorie); contradiction = true; }
    else ajouter('Type d’article', 4, 10, 'Type non reconnu');
  }
  if (recherche.tailles.length) {
    const t = lireTailles(annonce.taille);
    if (!t.size) ajouter('Taille', 2, 5, 'Taille non indiquée');
    else ajouter('Taille', recherche.tailles.some((x) => t.has(x)) ? 5 : 0, 5, 'Taille ' + annonce.taille);
  }
  if (recherche.etatMin != null) {
    const n = niveauEtat(annonce.etat);
    ajouter('État', n == null ? 2 : n >= recherche.etatMin ? 5 : 0, 5, annonce.etat ?? 'État non indiqué');
  }
  const infos = (annonce.images?.length ? 2 : 0) + (annonce.description ? 2 : 0) + (annonce.marque ? 1 : 0);
  ajouter('Informations', infos, 5, [annonce.images?.length ? annonce.images.length + ' photo(s)' : 'sans photo', annonce.description ? 'description' : 'sans description'].join(', '));

  const total = details.reduce((s, d) => s + d.points, 0);
  const max = details.reduce((s, d) => s + d.max, 0);
  let score = max ? Math.round((100 * total) / max) : 0;
  if (contradiction && score > 35) { score = 35; details.push({ critere: 'Contradiction', points: 0, max: 0, texte: 'Un critère recherché est contredit : score plafonné à 35' }); }
  return { score, details };
}

/* ---------- Authenticité ---------- */
// Ne conclut jamais qu'un article est authentique : signale seulement ce qui mérite vérification.
const MOTS_SUSPECTS = ['replique', 'replica', 'copie', 'contrefacon', 'fake', 'aaa', '1:1', 'thai', 'version thai', 'inspire de', 'non officiel'];
export function authenticite(annonce, lue = lireAnnonce(annonce), estimation = null) {
  const raisons = [];
  for (const m of MOTS_SUSPECTS) if (contient(lue.tout, m)) raisons.push('Mention « ' + m + ' » dans l’annonce');
  if (lue.marqueTitre && annonce.marque && !marquesCompatibles(lue.marqueTitre, annonce.marque)) {
    raisons.push('Marque du titre (' + lue.marqueTitre + ') différente de la marque indiquée (' + annonce.marque + ')');
  }
  if (estimation?.prix && annonce.prix != null && annonce.prix < estimation.prix * 0.4) {
    raisons.push('Prix très inférieur aux annonces comparables');
  }
  return { alerte: raisons.length > 0, libelle: raisons.length ? '⚠️ Authenticité à vérifier' : null, raisons };
}

/* ---------- Estimation de revente ---------- */
const mediane = (v) => { const s = [...v].sort((a, b) => a - b), m = s.length >> 1; return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; };
const quartile = (v, q) => { const s = [...v].sort((a, b) => a - b), p = (s.length - 1) * q, b = Math.floor(p); return s[b] + (s[Math.min(b + 1, s.length - 1)] - s[b]) * (p - b); };

/** Signature d'une annonce pour trouver ses comparables. */
// Les tailles, saisons et années sont retirées puis la saison est remise sous une forme unique,
// pour que « 26/27 » et « 2026/2027 » donnent la même signature.
const TAILLES = new Set('xxs xs s m l xl xxl xxxl 2xl 3xl 4xl'.split(' '));
export function signature(annonce, lue = lireAnnonce(annonce)) {
  const retirer = new Set();
  for (const d of lue.saisons) [d, d + 1, d % 100, (d + 1) % 100].forEach((x) => retirer.add(String(x).padStart(2, '0')));
  for (const y of lue.annees) retirer.add(String(y));
  const s = new Set();
  for (const m of lue.motsTitre) {
    if (MOTS_VIDES.has(m) || TAILLES.has(m) || retirer.has(m)) continue;
    if (/^\d{2}$/.test(m) && +m >= 28 && +m <= 50) continue; // pointures / tailles numériques
    s.add(m);
  }
  for (const d of lue.saisons) s.add('saison' + d);
  return s;
}
const jaccard = (A, B) => { let n = 0; for (const x of A) if (B.has(x)) n++; const u = A.size + B.size - n; return u ? n / u : 0; };

/**
 * Prix de revente estimé = médiane des prix DEMANDÉS par les annonces comparables
 * (ce ne sont pas des ventes conclues). Sans assez de comparables : pas d'estimation.
 */
export function estimerRevente(cible, candidats, recherche, options = {}) {
  const minComparables = options.minComparables ?? 4;
  if (recherche.prixReventeReference != null) {
    return { prix: recherche.prixReventeReference, source: 'reference', n: null, confiance: 'reference', texte: 'Ta référence de revente pour cette recherche' };
  }
  const sc = cible.sig ?? signature(cible.annonce, cible.lue);
  const prix = [];
  for (const c of candidats) {
    if (c === cible || c.annonce.prix == null || c.pertinence.score < 60 || c.authenticite?.alerte) continue;
    if (relationCategories(cible.lue.categorie, c.lue.categorie) === 'differente') continue;
    if (jaccard(sc, c.sig ?? signature(c.annonce, c.lue)) < 0.5) continue;
    prix.push(c.annonce.prix);
  }
  if (prix.length < minComparables) {
    return { prix: null, source: 'comparables', n: prix.length, confiance: null, texte: 'Pas assez d’annonces comparables pour estimer (' + prix.length + ' trouvée' + (prix.length > 1 ? 's' : '') + ', ' + minComparables + ' nécessaires)' };
  }
  let base = prix;
  if (prix.length >= 10) { const lo = quartile(prix, 0.1), hi = quartile(prix, 0.9); base = prix.filter((p) => p >= lo && p <= hi); }
  const med = mediane(base);
  const dispersion = med ? (quartile(base, 0.75) - quartile(base, 0.25)) / med : 1;
  const confiance = base.length >= 8 && dispersion <= 0.5 ? 'moyenne' : 'faible';
  return {
    prix: arrondi(med), source: 'comparables', n: prix.length, dispersion: arrondi(dispersion), confiance,
    texte: 'Médiane de ' + prix.length + ' annonces comparables (prix demandés, pas des ventes)',
  };
}

/* ---------- Opportunité ---------- */
export const REGLAGES_DEFAUT = {
  fraisAchatFixe: 0.7,      // protection acheteurs Vinted : part fixe (à vérifier sur vinted.fr)
  fraisAchatPct: 0.05,      // protection acheteurs Vinted : part variable (à vérifier sur vinted.fr)
  portAchat: 0,             // frais de port payés à l'achat (à renseigner)
  commissionRevente: 0,     // 0 pour un particulier ; 0,05 pour un vendeur Vinted Pro
  fraisReventeFixes: 0,     // emballage, etc.
  seuilPertinence: 60,
  seuilNotification: 75,
};

export function coutAchat(prix, r = REGLAGES_DEFAUT) {
  return arrondi(prix + r.fraisAchatFixe + prix * r.fraisAchatPct + r.portAchat);
}

/**
 * Score 0–100 : intérêt pour la revente. Séparé de la pertinence.
 * Sans estimation de revente, pas de score (on n'invente pas de valeur).
 */
export function opportunite(cible, estimation, auth, recherche, reglages = REGLAGES_DEFAUT) {
  const a = cible.annonce;
  if (a.prix == null || !estimation?.prix) {
    return { score: null, qualifie: false, marge: null, taux: null, cout: null, details: [], texte: estimation?.texte ?? 'Prix indisponible' };
  }
  const cout = coutAchat(a.prix, reglages);
  const revenu = estimation.prix * (1 - reglages.commissionRevente) - reglages.fraisReventeFixes;
  const marge = arrondi(revenu - cout);
  const taux = cout > 0 ? arrondi(marge / cout) : null;
  const margeCible = recherche.margeMin ?? 10;
  const details = [];
  const ajouter = (critere, points, max, texte) => details.push({ critere, points: arrondi(points), max, texte });

  ajouter('Marge', 40 * borne(marge / (2 * margeCible)), 40, (marge >= 0 ? '+' : '') + marge + ' € estimés (objectif ' + margeCible + ' €)');
  ajouter('Taux de marge', 20 * borne(taux ?? 0), 20, taux == null ? 'Indisponible' : Math.round(taux * 100) + ' % du coût d’achat');
  const pc = { reference: 12, moyenne: 10, faible: 4 }[estimation.confiance] ?? 0;
  ajouter('Fiabilité de l’estimation', pc, 15, estimation.confiance === 'reference' ? 'Ta référence' : 'Confiance ' + estimation.confiance + ' — ' + estimation.texte);
  ajouter('Pertinence', 15 * (cible.pertinence.score / 100), 15, 'Pertinence ' + cible.pertinence.score + '/100');
  ajouter('Risque', auth.alerte ? 0 : 10, 10, auth.alerte ? 'Authenticité à vérifier' : 'Aucun signal suspect repéré');

  let score = Math.round(details.reduce((s, d) => s + d.points, 0));
  const raisonsNon = [];
  // Un article dont l'authenticité est douteuse n'est jamais présenté comme une opportunité.
  if (auth.alerte) { raisonsNon.push('Authenticité à vérifier'); score = Math.min(score, 40); }
  if (cible.pertinence.score < reglages.seuilPertinence) raisonsNon.push('Pertinence trop faible');
  if (recherche.margeMin != null && marge < recherche.margeMin) raisonsNon.push('Marge sous l’objectif');
  if (recherche.tauxMargeMin != null && (taux ?? -1) < recherche.tauxMargeMin) raisonsNon.push('Taux de marge sous l’objectif');
  if (marge <= 0) raisonsNon.push('Pas de marge estimée');
  return {
    score, qualifie: raisonsNon.length === 0, raisonsNon, marge, taux, cout,
    incertain: estimation.confiance !== 'moyenne' && estimation.confiance !== 'reference',
    details,
  };
}
