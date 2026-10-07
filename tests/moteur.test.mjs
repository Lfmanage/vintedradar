import { test } from 'node:test';
import assert from 'node:assert/strict';
import { analyserRequete, completerRecherche } from '../src/moteur/recherche.js';
import { appliquerFiltres } from '../src/moteur/recherche.js';
import { pertinence, authenticite, lireAnnonce } from '../src/moteur/scores.js';
import { analyserLot } from '../src/moteur/index.js';
import { fusionner, changerStatut } from '../src/moteur/suivi.js';
import { normaliserAnnonce, normaliserLot } from '../src/fournisseurs/contrat.js';
import { fournisseurVinted } from '../src/fournisseurs/vinted.js';
import { listeFournisseurs } from '../src/fournisseurs/index.js';

// Annonces de TEST uniquement (jamais affichées dans l'appli).
let n = 1000;
const A = (titre, prix, extra = {}) => normaliserAnnonce({
  id: extra.id ?? String(n++), url: 'https://www.vinted.fr/items/' + (extra.id ?? n), titre, prix,
  images: ['https://exemple.test/p.jpg'], description: extra.description ?? 'Porté quelques fois.', ...extra,
}, 'vinted');

/* ---------- Compréhension de la requête ---------- */
test('comprend « maillot Real Madrid 2026/2027 »', () => {
  const q = analyserRequete('maillot Real Madrid 2026/2027');
  assert.equal(q.categorie, 'Maillot');
  assert.equal(q.club, 'Real Madrid');
  assert.deepEqual(q.saison, { debut: 2026, libelle: '2026/2027' });
  assert.deepEqual(q.modele, []);
});
test('les formats de saison 26/27 et 2026-27 sont équivalents', () => {
  assert.equal(analyserRequete('maillot PSG 26/27').saison.debut, 2026);
  assert.equal(analyserRequete('maillot PSG 2026-27').saison.debut, 2026);
});
test('comprend « Nike Tech Fleece » et « Jordan 4 »', () => {
  const a = analyserRequete('Nike Tech Fleece');
  assert.equal(a.marque, 'Nike');
  assert.deepEqual(a.modele, ['tech', 'fleece']);
  const b = analyserRequete('Jordan 4');
  assert.equal(b.marque, 'Jordan');
  assert.equal(b.categorie, 'Chaussures');
  assert.deepEqual(b.modele, ['4']);
});

/* ---------- Pertinence ---------- */
const rm = completerRecherche({ id: 'rm', motsCles: 'Maillot Real Madrid 2026/2027', exclus: ['réplique', 'enfant', 'faux', 'fake', 'personnalisé'] });
test('« Maillot Real Madrid 2026/2027 officiel » est très pertinent', () => {
  const p = pertinence(A('Maillot Real Madrid 2026/2027 officiel', 60), rm);
  assert.ok(p.score >= 85, 'score ' + p.score);
});
test('« T-shirt Real Madrid 2018 » est peu pertinent, avec les raisons', () => {
  const p = pertinence(A('T-shirt Real Madrid 2018', 15), rm);
  assert.ok(p.score <= 35, 'score ' + p.score);
  const textes = p.details.map((d) => d.texte).join(' | ');
  assert.match(textes, /Autre année : 2018/);
  assert.match(textes, /Autre type : T-shirt/);
});
test('une autre saison ou un autre club plafonne le score', () => {
  assert.ok(pertinence(A('Maillot Real Madrid 2024/2025', 40), rm).score <= 35);
  assert.ok(pertinence(A('Maillot FC Barcelone 2026/2027', 40), rm).score <= 35);
});

