/**
 * Her rol için canonical permission seti.
 * Gerçek DB'deki 48 izin sistemiyle uyumlu — mimari doc ile senkronize.
 * Rol hiyerarşisi: ogretmen ⊂ zumre_baskani ⊂ mudur_yardimcisi ⊂ mudur
 */

import type { GrantedPermission } from '@/src/domains/rbac/types'

// ─── Öğretmen: 17 izin ────────────────────────────────────────────────────────
// Temel öğretim izinleri — kendi kaynakları üzerinde write, okul genelinde read
export const OGRETMEN_PERMISSIONS: GrantedPermission[] = [
  // Ödev: kendi ödevlerini yazar, okul genelindeki ödevleri okur
  { resource: 'homework',   action: 'create', scope: 'own',    source: 'role' },
  { resource: 'homework',   action: 'read',   scope: 'school', source: 'role' },
  { resource: 'homework',   action: 'update', scope: 'own',    source: 'role' },
  { resource: 'homework',   action: 'delete', scope: 'own',    source: 'role' },

  // Yoklama: kendi aldığı yoklamaları yönetir
  { resource: 'attendance', action: 'create', scope: 'own',    source: 'role' },
  { resource: 'attendance', action: 'read',   scope: 'own',    source: 'role' },
  { resource: 'attendance', action: 'update', scope: 'own',    source: 'role' },

  // Müfredat: kendi ilerlemesini kaydeder, tüm sınıfların müfredatını okur
  { resource: 'curriculum', action: 'create', scope: 'own',    source: 'role' },
  { resource: 'curriculum', action: 'read',   scope: 'school', source: 'role' },
  { resource: 'curriculum', action: 'update', scope: 'own',    source: 'role' },

  // Öğrenci / Sınıf: sadece okuma
  { resource: 'students',   action: 'read',   scope: 'school', source: 'role' },
  { resource: 'students',   action: 'create', scope: 'school', source: 'role' }, // öğrenci ekleyebilir
  { resource: 'classes',    action: 'read',   scope: 'school', source: 'role' },

  // Export: kendi verisini dışa aktarır
  { resource: 'export',     action: 'create', scope: 'own',    source: 'role' },

  // Kişisel notlar: tam CRUD, sadece kendi notları
  { resource: 'notes',      action: 'create', scope: 'own',    source: 'role' },
  { resource: 'notes',      action: 'read',   scope: 'own',    source: 'role' },
  { resource: 'notes',      action: 'update', scope: 'own',    source: 'role' },
  { resource: 'notes',      action: 'delete', scope: 'own',    source: 'role' },
]

// ─── Zümre Başkanı: ~30 izin ──────────────────────────────────────────────────
// Öğretmen izinleri + zümre yönetimi + sınıf yazma + geniş ödev scope
export const ZUMRE_BASKANI_PERMISSIONS: GrantedPermission[] = [
  ...OGRETMEN_PERMISSIONS,

  // Zümre: tam CRUD — toplantı, tutanak, gündem
  { resource: 'zumre',      action: 'create', scope: 'school', source: 'role' },
  { resource: 'zumre',      action: 'read',   scope: 'school', source: 'role' },
  { resource: 'zumre',      action: 'update', scope: 'school', source: 'role' },
  { resource: 'zumre',      action: 'delete', scope: 'school', source: 'role' },
  { resource: 'zumre',      action: 'manage', scope: 'school', source: 'role' },

  // Sınav: ortak sınavları yönetir
  { resource: 'exam',       action: 'create', scope: 'school', source: 'role' },
  { resource: 'exam',       action: 'read',   scope: 'school', source: 'role' },
  { resource: 'exam',       action: 'update', scope: 'school', source: 'role' },
  { resource: 'exam',       action: 'delete', scope: 'school', source: 'role' },

  // Sınıf: oluşturabilir ve silebilir
  { resource: 'classes',    action: 'create', scope: 'school', source: 'role' },
  { resource: 'classes',    action: 'delete', scope: 'school', source: 'role' },

  // Ödev: tüm okul ödevlerini güncelleyebilir (zümre kapsamında)
  { resource: 'homework',   action: 'update', scope: 'school', source: 'role' },
]

// ─── Müdür Yardımcısı: ~42 izin ──────────────────────────────────────────────
// Zümre Başkanı izinleri + kullanıcı yönetimi + okul okuma + tüm müfredat
export const MUDUR_YARDIMCISI_PERMISSIONS: GrantedPermission[] = [
  ...ZUMRE_BASKANI_PERMISSIONS,

  // Kullanıcı: davet hariç tam yönetim (manage yetkisi yok)
  { resource: 'users',      action: 'create', scope: 'school', source: 'role' },
  { resource: 'users',      action: 'read',   scope: 'school', source: 'role' },
  { resource: 'users',      action: 'update', scope: 'school', source: 'role' },
  { resource: 'users',      action: 'delete', scope: 'school', source: 'role' },

  // Okul: okul bilgilerini okur
  { resource: 'school',     action: 'read',   scope: 'school', source: 'role' },

  // Müfredat: tüm öğretmenlerin müfredatını görebilir
  { resource: 'curriculum', action: 'update', scope: 'school', source: 'role' },

  // Devamsızlık: tüm yoklamaları görür
  { resource: 'attendance', action: 'read',   scope: 'school', source: 'role' },
]

// ─── Müdür: ~48 izin ─────────────────────────────────────────────────────────
// Müdür Yardımcısı izinleri + kullanıcı yönetimi + okul güncelleme + tam kontrol
export const MUDUR_PERMISSIONS: GrantedPermission[] = [
  ...MUDUR_YARDIMCISI_PERMISSIONS,

  // Kullanıcı: tam yönetim yetkisi (davet, silme, rol atama)
  { resource: 'users',      action: 'manage', scope: 'school', source: 'role' },

  // Okul: okul ayarlarını günceller ve yönetir
  { resource: 'school',     action: 'update', scope: 'school', source: 'role' },
  { resource: 'school',     action: 'manage', scope: 'school', source: 'role' },

  // Tüm veriye geniş okuma erişimi
  { resource: 'notes',      action: 'read',   scope: 'school', source: 'role' },
]

// ─── Lookup tablosu ──────────────────────────────────────────────────────────
export const ROLE_PERMISSIONS = {
  ogretmen:         OGRETMEN_PERMISSIONS,
  zumre_baskani:    ZUMRE_BASKANI_PERMISSIONS,
  mudur_yardimcisi: MUDUR_YARDIMCISI_PERMISSIONS,
  mudur:            MUDUR_PERMISSIONS,
} as const

export type MockRole = keyof typeof ROLE_PERMISSIONS
