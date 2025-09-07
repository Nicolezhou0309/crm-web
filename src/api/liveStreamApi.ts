import { supabase } from '../supaClient';
import type { 
  LiveStreamSchedule, 
  LiveStreamRegistration, 
  LiveStreamManager, 
  LiveStreamLocation, 
  LiveStreamPropertyType,
  TimeSlot
} from '../types/liveStream';

// 获取时间段列表（从数据库获取）
export const getTimeSlots = async (): Promise<TimeSlot[]> => {
  try {
    // 这里应该从数据库获取时间段配置
    // 暂时返回默认时间段，后续可以创建time_slots表
    return [
      {
        id: 'morning-10-12',
        startTime: '10:00',
        endTime: '12:00',
        period: 'morning',
        duration: 2
      },
      {
        id: 'afternoon-14-16',
        startTime: '14:00',
        endTime: '16:00',
        period: 'afternoon',
        duration: 2
      },
      {
        id: 'afternoon-16-18',
        startTime: '16:00',
        endTime: '18:00',
        period: 'afternoon',
        duration: 2
      },
      {
        id: 'evening-19-21',
        startTime: '19:00',
        endTime: '21:00',
        period: 'evening',
        duration: 2
      },
      {
        id: 'evening-21-23',
        startTime: '21:00',
        endTime: '23:00',
        period: 'evening',
        duration: 2
      }
    ];
  } catch (error) {
    console.error('获取时间段失败:', error);
    return [];
  }
};

// 获取直播管家列表（从users_profile表获取）
export const getLiveStreamManagers = async (): Promise<LiveStreamManager[]> => {
  try {
    const { data, error } = await supabase
      .from('users_profile')
      .select('id, nickname, email, status')
      .eq('status', 'active')
      .order('nickname');

    if (error) throw error;

    // 转换为前端需要的格式
    return (data || []).map(user => ({
      id: user.id.toString(),
      name: user.nickname || user.email,
      department: '', // 暂时为空，后续可以从organizations表获取
      avatar: undefined
    }));
  } catch (error) {
    console.error('获取直播管家失败:', error);
    return [];
  }
};

// 获取直播地点列表（从数据库获取）
export const getLiveStreamLocations = async (): Promise<LiveStreamLocation[]> => {
  try {
    // 这里应该从数据库获取地点配置
    // 暂时返回默认地点，后续可以创建locations表
    return [
      { id: 'location-1', name: '默认地点', address: '默认地址' }
    ];
  } catch (error) {
    console.error('获取直播地点失败:', error);
    return [];
  }
};

// 获取直播户型列表（从数据库获取）
export const getLiveStreamPropertyTypes = async (): Promise<LiveStreamPropertyType[]> => {
  try {
    // 这里应该从数据库获取户型配置
    // 暂时返回默认户型，后续可以创建property_types表
    return [
      { id: 'type-1', name: '默认户型', description: '默认户型描述' }
    ];
  } catch (error) {
    console.error('获取直播户型失败:', error);
    return [];
  }
};

