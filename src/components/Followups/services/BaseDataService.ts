import { supabase } from '../../../supaClient';

/**
 * 基础数据访问服务
 * 提供通用的CRUD操作和错误处理
 */
export class BaseDataService {
  protected tableName: string;

  constructor(tableName: string) {
    this.tableName = tableName;
  }

  /**
   * 通用查询方法
   */
  async query<T = any>(
    select?: string,
    filters?: Record<string, any>,
    orderBy?: { column: string; ascending?: boolean },
    limit?: number,
    offset?: number
  ): Promise<{ data: T[] | null; error: any }> {
    try {
      let query = supabase.from(this.tableName).select(select || '*');

      // 应用筛选条件
      if (filters) {
        Object.entries(filters).forEach(([key, value]) => {
          if (value !== null && value !== undefined) {
            if (Array.isArray(value)) {
              query = query.in(key, value);
            } else {
              query = query.eq(key, value);
            }
          }
        });
      }

      // 应用排序
      if (orderBy) {
        query = query.order(orderBy.column, { ascending: orderBy.ascending ?? true });
      }

      // 应用分页
      if (limit) {
        query = query.limit(limit);
        if (offset) {
          query = query.range(offset, offset + limit - 1);
        }
      }

      const { data, error } = await query;
      return { data: data as T[] | null, error };
    } catch (error) {
      console.error(`[BaseDataService] 查询失败:`, error);
      return { data: null, error };
    }
  }

  /**
   * 根据ID查询单条记录
   */
  async getById<T = any>(id: string, select?: string): Promise<{ data: T | null; error: any }> {
    try {
      const { data, error } = await supabase
        .from(this.tableName)
        .select(select || '*')
        .eq('id', id)
        .single();
      return { data: data as T | null, error };
    } catch (error) {
      console.error(`[BaseDataService] 根据ID查询失败:`, error);
      return { data: null, error };
    }
  }

  /**
   * 创建记录
   */
  async create<T = any>(data: Partial<T>): Promise<{ data: T | null; error: any }> {
    try {
      const { data: result, error } = await supabase
        .from(this.tableName)
        .insert(data)
        .select()
        .single();
      return { data: result, error };
    } catch (error) {
      console.error(`[BaseDataService] 创建失败:`, error);
      return { data: null, error };
    }
  }

  /**
   * 更新记录
   */
  async update<T = any>(id: string, data: Partial<T>): Promise<{ data: T | null; error: any }> {
    try {
      const { data: result, error } = await supabase
        .from(this.tableName)
        .update(data)
        .eq('id', id)
        .select()
        .single();
      return { data: result, error };
    } catch (error) {
      console.error(`[BaseDataService] 更新失败:`, error);
      return { data: null, error };
    }
  }

  /**
   * 删除记录
   */
  async delete(id: string): Promise<{ success: boolean; error: any }> {
    try {
      const { error } = await supabase
        .from(this.tableName)
        .delete()
        .eq('id', id);
      return { success: !error, error };
    } catch (error) {
      console.error(`[BaseDataService] 删除失败:`, error);
      return { success: false, error };
    }
  }

  /**
   * 批量更新
   */
  async batchUpdate<T = any>(
    updates: { id: string; data: Partial<T> }[]
  ): Promise<{ results: Array<{ success: boolean; error: any }> }> {
    try {
      const results = await Promise.all(
        updates.map(async ({ id, data }) => {
          const result = await this.update(id, data);
          return { success: !result.error, error: result.error };
        })
      );
      return { results };
    } catch (error) {
      console.error(`[BaseDataService] 批量更新失败:`, error);
      return { results: updates.map(() => ({ success: false, error })) };
    }
  }

  /**
   * 统计记录数量
   */
  async count(filters?: Record<string, any>): Promise<{ count: number | null; error: any }> {
    try {
      let query = supabase.from(this.tableName).select('*', { count: 'exact', head: true });

      // 应用筛选条件
      if (filters) {
        Object.entries(filters).forEach(([key, value]) => {
          if (value !== null && value !== undefined) {
            if (Array.isArray(value)) {
              query = query.in(key, value);
            } else {
              query = query.eq(key, value);
            }
          }
        });
      }

      const { count, error } = await query;
      return { count, error };
    } catch (error) {
      console.error(`[BaseDataService] 统计失败:`, error);
      return { count: null, error };
    }
  }
}