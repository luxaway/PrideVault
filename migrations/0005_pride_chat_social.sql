create table if not exists pride_chat_profiles (
  address     text primary key,
  herotag     text not null default '',
  nick        text not null default '',
  herotag_at  timestamptz,
  nick_at     timestamptz,
  updated_at  timestamptz not null default now()
);
create unique index if not exists pride_chat_profiles_nick_idx
  on pride_chat_profiles (lower(nick))
  where nick <> '';

create table if not exists pride_chat_reactions (
  message_id  bigint not null,
  address     text not null,
  kind        text not null,
  created_at  timestamptz not null default now(),
  primary key (message_id, address, kind)
);
create index if not exists pride_chat_reactions_msg_idx on pride_chat_reactions (message_id);
