alter table public.user_preferences
  add column if not exists theme text check (theme in ('dark', 'light')),
  add column if not exists accent_color text check (accent_color in ('purple', 'blue', 'green', 'orange', 'red', 'pink', 'slate')),
  add column if not exists reduce_motion boolean not null default false,
  add column if not exists compact_layout boolean not null default false;
