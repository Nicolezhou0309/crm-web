import { supabase } from '../supaClient';

// 报名配置类型
export interface RegistrationConfig {
  id?: number;
  success: boolean;
  registration_open_time: string;
  registration_close_time: string;
  registration_open_day_of_week: number;
  registration_close_day_of_week: number;
  privilege_advance_open_time: string;
  privilege_advance_close_time: string;
  privilege_advance_open_day_of_week: number;
  privilege_advance_close_day_of_week: number;
  weekly_limit_per_user: number;
  privilege_advance_limit: number;
  privilege_managers: number[];
  is_active?: boolean;
  is_emergency_closed?: boolean;
}

// 用户限制检查结果类型
export interface UserLimitResult {
  success: boolean;
  is_privilege_user: boolean;
  user_weekly_count: number;
  weekly_limit: number;
  privilege_advance_limit: number;
  week_start: string;
  week_end: string;
  error?: string;
}

// 时间窗口检查结果
export interface TimeWindowResult {
  inNormalWindow: boolean;
  inPrivilegeWindow: boolean;
}

// 报名状态
export interface RegistrationStatus {
  canRegister: boolean;
  statusMessage: string;
  isPrivilegeUser: boolean;
  currentCount: number;
  limit: number;
  currentPrivilegeType: 'normal' | 'vip' | 'none'; // 当前使用的权益类型
}

export class LiveStreamRegistrationService {
  private static instance: LiveStreamRegistrationService;
  private configCache: RegistrationConfig | null = null;
  private configCacheTime: number = 0;
  private readonly CACHE_DURATION = 5 * 60 * 1000; // 5分钟缓存

  public static getInstance(): LiveStreamRegistrationService {
    if (!LiveStreamRegistrationService.instance) {
      LiveStreamRegistrationService.instance = new LiveStreamRegistrationService();
    }
    return LiveStreamRegistrationService.instance;
  }

  /**
   * 获取报名配置
   */
  async getRegistrationConfig(): Promise<RegistrationConfig | null> {
    const now = Date.now();
    
    // 检查缓存
    if (this.configCache && (now - this.configCacheTime) < this.CACHE_DURATION) {
      console.log('📋 [配置] 使用缓存配置，缓存时间:', new Date(this.configCacheTime).toLocaleString());
      return this.configCache;
    }

    console.log('🔍 [配置] 开始获取报名配置...');
    
    try {
      const { data, error } = await supabase
        .from('livestream_registration_config')
        .select('*')
        .eq('is_active', true)
        .eq('is_emergency_closed', false)
        .order('created_at', { ascending: false })
        .limit(1);
      
      if (error) {
        console.error('❌ [配置] 查询报名配置失败:', error);
        return null;
      }
      
      // 检查是否有数据
      if (!data || data.length === 0) {
        console.warn('⚠️ [配置] 未找到有效的报名配置，请检查数据库配置');
        return null;
      }
      
      const config = data[0];
      console.log('✅ [配置] 成功获取报名配置:');
      console.log('  📅 基础报名时间:', `周${config.registration_open_day_of_week} ${config.registration_open_time} - 周${config.registration_close_day_of_week} ${config.registration_close_time}`);
      console.log('  🎯 提前报名时间:', `周${config.privilege_advance_open_day_of_week} ${config.privilege_advance_open_time} - 周${config.privilege_advance_close_day_of_week} ${config.privilege_advance_close_time}`);
      console.log('  👥 VIP主播ID:', config.privilege_managers);
      console.log('  📊 基础用户每周限制:', config.weekly_limit_per_user);
      console.log('  🎯 提前报名每周限制:', config.privilege_advance_limit);
      console.log('  🚨 紧急关闭:', config.is_emergency_closed);
      console.log('  ⚡ 配置启用:', config.is_active);
      
      this.configCache = config;
      this.configCacheTime = now;
      return config;
    } catch (error) {
      console.error('❌ [配置] 获取报名配置失败:', error);
      return null;
    }
  }

