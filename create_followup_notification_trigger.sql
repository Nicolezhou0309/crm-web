-- =============================================
-- 新增followups记录时向interviewsales发送通知
-- 创建时间: 2024年12月
-- 适配现有notifications表结构
-- =============================================

BEGIN;

-- =============================================
-- 1. 创建通知函数（如果不存在）
-- =============================================

CREATE OR REPLACE FUNCTION create_notification(
  p_user_id bigint,
  p_type text,
  p_title text,
  p_content text,
  p_metadata jsonb DEFAULT NULL,
  p_priority integer DEFAULT 0
)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_notification_id uuid;
BEGIN
  INSERT INTO notifications (
    user_id, type, title, content, metadata, priority
  ) VALUES (
    p_user_id, p_type, p_title, p_content, p_metadata, p_priority
  ) RETURNING id INTO v_notification_id;
  
  RETURN v_notification_id;
END;
$$;

-- =============================================
-- 2. 创建followups通知触发器函数
-- =============================================

CREATE OR REPLACE FUNCTION notify_followup_assignment()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_user_nickname text;
  v_lead_phone text;
  v_lead_wechat text;
  v_lead_source text;
  v_lead_type text;
  v_notification_id uuid;
BEGIN
  -- 只在新增记录且有分配用户时发送通知
  IF TG_OP = 'INSERT' AND NEW.interviewsales_user_id IS NOT NULL THEN
    
    -- 获取用户昵称
    SELECT nickname INTO v_user_nickname
    FROM users_profile
    WHERE id = NEW.interviewsales_user_id;
    
    -- 获取线索信息
    SELECT phone, wechat, source, leadtype 
    INTO v_lead_phone, v_lead_wechat, v_lead_source, v_lead_type
    FROM leads
    WHERE leadid = NEW.leadid;
    
    -- 构建通知内容
    DECLARE
      v_title text := '新线索分配通知';
      v_content text;
      v_metadata jsonb;
    BEGIN
      -- 构建通知内容
      v_content := format('您有新的线索需要跟进：%s', NEW.leadid);
      
      -- 如果有客户联系方式，添加到内容中
      IF v_lead_phone IS NOT NULL OR v_lead_wechat IS NOT NULL THEN
        v_content := v_content || format(' (联系方式：%s)', 
          CASE 
            WHEN v_lead_phone IS NOT NULL AND v_lead_wechat IS NOT NULL 
              THEN format('电话：%s，微信：%s', v_lead_phone, v_lead_wechat)
            WHEN v_lead_phone IS NOT NULL 
              THEN format('电话：%s', v_lead_phone)
            ELSE format('微信：%s', v_lead_wechat)
          END
        );
      END IF;
      
      -- 构建元数据
      v_metadata := jsonb_build_object(
        'leadid', NEW.leadid,
        'leadtype', v_lead_type,
        'source', v_lead_source,
        'phone', v_lead_phone,
        'wechat', v_lead_wechat,
        'followupstage', NEW.followupstage,
        'assigned_user_id', NEW.interviewsales_user_id,
        'assigned_user_nickname', v_user_nickname,
        'created_at', NEW.created_at
      );
      
      -- 创建通知
      v_notification_id := create_notification(
        p_user_id := NEW.interviewsales_user_id,
        p_type := 'followup_assignment',
        p_title := v_title,
        p_content := v_content,
        p_metadata := v_metadata,
        p_priority := 1
      );
      
      -- 记录日志（可选）
      RAISE NOTICE '已为用户 % (ID: %) 创建followup分配通知，通知ID: %', 
        v_user_nickname, NEW.interviewsales_user_id, v_notification_id;
      
    END;
  END IF;
  
  RETURN NEW;
END;
$$;

-- =============================================
-- 3. 创建触发器
-- =============================================

-- 删除已存在的触发器（如果存在）
DROP TRIGGER IF EXISTS trg_notify_followup_assignment ON followups;

-- 创建新的触发器
CREATE TRIGGER trg_notify_followup_assignment
  AFTER INSERT ON followups
  FOR EACH ROW
  EXECUTE FUNCTION notify_followup_assignment();

-- =============================================
-- 4. 创建更新通知的触发器函数（当分配用户变更时）
-- =============================================

