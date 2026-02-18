export interface ListNode {
  __list_prev: ListNode | null
  __list_next: ListNode | null
}

export class List<T extends ListNode> {
  private _head: T | null = null
  private _tail: T | null = null

  push(o: T): void {
    o.__list_prev = this._tail
    o.__list_next = null
    if (this._tail) this._tail.__list_next = o
    this._tail = o
    if (!this._head) this._head = o
  }

  walk(fn: (node: T) => void): void {
    let p = this._head
    while (p) {
      const next = p.__list_next as T | null
      fn(p)
      p = next
    }
  }

  remove(w: T): void {
    const next = w.__list_next as T | null
    const prev = w.__list_prev as T | null

    if (prev) prev.__list_next = next
    else this._head = next

    if (next) next.__list_prev = prev
    else this._tail = prev

    w.__list_next = null
    w.__list_prev = null
  }
}
