-- ============================================================================
-- Vue 3 智能工作台 · Supabase 初始化脚本（第五阶段：用户系统 + 云同步）
--
-- 使用方式：
--   1. https://supabase.com 新建项目（免费额度够用）
--   2. 控制台 → SQL Editor → 新建查询 → 粘贴本文件 → Run
--   3. Authentication → Providers：打开 Email，如需 GitHub 登录再打开 GitHub 并填 OAuth App 的
--      Client ID / Secret（GitHub 侧回调地址填 https://<project>.supabase.co/auth/v1/callback）
--   4. 项目根目录 .env.local 写入 VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY
--
-- 本脚本可**重复执行**（全部语句幂等），改完策略再跑一次即可。
-- ============================================================================

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------------
-- 任务表
--   结构化查询字段单独成列（title / completed / sort_order），
--   其余扩展字段（priority / dueDate / completedAt / pinned / subtasks）进 payload jsonb，
--   以后加字段不用改表。
-- ---------------------------------------------------------------------------
create table if not exists public.todos (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users (id) on delete cascade,
  title       text not null default '',
  completed   boolean not null default false,
  payload     jsonb not null default '{}'::jsonb,
  -- 拖拽排序的顺序位：云端没有这一列，跨设备就还原不出用户手动排的顺序
  sort_order  integer not null default 0,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index if not exists todos_user_sort_idx on public.todos (user_id, sort_order);

-- updated_at 自动维护（前端不做时钟同步，交给数据库）
create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists todos_touch_updated_at on public.todos;
create trigger todos_touch_updated_at
  before update on public.todos
  for each row execute function public.touch_updated_at();

-- ---------------------------------------------------------------------------
-- 行级安全（RLS）：权限下沉到数据库层
--   前端只带 anon key（公开可见），越权读写完全由这里的策略拦住，
--   所以「anon key 泄露」也不等于数据泄露——这正是选 Supabase 的核心理由。
-- ---------------------------------------------------------------------------
alter table public.todos enable row level security;

drop policy if exists "todos: own rows only" on public.todos;
create policy "todos: own rows only"
  on public.todos
  for all
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- 表级权限（GRANT / REVOKE）
--   容易踩的坑：RLS 策略只负责「过滤行」，前提是角色**先有表级权限**。
--   创建项目时如果把「自动暴露新表」关掉（官方也建议关），Supabase 不会再把新表
--   自动授权给 Data API 角色，此时没有下面的 GRANT 会直接报
--   42501 permission denied（连 RLS 都走不到）。显式写出来，开/关都稳。
--
--   只授权给 authenticated：未登录（anon）连表权限都没有，等于多一层防护；
--   即使未来某条策略写错，anon 也读不到任何行。
-- ---------------------------------------------------------------------------
grant usage on schema public to anon, authenticated;
grant select, insert, update, delete on table public.todos to authenticated;
revoke all on table public.todos from anon;

-- ---------------------------------------------------------------------------
-- 头像 Storage：avatars bucket
--   公开读（头像要在 <img> 里直接引用），写入限本人目录 user_id/avatar.webp
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', true)
on conflict (id) do update set public = true;

drop policy if exists "avatars: public read" on storage.objects;
create policy "avatars: public read"
  on storage.objects
  for select
  using (bucket_id = 'avatars');

drop policy if exists "avatars: owner insert" on storage.objects;
create policy "avatars: owner insert"
  on storage.objects
  for insert
  to authenticated
  with check (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "avatars: owner update" on storage.objects;
create policy "avatars: owner update"
  on storage.objects
  for update
  to authenticated
  using (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  )
  with check (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "avatars: owner delete" on storage.objects;
create policy "avatars: owner delete"
  on storage.objects
  for delete
  to authenticated
  using (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- ============================================================================
-- 自检（跑完这一段直接在下方 Results 里看结果）
--   期望值：todos_table=1 · rls_enabled=true · todo_policies=1
--           avatar_bucket=1 · avatar_policies=4 · anon_can_read=false
--   任何一项不对就说明脚本没跑完（常见：只选中了前面一部分就点 Run）
-- ============================================================================
select
  (select count(*) from information_schema.tables
     where table_schema = 'public' and table_name = 'todos') as todos_table,
  (select relrowsecurity from pg_class
     where oid = 'public.todos'::regclass) as rls_enabled,
  (select count(*) from pg_policies
     where schemaname = 'public' and tablename = 'todos') as todo_policies,
  (select count(*) from storage.buckets where id = 'avatars') as avatar_bucket,
  (select count(*) from pg_policies
     where schemaname = 'storage' and tablename = 'objects'
       and policyname like 'avatars:%') as avatar_policies,
  -- 未登录角色应当连表权限都没有（revoke 生效）
  has_table_privilege('anon', 'public.todos', 'select') as anon_can_read;

