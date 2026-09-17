create table if not exists pride_chat_messages (
  id          bigserial primary key,
  address     text not null,
  mode        text not null default 'live',
  body        text not null,
  created_at  timestamptz not null default now()
);
create index if not exists pride_chat_messages_created_idx on pride_chat_messages (created_at desc);

create table if not exists pride_chat_presence (
  address     text primary key,
  token_hash  text not null,
  mode        text not null default 'live',
  last_post_at timestamptz,
  seen_at     timestamptz not null default now()
);
create index if not exists pride_chat_presence_seen_idx on pride_chat_presence (seen_at desc);
