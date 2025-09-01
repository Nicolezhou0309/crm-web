import { useState, useCallback, useRef, useEffect, useMemo } from 'react';
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
  const [loadingMore, setLoadingMore] = useState(false); // 加载更多状态
  const [pagination, setPagination] = useState<PaginationState>({ 
    current: 1, 
    pageSize: 20, 
    total: 0 
  });
  const [forceUpdate, setForceUpdate] = useState(0);

  const localDataRef = useRef<FollowupRecord[]>([]);
  const currentFiltersRef = useRef<FilterParams>({}); // 存储当前筛选条件
  const filtersHashRef = useRef<string>(''); // 🆕 新增：存储筛选条件的哈希值，用于检测变化
  const currentPageRef = useRef<number>(1); // 🆕 新增：存储当前页数的引用，用于确保分页状态一致性

  // 🆕 新增：生成筛选条件哈希值的函数
  const generateFiltersHash = useCallback((filters: FilterParams) => {
    try {
      // 对筛选条件进行排序和序列化，生成稳定的哈希值
      const sortedFilters = Object.keys(filters)
        .sort()
        .reduce((acc, key) => {
          const value = filters[key as keyof FilterParams];
          if (value !== null && value !== undefined && value !== '') {
            if (Array.isArray(value)) {
              acc[key] = value.sort();
            } else {
              acc[key] = value;
            }
          }
          return acc;
        }, {} as Record<string, any>);
      
      return JSON.stringify(sortedFilters);
    } catch (error) {
      console.error('生成筛选条件哈希值失败:', error);
      return '';
    }
  }, []);

  // 初始化时自动加载数据
  useEffect(() => {
    // 延迟调用，确保 fetchFollowups 已经定义
    const timer = setTimeout(() => {
      if (typeof fetchFollowups === 'function') {
        fetchFollowups();
      }
    }, 100);
    
    return () => clearTimeout(timer);
  }, []); // 保持空依赖，避免循环依赖

  // 允许的参数（与SQL函数声明一致）
  const allowedParams = [
    'p_created_at_end', 'p_created_at_start', 
    'p_customerprofile', 'p_followupresult', 'p_followupstage',
    'p_interviewsales_user_id', 'p_leadid', 'p_leadtype',
    'p_limit', 'p_majorcategory', 
    'p_moveintime_end', 'p_moveintime_start',
    'p_moveintime_not_null',  // 🆕 新增：入住时间非空条件参数
    'p_scheduletime_start', 'p_scheduletime_end', 'p_scheduletime_not_null', // 🆕 新增：预约时间相关参数
    'p_offset', 'p_remark',
    'p_scheduledcommunity', 'p_showingsales_user',
    'p_source', 'p_userbudget', 'p_userbudget_min', 'p_userbudget_max', 'p_userrating',
    'p_wechat', 'p_worklocation', 'p_phone', 'p_qq', 'p_location', 'p_budget',
    'p_douyinid', 'p_douyin_accountname', 'p_staffname', 'p_redbookid', 'p_area',
    'p_notelink', 'p_campaignid', 'p_campaignname', 'p_unitid', 'p_unitname',
    'p_creativedid', 'p_creativename', 'p_traffictype', 'p_interactiontype',
    'p_douyinleadid', 'p_leadstatus', 'p_keyword'
  ];

  const fetchFollowups = useCallback(async (
    filters: FilterParams = {},
    page = pagination.current,
    pageSize = pagination.pageSize,
    append = false // 是否追加数据而不是替换
  ) => {
    // 🆕 关键修复：在开始获取数据前检查筛选条件一致性
    const newFiltersHash = generateFiltersHash(filters);
    const currentFiltersHash = filtersHashRef.current;
    
    // 🆕 保护机制：检查筛选条件是否有效
    if (!filters || Object.keys(filters).length === 0) {
      // 🆕 关键修复：初始加载和追加模式都允许空的筛选条件
      if (page === 1 && !append) {
        console.log('🔄 [useFollowupsData] 初始加载，允许空的筛选条件');
      } else if (append) {
        console.log('🔄 [useFollowupsData] 追加模式，允许空的筛选条件继续加载');
      } else {
        console.warn('⚠️ [useFollowupsData] 检测到空的筛选条件:', {
          filters,
          append,
          page,
          timestamp: new Date().toISOString()
        });
      }
      // 🆕 关键修复：不再阻止空的筛选条件，允许正常的数据加载
    }
    
    // 🆕 关键修复：如果是追加模式，检查筛选条件是否发生变化
    if (append && newFiltersHash !== currentFiltersHash) {
      console.log('🔄 [useFollowupsData] 追加模式下筛选条件发生变化:', {
        newFiltersHash,
        currentFiltersHash,
        filters,
        append,
        page,
        timestamp: new Date().toISOString()
      });
      
      // 🆕 关键修复：避免递归调用，直接返回，让调用方处理
      return;
    }
    
    // 如果是加载更多，使用 loadingMore 状态
    if (append) {
      setLoadingMore(true);
    } else {
      setLoading(true);
    }
    
    try {
      const p_limit = pageSize;
      const p_offset = (page - 1) * pageSize;

      // 构造参数对象 - 确保所有必需参数都有默认值
      const params: Record<string, any> = {
        // 基础分页参数
        p_limit,
        p_offset,
        
        // 筛选条件参数
        ...filters,
        
        // 确保所有必需参数都有默认值（与数据库函数参数顺序一致）
        p_created_at_end: filters.p_created_at_end || null,
        p_created_at_start: filters.p_created_at_start || null,
        p_customerprofile: filters.p_customerprofile || null,
        p_followupresult: filters.p_followupresult || null,
        p_followupstage: filters.p_followupstage || null,
        p_interviewsales_user_id: filters.p_interviewsales_user_id || null,
        p_leadid: filters.p_leadid || null,
        p_leadtype: filters.p_leadtype || null,
        p_majorcategory: filters.p_majorcategory || null,
        p_moveintime_end: filters.p_moveintime_end || null,
        p_moveintime_start: filters.p_moveintime_start || null,
        p_moveintime_not_null: filters.p_moveintime_not_null || null,
        p_scheduletime_start: filters.p_scheduletime_start || null,
        p_scheduletime_end: filters.p_scheduletime_end || null,
        p_scheduletime_not_null: filters.p_scheduletime_not_null || null,
        p_remark: filters.p_remark || null,
        p_scheduledcommunity: filters.p_scheduledcommunity || null,
        p_showingsales_user: filters.p_showingsales_user || null,
        p_source: filters.p_source || null,
        p_userbudget: filters.p_userbudget || null,
        p_userbudget_min: filters.p_userbudget_min || null,
        p_userbudget_max: filters.p_userbudget_max || null,
        p_userrating: filters.p_userrating || null,
        p_wechat: filters.p_wechat || null,
        p_worklocation: filters.p_worklocation || null,
        p_phone: filters.p_phone || null,
        p_qq: filters.p_qq || null,
        p_location: filters.p_location || null,
        p_budget: filters.p_budget || null,
        p_douyinid: filters.p_douyinid || null,
        p_douyin_accountname: filters.p_douyin_accountname || null,
        p_staffname: filters.p_staffname || null,
        p_redbookid: filters.p_redbookid || null,
        p_area: filters.p_area || null,
        p_notelink: filters.p_notelink || null,
        p_campaignid: filters.p_campaignid || null,
        p_campaignname: filters.p_campaignname || null,
        p_unitid: filters.p_unitid || null,
        p_unitname: filters.p_unitname || null,
        p_creativedid: filters.p_creativedid || null,
        p_creativename: filters.p_creativename || null,
        p_traffictype: filters.p_traffictype || null,
        p_interactiontype: filters.p_interactiontype || null,
        p_douyinleadid: filters.p_douyinleadid || null,
        p_leadstatus: filters.p_leadstatus || null,
        p_keyword: filters.p_keyword || null
      };

      // 确保数组参数正确传递
      const arrayParams = [
        'p_customerprofile', 'p_followupresult', 'p_followupstage',
        'p_interviewsales_user_id', 'p_leadid', 'p_leadtype',
        'p_majorcategory', 'p_scheduledcommunity', 'p_source', 'p_userbudget', 'p_userrating',
        'p_wechat', 'p_worklocation', 'p_phone', 'p_qq', 'p_location', 'p_budget',
        'p_douyinid', 'p_douyin_accountname', 'p_staffname', 'p_redbookid', 'p_area',
        'p_notelink', 'p_campaignid', 'p_campaignname', 'p_unitid', 'p_unitname',
        'p_creativedid', 'p_creativename', 'p_traffictype', 'p_interactiontype',
        'p_douyinleadid', 'p_leadstatus'
      ];
      
      // 🆕 添加工作地点筛选条件日志
      if (params.p_worklocation) {
        console.log('🔍 [useFollowupsData] 工作地点筛选条件:', {
          original: params.p_worklocation,
          type: typeof params.p_worklocation,
          isArray: Array.isArray(params.p_worklocation),
          length: Array.isArray(params.p_worklocation) ? params.p_worklocation.length : 'N/A'
        });
      }

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
        'p_moveintime_start', 'p_moveintime_end',
        'p_scheduletime_start', 'p_scheduletime_end' // 🆕 新增：预约时间参数
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

      // 🆕 添加RPC调用前的参数日志
      console.log('🔍 [useFollowupsData] RPC调用参数:', {
        allParams: params,
        rpcParams: rpcParams,
        worklocationParam: rpcParams.p_worklocation,
        timestamp: new Date().toISOString()
      });

      const { data: responseData, error } = await supabase.rpc('filter_followups', rpcParams);
      
      if (error) {
        console.error('❌ [useFollowupsData] API调用失败:', error);
        message.error('获取跟进记录失败: ' + error.message);
        return;
      }

      // 🆕 添加RPC调用成功后的数据日志
      console.log('✅ [useFollowupsData] RPC调用成功:', {
        responseDataLength: responseData?.length || 0,
        worklocationFilter: rpcParams.p_worklocation,
        sampleData: responseData?.slice(0, 3)?.map((item: any) => ({
          id: item.id,
          leadid: item.leadid,
          worklocation: item.worklocation,
          created_at: item.created_at
        })),
        timestamp: new Date().toISOString()
      });
      

      // 🆕 优化：尝试获取总数，如果不存在则使用实际数据长度
      let total = 0;
      if (responseData && responseData.length > 0) {
        if (responseData[0].total_count !== undefined && responseData[0].total_count !== null) {
          total = Number(responseData[0].total_count);
        } else {
          // 如果没有total_count字段，使用实际数据长度
          total = responseData.length;
        }
      } else if (responseData && responseData.length === 0) {
        // 如果API返回空数组，说明没有匹配的数据
        // 此时应该将total设置为0，但需要清空现有数据
        total = 0;
      } else {
        // 如果responseData为null或undefined
        total = 0;
      }

      // 🆕 关键修复：在追加模式下，如果总数变为0但当前有数据，保持之前的总数
      if (append && total === 0 && data.length > 0) {
        console.warn('⚠️ [useFollowupsData] 检测到总数异常变化，保持之前的总数:', {
          newTotal: total,
          currentDataLength: data.length,
          previousTotal: pagination.total,
          page,
          filters
        });
        total = pagination.total;
      }
      
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
      
      // 🆕 优化：根据是否追加数据来更新状态，确保分页准确性
      if (append) {
        // 🆕 关键修复：在追加模式下，验证数据一致性
        if (total === 0 && data.length > 0) {
          console.error('❌ [useFollowupsData] 数据不一致：总数为0但当前有数据，停止追加');
          console.error('❌ [useFollowupsData] 数据不一致详情:', {
            currentDataLength: data.length,
            newDataLength: safeData.length,
            total,
            page,
            filters: currentFiltersRef.current
          });
          // 不更新数据，保持当前状态
          setLoadingMore(false);
          return;
        }
        
        // 🆕 简单修复：直接使用 localDataRef.current 而不是 data 状态
        const existingIds = new Set(localDataRef.current.map(item => item.id));
        const newData = safeData.filter(item => !existingIds.has(item.id));
        const combinedData = [...localDataRef.current, ...newData];

        
        // 🆕 记录追加后的线索阶段分布
        const stageDistribution = combinedData.reduce((acc: Record<string, number>, record: any) => {
          const stage = record.followupstage || '未知阶段';
          acc[stage] = (acc[stage] || 0) + 1;
          return acc;
        }, {});
        

        
        setData(combinedData);
        setLocalData(combinedData);
        localDataRef.current = combinedData;
        setPagination(prev => ({ ...prev, total, current: page, pageSize }));
        // 🆕 同步更新当前页数引用
        currentPageRef.current = page;
      } else {

        
        // 🆕 记录替换后的线索阶段分布
        if (safeData.length > 0) {
          const stageDistribution = safeData.reduce((acc: Record<string, number>, record: any) => {
            const stage = record.followupstage || '未知阶段';
            acc[stage] = (acc[stage] || 0) + 1;
            return acc;
          }, {});
          
          const sourceDistribution = safeData.reduce((acc: Record<string, number>, record: any) => {
            const source = record.source || '未知来源';
            acc[source] = (acc[source] || 0) + 1;
            return acc;
          }, {});
          
        }
        
        // 如果API返回空数据，清空现有数据
        if (responseData && responseData.length === 0) {
          setData([]);
          setLocalData([]);
          localDataRef.current = [];
        } else {
          setData(safeData);
          setLocalData(safeData);
          localDataRef.current = safeData;
        }
        setPagination(prev => ({ ...prev, total, current: 1, pageSize }));
        // 🆕 同步更新当前页数引用
        currentPageRef.current = 1;
      }
      
      // 🆕 保存当前筛选条件和哈希值
      currentFiltersRef.current = filters;
      filtersHashRef.current = generateFiltersHash(filters);
      
      // 🆕 同步更新当前页数引用
      currentPageRef.current = page;
      
      
    } catch (error) {
      console.error('fetchFollowups执行失败:', error);
      message.error('获取跟进记录失败');
      
      // 如果是替换数据失败，清空数据状态
      if (!append) {
        setData([]);
        setLocalData([]);
        localDataRef.current = [];
        setPagination(prev => ({ ...prev, total: 0, current: 1 }));

      } else {

      }
    } finally {
      setLoading(false);
      setLoadingMore(false);

    }
  }, [pagination.current, pagination.pageSize]); // 保持最小依赖，避免循环依赖

  const updateLocalData = useCallback((id: string, field: keyof FollowupRecord, value: any) => {
    
    // 🆕 修复：优先使用 localDataRef 中的最新数据
    const currentData = localDataRef.current.length > 0 ? localDataRef.current : data;
    const recordIndex = currentData.findIndex(item => item.id === id);
    

    if (recordIndex === -1) {
      console.warn('⚠️ [useFollowupsData] 未找到要更新的记录', { id, field, value });
      return;
    }
    
    const newData = [...currentData];
    newData[recordIndex] = { ...newData[recordIndex], [field]: value };
    

    // 🆕 修复：先更新 ref，再更新 state，确保数据一致性
    localDataRef.current = newData;
    
    // 🆕 修复：同时更新 localData 和 data 状态
    setLocalData(newData);
    setData(newData);
    
    // 🆕 新增：强制触发重新渲染
    setForceUpdate(prev => prev + 1);
    

    // 🆕 特别记录卡片数据更新后的状态
    const updatedRecord = newData[recordIndex];
    // 🆕 验证状态更新是否成功
    setTimeout(() => {
      // 🆕 修复：使用 ref 中的最新数据来验证，而不是可能过时的 state
      const currentData = localDataRef.current.find(item => item.id === id);

    }, 100);
  }, []); // 🆕 修复：移除 data 依赖，避免函数重新创建导致的状态更新问题

  // 🆕 优化：检查是否还有更多数据，考虑筛选条件变化的情况
  const hasMore = useMemo(() => {
    // 🆕 关键修复：如果总数为0，说明没有数据
    if (pagination.total === 0) return false;
    
    // 🆕 关键修复：如果当前数据长度大于等于总数，说明已加载完所有数据
    if (data.length >= pagination.total) return false;
    
    // 🆕 关键修复：如果当前页数已经超过理论最大页数，说明有问题，停止加载
    const maxPage = Math.ceil(pagination.total / pagination.pageSize);
    if (pagination.current >= maxPage) return false;
    
    // 如果当前数据长度小于总数，说明还有更多数据
    return data.length < pagination.total;
  }, [pagination.total, data.length, pagination.current, pagination.pageSize]);
  
 

  // 🆕 优化：加载更多数据，确保筛选条件一致性
  const loadMore = useCallback(async () => {
    // 🆕 关键修复：检查数据一致性
    if (data.length > 0 && pagination.total === 0) {
      console.error('❌ [useFollowupsData] loadMore 数据不一致：有数据但总数为0，停止加载');
      console.error('❌ [useFollowupsData] 数据不一致详情:', {
        currentDataLength: data.length,
        total: pagination.total,
        currentPage: pagination.current,
        pageSize: pagination.pageSize
      });
      return;
    }
    
    // 检查是否正在加载或没有更多数据
    if (loadingMore || !hasMore) {
      return;
    }
    
    const nextPage = pagination.current + 1;
    const hasMoreData = data.length < pagination.total;
    
    if (hasMoreData) {
      // 🆕 关键修复：确保使用当前筛选条件加载更多数据，并添加保护机制
      const currentFilters = currentFiltersRef.current;
      
      // 🆕 关键修复：处理无筛选条件的情况，确保无限滚动正常工作
      if (!currentFilters || Object.keys(currentFilters).length === 0) {
        console.log('🔄 [useFollowupsData] loadMore 无筛选条件，使用空对象继续加载');
        // 即使没有筛选条件，也允许加载更多，这是正常的初始状态
        await fetchFollowups({}, nextPage, pagination.pageSize, true);
      } else {
        await fetchFollowups(currentFilters, nextPage, pagination.pageSize, true);
      }
    } else {
      console.log('🔄 [useFollowupsData] loadMore 已无更多数据');
    }
  }, [loadingMore, hasMore, pagination.current, pagination.pageSize, pagination.total, data.length, fetchFollowups]); // 保持必要依赖

  const refreshData = useCallback(async (newFilters?: any) => {
    
    if (newFilters) {
   
      // 🆕 记录筛选条件变化详情
      const oldFilters = currentFiltersRef.current;
      const oldFiltersHash = filtersHashRef.current;
      const newFiltersHash = generateFiltersHash(newFilters);

      
      // 🆕 记录筛选条件变化对线索阶段的影响
      const oldStageFilter = oldFilters.p_followupstage;
      const newStageFilter = newFilters.p_followupstage;
      const stageFilterChanged = JSON.stringify(oldStageFilter) !== JSON.stringify(newStageFilter);
      
      if (stageFilterChanged) {
      }
      
      // 🆕 更新筛选条件哈希值
      filtersHashRef.current = newFiltersHash;
      
      // 🆕 关键修复：清理现有数据
      setData([]);
      setLocalData([]);
      localDataRef.current = [];
      
      // 🆕 关键修复：重置分页和加载状态，确保分页状态完全重置
      setPagination(prev => ({ 
        ...prev, 
        current: 1, 
        total: 0,
        // 🆕 确保分页状态完全重置
        pageSize: prev.pageSize 
      }));
      setLoadingMore(false);
      
      // 🆕 关键修复：强制重置当前页数引用，避免分页状态不一致
      currentPageRef.current = 1;
      
      // 🆕 关键修复：使用 Promise 确保数据获取完成后再继续
      try {
        await fetchFollowups(newFilters, 1, pagination.pageSize);
        
        // 🆕 关键修复：不再等待状态更新，让 React 自然处理
      } catch (error) {
        console.error('❌ [useFollowupsData] 新筛选条件下数据获取失败:', error);
        // 如果获取失败，尝试恢复之前的数据
        message.error('筛选失败，请重试');
      }
    } else {
      // 🆕 关键修复：当没有新筛选条件时，使用当前筛选条件或空对象
      const currentFilters = currentFiltersRef.current;
      if (currentFilters && Object.keys(currentFilters).length > 0) {
        console.log('🔄 [useFollowupsData] refreshData 使用当前筛选条件刷新数据');
        fetchFollowups(currentFilters);
      } else {
        console.log('🔄 [useFollowupsData] refreshData 无筛选条件，使用空对象刷新数据');
        fetchFollowups({});
      }
    }
  }, [fetchFollowups, pagination.pageSize, generateFiltersHash]); // 保持必要依赖

  const resetPagination = useCallback(() => {
    setPagination(prev => ({ ...prev, current: 1 }));
  }, []); // 无依赖，使用 ref 避免循环依赖

  return {
    data,
    localData,
    loading,
    loadingMore,
    pagination,
    forceUpdate,
    hasMore,
    fetchFollowups,
    updateLocalData,
    refreshData,
    loadMore,
    resetPagination,
    setPagination,
    setData,
    setLocalData,
    setForceUpdate
  };
};
