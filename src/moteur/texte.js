// Outils de texte partagés par tout le moteur d'analyse.
// Aucune dépendance à une marketplace : on ne manipule que du texte.

export const sansAccents = (s) => String(s ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '');

export function normaliser(s) {
  return sansAccents(s).toLowerCase()
    .replace(/\bt[\s-]?shirts?\b|\btee[\s-]?shirts?\b/g, ' tshirt ')
    .replace(/[’']/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export const mots = (s) => normaliser(s).split(/[^a-z0-9&]+/).filter(Boolean);

export const MOTS_VIDES = new Set(
  'de du des la le les l d et avec pour en a au aux un une sur ou par taille t tres bon etat neuf neuve neufs comme jamais porte portee original originale lot eu fr us uk new vends vend'.split(' ')
);

const echapper = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
// Vrai si l'expression apparaît comme mot entier dans un texte déjà normalisé.
export function contient(texteNormalise, expression) {
  const e = normaliser(expression);
  if (!e) return false;
  return new RegExp('(^|[^a-z0-9])' + echapper(e) + '($|[^a-z0-9])').test(texteNormalise);
}

function trouver(dico, texteNormalise) {
  for (const [nom, alias] of dico) {
    for (const a of alias) if (contient(texteNormalise, a)) return { nom, alias: a };
  }
  return null;
}

/* ---------- Marques ---------- */
// La liste sert à reconnaître une marque dans un texte. Elle n'est pas limitative :
// une recherche peut toujours porter sur une marque absente d'ici.
export const MARQUES = [
  ['Jordan', ['air jordan', 'jordan']],
  ['Nike', ['nike']],
  ['Adidas', ['adidas']],
  ['Puma', ['puma']],
  ['Carhartt', ['carhartt wip', 'carhartt']],
  ['The North Face', ['the north face', 'north face', 'tnf']],
  ['On', ['on running', 'on cloud', 'cloudmonster', 'cloudnova']],
  ['Decathlon', ['decathlon', 'kipsta', 'kalenji', 'quechua']],
  ['Bershka', ['bershka']],
  ['Pull&Bear', ['pull&bear', 'pull and bear', 'pull & bear']],
  ['Zara', ['zara']],
  ['New Balance', ['new balance']],
  ['Lacoste', ['lacoste']],
  ['Ralph Lauren', ['polo ralph lauren', 'ralph lauren']],
  ['Stone Island', ['stone island']],
  ['Moncler', ['moncler']],
  ['Asics', ['asics']],
  ['Salomon', ['salomon']],
  ['Levi\'s', ['levi s', 'levis']],
  ['Tommy Hilfiger', ['tommy hilfiger', 'tommy jeans']],
  ['Champion', ['champion']],
  ['Stüssy', ['stussy']],
  ['Supreme', ['supreme']],
  ['Patagonia', ['patagonia']],
  ['Arc\'teryx', ['arc teryx', 'arcteryx']],
  ['Umbro', ['umbro']],
  ['Kappa', ['kappa']],
  ['Le Coq Sportif', ['le coq sportif']],
];
// Sous-marques considérées comme compatibles avec leur marque mère.
const PARENTS = { Jordan: 'Nike' };
export const trouverMarque = (texteNormalise) => trouver(MARQUES, texteNormalise);
export function marquesCompatibles(a, b) {
  if (!a || !b) return false;
  const na = normaliser(a), nb = normaliser(b);
  if (na === nb) return true;
  const ca = trouverMarque(na)?.nom ?? a, cb = trouverMarque(nb)?.nom ?? b;
  return ca === cb || PARENTS[ca] === cb || PARENTS[cb] === ca;
}

/* ---------- Clubs et sélections ---------- */
export const CLUBS = [
  ['Real Madrid', ['real madrid']],
  ['Atlético Madrid', ['atletico madrid', 'atletico de madrid']],
  ['FC Barcelone', ['fc barcelona', 'fc barcelone', 'barcelone', 'barcelona', 'barca']],
  ['Paris Saint-Germain', ['paris saint germain', 'paris sg', 'psg']],
  ['Olympique de Marseille', ['olympique de marseille', 'marseille', 'om']],
  ['Olympique Lyonnais', ['olympique lyonnais', 'lyon']],
  ['AS Monaco', ['as monaco', 'monaco']],
  ['LOSC Lille', ['losc', 'lille']],
  ['RC Lens', ['rc lens', 'lens']],
  ['AS Saint-Étienne', ['saint etienne', 'asse']],
  ['Manchester United', ['manchester united', 'man united', 'man utd']],
  ['Manchester City', ['manchester city', 'man city']],
  ['Liverpool', ['liverpool']],
  ['Arsenal', ['arsenal']],
  ['Chelsea', ['chelsea']],
  ['Tottenham', ['tottenham', 'spurs']],
  ['Juventus', ['juventus', 'juve']],
  ['AC Milan', ['ac milan', 'milan ac']],
  ['Inter Milan', ['inter milan', 'inter milano']],
  ['Naples', ['ssc napoli', 'napoli', 'naples']],
  ['AS Roma', ['as roma', 'roma']],
  ['Bayern Munich', ['bayern munich', 'bayern munchen', 'bayern']],
  ['Borussia Dortmund', ['borussia dortmund', 'dortmund', 'bvb']],
  ['Ajax', ['ajax']],
  ['Benfica', ['benfica']],
  ['FC Porto', ['fc porto', 'porto']],
  ['Équipe de France', ['equipe de france']],
  ['Argentine', ['argentine', 'argentina']],
  ['Brésil', ['bresil', 'brasil', 'brazil']],
  ['Portugal', ['portugal']],
  ['Espagne', ['espagne', 'spain']],
  ['Italie', ['italie', 'italy']],
  ['Allemagne', ['allemagne', 'germany']],
  ['Angleterre', ['angleterre', 'england']],
  ['Maroc', ['maroc', 'morocco']],
  ['Algérie', ['algerie', 'algeria']],
  ['Sénégal', ['senegal']],
];
export const trouverClub = (texteNormalise) => trouver(CLUBS, texteNormalise);

/* ---------- Types d'articles ---------- */
const CATEGORIES = [
  ['Maillot', /\b(maillots?|jerseys?)\b/],
  ['Chaussures', /\b(baskets?|sneakers?|chaussures?|air force|air max|dunk|yeezy|samba|gazelle|campus|spezial|jordan \d{1,2})\b/],
  ['Survêtement', /\b(survetements?|ensembles?)\b/],
  ['Pantalon', /\b(pantalons?|joggings?|joggers?|jeans?|cargos?)\b/],
  ['Short', /\b(shorts?)\b/],
  ['Veste', /\b(vestes?|jackets?|coupe vent|windrunner|doudounes?|manteaux?|parkas?|blousons?)\b/],
  ['Sweat', /\b(sweats?|sweatshirts?|hoodies?|pulls?|polaires?|capuche)\b/],
  ['T-shirt', /\b(tshirt|tee)\b/],
  ['Polo', /\bpolos?\b(?! ralph)/],
  ['Casquette', /\b(casquettes?|bobs?|bonnets?)\b/],
  ['Sac', /\b(sacs?|sacoches?|bananes?)\b/],
];
// Types proches : comparaison partielle plutôt qu'incompatibilité.
const PROCHES = [['Sweat', 'Veste'], ['Pantalon', 'Survêtement'], ['T-shirt', 'Polo']];
export function trouverCategorie(texteNormalise) {
  for (const [nom, re] of CATEGORIES) if (re.test(texteNormalise)) return nom;
  return null;
}
export function relationCategories(a, b) {
  if (!a || !b) return 'inconnue';
  if (a === b) return 'identique';
  return PROCHES.some(([x, y]) => (x === a && y === b) || (x === b && y === a)) ? 'proche' : 'differente';
}

/* ---------- Saisons et années ---------- */
// « 2026/2027 », « 2026-27 », « 26/27 » → saison qui commence en 2026.
export function lireSaisons(texte) {
  const t = normaliser(texte);
  const saisons = new Set(), annees = new Set();
  for (const m of t.matchAll(/(?:^|[^0-9])((?:19|20)?\d{2})\s*[/-]\s*((?:19|20)?\d{2})(?![0-9])/g)) {
    let a = +m[1], b = +m[2];
    if (a < 100) a += 2000;
    if (b < 100) b += Math.floor(a / 100) * 100;
    if (b === a + 1 && a >= 1950 && a <= 2040) saisons.add(a);
  }
  for (const m of t.matchAll(/(?:^|[^0-9])((?:19[5-9]|20[0-4])\d)(?![0-9])/g)) annees.add(+m[1]);
  return { saisons: [...saisons], annees: [...annees] };
}

/* ---------- États ---------- */
export const ETATS = [
  [5, 'Neuf avec étiquette', /neuf avec etiquette/],
  [4, 'Neuf sans étiquette', /neuf sans etiquette|\bneuf\b|\bneuve\b/],
  [3, 'Très bon état', /tres bon etat/],
  [2, 'Bon état', /\bbon etat\b/],
  [1, 'Satisfaisant', /satisfaisant/],
];
export function niveauEtat(etat) {
  if (!etat) return null;
  const t = normaliser(etat);
  for (const [niveau, , re] of ETATS) if (re.test(t)) return niveau;
  return null;
}
export const libelleEtat = (niveau) => ETATS.find(([n]) => n === niveau)?.[1] ?? null;

/* ---------- Tailles ---------- */
// « M / 38 / 10 » → {M, 38, 10}
export function lireTailles(taille) {
  if (!taille) return new Set();
  return new Set(sansAccents(taille).toUpperCase().replace(/TAILLE|EU|FR/g, ' ').split(/[\s/,|]+/).filter(Boolean));
}
