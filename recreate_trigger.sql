-- 删除现有触发器
DROP TRIGGER IF EXISTS trg_simple_lead_allocation ON public.leads;

-- 重新创建触发器
CREATE TRIGGER trg_simple_lead_allocation
AFTER INSERT ON public.leads
FOR EACH ROW
EXECUTE FUNCTION public.simple_lead_allocation_trigger();

-- 检查allocate_lead_simple函数
\df+ public.allocate_lead_simple
