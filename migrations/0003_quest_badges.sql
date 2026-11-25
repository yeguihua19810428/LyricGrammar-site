-- Light quest badges per login account. Same user_id text as point_progress.

create table if not exists quest_badges (
  user_id text not null,
  badge_id text not null,
  earned_at timestamptz not null default CURRENT_TIMESTAMP,
  primary key (user_id, badge_id)
);

create index if not exists quest_badges_user_idx on quest_badges (user_id);
