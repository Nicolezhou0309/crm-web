import { useState, useCallback, useRef, useEffect } from 'react';
import { message } from 'antd';
import { supabase } from '../../../supaClient';
import dayjs from 'dayjs';
import type { 
  FollowupRecord, 
  PaginationState, 
  FilterParams 
} from '../types';

export const useFollowupsData = () => {
  const [data, setData] = useState<FollowupRecord[]>([]);
  const [localData, setLocalData] = useState<FollowupRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [pagination, setPagination] = useState<PaginationState>({ 
    current: 1, 
    pageSize: 20, 
    total: 0 
  });
  const [forceUpdate, setForceUpdate] = useState(0);

  const localDataRef = useRef<FollowupRecord[]>([]);

  // 初始化时自动加载数据
  useEffect(() => {
    // 延迟调用，确保 fetchFollowups 已经定义
    setTimeout(() => {
      if (typeof fetchFollowups === 'function') {
        fetchFollowups();
      }
    }, 0);
  }, []); // 保持空依赖，避免循环依赖

  // 允许的参数（与SQL函数声明一致）
  const allowedParams = [
    'p_created_at_end', 'p_created_at_start', 
    'p_customerprofile', 'p_followupresult', 'p_followupstage',
    'p_interviewsales_user_id', 'p_leadid', 'p_leadtype',
    'p_limit', 'p_majorcategory', 
    'p_moveintime_end', 'p_moveintime_start',
    'p_offset', 'p_remark',
    'p_scheduledcommunity',
    'p_source', 'p_userbudget', 'p_userbudget_min', 'p_userbudget_max', 'p_userrating',
    'p_wechat', 'p_worklocation', 'p_phone', 'p_keyword',
    'p_subcategory', 'p_scheduletime_start', 'p_scheduletime_end', 'p_showingsales_user'
  ];

  const fetchFollowups = useCallback(async (
    filters: FilterParams = {},
    page = pagination.current,
    pageSize = pagination.pageSize
  ) => {
    setLoading(true);
    try {
      const p_limit = pageSize;
      const p_offset = (page - 1) * pageSize;

      // 构造参数对象
      const params: Record<string, any> = {
        ...filters,
        p_limit,
        p_offset,
      };

      // 确保数组参数正确传递
      const arrayParams = [
        'p_customerprofile', 'p_followupresult', 'p_followupstage',
        'p_interviewsales_user_id', 'p_leadid', 'p_leadtype',
        'p_majorcategory', 'p_scheduledcommunity', 'p_source', 'p_userbudget', 'p_userrating',
        'p_wechat', 'p_worklocation', 'p_phone'
      ];

      // 确保所有数组参数都是数组类型
      arrayParams.forEach(key => {
        if (key in params) {
          if (params[key] === null || params[key] === undefined) {
            delete params[key]; // 如果是null/undefined，删除该参数
          } else if (!Array.isArray(params[key])) {
            params[key] = [params[key]]; // 如果不是数组，转换为数组
          } else if (Array.isArray(params[key]) && params[key].length === 0) {
            delete params[key]; // 如果是空数组，删除该参数
          }
          // 注意：不要删除包含[null]的数组，这是有效的NULL值筛选条件
        }
      });

      // 处理日期参数
      const dateParams = [
        'p_created_at_start', 'p_created_at_end',
        'p_moveintime_start', 'p_moveintime_end'
      ];
      
      dateParams.forEach(key => {
        if (key in params && params[key]) {
          try {
            let dateValue = params[key];
            let formattedDate: Date | string;
            
            if (typeof dateValue === 'string') {
              const parsedDate = dayjs(dateValue);
              if (parsedDate.isValid()) {
                // 转换为Date对象，让Supabase客户端自动处理类型转换
                formattedDate = parsedDate.toDate();
              } else {
                console.warn(`⚠️ [明细查询] 无效的日期格式 ${key}:`, dateValue);
                delete params[key];
                return;
              }
            } else if (dayjs.isDayjs(dateValue)) {
              formattedDate = dateValue.toDate();
            } else {
              const parsedDate = dayjs(dateValue);
              if (parsedDate.isValid()) {
                formattedDate = parsedDate.toDate();
              } else {
                console.warn(`⚠️ [明细查询] 无法解析的日期值 ${key}:`, dateValue);
                delete params[key];
                return;
              }
            }
            
            params[key] = formattedDate;
          } catch (error) {
            console.error(`❌ [明细查询] 日期参数 ${key} 处理失败:`, error);
            delete params[key];
          }
        }
      });

      // 只传 allowedParams
      const rpcParams = Object.fromEntries(
        Object.entries(params).filter(([key]) => allowedParams.includes(key) || key === 'p_groupby_field')
      );

      const { data: responseData, error } = await supabase.rpc('filter_followups', rpcParams);
      
      if (error) {
        message.error('获取跟进记录失败: ' + error.message);
        return;
      }

      const total = responseData && responseData.length > 0 ? Number(responseData[0].total_count) : 0;
      
      // 前端校验：只保留id非空且唯一的行
      const filtered = (responseData || []).filter((item: any): item is FollowupRecord => !!item && !!item.id);
      const unique = Array.from(new Map(filtered.map((i: any) => [i.id, i])).values()) as FollowupRecord[];
      
      // 优化数据处理：减少循环次数
      const safeData = unique.map((item: any) => {
        // 直接处理，避免多次循环
        const processedItem = { ...item };
        
        // 批量处理ID字段 - 修复类型检查问题
        if (processedItem.interviewsales_user_id === 0 || processedItem.interviewsales_user_id === null || typeof processedItem.interviewsales_user_id === 'undefined') {
          processedItem.interviewsales_user_id = null;
        } else if (typeof processedItem.interviewsales_user_id === 'string') {
          processedItem.interviewsales_user_id = Number(processedItem.interviewsales_user_id);
        }
        
        if (processedItem.showingsales_user_id === 0 || processedItem.showingsales_user_id === null || typeof processedItem.showingsales_user_id === 'undefined') {
          processedItem.showingsales_user_id = null;
        } else if (typeof processedItem.showingsales_user_id === 'string') {
          processedItem.showingsales_user_id = Number(processedItem.showingsales_user_id);
        }
        
        // 批量处理日期字段
        if (processedItem.created_at) {
          processedItem.created_at = dayjs(processedItem.created_at).format('YYYY-MM-DD HH:mm:ss');
        }
        if (processedItem.moveintime) {
          processedItem.moveintime = dayjs(processedItem.moveintime).format('YYYY-MM-DD HH:mm:ss');
        }
        if (processedItem.scheduletime) {
          processedItem.scheduletime = dayjs(processedItem.scheduletime).format('YYYY-MM-DD HH:mm:ss');
        }
        
        return processedItem;
      });
      
      setData(safeData);
      setLocalData(safeData);
      localDataRef.current = safeData;
      setPagination(prev => ({ ...prev, total, current: page, pageSize }));
      
    } catch (error) {
      message.error('获取跟进记录失败');
    } finally {
      setLoading(false);
    }
  }, [pagination.current, pagination.pageSize]); // 添加正确的依赖

  const updateLocalData = useCallback((id: string, field: keyof FollowupRecord, value: any) => {
    const currentData = localDataRef.current;
    const recordIndex = currentData.findIndex(item => item.id === id);
    
    if (recordIndex === -1) return;
    
    const newData = [...currentData];
    newData[recordIndex] = { ...newData[recordIndex], [field]: value };
    
    localDataRef.current = newData;
    setLocalData(newData);
    setData(prev => 
      prev.map(item => 
        item.id === id ? { ...item, [field]: value } : item
      )
    );
  }, []);

  const refreshData = useCallback((newFilters?: any) => {
    if (newFilters) {
      // 如果有新的筛选条件，使用新条件获取数据
      fetchFollowups(newFilters, 1, pagination.pageSize);
    } else {
      // 否则使用当前筛选条件
      fetchFollowups();
    }
  }, [fetchFollowups, pagination.pageSize]);

  const resetPagination = useCallback(() => {
    setPagination(prev => ({ ...prev, current: 1 }));
  }, []);

  return {
    data,
    localData,
    loading,
    pagination,
    forceUpdate,
    fetchFollowups,
    updateLocalData,
    refreshData,
    resetPagination,
    setPagination,
    setData,
    setLocalData,
    setForceUpdate
  };
};
