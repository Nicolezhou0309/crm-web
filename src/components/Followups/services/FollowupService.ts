import { BaseDataService } from './BaseDataService';
import { supabase } from '../../../supaClient';
import type { Followup } from '../followupTypes';

/**
 * 跟进记录服务
 * 提供跟进相关的业务逻辑和数据访问
 */
export class FollowupService extends BaseDataService {
  constructor() {
    super('followups');
  }

  /**
   * 获取跟进记录列表（带分页和筛选）
   */
  async getFollowupsList(params: {
    page: number;
    pageSize: number;
    filters?: Record<string, any>;
    keyword?: string;
    groupField?: string;
    selectedGroup?: string;
  }) {
    const { page, pageSize, filters = {}, keyword, groupField, selectedGroup } = params;
    const offset = (page - 1) * pageSize;

    try {
      let query = supabase.from(this.tableName).select('*');

      // 应用关键词搜索
      if (keyword) {
        query = query.or(`leadid.ilike.%${keyword}%,phone.ilike.%${keyword}%,wechat.ilike.%${keyword}%`);
      }

      // 应用分组筛选
      if (groupField && selectedGroup !== undefined) {
        if (selectedGroup === 'null' || selectedGroup === '') {
          query = query.is(groupField, null);
        } else {
          query = query.eq(groupField, selectedGroup);
        }
      }

      // 应用其他筛选条件
      Object.entries(filters).forEach(([key, value]) => {
        if (value !== null && value !== undefined && value !== '') {
          if (Array.isArray(value)) {
            query = query.in(key, value);
          } else if (key.includes('_start')) {
            const fieldName = key.replace('_start', '');
            query = query.gte(fieldName, value);
          } else if (key.includes('_end')) {
            const fieldName = key.replace('_end', '');
            query = query.lte(fieldName, value);
          } else {
            query = query.eq(key, value);
          }
        }
      });

      // 获取总数 - 使用单独的查询
      const { count } = await supabase
        .from('followups')
        .select('*', { count: 'exact', head: true });
      
      // 应用分页和排序
      const { data, error } = await query
        .order('created_at', { ascending: false })
        .range(offset, offset + pageSize - 1);

      return {
        data: data as Followup[],
        total: count || 0,
        error
      };
    } catch (error) {
      console.error('[FollowupService] 获取跟进记录列表失败:', error);
      return { data: [], total: 0, error };
    }
  }

  /**
   * 获取分组统计数据
   */
  async getGroupCount(groupField: string, filters?: Record<string, any>) {
    try {
      let query = supabase
        .from(this.tableName)
        .select(`${groupField}, count`, { count: 'exact' });

      // 应用筛选条件
      if (filters) {
        Object.entries(filters).forEach(([key, value]) => {
          if (value !== null && value !== undefined && value !== '') {
            if (Array.isArray(value)) {
              query = query.in(key, value);
            } else if (key.includes('_start')) {
              const fieldName = key.replace('_start', '');
              query = query.gte(fieldName, value);
            } else if (key.includes('_end')) {
              const fieldName = key.replace('_end', '');
              query = query.lte(fieldName, value);
            } else {
              query = query.eq(key, value);
            }
          }
        });
      }

      // 使用RPC函数或手动分组 - 简化实现
      const { data, error } = await supabase
        .from('followups')
        .select(groupField);

      if (error) {
        throw error;
      }

      // 处理分组数据 - 手动统计
      const groupCounts: Record<string, number> = {};
      data?.forEach((item: any) => {
        const key = item[groupField] || null;
        groupCounts[key] = (groupCounts[key] || 0) + 1;
      });

      const groupData = Object.entries(groupCounts).map(([key, count]) => ({
        key: key === 'null' ? null : key,
        count,
        groupText: this.getGroupDisplayText(groupField, key === 'null' ? null : key)
      }));

      // 添加未分组统计
      const nullGroup = groupData.find((g: any) => g.key === null);
      if (!nullGroup) {
        groupData.push({
          key: null,
          count: 0,
          groupText: '未分组'
        });
      }

      return { data: groupData, error: null };
    } catch (error) {
      console.error('[FollowupService] 获取分组统计失败:', error);
      return { data: [], error };
    }
  }

  /**
   * 获取分组显示文本
   */
  private getGroupDisplayText(field: string, value: any): string {
    if (value === null || value === undefined || value === '') {
      return '未分配';
    }

    // 根据字段类型返回不同的显示文本
    switch (field) {
      case 'interviewsales_user_id':
      case 'showingsales_user_id':
        return '用户ID';
      case 'created_at':
        return '创建日期';
      default:
        return String(value);
    }
  }

  /**
   * 更新跟进阶段
   */
  async updateFollowupStage(id: string, stage: string, additionalData?: Record<string, any>) {
    try {
      const updateData: Record<string, any> = { followupstage: stage };
      if (additionalData) {
        Object.assign(updateData, additionalData);
      }

      const { data, error } = await this.update(id, updateData);
      return { data, error };
    } catch (error) {
      console.error('[FollowupService] 更新跟进阶段失败:', error);
      return { data: null, error };
    }
  }

  /**
   * 批量更新跟进记录
   */
  async batchUpdateFollowups(updates: Array<{ id: string; updates: Record<string, any> }>) {
    try {
      const results = await Promise.all(
        updates.map(async ({ id, updates }) => {
          return await this.update(id, updates);
        })
      );

      const successCount = results.filter(r => !r.error).length;
      const errors = results.filter(r => r.error).map(r => r.error);

      return {
        successCount,
        totalCount: updates.length,
        errors,
        success: successCount === updates.length
      };
    } catch (error) {
      console.error('[FollowupService] 批量更新失败:', error);
      return {
        successCount: 0,
        totalCount: updates.length,
        errors: [error],
        success: false
      };
    }
  }

  /**
   * 获取跟进记录统计信息
   */
  async getFollowupStats(filters?: Record<string, any>) {
    try {
      const { count: total } = await this.count(filters);
      
      // 获取各阶段统计 - 使用RPC函数或手动统计
      const { data: stageStats } = await supabase
        .from(this.tableName)
        .select('followupstage');

      // 获取今日新增
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const { count: todayCount } = await supabase
        .from(this.tableName)
        .select('*', { count: 'exact', head: true })
        .gte('created_at', today.toISOString());

      return {
        total: total || 0,
        todayCount: todayCount || 0,
        stageStats: stageStats || [],
        error: null
      };
    } catch (error) {
      console.error('[FollowupService] 获取统计信息失败:', error);
      return {
        total: 0,
        todayCount: 0,
        stageStats: [],
        error
      };
    }
  }
}