  /**
   * 检查用户报名限制
   */
  async checkUserLimit(userId: number, currentPrivilegeType?: 'normal' | 'vip' | 'none'): Promise<UserLimitResult | null> {
    console.log(`🔍 [限制检查] 开始检查用户 ${userId} 的报名限制...`);
    
    try {
      // 获取配置
      const config = await this.getRegistrationConfig();
      if (!config) {
        console.warn(`⚠️ [限制检查] 用户 ${userId} 检查失败：报名配置未启用`);
        return {
          success: false,
          is_privilege_user: false,
          user_weekly_count: 0,
          weekly_limit: 0,
          privilege_advance_limit: 0,
          week_start: '',
          week_end: '',
          error: '报名配置未启用'
        };
      }

      // 计算本周开始和结束日期（自然周）- 使用北京时间
      const now = new Date();
      // 正确获取北京时间：UTC时间 + 8小时
      const beijingNow = new Date(now.getTime() + (8 * 60 * 60 * 1000));
      const weekStart = new Date(beijingNow);
      const dayOfWeek = beijingNow.getUTCDay() === 0 ? 7 : beijingNow.getUTCDay(); // 将周日转换为7
      weekStart.setUTCDate(beijingNow.getUTCDate() - dayOfWeek + 1); // 周一
      weekStart.setUTCHours(0, 0, 0, 0);
      
      const weekEnd = new Date(weekStart);
      weekEnd.setUTCDate(weekStart.getUTCDate() + 6); // 周日
      weekEnd.setUTCHours(23, 59, 59, 999);

      console.log(`📅 [限制检查] 本周时间范围: ${weekStart.toISOString().split('T')[0]} 到 ${weekEnd.toISOString().split('T')[0]}`);

      // 检查是否为VIP主播
      const isPrivilegeUser = config.privilege_managers.includes(userId);
      console.log(`👤 [限制检查] 用户 ${userId} 是否为VIP主播: ${isPrivilegeUser}`);

      // 统计用户本周报名数量 - 直接查询包含用户ID的记录
      console.log(`🔍 [限制检查] 开始查询用户 ${userId} 的报名记录...`);
      console.log(`📅 [限制检查] 查询条件:`, {
        status: 'booked',
        date_gte: weekStart.toISOString().split('T')[0],
        date_lte: weekEnd.toISOString().split('T')[0]
      });
      
      const { data: userSchedules, error } = await supabase
        .from('live_stream_schedules')
        .select('id, participant_ids, date, status, created_by')
        .eq('status', 'booked')
        .gte('date', weekStart.toISOString().split('T')[0])
        .lte('date', weekEnd.toISOString().split('T')[0]);

      if (error) {
        console.error(`❌ [限制检查] 查询用户 ${userId} 的报名记录失败:`, error);
        throw error;
      }

      console.log(`📊 [限制检查] 本周所有已报名记录数: ${userSchedules?.length || 0}`);
      if (userSchedules && userSchedules.length > 0) {
        console.log(`📋 [限制检查] 本周所有已报名记录详情:`, userSchedules.map(schedule => ({
          id: schedule.id,
          date: schedule.date,
          status: schedule.status,
          created_by: schedule.created_by,
          participant_ids: schedule.participant_ids
        })));
      }

      // 统计用户参与的场次数量
      const userParticipatedSchedules = userSchedules?.filter(schedule => 
        schedule.participant_ids && schedule.participant_ids.includes(userId)
      ) || [];
      
      const userWeeklyCount = userParticipatedSchedules.length;
      console.log(`✅ [限制检查] 用户 ${userId} 本周报名数量: ${userWeeklyCount}`);

      if (userParticipatedSchedules.length > 0) {
        console.log(`📝 [已报名场次] 用户 ${userId} 本周已报名的场次详情:`);
        userParticipatedSchedules.forEach((schedule, index) => {
          console.log(`  📅 场次 ${index + 1}:`);
          console.log(`    🆔 记录ID: ${schedule.id}`);
          console.log(`    👥 参与者: [${schedule.participant_ids.join(', ')}]`);
          console.log(`    📊 参与人数: ${schedule.participant_ids.length}人`);
          console.log(`    🎯 用户位置: 第${schedule.participant_ids.indexOf(userId) + 1}位`);
        });
        
        console.log(`📊 [已报名场次] 用户 ${userId} 报名统计:`);
        console.log(`  📈 总报名场次: ${userWeeklyCount}场`);
        console.log(`  👥 合作用户: ${[...new Set(userParticipatedSchedules.flatMap(s => s.participant_ids).filter(id => id !== userId))].join(', ') || '无'}`);
        console.log(`  🎯 主要位置: ${userParticipatedSchedules.filter(s => s.participant_ids[0] === userId).length}场作为主负责人`);
      } else {
        console.log(`📝 [已报名场次] 用户 ${userId} 本周尚未报名任何场次`);
      }

      // 确定限制数量 - 根据当前权益类型而不是用户身份
      let weeklyLimit: number;
      let limitType: string;
      
      if (currentPrivilegeType === 'vip') {
        // 使用VIP主播权益的限制
        weeklyLimit = config.privilege_advance_limit;
        limitType = 'VIP主播权益限制';
      } else if (currentPrivilegeType === 'normal') {
        // 使用基础权益的限制
        weeklyLimit = config.weekly_limit_per_user;
        limitType = '基础权益限制';
      } else {
        // 无权益时，使用基础限制作为默认值
        weeklyLimit = config.weekly_limit_per_user;
        limitType = '默认限制（无权益）';
      }
      
      console.log(`📊 [限制检查] 用户 ${userId} 每周限制: ${weeklyLimit} (${limitType})`);
      console.log(`🎯 [限制检查] 用户身份: ${isPrivilegeUser ? 'VIP主播' : '基础用户'}, 当前权益类型: ${currentPrivilegeType || '未指定'}`);

      const result = {
        success: userWeeklyCount < weeklyLimit,
        is_privilege_user: isPrivilegeUser,
        user_weekly_count: userWeeklyCount,
        weekly_limit: weeklyLimit,
        privilege_advance_limit: config.privilege_advance_limit,
        week_start: weekStart.toISOString().split('T')[0],
        week_end: weekEnd.toISOString().split('T')[0]
      };

      console.log(`🎯 [限制检查] 用户 ${userId} 检查结果:`, {
        可报名: result.success,
        当前数量: result.user_weekly_count,
        限制数量: result.weekly_limit,
        VIP主播: result.is_privilege_user
      });

      return result;
    } catch (error) {
      console.error(`❌ [限制检查] 检查用户 ${userId} 限制失败:`, error);
      return null;
    }
  }

