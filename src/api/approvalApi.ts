import { supabase, supabaseServiceRole } from '../supaClient';

// 审批实例查询参数接口
export interface ApprovalInstancesParams {
  page?: number;
  pageSize?: number;
  sortField?: string;
  sortOrder?: 'ASC' | 'DESC';
  statusFilter?: string[];
  targetIdFilter?: string;
  flowNameFilter?: string;
  creatorNameFilter?: string;
  dateFrom?: string;
  dateTo?: string;
}

// 审批实例响应接口
export interface ApprovalInstanceWithMetadata {
  id: string;
  flow_id: string;
  target_table: string;
  target_id: string;
  status: string;
  current_step: number;
  created_by: number;
  created_at: string;
  updated_at: string;
  flow_name: string;
  flow_type: string;
  creator_nickname: string;
  latest_action_time: string | null;
  approval_duration_minutes: number | null;
  pending_steps_count: number;
  total_steps_count: number;
}

// 审批统计接口
export interface ApprovalStatistics {
  total_instances: number;
  pending_instances: number;
  approved_instances: number;
  rejected_instances: number;
  avg_approval_duration_minutes: number | null;
}

// 用户审批统计接口
export interface UserApprovalStatistics {
  total_pending: number;
  total_approved: number;
  total_rejected: number;
  avg_response_time_minutes: number | null;
}

// 性能指标接口
export interface PerformanceMetric {
  metric_name: string;
  metric_value: number | null;
  description: string;
}

/**
 * 获取审批实例列表（后端排序）
 */
export async function getApprovalInstances(params: ApprovalInstancesParams = {}): Promise<{
  data: ApprovalInstanceWithMetadata[];
  total: number;
  error?: string;
}> {
  try {
    const {
      page = 1,
      pageSize = 10,
      sortField = 'created_at',
      sortOrder = 'DESC',
      statusFilter,
      targetIdFilter,
      flowNameFilter,
      creatorNameFilter,
      dateFrom,
      dateTo
    } = params;

    // 确保参数类型正确
    const rpcParams = {
      p_page: page,
      p_page_size: pageSize,
      p_sort_field: sortField,
      p_sort_order: sortOrder,
      p_status_filter: statusFilter || null,
      p_target_id_filter: targetIdFilter || null,
      p_flow_name_filter: flowNameFilter || null,
      p_creator_name_filter: creatorNameFilter || null,
      p_date_from: dateFrom || null,
      p_date_to: dateTo || null
    };


    // 并行获取数据和总数
    const [dataResult, countResult] = await Promise.all([
      supabase.rpc('get_approval_instances_with_sorting', rpcParams),
      supabase.rpc('get_approval_instances_count', {
        p_status_filter: statusFilter || null,
        p_target_id_filter: targetIdFilter || null,
        p_flow_name_filter: flowNameFilter || null,
        p_creator_name_filter: creatorNameFilter || null,
        p_date_from: dateFrom || null,
        p_date_to: dateTo || null
      })
    ]);


    if (dataResult.error) {
      console.error('获取审批实例失败:', dataResult.error);
      return { data: [], total: 0, error: dataResult.error.message };
    }

    if (countResult.error) {
      console.error('获取审批实例总数失败:', countResult.error);
      return { data: [], total: 0, error: countResult.error.message };
    }

    return {
      data: dataResult.data || [],
      total: countResult.data || 0
    };
  } catch (error) {
    console.error('获取审批实例异常:', error);
    return { data: [], total: 0, error: String(error) };
  }
}

/**
 * 获取审批统计信息
 */
export async function getApprovalStatistics(): Promise<{
  data: ApprovalStatistics | null;
  error?: string;
}> {
  try {
    const { data, error } = await supabase.rpc('get_approval_statistics');

    if (error) {
      console.error('获取审批统计失败:', error);
      return { data: null, error: error.message };
    }

    return { data: data?.[0] || null };
  } catch (error) {
    console.error('获取审批统计异常:', error);
    return { data: null, error: String(error) };
  }
}

/**
 * 获取用户审批统计信息
 */
export async function getUserApprovalStatistics(userId: number): Promise<{
  data: UserApprovalStatistics | null;
  error?: string;
}> {
  try {
    const { data, error } = await supabase.rpc('get_user_approval_statistics', {
      p_user_id: userId
    });

    if (error) {
      console.error('获取用户审批统计失败:', error);
      return { data: null, error: error.message };
    }

    return { data: data?.[0] || null };
  } catch (error) {
    console.error('获取用户审批统计异常:', error);
    return { data: null, error: String(error) };
  }
}

/**
 * 获取审批性能指标
 */
export async function getApprovalPerformanceMetrics(): Promise<{
  data: PerformanceMetric[];
  error?: string;
}> {
  try {
    const { data, error } = await supabase.rpc('get_approval_performance_metrics');

    if (error) {
      console.error('获取审批性能指标失败:', error);
      return { data: [], error: error.message };
    }

    return { data: data || [] };
  } catch (error) {
    console.error('获取审批性能指标异常:', error);
    return { data: [], error: String(error) };
  }
}