// 获取所有直播安排
export const getWeeklySchedule = async (weekStart?: string, weekEnd?: string): Promise<LiveStreamSchedule[]> => {
  try {
    let query = supabase
      .from('live_stream_schedules')
      .select('*')
      .order('date, time_slot_id');
    
    // 如果提供了时间范围，则添加过滤条件
    if (weekStart && weekEnd) {
      query = query.gte('date', weekStart).lte('date', weekEnd);
    }
    
    const { data, error } = await query;

    if (error) throw error;

    // 获取所有参与者的详细信息
    const participantIds = new Set<number>();
    (data || []).forEach(schedule => {
      if (schedule.participant_ids && Array.isArray(schedule.participant_ids)) {
        schedule.participant_ids.forEach((id: number) => participantIds.add(id));
      }
    });

    let participantsMap = new Map();
    if (participantIds.size > 0) {
      const { data: participants, error: participantsError } = await supabase
        .from('users_profile')
        .select('id, nickname, email')
        .in('id', Array.from(participantIds));

      if (participantsError) throw participantsError;

      participantsMap = new Map(
        (participants || []).map(p => [p.id, p])
      );
    }

    // 调试：检查原始数据
    // const rawData = (data || []).slice(0, 3).map(schedule => ({
    //   id: schedule.id,
    //   average_score: schedule.average_score,
    //   average_score_type: typeof schedule.average_score,
    //   scoring_status: schedule.scoring_status,
    //   scored_at: schedule.scored_at,
    //   scoring_data: schedule.scoring_data
    // }));
    
    // 调试：检查转换后的数据
    // const convertedData = (data || []).map(schedule => {
    //   // 计算实际的average_score
    //   let actualAverageScore = null;
    //   if (schedule.scoring_data) {
    //     try {
    //       const scoringData = JSON.parse(schedule.scoring_data);
    //       if (scoringData.calculation && scoringData.calculation.weighted_average !== undefined) {
    //         actualAverageScore = Number(scoringData.calculation.weighted_average);
    //       }
    //     } catch (e) {
    //       console.warn('解析scoring_data失败:', e);
    //     }
    //   }
    //   if (actualAverageScore === null) {
    //     actualAverageScore = schedule.average_score !== null && schedule.average_score !== undefined && schedule.average_score !== '' ? Number(schedule.average_score) : null;
    //   }
    //   
    //   return {
    //     id: schedule.id,
    //     original_average_score: schedule.average_score,
    //     original_type: typeof schedule.average_score,
    //     scoring_data_has_weighted_average: schedule.scoring_data ? (() => {
    //       try {
    //         const scoringData = JSON.parse(schedule.scoring_data);
    //         return scoringData.calculation && scoringData.calculation.weighted_average !== undefined;
    //       } catch (e) {
    //         return false;
    //       }
    //     })() : false,
    //     weighted_average_from_scoring_data: schedule.scoring_data ? (() => {
    //       try {
    //         const scoringData = JSON.parse(schedule.scoring_data);
    //         return scoringData.calculation ? scoringData.calculation.weighted_average : null;
    //       } catch (e) {
    //         return null;
    //       }
    //     })() : null,
    //     converted_average_score: actualAverageScore,
    //     converted_type: typeof actualAverageScore
    //   };
    // });
    
    // 转换为前端需要的格式
    return (data || []).map(schedule => ({
      id: schedule.id.toString(),
      date: schedule.date,
      timeSlotId: schedule.time_slot_id,
      managers: (schedule.participant_ids && Array.isArray(schedule.participant_ids) ? schedule.participant_ids : []).map((id: number) => {
        const participant = participantsMap.get(id);
        return {
          id: id.toString(),
          name: participant ? (participant.nickname || participant.email) : '未知用户',
          department: '', // 暂时为空，后续可以从organizations表获取
          avatar: undefined
        };
      }),
      location: {
        id: schedule.location || 'default',
        name: schedule.location || ''
      },
      propertyType: {
        id: schedule.notes || '',
        name: schedule.notes || ''
      },
      status: schedule.status,
      createdAt: schedule.created_at,
      updatedAt: schedule.updated_at,
      createdBy: schedule.created_by, // 添加创建者ID
      // 添加并发控制相关字段
      editingBy: schedule.editing_by,
      editingAt: schedule.editing_at,
      editingExpiresAt: schedule.editing_expires_at,
      lockType: schedule.lock_type,
      lockReason: schedule.lock_reason,
      lockEndTime: schedule.lock_end_time,
      // 添加评分相关字段
      scoring_status: schedule.scoring_status || 'not_scored',
      // 从scoring_data中提取加权平均分，如果没有则使用average_score字段
      average_score: (() => {
        if (schedule.scoring_data) {
          try {
            const scoringData = JSON.parse(schedule.scoring_data);
            if (scoringData.calculation && scoringData.calculation.weighted_average !== undefined) {
              return Number(scoringData.calculation.weighted_average);
            }
          } catch (e) {
            console.warn('解析scoring_data失败:', e);
          }
        }
        return schedule.average_score !== null && schedule.average_score !== undefined && schedule.average_score !== '' ? Number(schedule.average_score) : null;
      })(),
      scored_by: schedule.scored_by || null,
      scored_at: schedule.scored_at || null,
      scoring_data: schedule.scoring_data || null,
    }));
  } catch (error) {
    console.error('获取直播安排失败:', error);
    return [];
  }
};

