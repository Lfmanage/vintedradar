// Chaîne complète : annonces normalisées → filtres → pertinence → estimation → opportunité → classement.
// Fonctionne à l'identique dans le navigateur et dans une fonction serveur.
import { appliquerFiltres, completerRecherche, analyserRequete } from './recherche.js';
import { lireAnnonce, pertinence, authenticite, estimerRevente, opportunite, signature, REGLAGES_DEFAUT } from './scores.js';
import { fusionner, doitNotifier, messageNotification } from './suivi.js';

export { analyserRequete, completerRecherche, REGLAGES_DEFAUT };

/**
 * @param rechercheBrute  recherche enregistrée (mots-clés, prix, tailles, exclusions…)
 * @param annonces        annonces déjà normalisées (voir fournisseurs/contrat.js)
 * @param connues         Map cle → fiche de suivi (annonces déjà vues)
 */
export function analyserLot(rechercheBrute, annonces, connues = new Map(), reglages = {}, maintenant) {
  const r = completerRecherche(rechercheBrute);
  const R = { ...REGLAGES_DEFAUT, ...reglages };

  // 1. Filtres stricts
  const gardees = [], ecartees = [];
  for (const a of annonces) {
    const f = appliquerFiltres(a, r);
    if (f.garde) gardees.push({ annonce: a, filtres: f });
    else ecartees.push({ annonce: a, raisons: f.raisons });
  }

  // 2. Pertinence + premiers signaux d'authenticité
  for (const c of gardees) {
    c.lue = lireAnnonce(c.annonce);
    c.pertinence = pertinence(c.annonce, r, c.lue);
    c.authenticite = authenticite(c.annonce, c.lue);
    c.sig = signature(c.annonce, c.lue);
  }

  // 3. Estimation de revente (sur les comparables du même lot), puis opportunité
  for (const c of gardees) {
    c.estimation = estimerRevente(c, gardees, r);
    c.authenticite = authenticite(c.annonce, c.lue, c.estimation);
    c.opportunite = opportunite(c, c.estimation, c.authenticite, r, R);
  }

  // 4. Classement : opportunité d'abord, puis pertinence
  gardees.sort((x, y) => (y.opportunite.score ?? -1) - (x.opportunite.score ?? -1) || y.pertinence.score - x.pertinence.score);

  // 5. Suivi : nouveautés, déjà vues, notifications
  const { fiches, nouvelles } = fusionner(connues, annonces, r.id, maintenant);
  const nouvellesCles = new Set(nouvelles.map((f) => f.cle));
  const aNotifier = [];
  for (const c of gardees) {
    c.fiche = fiches.get(c.annonce.cle);
    c.nouveau = nouvellesCles.has(c.annonce.cle);
    if (c.nouveau && doitNotifier(c.fiche, c, r, R.seuilNotification)) aNotifier.push(messageNotification(c));
  }

  const resultats = gardees.map(({ lue, sig, ...reste }) => reste);
  return {
    recherche: r,
    resultats,
    ecartees,
    opportunites: resultats.filter((c) => c.opportunite.qualifie),
    fiches,
    aNotifier,
    stats: {
      analysees: annonces.length,
      gardees: gardees.length,
      ecartees: ecartees.length,
      nouvelles: nouvelles.length,
      opportunites: resultats.filter((c) => c.opportunite.qualifie).length,
    },
  };
}