  /**
   * 检查是否在报名时间窗口内
   */
  checkRegistrationWindow(config: RegistrationConfig): TimeWindowResult {
    console.log('🕐 [时间窗口] 开始检查报名时间窗口...');
    
    // 获取当前北京时间 - 使用正确的时区转换
    const now = new Date();
    const beijingTime = new Date(now.getTime() + (8 * 60 * 60 * 1000));
    
    const currentDay = beijingTime.getUTCDay() === 0 ? 7 : beijingTime.getUTCDay();
    const currentTime = `${beijingTime.getUTCHours().toString().padStart(2, '0')}:${beijingTime.getUTCMinutes().toString().padStart(2, '0')}:${beijingTime.getUTCSeconds().toString().padStart(2, '0')}`;
    
    console.log(`🕐 [时间窗口] 当前北京时间: 周${currentDay} ${currentTime}`);
    console.log(`📅 [时间窗口] 基础报名时间: 周${config.registration_open_day_of_week} ${config.registration_open_time} - 周${config.registration_close_day_of_week} ${config.registration_close_time}`);
    console.log(`🎯 [时间窗口] 提前报名时间: 周${config.privilege_advance_open_day_of_week} ${config.privilege_advance_open_time} - 周${config.privilege_advance_close_day_of_week} ${config.privilege_advance_close_time}`);
    
    // 检查基础报名时间窗口
    const inNormalWindow = this.checkTimeWindow(
      currentDay,
      currentTime,
      config.registration_open_day_of_week,
      config.registration_close_day_of_week,
      config.registration_open_time,
      config.registration_close_time
    );

    // 检查VIP主播提前报名时间窗口
    const inPrivilegeWindow = this.checkTimeWindow(
      currentDay,
      currentTime,
      config.privilege_advance_open_day_of_week,
      config.privilege_advance_close_day_of_week,
      config.privilege_advance_open_time,
      config.privilege_advance_close_time
    );

    console.log(`✅ [时间窗口] 检查结果: 基础窗口=${inNormalWindow}, VIP主播窗口=${inPrivilegeWindow}`);

    return { inNormalWindow, inPrivilegeWindow };
  }