/* ---------- Filtres ---------- */
test('les mots exclus écartent l’annonce, avec la raison', () => {
  const f = appliquerFiltres(A('Maillot Real Madrid 2026/2027 réplique', 20), rm);
  assert.equal(f.garde, false);
  assert.match(f.raisons[0], /réplique/);
  assert.equal(appliquerFiltres(A('Maillot Real Madrid 2026/2027 taille enfant', 20), rm).garde, false);
});
test('prix, taille, état et marque : filtres stricts, données absentes signalées sans écarter', () => {
  const r = completerRecherche({ motsCles: 'Nike Tech Fleece', prixMax: 50, tailles: ['M', 'L', 'XL'], etatMin: 2, marques: ['Nike'] });
  assert.equal(appliquerFiltres(A('Nike Tech Fleece', 55, { taille: 'M' }), r).garde, false);
  assert.equal(appliquerFiltres(A('Nike Tech Fleece', 30, { taille: 'S' }), r).garde, false);
  assert.equal(appliquerFiltres(A('Nike Tech Fleece', 30, { taille: 'L / 40 / 12', etat: 'Satisfaisant' }), r).garde, false);
  assert.equal(appliquerFiltres(A('Tech Fleece', 30, { marque: 'Adidas' }), r).garde, false);
  const sansInfos = appliquerFiltres(A('Nike Tech Fleece', 30), r);
  assert.equal(sansInfos.garde, true);
  assert.deepEqual(sansInfos.notes, ['Taille non indiquée', 'État non indiqué']);
});
test('une annonce sans prix est écartée (jamais de prix inventé)', () => {
  const f = appliquerFiltres(A('Nike Tech Fleece', null), completerRecherche({ motsCles: 'Nike Tech Fleece' }));
  assert.equal(f.garde, false);
  assert.deepEqual(f.raisons, ['Prix indisponible']);
});

/* ---------- Authenticité ---------- */
test('signale ce qui est suspect sans jamais affirmer l’authenticité', () => {
  const a = A('Maillot Real Madrid 2026/2027 version thai 1:1', 12);
  const r = authenticite(a, lireAnnonce(a));
  assert.equal(r.alerte, true);
  assert.equal(r.libelle, '⚠️ Authenticité à vérifier');
  const ok = A('Maillot Real Madrid 2026/2027', 60);
  const r2 = authenticite(ok, lireAnnonce(ok));
  assert.equal(r2.alerte, false);
  assert.equal(r2.libelle, null); // pas de mention « authentique »
});

/* ---------- Estimation et opportunité ---------- */
const tf = { id: 'tf', motsCles: 'Nike Tech Fleece', margeMin: 20 };
const comparables = [55, 58, 60, 60, 62, 65, 50, 70, 59, 61].map((p) => A('Sweat Nike Tech Fleece noir', p, { marque: 'Nike' }));
test('Tech Fleece à 30 € face à ~60 € : opportunité qualifiée, chiffres expliqués', () => {
  const cible = A('Nike Tech Fleece noir zippé', 30, { marque: 'Nike', id: 'cible' });
  const res = analyserLot(tf, [cible, ...comparables]);
  const c = res.resultats.find((x) => x.annonce.id === 'cible');
  assert.equal(res.resultats[0].annonce.id, 'cible'); // classée en tête
  assert.equal(c.estimation.prix, 60);
  assert.equal(c.estimation.confiance, 'moyenne');
  assert.match(c.estimation.texte, /prix demandés, pas des ventes/);
  assert.equal(c.opportunite.cout, 32.2);          // 30 + 0,70 + 5 %
  assert.equal(c.opportunite.marge, 27.8);
  assert.ok(c.opportunite.qualifie);
  assert.ok(c.opportunite.score >= 75, 'score ' + c.opportunite.score);
  assert.ok(c.pertinence.score >= 85, 'pertinence ' + c.pertinence.score);
});
test('pas assez de comparables : aucune estimation, aucun score inventé', () => {
  const res = analyserLot(tf, [A('Nike Tech Fleece noir', 30, { marque: 'Nike', id: 'seule' }), comparables[0], comparables[1]]);
  const c = res.resultats.find((x) => x.annonce.id === 'seule');
  assert.equal(c.estimation.prix, null);
  assert.equal(c.opportunite.score, null);
  assert.equal(c.opportunite.qualifie, false);
  assert.match(c.opportunite.texte, /Pas assez d’annonces comparables/);
});
test('« pas cher » ne veut pas dire « bonne affaire » : une casquette à 6 € n’est pas une opportunité Tech Fleece', () => {
  const res = analyserLot(tf, [A('Casquette Nike noire', 6, { marque: 'Nike', id: 'casq' }), ...comparables]);
  const c = res.resultats.find((x) => x.annonce.id === 'casq');
  assert.ok(!c.opportunite.qualifie);
  assert.ok(c.pertinence.score < 60, 'pertinence ' + c.pertinence.score);
});
test('ta référence de revente remplace l’estimation automatique quand elle est renseignée', () => {
  const res = analyserLot({ ...tf, prixReventeReference: 70 }, [A('Nike Tech Fleece noir', 30, { marque: 'Nike', id: 'ref' })]);
  const c = res.resultats[0];
  assert.equal(c.estimation.source, 'reference');
  assert.equal(c.opportunite.marge, 37.8);
});

