// Redis removed — matches are fetched live from APIs directly

export async function getCached<T>(_key: string): Promise<T | null> {
  return null;
}

export async function setCached(_key: string, _value: any, _ttl?: number): Promise<void> {
  // no-op
}