// 创建直播安排
export const createLiveStreamSchedule = async (schedule: Omit<LiveStreamSchedule, 'id' | 'createdAt' | 'updatedAt'>): Promise<LiveStreamSchedule> => {
  try {
    // 获取当前用户ID
          // 注意：这个函数在API层面，无法直接使用useUser Hook
      const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('用户未登录');

    const { data: userProfile, error: profileError } = await supabase
      .from('users_profile')
      .select('id')
      .eq('user_id', user.id)
      .single();

    if (profileError) throw profileError;

    const scheduleData = {
      date: schedule.date,
      time_slot_id: schedule.timeSlotId,
      participant_ids: schedule.managers && schedule.managers.length > 0 ? schedule.managers.map(m => parseInt(m.id)) : [],
      location: schedule.location?.name || null,
      notes: schedule.propertyType?.name || null,
      status: schedule.status || undefined, // 如果没有明确指定状态，使用数据库默认值
      created_by: userProfile.id,
      // 如果状态为editing，设置编辑者
      ...(schedule.status === 'editing' && {
        editing_by: userProfile.id,
        editing_at: new Date().toISOString(),
        editing_expires_at: new Date(Date.now() + 5 * 60 * 1000).toISOString() // 5分钟后过期
      })
    };

    const { data, error } = await supabase
      .from('live_stream_schedules')
      .insert(scheduleData)
      .select()
      .single();

    if (error) throw error;

    // 返回创建后的数据
    return {
      id: data.id.toString(),
      date: data.date,
      timeSlotId: data.time_slot_id,
      managers: schedule.managers,
      location: schedule.location,
      propertyType: schedule.propertyType,
      status: data.status,
      createdAt: data.created_at,
      updatedAt: data.updated_at,
      createdBy: data.created_by, // 添加创建者ID
      // 添加并发控制相关字段
      editingBy: data.editing_by,
      editingAt: data.editing_at,
      editingExpiresAt: data.editing_expires_at,
      lockType: data.lock_type,
      lockReason: data.lock_reason,
      lockEndTime: data.lock_end_time,
    };
  } catch (error) {
    console.error('创建直播安排失败:', error);
    throw error;
  }
};

