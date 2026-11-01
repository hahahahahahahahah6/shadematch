// Demo catalog. These shades are invented for this demo; they are not real products.
import { deltaE, hexToLab } from './color.js';

export const FOUNDATIONS = [
  { id: 'F110', name: 'Porcelain 110', hex: '#F3D9C6', undertone: 'cool' },
  { id: 'F120', name: 'Ivory 120', hex: '#F1D6BA', undertone: 'neutral' },
  { id: 'F130', name: 'Vanilla 130', hex: '#EFD1AA', undertone: 'warm' },
  { id: 'F210', name: 'Rose Beige 210', hex: '#E3BCA4', undertone: 'cool' },
  { id: 'F220', name: 'Natural Beige 220', hex: '#E2BB9A', undertone: 'neutral' },
  { id: 'F230', name: 'Golden Beige 230', hex: '#E0B88E', undertone: 'warm' },
  { id: 'F310', name: 'Soft Sand 310', hex: '#CFA287', undertone: 'cool' },
  { id: 'F320', name: 'Sand 320', hex: '#CDA07E', undertone: 'neutral' },
  { id: 'F330', name: 'Honey 330', hex: '#CB9D72', undertone: 'warm' },
  { id: 'F410', name: 'Cocoa Rose 410', hex: '#AD7D66', undertone: 'cool' },
  { id: 'F420', name: 'Caramel 420', hex: '#AB7B5E', undertone: 'neutral' },
  { id: 'F430', name: 'Amber 430', hex: '#A97954', undertone: 'warm' },
  { id: 'F510', name: 'Mocha 510', hex: '#835A4A', undertone: 'cool' },
  { id: 'F520', name: 'Espresso 520', hex: '#7E5642', undertone: 'neutral' },
  { id: 'F530', name: 'Chestnut 530', hex: '#7C5338', undertone: 'warm' },
  { id: 'F610', name: 'Ebony 610', hex: '#5A3C33', undertone: 'neutral' }
];

export const LIPSTICKS = [
  { id: 'L01', name: 'Berry Crush', hex: '#8E2A4B', undertone: 'cool', depth: 'any' },
  { id: 'L02', name: 'Rosewood', hex: '#A8525E', undertone: 'cool', depth: 'any' },
  { id: 'L03', name: 'Cool Pink', hex: '#D46A8C', undertone: 'cool', depth: 'light' },
  { id: 'L04', name: 'Blue Red', hex: '#B0182F', undertone: 'cool', depth: 'any' },
  { id: 'L05', name: 'Coral Pop', hex: '#E5654F', undertone: 'warm', depth: 'light' },
  { id: 'L06', name: 'Terracotta', hex: '#B24E33', undertone: 'warm', depth: 'any' },
  { id: 'L07', name: 'Brick Red', hex: '#9C2F22', undertone: 'warm', depth: 'deep' },
  { id: 'L08', name: 'Peach Nude', hex: '#D88A6E', undertone: 'warm', depth: 'light' },
  { id: 'L09', name: 'Mauve', hex: '#A0656F', undertone: 'neutral', depth: 'any' },
  { id: 'L10', name: 'Classic Red', hex: '#C1272D', undertone: 'neutral', depth: 'any' },
  { id: 'L11', name: 'Rose Nude', hex: '#C07E78', undertone: 'neutral', depth: 'light' },
  { id: 'L12', name: 'Plum', hex: '#6E2840', undertone: 'neutral', depth: 'deep' }
];

// Foundation: closest color to the measured skin, with a small penalty when the
// undertone family does not match. Lower score = better match.
export function recommendFoundations(skinHex, undertone, count = 3) {
  return FOUNDATIONS.map(f => {
    const dist = deltaE(skinHex, f.hex);
    const penalty = f.undertone === undertone ? 0 : f.undertone === 'neutral' || undertone === 'neutral' ? 2 : 5;
    return { ...f, distance: +dist.toFixed(1), score: dist + penalty };
  })
    .sort((a, b) => a.score - b.score)
    .slice(0, count)
    .map(({ score, ...rest }) => rest);
}

// Lipstick: same undertone family first, then neutrals; prefer shades whose
// depth suits the skin depth.
export function recommendLipsticks(skinHex, undertone, count = 3) {
  const isDeep = hexToLab(skinHex).L < 50;
  const fits = l => l.depth === 'any' || (l.depth === 'deep') === isDeep;
  const rank = l => (l.undertone === undertone ? 0 : l.undertone === 'neutral' ? 1 : 3) + (fits(l) ? 0 : 1.5);
  return [...LIPSTICKS].sort((a, b) => rank(a) - rank(b)).slice(0, count);
}
