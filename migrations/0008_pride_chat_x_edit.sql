alter table pride_chat_profiles add column if not exists x_handle text not null default '';
alter table pride_chat_profiles add column if not exists x_handle_at timestamptz;
create unique index if not exists pride_chat_profiles_x_handle_idx
  on pride_chat_profiles (lower(x_handle))
  where x_handle <> '';

alter table pride_chat_messages add column if not exists edited_at timestamptz;
alter table pride_chat_messages add column if not exists deleted_at timestamptz;
create index if not exists pride_chat_messages_deleted_idx
  on pride_chat_messages (deleted_at)
  where deleted_at is not null;
