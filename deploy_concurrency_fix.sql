-- =====================================
-- 并发控制优化部署脚本
-- 目标：解决广告系统API并发推送导致的重复分配问题
-- =====================================

-- 1. 删除旧触发器
DROP TRIGGER IF EXISTS trg_simple_lead_allocation ON public.leads;

-- 2. 应用优化后的触发器函数
-- (触发器函数已在sql-scripts/allocation/00_simplified_allocation.sql中更新)

-- 3. 重新创建触发器
CREATE TRIGGER trg_simple_lead_allocation
AFTER INSERT ON public.leads
FOR EACH ROW
EXECUTE FUNCTION simple_lead_allocation_trigger();

-- 4. 创建额外的索引优化并发查询
CREATE INDEX IF NOT EXISTS idx_leads_phone_wechat_concurrent 
ON leads(phone, wechat) 
WHERE phone IS NOT NULL OR wechat IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_leads_phone_created 
ON leads(phone, created_at) 
WHERE phone IS NOT NULL AND phone != '';

CREATE INDEX IF NOT EXISTS idx_leads_wechat_created 
ON leads(wechat, created_at) 
WHERE wechat IS NOT NULL AND wechat != '';

-- 5. 验证部署
SELECT 
    '并发控制优化部署完成' as status,
    '触发器已更新，包含advisory lock机制' as details,
    NOW() as deployment_time; 