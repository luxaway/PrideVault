alter table pride_chat_messages add column if not exists sale text;

create table if not exists pride_chat_sales (
  hash     text primary key,
  qty      integer not null,
  egld     text not null,
  buyer    text not null,
  seen_at  timestamptz not null default now()
);
