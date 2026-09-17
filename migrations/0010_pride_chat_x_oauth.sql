alter table pride_chat_profiles add column if not exists x_user_id text not null default '';
create unique index if not exists pride_chat_profiles_x_user_id_idx
  on pride_chat_profiles (x_user_id)
  where x_user_id <> '';