/**
 * 清理旧的审批数据
 */
export async function cleanupOldApprovalData(daysOld: number = 365): Promise<{
  deletedCount: number;
  error?: string;
}> {
  try {
    const { data, error } = await supabase.rpc('cleanup_old_approval_data', {
      p_days_old: daysOld
    });

    if (error) {
      console.error('清理旧审批数据失败:', error);
      return { deletedCount: 0, error: error.message };
    }

    return { deletedCount: data || 0 };
  } catch (error) {
    console.error('清理旧审批数据异常:', error);
    return { deletedCount: 0, error: String(error) };
  }
}

/**
 * 获取审批实例详情（包含步骤信息）
 */
export async function getApprovalInstanceDetail(instanceId: string): Promise<{
  data: any;
  error?: string;
}> {
  try {
    // 获取审批实例基本信息
    const { data: instance, error: instanceError } = await supabase
      .from('approval_instances')
      .select(`
        *,
        approval_flows!inner(name, type, config),
        users_profile!inner(nickname)
      `)
      .eq('id', instanceId)
      .single();

    if (instanceError) {
      console.error('获取审批实例详情失败:', instanceError);
      return { data: null, error: instanceError.message };
    }

    // 获取审批步骤信息
    const { data: steps, error: stepsError } = await supabase
      .from('approval_steps')
      .select(`
        *,
        users_profile!inner(nickname)
      `)
      .eq('instance_id', instanceId)
      .order('step_index', { ascending: true });

    if (stepsError) {
      console.error('获取审批步骤失败:', stepsError);
      return { data: null, error: stepsError.message };
    }

    return {
      data: {
        ...instance,
        approval_steps: steps || []
      }
    };
  } catch (error) {
    console.error('获取审批实例详情异常:', error);
    return { data: null, error: String(error) };
  }
}

/**
 * 审批操作（同意/拒绝）
 */
export async function approveStep(stepId: string, action: 'approved' | 'rejected', comment?: string): Promise<{
  success: boolean;
  error?: string;
}> {
  try {
    const updateData: any = {
      status: action,
      action_time: new Date().toISOString(),
    };
    
    if (comment !== undefined) {
      updateData.comment = comment;
    }

    // 首先获取审批步骤信息，以便后续处理业务逻辑
    // 使用服务角色密钥来绕过RLS策略
    const { data: stepData, error: stepError } = await supabaseServiceRole
      .from('approval_steps')
      .select(`
        *,
        approval_instances!inner(
          id,
          target_id,
          target_table,
          type,
          config,
          approval_flows!inner(type)
        )
      `)
      .eq('id', stepId)
      .single();

    if (stepError) {
      console.error('获取审批步骤信息失败:', stepError);
      return { success: false, error: stepError.message };
    }

    // 尝试通过简单的RPC函数更新审批步骤状态，避免触发有问题的触发器
    console.log('尝试通过简单RPC函数更新审批步骤...');
    try {
      const { data: rpcResult, error: rpcError } = await supabaseServiceRole.rpc('update_approval_step_simple', {
        p_step_id: stepId,
        p_status: action,
        p_comment: updateData.comment || null
      });
      
      if (rpcError) {
        console.log('安全RPC函数不存在，尝试原RPC函数:', rpcError.code);
        // 尝试使用原来的RPC函数
        try {
          const { data: oldRpcResult, error: oldRpcError } = await supabaseServiceRole.rpc('update_approval_step_status', {
            p_step_id: stepId,
            p_status: action,
            p_action_time: updateData.action_time,
            p_comment: updateData.comment || null
          });
          
          if (oldRpcError) {
            console.log('原RPC函数也不存在，尝试直接更新表:', oldRpcError.code);
            // 如果原RPC函数也不存在，回退到直接更新表
            const { error } = await supabaseServiceRole
              .from('approval_steps')
              .update(updateData)
              .eq('id', stepId);

            if (error) {
              console.error('审批操作失败:', error);
              return { success: false, error: error.message };
            }
          } else {
            console.log('✅ 通过原RPC函数更新审批步骤成功');
          }
        } catch (oldRpcException) {
          console.log('原RPC调用异常，尝试直接更新表:', oldRpcException);
          // 如果原RPC调用异常，回退到直接更新表
          const { error } = await supabaseServiceRole
            .from('approval_steps')
            .update(updateData)
            .eq('id', stepId);

          if (error) {
            console.error('审批操作失败:', error);
            return { success: false, error: error.message };
          }
        }
      } else {
        console.log('✅ 通过安全RPC函数更新审批步骤成功:', rpcResult);
      }
    } catch (rpcException) {
      console.log('安全RPC调用异常，尝试直接更新表:', rpcException);
      // 如果安全RPC调用异常，回退到直接更新表
      const { error } = await supabaseServiceRole
        .from('approval_steps')
        .update(updateData)
        .eq('id', stepId);

      if (error) {
        console.error('审批操作失败:', error);
        return { success: false, error: error.message };
      }
    }

    // 如果是审批通过，需要处理业务逻辑
    if (action === 'approved' && stepData) {
      const instance = stepData.approval_instances;
      const flowType = instance.approval_flows?.type;
      
      // 处理线索回退审批流
      if (flowType === 'lead_rollback' || instance.type === 'lead_rollback') {
        const result = await handleLeadRollbackBusinessLogic(instance);
        if (!result.success) {
          console.warn('线索回退业务逻辑处理失败:', result.error);
          // 注意：这里不返回错误，因为审批操作本身是成功的
        }
      }
    }

    return { success: true };
  } catch (error) {
    console.error('审批操作异常:', error);
    return { success: false, error: String(error) };
  }
}

