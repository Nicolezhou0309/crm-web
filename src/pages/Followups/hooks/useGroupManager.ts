import { useState, useCallback, useRef, useEffect } from 'react'; 
import { supabase } from '../../../supaClient';
import type { GroupData, FilterParams } from '../types';
import dayjs from 'dayjs';

export const useGroupManager = () => {
  const [groupField, setGroupField] = useState<string>('followupstage'); // 设置默认值，不再允许undefined
  const [selectedGroup, setSelectedGroup] = useState<string>('');
  const [groupData, setGroupData] = useState<any[]>([]);
  const [groupTotal, setGroupTotal] = useState<number>(0);
  const [groupLoading, setGroupLoading] = useState(false);
  const [groupPanelOpen, setGroupPanelOpen] = useState(true); // 默认展开分组面板

  // 初始化时自动加载分组数据
  useEffect(() => {
    if (groupField) {
      // 延迟调用，确保 fetchGroupData 已经定义
      setTimeout(() => {
        fetchGroupData(groupField);
      }, 0);
    }
  }, [groupField]);

  // 防重复调用机制
  const fetchGroupCountRef = useRef<{ [key: string]: number }>({});
  const pendingGroupCalls = useRef(new Set<string>());

  // 分组字段选项
  const groupFieldOptions = [
    { value: 'followupstage', label: '跟进阶段' },
    { value: 'scheduledcommunity', label: '预约社区' },
    { value: 'source', label: '线索来源' },
    { value: 'created_at', label: '创建日期' }
  ];

  // 获取分组统计数据
  const fetchGroupData = useCallback(async (groupField: string, filters: FilterParams = {}) => {
    if (!groupField) {
      return;
    }

    
    try {
      // 构建查询参数
      let params: any = {
        p_groupby_field: groupField
      };
      
      // 处理筛选条件
      if (filters && Object.keys(filters).length > 0) {
        // 处理数组参数
        const arrayParams = [
          'p_leadid', 'p_leadtype', 'p_interviewsales_user_id', 'p_followupstage',
          'p_customerprofile', 'p_worklocation', 'p_userbudget', 'p_userrating',
          'p_majorcategory', 'p_subcategory', 'p_followupresult', 'p_scheduletime_start',
          'p_scheduletime_end', 'p_scheduledcommunity', 'p_wechat', 'p_worklocation', 'p_phone', 'p_remark', 'p_subcategory', 'p_showingsales_user'
        ];
        
        arrayParams.forEach(key => {
          if (key in filters) {
            const value = filters[key];
            
            if (value === null || value === undefined) {
              // 保持null值，不删除
              params[key] = [null];
            } else if (!Array.isArray(value)) {
              // 如果不是数组，转换为数组
              params[key] = [value];
            } else if (Array.isArray(value) && value.length === 0) {
              // 如果是空数组，删除该参数
              delete params[key];
            } else {
              // 确保数组参数正确传递，并验证枚举值
              if (key === 'p_followupstage' || key === 'p_customerprofile' || key === 'p_userrating' || key === 'p_scheduledcommunity' || key === 'p_source') {
                // 验证枚举值是否有效（非空字符串）
                const validValues = value.filter((v: any) => v !== null && v !== undefined && v !== '');
                if (validValues.length > 0) {
                  params[key] = validValues;
                } else {
                  delete params[key];
                }
              } else {
                params[key] = value;
              }
            }
          }
        });
        
        // 确保其他必需的数组参数也被正确处理
        const additionalArrayParams = [
          'p_subcategory', 'p_scheduletime_start', 'p_scheduletime_end', 'p_showingsales_user'
        ];
        additionalArrayParams.forEach(key => {
          if (key in params) {
            const value = (params as any)[key];
            
            if (value === null || value === undefined) {
              // 保持null值，不删除
              (params as any)[key] = [null];
            } else if (!Array.isArray(value)) {
              // 如果不是数组，转换为数组
              (params as any)[key] = [value];
            } else if (Array.isArray(value) && value.length === 0) {
              // 如果是空数组，删除该参数
              delete (params as any)[key];
            }
          }
        });
        
        // 处理日期参数 - 转换为ISO字符串以匹配修复后的数据库函数（text类型参数）
        const dateParams = [
          'p_created_at_start', 'p_created_at_end',
          'p_moveintime_start', 'p_moveintime_end'
        ];
        
        dateParams.forEach(key => {
          if (key in filters && filters[key]) {
            try {
              let dateValue = filters[key];
              let formattedDate: string;
              
              if (typeof dateValue === 'string') {
                // 字符串类型，验证并保持为ISO格式
                const parsedDate = dayjs(dateValue);
                if (parsedDate.isValid()) {
                  formattedDate = parsedDate.toISOString();
                } else {
                  delete params[key];
                  return;
                }
              } else if (dayjs.isDayjs(dateValue)) {
                formattedDate = dateValue.toISOString();
              } else if (dateValue instanceof Date) {
                // Date对象转换为ISO字符串
                formattedDate = dateValue.toISOString();
              } else {
                const convertedDate = dayjs(dateValue);
                if (convertedDate.isValid()) {
                  formattedDate = convertedDate.toISOString();
                } else {
                  delete params[key];
                  return;
                }
              }
              
              // 使用ISO字符串格式，匹配数据库函数的text参数类型
              params[key] = formattedDate;
            } catch (error) {
              console.warn(`[useGroupManager] 日期参数处理失败 ${key}:`, error);
              delete params[key];
            }
          }
        });
      }
      
      // 参数排序，确保一致性
      const orderedParams: any = {};
      const priorityKeys = ['p_groupby_field'];
      const sortedKeys = Object.keys(params).sort();
      
      // 先添加优先级键
      priorityKeys.forEach(key => {
        if (key in params) {
          orderedParams[key] = (params as any)[key];
        }
      });
      
      // 再添加其他键
      sortedKeys.forEach(key => {
        if (!priorityKeys.includes(key)) {
          orderedParams[key] = (params as any)[key];
        }
      });

      
      // 构建完整的筛选参数，按照 group_count_filter_followups 函数的参数顺序
      const completeParams: any = {
        p_groupby_field: groupField,
        // 按照函数定义的参数顺序排列
        p_leadid: filters.p_leadid || null,
        p_leadtype: filters.p_leadtype || null,
        p_interviewsales_user_id: filters.p_interviewsales_user_id || null,
        p_followupstage: filters.p_followupstage || null,
        p_customerprofile: filters.p_customerprofile || null,
        p_worklocation: filters.p_worklocation || null,
        p_userbudget: filters.p_userbudget || null,
        p_moveintime_start: filters.p_moveintime_start || null,
        p_moveintime_end: filters.p_moveintime_end || null,
        p_userrating: filters.p_userrating || null,
        p_majorcategory: filters.p_majorcategory || null,
        p_subcategory: filters.p_subcategory || null,
        p_followupresult: filters.p_followupresult || null,
        p_scheduletime_start: filters.p_scheduletime_start || null,
        p_scheduletime_end: filters.p_scheduletime_end || null,
        p_scheduledcommunity: filters.p_scheduledcommunity || null,
        p_keyword: filters.p_keyword || null,
        p_wechat: filters.p_wechat || null,
        p_phone: filters.p_phone || null,
        p_source: filters.p_source || null,
        p_created_at_start: filters.p_created_at_start || null,
        p_created_at_end: filters.p_created_at_end || null,
        p_remark: filters.p_remark || null,
        p_showingsales_user: filters.p_showingsales_user || null
      };
      
    
      
      const result = await supabase.rpc('group_count_filter_followups', completeParams);
      const { data, error } = result;
      
      if (error) {
        console.error('❌ [useGroupManager] RPC函数调用失败:', error);
        setGroupData([]);
        setGroupTotal(0);
        return;
      }
      
      const transformedData = transformGroupData(data || []);
      setGroupData(transformedData);
      
      // 计算并更新分组总数
      const total = transformedData.reduce((sum, group) => sum + group.count, 0);
      setGroupTotal(total);
      
    } catch (error) {
      console.error('❌ [useGroupManager] 异常:', error);
      setGroupData([]);
      setGroupTotal(0); // 出错时重置总数
    }
  }, [supabase]);


  const fetchGroupDataFallback = useCallback(async (groupField: string, filters: any) => {
    try {
      
      // 构建基本的查询
      let query = supabase
        .from('followups')
        .select('id, ' + groupField + ', created_at, leadtype, followupstage, customerprofile, worklocation, userbudget, userrating, majorcategory, followupresult, scheduledcommunity');
      
      // 应用时间筛选条件
      if (filters.p_created_at_start) {
        query = query.gte('created_at', filters.p_created_at_start);
      }
      if (filters.p_created_at_end) {
        query = query.lte('created_at', filters.p_created_at_end);
      }
      
      // 应用其他筛选条件
      if (filters.p_leadtype && filters.p_leadtype.length > 0) {
        query = query.in('leadtype', filters.p_leadtype);
      }
      if (filters.p_followupstage && filters.p_followupstage.length > 0) {
        query = query.in('followupstage', filters.p_followupstage);
      }
      if (filters.p_customerprofile && filters.p_customerprofile.length > 0) {
        query = query.in('customerprofile', filters.p_customerprofile);
      }
      if (filters.p_worklocation && filters.p_worklocation.length > 0) {
        query = query.in('worklocation', filters.p_worklocation);
      }
      if (filters.p_userbudget_min !== undefined && filters.p_userbudget_min !== null) {
        query = query.gte('userbudget', filters.p_userbudget_min);
      }
      if (filters.p_userbudget_max !== undefined && filters.p_userbudget_max !== null) {
        query = query.lte('userbudget', filters.p_userbudget_max);
      }
      if (filters.p_userrating && filters.p_userrating.length > 0) {
        query = query.in('userrating', filters.p_userrating);
      }
      if (filters.p_majorcategory && filters.p_majorcategory.length > 0) {
        query = query.in('majorcategory', filters.p_majorcategory);
      }
      if (filters.p_followupresult && filters.p_followupresult.length > 0) {
        query = query.in('followupresult', filters.p_followupresult);
      }
      if (filters.p_scheduledcommunity && filters.p_scheduledcommunity.length > 0) {
        query = query.in('scheduledcommunity', filters.p_scheduledcommunity);
      }
      
      // 应用关键词搜索
      if (filters.p_keyword) {
        query = query.ilike('leadid', `%${filters.p_keyword}%`);
      }
      
      const { data, error } = await query;
      
      if (error) {
        console.error('❌ [useGroupManager] 降级查询失败:', error);
        return null;
      }
      
      // 手动计算分组统计
      const groupCounts: { [key: string]: number } = {};
      data?.forEach((item: any) => {
        const groupValue = (item as any)[groupField] || '未分组';
        groupCounts[groupValue] = (groupCounts[groupValue] || 0) + 1;
      });
      
      // 转换为标准格式
      return Object.entries(groupCounts).map(([groupValue, count]) => ({
        group_id: groupValue,
        group_value: groupValue,
        count
      }));
      
    } catch (error) {
      console.error('❌ [useGroupManager] 降级查询异常:', error);
      return null;
    }
  }, [supabase]);

  // 数据转换函数：将数据库返回的数据转换为GroupData格式
  const transformGroupData = useCallback((rawData: any[]): GroupData[] => {
    if (!rawData || !Array.isArray(rawData)) return [];
    
    return rawData.map((item, index) => {
      // 确保key的唯一性
      let key = item.group_id;
      let groupValue = item.group_id;
      let groupText = item.group_value;
      
      // 处理null/undefined值，确保key唯一
      if (key === null || key === undefined || key === 'null' || key === '') {
        key = `null_${index}`; // 使用索引确保唯一性
        groupValue = 'null';
        groupText = '未分配';
      } else {
        key = String(key);
        groupValue = String(item.group_id);
        groupText = item.group_value || String(item.group_id);
      }
      
      return {
        key,
        groupValue,
        groupText,
        count: Number(item.count) || 0
      };
    });
  }, []);

  // 分组按钮点击处理 - 完善与旧页面相同的逻辑
  const handleGroupClick = useCallback((groupKey: string | number | null | undefined) => {
    if (!groupField) return;
    
    const filterKey = 'p_' + groupField;
    let newFilters: FilterParams = {};
    
    // 判断未分组/NULL值
    const isNullOrEmpty = groupKey === null || groupKey === undefined || 
      String(groupKey).toLowerCase() === 'null' || String(groupKey) === '' || 
      (typeof groupKey === 'number' && (isNaN(groupKey) || groupKey === 0)) ||
      (groupField === 'scheduledcommunity' && String(groupKey) === '未分组');

    if (selectedGroup === String(groupKey)) {
      // 取消分组：移除该filterKey和日期区间
      setSelectedGroup('');
      return { shouldResetPagination: true, newFilters: {} };
    } else if (groupField === 'created_at') {
      // 日期分组，传递区间参数
      const dateStr = String(groupKey);
      if (isNullOrEmpty) {
        newFilters = { p_created_at_start: null, p_created_at_end: null };
        setSelectedGroup('null');
      } else {
        // 使用dayjs处理日期区间 - 修复与旧页面保持一致，使用Date对象
        const startDate = dayjs(dateStr).startOf('day').toDate();
        const endDate = dayjs(dateStr).endOf('day').toDate();
        newFilters = { p_created_at_start: startDate as any, p_created_at_end: endDate as any };
        setSelectedGroup(dateStr);
      }
    } else {
      // 统一处理所有字段的NULL值
      if (isNullOrEmpty) {
        newFilters = { [filterKey]: [null] };
        setSelectedGroup('null');
      } else {
        if (groupField === 'interviewsales_user_id' || groupField === 'showingsales_user_id') {
          const numVal = Number(groupKey);
          newFilters = { [filterKey]: [isNaN(numVal) ? null : numVal] };
        } else {
          newFilters = { [filterKey]: [String(groupKey)] };
        }
        setSelectedGroup(String(groupKey));
      }
    }
    
    return { shouldResetPagination: true, newFilters };
  }, [groupField, selectedGroup]);

  // 设置分组字段
  const setGroupFieldWithData = useCallback((field: string) => {
    setGroupField(field);
    setGroupPanelOpen(true); // 始终展开分组面板
    fetchGroupData(field);
  }, [fetchGroupData]);

  // 清除分组数据时同时清除总数
  const clearGroupData = useCallback(() => {
    setGroupData([]);
    setGroupTotal(0);
    setSelectedGroup('');
  }, []);

  // 检查当前分组条件是否存在，自动高亮
  const syncSelectedGroup = useCallback((filters: FilterParams) => {
    const filterKey = 'p_' + groupField;
    if (filters[filterKey] && Array.isArray(filters[filterKey]) && filters[filterKey][0]) {
      const value = filters[filterKey][0];
      // 处理NULL值
      if (value === null || value === 'null') {
        setSelectedGroup('null');
      } else {
        setSelectedGroup(String(value));
      }
    } else if (groupField === 'created_at' && (filters.p_created_at_start || filters.p_created_at_end)) {
      const startDate = filters.p_created_at_start;
      if (startDate) {
        // 提取日期部分，去掉时间
        const dateOnly = dayjs(startDate).format('YYYY-MM-DD');
        setSelectedGroup(dateOnly);
      } else {
        setSelectedGroup('');
      }
    } else {
      setSelectedGroup('');
    }
  }, [groupField]);

  return {
    // 状态
    groupField,
    selectedGroup,
    groupData,
    groupTotal,
    groupLoading,
    groupPanelOpen,
    groupFieldOptions,
    
    // 方法
    fetchGroupData,
    handleGroupClick,
    setGroupFieldWithData,
    syncSelectedGroup,
    clearGroupData,
    
    // 设置器
    setGroupField,
    setSelectedGroup,
    setGroupData,
    setGroupTotal,
    setGroupPanelOpen
  };
};
