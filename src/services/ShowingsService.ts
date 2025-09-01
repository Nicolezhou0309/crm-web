import { supabase } from '../supaClient';
import dayjs from 'dayjs';
import { message } from 'antd';
import imageCompression from 'browser-image-compression';
import { toBeijingTime } from '../utils/timeUtils';
import type { Showing, ShowingFilters } from '../api/showingsApi';

// 带看记录类型（包含关联信息）
export interface ShowingWithRelations {
  id: string;
  leadid: string;
  scheduletime: string | null;
  community: string | null;
  arrivaltime: string | null;
  showingsales: number | null;
  trueshowingsales: number | null;
  viewresult: string;
  budget: number;
  moveintime: string;
  remark: string;
  renttime: number;
  created_at: string;
  updated_at: string;
  invalid?: boolean;
  showingsales_nickname?: string;
  trueshowingsales_nickname?: string;
  interviewsales_nickname?: string;
  interviewsales_user_id?: number | null;
  lead_phone?: string;
  lead_wechat?: string;
}

// 直通/轮空卡明细类型
export interface QueueCardDetail {
  id: number;
  user_id: number;
  community: string;
  queue_type: 'direct' | 'skip';
  created_at: string;
  consumed: boolean;
  consumed_at: string | null;
  remark?: string;
}

// 统计数据类型
export interface ShowingsStats {
  monthShowings: number;
  monthDeals: number;
  conversionRate: number;
  directCount: number;
  skipCount: number;
  incompleteCount: number;
}

// 回退申请类型
export interface RollbackApplication {
  reason: string;
  evidence: string[];
  leadid: string;
}

export class ShowingsService {
  /**
   * 获取带看统计数据
   */
  static async getStats(): Promise<ShowingsStats> {
    const now = dayjs();
    const monthStart = now.startOf('month').toISOString();
    const monthEnd = now.endOf('month').toISOString();
    
    // 使用存储过程获取统计数据
    const { data: showingsData } = await supabase.rpc('filter_showings', {
      p_created_at_start: monthStart,
      p_created_at_end: monthEnd,
      p_limit: 1000,
      p_offset: 0
    });
    
    // 过滤掉无效的带看记录
    const validShowingsData = showingsData?.filter((item: any) => !item.invalid) || [];
    
    // 统计带看量
    const showingsCount = validShowingsData.length;
    
    // 统计直签量
    const directDealsCount = validShowingsData.filter((item: any) => item.viewresult === '直签').length;
    
    // 统计预定量
    const reservedCount = validShowingsData.filter((item: any) => item.viewresult === '预定').length;
    
    // 直通卡数量
    const { count: directCount } = await supabase
      .from('showings_queue_record')
      .select('id', { count: 'exact', head: true })
      .eq('queue_type', 'direct')
      .eq('consumed', false);
    
    // 轮空卡数量
    const { count: skipCount } = await supabase
      .from('showings_queue_record')
      .select('id', { count: 'exact', head: true })
      .eq('queue_type', 'skip')
      .eq('consumed', false);
    
    // 未填写表单数量
    const incompleteCount = validShowingsData.filter((item: any) => 
      !item.viewresult || item.viewresult === ''
    ).length;
    
    // 转化率计算
    const totalDeals = directDealsCount + reservedCount;
    const conversionRate = showingsCount && totalDeals ? (totalDeals / showingsCount) * 100 : 0;
    
    return {
      monthShowings: showingsCount,
      monthDeals: totalDeals,
      conversionRate: Number(conversionRate.toFixed(2)),
      directCount: directCount || 0,
      skipCount: skipCount || 0,
      incompleteCount: incompleteCount || 0,
    };
  }

  /**
   * 获取看房结果选项
   */
  static async getViewResultOptions(): Promise<any[]> {
    try {
      const { data, error } = await supabase.rpc('get_showings_viewresult_options');
      
      if (error) throw error;
      if (data) {
        return data;
      }
    } catch (error) {
      console.error('获取看房结果选项失败:', error);
    }
    
    // 默认选项
    return [
      { value: '直签', label: '直签' },
      { value: '预定', label: '预定' },
      { value: '意向金', label: '意向金' },
      { value: '考虑中', label: '考虑中' },
      { value: '已流失', label: '已流失' }
    ];
  }

  /**
   * 获取社区选项
   */
  static async getCommunityOptions(): Promise<{ value: string; label: string }[]> {
    try {
      const { data, error } = await supabase.rpc('get_enum_values', { 
        enum_name: 'community' 
      });
      
      if (error) throw error;
      return (data || []).map((item: string) => ({ value: item, label: item }));
    } catch (error) {
      console.error('获取社区选项失败:', error);
      return [];
    }
  }

