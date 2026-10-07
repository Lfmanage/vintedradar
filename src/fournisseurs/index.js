import { fournisseurVinted } from './vinted.js';
import { fournisseurImport } from './import.js';

export const FOURNISSEURS = { vinted: fournisseurVinted, import: fournisseurImport };
export const listeFournisseurs = () => Object.values(FOURNISSEURS).map((f) => ({ id: f.id, nom: f.nom, mode: f.mode, ...f.statut() }));
export { normaliserAnnonce, normaliserLot, ErreurFournisseur, ETATS_FOURNISSEUR } from './contrat.js';
