import { supabase } from '../supaClient';

// 评分维度类型
export interface ScoringDimension {
  id: number;
  dimension_name: string;
  dimension_code: string;
  description: string | null;
  weight: number;
  sort_order: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

// 评分选项类型
export interface ScoringOption {
  id: number;
  dimension_code: string;
  option_code: string;
  option_text: string;
  score: number;
  sort_order: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

// 评分数据类型
export interface ScoringData {
  scoring_version: string;
  evaluator_id: number;
  evaluation_date: string;
  dimensions: {
    [key: string]: {
      selected_option: string;
      score: number;
      notes: string;
    };
  };
  calculation: {
    total_score: number;
    average_score: number;
    weighted_average: number;
  };
  metadata: {
    created_at: string;
    updated_at: string;
    evaluation_notes?: string;
  };
}

// 直播日程评分类型
export interface LiveStreamScheduleWithScoring {
  id: number;
  date: string;
  time_slot_id: string;
  created_by: number;
  average_score: number | null;
  scoring_status: string | null;
  scored_by: number | null;
  scored_at: string | null;
  scoring_data: ScoringData | null;
  evaluator_name?: string;
}

// 获取评分维度列表
export const getScoringDimensions = async (): Promise<ScoringDimension[]> => {
  try {
    const { data, error } = await supabase
      .from('live_stream_scoring_dimensions')
      .select('*')
      .eq('is_active', true)
      .order('sort_order');

    if (error) throw error;
    return data || [];
  } catch (error) {
    console.error('获取评分维度失败:', error);
    throw error;
  }
};

// 获取评分选项列表
export const getScoringOptions = async (): Promise<ScoringOption[]> => {
  try {
    const { data, error } = await supabase
      .from('live_stream_scoring_options')
      .select('*')
      .eq('is_active', true)
      .order('sort_order');

    if (error) throw error;
    return data || [];
  } catch (error) {
    console.error('获取评分选项失败:', error);
    throw error;
  }
};

// 获取直播日程评分信息
export const getLiveStreamScheduleScoring = async (scheduleId: number): Promise<LiveStreamScheduleWithScoring | null> => {
  try {
    const { data, error } = await supabase
      .from('live_stream_schedules')
      .select(`
        id,
        date,
        time_slot_id,
        created_by,
        average_score,
        scoring_status,
        scored_by,
        scored_at,
        scoring_data,
        users_profile!live_stream_schedules_scored_by_fkey(nickname)
      `)
      .eq('id', scheduleId)
      .single();

    if (error) throw error;
    
    if (data) {
      return {
        ...data,
        evaluator_name: (data.users_profile as any)?.nickname || null
      };
    }
    
    return null;
  } catch (error) {
    console.error('获取直播日程评分信息失败:', error);
    throw error;
  }
};

// 保存评分数据
export const saveScoringData = async (
  scheduleId: number, 
  scoringData: ScoringData, 
  evaluatorId: number
): Promise<boolean> => {
  try {
    console.log('API - 准备保存评分数据:', {
      scheduleId,
      evaluatorId,
      scoringData: JSON.stringify(scoringData, null, 2)
    });

    // 尝试清理和验证JSON数据，确保所有值都是基本类型
    const cleanedScoringData = {
      scoring_version: String(scoringData.scoring_version),
      evaluator_id: Number(scoringData.evaluator_id),
      evaluation_date: String(scoringData.evaluation_date),
      dimensions: Object.fromEntries(
        Object.entries(scoringData.dimensions).map(([key, value]) => [
          key,
          {
            selected_option: String(value.selected_option),
            score: Number(value.score),
            notes: String(value.notes)
          }
        ])
      ),
      calculation: {
        total_score: Number(scoringData.calculation.total_score),
        average_score: Number(scoringData.calculation.average_score),
        weighted_average: Number(scoringData.calculation.weighted_average)
      },
      metadata: {
        created_at: String(scoringData.metadata.created_at),
        updated_at: String(scoringData.metadata.updated_at),
        evaluation_notes: String(scoringData.metadata.evaluation_notes || '')
      }
    };

    // 确保JSON数据格式正确，使用字符串形式传递
    const jsonString = JSON.stringify(cleanedScoringData);
    console.log('API - JSON字符串:', jsonString);
    
    // 验证JSON格式
    try {
      JSON.parse(jsonString);
      console.log('API - JSON格式验证通过');
    } catch (error) {
      console.error('API - JSON格式验证失败:', error);
      throw new Error('JSON格式无效');
    }

    console.log('API - 清理后的评分数据:', JSON.stringify(cleanedScoringData, null, 2));

    // 直接使用Supabase更新，使用字符串形式的JSON
    const { error: scheduleError } = await supabase
      .from('live_stream_schedules')
      .update({
        scoring_data: jsonString,
        scored_by: evaluatorId,
        scored_at: new Date().toISOString(),
        average_score: cleanedScoringData.calculation.weighted_average,
        scoring_status: 'scored'
      })
      .eq('id', scheduleId);

    if (scheduleError) {
      console.error('API - 更新失败:', scheduleError);
      throw scheduleError;
    }

    console.log('API - 直接更新成功');

    console.log('API - 直播日程表更新成功');

    // 插入评分日志记录
    const { error: logError } = await supabase
      .from('live_stream_scoring_log')
      .insert({
        schedule_id: scheduleId,
        evaluator_id: evaluatorId,
        scoring_data: jsonString,
        average_score: cleanedScoringData.calculation.weighted_average,
        evaluation_notes: cleanedScoringData.metadata.evaluation_notes || null
      });

    if (logError) {
      console.error('API - 插入评分日志失败:', logError);
      throw logError;
    }

    console.log('API - 评分日志插入成功');
    return true;
  } catch (error) {
    console.error('保存评分数据失败:', error);
    throw error;
  }
};

// 更新评分状态
export const updateScoringStatus = async (
  scheduleId: number, 
  status: 'not_scored' | 'scoring_in_progress' | 'scored' | 'approved'
): Promise<boolean> => {
  try {
    const { error } = await supabase
      .from('live_stream_schedules')
      .update({
        scoring_status: status
      })
      .eq('id', scheduleId);

    if (error) throw error;
    return true;
  } catch (error) {
    console.error('更新评分状态失败:', error);
    throw error;
  }
};

// 获取评分历史
export const getScoringHistory = async (scheduleId: number): Promise<any[]> => {
  try {
    const { data, error } = await supabase
      .from('live_stream_scoring_log')
      .select(`
        *,
        users_profile!live_stream_scoring_log_evaluator_fkey(nickname)
      `)
      .eq('schedule_id', scheduleId)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data || [];
  } catch (error) {
    console.error('获取评分历史失败:', error);
    throw error;
  }
};

// 评分规则管理 API

// 创建评分维度
export const createScoringDimension = async (dimension: Omit<ScoringDimension, 'id' | 'created_at' | 'updated_at'>): Promise<ScoringDimension> => {
  try {
    const { data, error } = await supabase
      .from('live_stream_scoring_dimensions')
      .insert(dimension)
      .select()
      .single();

    if (error) throw error;
    return data;
  } catch (error) {
    console.error('创建评分维度失败:', error);
    throw error;
  }
};

// 更新评分维度
export const updateScoringDimension = async (id: number, updates: Partial<ScoringDimension>): Promise<ScoringDimension> => {
  try {
    const { data, error } = await supabase
      .from('live_stream_scoring_dimensions')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return data;
  } catch (error) {
    console.error('更新评分维度失败:', error);
    throw error;
  }
};

// 删除评分维度
export const deleteScoringDimension = async (id: number): Promise<boolean> => {
  try {
    const { error } = await supabase
      .from('live_stream_scoring_dimensions')
      .delete()
      .eq('id', id);

    if (error) throw error;
    return true;
  } catch (error) {
    console.error('删除评分维度失败:', error);
    throw error;
  }
};

// 创建评分选项
export const createScoringOption = async (option: Omit<ScoringOption, 'id' | 'created_at' | 'updated_at'>): Promise<ScoringOption> => {
  try {
    const { data, error } = await supabase
      .from('live_stream_scoring_options')
      .insert(option)
      .select()
      .single();

    if (error) throw error;
    return data;
  } catch (error) {
    console.error('创建评分选项失败:', error);
    throw error;
  }
};

// 更新评分选项
export const updateScoringOption = async (id: number, updates: Partial<ScoringOption>): Promise<ScoringOption> => {
  try {
    const { data, error } = await supabase
      .from('live_stream_scoring_options')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return data;
  } catch (error) {
    console.error('更新评分选项失败:', error);
    throw error;
  }
};

// 删除评分选项
export const deleteScoringOption = async (id: number): Promise<boolean> => {
  try {
    const { error } = await supabase
      .from('live_stream_scoring_options')
      .delete()
      .eq('id', id);

    if (error) throw error;
    return true;
  } catch (error) {
    console.error('删除评分选项失败:', error);
    throw error;
  }
}; 