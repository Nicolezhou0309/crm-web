import { supabase } from '../supaClient';
import type { ScoringData, ScoringDimension, LiveStreamScheduleWithScoring } from '../types/scoring';

// 获取评分维度配置
export const getScoringDimensions = async (): Promise<ScoringDimension[]> => {
  try {
    // 模拟从数据库获取评分维度
    const mockDimensions: ScoringDimension[] = [
      {
        id: 1,
        dimension_name: '开播准备',
        dimension_code: 'preparation',
        selection_name: 'live_stream_preparation_options',
        description: '直播开始前的准备工作评分',
        weight: 1.0,
        sort_order: 1,
        is_active: true,
        options: [
          { code: 'no_delay', text: '开播即出镜开始讲解', score: 10.0 },
          { code: 'adjust_within_1min', text: '开播后适当调整，1分钟内开始讲解', score: 5.5 },
          { code: 'chat_over_1min', text: '开播后闲聊，1分钟内未开始讲解', score: 3.0 }
        ]
      },
      {
        id: 2,
        dimension_name: '直播状态',
        dimension_code: 'live_status',
        selection_name: 'live_stream_status_options',
        description: '直播过程中的状态表现评分',
        weight: 1.0,
        sort_order: 2,
        is_active: true,
        options: [
          { code: 'energetic', text: '进入直播间口播欢迎，状态饱满', score: 10.0 },
          { code: 'normal', text: '状态平淡无明显优点', score: 5.5 },
          { code: 'lazy', text: '态度懒散，说话无精打采', score: 0.0 }
        ]
      },
      {
        id: 3,
        dimension_name: '讲解话术',
        dimension_code: 'presentation',
        selection_name: 'live_stream_presentation_options',
        description: '直播讲解的话术质量评分',
        weight: 1.0,
        sort_order: 3,
        is_active: true,
        options: [
          { code: 'attractive', text: '话术流畅严谨有吸引力，讲解认真全面', score: 10.0 },
          { code: 'complete_but_rough', text: '每10分钟介绍一遍房间，介绍完整但不够严谨', score: 5.5 },
          { code: 'cold_field', text: '只读评论不介绍房间，冷场或聊天超过5分钟', score: 3.0 }
        ]
      },
      {
        id: 4,
        dimension_name: '出勤情况',
        dimension_code: 'attendance',
        selection_name: 'live_stream_attendance_options',
        description: '直播出勤和时长评分',
        weight: 1.0,
        sort_order: 4,
        is_active: true,
        options: [
          { code: 'on_time_full', text: '准时开播并播满120分钟，中途未离开', score: 9.0 },
          { code: 'delay_under_10min', text: '因上场拖延迟到，未满120分钟或中途缺席10分钟以内', score: 5.5 },
          { code: 'late_over_10min', text: '无故迟到或直播时长未满120分钟或中途缺席超过10分钟', score: 0.0 }
        ]
      },
      {
        id: 5,
        dimension_name: '运镜技巧',
        dimension_code: 'camera_skills',
        selection_name: 'live_stream_camera_options',
        description: '直播镜头运用技巧评分',
        weight: 1.0,
        sort_order: 5,
        is_active: true,
        options: [
          { code: 'beautiful', text: '构图美观横平竖直，人物居中运镜丝滑', score: 10.0 },
          { code: 'slightly_tilted', text: '构图略微倾斜，运镜轻微摇晃', score: 5.5 },
          { code: 'poor_angle', text: '人物长时间不在镜头，画面角度刁钻，运镜摇晃严重', score: 3.0 }
        ]
      }
    ];

    return mockDimensions;
  } catch (error) {
    console.error('获取评分维度失败:', error);
    throw error;
  }
};

// 获取直播日程的评分数据
export const getScoringData = async (scheduleId: number): Promise<ScoringData | null> => {
  try {
    const { data, error } = await supabase
      .from('live_stream_schedules')
      .select('scoring_data')
      .eq('id', scheduleId)
      .single();

    if (error) throw error;
    return data.scoring_data || null;
  } catch (error) {
    console.error('获取评分数据失败:', error);
    throw error;
  }
};

// 保存评分数据
export const saveScoringData = async (scheduleId: number, scoringData: ScoringData): Promise<void> => {
  try {
    const { error } = await supabase
      .from('live_stream_schedules')
      .update({
        scoring_data: scoringData,
        scoring_status: 'scored',
        scored_by: getCurrentUserId(),
        scored_at: new Date().toISOString()
      })
      .eq('id', scheduleId);

    if (error) throw error;
  } catch (error) {
    console.error('保存评分数据失败:', error);
    throw error;
  }
};

// 提交评分（审核通过）
export const submitScoring = async (scheduleId: number): Promise<void> => {
  try {
    const { error } = await supabase
      .from('live_stream_schedules')
      .update({
        scoring_status: 'approved'
      })
      .eq('id', scheduleId);

    if (error) throw error;
  } catch (error) {
    console.error('提交评分失败:', error);
    throw error;
  }
};

// 获取评分统计信息
export const getScoringStats = async (scheduleId: number) => {
  try {
    const { data, error } = await supabase
      .from('live_stream_schedules')
      .select('scoring_data')
      .eq('id', scheduleId)
      .single();

    if (error) throw error;
    
    if (!data.scoring_data?.calculation) {
      return { total_score: 0, average_score: 0, weighted_average: 0 };
    }
    
    return data.scoring_data.calculation;
  } catch (error) {
    console.error('获取评分统计失败:', error);
    throw error;
  }
};

// 获取已评分的直播列表
export const getScoredSchedules = async (): Promise<LiveStreamScheduleWithScoring[]> => {
  try {
    const { data, error } = await supabase
      .from('live_stream_schedules')
      .select('*')
      .in('scoring_status', ['scored', 'approved'])
      .order('scored_at', { ascending: false });

    if (error) throw error;
    return data || [];
  } catch (error) {
    console.error('获取已评分直播列表失败:', error);
    throw error;
  }
};

// 获取当前用户ID（模拟）
const getCurrentUserId = (): number => {
  // 这里应该从用户上下文或认证系统获取
  return 123;
}; 