CREATE OR REPLACE FUNCTION notify_followup_reassignment()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_old_user_nickname text;
  v_new_user_nickname text;
  v_lead_phone text;
  v_lead_wechat text;
  v_lead_source text;
  v_lead_type text;
  v_notification_id uuid;
BEGIN
  -- 只在分配用户变更时发送通知
  IF TG_OP = 'UPDATE' AND 
     OLD.interviewsales_user_id IS DISTINCT FROM NEW.interviewsales_user_id AND
     NEW.interviewsales_user_id IS NOT NULL THEN
    
    -- 获取用户昵称
    SELECT nickname INTO v_old_user_nickname
    FROM users_profile
    WHERE id = OLD.interviewsales_user_id;
    
    SELECT nickname INTO v_new_user_nickname
    FROM users_profile
    WHERE id = NEW.interviewsales_user_id;
    
    -- 获取线索信息
    SELECT phone, wechat, source, leadtype 
    INTO v_lead_phone, v_lead_wechat, v_lead_source, v_lead_type
    FROM leads
    WHERE leadid = NEW.leadid;
    
    -- 构建通知内容
    DECLARE
      v_title text := '线索重新分配通知';
      v_content text;
      v_metadata jsonb;
    BEGIN
      -- 构建通知内容
      v_content := format('线索 %s 已重新分配给您', NEW.leadid);
      
      -- 如果有客户联系方式，添加到内容中
      IF v_lead_phone IS NOT NULL OR v_lead_wechat IS NOT NULL THEN
        v_content := v_content || format(' (联系方式：%s)', 
          CASE 
            WHEN v_lead_phone IS NOT NULL AND v_lead_wechat IS NOT NULL 
              THEN format('电话：%s，微信：%s', v_lead_phone, v_lead_wechat)
            WHEN v_lead_phone IS NOT NULL 
              THEN format('电话：%s', v_lead_phone)
            ELSE format('微信：%s', v_lead_wechat)
          END
        );
      END IF;
      
      -- 构建元数据
      v_metadata := jsonb_build_object(
        'leadid', NEW.leadid,
        'leadtype', v_lead_type,
        'source', v_lead_source,
        'phone', v_lead_phone,
        'wechat', v_lead_wechat,
        'followupstage', NEW.followupstage,
        'old_assigned_user_id', OLD.interviewsales_user_id,
        'old_assigned_user_nickname', v_old_user_nickname,
        'new_assigned_user_id', NEW.interviewsales_user_id,
        'new_assigned_user_nickname', v_new_user_nickname,
        'updated_at', NEW.updated_at
      );
      
      -- 创建通知
      v_notification_id := create_notification(
        p_user_id := NEW.interviewsales_user_id,
        p_type := 'followup_reassignment',
        p_title := v_title,
        p_content := v_content,
        p_metadata := v_metadata,
        p_priority := 2
      );
      
      -- 记录日志（可选）
      RAISE NOTICE '已为用户 % (ID: %) 创建followup重新分配通知，通知ID: %', 
        v_new_user_nickname, NEW.interviewsales_user_id, v_notification_id;
      
    END;
  END IF;
  
  RETURN NEW;
END;
$$;

-- =============================================
-- 5. 创建更新触发器
-- =============================================

-- 删除已存在的触发器（如果存在）
DROP TRIGGER IF EXISTS trg_notify_followup_reassignment ON followups;

-- 创建新的触发器
CREATE TRIGGER trg_notify_followup_reassignment
  AFTER UPDATE ON followups
  FOR EACH ROW
  EXECUTE FUNCTION notify_followup_reassignment();

-- =============================================
-- 6. 验证部署
-- =============================================

-- 验证触发器
SELECT '触发器验证:' as info;
SELECT 
  trigger_name,
  event_manipulation,
  action_timing,
  action_statement
FROM information_schema.triggers 
WHERE trigger_name LIKE '%followup%'
ORDER BY trigger_name;

-- 验证函数
SELECT '函数验证:' as info;
SELECT routine_name, routine_type 
FROM information_schema.routines 
WHERE routine_name LIKE '%followup%' OR routine_name LIKE '%notification%'
ORDER BY routine_name;

COMMIT;

-- =============================================
-- 7. 部署完成
-- =============================================

SELECT 'Followups通知触发器部署完成！' as status;
SELECT '现在当新增或更新followups记录时，会自动向对应的interviewsales用户发送通知' as message; 