/**
 * Test dataset used by `npm run seed:demo`.
 * Every login here is a local TEST account — never reuse these passwords in production.
 */
import type { Category } from '../players/schemas/player.schema';
import type { Position, StrongHand } from '../players/schemas/technical-sheet.schema';

export const TEST_PASSWORDS = {
  coach: 'Coach123!',
  parent: 'Parent123!',
} as const;

export interface DemoCoach {
  key: string;
  name: string;
  email: string;
  phone: string;
}

export interface DemoParent {
  key: string;
  name: string;
  email: string;
  phone: string;
  /** Which coach "created" the account (coaches only see parents they created). */
  createdBy: string;
  note: string;
}

export interface DemoPlayer {
  name: string;
  dateOfBirth: string;
  parent: string;
  category: Category;
  monthlyFee: number;
  active?: boolean;
  /** 0–1: how often they attend. */
  attendance: number;
  /** 'good' = always paid · 'late' = current month unpaid · 'debt' = several months unpaid · 'new' = joined recently */
  payer: 'good' | 'late' | 'debt' | 'new';
  sheet?: {
    height?: number;
    weight?: number;
    strongHand?: StrongHand;
    mainPosition?: Position;
    secondaryPosition?: Position;
    jerseyNumber?: number;
    notes?: string;
  };
}

export const COACHES: DemoCoach[] = [
  { key: 'sami', name: 'Coach Sami', email: 'coach@academy.local', phone: '20111222' },
  { key: 'nadia', name: 'Coach Nadia', email: 'coach2@academy.local', phone: '20333444' },
  { key: 'karim', name: 'Coach Karim', email: 'coach3@academy.local', phone: '20555666' },
];

export const PARENTS: DemoParent[] = [
  { key: 'amel', name: 'Amel Ben Salah', email: 'parent@academy.local', phone: '22123456', createdBy: 'sami', note: '2 enfants (U13 + U15), un khalès / un non khalès ce mois-ci' },
  { key: 'mehdi', name: 'Mehdi Trabelsi', email: 'parent2@academy.local', phone: '22234567', createdBy: 'nadia', note: '3 enfants (U9, U11, U15), toujours à jour' },
  { key: 'sonia', name: 'Sonia Gharbi', email: 'parent3@academy.local', phone: '22345678', createdBy: 'karim', note: '2 enfants (U9 + U17), le U9 en retard ce mois-ci' },
  { key: 'hatem', name: 'Hatem Jaziri', email: 'parent4@academy.local', phone: '22456789', createdBy: 'karim', note: '2 enfants U17/U19 : un avec 3 mois impayés + fiche technique vide' },
  { key: 'rim', name: 'Rim Bouazizi', email: 'parent5@academy.local', phone: '22567890', createdBy: 'sami', note: "aucun enfant lié (état vide)" },
  { key: 'walid', name: 'Walid Mansour', email: 'parent6@academy.local', phone: '22678901', createdBy: 'nadia', note: '3 enfants (U9, U11, U13), dont une joueuse inactive' },
  { key: 'ines', name: 'Ines Hammami', email: 'parent7@academy.local', phone: '22789012', createdBy: 'karim', note: '2 enfants : senior inscrite ce mois-ci + gardien U19' },
];

