import Decimal from 'break_eternity.js'
export { Decimal }

const SUFFIXES = ['', 'K', 'M', 'B', 'T', 'Qa', 'Qi', 'Sx', 'Sp', 'Oc', 'No', 'Dc']

export function formatNumber(value: Decimal | number | string): string {
  const d = value instanceof Decimal ? value : new Decimal(value)
  if (!d.isFinite() || d.isNan()) return '0'
  const absVal = d.abs()
  if (absVal.lt(1000)) return d.toFixed(1)
  const exp = Math.floor(absVal.log10().toNumber())
  const tier = Math.floor(exp / 3)
  if (tier >= SUFFIXES.length) {
    return d.toExponential(2)
  }
  const scale = new Decimal(10).pow(tier * 3)
  const scaled = d.div(scale)
  return `${scaled.toFixed(1)}${SUFFIXES[tier]}`
}
