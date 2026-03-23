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

-- Placeholder users (Discord IDs to be updated with real ones)
insert into public.users (discord_id, name, role, area) values
  ('DISCORD_ID_JUAN_DAVID_V', 'Juan David V.', 'super_admin', 'Operaciones'),
  ('DISCORD_ID_NICO', 'Nico Barrera', 'ceo', 'General'),
  ('DISCORD_ID_JUAN_DAVID_L', 'Juan David L.', 'member', 'Soporte'),
  ('DISCORD_ID_STEVEN', 'Steven', 'member', 'Mentoria'),
  ('DISCORD_ID_ANDREA', 'Andrea', 'member', 'Contenido'),
  ('DISCORD_ID_DANIEL', 'Daniel', 'member', 'Edicion');
