-- 添加删除策略
-- 允许删除直播安排
create policy "允许删除直播安排" 
on "public"."live_stream_schedules"
for delete
to authenticated
using (true); 