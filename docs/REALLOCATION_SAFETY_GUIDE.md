# 线索重新分配安全指南

## 🎯 概述

本文档描述CRM系统中线索重新分配功能的安全机制和最佳实践，避免业务冲突和客户体验问题。

## ⚠️ 重新分配的潜在风险

### 1. 业务风险
- **客户关系断裂**：原管家已建立的客户关系被打断
- **信息丢失**：新管家不了解客户历史和偏好
- **客户困惑**：客户不理解为什么换了服务人员
- **重复联系**：新旧管家可能同时联系客户

### 2. 数据完整性风险
- **跟进记录分散**：同一客户的跟进记录分属不同销售
- **状态不一致**：原管家的跟进状态与重新分配后状态冲突

## 🛡️ 安全防护机制

### 1. 智能重复分配检测
```sql
-- 系统自动检测是否需要重新分配
IF target_user_id = current_user_id THEN
    RETURN '当前分配已是最优，无需调整';
END IF;
```

### 2. 完整的审计日志
```sql
-- 记录所有重新分配操作
INSERT INTO allocation_logs (
    leadid, 
    allocation_method,
    allocation_details  -- 包含原销售、新销售、原因等
);
```

### 3. 状态保护条件
```sql
-- 只对符合条件的线索进行重新分配
WHERE f.followupstage NOT IN ('赢单', '丢单')  -- 排除已结束的线索
  AND f.created_at >= NOW() - INTERVAL '7 days'  -- 仅限近期线索
```

## 📋 最佳实践建议

### 1. 重新分配前置条件
**建议的业务规则：**

#### 1.1 时间窗口限制
```sql
-- 只允许对新线索进行重新分配（如24小时内）
AND l.created_at >= NOW() - INTERVAL '24 hours'
```

#### 1.2 跟进状态限制
```sql
-- 只允许对未开始跟进的线索重新分配
AND f.followupstage IN ('待接收', '未联系')
```

#### 1.3 管家确认机制
```sql
-- 需要原管家确认同意转移
AND NOT EXISTS (
    SELECT 1 FROM followup_activities 
    WHERE leadid = p_leadid 
    AND created_at >= NOW() - INTERVAL '2 hours'
)
```

### 2. 通知机制
**重新分配时的通知流程：**

1. **通知原管家**：线索被重新分配
2. **通知新管家**：接收新线索，包含历史信息
3. **记录客户档案**：说明分配变更原因

### 3. 客户体验保护

#### 3.1 避免重复联系
```sql
-- 设置冷却期，避免新旧管家同时联系
UPDATE followups 
SET 
    interviewsales_user_id = target_user_id,
    followupstage = '待交接',  -- 设置交接状态
    reallocation_note = '社区匹配重新分配，等待交接'
WHERE leadid = p_leadid;
```

#### 3.2 客户说明机制
```
"您好，为了给您提供更专业的[社区名称]项目服务，
我们安排了该区域的专属顾问[新管家姓名]为您服务。"
```

## 🔧 推荐的改进实现

### 1. 增加安全检查函数
```sql
CREATE OR REPLACE FUNCTION can_reallocate_safely(
    p_leadid text,
    p_new_user_id bigint
) RETURNS jsonb
LANGUAGE plpgsql
AS $$
DECLARE
    lead_age interval;
    followup_count integer;
    last_contact timestamptz;
    current_stage text;
    result jsonb;
BEGIN
    -- 检查线索年龄
    SELECT 
        NOW() - l.created_at,
        f.followupstage,
        COUNT(fa.id),
        MAX(fa.created_at)
    INTO lead_age, current_stage, followup_count, last_contact
    FROM leads l
    LEFT JOIN followups f ON l.leadid = f.leadid
    LEFT JOIN followup_activities fa ON f.leadid = fa.leadid
    WHERE l.leadid = p_leadid
    GROUP BY l.created_at, f.followupstage;
    
    -- 安全性评估
    IF lead_age > INTERVAL '24 hours' THEN
        result := jsonb_build_object(
            'safe', false,
            'reason', '线索超过24小时，可能已建立客户关系'
        );
    ELSIF current_stage IN ('跟进中', '已预约', '看房中') THEN
        result := jsonb_build_object(
            'safe', false,
            'reason', '客户正在跟进流程中，不宜重新分配'
        );
    ELSIF followup_count > 3 THEN
        result := jsonb_build_object(
            'safe', false,
            'reason', '已有多次跟进记录，客户关系已建立'
        );
    ELSIF last_contact IS NOT NULL AND last_contact > NOW() - INTERVAL '2 hours' THEN
        result := jsonb_build_object(
            'safe', false,
            'reason', '近期有跟进活动，避免重复联系'
        );
    ELSE
        result := jsonb_build_object(
            'safe', true,
            'reason', '符合重新分配条件'
        );
    END IF;
    
    RETURN result;
END;
$$;
```

### 2. 改进重新分配函数
```sql
-- 在重新分配前进行安全检查
CREATE OR REPLACE FUNCTION reallocate_by_community_safe(
    p_leadid text,
    p_community community,
    p_force boolean DEFAULT false
) RETURNS jsonb
LANGUAGE plpgsql
AS $$
DECLARE
    safety_check jsonb;
    current_user_id bigint;
    target_user_id bigint;
BEGIN
    -- 安全性检查
    IF NOT p_force THEN
        SELECT can_reallocate_safely(p_leadid, NULL) INTO safety_check;
        
        IF NOT (safety_check->>'safe')::boolean THEN
            RETURN jsonb_build_object(
                'success', false,
                'error', '重新分配不安全',
                'reason', safety_check->>'reason',
                'suggestion', '请使用 force=true 强制执行或联系管理员'
            );
        END IF;
    END IF;
    
    -- 执行原有的重新分配逻辑
    RETURN reallocate_by_community(p_leadid, p_community);
END;
$$;
```

## 💡 总结建议

### 1. 立即实施
- ✅ **时间窗口限制**：只允许24小时内新线索重新分配
- ✅ **状态检查**：避免对已开始跟进的线索重新分配
- ✅ **通知机制**：确保原管家和新管家都收到通知

### 2. 中期完善
- 🔄 **客户确认**：对于重要客户，需要客户确认换管家
- 🔄 **交接流程**：建立标准化的管家交接流程
- 🔄 **客户说明模板**：标准化的重新分配说明话术

### 3. 长期优化
- 🚀 **智能分配**：初次分配时尽量准确，减少重新分配需求
- 🚀 **客户偏好学习**：系统学习客户偏好，优化分配算法
- 🚀 **业务规则引擎**：可配置的重新分配业务规则

**当前系统是安全的，但建议增加业务层面的保护机制！** 🛡️ 