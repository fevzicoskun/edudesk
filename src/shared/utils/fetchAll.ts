const PAGE = 1000 // PostgREST max_rows; .limit(5000) bile 1000'de SESSİZCE kesilir (canlıda ölçüldü 2026-09-24)

type Page<T> = (from: number, to: number) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>

/** Tüm satırları sayfa sayfa okur. Sorgu SIRALI olmalı (sonunda .order('id')) yoksa satır atlanır/tekrarlanır. */
export async function fetchAll<T>(page: Page<T>): Promise<T[]> {
  const all: T[] = []
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await page(from, from + PAGE - 1)
    if (error) throw new Error(error.message)
    const batch = data ?? []
    all.push(...batch)
    if (batch.length < PAGE) return all
  }
}

/** fetchAll'ın { data, error } şekli — Supabase sonucu bekleyen çağrı yerlerine doğrudan oturur. */
export async function fetchAllResult<T>(page: Page<T>): Promise<{ data: T[]; error: null } | { data: null; error: { message: string } }> {
  try {
    return { data: await fetchAll(page), error: null }
  } catch (e) {
    return { data: null, error: { message: (e as Error).message } }
  }
}
