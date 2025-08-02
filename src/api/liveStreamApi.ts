import { supabase } from '../supaClient';
import type { 
  LiveStreamSchedule, 
  LiveStreamRegistration, 
  LiveStreamManager, 
  LiveStreamLocation, 
  LiveStreamPropertyType,
  WeeklySchedule
} from '../types/liveStream';
import { 
  TIME_SLOTS,
  SAMPLE_MANAGERS,
  SAMPLE_LOCATIONS,
  SAMPLE_PROPERTY_TYPES
} from '../types/liveStream';

// 数据库类型定义
interface DBLiveStreamSchedule {
  id: number;
  date: string;
  time_slot_id: string;
  participant_ids: number[] | null;
  location: string | null;
  notes: string | null;
  status: 'available' | 'booked' | 'completed' | 'cancelled' | 'editing' | 'locked';
  created_by: number | null;
  created_at: string;
  updated_at: string;
  editing_by: number | null;
  editing_at: string | null;
  editing_expires_at: string | null;
  lock_type: 'none' | 'manual' | 'system' | 'maintenance';
  lock_reason: string | null;
  lock_end_time: string | null;
}

interface DBUserProfile {
  id: number;
  user_id: string;
  nickname: string;
  email: string;
  status: string;
}

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
        id: schedule.notes || 'default',
        name: schedule.notes || '默认户型'
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
      participant_ids: schedule.managers && schedule.managers.length > 0 ? schedule.managers.map(m => parseInt(m.id)) : null,
      location: schedule.location?.name || null,
      notes: schedule.propertyType?.name || null,
      status: schedule.status,
      created_by: userProfile.id,
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
    }

    const { data, error } = await supabase
      .from('live_stream_schedules')
      .update(updateData)
      .eq('id', parseInt(scheduleId))
      .select()
      .maybeSingle();

    if (error) throw error;
    if (!data) {
      throw new Error('未找到要更新的直播安排');
    }

    // 获取更新后的完整数据
    const updatedSchedule = await getWeeklySchedule(data.date, data.date);
    return updatedSchedule.find(s => s.id === scheduleId) || {
      id: data.id.toString(),
      date: data.date,
      timeSlotId: data.time_slot_id,
      managers: (data.participant_ids && Array.isArray(data.participant_ids) ? data.participant_ids : []).map((id: number) => ({
        id: id.toString(),
        name: '未知用户',
        department: '',
        avatar: undefined
      })),
      location: { id: data.location || 'default', name: data.location || '' },
      propertyType: { id: data.notes || 'default', name: data.notes || '默认户型' },
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
    console.error('更新直播安排失败:', error);
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
export const createLiveStreamRegistration = async (registration: Omit<LiveStreamRegistration, 'id' | 'createdAt' | 'updatedAt'>): Promise<LiveStreamRegistration> => {
  // 这个功能现在通过 createLiveStreamSchedule 实现
  throw new Error('此功能已废弃，请使用 createLiveStreamSchedule');
};

export const updateRegistrationStatus = async (
  registrationId: string, 
  status: 'pending' | 'approved' | 'rejected'
): Promise<LiveStreamRegistration> => {
  // 这个功能现在通过 updateLiveStreamSchedule 实现
  throw new Error('此功能已废弃，请使用 updateLiveStreamSchedule');
};

export const getUserRegistrations = async (userId: string): Promise<LiveStreamRegistration[]> => {
  // 这个功能现在通过 getWeeklySchedule 实现
  throw new Error('此功能已废弃，请使用 getWeeklySchedule');
};