  /**
   * 检查时间窗口的通用方法
   */
  private checkTimeWindow(
    currentDay: number,
    currentTime: string,
    openDay: number,
    closeDay: number,
    openTime: string,
    closeTime: string
  ): boolean {
    // 检查星期几
    if (openDay <= closeDay) {
      if (currentDay < openDay || currentDay > closeDay) {
        return false;
      }
    } else {
      if (currentDay < openDay && currentDay > closeDay) {
        return false;
      }
    }
    
    // 检查时间
    if (currentTime < openTime || currentTime > closeTime) {
      return false;
    }
    
    return true;
  }

  /**
   * 检查用户是否可以报名
   */
  canUserRegister(userLimitResult: UserLimitResult | null, config: RegistrationConfig | null): boolean {
    if (!userLimitResult || !config) return false;
    
    const { inNormalWindow, inPrivilegeWindow } = this.checkRegistrationWindow(config);
    
    // 基础用户：只能在基础报名时间窗口内报名
    if (!userLimitResult.is_privilege_user) {
      return inNormalWindow && userLimitResult.success;
    }
    
    // VIP主播：可以在基础报名时间窗口或VIP主播提前报名时间窗口内报名
    return (inNormalWindow || inPrivilegeWindow) && userLimitResult.success;
  }

  /**
   * 获取报名状态提示
   */
  getRegistrationStatusMessage(
    userLimitResult: UserLimitResult | null, 
    config: RegistrationConfig | null
  ): string {
    if (!userLimitResult || !config) return '';
    
    const { inNormalWindow, inPrivilegeWindow } = this.checkRegistrationWindow(config);
    
    if (userLimitResult.is_privilege_user) {
      if (inNormalWindow || inPrivilegeWindow) {
        return `可报名 (${userLimitResult.user_weekly_count}/${userLimitResult.weekly_limit})`;
      } else {
        return '报名已结束，修改请联系片区市场运营';
      }
    } else {
      if (inNormalWindow) {
        return `可报名 (${userLimitResult.user_weekly_count}/${userLimitResult.weekly_limit})`;
      } else {
        return '报名已结束，修改请联系片区市场运营';
      }
    }
  }

  /**
   * 根据时间自动判断用户当前应该使用的权益类型
   */
  getCurrentPrivilegeType(config: RegistrationConfig | null, isPrivilegeUser: boolean): 'normal' | 'vip' | 'none' {
    if (!config) {
      return 'none';
    }

    const { inNormalWindow, inPrivilegeWindow } = this.checkRegistrationWindow(config);
    
    // 如果用户在VIP主播列表中
    if (isPrivilegeUser) {
      if (inPrivilegeWindow && !inNormalWindow) {
        // 只在VIP主播时间窗口内
        return 'vip';
      } else if (inNormalWindow) {
        // 在基础报名时间窗口内（VIP主播也可以使用基础权益）
        return 'normal';
      } else {
        // 不在任何时间窗口内
        return 'none';
      }
    } else {
      // 基础用户
      if (inNormalWindow) {
        return 'normal';
      } else {
        return 'none';
      }
    }
  }

