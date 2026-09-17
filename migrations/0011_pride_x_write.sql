create table if not exists pride_x_write (
  address text primary key,
  user_id text not null default '',
  access_token text not null,
  refresh_token text not null default '',
  token_expires timestamptz,
  scopes text not null default '',
  x_user_id text not null default '',
  updated_at timestamptz not null default now()
);

create table if not exists pride_x_oauth (
  state text primary key,
  verifier text not null,
  address text not null,
  chat_token_hash text not null,
  action text not null default 'like',
  tweet_id text not null default '',
  text_body text not null default '',
  redirect_uri text not null default '',
  created_at timestamptz not null default now()
);
