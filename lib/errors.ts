/** Supabase / PostgREST hata mesajlarını kullanıcı dostu Türkçe'ye çevirir. */
export function translateError(err: unknown): string {
  const msg = err instanceof Error ? err.message : String(err ?? '')

  if (msg.includes('duplicate key') || msg.includes('unique_violation') || msg.includes('already been registered'))
    return 'Bu kayıt zaten mevcut'
  if (msg.includes('violates foreign key') || msg.includes('foreign_key_violation'))
    return 'İlgili kayıt bulunamadı veya silinemez'
  if (msg.includes('violates not-null') || msg.includes('not_null_violation'))
    return 'Gerekli alanlar eksik'
  if (msg.includes('new row violates row-level security') || msg.includes('permission denied for table'))
    return 'Bu işlem için yetkiniz yok'
  if (msg.includes('school_id değiştirilemez'))
    return 'Okul bilgisi değiştirilemez'
  if (msg.includes('role değiştirme yetkisi yok') || msg.includes('Yetki yok'))
    return 'Bu rolü atamak için yetkiniz yok'
  if (msg.includes('JWT') || msg.includes('invalid claim') || msg.includes('session_not_found'))
    return 'Oturum süreniz dolmuş, lütfen tekrar giriş yapın'
  if (msg.includes('fetch failed') || msg.includes('network') || msg.includes('ECONNREFUSED'))
    return 'Bağlantı hatası, lütfen tekrar deneyin'
  if (msg.includes('timeout'))
    return 'İstek zaman aşımına uğradı'

  return msg
}
