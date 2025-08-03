import { supabase } from '../supaClient';

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

    const { error } = await supabase
      .from('approval_steps')
      .update(updateData)
      .eq('id', stepId);

    if (error) {
      console.error('审批操作失败:', error);
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (error) {
    console.error('审批操作异常:', error);
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