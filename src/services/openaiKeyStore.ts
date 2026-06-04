let _key = ''
const _listeners = new Set<() => void>()

export const openaiKeyStore = {
  get(): string { return _key },
  set(key: string): void {
    _key = key.trim()
    _listeners.forEach(cb => cb())
  },
  subscribe(cb: () => void): () => void {
    _listeners.add(cb)
    return () => { _listeners.delete(cb) }
  },
}
