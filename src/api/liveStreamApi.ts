import { supabase } from '../supaClient';
import type { 
  LiveStreamSchedule, 
  LiveStreamRegistration, 
  LiveStreamManager, 
  LiveStreamLocation, 
  LiveStreamPropertyType} from '../types/liveStream';
import { 
  SAMPLE_MANAGERS,
  SAMPLE_LOCATIONS,
  SAMPLE_PROPERTY_TYPES
} from '../types/liveStream';



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
    // 返回模拟数据作为fallback
    return SAMPLE_MANAGERS;
  }
};

// 获取直播地点列表（暂时使用模拟数据，后续可以创建locations表）
export const getLiveStreamLocations = async (): Promise<LiveStreamLocation[]> => {
  try {
    // 这里可以后续从数据库获取，现在先用模拟数据
    return SAMPLE_LOCATIONS;
  } catch (error) {
    console.error('获取直播地点失败:', error);
    return SAMPLE_LOCATIONS;
  }
};

// 获取直播户型列表（暂时使用模拟数据，后续可以创建property_types表）
export const getLiveStreamPropertyTypes = async (): Promise<LiveStreamPropertyType[]> => {
  try {
    // 这里可以后续从数据库获取，现在先用模拟数据
    return SAMPLE_PROPERTY_TYPES;
  } catch (error) {
    console.error('获取直播户型失败:', error);
    return SAMPLE_PROPERTY_TYPES;
  }
};

// 获取指定周的直播安排
export const getWeeklySchedule = async (weekStart: string, weekEnd: string): Promise<LiveStreamSchedule[]> => {
  try {
    const { data, error } = await supabase
      .from('live_stream_schedules')
      .select('*')
      .gte('date', weekStart)
      .lte('date', weekEnd)
      .order('date, time_slot_id');

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
      createdBy: schedule.created_by,
      editingBy: schedule.editing_by,
      editingAt: schedule.editing_at,
      editingExpiresAt: schedule.editing_expires_at,
      lockType: schedule.lock_type,
      lockReason: schedule.lock_reason,
      lockEndTime: schedule.lock_end_time,
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
    console.log('🔄 API: 开始更新直播安排');
    console.log('  - 记录ID:', scheduleId);
    console.log('  - 更新数据:', updates);
    console.log('  - 目标状态:', updates.status);
    
    const updateData: any = {};
    
    if (updates.managers) {
      // 将manager IDs转换为数字数组
      updateData.participant_ids = updates.managers.length > 0 ? updates.managers.map(m => parseInt(m.id)) : [];
      console.log('  - 参与者IDs:', updateData.participant_ids);
    }
    if (updates.location) {
      updateData.location = updates.location.name || null;
      console.log('  - 地点:', updateData.location);
    }
    if (updates.propertyType) {
      updateData.notes = updates.propertyType.name || null;
      console.log('  - 户型:', updateData.notes);
    }
    if (updates.status) {
      updateData.status = updates.status;
      console.log('  - 状态:', updateData.status);
      
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
            console.log('  - 设置编辑者:', userProfile.id);
          }
        }
      }
      
      // 如果状态变为booked，清除编辑者信息
      if (updates.status === 'booked') {
        updateData.editing_by = null;
        updateData.editing_at = null;
        updateData.editing_expires_at = null;
        console.log('  - 清除编辑者信息（完成编辑）');
      }
    }

    console.log('📊 准备更新到数据库的数据:', updateData);

    const { data, error } = await supabase
      .from('live_stream_schedules')
      .update(updateData)
      .eq('id', scheduleId)
      .select()
      .maybeSingle();

    if (error) {
      console.error('❌ 数据库更新失败:', error);
      throw error;
    }
    
    console.log('✅ 数据库更新成功');
    console.log('  - 更新结果:', data);
    
    if (!data) {
      console.error('❌ 未找到要更新的直播安排');
      throw new Error('未找到要更新的直播安排');
    }

    console.log('🔄 获取更新后的完整数据');
    // 获取更新后的完整数据，包括关联信息
    const { data: fullData, error: fullError } = await supabase
      .from('live_stream_schedules')
      .select('*')
      .eq('id', scheduleId)
      .single();

    if (fullError) {
      console.error('❌ 获取完整数据失败:', fullError);
      throw fullError;
    }

    console.log('✅ 获取完整数据成功');
    console.log('  - 完整数据:', fullData);
    console.log('  - 数据库中的状态:', fullData.status);

    // 获取manager信息
    const participantIds = fullData.participant_ids || [];
    let managers: any[] = [];
    
    if (participantIds.length > 0) {
      console.log('🔄 获取参与者信息');
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
      console.log('  - 参与者信息:', managers);
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

    console.log('✅ API返回结果:');
    console.log('  - 最终状态:', result.status);
    console.log('  - 完整结果:', result);
    
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
    console.log('🧹 开始清理过期的编辑状态');
    
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

    console.log('✅ 清理过期编辑状态成功，清理记录数:', data?.length || 0);
  } catch (error) {
    console.error('❌ 清理过期编辑状态时发生异常:', error);
    throw error;
  }
};