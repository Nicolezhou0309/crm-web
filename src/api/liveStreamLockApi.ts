import { supabase } from '../supaClient';
import type { LiveStreamSchedule } from '../types/liveStream';

// 锁定直播场次
export const lockLiveStreamSchedule = async (
  scheduleId: string, 
  lockType: 'manual' | 'system' | 'maintenance',
  lockReason?: string,
  lockEndTime?: string
): Promise<LiveStreamSchedule> => {
  try {
    const updateData: any = {
      status: 'locked',
      lock_type: lockType,
      lock_reason: lockReason || null,
      lock_end_time: lockEndTime || null,
      updated_at: new Date().toISOString()
    };

    const { data, error } = await supabase
      .from('live_stream_schedules')
      .update(updateData)
      .eq('id', parseInt(scheduleId))
      .select('*')
      .single();

    if (error) throw error;

    // 转换数据格式
    const result: LiveStreamSchedule = {
      id: data.id.toString(),
      date: data.date,
      timeSlotId: data.time_slot_id,
      managers: data.participant_ids?.map((id: number) => ({
        id: id.toString(),
        name: `用户${id}`,
        department: '',
        avatar: undefined
      })) || [],
      location: {
        id: data.location || '',
        name: data.location || ''
      },
      propertyType: {
        id: data.notes || '',
        name: data.notes || ''
      },
      status: data.status as any,
      createdAt: data.created_at,
      updatedAt: data.updated_at,
      createdBy: data.created_by,
      editingBy: data.editing_by,
      editingAt: data.editing_at,
      editingExpiresAt: data.editing_expires_at,
      lockType: data.lock_type,
      lockReason: data.lock_reason,
      lockEndTime: data.lock_end_time,
    };

    return result;
  } catch (error) {
    console.error('锁定直播场次失败:', error);
    throw error;
  }
};

// 解锁直播场次
export const unlockLiveStreamSchedule = async (scheduleId: string): Promise<LiveStreamSchedule> => {
  try {
    const updateData: any = {
      status: 'available',
      lock_type: 'none',
      lock_reason: null,
      lock_end_time: null,
      updated_at: new Date().toISOString()
    };

    const { data, error } = await supabase
      .from('live_stream_schedules')
      .update(updateData)
      .eq('id', parseInt(scheduleId))
      .select('*')
      .single();

    if (error) throw error;

    // 转换数据格式
    const result: LiveStreamSchedule = {
      id: data.id.toString(),
      date: data.date,
      timeSlotId: data.time_slot_id,
      managers: data.participant_ids?.map((id: number) => ({
        id: id.toString(),
        name: `用户${id}`,
        department: '',
        avatar: undefined
      })) || [],
      location: {
        id: data.location || '',
        name: data.location || ''
      },
      propertyType: {
        id: data.notes || '',
        name: data.notes || ''
      },
      status: data.status as any,
      createdAt: data.created_at,
      updatedAt: data.updated_at,
      createdBy: data.created_by,
      editingBy: data.editing_by,
      editingAt: data.editing_at,
      editingExpiresAt: data.editing_expires_at,
      lockType: data.lock_type,
      lockReason: data.lock_reason,
      lockEndTime: data.lock_end_time,
    };

    return result;
  } catch (error) {
    console.error('解锁直播场次失败:', error);
    throw error;
  }
};
