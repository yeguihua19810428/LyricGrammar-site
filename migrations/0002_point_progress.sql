-- Per-user mastery of one grammar point. user_id is TEXT (same as Better Auth
-- and the preview dev-user). No foreign key, so this table can exist even when
-- the opt-in auth schema has not been copied into migrations/.

create table if not exists point_progress (
  user_id text not null,
  point_id text not null,
  status text not null,
  fail_count integer not null default 0,
  last_sentence text,
  frame_passed boolean not null default false,
  updated_at timestamptz not null default CURRENT_TIMESTAMP,
  primary key (user_id, point_id)
);

create index if not exists point_progress_user_idx on point_progress (user_id);