  /**
   * 获取完整的报名状态
   */
  async getRegistrationStatus(userId: number, isEditingExisting: boolean = false): Promise<RegistrationStatus> {
    // 先获取配置
    const config = await this.getRegistrationConfig();
    
    // 获取当前权益类型
    const currentPrivilegeType = this.getCurrentPrivilegeType(
      config, 
      config?.privilege_managers.includes(userId) || false
    );

    // 根据当前权益类型检查用户限制
    const userLimitResult = await this.checkUserLimit(userId, currentPrivilegeType);

    console.log(`🎯 [权益切换] 用户 ${userId} 当前权益类型: ${currentPrivilegeType}`);

    // 如果是编辑已报名场次，只检查时间窗口，不检查每周限制
    let canRegister: boolean;
    let statusMessage: string;
    
    if (isEditingExisting) {
      console.log('🔍 [报名状态] 编辑已报名场次，只检查时间窗口...');
      
      if (!config) {
        canRegister = false;
        statusMessage = '配置不可用，无法编辑';
      } else {
        const { inNormalWindow, inPrivilegeWindow } = this.checkRegistrationWindow(config);
        
        if (userLimitResult?.is_privilege_user) {
          canRegister = inNormalWindow || inPrivilegeWindow;
          statusMessage = canRegister ? '可编辑已报名场次' : '报名时间已截止，无法修改报名信息';
        } else {
          canRegister = inNormalWindow;
          statusMessage = canRegister ? '可编辑已报名场次' : '报名时间已截止，无法修改报名信息';
        }
      }
    } else {
      // 新报名的逻辑 - 根据当前权益类型判断
      if (currentPrivilegeType === 'none') {
        canRegister = false;
        statusMessage = '当前不在报名时间窗口内';
      } else if (currentPrivilegeType === 'vip') {
        // 使用VIP主播权益
        canRegister = userLimitResult?.success || false;
        statusMessage = `可报名 (${userLimitResult?.user_weekly_count || 0}/${userLimitResult?.weekly_limit || 0})`;
      } else if (currentPrivilegeType === 'normal') {
        // 使用基础权益
        canRegister = userLimitResult?.success || false;
        statusMessage = `可报名 (${userLimitResult?.user_weekly_count || 0}/${userLimitResult?.weekly_limit || 0})`;
      } else {
        // 无权益
        canRegister = false;
        statusMessage = '当前不在报名时间窗口内';
      }
    }

    return {
      canRegister,
      statusMessage,
      isPrivilegeUser: userLimitResult?.is_privilege_user || false,
      currentCount: userLimitResult?.user_weekly_count || 0,
      limit: userLimitResult?.weekly_limit || 0,
      currentPrivilegeType
    };
  }

  /**
   * 清除配置缓存
   */
  clearConfigCache(): void {
    this.configCache = null;
    this.configCacheTime = 0;
    console.log('🔄 已清除报名配置缓存');
  }

