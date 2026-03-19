export const TITLE_CATALOGUE = [
  { id: 'slayer',       label: 'Slayer',       cost: 1 },
  { id: 'annihilator',  label: 'Annihilator',  cost: 3 },
  { id: 'bane',         label: 'Bane',         cost: 5 },
  { id: 'executioner',  label: 'Executioner',  cost: 10 },
  { id: 'destroyer',    label: 'Destroyer',    cost: 25 },
] as const

export type TitleId = typeof TITLE_CATALOGUE[number]['id']