// 更新直播安排
export const updateLiveStreamSchedule = async (
  scheduleId: string, 
  updates: Partial<LiveStreamSchedule>
): Promise<LiveStreamSchedule> => {
  try {
    
    const updateData: any = {};
    
    if (updates.managers) {
      // 将manager IDs转换为数字数组
      updateData.participant_ids = updates.managers.length > 0 ? updates.managers.map(m => parseInt(m.id)) : [];
    }
    if (updates.location) {
      updateData.location = updates.location.name || null;
    }
    if (updates.propertyType) {
      updateData.notes = updates.propertyType.name || null;
    }
    if (updates.status) {
      updateData.status = updates.status;
      
      // 如果状态变为editing，设置编辑者
      if (updates.status === 'editing') {
        // 获取当前用户ID
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          const { data: userProfile, error: profileError } = await supabase
            .from('users_profile')
            .select('id')
            .eq('user_id', user.id)
            .single();
          
          if (!profileError && userProfile) {
            updateData.editing_by = userProfile.id;
            updateData.editing_at = new Date().toISOString();
            updateData.editing_expires_at = new Date(Date.now() + 5 * 60 * 1000).toISOString(); // 5分钟后过期
          }
        }
      }
      
      // 如果状态变为booked，清除编辑者信息
      if (updates.status === 'booked') {
        updateData.editing_by = null;
        updateData.editing_at = null;
        updateData.editing_expires_at = null;
        
        // 确保participant_ids字段被正确更新
        if (updates.managers) {
          updateData.participant_ids = updates.managers.length > 0 ? updates.managers.map(m => parseInt(m.id)) : [];
        }
      }
    }


    const { data, error } = await supabase
      .from('live_stream_schedules')
      .update(updateData)
      .eq('id', parseInt(scheduleId))
      .select()
      .maybeSingle();

    if (error) {
      console.error('❌ 数据库更新失败:', error);
      throw error;
    }


    if (!data) {
      console.error('❌ 未找到要更新的直播安排');
      throw new Error('未找到要更新的直播安排');
    }


    // 获取更新后的完整数据，包括关联信息
    const { data: fullData, error: fullError } = await supabase
      .from('live_stream_schedules')
      .select('*')
      .eq('id', parseInt(scheduleId))
      .single();

    if (fullError) {
      console.error('❌ 获取完整数据失败:', fullError);
      throw fullError;
    }



    // 获取manager信息
    const participantIds = fullData.participant_ids || [];
    let managers: any[] = [];
    
    if (participantIds.length > 0) {

      const { data: participantData } = await supabase
        .from('users_profile')
        .select('id, nickname, email')
        .in('id', participantIds);
      
      managers = (participantData || []).map(p => ({
        id: p.id.toString(),
        name: p.nickname || p.email,
        department: '',
        avatar: undefined
      }));

    }

    const result = {
      id: fullData.id.toString(),
      date: fullData.date,
      timeSlotId: fullData.time_slot_id,
      managers: managers,
      location: { 
        id: fullData.location || 'default', 
        name: fullData.location || '' 
      },
      propertyType: { 
        id: fullData.notes || '', 
        name: fullData.notes || '' 
      },
      status: fullData.status,
      createdAt: fullData.created_at,
      updatedAt: fullData.updated_at,
      createdBy: fullData.created_by,
      editingBy: fullData.editing_by,
      editingAt: fullData.editing_at,
      editingExpiresAt: fullData.editing_expires_at,
      lockType: fullData.lock_type,
      lockReason: fullData.lock_reason,
      lockEndTime: fullData.lock_end_time,
    };


    
    return result;
  } catch (error) {
    console.error('❌ 更新直播安排失败:', error);
    throw error;
  }
};

// 删除直播安排（根据RLS策略，这个操作会被拒绝）
export const deleteLiveStreamSchedule = async (scheduleId: string): Promise<void> => {
  try {
    const { error } = await supabase
      .from('live_stream_schedules')
      .delete()
      .eq('id', parseInt(scheduleId));

    if (error) throw error;
  } catch (error) {
    console.error('删除直播安排失败:', error);
    throw error;
  }
};

// 获取统计数据
export const getLiveStreamStats = async (startDate: string, endDate: string) => {
  try {
    const { data, error } = await supabase
      .from('live_stream_schedules')
      .select('status')
      .gte('date', startDate)
      .lte('date', endDate);

    if (error) throw error;

    const schedules = data || [];
    const stats = {
      total: schedules.length,
      booked: schedules.filter(s => s.status === 'booked').length,
      available: schedules.filter(s => s.status === 'available').length,
      completed: schedules.filter(s => s.status === 'completed').length,
      cancelled: schedules.filter(s => s.status === 'cancelled').length,
    };

    return stats;
  } catch (error) {
    console.error('获取统计数据失败:', error);
    return {
      total: 0,
      booked: 0,
      available: 0,
      completed: 0,
      cancelled: 0,
    };
  }
};

