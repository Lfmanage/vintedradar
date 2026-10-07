// Suivi des annonces dans le temps : dédoublonnage, statuts, décision de notification.

export const STATUTS = ['nouveau', 'vu', 'interessant', 'favori', 'achete', 'ignore', 'disparu'];
export const LIBELLES_STATUT = {
  nouveau: 'Nouveau', vu: 'Vu', interessant: 'Intéressant', favori: 'Favori', achete: 'Acheté', ignore: 'Ignoré', disparu: 'Disparu',
};

/**
 * Fusionne un lot d'annonces avec ce qui est déjà connu.
 * `connues` : Map cle → fiche de suivi. Retourne les fiches mises à jour et la liste des vraies nouveautés.
 * Une annonce déjà vue n'est jamais re-signalée comme nouvelle, même si elle revient plus tard.
 */
export function fusionner(connues, annonces, rechercheId, maintenant = new Date().toISOString()) {
  const fiches = new Map(connues);
  const nouvelles = [], revues = [];
  for (const a of annonces) {
    const ancienne = fiches.get(a.cle);
    if (!ancienne) {
      const fiche = {
        cle: a.cle, premiereDetection: maintenant, derniereDetection: maintenant,
        recherches: [rechercheId], statut: 'nouveau', prixInitial: a.prix, prix: a.prix, notifieLe: null,
      };
      fiches.set(a.cle, fiche);
      nouvelles.push(fiche);
    } else {
      const fiche = { ...ancienne, derniereDetection: maintenant, prix: a.prix ?? ancienne.prix };
      if (!fiche.recherches.includes(rechercheId)) fiche.recherches = [...fiche.recherches, rechercheId];
      if (ancienne.statut === 'disparu') fiche.statut = 'vu';
      if (a.prix != null && ancienne.prix != null && a.prix < ancienne.prix) fiche.baissePrix = { de: ancienne.prix, a: a.prix, le: maintenant };
      fiches.set(a.cle, fiche);
      revues.push(fiche);
    }
  }
  return { fiches, nouvelles, revues };
}

export function changerStatut(fiche, statut) {
  if (!STATUTS.includes(statut)) throw new Error('Statut inconnu : ' + statut);
  return { ...fiche, statut };
}

/**
 * On notifie seulement : une annonce nouvelle, jamais notifiée, d'une recherche
 * dont les notifications sont actives, qui est une opportunité qualifiée au-dessus du seuil.
 */
export function doitNotifier(fiche, resultat, recherche, seuil) {
  return fiche.statut === 'nouveau' && !fiche.notifieLe && recherche.notifications && recherche.active &&
    resultat.opportunite?.qualifie === true && resultat.opportunite.score >= seuil;
}

export function messageNotification(resultat) {
  const a = resultat.annonce, o = resultat.opportunite;
  return {
    titre: '🔥 Nouvelle opportunité',
    corps: (a.titre ?? 'Annonce') + '\n' + a.prix + ' €' + (o.marge != null ? '\nMarge potentielle estimée : ' + (o.marge >= 0 ? '+' : '') + Math.round(o.marge) + ' €' : '') + (o.incertain ? ' (estimation incertaine)' : ''),
    url: a.url,
  };
}
