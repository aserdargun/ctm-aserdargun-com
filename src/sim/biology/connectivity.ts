/**
 * Cell to Mind — bağ grafiği bağlantı analizi.
 *
 * Çok hücreli organizma tanımı: "yan yana duran hücreler" DEĞİLDİR. Bir yapı
 * ancak hücreleri arasında **bağ** olan bağlı bileşendir. MVP'de akraba olmayan
 * rastlantısal hücre birleşmesi yoktur.
 */

import type { Bond } from '../types.ts';

export interface Component {
  cells: number[];
  /** Bileşenin en küçük hücre kimliği — kararlı sıralama için. */
  minCellId: number;
}

/**
 * Bağ grafiğinin bağlı bileşenlerini döndürür.
 * Sonuç kararlıdır: bileşenler `minCellId` ile sıralanır.
 */
export function connectedComponents(
  cellIds: readonly number[],
  bonds: readonly Bond[],
  isBondAlive: (bondId: number) => boolean,
): Component[] {
  if (cellIds.length === 0) return [];
  if (cellIds.length === 1) return [{ cells: [cellIds[0] as number], minCellId: cellIds[0] as number }];

  const adj = new Map<number, number[]>();
  for (const id of cellIds) adj.set(id, []);
  for (const bond of bonds) {
    if (!isBondAlive(bond.id)) continue;
    const a = adj.get(bond.a);
    const b = adj.get(bond.b);
    if (!a || !b) continue;
    a.push(bond.b);
    b.push(bond.a);
  }

  const seen = new Set<number>();
  const components: Component[] = [];
  for (const start of cellIds) {
    if (seen.has(start)) continue;
    const stack = [start];
    seen.add(start);
    const cells: number[] = [];
    let minCellId = start;
    while (stack.length > 0) {
      const cur = stack.pop() as number;
      cells.push(cur);
      if (cur < minCellId) minCellId = cur;
      for (const next of adj.get(cur) ?? []) {
        if (!seen.has(next)) {
          seen.add(next);
          stack.push(next);
        }
      }
    }
    cells.sort((x, y) => x - y);
    components.push({ cells, minCellId });
  }

  components.sort((x, y) => x.minCellId - y.minCellId);
  return components;
}

/**
 * Bağ koptuktan sonra kimliği sürdüren bileşeni seçer.
 *
 * Kural (belgelenmiş işletimsel tanım):
 *  1. En büyük bileşen mevcut organizma kimliğini sürdürür.
 *  2. Eşitlikte, en küçük hücre kimliğini içeren bileşen seçilir (kararlı sıra).
 */
export function chooseIdentityComponent(components: readonly Component[]): number {
  let best = 0;
  for (let i = 1; i < components.length; i++) {
    const a = components[i] as Component;
    const b = components[best] as Component;
    if (a.cells.length > b.cells.length) best = i;
  }
  return best;
}

/** Bağ kopması bir yapıyı bölüyor mu? (tek bileşenden fazlası varsa) */
export function splitsIntoMultiple(components: readonly Component[]): boolean {
  return components.length > 1;
}