-- grades resource izinleri — öğretmen yazar, yöneticiler okur
-- Idempotent: ON CONFLICT DO NOTHING ile tekrar çalıştırılabilir

INSERT INTO permissions (id, resource, action, scope, description) VALUES
  (gen_random_uuid(), 'grades', 'create', 'own',    'Not defteri sütunu oluştur'),
  (gen_random_uuid(), 'grades', 'read',   'own',    'Kendi not defterini gör'),
  (gen_random_uuid(), 'grades', 'read',   'school', 'Tüm not defterlerini gör'),
  (gen_random_uuid(), 'grades', 'update', 'own',    'Kendi not defteri girişlerini güncelle'),
  (gen_random_uuid(), 'grades', 'delete', 'own',    'Kendi not defteri sütununu sil')
ON CONFLICT (resource, action, scope) DO NOTHING;

-- ogretmen + zumre_baskani: yazma (own) + okuma (own)
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
CROSS JOIN permissions p
WHERE p.resource = 'grades'
  AND p.action IN ('create', 'update', 'delete')
  AND p.scope = 'own'
  AND r.name IN ('ogretmen', 'zumre_baskani', 'mudur_yardimcisi', 'mudur')
ON CONFLICT DO NOTHING;

INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
CROSS JOIN permissions p
WHERE p.resource = 'grades'
  AND p.action = 'read'
  AND p.scope = 'own'
  AND r.name IN ('ogretmen', 'zumre_baskani', 'mudur_yardimcisi', 'mudur')
ON CONFLICT DO NOTHING;

-- zumre_baskani + mudur_yardimcisi + mudur: okul geneli okuma
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
CROSS JOIN permissions p
WHERE p.resource = 'grades'
  AND p.action = 'read'
  AND p.scope = 'school'
  AND r.name IN ('zumre_baskani', 'mudur_yardimcisi', 'mudur')
ON CONFLICT DO NOTHING;
