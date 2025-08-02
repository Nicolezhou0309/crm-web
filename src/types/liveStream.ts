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
  
  // 预设的时间段
  export const TIME_SLOTS: TimeSlot[] = [
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
  
  // 预设的直播管家数据
  export const SAMPLE_MANAGERS: LiveStreamManager[] = [
    { id: '1', name: '罗思思', department: '销售部' },
    { id: '2', name: '王梦雨', department: '销售部' },
    { id: '3', name: '张磊磊', department: '销售部' },
    { id: '4', name: '杨函颖', department: '销售部' },
    { id: '5', name: '李鹏飞', department: '销售部' },
    { id: '6', name: '张文雅', department: '销售部' },
    { id: '7', name: '樊繁', department: '销售部' },
    { id: '8', name: '王黎明', department: '销售部' },
  ];
  
  // 预设的直播地点
  export const SAMPLE_LOCATIONS: LiveStreamLocation[] = [
    { id: '1', name: '南京西路', address: '上海市静安区南京西路' },
    { id: '2', name: '静安寺', address: '上海市静安区静安寺' },
    { id: '3', name: '徐家汇', address: '上海市徐汇区徐家汇' },
    { id: '4', name: '人民广场', address: '上海市黄浦区人民广场' },
    { id: '5', name: '陆家嘴', address: '上海市浦东新区陆家嘴' },
    { id: '6', name: '汉中路', address: '上海市静安区汉中路' },
    { id: '7', name: '东方体育中心', address: '上海市浦东新区东方体育中心' },
    { id: '8', name: '大世界', address: '上海市黄浦区大世界' },
    { id: '9', name: '新天地', address: '上海市黄浦区新天地' },
    { id: '10', name: '中山公园', address: '上海市长宁区中山公园' },
    { id: '11', name: '南京东路', address: '上海市黄浦区南京东路' },
    { id: '12', name: '老西门', address: '上海市黄浦区老西门' },
  ];
  
  // 预设的直播户型
  export const SAMPLE_PROPERTY_TYPES: LiveStreamPropertyType[] = [
    { id: '1', name: '平层', description: '标准平层户型' },
    { id: '2', name: '钻石房', description: '钻石型户型' },
    { id: '3', name: 'LF两室', description: 'LF品牌两室户型' },
    { id: '4', name: 'LF外场+钻石房', description: 'LF外场展示加钻石房' },
    { id: '5', name: 'lv平层', description: 'LV品牌平层户型' },
    { id: '6', name: 'LF平层', description: 'LF品牌平层户型' },
    { id: '7', name: 'LV平层', description: 'LV品牌平层户型' },
  ];