export const PLAYERS: DemoPlayer[] = [
  // --- U13 / U15 ---
  {
    name: 'Youssef Ben Salah', dateOfBirth: '2013-04-12', parent: 'amel', category: 'U13', monthlyFee: 60, attendance: 0.85, payer: 'late',
    sheet: { height: 158, weight: 47, strongHand: 'left', mainPosition: 'right_back', secondaryPosition: 'right_wing', jerseyNumber: 7, notes: 'Très bon tir en suspension.\nÀ travailler : replacement défensif et communication avec le gardien.' },
  },
  {
    name: 'Lina Ben Salah', dateOfBirth: '2011-09-02', parent: 'amel', category: 'U15', monthlyFee: 60, attendance: 0.92, payer: 'good',
    sheet: { height: 164, weight: 52, strongHand: 'right', mainPosition: 'center_back', secondaryPosition: 'left_back', jerseyNumber: 10, notes: 'Excellente lecture du jeu, leader sur le terrain. Capitaine U15.' },
  },
  {
    name: 'Adam Kefi', dateOfBirth: '2013-01-20', parent: 'walid', category: 'U13', monthlyFee: 60, attendance: 0.7, payer: 'good',
    sheet: { height: 150, weight: 41, strongHand: 'right', mainPosition: 'left_wing', jerseyNumber: 11, notes: 'Rapide en contre-attaque. Doit gagner en confiance au tir.' },
  },
  {
    name: 'Yasmine Chaabane', dateOfBirth: '2012-06-08', parent: 'mehdi', category: 'U15', monthlyFee: 60, attendance: 0.95, payer: 'good',
    sheet: { height: 168, weight: 55, strongHand: 'right', mainPosition: 'goalkeeper', jerseyNumber: 1, notes: 'Gardienne très réactive sur les tirs à 6 m. Travailler le jeu au pied.' },
  },

  // --- U9 / U11 ---
  {
    name: 'Rayen Trabelsi', dateOfBirth: '2016-03-15', parent: 'mehdi', category: 'U11', monthlyFee: 45, attendance: 0.9, payer: 'good',
    sheet: { height: 138, weight: 32, strongHand: 'right', mainPosition: 'pivot', jerseyNumber: 9, notes: 'Très bon esprit d’équipe, toujours à l’écoute.' },
  },
  {
    name: 'Malek Gharbi', dateOfBirth: '2018-02-11', parent: 'sonia', category: 'U9', monthlyFee: 40, attendance: 0.75, payer: 'late',
    sheet: { height: 124, weight: 25, strongHand: 'left', mainPosition: 'left_wing', jerseyNumber: 3 },
  },
  {
    name: 'Omar Mansour', dateOfBirth: '2018-07-30', parent: 'walid', category: 'U9', monthlyFee: 40, attendance: 0.8, payer: 'good',
    sheet: { height: 121, weight: 24, strongHand: 'right', mainPosition: 'center_back', jerseyNumber: 5, notes: 'Découvre le handball, très motivé.' },
  },
  {
    name: 'Salma Mansour', dateOfBirth: '2016-11-04', parent: 'walid', category: 'U11', monthlyFee: 45, attendance: 0.4, payer: 'debt', active: false,
    sheet: { height: 135, weight: 30, strongHand: 'right', mainPosition: 'right_wing', jerseyNumber: 14, notes: 'Pause pour raisons scolaires (joueuse inactive).' },
  },
  {
    name: 'Aziz Ferchichi', dateOfBirth: '2017-05-19', parent: 'mehdi', category: 'U9', monthlyFee: 40, attendance: 0.88, payer: 'good',
  },

  // --- U17 / U19 / Seniors ---
  {
    name: 'Iheb Gharbi', dateOfBirth: '2009-08-22', parent: 'sonia', category: 'U17', monthlyFee: 70, attendance: 0.93, payer: 'good',
    sheet: { height: 182, weight: 74, strongHand: 'left', mainPosition: 'right_back', secondaryPosition: 'right_wing', jerseyNumber: 21, notes: 'Gaucher puissant, sélectionnable en équipe régionale. Travailler la vision de jeu.' },
  },
  {
    name: 'Fares Jaziri', dateOfBirth: '2008-01-09', parent: 'hatem', category: 'U19', monthlyFee: 70, attendance: 0.55, payer: 'debt',
  },
  {
    name: 'Skander Ayari', dateOfBirth: '2009-12-01', parent: 'hatem', category: 'U17', monthlyFee: 70, attendance: 0.8, payer: 'good',
    sheet: { height: 186, weight: 82, strongHand: 'right', mainPosition: 'pivot', secondaryPosition: 'center_back', jerseyNumber: 18, notes: 'Pivot solide, bon bloqueur. Doit améliorer sa condition physique.' },
  },
  {
    name: 'Nour Hammami', dateOfBirth: '2004-03-27', parent: 'ines', category: 'Seniors', monthlyFee: 80, attendance: 0.9, payer: 'new',
    sheet: { height: 172, weight: 63, strongHand: 'right', mainPosition: 'left_back', secondaryPosition: 'center_back', jerseyNumber: 8, notes: 'Arrivée ce mois-ci, ancienne joueuse de club régional.' },
  },
  {
    name: 'Ghassen Mejri', dateOfBirth: '2007-10-14', parent: 'ines', category: 'U19', monthlyFee: 70, attendance: 0.97, payer: 'good',
    sheet: { height: 190, weight: 85, strongHand: 'right', mainPosition: 'goalkeeper', jerseyNumber: 12, notes: 'Gardien titulaire U19. Excellent sur les jets de 7 m.' },
  },
];
