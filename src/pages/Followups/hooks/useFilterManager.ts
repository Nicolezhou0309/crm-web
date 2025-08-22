import { useState, useCallback, useEffect, useMemo } from 'react';
import type { FilterState, ColumnFilters, FilterParams } from '../types';
import dayjs from 'dayjs';

export const useFilterManager = () => {
  const [filters, setFilters] = useState<FilterState>({});
  const [columnFilters, setColumnFilters] = useState<ColumnFilters>({});
  const [keywordSearch, setKeywordSearch] = useState('');
  const [quickDateKey, setQuickDateKey] = useState<string | null>(null);

  // 初始化时设置默认筛选条件
  useEffect(() => {
    // 可以在这里设置一些默认的筛选条件
  }, []);

  // 统一的筛选参数处理函数 - 确保明细和分组使用相同的参数格式
  const normalizeFilterParams = useCallback((rawFilters: FilterState): FilterParams => {
    const normalizedParams: FilterParams = {};
    
    // 定义需要转换为数组的参数
    const arrayParams = [
      'p_leadid', 'p_leadtype', 'p_interviewsales_user_id', 'p_followupstage',
      'p_customerprofile', 'p_worklocation', 'p_userbudget', 'p_userrating',
      'p_majorcategory', 'p_subcategory', 'p_followupresult', 'p_scheduledcommunity', 
      'p_source', 'p_wechat', 'p_phone', 'p_showingsales_user'
    ];
    
    // 定义日期参数
    const dateParams = [
      'p_created_at_start', 'p_created_at_end',
      'p_moveintime_start', 'p_moveintime_end',
      'p_scheduletime_start', 'p_scheduletime_end'
    ];
    
    Object.entries(rawFilters).forEach(([key, value]) => {
      if (value === null || value === undefined || value === '') {
        return; // 跳过空值
      }
      
      // 处理数组参数
      if (arrayParams.includes(key)) {
        if (Array.isArray(value)) {
          if (value.length > 0) {
            // 验证枚举值是否有效（非空字符串）
            const validValues = value.filter((v: any) => v !== null && v !== undefined && v !== '');
            if (validValues.length > 0) {
              normalizedParams[key as keyof FilterParams] = validValues;
            }
          }
        } else {
          // 单个值转换为数组
          normalizedParams[key as keyof FilterParams] = [value];
        }
      }
      // 处理日期参数
      else if (dateParams.includes(key)) {
        if (value) {
          normalizedParams[key as keyof FilterParams] = value;
        }
      }
      // 处理其他参数（关键词、预算范围等）
      else {
        normalizedParams[key as keyof FilterParams] = value;
      }
    });
    
    return normalizedParams;
  }, []);

  // 应用筛选条件
  const applyFilter = useCallback((field: string, value: any) => {
    setFilters(prev => ({
      ...prev,
      [field]: value
    }));
  }, []);

  // 移除单个筛选条件
  const removeFilter = useCallback((field: string, value?: any) => {
    
    
    setFilters(prev => {
      const updated = { ...prev };
      if (value !== undefined && Array.isArray(updated[field])) {
        // 如果是数组，移除特定值
        const originalLength = updated[field].length;
        updated[field] = updated[field].filter((v: any) => v !== value);
        const newLength = updated[field].length;
        
        
        
        if (updated[field].length === 0) {
          delete updated[field];
          
        }
      } else {
        // 否则删除整个字段
        
        delete updated[field];
      }
      
      
      return updated;
    });
    
    setColumnFilters(prev => {
      const updated = { ...prev };
      updated[field] = null;
      
      return updated;
    });
  }, []);

  // 重置单个筛选条件
  const resetFilter = useCallback((field: string) => {
    setFilters(prev => {
      const updated = { ...prev };
      delete updated[field];
      return updated;
    });
    
    setColumnFilters(prev => {
      const updated = { ...prev };
      updated[field] = null;
      return updated;
    });
  }, []);

  // 重置所有筛选条件
  const resetAllFilters = useCallback(() => {
    setFilters({});
    setColumnFilters({});
    setKeywordSearch('');
    setQuickDateKey(null);
  }, []);

  // 更新表格列筛选 - 支持清除筛选条件
  const updateColumnFilters = useCallback((newFilters: ColumnFilters) => {
    setColumnFilters(newFilters);
    
    // 定义所有可能的表头筛选字段
    const tableFilterFields = [
      'followupstage', 'customerprofile', 'userrating', 'scheduledcommunity', 'source',
      'leadtype', 'remark', 'worklocation', 'userbudget', 'followupresult', 'majorcategory'
    ];
    
    // 将表格列筛选器转换为RPC参数格式
    const rpcFilters: FilterParams = {};
    
    // 处理有值的筛选条件
    Object.entries(newFilters).forEach(([key, value]) => {
      if (value && Array.isArray(value) && value.length > 0) {
        // 转换为RPC参数格式
        const rpcKey = `p_${key}`;
        rpcFilters[rpcKey as keyof FilterParams] = value;
      }
    });
    
    // 更新筛选器状态，同时清除已移除的筛选条件
    setFilters(prev => {
      const updated = { ...prev };
      
      // 先清除所有表头筛选字段
      tableFilterFields.forEach(field => {
        const rpcKey = `p_${field}`;
        delete updated[rpcKey];
      });
      
      // 再添加新的筛选条件
      return {
        ...updated,
        ...rpcFilters
      };
    });
  }, []);

  // 处理关键词搜索
  const handleKeywordSearch = useCallback((keyword: string) => {
    
    setKeywordSearch(keyword);
    if (keyword.trim()) {
      setFilters(prev => {
        const newFilters = {
          ...prev,
          p_keyword: keyword.trim()
        };
        
        return newFilters;
      });
    } else {
      setFilters(prev => {
        const updated = { ...prev };
        delete updated.p_keyword;
        
        return updated;
      });
    }
  }, []);

  // 清除关键词搜索
  const clearKeywordSearch = useCallback(() => {
    setKeywordSearch('');
    setFilters(prev => {
      const updated = { ...prev };
      delete updated.p_keyword;
      return updated;
    });
  }, []);

  // 清除特定类型的筛选条件
  const clearFilterType = useCallback((filterType: string) => {
    setFilters(prev => {
      const updated = { ...prev };
      delete updated[filterType];
      return updated;
    });
  }, []);

  // 清除所有表头筛选条件
  const clearTableFilters = useCallback(() => {
    const tableFilterFields = [
      'p_followupstage', 'p_customerprofile', 'p_userrating', 'p_scheduledcommunity', 'p_source',
      'p_leadtype', 'p_remark', 'p_worklocation', 'p_userbudget', 'p_followupresult', 'p_majorcategory'
    ];
    
    setFilters(prev => {
      const updated = { ...prev };
      tableFilterFields.forEach(field => {
        delete updated[field];
      });
      return updated;
    });
    
    // 同时清除列筛选状态
    setColumnFilters({});
  }, []);

  // 设置快捷日期筛选 - 修复与旧页面保持一致
  const setQuickDateFilter = useCallback((key: string | null) => {
    
    
    setQuickDateKey(key);
    
    if (key) {
      // 根据快捷日期键设置相应的日期范围 - 使用Date对象，与数据库期望的类型一致
      let startDate: Date;
      let endDate: Date;
      
      switch (key) {
        case 'thisWeek': {
          // 本周：从周一开始到周日
          startDate = dayjs().startOf('week').hour(0).minute(0).second(0).toDate();
          endDate = dayjs().endOf('week').hour(23).minute(59).second(59).toDate();
          
          break;
        }
          
        case 'lastWeek': {
          // 上周：从上周一开始到上周日
          startDate = dayjs().subtract(1, 'week').startOf('week').hour(0).minute(0).second(0).toDate();
          endDate = dayjs().subtract(1, 'week').endOf('week').hour(23).minute(59).second(59).toDate();
          
          break;
        }
          
        case 'thisMonth': {
          // 本月：从1号开始到月末
          startDate = dayjs().startOf('month').hour(0).minute(0).second(0).toDate();
          endDate = dayjs().endOf('month').hour(23).minute(59).second(59).toDate();
          
          break;
        }
          
        case 'lastMonth': {
          // 上月：从上月1号开始到上月月末
          startDate = dayjs().subtract(1, 'month').startOf('month').hour(0).minute(0).second(0).toDate();
          endDate = dayjs().subtract(1, 'month').endOf('month').hour(23).minute(59).second(59).toDate();
          
          break;
        }
          
        default:
          return;
      }
      
      // 应用日期筛选条件
      setFilters(prev => {
        const newFilters = {
          ...prev,
          p_created_at_start: startDate,
          p_created_at_end: endDate
        };
        return newFilters;
      });
    } else {
      // 清除时间筛选条件
      setFilters(prev => {
        const updated = { ...prev };
        delete updated.p_created_at_start;
        delete updated.p_created_at_end;
        return updated;
      });
    }
  }, []); // 移除filters依赖

  // 获取当前筛选参数 - 使用统一的参数处理逻辑，使用useMemo缓存结果避免无限循环
  const getCurrentFilters = useMemo((): FilterParams => {
    const normalizedParams = normalizeFilterParams(filters);
    return normalizedParams;
  }, [filters, normalizeFilterParams]);

  // 获取当前筛选参数的函数版本 - 用于向后兼容
  const getCurrentFiltersFn = useCallback((): FilterParams => {
    // 直接使用当前的 filters 状态，避免依赖 useMemo 的时序问题
    const normalizedParams = normalizeFilterParams(filters);
    return normalizedParams;
  }, [filters, normalizeFilterParams]);

  return {
    // 状态
    filters,
    columnFilters,
    keywordSearch,
    quickDateKey,
    
    // 方法
    applyFilter,
    removeFilter,
    resetFilter,
    resetAllFilters,
    updateColumnFilters,
    handleKeywordSearch,
    clearKeywordSearch,
    clearFilterType, // 新增：清除特定类型的筛选条件
    clearTableFilters, // 新增：清除所有表头筛选条件
    setQuickDateFilter,
    getCurrentFilters,
    getCurrentFiltersFn, // 函数版本，用于向后兼容
    
    
    // 设置器
    setFilters,
    setColumnFilters,
    setKeywordSearch
  };
};
