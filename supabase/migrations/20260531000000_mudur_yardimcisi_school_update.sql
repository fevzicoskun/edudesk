-- mudur_yardimcisi'na school:update izni ver (toplantı ekle/düzenle/sil için gerekli)
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
CROSS JOIN permissions p
WHERE r.name = 'mudur_yardimcisi'
  AND p.resource = 'school'
  AND p.action = 'update'
  AND p.scope = 'school'
ON CONFLICT DO NOTHING;
