 // 直播报名系统类型定义

export interface LiveStreamManager {
    id: string;
    name: string;
    avatar?: string;
    department?: string;
  }
  
  export interface LiveStreamLocation {
    id: string;
    name: string;
    address?: string;
  }
  
  export interface LiveStreamPropertyType {
    id: string;
    name: string;
    description?: string;
  }
  
  export interface TimeSlot {
    id: string;
    startTime: string;
    endTime: string;
    period: 'morning' | 'afternoon' | 'evening';
    duration: number; // 持续时间（小时）
  }
  
  export interface LiveStreamSchedule {
    id: string;
    date: string; // YYYY-MM-DD格式
    timeSlotId: string;
    managers: LiveStreamManager[];
    location: LiveStreamLocation;
    propertyType: LiveStreamPropertyType;
    status: 'available' | 'booked' | 'completed' | 'cancelled' | 'editing' | 'locked';
    createdAt: string;
    updatedAt: string;
    createdBy?: number | null; // 记录创建者ID
    // 并发控制相关字段
    editingBy?: number | null;
    editingAt?: string | null;
    editingExpiresAt?: string | null;
    lockType?: 'none' | 'manual' | 'system' | 'maintenance';
    lockReason?: string | null;
    lockEndTime?: string | null;
    // 评分相关字段
    scoring_status?: 'not_scored' | 'scoring_in_progress' | 'scored' | 'approved';
    average_score?: number | null;
    scored_by?: number | null;
    scored_at?: string | null;
    scoring_data?: any;
  }
  
  export interface WeeklySchedule {
    weekStart: string; // 周开始日期 YYYY-MM-DD
    weekEnd: string;   // 周结束日期 YYYY-MM-DD
    schedules: LiveStreamSchedule[];
  }
  
  export interface LiveStreamRegistration {
    id: string;
    scheduleId: string;
    managerIds: string[];
    locationId: string;
    propertyTypeId: string;
    registrantId: string;
    status: 'pending' | 'approved' | 'rejected';
    createdAt: string;
    updatedAt: string;
  }