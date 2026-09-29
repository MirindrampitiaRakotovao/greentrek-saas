/**
 * File de priorité « tas binaire minimum » (§6.2), écrite à la main pour pouvoir l'expliquer.
 *
 * Le tas est un tableau où le parent de l'indice i est ⌊(i − 1) / 2⌋ et ses enfants 2i + 1 et
 * 2i + 2 ; chaque parent a une priorité ≤ à celle de ses enfants, donc le minimum est en tête.
 * - push : on ajoute en fin de tableau puis on fait « remonter » l'élément : O(log n) ;
 * - pop : on retire la tête, on met le dernier élément à sa place et on le fait
 *   « descendre » : O(log n).
 *
 * Dijkstra et A* l'utilisent avec des « entrées périmées » : plutôt que de diminuer la
 * priorité d'un nœud déjà présent, on le réinsère, et l'ancienne entrée est ignorée à la
 * sortie. Complexité de Dijkstra : O((V + E) log V).
 */
export class MinHeap<T> {
  private readonly items: { value: T; priority: number }[] = [];

  get size(): number {
    return this.items.length;
  }

  push(value: T, priority: number): void {
    this.items.push({ value, priority });
    this.siftUp(this.items.length - 1);
  }

  pop(): { value: T; priority: number } | undefined {
    const top = this.items[0];
    const last = this.items.pop();
    if (top === undefined || last === undefined) return undefined;
    if (this.items.length > 0) {
      this.items[0] = last;
      this.siftDown(0);
    }
    return top;
  }

  private siftUp(index: number): void {
    let i = index;
    while (i > 0) {
      const parent = (i - 1) >> 1;
      if (this.items[parent]!.priority <= this.items[i]!.priority) break;
      this.swap(i, parent);
      i = parent;
    }
  }

  private siftDown(index: number): void {
    let i = index;
    const n = this.items.length;
    for (;;) {
      const left = 2 * i + 1;
      const right = left + 1;
      let smallest = i;
      if (left < n && this.items[left]!.priority < this.items[smallest]!.priority) smallest = left;
      if (right < n && this.items[right]!.priority < this.items[smallest]!.priority)
        smallest = right;
      if (smallest === i) return;
      this.swap(i, smallest);
      i = smallest;
    }
  }

  private swap(a: number, b: number): void {
    const tmp = this.items[a]!;
    this.items[a] = this.items[b]!;
    this.items[b] = tmp;
  }
}
