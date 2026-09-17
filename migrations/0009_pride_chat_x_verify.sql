alter table pride_chat_profiles add column if not exists x_pending text not null default '';
alter table pride_chat_profiles add column if not exists x_code text not null default '';
alter table pride_chat_profiles add column if not exists x_verified boolean not null default false;

update pride_chat_profiles
set x_pending = case when x_handle <> '' then x_handle else x_pending end,
    x_handle = '',
    x_verified = false
where x_handle <> '' and not coalesce(x_verified, false);