// 检查时间段是否可报名
export const checkTimeSlotAvailability = async (date: string, timeSlotId: string): Promise<boolean> => {
  try {
    const { data, error } = await supabase
      .from('live_stream_schedules')
      .select('status')
      .eq('date', date)
      .eq('time_slot_id', timeSlotId)
      .single();

    if (error && error.code !== 'PGRST116') throw error; // PGRST116 表示没有找到记录

    return !data || data.status === 'available';
  } catch (error) {
    console.error('检查时间段可用性失败:', error);
    return true; // 出错时默认可用
  }
};

// 以下函数暂时保留，用于兼容性
export const createLiveStreamRegistration = async (_registration: Omit<LiveStreamRegistration, 'id' | 'createdAt' | 'updatedAt'>): Promise<LiveStreamRegistration> => {
  // 这个功能现在通过 createLiveStreamSchedule 实现
  throw new Error('此功能已废弃，请使用 createLiveStreamSchedule');
};

export const updateRegistrationStatus = async (
  _registrationId: string): Promise<LiveStreamRegistration> => {
  // 这个功能现在通过 updateLiveStreamSchedule 实现
  throw new Error('此功能已废弃，请使用 updateLiveStreamSchedule');
};

export const getUserRegistrations = async (_userId: string): Promise<LiveStreamRegistration[]> => {
  // 这个功能现在通过 getWeeklySchedule 实现
  throw new Error('此功能已废弃，请使用 getWeeklySchedule');
};

// 清理过期的编辑状态
export const cleanupExpiredEditingStatus = async (): Promise<void> => {
  try {
    console.log('🧹 [Cleanup] 开始清理过期的编辑状态');
    
    // 添加额外的时间缓冲，避免误清理刚过期的编辑
    const bufferTime = 30 * 1000; // 30秒缓冲时间
    const cutoffTime = new Date(Date.now() - bufferTime).toISOString();
    
    console.log('🧹 [Cleanup] 清理条件:', {
      status: 'editing',
      editing_expires_at_lt: cutoffTime,
      current_time: new Date().toISOString()
    });
    
    const { data, error } = await supabase
      .from('live_stream_schedules')
      .update({
        status: 'available',
        editing_by: null,
        editing_at: null,
        editing_expires_at: null
      })
      .eq('status', 'editing')
      .lt('editing_expires_at', new Date().toISOString())
      .select();

    if (error) {
      console.error('❌ 清理过期编辑状态失败:', error);
      throw error;
    }


  } catch (error) {
    console.error('❌ 清理过期编辑状态时发生异常:', error);
    throw error;
  }
};

// 筛选直播安排数据
export interface LiveStreamFilterParams {
  // 日期范围筛选
  dateRange?: {
    start: string;
    end: string;
  };
  
  // 时间段多选筛选
  timeSlots?: string[];
  
  // 状态多选筛选
  statuses?: string[];
  
  // 评分状态多选筛选
  scoringStatuses?: string[];
  
  // 评分范围筛选
  scoreRange?: {
    min: number;
    max: number;
  };
  
  // 锁定类型多选筛选
  lockTypes?: string[];
  
  // 参与人员筛选（支持模糊搜索）
  participants?: string[];
  
  // 评分人员筛选
  scoredBy?: number[];
  
  // 创建人员筛选
  createdBy?: number[];
  
  // 编辑人员筛选
  editingBy?: number[];
  
  // 地点筛选
  locations?: string[];
  
  // 分页参数
  page?: number;
  pageSize?: number;
}

