-- 通知模板表
create table if not exists notification_templates (
  id serial primary key,
  type text not null,
  title text not null,
  content text not null,
  metadata jsonb,
  is_active boolean default true,
  created_at timestamp with time zone default now()
); 