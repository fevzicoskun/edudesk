-- Ödev şablon desteği
alter table homeworks add column if not exists is_template boolean not null default false;

-- Şablonların due_date'i olmayabilir
alter table homeworks alter column due_date drop not null;

-- Şablonlar normal ödev sorgularından hariç tutulsun diye index
create index if not exists homeworks_is_template_idx on homeworks(is_template) where is_template = true;
