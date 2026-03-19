export const BOSS_LORE = [
  { name: 'Gorvax the Unbroken',     lore: 'An ancient titan whose hide has never known defeat.' },
  { name: 'Skareth the Devourer',    lore: 'Consumes entire armies to fuel its insatiable hunger.' },
  { name: 'Vex the Eternal',         lore: 'Has been slain a thousand times, yet always returns.' },
  { name: 'Drakthos the Ashen',      lore: 'Leaves nothing but cinders in its wake.' },
  { name: 'Myrrha the Hollow',       lore: 'A void given form, devouring light and hope alike.' },
  { name: 'Grundir the Stonewarden', lore: 'Mountains bow before its thunderous march.' },
  { name: 'Zhael the Whisperer',     lore: 'Its voice alone has felled kingdoms.' },
  { name: 'Torvak Ironmaw',          lore: 'Teeth forged in the heart of a dying star.' },
  { name: 'Nethys the Unseen',       lore: 'Strikes from the shadows between worlds.' },
  { name: 'Kaldris the Frostbound',  lore: 'Encases its victims in eternal ice.' },
] as const

export function getBossLore(bossNumber: number) {
  return BOSS_LORE[bossNumber % BOSS_LORE.length]
}