  /**
   * 获取销售员选项
   */
  static async getSalesOptions(): Promise<{ value: number; label: string }[]> {
    try {
      const { data } = await supabase
        .from('users_profile')
        .select('id, nickname')
        .eq('status', 'active')
        .order('nickname');
      
      return (data || []).map(item => ({ value: item.id, label: item.nickname }));
    } catch (error) {
      console.error('获取销售员选项失败:', error);
      return [];
    }
  }

  /**
   * 从带看数据中提取选项
   */
  static extractOptionsFromData(showingsData: ShowingWithRelations[]) {
    // 约访管家选项
    const interviewsalesSet = new Set<string>();
    showingsData.forEach(item => {
      if (item.interviewsales_nickname) {
        interviewsalesSet.add(item.interviewsales_nickname);
      }
    });
    const interviewsalesOptions = Array.from(interviewsalesSet).map(name => ({ value: name, label: name }));

    // 实际带看管家选项
    const trueshowingsalesSet = new Set<string>();
    showingsData.forEach(item => {
      if (item.trueshowingsales_nickname) {
        trueshowingsalesSet.add(item.trueshowingsales_nickname);
      }
    });
    const trueshowingsalesOptions = Array.from(trueshowingsalesSet).map(name => ({ value: name, label: name }));

    return {
      interviewsalesOptions,
      trueshowingsalesOptions
    };
  }

  /**
   * 获取直通/轮空卡明细
   */
  static async getQueueCardDetails(type: 'direct' | 'skip'): Promise<QueueCardDetail[]> {
    try {
      const { data, error } = await supabase
        .from('showings_queue_record')
        .select('*')
        .eq('queue_type', type)
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('获取卡片明细失败:', error);
      message.error('获取卡片明细失败');
      return [];
    }
  }

  /**
   * 提交带看回退申请
   */
  static async submitRollbackApplication(
    record: ShowingWithRelations,
    application: RollbackApplication,
    userId: number
  ): Promise<boolean> {
    try {
      // 1. 检查是否已存在未完成的回退审批流实例
      const { data: existList, error: existError } = await supabase
        .from('approval_instances')
        .select('id, status')
        .eq('type', 'showing_rollback')
        .eq('target_id', record.id)
        .in('status', ['pending', 'processing']);
      
      if (existError) throw existError;
      if (existList && existList.length > 0) {
        message.error('该带看记录已提交回退申请，请勿重复提交');
        return false;
      }

      // 2. 查找审批流模板
      const { data: flowData, error: flowError } = await supabase
        .from('approval_flows')
        .select('id')
        .eq('type', 'showing_rollback')
        .maybeSingle();
      
      if (flowError || !flowData) {
        message.error('未找到带看回退审批流模板，请联系管理员配置');
        return false;
      }

      // 3. 插入审批流实例
      const { error: approvalError } = await supabase.from('approval_instances').insert({
        flow_id: flowData.id,
        type: 'showing_rollback',
        target_table: 'showings',
        target_id: record.id,
        status: 'pending',
        created_by: userId,
        config: {
          reason: application.reason,
          evidence: application.evidence,
          leadid: application.leadid,
        },
      });
      
      if (approvalError) throw approvalError;

      message.success('带看回退申请已提交，等待审批');
      return true;
    } catch (error: any) {
      message.error('回退提交失败: ' + (error.message || error.toString()));
      return false;
    }
  }

  /**
   * 上传回退证据图片
   */
  static async uploadRollbackEvidence(files: File[]): Promise<string[]> {
    const uploadedUrls: string[] = [];
    
    try {
      for (const file of files) {
        // 压缩图片
        const options = {
          maxSizeMB: 0.5,
          maxWidthOrHeight: 1280,
          useWebWorker: true,
        };
        const compressedFile = await imageCompression(file, options);
        
        // 生成文件名
        const fileExt = file.name.split('.').pop();
        const fileName = `rollback-${toBeijingTime(new Date()).valueOf()}-${Math.floor(Math.random()*10000)}.${fileExt}`;
        const filePath = `rollback/${fileName}`;
        
        // 上传到存储
        const { error } = await supabase.storage.from('rollback').upload(filePath, compressedFile);
        if (error) throw error;
        
        // 获取公开URL
        const { data } = supabase.storage.from('rollback').getPublicUrl(filePath);
        uploadedUrls.push(data.publicUrl);
      }
      
      return uploadedUrls;
    } catch (error: any) {
      message.error('图片上传失败: ' + (error.message || error.toString()));
      throw error;
    }
  }

  /**
   * 获取看房结果颜色
   */
  static getViewResultColor(result: string): string {
    const colorMap: { [key: string]: string } = {
      '直签': 'success',
      '预定': 'processing',
      '意向金': 'processing',
      '考虑中': 'warning',
      '已流失': 'error',
    };
    return colorMap[result] || 'default';
  }