  /**
   * 检查报名日期是否在允许的范围内（本周和下周）
   */
  checkDateRange(scheduleDate: string): { isValid: boolean; message?: string } {
    console.log('📅 [日期范围检查] 开始检查报名日期范围...');
    
    try {
      // 获取当前北京时间
      const now = new Date();
      const beijingNow = new Date(now.getTime() + (8 * 60 * 60 * 1000));
      
      // 计算本周开始日期（周一）
      const currentWeekStart = new Date(beijingNow);
      const dayOfWeek = beijingNow.getUTCDay() === 0 ? 7 : beijingNow.getUTCDay();
      currentWeekStart.setUTCDate(beijingNow.getUTCDate() - dayOfWeek + 1);
      currentWeekStart.setUTCHours(0, 0, 0, 0);
      
      // 计算下周结束日期（周日）
      const nextWeekEnd = new Date(currentWeekStart);
      nextWeekEnd.setUTCDate(currentWeekStart.getUTCDate() + 13); // 本周7天 + 下周7天 - 1 = 13天
      nextWeekEnd.setUTCHours(23, 59, 59, 999);
      
      // 解析报名日期
      const targetDate = new Date(scheduleDate + 'T00:00:00.000Z');
      
      console.log('📅 [日期范围检查] 日期信息:');
      console.log('  当前北京时间:', beijingNow.toISOString().split('T')[0]);
      console.log('  本周开始:', currentWeekStart.toISOString().split('T')[0]);
      console.log('  下周结束:', nextWeekEnd.toISOString().split('T')[0]);
      console.log('  报名日期:', scheduleDate);
      
      // 检查日期是否在允许范围内
      const isValid = targetDate >= currentWeekStart && targetDate <= nextWeekEnd;
      
      if (!isValid) {
        const message = `只能报名本周和下周的场次，当前可报名日期范围：${currentWeekStart.toISOString().split('T')[0]} 至 ${nextWeekEnd.toISOString().split('T')[0]}`;
        console.warn('❌ [日期范围检查] 日期超出允许范围:', message);
        return { isValid: false, message };
      }
      
      console.log('✅ [日期范围检查] 日期在允许范围内');
      return { isValid: true };
      
    } catch (error) {
      console.error('❌ [日期范围检查] 检查失败:', error);
      return { isValid: false, message: '日期范围检查失败' };
    }
  }

  /**
   * 检查是否在报名截止时间前（可以取消报名）
   */
  canCancelRegistration(config: RegistrationConfig | null, isPrivilegeUser: boolean): boolean {
    console.log(`🔍 [取消检查] 开始检查是否可以取消报名，VIP主播: ${isPrivilegeUser}`);
    
    if (!config) {
      console.warn('⚠️ [取消检查] 配置为空，无法取消报名');
      return false;
    }
    
    // 获取当前北京时间 - 使用正确的时区转换
    const now = new Date();
    const beijingTime = new Date(now.getTime() + (8 * 60 * 60 * 1000));
    
    const currentDay = beijingTime.getUTCDay() === 0 ? 7 : beijingTime.getUTCDay();
    const currentTime = `${beijingTime.getUTCHours().toString().padStart(2, '0')}:${beijingTime.getUTCMinutes().toString().padStart(2, '0')}:${beijingTime.getUTCSeconds().toString().padStart(2, '0')}`;
    
    // 根据用户类型确定截止时间
    let closeDay: number;
    let closeTime: string;
    
    if (isPrivilegeUser) {
      closeDay = config.privilege_advance_close_day_of_week;
      closeTime = config.privilege_advance_close_time;
      console.log(`🎯 [取消检查] VIP主播截止时间: 周${closeDay} ${closeTime}`);
    } else {
      closeDay = config.registration_close_day_of_week;
      closeTime = config.registration_close_time;
      console.log(`📅 [取消检查] 基础用户截止时间: 周${closeDay} ${closeTime}`);
    }
    
    console.log(`🕐 [取消检查] 当前时间: 周${currentDay} ${currentTime}`);
    console.log(`🔍 [取消检查] 检查参数: 从周1 00:00:00 到 周${closeDay} ${closeTime}`);
    
    // 检查是否在截止时间前
    const canCancel = this.checkTimeWindow(
      currentDay,
      currentTime,
      1, // 从周一开始
      closeDay,
      '00:00:00', // 从凌晨开始
      closeTime
    );
    
    console.log(`✅ [取消检查] 是否可以取消报名: ${canCancel}`);
    
    return canCancel;
  }