/**
 * 处理线索回退业务逻辑
 * 解决 leadid 列引用歧义问题
 */
async function handleLeadRollbackBusinessLogic(instance: any): Promise<{
  success: boolean;
  error?: string;
}> {
  try {
    const leadid = instance.target_id;
    const applicantId = instance.created_by;
    const configData = instance.config || {};

    console.log('处理线索回退业务逻辑:', { leadid, applicantId, configData });

    // 1. 查询线索分配时的积分扣除记录
    // 使用服务角色密钥来绕过RLS策略
    const { data: pointsRecord, error: pointsError } = await supabaseServiceRole
      .from('user_points_transactions')
      .select('*')
      .eq('source_type', 'ALLOCATION_LEAD')
      .eq('source_id', leadid)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (pointsError && pointsError.code !== 'PGRST116') { // PGRST116 = 没有找到记录
      console.error('查询积分记录失败:', pointsError);
      return { success: false, error: pointsError.message };
    }

    // 2. 如果有积分扣除记录，进行积分返还
    if (pointsRecord && pointsRecord.points_change < 0) {
      const refundPoints = Math.abs(pointsRecord.points_change);
      console.log('返还积分:', refundPoints);

      // 更新用户积分钱包
      // 使用服务角色密钥来绕过RLS策略
      const { error: walletError } = await supabaseServiceRole
        .from('user_points_wallet')
        .update({
          total_points: supabaseServiceRole.sql`total_points + ${refundPoints}`,
          total_earned_points: supabaseServiceRole.sql`total_earned_points + ${refundPoints}`,
          updated_at: new Date().toISOString()
        })
        .eq('user_id', applicantId);

      if (walletError) {
        console.error('更新积分钱包失败:', walletError);
        return { success: false, error: walletError.message };
      }

      // 插入积分返还交易记录
      // 使用服务角色密钥来绕过RLS策略
      const { error: transactionError } = await supabaseServiceRole
        .from('user_points_transactions')
        .insert({
          user_id: applicantId,
          points_change: refundPoints,
          balance_after: supabaseServiceRole.sql`(SELECT total_points FROM user_points_wallet WHERE user_id = ${applicantId}) + ${refundPoints}`,
          transaction_type: 'EARN',
          source_type: 'ROLLBACK_REFUND',
          source_id: leadid,
          description: `线索回退返还积分：${leadid}`
        });

      if (transactionError) {
        console.error('插入积分返还记录失败:', transactionError);
        return { success: false, error: transactionError.message };
      }
    }

    // 3. 标记线索为无效 - 明确指定表别名，解决 leadid 列引用歧义
    // 使用服务角色密钥来绕过RLS策略
    const { error: followupsError } = await supabaseServiceRole
      .from('followups')
      .update({ invalid: true })
      .eq('leadid', leadid);

    if (followupsError) {
      console.error('更新跟进表失败:', followupsError);
      return { success: false, error: followupsError.message };
    }

    const { error: leadsError } = await supabaseServiceRole
      .from('leads')
      .update({ invalid: true })
      .eq('leadid', leadid);

    if (leadsError) {
      console.error('更新线索表失败:', leadsError);
      return { success: false, error: leadsError.message };
    }

    // 4. 记录操作日志
    try {
      // 使用服务角色密钥来绕过RLS策略
      await supabaseServiceRole
        .from('simple_allocation_logs')
        .insert({
          leadid: leadid,
          processing_details: {
            action: 'approval_business_action',
            approval_instance_id: instance.id,
            flow_type: 'lead_rollback',
            business_id: leadid,
            created_at: new Date().toISOString()
          }
        });
    } catch (logError) {
      console.warn('记录操作日志失败:', logError);
      // 不影响主要业务逻辑
    }

    console.log('线索回退业务逻辑处理完成');
    return { success: true };

  } catch (error) {
    console.error('处理线索回退业务逻辑异常:', error);
    return { success: false, error: String(error) };
  }
}

/**
 * 更新审批步骤批注
 */
export async function updateStepComment(stepId: string, comment: string): Promise<{
  success: boolean;
  error?: string;
}> {
  try {
    const { error } = await supabase
      .from('approval_steps')
      .update({ comment })
      .eq('id', stepId);

    if (error) {
      console.error('更新批注失败:', error);
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (error) {
    console.error('更新批注异常:', error);
    return { success: false, error: String(error) };
  }
} 