-- =============================================================================
-- Mind Fuel Team — Seed Data
-- =============================================================================

-- Default categories
insert into public.task_categories (name, color, is_default) values
  ('Contenido', '#e91e63', true),
  ('Edicion', '#9c27b0', true),
  ('Soporte', '#2196f3', true),
  ('Mentoria', '#ff9800', true),
  ('Operaciones', '#00e676', true),
  ('General', '#607d8b', true);

-- Team members with real Discord IDs
insert into public.users (discord_id, name, role, area) values
  ('690169879105634314', 'Juan David V.', 'super_admin', 'Operaciones'),
  ('1337429420683563070', 'Nico Barrera', 'ceo', 'General'),
  ('1333969040720527363', 'Juan David L.', 'member', 'Soporte'),
  ('664964567117332511', 'Steven', 'member', 'Mentoria'),
  ('1425676008643629178', 'Andrea', 'member', 'Contenido'),
  ('1253554122444116044', 'Daniel', 'member', 'Edicion');