  /**
   * 获取用户已报名场次的详细信息
   */
  async getUserRegisteredSchedules(userId: number): Promise<void> {
    console.log(`🔍 [已报名场次] 开始获取用户 ${userId} 的已报名场次详情...`);
    
    try {
      // 计算本周开始和结束日期（自然周）- 使用北京时间
      const now = new Date();
      // 正确获取北京时间：UTC时间 + 8小时
      const beijingNow = new Date(now.getTime() + (8 * 60 * 60 * 1000));
      const weekStart = new Date(beijingNow);
      const dayOfWeek = beijingNow.getUTCDay() === 0 ? 7 : beijingNow.getUTCDay();
      weekStart.setUTCDate(beijingNow.getUTCDate() - dayOfWeek + 1);
      weekStart.setUTCHours(0, 0, 0, 0);
      
      const weekEnd = new Date(weekStart);
      weekEnd.setUTCDate(weekStart.getUTCDate() + 6);
      weekEnd.setUTCHours(23, 59, 59, 999);
      
      console.log(`📅 [已报名场次] 查询时间范围: ${weekStart.toISOString().split('T')[0]} 到 ${weekEnd.toISOString().split('T')[0]}`);
      
      // 查询用户本周的所有报名记录（包括详细信息）
      const { data: userSchedules, error } = await supabase
        .from('live_stream_schedules')
        .select('id, date, time_slot_id, participant_ids, status, created_at, created_by')
        .eq('status', 'booked')
        .gte('date', weekStart.toISOString().split('T')[0])
        .lte('date', weekEnd.toISOString().split('T')[0])
        .order('date', { ascending: true });
      
      if (error) {
        console.error(`❌ [已报名场次] 查询用户 ${userId} 的报名记录失败:`, error);
        return;
      }
      
      // 过滤出用户参与的记录
      const userParticipatedSchedules = userSchedules?.filter(schedule => 
        schedule.participant_ids && schedule.participant_ids.includes(userId)
      ) || [];
      
      console.log(`📊 [已报名场次] 用户 ${userId} 本周已报名场次总数: ${userParticipatedSchedules.length}`);
      
      if (userParticipatedSchedules.length > 0) {
        console.log(`📝 [已报名场次] 详细场次信息:`);
        
        userParticipatedSchedules.forEach((schedule, index) => {
          const userPosition = schedule.participant_ids.indexOf(userId) + 1;
          const isMainResponsible = schedule.participant_ids[0] === userId;
          const partnerIds = schedule.participant_ids.filter((id: number) => id !== userId);
          
          console.log(`  📅 场次 ${index + 1}:`);
          console.log(`    🆔 记录ID: ${schedule.id}`);
          console.log(`    📅 日期: ${schedule.date}`);
          console.log(`    ⏰ 时间段ID: ${schedule.time_slot_id}`);
          console.log(`    👥 参与者: [${schedule.participant_ids.join(', ')}]`);
          console.log(`    🎯 用户位置: 第${userPosition}位 ${isMainResponsible ? '(主负责人)' : '(协助者)'}`);
          console.log(`    🤝 合作伙伴: ${partnerIds.length > 0 ? partnerIds.join(', ') : '无'}`);
          console.log(`    📊 参与人数: ${schedule.participant_ids.length}人`);
          console.log(`    👤 创建者: ${schedule.created_by}`);
          console.log(`    📅 创建时间: ${schedule.created_at}`);
        });
        
        // 统计信息
        const mainResponsibleCount = userParticipatedSchedules.filter(s => s.participant_ids[0] === userId).length;
        const assistantCount = userParticipatedSchedules.length - mainResponsibleCount;
        const allPartners = [...new Set(userParticipatedSchedules.flatMap(s => s.participant_ids).filter((id: number) => id !== userId))];
        
        console.log(`📊 [已报名场次] 用户 ${userId} 报名统计汇总:`);
        console.log(`  📈 总报名场次: ${userParticipatedSchedules.length}场`);
        console.log(`  🎯 主负责人: ${mainResponsibleCount}场`);
        console.log(`  🤝 协助者: ${assistantCount}场`);
        console.log(`  👥 合作过的用户: ${allPartners.length > 0 ? allPartners.join(', ') : '无'}`);
        console.log(`  📅 报名日期: ${userParticipatedSchedules.map(s => s.date).join(', ')}`);
      } else {
        console.log(`📝 [已报名场次] 用户 ${userId} 本周尚未报名任何场次`);
      }
      
    } catch (error) {
      console.error(`❌ [已报名场次] 获取用户 ${userId} 已报名场次失败:`, error);
    }
  }

