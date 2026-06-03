export async function initDatabase(): Promise<never> {
  throw new Error('Native database not available on web')
}

export async function replaceDatabase(): Promise<never> {
  throw new Error('Native database not available on web')
}