export const getFilteredLiveStreamSchedules = async (filters: LiveStreamFilterParams): Promise<{
  data: LiveStreamSchedule[];
  total: number;
  page: number;
  pageSize: number;
}> => {
  try {
    // 调用数据库筛选函数
    const { data, error } = await supabase
      .rpc('get_filtered_live_stream_schedules', {
        p_date_range_start: filters.dateRange?.start || null,
        p_date_range_end: filters.dateRange?.end || null,
        p_time_slots: filters.timeSlots || null,
        p_statuses: filters.statuses || null,
        p_scoring_statuses: filters.scoringStatuses || null,
        p_score_min: filters.scoreRange?.min || null,
        p_score_max: filters.scoreRange?.max || null,
        p_lock_types: filters.lockTypes || null,
        p_participants: filters.participants || null,
        p_scored_by: filters.scoredBy || null,
        p_created_by: filters.createdBy || null,
        p_editing_by: filters.editingBy || null,
        p_locations: filters.locations || null,
        p_page: filters.page || 1,
        p_page_size: filters.pageSize || 10
      });

    if (error) throw error;

    // 获取所有参与者的详细信息
    const participantIds = new Set<number>();
    (data || []).forEach((schedule: any) => {
      if (schedule.participant_ids && Array.isArray(schedule.participant_ids)) {
        schedule.participant_ids.forEach((id: number) => participantIds.add(id));
      }
    });

    let participantsMap = new Map();
    if (participantIds.size > 0) {
      const { data: participants, error: participantsError } = await supabase
        .from('users_profile')
        .select('id, nickname, email')
        .in('id', Array.from(participantIds));

      if (participantsError) throw participantsError;

      participantsMap = new Map(
        (participants || []).map(p => [p.id, p])
      );
    }

    // 转换为前端需要的格式
    const formattedData = (data || []).map((schedule: any) => ({
      id: schedule.id.toString(),
      date: schedule.date,
      timeSlotId: schedule.time_slot_id,
      managers: (schedule.participant_ids && Array.isArray(schedule.participant_ids) ? schedule.participant_ids : []).map((id: number) => {
        const participant = participantsMap.get(id);
        return {
          id: id.toString(),
          name: participant ? (participant.nickname || participant.email) : '未知用户',
          department: '', // 暂时为空，后续可以从organizations表获取
          avatar: undefined
        };
      }),
      location: {
        id: schedule.location || 'default',
        name: schedule.location || ''
      },
      propertyType: {
        id: schedule.notes || '',
        name: schedule.notes || ''
      },
      status: schedule.status,
      createdAt: schedule.created_at,
      updatedAt: schedule.updated_at,
      createdBy: schedule.created_by,
      editingBy: schedule.editing_by,
      editingAt: schedule.editing_at,
      editingExpiresAt: schedule.editing_expires_at,
      lockType: schedule.lock_type,
      lockReason: schedule.lock_reason,
      lockEndTime: schedule.lock_end_time,
      // 评分相关字段
      scoring_status: schedule.scoring_status,
      average_score: schedule.average_score,
      scored_by: schedule.scored_by,
      scored_at: schedule.scored_at,
      scoring_data: schedule.scoring_data,
    }));

    // 从第一条记录获取总数
    const total = data && data.length > 0 ? data[0].total_count : 0;

    return {
      data: formattedData,
      total,
      page: filters.page || 1,
      pageSize: filters.pageSize || 10
    };
    
  } catch (error) {
    console.error('筛选直播安排失败:', error);
    return {
      data: [],
      total: 0,
      page: 1,
      pageSize: 10
    };
  }
};

// 简化的测试函数
export const testDatabaseFunction = async () => {
  try {
    
    const { data, error } = await supabase
      .rpc('get_filtered_live_stream_schedules_with_users', {
        p_page: 1,
        p_page_size: 5
      });

    if (error) {
      console.error('数据库函数测试失败:', error);
      return { success: false, error };
    }

    return { success: true, data };
    
  } catch (error) {
    console.error('测试函数异常:', error);
    return { success: false, error };
  }
};

