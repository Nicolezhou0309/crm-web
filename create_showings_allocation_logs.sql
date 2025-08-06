-- 创建带看分配日志表
CREATE TABLE public.showings_allocation_logs (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  community community NOT NULL,
  assigned_user_id bigint NULL,
  allocation_method text NULL, -- 'direct', 'skip', 'basic', 'assigned'
  queue_type text NULL, -- 'direct', 'skip', 'basic'
  processing_details jsonb NULL,
  created_at timestamp with time zone NULL DEFAULT now(),
  skip_card_consumed boolean NULL DEFAULT false,
  direct_card_consumed boolean NULL DEFAULT false,
  quality_check_passed boolean NULL,
  remark text NULL,
  CONSTRAINT showings_allocation_logs_pkey PRIMARY KEY (id)
) TABLESPACE pg_default;

-- 创建索引
CREATE INDEX IF NOT EXISTS idx_showings_allocation_logs_user_date ON public.showings_allocation_logs USING btree (assigned_user_id, created_at) TABLESPACE pg_default;

CREATE INDEX IF NOT EXISTS idx_showings_allocation_logs_community ON public.showings_allocation_logs USING btree (community) TABLESPACE pg_default;

CREATE INDEX IF NOT EXISTS idx_showings_allocation_logs_method ON public.showings_allocation_logs USING btree (allocation_method) TABLESPACE pg_default;

CREATE INDEX IF NOT EXISTS idx_showings_allocation_logs_queue_type ON public.showings_allocation_logs USING btree (queue_type) TABLESPACE pg_default;

CREATE INDEX IF NOT EXISTS idx_showings_allocation_logs_created_at ON public.showings_allocation_logs USING btree (created_at) TABLESPACE pg_default;

-- 添加表注释
COMMENT ON TABLE public.showings_allocation_logs IS '带看分配日志表，记录每次带看分配的执行情况';

-- 添加字段注释
COMMENT ON COLUMN public.showings_allocation_logs.id IS '日志记录唯一标识';
COMMENT ON COLUMN public.showings_allocation_logs.community IS '社区标识';
COMMENT ON COLUMN public.showings_allocation_logs.assigned_user_id IS '分配的带看人ID';
COMMENT ON COLUMN public.showings_allocation_logs.allocation_method IS '分配方法：direct(直通队列)、skip(轮空)、basic(基础队列)、assigned(指定人)';
COMMENT ON COLUMN public.showings_allocation_logs.queue_type IS '队列类型：direct(直通)、skip(轮空)、basic(基础)';
COMMENT ON COLUMN public.showings_allocation_logs.processing_details IS '处理详情JSON';
COMMENT ON COLUMN public.showings_allocation_logs.created_at IS '创建时间';
COMMENT ON COLUMN public.showings_allocation_logs.skip_card_consumed IS '是否消耗了轮空卡';
COMMENT ON COLUMN public.showings_allocation_logs.direct_card_consumed IS '是否消耗了直通卡';
COMMENT ON COLUMN public.showings_allocation_logs.quality_check_passed IS '质量控制是否通过';
COMMENT ON COLUMN public.showings_allocation_logs.remark IS '备注信息'; 