test('un article douteux n’est jamais classé comme opportunité ni notifié', () => {
  const lot = [58, 60, 62, 55, 61].map((p) => A('Maillot Real Madrid 2026/2027', p));
  const douteux = A('Maillot Real Madrid 2026/2027 version thai', 18, { id: 'thai' });
  const res = analyserLot({ id: 'rm', motsCles: 'Maillot Real Madrid 2026/2027' }, [douteux, ...lot]);
  const c = res.resultats.find((x) => x.annonce.id === 'thai');
  assert.equal(c.authenticite.libelle, '⚠️ Authenticité à vérifier');
  assert.equal(c.opportunite.qualifie, false);
  assert.ok(c.opportunite.score <= 40);
  assert.equal(res.aNotifier.some((m) => m.url.endsWith('/thai')), false);
});
test('« 26/27 » et « 2026/2027 » sont comparés entre eux', () => {
  const lot = [58, 60, 62, 55].map((p) => A('Maillot Real Madrid 2026/2027', p));
  const res = analyserLot({ id: 'rm', motsCles: 'Maillot Real Madrid 2026/2027' }, [A('Maillot Real Madrid 26/27 taille M', 30, { id: 'court' }), ...lot]);
  assert.equal(res.resultats.find((x) => x.annonce.id === 'court').estimation.n, 4);
});

/* ---------- Suivi, doublons, notifications ---------- */
test('une annonce déjà vue n’est jamais re-signalée comme nouvelle', () => {
  const a = A('Nike Tech Fleece noir', 30, { id: 'x1' });
  const t1 = fusionner(new Map(), [a], 'tf', '2026-09-23T10:00:00Z');
  assert.equal(t1.nouvelles.length, 1);
  const t2 = fusionner(t1.fiches, [{ ...a, prix: 25 }], 'tf', '2026-09-23T12:00:00Z');
  assert.equal(t2.nouvelles.length, 0);
  const f = t2.fiches.get('vinted:x1');
  assert.equal(f.premiereDetection, '2026-09-23T10:00:00Z');
  assert.equal(f.derniereDetection, '2026-09-23T12:00:00Z');
  assert.deepEqual(f.baissePrix, { de: 30, a: 25, le: '2026-09-23T12:00:00Z' });
  assert.equal(changerStatut(f, 'achete').statut, 'achete');
  assert.throws(() => changerStatut(f, 'revendu'));
});
test('notification : seulement pour une nouvelle opportunité forte, une seule fois', () => {
  const cible = A('Nike Tech Fleece noir', 30, { marque: 'Nike', id: 'notif' });
  const r1 = analyserLot(tf, [cible, ...comparables]);
  assert.equal(r1.aNotifier.length, 1);
  assert.equal(r1.aNotifier[0].url, 'https://www.vinted.fr/items/notif'); // URL exacte de l'annonce
  const r2 = analyserLot(tf, [cible, ...comparables], r1.fiches);
  assert.equal(r2.aNotifier.length, 0);
  const r3 = analyserLot({ ...tf, notifications: false }, [A('Nike Tech Fleece noir', 29, { marque: 'Nike', id: 'n2' }), ...comparables]);
  assert.equal(r3.aNotifier.length, 0);
});

/* ---------- Fournisseurs ---------- */
test('une annonce sans URL exacte est refusée, pas corrigée', () => {
  assert.throws(() => normaliserAnnonce({ id: '1', titre: 'x', prix: 10 }, 'vinted'), /sans URL exacte/);
  const { annonces, rejets } = normaliserLot([{ id: '1', url: 'https://www.vinted.fr/items/1', prix: 10 }, { id: '1', url: 'https://www.vinted.fr/items/1', prix: 10 }, { id: '2' }], 'vinted');
  assert.equal(annonces.length, 1); // doublon retiré
  assert.equal(rejets.length, 1);
  assert.equal(annonces[0].titre, null); // champ absent = null, jamais inventé
});
test('le fournisseur Vinted se déclare non disponible et refuse de simuler', async () => {
  assert.equal(fournisseurVinted.statut().etat, 'non_disponible');
  await assert.rejects(() => fournisseurVinted.rechercher({}), /aucun accès autorisé/);
  const liste = listeFournisseurs();
  assert.deepEqual(liste.map((f) => [f.id, f.etat]), [['vinted', 'non_disponible'], ['import', 'manuel']]);
});