// 优化版本的筛选函数（使用数据库JOIN）
export const getFilteredLiveStreamSchedulesOptimized = async (filters: LiveStreamFilterParams): Promise<{
  data: LiveStreamSchedule[];
  total: number;
  page: number;
  pageSize: number;
}> => {
  try {
    // 准备参数，确保类型正确
    const params: any = {
      p_page: filters.page || 1,
      p_page_size: filters.pageSize || 10
    };

    // 日期范围参数
    if (filters.dateRange?.start) {
      params.p_date_range_start = filters.dateRange.start;
    }
    if (filters.dateRange?.end) {
      params.p_date_range_end = filters.dateRange.end;
    }

    // 数组参数
    if (filters.timeSlots && filters.timeSlots.length > 0) {
      params.p_time_slots = filters.timeSlots;
    }
    if (filters.statuses && filters.statuses.length > 0) {
      params.p_statuses = filters.statuses;
    }
    if (filters.scoringStatuses && filters.scoringStatuses.length > 0) {
      params.p_scoring_statuses = filters.scoringStatuses;
    }
    if (filters.lockTypes && filters.lockTypes.length > 0) {
      params.p_lock_types = filters.lockTypes;
    }
    if (filters.participants && filters.participants.length > 0) {
      params.p_participants = filters.participants;
    }
    if (filters.scoredBy && filters.scoredBy.length > 0) {
      params.p_scored_by = filters.scoredBy;
    }
    if (filters.createdBy && filters.createdBy.length > 0) {
      params.p_created_by = filters.createdBy;
    }
    if (filters.editingBy && filters.editingBy.length > 0) {
      params.p_editing_by = filters.editingBy;
    }
    if (filters.locations && filters.locations.length > 0) {
      params.p_locations = filters.locations;
    }

    // 数值参数
    if (filters.scoreRange?.min !== undefined) {
      params.p_score_min = filters.scoreRange.min;
    }
    if (filters.scoreRange?.max !== undefined) {
      params.p_score_max = filters.scoreRange.max;
    }


    // 调用优化版本的数据库筛选函数
    const { data, error } = await supabase
      .rpc('get_filtered_live_stream_schedules_with_users', params);

    if (error) {
      console.error('数据库函数调用错误:', error);
      throw error;
    }


    // 转换为前端需要的格式（直接从数据库获取用户信息）
    const formattedData = (data || []).map((schedule: any) => ({
      id: schedule.id.toString(),
      date: schedule.date,
      timeSlotId: schedule.time_slot_id,
      managers: (schedule.participant_ids && Array.isArray(schedule.participant_ids) ? schedule.participant_ids : []).map((id: number, index: number) => {
        // 使用数据库返回的用户信息
        const name = schedule.participant_names && schedule.participant_names[index] 
          ? schedule.participant_names[index] 
          : (schedule.participant_emails && schedule.participant_emails[index] 
            ? schedule.participant_emails[index] 
            : '未知用户');
        return {
          id: id.toString(),
          name: name,
          department: '', // 暂时为空，后续可以从organizations表获取
          avatar: undefined
        };
      }),
      location: {
        id: schedule.location || 'default',
        name: schedule.location || ''
      },
      propertyType: {
        id: schedule.notes || '',
        name: schedule.notes || ''
      },
      status: schedule.status,
      createdAt: schedule.created_at,
      updatedAt: schedule.updated_at,
      createdBy: schedule.created_by,
      editingBy: schedule.editing_by,
      editingAt: schedule.editing_at,
      editingExpiresAt: schedule.editing_expires_at,
      lockType: schedule.lock_type,
      lockReason: schedule.lock_reason,
      lockEndTime: schedule.lock_end_time,
      // 评分相关字段
      scoring_status: schedule.scoring_status,
      average_score: schedule.average_score,
      scored_by: schedule.scored_by,
      scored_at: schedule.scored_at,
      scoring_data: schedule.scoring_data,
    }));

    // 从第一条记录获取总数
    const total = data && data.length > 0 ? data[0].total_count : 0;

    return {
      data: formattedData,
      total,
      page: filters.page || 1,
      pageSize: filters.pageSize || 10
    };
    
  } catch (error) {
    console.error('筛选直播安排失败:', error);
    return {
      data: [],
      total: 0,
      page: 1,
      pageSize: 10
    };
  }
};