  /**
   * 获取时间窗口信息
   */
  getTimeWindowInfo(config: RegistrationConfig | null): string {
    if (!config) return '';
    
    return `开放报名时间：周${config.registration_open_day_of_week}至周${config.registration_close_day_of_week} ${config.registration_open_time}-${config.registration_close_time} | 提前报名时间：周${config.privilege_advance_open_day_of_week}至周${config.privilege_advance_close_day_of_week} ${config.privilege_advance_open_time}-${config.privilege_advance_close_time}`;
  }



  /**
   * 测试权益切换时的场次限制（用于验证功能正确性）
   */
  async testPrivilegeSwitching(userId: number): Promise<{
    userIdentity: string;
    normalPrivilege: any;
    vipPrivilege: any;
    currentPrivilege: any;
  }> {
    console.log(`🧪 [测试] 开始测试用户 ${userId} 的权益切换...`);
    
    const config = await this.getRegistrationConfig();
    if (!config) {
      throw new Error('配置不可用');
    }

    const isPrivilegeUser = config.privilege_managers.includes(userId);
    const userIdentity = isPrivilegeUser ? 'VIP主播用户' : '基础用户';
    
    // 测试基础权益
    const normalResult = await this.checkUserLimit(userId, 'normal');
    
    // 测试VIP主播权益
    const vipResult = await this.checkUserLimit(userId, 'vip');
    
    // 获取当前实际权益
    const currentPrivilegeType = this.getCurrentPrivilegeType(config, isPrivilegeUser);
    const currentResult = await this.checkUserLimit(userId, currentPrivilegeType);
    
    const testResult = {
      userIdentity,
      normalPrivilege: {
        type: 'normal',
        limit: normalResult?.weekly_limit || 0,
        currentCount: normalResult?.user_weekly_count || 0,
        canRegister: normalResult?.success || false
      },
      vipPrivilege: {
        type: 'vip',
        limit: vipResult?.weekly_limit || 0,
        currentCount: vipResult?.user_weekly_count || 0,
        canRegister: vipResult?.success || false
      },
      currentPrivilege: {
        type: currentPrivilegeType,
        limit: currentResult?.weekly_limit || 0,
        currentCount: currentResult?.user_weekly_count || 0,
        canRegister: currentResult?.success || false
      }
    };
    
    console.log(`🧪 [测试] 用户 ${userId} 权益切换测试结果:`, testResult);
    
    return testResult;
  }

  /**
   * 获取当前时间窗口的详细状态（用于调试和验证）
   */
  getCurrentTimeWindowStatus(config: RegistrationConfig | null): {
    currentTime: string;
    currentDay: number;
    inNormalWindow: boolean;
    inPrivilegeWindow: boolean;
    privilegeType: 'normal' | 'vip' | 'none';
  } {
    if (!config) {
      return {
        currentTime: '',
        currentDay: 0,
        inNormalWindow: false,
        inPrivilegeWindow: false,
        privilegeType: 'none'
      };
    }

    // 获取当前北京时间
    const now = new Date();
    const beijingTime = new Date(now.getTime() + (8 * 60 * 60 * 1000));
    
    const currentDay = beijingTime.getUTCDay() === 0 ? 7 : beijingTime.getUTCDay();
    const currentTime = `${beijingTime.getUTCHours().toString().padStart(2, '0')}:${beijingTime.getUTCMinutes().toString().padStart(2, '0')}:${beijingTime.getUTCSeconds().toString().padStart(2, '0')}`;
    
    const { inNormalWindow, inPrivilegeWindow } = this.checkRegistrationWindow(config);
    
    // 模拟VIP主播用户来获取权益类型
    const currentPrivilegeType = this.getCurrentPrivilegeType(config, true);
    
    return {
      currentTime,
      currentDay,
      inNormalWindow,
      inPrivilegeWindow,
      privilegeType: currentPrivilegeType
    };
  }
}

// 导出单例实例
export const liveStreamRegistrationService = LiveStreamRegistrationService.getInstance();