  /**
   * 脱敏手机号
   */
  static maskPhone(phone: string): string {
    if (!phone) return '-';
    return phone.replace(/(\d{3})\d{4}(\d{4})/, '$1****$2');
  }

  /**
   * 脱敏微信号
   */
  static maskWechat(wechat: string): string {
    if (!wechat) return '-';
    if (wechat.length < 4) return wechat;
    return wechat.substring(0, 2) + '****' + wechat.substring(wechat.length - 2);
  }

  /**
   * 回退理由选项
   */
  static getRollbackReasonOptions() {
    return [
      { value: '临时取消', label: '临时取消' },
      { value: '无效客户', label: '无效客户' },
      { value: '重复带看', label: '重复带看' },
      { value: '其他原因', label: '其他原因' }
    ];
  }

  /**
   * 获取带看记录列表（支持多字段筛选）
   */
  static async getShowings(filters: ShowingFilters = {}) {
    const { data, error } = await supabase.rpc('filter_showings', {
      p_leadid: filters.leadid,
      p_community: filters.community,
      p_showingsales: filters.showingsales,
      p_trueshowingsales: filters.trueshowingsales,
      p_interviewsales: filters.interviewsales,
      p_viewresult: filters.viewresult,
      p_budget_min: filters.budget_min,
      p_budget_max: filters.budget_max,
      p_renttime_min: filters.renttime_min,
      p_renttime_max: filters.renttime_max,
      p_scheduletime_start: filters.scheduletime_start,
      p_scheduletime_end: filters.scheduletime_end,
      p_arrivaltime_start: filters.arrivaltime_start,
      p_arrivaltime_end: filters.arrivaltime_end,
      p_moveintime_start: filters.moveintime_start,
      p_moveintime_end: filters.moveintime_end,
      p_created_at_start: filters.created_at_start,
      p_created_at_end: filters.created_at_end,
      p_order_by: filters.orderBy || 'created_at',
      p_ascending: filters.ascending || false,
      p_limit: filters.limit || 10,
      p_offset: filters.offset || 0,
      p_incomplete: filters.incomplete || false
    });
    
    if (error) throw error;
    return data;
  }

  /**
   * 获取带看记录总数（用于分页）
   */
  static async getShowingsCount(filters: ShowingFilters = {}) {
    const { data, error } = await supabase.rpc('get_showings_count', {
      p_leadid: filters.leadid,
      p_community: filters.community,
      p_showingsales: filters.showingsales,
      p_trueshowingsales: filters.trueshowingsales,
      p_interviewsales: filters.interviewsales,
      p_viewresult: filters.viewresult,
      p_budget_min: filters.budget_min,
      p_budget_max: filters.budget_max,
      p_renttime_min: filters.renttime_min,
      p_renttime_max: filters.renttime_max,
      p_scheduletime_start: filters.scheduletime_start,
      p_scheduletime_end: filters.scheduletime_end,
      p_arrivaltime_start: filters.arrivaltime_start,
      p_arrivaltime_end: filters.arrivaltime_end,
      p_moveintime_start: filters.moveintime_start,
      p_moveintime_end: filters.moveintime_end,
      p_created_at_start: filters.created_at_start,
      p_created_at_end: filters.created_at_end,
      p_incomplete: filters.incomplete || false
    });
    
    if (error) throw error;
    return data || 0;
  }

  /**
   * 创建带看记录
   */
  static async createShowing(showingData: Partial<Showing>) {
    const { data, error } = await supabase
      .from('showings')
      .insert([showingData])
      .select();
    
    if (error) throw error;
    return data?.[0];
  }

  /**
   * 更新带看记录
   */
  static async updateShowing(id: string, showingData: Partial<Showing>) {
    console.log('🔄 服务层更新数据:', { id, showingData });
    
    // 过滤掉 undefined 和 null 值，避免数据库约束错误
    const filteredData = Object.fromEntries(
      Object.entries(showingData).filter(([_, value]) => value !== undefined && value !== null)
    );
    
    console.log('🔄 服务层过滤后数据:', filteredData);
    
    const { data, error } = await supabase
      .from('showings')
      .update(filteredData)
      .eq('id', id)
      .select();
    
    if (error) {
      console.error('🔄 服务层更新失败:', error);
      throw error;
    }
    
    console.log('🔄 服务层更新成功:', data);
    return data?.[0];
  }

  /**
   * 删除带看记录
   */
  static async deleteShowing(id: string) {
    const { error } = await supabase
      .from('showings')
      .delete()
      .eq('id', id);
    
    if (error) throw error;
  }
}

export default ShowingsService;