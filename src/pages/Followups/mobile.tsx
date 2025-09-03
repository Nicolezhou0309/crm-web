import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { message, Spin, Modal, Button, Upload, Select } from 'antd';
import { Card, Popup, Form, Input, Button as MobileButton, Space, Selector, CheckList, CalendarPicker } from 'antd-mobile';
import { UploadOutlined } from '@ant-design/icons';
import { MobileFollowupStageDrawer } from './components/MobileFollowupStageDrawer';
import MobileHeader from './components/MobileHeader';
import { CustomerCard } from './components/CustomerCard';
import { useFollowupsData } from './hooks/useFollowupsData';
import { useFilterManager } from './hooks/useFilterManager';
import { useEnumData } from './hooks/useEnumData';
import { useFrequencyControl } from './hooks/useFrequencyControl';
import { useInfiniteScroll } from './hooks/useInfiniteScroll';
import { getServiceManager } from '../../components/Followups/services/ServiceManager';
import { useUser } from '../../context/UserContext';
import { supabase } from '../../supaClient';
import imageCompression from 'browser-image-compression';
import type { FollowupRecord } from './types';
import dayjs from 'dayjs';
import { toBeijingTime, toBeijingDateStr, getCurrentBeijingTime, getDayStart, getDayEnd, toBeijingDateTimeStr } from '../../utils/timeUtils';

const MobileFollowups: React.FC = () => {
  const { profile } = useUser();
  
  // 初始化服务管理器
  useEffect(() => {
    const initServices = async () => {
      if (profile?.id) {
        const serviceManager = getServiceManager();
        await serviceManager.initialize(Number(profile.id));
        serviceManager.setUserId(Number(profile.id));
      }
    };
    initServices();
  }, [profile]);

  // 获取回退理由选项
  useEffect(() => {
    const fetchRollbackReasonOptions = async () => {
      try {
        const { data, error } = await supabase
          .from('Selection')
          .select('selection')
          .eq('id', 3)
          .single();
        if (!error && data && data.selection) {
          setRollbackReasonOptions(data.selection.map((item: any) => ({ value: item.value, label: item.label })));
        }
      } catch (error) {
        console.error('获取回退理由选项失败:', error);
      }
    };
    fetchRollbackReasonOptions();
  }, []);

  // 使用自定义Hooks
  const followupsData = useFollowupsData();
  const filterManager = useFilterManager();
  const enumData = useEnumData();
  const frequencyControl = useFrequencyControl();

  // 🆕 新增：默认一级分类全部选中
  useEffect(() => {
    if (enumData.majorCategoryOptions && enumData.majorCategoryOptions.length > 0) {
      // 获取所有一级分类
      const allPrimaryCategories = enumData.majorCategoryOptions.map((item: any) => item.value);
      
      // 自动映射所有一级分类到二级分类
      const allMappedSubcategories: string[] = [];
      enumData.majorCategoryOptions.forEach((category: any) => {
        if ((category as any).children) {
          // 如果有子级，添加所有二级分类
          (category as any).children.forEach((subcategory: any) => {
            allMappedSubcategories.push(subcategory.value);
          });
        } else {
          // 如果没有子级，直接添加一级分类值
          allMappedSubcategories.push(category.value);
        }
      });
      
      // 去重并设置默认值
      const uniqueSubcategories = [...new Set(allMappedSubcategories)];
      
      console.log('🔍 [MobileFollowups] 默认一级分类全部选中:', {
        allPrimaryCategories,
        allMappedSubcategories,
        uniqueSubcategories,
        totalCount: uniqueSubcategories.length
      });
      
      setFilterValues(prev => ({
        ...prev,
        majorcategory: uniqueSubcategories,
        majorcategory_primary: allPrimaryCategories
      }));
    }
  }, [enumData.majorCategoryOptions]);

  // 🆕 卡片数据状态日志记录
  useEffect(() => {
    if (followupsData?.data && followupsData.data.length > 0) {
      console.log('📊 [MobileFollowups] 数据加载完成，开始分析数据分布');
      
      // 分析线索阶段分布
      const stageDistribution = followupsData.data.reduce((acc: Record<string, number>, record: any) => {
        const stage = record.followupstage || '未知阶段';
        acc[stage] = (acc[stage] || 0) + 1;
        return acc;
      }, {});
      
      // 分析线索来源分布
      const sourceDistribution = followupsData.data.reduce((acc: Record<string, number>, record: any) => {
        const source = record.source || '未知来源';
        acc[source] = (acc[source] || 0) + 1;
        return acc;
      }, {});
      
      // 分析用户画像分布
      const profileDistribution = followupsData.data.reduce((acc: Record<string, number>, record: any) => {
        const profile = record.customerprofile || '未知画像';
        acc[profile] = (acc[profile] || 0) + 1;
        return acc;
      }, {});
      
      console.log('📊 [MobileFollowups] 数据分布分析结果:', {
        totalRecords: followupsData.data.length,
        stageDistribution,
        sourceDistribution,
        profileDistribution,
        pagination: followupsData.pagination,
        hasMore: followupsData.hasMore,
        loading: followupsData.loading,
        loadingMore: followupsData.loadingMore,
        timestamp: toBeijingDateTimeStr(new Date()),
      });
    }
  }, [followupsData?.data, followupsData?.forceUpdate, followupsData?.pagination, followupsData?.hasMore, followupsData?.loading, followupsData?.loadingMore]);
  
  // 图片压缩选项
  const imageCompressionOptions = useMemo(() => ({
    maxSizeMB: 0.5,
    maxWidthOrHeight: 1280,
    useWebWorker: true,
  }), []);
  
  // 🆕 优化：无限滚动逻辑，确保筛选条件变化后能正确处理
  const handleLoadMore = useCallback(async () => {
    console.log('📄 [MobileFollowups] 触发加载更多，当前状态:', {
      hasMore: followupsData?.hasMore,
      loadingMore: followupsData?.loadingMore,
      currentDataLength: followupsData?.data?.length || 0,
      currentPage: followupsData?.pagination?.current || 1,
      total: followupsData?.pagination?.total || 0,
      pageSize: followupsData?.pagination?.pageSize || 20
    });
    
    // 🆕 额外保护：检查当前数据是否为空，如果为空但总数不为0，说明可能有问题
    if (followupsData?.data?.length === 0 && followupsData?.pagination?.total > 0) {
      console.warn('⚠️ [MobileFollowups] 检测到数据状态异常，跳过加载更多');
      return;
    }
    
    // 🆕 关键修复：检查数据一致性
    if (followupsData?.data?.length > 0 && followupsData?.pagination?.total === 0) {
      console.error('❌ [MobileFollowups] 检测到数据不一致：有数据但总数为0，停止加载更多');
      console.error('❌ [MobileFollowups] 数据不一致详情:', {
        currentDataLength: followupsData?.data?.length || 0,
        total: followupsData?.pagination?.total || 0,
        hasMore: followupsData?.hasMore,
        loadingMore: followupsData?.loadingMore
      });
      return;
    }
    
    // 🆕 关键修复：检查分页状态合理性
    const currentPage = followupsData?.pagination?.current || 1;
    const total = followupsData?.pagination?.total || 0;
    const pageSize = followupsData?.pagination?.pageSize || 20;
    const maxPage = Math.ceil(total / pageSize);
    
    if (currentPage >= maxPage && total > 0) {
      console.warn('⚠️ [MobileFollowups] 已达到最大页数，停止加载更多:', {
        currentPage,
        maxPage,
        total,
        pageSize
      });
      return;
    }
    
    if (followupsData?.hasMore && !followupsData?.loadingMore) {
      try {
        console.log('🔄 [MobileFollowups] 开始加载更多数据，当前页:', currentPage);
        const startTime = toBeijingTime(new Date()).valueOf();
        await followupsData.loadMore();
        const endTime = toBeijingTime(new Date()).valueOf();
        console.log('✅ [MobileFollowups] 加载更多完成，耗时:', endTime - startTime, 'ms');
      } catch (error) {
        console.error('⚠️ [MobileFollowups] 加载更多失败:', error);
        message.error('加载更多失败，请重试');
      }
    } else {
      console.log('📄 [MobileFollowups] 跳过加载更多:', {
        hasMore: followupsData?.hasMore,
        loadingMore: followupsData?.loadingMore
      });
    }
  }, [followupsData?.hasMore, followupsData?.loadingMore, followupsData?.loadMore, followupsData?.data?.length, followupsData?.pagination?.total, followupsData?.pagination?.current, followupsData?.pagination?.pageSize]);

  // 智能瀑布流分配逻辑
  const distributeCardsToColumns = useCallback((data: any[]) => {
    if (!data || data.length === 0) return { leftColumn: [], rightColumn: [] };
    
    const leftColumn: any[] = [];
    const rightColumn: any[] = [];
    
    data.forEach((record) => {
      if (leftColumn.length <= rightColumn.length) {
        leftColumn.push(record);
      } else {
        rightColumn.push(record);
      }
    });
    
    return { leftColumn, rightColumn };
  }, []);

  const { sentinelRef } = useInfiniteScroll({
    onLoadMore: handleLoadMore,
    hasMore: followupsData?.hasMore || false,
    loading: followupsData?.loadingMore || false,
    rootMargin: '200px'
  });
  
  // 抽屉状态
  const [stageDrawerOpen, setStageDrawerOpen] = useState(false);
  const [currentEditRecord, setCurrentEditRecord] = useState<any>(null);
  
  // 筛选面板状态
  const [filterDrawerOpen, setFilterDrawerOpen] = useState(false);
  
  // 工作地点筛选状态
  const [selectedWorkLocationLine, setSelectedWorkLocationLine] = useState<string>('');
  
  // 筛选条件状态管理
  const [filterValues, setFilterValues] = useState({
    followupstage: [] as string[],
    customerprofile: [] as string[],
    interviewsales_user_id: '',
    userbudget_min: '' as string | number,
    userbudget_max: '' as string | number,
    moveintime_start: '',
    moveintime_end: '',
    userrating: [] as string[],
    majorcategory: [] as string[],
    scheduledcommunity: [] as string[],
    showingsales_user: '',
    source: [] as string[],
    created_at_start: '',
    created_at_end: '',
    worklocation: [] as string[],
    majorcategory_primary: [] as string[] // 新增：记录选择的一级分类
  });
  
  // 回退相关状态
  const [rollbackModalVisible, setRollbackModalVisible] = useState(false);
  const [rollbackRecord, setRollbackRecord] = useState<any>(null);
  const [rollbackReason, setRollbackReason] = useState<string | undefined>();
  const [rollbackEvidenceList, setRollbackEvidenceList] = useState<any[]>([]);
  const [rollbackUploading, setRollbackUploading] = useState(false);
  const [rollbackReasonOptions, setRollbackReasonOptions] = useState<any[]>([]);

  // 日期选择器状态
  const [moveInTimeVisible, setMoveInTimeVisible] = useState(false);
  const [createdTimeVisible, setCreatedTimeVisible] = useState(false);
  const [moveInTimeRange, setMoveInTimeRange] = useState<[Date, Date] | null>(null);
  const [createdTimeRange, setCreatedTimeRange] = useState<[Date, Date] | null>(null);
  
  // 新增：跟踪日期选择状态
  const [moveInTimeSelecting, setMoveInTimeSelecting] = useState(false);
  const [createdTimeSelecting, setCreatedTimeSelecting] = useState(false);

  // 🆕 优化：处理关键词搜索，确保无限滚动状态正确重置
  const handleKeywordSearch = useCallback(async (value: string) => {
    try {
      console.log('🔍 [MobileFollowups] 开始关键词搜索:', { value, trimmed: value.trim() });
      
      filterManager?.setKeywordSearch?.(value);
      
      const currentFilters = filterManager?.getCurrentFiltersFn?.() || {};
      const filtersWithKeyword = value.trim() 
        ? { ...currentFilters, p_keyword: value.trim() }
        : { ...currentFilters };
      
      if (!value.trim()) {
        delete filtersWithKeyword.p_keyword;
        console.log('🔍 [MobileFollowups] 清除关键词搜索');
      } else {
        console.log('🔍 [MobileFollowups] 添加关键词搜索:', value.trim());
      }
      
      console.log('🔍 [MobileFollowups] 关键词搜索筛选条件:', {
        currentFilters: Object.keys(currentFilters),
        filtersWithKeyword: Object.keys(filtersWithKeyword),
        keyword: value.trim() || '无'
      });
      
      // 🆕 记录关键词搜索对线索阶段的影响
      const stageFilterAffected = 'p_followupstage' in currentFilters || 'p_followupstage' in filtersWithKeyword;
      if (stageFilterAffected) {
        console.log('🎯 [MobileFollowups] 关键词搜索影响线索阶段筛选');
      }
      
      // 🆕 使用新的筛选条件刷新数据，这会自动清理现有数据并重置分页
      try {
        console.log('🔄 [MobileFollowups] 开始关键词搜索数据刷新');
        const startTime = toBeijingTime(new Date()).valueOf();
        await followupsData?.refreshData?.(filtersWithKeyword);
        const endTime = toBeijingTime(new Date()).valueOf();
        console.log('✅ [MobileFollowups] 关键词搜索数据刷新完成，耗时:', endTime - startTime, 'ms');
      } catch (error) {
        console.error('⚠️ [MobileFollowups] 关键词搜索刷新数据失败:', error);
      }
    } catch (error) {
      console.error('⚠️ [MobileFollowups] 关键词搜索错误:', error);
      message.error('搜索失败，请重试');
    }
  }, [filterManager, followupsData]);

  // 处理关键词状态更新
  const handleKeywordChange = useCallback((value: string) => {
    filterManager?.setKeywordSearch?.(value);
  }, [filterManager]);

  // 🆕 优化：处理关键词清除，确保无限滚动状态正确重置
  const handleKeywordClear = useCallback(async () => {
    try {
      
      filterManager?.setKeywordSearch?.('');
      
      const currentFilters = filterManager?.getCurrentFiltersFn?.() || {};
      const filtersWithoutKeyword = { ...currentFilters };
      delete filtersWithoutKeyword.p_keyword;
      
      
      // 🆕 记录清除关键词对线索阶段的影响
      const stageFilterAffected = 'p_followupstage' in currentFilters || 'p_followupstage' in filtersWithoutKeyword;
      if (stageFilterAffected) {
      }
      
      // 🆕 使用新的筛选条件刷新数据，这会自动清理现有数据并重置分页
      try {
        await followupsData?.refreshData?.(filtersWithoutKeyword);
      } catch (error) {
        console.error('⚠️ [MobileFollowups] 清除关键词刷新数据失败:', error);
      }
      
      message.success('搜索已清除');
    } catch (error) {
      console.error('⚠️ [MobileFollowups] 关键词清除错误:', error);
      message.error('清除搜索失败，请重试');
    }
  }, [filterManager, followupsData]);

  // 🆕 新增：处理快速筛选（来访意向评分 + 入住时间）
  const handleQuickFilter = useCallback(async (rating: number | null, moveInFilter: string | null) => {
    try { 
      console.log('⭐ [MobileFollowups] 开始快速筛选:', { rating, moveInFilter });
      
      let rpcFilters: any = {};
      
      // 处理来访意向筛选
      if (rating !== null) {
        // 将数字评分转换为字符串值，与数据库存储格式保持一致
        let ratingString: string;
        switch (rating) {
          case 3: ratingString = 'A'; break;
          case 2: ratingString = 'B+'; break;
          case 1: ratingString = 'B'; break;
          default: ratingString = 'C'; break;
        }
        
        rpcFilters.p_userrating = [ratingString];
        console.log('⭐ [MobileFollowups] 来访意向筛选:', { rating, ratingString });
      }
      
      // 处理入住时间筛选
      if (moveInFilter !== null) {
        const now = getCurrentBeijingTime().toDate();
        const currentYear = now.getFullYear();
        const currentMonth = now.getMonth() + 1; // getMonth() 返回 0-11
        
        if (moveInFilter === 'current') {
          // 本月入住：当前月份
          const startDate = new Date(currentYear, currentMonth - 1, 1);
          const endDate = new Date(currentYear, currentMonth, 0);
          
          rpcFilters.p_moveintime_start = [toBeijingDateStr(startDate)];
          rpcFilters.p_moveintime_end = [toBeijingDateStr(endDate)];
          console.log('⭐ [MobileFollowups] 本月入住筛选:', { startDate: toBeijingDateStr(startDate), endDate: toBeijingDateStr(endDate) });
        } else if (moveInFilter === 'next') {
          // 下月入住：下个月份
          const startDate = new Date(currentYear, currentMonth, 1);
          const endDate = new Date(currentYear, currentMonth + 1, 0);
          
          rpcFilters.p_moveintime_start = [toBeijingDateStr(startDate)];
          rpcFilters.p_moveintime_end = [toBeijingDateStr(endDate)];
          console.log('⭐ [MobileFollowups] 下月入住筛选:', { startDate: toBeijingDateStr(startDate), endDate: toBeijingDateStr(endDate) });
        }
        
        // 🆕 入住时间筛选时，明确指定要排除NULL值的记录
        if (moveInFilter !== null) {
          rpcFilters.p_moveintime_not_null = [true];
          console.log('⭐ [MobileFollowups] 快速筛选中添加入住时间非空条件:', rpcFilters.p_moveintime_not_null);
          
          // 🆕 添加调试信息：检查筛选条件的具体值
          console.log('⭐ [MobileFollowups] 快速筛选完整参数详情:', {
            moveInFilter,
            startDate: rpcFilters.p_moveintime_start?.[0],
            endDate: rpcFilters.p_moveintime_end?.[0],
            notNull: rpcFilters.p_moveintime_not_null?.[0],
            allParams: rpcFilters
          });
        }
      }
      
      console.log('⭐ [MobileFollowups] 快速筛选RPC参数:', rpcFilters);
      
      // 🆕 更新筛选器状态
      filterManager?.setFilters?.(rpcFilters);
      
      // 🆕 使用新的筛选条件刷新数据
              try {
          console.log('🔄 [MobileFollowups] 开始快速筛选数据刷新');
          const startTime = toBeijingTime(new Date()).valueOf();
          await followupsData?.refreshData?.(rpcFilters);
          const endTime = toBeijingTime(new Date()).valueOf();
          console.log('✅ [MobileFollowups] 快速筛选数据刷新完成，耗时:', endTime - startTime, 'ms');
          
                    // 🆕 立即检查数据状态（不延迟）
          console.log('🔍 [MobileFollowups] 快速筛选数据刷新后立即检查:', {
            dataLength: followupsData?.data?.length || 0,
            total: followupsData?.pagination?.total || 0,
            currentPage: followupsData?.pagination?.current || 1,
            pageSize: followupsData?.pagination?.pageSize || 20,
            hasMore: followupsData?.hasMore,
            loading: followupsData?.loading,
            loadingMore: followupsData?.loadingMore,
            appliedFilters: rpcFilters
          });
          
          // 🆕 使用 useEffect 监听数据变化，而不是延迟检查
          // 这样可以确保在数据实际更新后再进行检查
        } catch (error) {
          console.error('⚠️ [MobileFollowups] 快速筛选刷新数据失败:', error);
        }
      
      // 显示筛选结果消息
      let messageText = '';
      if (rating !== null) {
        messageText += `已筛选${rating === 3 ? '高' : rating === 2 ? '中' : '低'}意向客户`;
      }
      if (moveInFilter !== null) {
        if (messageText) messageText += '，';
        messageText += `入住时间：${moveInFilter === 'current' ? '本月' : '下月'}`;
      }
      
      if (rating !== null || moveInFilter !== null) {
        message.success(messageText);
      } else {
        message.success('已取消快速筛选');
      }
    } catch (error) {
      console.error('⚠️ [MobileFollowups] 快速筛选错误:', error);
      message.error('快速筛选失败，请重试');
    }
  }, [filterManager, followupsData]);

  // 🆕 监听数据变化，在筛选后检查数据状态
  useEffect(() => {
    if (followupsData?.data && followupsData.data.length > 0) {
      // 检查是否有入住时间筛选条件
      const hasMoveintimeFilter = filterManager?.getCurrentFiltersFn?.()?.p_moveintime_start || 
                                  filterManager?.getCurrentFiltersFn?.()?.p_moveintime_end;
      
      if (hasMoveintimeFilter) {
        console.log('🔍 [MobileFollowups] 检测到入住时间筛选条件，检查数据状态');
        
        // 检查返回数据中入住时间字段的情况
        const moveintimeAnalysis = followupsData.data.reduce((acc: any, record: any) => {
          const hasMoveintime = record.moveintime && record.moveintime !== '';
          const moveintimeValue = record.moveintime || 'NULL/EMPTY';
          const recordId = record.leadid || record.id || 'UNKNOWN';
          
          if (!acc.hasMoveintime) acc.hasMoveintime = [];
          if (!acc.noMoveintime) acc.noMoveintime = [];
          
          if (hasMoveintime) {
            acc.hasMoveintime.push({ id: recordId, moveintime: moveintimeValue });
          } else {
            acc.noMoveintime.push({ id: recordId, moveintime: moveintimeValue });
          }
          
          return acc;
        }, {});
        
        console.log('🔍 [MobileFollowups] 入住时间筛选后数据状态检查:', {
          totalRecords: followupsData.data.length,
          hasMoveintime: moveintimeAnalysis.hasMoveintime?.length || 0,
          noMoveintime: moveintimeAnalysis.noMoveintime?.length || 0,
          hasMoveintimeRecords: moveintimeAnalysis.hasMoveintime || [],
          noMoveintimeRecords: moveintimeAnalysis.noMoveintime || []
        });
        
        // 特别检查问题记录
        const problemRecords = followupsData.data.filter((record: any) => {
          const recordId = record.leadid || record.id || 'UNKNOWN';
          return recordId === '25Y00042' || recordId === '25Y00041';
        });
        
        if (problemRecords.length > 0) {
          console.log('⚠️ [MobileFollowups] 入住时间筛选后发现异常记录:', problemRecords.map((record: any) => ({
            id: record.leadid || record.id,
            moveintime: record.moveintime || 'NULL/EMPTY',
            moveintimeType: typeof record.moveintime,
            moveintimeLength: record.moveintime ? record.moveintime.length : 'N/A'
          })));
        }
      }
    }
  }, [followupsData?.data, filterManager]);

  // 🆕 优化：处理筛选条件变更，确保无限滚动状态正确重置
  const handleFilterChange = useCallback(async (filters: any) => {
    try {
      console.log('🔍 [MobileFollowups] 开始处理筛选条件变更:', filters);
      
      const rpcFilters: any = {};
      Object.entries(filters).forEach(([key, value]) => {
        if (value !== null && value !== undefined && value !== '') {
          // 🆕 特殊处理预算范围参数
          if (key === 'userbudget_min' || key === 'userbudget_max') {
            const rpcKey = `p_${key}`;
            // 预算参数应该是数字类型，不是数组
            rpcFilters[rpcKey] = Number(value);
            console.log(`🔍 [MobileFollowups] 预算参数转换: ${key} = ${value} -> ${rpcKey} = ${Number(value)}`);
            return;
          }
          
          // 🆕 特殊处理工作地点参数
          if (key === 'worklocation') {
            const rpcKey = `p_${key}`;
            // 工作地点参数应该是站点名称数组
            if (Array.isArray(value)) {
              // 过滤掉空值，确保只包含有效的站点名称
              const validStations = value.filter(station => station && station.trim() !== '');
              rpcFilters[rpcKey] = validStations;
              console.log(`🔍 [MobileFollowups] 工作地点参数转换: ${key} = ${value} -> ${rpcKey} = ${validStations}`);
            } else {
              // 单个值转换为数组
              rpcFilters[rpcKey] = [value];
              console.log(`🔍 [MobileFollowups] 工作地点参数转换: ${key} = ${value} -> ${rpcKey} = [${value}]`);
            }
            return;
          }
          
          const rpcKey = `p_${key}`;
          rpcFilters[rpcKey] = Array.isArray(value) ? value : [value];
        }
      });
      
      console.log('🔍 [MobileFollowups] 转换后的RPC筛选参数:', rpcFilters);
      console.log('🔍 [MobileFollowups] 筛选条件统计:', {
        totalFilters: Object.keys(filters).length,
        appliedFilters: Object.keys(rpcFilters).length,
        filterDetails: Object.entries(rpcFilters).map(([key, value]) => ({
          key,
          value,
          type: Array.isArray(value) ? 'array' : typeof value,
          count: Array.isArray(value) ? value.length : 1
        }))
      });
      
      // 🆕 记录工作地点筛选条件详情
      if (rpcFilters.p_worklocation) {
        console.log('🎯 [MobileFollowups] 工作地点筛选条件详情:', {
          worklocation: rpcFilters.p_worklocation,
          worklocationType: typeof rpcFilters.p_worklocation,
          worklocationLength: Array.isArray(rpcFilters.p_worklocation) ? rpcFilters.p_worklocation.length : 'N/A',
          worklocationValues: rpcFilters.p_worklocation
        });
      }
      
      // 特别检查时间筛选条件
      if (rpcFilters.p_created_at_start || rpcFilters.p_created_at_end) {
        console.log('🔍 [MobileFollowups] 创建时间筛选条件详情:', {
          start: rpcFilters.p_created_at_start,
          end: rpcFilters.p_created_at_end,
          startType: typeof rpcFilters.p_created_at_start?.[0],
          endType: typeof rpcFilters.p_created_at_start?.[0],
          startValue: rpcFilters.p_created_at_start?.[0],
          endValue: rpcFilters.p_created_at_end?.[0],
          startArrayLength: rpcFilters.p_created_at_start?.length,
          endArrayLength: rpcFilters.p_created_at_end?.length
        });
        
        // 🆕 创建时间筛选时，添加非空条件
        rpcFilters.p_created_at_not_null = [true];
        console.log('🔍 [MobileFollowups] 添加创建时间非空筛选条件:', rpcFilters.p_created_at_not_null);
      }
      
      if (rpcFilters.p_moveintime_start || rpcFilters.p_moveintime_end) {
        console.log('🔍 [MobileFollowups] 入住时间筛选条件详情:', {
          start: rpcFilters.p_moveintime_start,
          end: rpcFilters.p_moveintime_end,
          startType: typeof rpcFilters.p_moveintime_start?.[0],
          endType: typeof rpcFilters.p_moveintime_end?.[0],
          startValue: rpcFilters.p_moveintime_start?.[0],
          endValue: rpcFilters.p_moveintime_end?.[0],
          startArrayLength: rpcFilters.p_moveintime_start?.length,
          endArrayLength: rpcFilters.p_moveintime_end?.length
        });
        
        // 🆕 入住时间筛选时，明确指定要排除NULL值的记录
        // 这样可以确保只筛选有入住时间的记录，而不是包含NULL值的记录
        rpcFilters.p_moveintime_not_null = [true];
        console.log('🔍 [MobileFollowups] 添加入住时间非空筛选条件:', rpcFilters.p_moveintime_not_null);
        
        // 🆕 添加调试信息：检查筛选条件的具体值
        console.log('🔍 [MobileFollowups] 手动筛选完整参数详情:', {
          startDate: rpcFilters.p_moveintime_start?.[0],
          endDate: rpcFilters.p_moveintime_end?.[0],
          notNull: rpcFilters.p_moveintime_not_null?.[0],
          allParams: rpcFilters
        });
      }
      
      // 🆕 记录筛选条件变化对线索阶段的影响
      const currentFilters = filterManager?.getCurrentFiltersFn?.() || {};
      const stageFilterChanged = JSON.stringify(currentFilters.p_followupstage) !== JSON.stringify(rpcFilters.p_followupstage);
      
      if (stageFilterChanged) {
        console.log('🎯 [MobileFollowups] 线索阶段筛选条件变化:', {
          oldStageFilter: currentFilters.p_followupstage,
          newStageFilter: rpcFilters.p_followupstage,
          stageFilterChanged
        });
      }
      
      // 🆕 更新筛选器状态
      filterManager?.setFilters?.(rpcFilters);
      
      // 🆕 使用新的筛选条件刷新数据，这会自动清理现有数据并重置分页
              try {
          console.log('🔄 [MobileFollowups] 开始刷新数据，筛选条件:', rpcFilters);
          const startTime = toBeijingTime(new Date()).valueOf();
          await followupsData?.refreshData?.(rpcFilters);
          const endTime = toBeijingTime(new Date()).valueOf();
          console.log('✅ [MobileFollowups] 数据刷新完成，耗时:', endTime - startTime, 'ms');
          
          // 🆕 立即检查数据状态（不延迟）
          console.log('🔍 [MobileFollowups] 数据刷新后立即检查:', {
            dataLength: followupsData?.data?.length || 0,
            total: followupsData?.pagination?.total || 0,
            currentPage: followupsData?.pagination?.current || 1,
            pageSize: followupsData?.pagination?.pageSize || 20,
            hasMore: followupsData?.hasMore,
            loading: followupsData?.loading,
            loadingMore: followupsData?.loadingMore,
            appliedFilters: rpcFilters
          });
          
          // 🆕 使用 useEffect 监听数据变化，而不是延迟检查
          // 这样可以确保在数据实际更新后再进行检查
        } catch (error) {
          console.error('⚠️ [MobileFollowups] 筛选条件变更刷新数据失败:', error);
        }
      
      // 🆕 关闭筛选抽屉
      setFilterDrawerOpen(false);
      
      message.success('筛选条件已应用');
    } catch (error) {
      console.error('⚠️ [MobileFollowups] 筛选条件变更错误:', error);
      message.error('筛选失败，请重试');
    }
  }, [filterManager, followupsData]);

  // 处理卡片点击编辑
  const handleCardEdit = useCallback((record: any) => {
    setCurrentEditRecord(record);
    setStageDrawerOpen(true);
  }, []);

  // 处理抽屉保存
  const handleStageDrawerSave = useCallback(async (updatedRecord: any, updatedFields: any) => {
    try {
      if (updatedFields._autoSaveOnClose) {
        const { _autoSaveOnClose, ...cleanFields } = updatedFields;
        
        const beforeUpdateRecord = followupsData?.data?.find(item => item.id === updatedRecord.id);
        
        Object.entries(cleanFields).forEach(([field, value]) => {
          if (value !== undefined && value !== null) {
            if (field in updatedRecord) {
              followupsData?.updateLocalData?.(updatedRecord.id, field as keyof FollowupRecord, value);
            }
          }
        });
        
        setTimeout(() => {
          const afterUpdateRecord = { ...beforeUpdateRecord, ...cleanFields };
          
          if (afterUpdateRecord) {
            // 验证数据是否真的更新了
          }
        }, 200);
        
        message.success('数据已自动保存');
      } else if (updatedFields._manualSave) {
        message.success('保存成功');
      } else if (updatedFields._stageChange) {
        message.success('阶段推进成功');
      } else {
        followupsData?.refreshData?.();
        message.success('保存成功');
      }
    } catch (error) {
      message.error('保存失败，请重试');
      console.error('保存失败:', error);
    }
  }, [followupsData]);

  // 处理线索回退
  const handleLeadRollback = useCallback((record: any) => {
    setRollbackRecord(record);
    setRollbackModalVisible(true);
  }, []);

  // 处理抽屉关闭
  const handleStageDrawerClose = useCallback(() => {
    setStageDrawerOpen(false);
    setCurrentEditRecord(null);
  }, []);

  // 处理回退证据上传前的预览
  const handleBeforeUpload = useCallback(async (file: File) => {
    setRollbackEvidenceList(list => [
      ...list,
      {
        file,
        preview: URL.createObjectURL(file),
        name: file.name,
      },
    ]);
    return false;
  }, []);

  // 清理预览URL的函数
  const clearPreviewUrls = useCallback((evidenceList: any[]) => {
    evidenceList.forEach(item => {
      if (item.preview && item.preview.startsWith('blob:')) {
        URL.revokeObjectURL(item.preview);
      }
    });
  }, []);

  // 删除本地预览
  const handleRemoveEvidence = useCallback((file: any) => {
    setRollbackEvidenceList(list => {
      const removedItem = list.find(item => item.name === file.name);
      if (removedItem?.preview && removedItem.preview.startsWith('blob:')) {
        URL.revokeObjectURL(removedItem.preview);
      }
      return list.filter(item => item.name !== file.name);
    });
  }, []);

  // 确认回退操作
  const handleRollbackConfirm = useCallback(async () => {
    if (!rollbackReason) {
      message.error('请选择回退理由');
      return;
    }
    if (rollbackEvidenceList.length === 0) {
      message.error('请上传回退证据');
      return;
    }
    setRollbackUploading(true);
    try {
      // 检查同一线索是否已存在未完成的回退审批流实例
      const { data: existList, error: existError } = await supabase
        .from('approval_instances')
        .select('id, status')
        .eq('type', 'lead_rollback')
        .eq('target_id', rollbackRecord?.leadid)
        .in('status', ['pending', 'processing']);
      if (existError) {
        setRollbackUploading(false);
        message.error('回退检查失败，请重试');
        return;
      }
      if (existList && existList.length > 0) {
        setRollbackUploading(false);
        message.error('该线索已提交回退申请，请勿重复提交');
        return;
      }
      
      // 上传所有图片
      const uploaded: any[] = [];
      for (const item of rollbackEvidenceList) {
        if (item.url) {
          uploaded.push(item.url);
          continue;
        }
        const compressedFile = await imageCompression(item.file, imageCompressionOptions);
        const fileExt = compressedFile.name.split('.').pop();
        const fileName = `rollback-${toBeijingTime(new Date()).valueOf()}-${Math.floor(Math.random()*10000)}.${fileExt}`;
        const filePath = `rollback/${fileName}`;
        const { error } = await supabase.storage.from('rollback').upload(filePath, compressedFile);
        if (error) throw error;
        const { data } = supabase.storage.from('rollback').getPublicUrl(filePath);
        uploaded.push(data.publicUrl);
      }
      
      // 查找审批流模板id
      const { data: flowData, error: flowError } = await supabase
        .from('approval_flows')
        .select('id')
        .eq('type', 'lead_rollback')
        .maybeSingle();
      if (flowError || !flowData) {
        message.error('未找到回退审批流模板，请联系管理员配置');
        setRollbackUploading(false);
        return;
      }
      
      // 插入审批流实例
      const { error: approvalError } = await supabase.from('approval_instances').insert({
        flow_id: flowData.id,
        type: 'lead_rollback',
        target_table: 'leads',
        target_id: rollbackRecord?.leadid,
        status: 'pending',
        created_by: profile?.id,
        config: {
          reason: rollbackReason,
          evidence: uploaded,
          leadid: rollbackRecord?.leadid,
        },
      });
      if (approvalError) throw approvalError;
      
      message.success('回退申请已提交，等待审批');
      setRollbackModalVisible(false);
      clearPreviewUrls(rollbackEvidenceList);
      setRollbackRecord(null);
      setRollbackReason(undefined);
      setRollbackEvidenceList([]);
      followupsData?.refreshData?.();
    } catch (e: any) {
      message.error('回退提交失败: ' + (e.message || e.toString()));
    }
    setRollbackUploading(false);
  }, [rollbackReason, rollbackEvidenceList, rollbackRecord, profile, clearPreviewUrls, followupsData, imageCompressionOptions]);

  // 处理回退弹窗关闭
  const handleRollbackModalCancel = useCallback(() => {
    setRollbackModalVisible(false);
    clearPreviewUrls(rollbackEvidenceList);
    setRollbackRecord(null);
    setRollbackReason(undefined);
    setRollbackEvidenceList([]);
    setRollbackUploading(false);
  }, [rollbackEvidenceList, clearPreviewUrls]);

  // 缓存回退证据的文件列表映射
  const rollbackEvidenceFileList = useMemo(() => {
    return rollbackEvidenceList.map((item, idx) => ({
      uid: idx + '',
      name: item.name,
      status: 'done' as const,
      url: item.url || item.preview,
      thumbUrl: item.preview,
    }));
  }, [rollbackEvidenceList]);

  // 缓存 Upload 组件的禁用状态
  const isUploadDisabled = useMemo(() => {
    return rollbackEvidenceList.length >= 5 || rollbackUploading;
  }, [rollbackEvidenceList.length, rollbackUploading]);

  // 缓存 Upload 组件的显示状态
  const shouldShowUploadButton = useMemo(() => {
    return rollbackEvidenceList.length < 5 && !rollbackUploading;
  }, [rollbackEvidenceList.length, rollbackUploading]);

  // 渲染筛选面板
  const renderFilterPanel = () => (
    <Popup
      visible={filterDrawerOpen}
      onMaskClick={() => setFilterDrawerOpen(false)}
      position="right"
      bodyStyle={{ width: '80vw', height: '100vh' }}
    >
      <div className="p-4 h-full flex flex-col">
        {/* 头部 */}
        <div className="flex items-center justify-between mb-4 pb-3 border-b border-gray-200">
          <h3 className="text-lg font-medium">筛选条件</h3>
          <MobileButton
            fill="none"
            size="small"
            onClick={() => setFilterDrawerOpen(false)}
          >
            关闭
          </MobileButton>
        </div>

        {/* 筛选表单 */}
        <div className="flex-1 overflow-y-auto">
          <Form layout="vertical">
            {/* 跟进阶段 */}
            <Form.Item label="跟进阶段">
              <Selector
                multiple={true}
                options={enumData.followupstageEnum?.map((item: any, index: number) => ({
                  label: item.label,
                  value: item.value,
                  key: `followupstage-${item.value}-${index}`
                })) || []}
                onChange={(value) => setFilterValues(prev => ({ ...prev, followupstage: value }))}
              />
            </Form.Item>

            {/* 约访管家 */}
            <Form.Item label="约访管家">
              <Input
                placeholder="输入管家姓名"
                clearable
                onChange={(value) => setFilterValues(prev => ({ ...prev, interviewsales_user_id: value || '' }))}
              />
            </Form.Item>

            {/* 用户画像 */}
            <Form.Item label="用户画像">
              <Selector
                multiple={true}
                options={enumData.customerprofileEnum?.map((item: any, index: number) => ({
                  label: item.label,
                  value: item.value,
                  key: `customerprofile-${item.value}-${index}`
                })) || []}
                onChange={(value) => setFilterValues(prev => ({ ...prev, customerprofile: value }))}
              />
            </Form.Item>

            {/* 工作地点 */}
            <Form.Item label="工作地点">
              <Selector
                multiple={true}
                options={enumData.metroStationOptions?.map((item: any, index: number) => ({
                  label: item.label,
                  value: item.value,
                  key: `metroStation-${item.value}-${index}`
                })) || []}
                onChange={(value) => {
                  console.log('🔍 [MobileFollowups] 工作地点筛选选择变化:', { value, selectedValues: value });
                  
                  // 🆕 修复：支持线路-站点映射逻辑
                  const selectedLines = value || [];
                  const allStationValues: string[] = [];
                  
                  // 处理每个选中的线路
                  selectedLines.forEach((lineValue: string) => {
                    const line = enumData.metroStationOptions?.find((item: any) => item.value === lineValue);
                    if (line && line.children) {
                      // 如果选择了线路，添加该线路下的所有站点
                      const stationValues = line.children.map((station: any) => {
                        // 🆕 修复：确保传递的是站点名称，不是带"站"字的完整名称
                        return station.value.replace(/站$/, '');
                      });
                      allStationValues.push(...stationValues);
                      console.log(`🔍 [MobileFollowups] 线路 ${lineValue} 下的站点:`, stationValues);
                    } else {
                      // 如果没有子级，可能是单独的站点值
                      // 🆕 修复：确保传递的是站点名称，不是带"站"字的完整名称
                      const stationName = lineValue.replace(/站$/, '');
                      allStationValues.push(stationName);
                      console.log(`🔍 [MobileFollowups] 单独站点值:`, stationName);
                    }
                  });
                  
                  // 去重并更新筛选值状态
                  const uniqueStationValues = [...new Set(allStationValues)];
                  console.log('🔍 [MobileFollowups] 最终工作地点筛选值:', {
                    selectedLines,
                    allStationValues,
                    uniqueStationValues
                  });
                  
                  // 🆕 添加详细的工作地点筛选日志
                  console.log('🔍 [MobileFollowups] 工作地点筛选详情:', {
                    originalSelection: value,
                    processedStations: uniqueStationValues,
                    stationCount: uniqueStationValues.length,
                    timestamp: new Date().toISOString()
                  });
                  
                  setFilterValues(prev => ({ ...prev, worklocation: uniqueStationValues }));
                  
                  // 更新工作地点选择状态（用于显示）
                  setSelectedWorkLocationLine(selectedLines.join(','));
                }}
              />
            </Form.Item>

            {/* 用户预算范围 */}
            <Form.Item label="用户预算范围">
              <div className="flex w-full items-center gap-2">
                {/* 左侧输入框 */}
                <div className="flex-1">
                  <Input
                    placeholder="最小预算"
                    type="number"
                    onChange={(value) => setFilterValues(prev => ({ ...prev, userbudget_min: value || '' }))}
                  />
                </div>
                {/* "至"字 - 位于两个输入框之间的空白区域 */}
                <div className="flex-shrink-0 px-2">
                  <span className="text-gray-400">至</span>
                </div>
                {/* 右侧输入框 */}
                <div className="flex-1">
                  <Input
                    placeholder="最大预算"
                    type="number"
                    onChange={(value) => setFilterValues(prev => ({ ...prev, userbudget_max: value || '' }))}
                  />
                </div>
              </div>
            </Form.Item>

            {/* 入住时间 */}
            <Form.Item label="入住时间">
              <div className="flex w-full items-center gap-2">
                {/* 左侧输入框 */}
                <div className="flex-1">
                  <div 
                    onClick={() => {
                      console.log('点击入住时间开始时间容器');
                      setMoveInTimeVisible(true);
                    }}
                    style={{ cursor: 'pointer' }}
                  >
                    <Input
                      placeholder="开始时间"
                      value={moveInTimeRange ? dayjs(moveInTimeRange[0]).format('YYYY-MM-DD') : ""}
                      type="text"
                      readOnly
                      style={{
                        '--adm-font-size-main': '14px',
                        '--adm-color-text': moveInTimeRange ? '#333333' : '#999999'
                      } as React.CSSProperties & Record<string, string>}
                    />
                  </div>
                </div>
                {/* "至"字 - 位于两个输入框之间的空白区域 */}
                <div className="flex-shrink-0 px-2">
                  <span className={moveInTimeRange ? "text-gray-600" : "text-gray-400"}>至</span>
                </div>
                {/* 右侧输入框 */}
                <div className="flex-1">
                  <div 
                    onClick={() => {
                      console.log('点击入住时间结束时间容器');
                      setMoveInTimeVisible(true);
                    }}
                    style={{ cursor: 'pointer' }}
                  >
                    <Input
                      placeholder="结束时间"
                      value={moveInTimeRange ? dayjs(moveInTimeRange[1]).format('YYYY-MM-DD') : ""}
                      type="text"
                      readOnly
                      style={{
                        '--adm-font-size-main': '14px',
                        '--adm-color-text': moveInTimeRange ? '#333333' : '#999999'
                      } as React.CSSProperties & Record<string, string>}
                    />
                  </div>
                </div>
              </div>
              

              
              {/* 日期范围选择器 */}
              <CalendarPicker
                visible={moveInTimeVisible}
                selectionMode='range'
                value={moveInTimeRange}
                min={toBeijingTime(new Date('2020-01-01')).toDate()}  // 允许选择从2020年开始的日期
                max={toBeijingTime(new Date('2030-12-31')).toDate()}  // 允许选择到2030年结束的日期
                onClose={() => {
                  setMoveInTimeVisible(false);
                  // 不重置选择状态，让用户确认
                }}
                onMaskClick={() => {
                  setMoveInTimeVisible(false);
                  // 不重置选择状态，让用户确认
                }}
                onConfirm={(val) => {
                  console.log('用户通过内置确认按钮确认入住时间范围:', val);
                  if (val && Array.isArray(val) && val.length === 2) {
                    // 使用 timeUtils 函数确保正确的北京时间处理
                    // 保留完整时间信息：开始时间 00:00:00，结束时间 23:59:59
                    const startDate = getDayStart(val[0]).toISOString();
                    const endDate = getDayEnd(val[1]).toISOString();
                    console.log('入住时间范围（北京时间）:', { startDate, endDate });
                    
                    // 添加调试信息：检查时区转换
                    const originalStart = dayjs(val[0]);
                    const originalEnd = dayjs(val[1]);
                    const beijingStart = getDayStart(val[0]);
                    const beijingEnd = getDayEnd(val[1]);
                    
                    console.log('入住时间时区转换详情:', {
                      originalStart: originalStart.format('YYYY-MM-DD HH:mm:ss'),
                      originalEnd: originalEnd.format('YYYY-MM-DD HH:mm:ss'),
                      beijingStart: beijingStart.format('YYYY-MM-DD HH:mm:ss'),
                      beijingEnd: beijingEnd.format('YYYY-MM-DD HH:mm:ss'),
                      startDate,
                      endDate,
                      startISO: beijingStart.toISOString(),
                      endISO: beijingEnd.toISOString()
                    });
                    
                    setFilterValues(prev => ({
                      ...prev,
                      moveintime_start: startDate,
                      moveintime_end: endDate
                    }));
                    setMoveInTimeVisible(false);
                    setMoveInTimeSelecting(false);
                  }
                }}
                onChange={val => {
                  console.log('入住时间选择器值变化:', val);
                  if (val && Array.isArray(val)) {
                    if (val.length === 2) {
                      const [startDate, endDate] = val;
                      const isSameDate = dayjs(startDate).isSame(endDate, 'day');
                      
                      if (isSameDate && !moveInTimeSelecting) {
                        // 第一次选择：记录状态，等待选择第二个日期
                        console.log('第一次选择日期，等待选择第二个日期');
                        setMoveInTimeSelecting(true);
                        // 实时更新显示第一个日期
                        setMoveInTimeRange([startDate, startDate]);
                        // 不关闭选择器，让用户继续选择
                      } else if (isSameDate && moveInTimeSelecting) {
                        // 用户再次点击相同日期，确认单日选择
                        console.log('用户确认单日选择');
                        setMoveInTimeRange(val as [Date, Date]);
                        // 不自动关闭选择器，等待用户通过内置确认按钮确认
                      } else if (!isSameDate) {
                        // 选择了不同的日期，完成范围选择
                        console.log('完成范围选择');
                        setMoveInTimeRange(val as [Date, Date]);
                        // 不自动关闭选择器，等待用户通过内置确认按钮确认
                      }
                    }
                  }
                }}
              />
            </Form.Item>

            {/* 来访意向 */}
            <Form.Item label="来访意向">
              <Selector
                multiple={true}
                options={enumData.userratingEnum?.map((item: any, index: number) => ({
                  label: item.label,
                  value: item.value,
                  key: `userrating-${item.value}-${index}`
                })) || []}
                onChange={(value) => setFilterValues(prev => ({ ...prev, userrating: value }))}
              />
            </Form.Item>

            {/* 主分类 */}
            <Form.Item label="跟进结果">
              <div className="space-y-3">
                {/* 一级分类选择 - 默认全部选中 */}
                <div>
                  <div className="text-sm font-medium text-gray-700 mb-2">选择一级分类</div>
                  <Selector
                    multiple={true}
                    options={enumData.majorCategoryOptions?.map((item: any, index: number) => ({
                      label: item.label,
                      value: item.value,
                      key: `majorCategory-${item.value}-${index}`
                    })) || []}
                    value={filterValues.majorcategory_primary || []}
                    onChange={(value) => {
                      console.log('🔍 [MobileFollowups] 一级分类选择变化:', value);
                      
                      // 处理一级分类选择：自动映射到所有二级分类
                      if (value && value.length > 0) {
                        const selectedCategories = value; // 支持多选一级分类
                        const allMappedSubcategories: string[] = [];
                        
                        // 遍历所有选中的一级分类，收集其下的所有二级分类
                        selectedCategories.forEach(selectedCategory => {
                          const category = enumData.majorCategoryOptions?.find((cat: any) => cat.value === selectedCategory) as any;
                          
                          if (category && category.children) {
                            // 自动映射：选择一级分类时，包含该分类下的所有二级分类
                            const mappedSubcategories = category.children.map((subcategory: any) => subcategory.value);
                            allMappedSubcategories.push(...mappedSubcategories);
                            console.log('🔍 [MobileFollowups] 一级分类自动映射:', {
                              selectedCategory,
                              mappedSubcategories,
                              count: mappedSubcategories.length
                            });
                          } else {
                            // 如果没有子级，直接使用一级分类值
                            allMappedSubcategories.push(selectedCategory);
                          }
                        });
                        
                        // 去重并更新筛选值
                        const uniqueSubcategories = [...new Set(allMappedSubcategories)];
                        console.log('🔍 [MobileFollowups] 所有一级分类映射结果:', {
                          selectedCategories,
                          allMappedSubcategories,
                          uniqueSubcategories,
                          totalCount: uniqueSubcategories.length
                        });
                        
                        setFilterValues(prev => ({ 
                          ...prev, 
                          majorcategory: uniqueSubcategories,
                          majorcategory_primary: selectedCategories // 记录选择的一级分类
                        }));
                      } else {
                        // 清除选择
                        setFilterValues(prev => ({ 
                          ...prev, 
                          majorcategory: [],
                          majorcategory_primary: []
                        }));
                      }
                    }}
                  />
                  <div className="text-xs text-gray-500 mt-1">
                    选择一级分类将自动包含该分类下的所有二级分类
                  </div>
                </div>
              </div>
            </Form.Item>

            {/* 预约社区 */}
            <Form.Item label="预约社区">
              <Selector
                multiple={true}
                options={enumData.communityEnum?.map((item: any, index: number) => ({
                  label: item.label,
                  value: item.value,
                  key: `scheduledcommunity-${item.value}-${index}`
                })) || []}
                onChange={(value) => setFilterValues(prev => ({ ...prev, scheduledcommunity: value }))}
              />
            </Form.Item>

            {/* 带看管家 */}
            <Form.Item label="带看管家">
              <Input
                placeholder="输入带看管家姓名"
                clearable
                onChange={(value) => setFilterValues(prev => ({ ...prev, showingsales_user: value || '' }))}
              />
            </Form.Item>

            {/* 来源 */}
            <Form.Item label="来源">
              <Selector
                multiple={true}
                options={enumData.sourceEnum?.map((item: any, index: number) => ({
                  label: item.label,
                  value: item.value,
                  key: `source-${item.value}-${index}`
                })) || []}
                onChange={(value) => setFilterValues(prev => ({ ...prev, source: value }))}
              />
            </Form.Item>

            {/* 创建时间 */}
            <Form.Item label="创建时间">
              <div className="flex w-full items-center gap-2">
                {/* 左侧输入框 */}
                <div className="flex-1">
                  <div 
                    onClick={() => {
                      console.log('点击创建时间开始时间容器');
                      setCreatedTimeVisible(true);
                    }}
                    style={{ cursor: 'pointer' }}
                  >
                    <Input
                      placeholder="开始时间"
                      value={createdTimeRange ? dayjs(createdTimeRange[0]).format('YYYY-MM-DD') : ""}
                      type="text"
                      readOnly
                      style={{
                        '--adm-font-size-main': '14px',
                        '--adm-color-text': createdTimeRange ? '#333333' : '#999999'
                      } as React.CSSProperties & Record<string, string>}
                    />
                  </div>
                </div>
                {/* "至"字 - 位于两个输入框之间的空白区域 */}
                <div className="flex-shrink-0 px-2">
                  <span className={createdTimeRange ? "text-gray-600" : "text-gray-400"}>至</span>
                </div>
                {/* 右侧输入框 */}
                <div className="flex-1">
                  <div 
                    onClick={() => {
                      console.log('点击创建时间结束时间容器');
                      setCreatedTimeVisible(true);
                    }}
                    style={{ cursor: 'pointer' }}
                  >
                    <Input
                      placeholder="结束时间"
                      value={createdTimeRange ? dayjs(createdTimeRange[1]).format('YYYY-MM-DD') : ""}
                      type="text"
                      readOnly
                      style={{
                        '--adm-font-size-main': '14px',
                        '--adm-color-text': createdTimeRange ? '#333333' : '#999999'
                      } as React.CSSProperties & Record<string, string>}
                    />
                  </div>
                </div>
              </div>
              

              
              {/* 日期范围选择器 */}
              <CalendarPicker
                visible={createdTimeVisible}
                selectionMode='range'
                value={createdTimeRange}
                min={toBeijingTime(new Date('2020-01-01')).toDate()}  // 允许选择从2020年开始的日期
                max={toBeijingTime(new Date('2030-12-31')).toDate()}  // 允许选择到2030年结束的日期
                onClose={() => {
                  setCreatedTimeVisible(false);
                  // 不重置选择状态，让用户确认
                }}
                onMaskClick={() => {
                  setCreatedTimeVisible(false);
                  // 不重置选择状态，让用户确认
                }}
                onConfirm={(val) => {
                  console.log('用户通过内置确认按钮确认创建时间范围:', val);
                  if (val && Array.isArray(val) && val.length === 2) {
                    // 使用 timeUtils 函数确保正确的北京时间处理
                    // 保留完整时间信息：开始时间 00:00:00，结束时间 23:59:59
                    const startDate = getDayStart(val[0]).toISOString();
                    const endDate = getDayEnd(val[1]).toISOString();
                    console.log('创建时间范围（北京时间）:', { startDate, endDate });
                    
                    // 添加调试信息：检查时区转换
                    const originalStart = dayjs(val[0]);
                    const originalEnd = dayjs(val[1]);
                    const beijingStart = getDayStart(val[0]);
                    const beijingEnd = getDayEnd(val[1]);
                    
                    console.log('创建时间时区转换详情:', {
                      originalStart: originalStart.format('YYYY-MM-DD HH:mm:ss'),
                      beijingStart: beijingStart.format('YYYY-MM-DD HH:mm:ss'),
                      beijingEnd: beijingEnd.format('YYYY-MM-DD HH:mm:ss'),
                      startDate,
                      endDate,
                      startISO: beijingStart.toISOString(),
                      endISO: beijingEnd.toISOString()
                    });
                    
                    setFilterValues(prev => ({
                      ...prev,
                      created_at_start: startDate,
                      created_at_end: endDate
                    }));
                    setCreatedTimeVisible(false);
                    setCreatedTimeSelecting(false);
                  }
                }}
                onChange={val => {
                  console.log('创建时间选择器值变化:', val);
                  if (val && Array.isArray(val)) {
                    if (val.length === 2) {
                      const [startDate, endDate] = val;
                      const isSameDate = dayjs(startDate).isSame(endDate, 'day');
                      
                      if (isSameDate && !createdTimeSelecting) {
                        // 第一次选择：记录状态，等待选择第二个日期
                        console.log('创建时间：第一次选择日期，等待选择第二个日期');
                        setCreatedTimeSelecting(true);
                        // 实时更新显示第一个日期
                        setCreatedTimeRange([startDate, startDate]);
                        // 不关闭选择器，让用户继续选择
                      } else if (isSameDate && createdTimeSelecting) {
                        // 用户再次点击相同日期，确认单日选择
                        console.log('创建时间：用户确认单日选择');
                        setCreatedTimeRange(val as [Date, Date]);
                        // 不自动关闭选择器，等待用户通过内置确认按钮确认
                      } else if (!isSameDate) {
                        // 选择了不同的日期，完成范围选择
                        console.log('创建时间：完成范围选择');
                        setCreatedTimeRange(val as [Date, Date]);
                        // 不自动关闭选择器，等待用户通过内置确认按钮确认
                      }
                    }
                  }
                }}
              />
            </Form.Item>


          </Form>
        </div>

        {/* 底部操作按钮 */}
        <div className="pt-4 border-t border-gray-200">
          <Space className="w-full">
            <MobileButton
              block
              color="default"
              onClick={async () => {
                console.log('🧹 [MobileFollowups] 开始清除所有筛选条件');
                
                // 清除本地筛选值状态
                setFilterValues({
                  followupstage: [],
                  customerprofile: [],
                  interviewsales_user_id: '',
                  userbudget_min: '',
                  userbudget_max: '',
                  moveintime_start: '',
                  moveintime_end: '',
                  userrating: [],
                  majorcategory: [],
                  scheduledcommunity: [],
                  showingsales_user: '',
                  source: [],
                  created_at_start: '',
                  created_at_end: '',
                  worklocation: [],
                  majorcategory_primary: []
                });
                
                // 清除工作地点选择
                setSelectedWorkLocationLine('');
                
                // 清除筛选器状态
                filterManager?.setFilters?.({});
                
                // 🆕 新增：清除筛选器管理器的其他状态
                // 清除关键词搜索
                filterManager?.setKeywordSearch?.('');
                // 清除列筛选器
                filterManager?.setColumnFilters?.({});
                
                // 清除日期选择器状态
                setMoveInTimeRange(null);
                setCreatedTimeRange(null);
                setMoveInTimeSelecting(false);
                setCreatedTimeSelecting(false);
                
                // 🆕 新增：记录清除状态日志
                console.log('🧹 [MobileFollowups] 已清空所有筛选状态:', {
                  filterValues: '已清空',
                  workLocation: '已清空',
                  filterManager: '已清空',
                  dateRanges: '已清空',
                  timestamp: new Date().toISOString()
                });
                
                // 刷新数据（无筛选条件）
                try {
                  console.log('🔄 [MobileFollowups] 开始清除筛选后的数据刷新');
                  const startTime = toBeijingTime(new Date()).valueOf();
                  await followupsData?.refreshData?.({});
                  const endTime = toBeijingTime(new Date()).valueOf();
                  console.log('✅ [MobileFollowups] 清除筛选后数据刷新完成，耗时:', endTime - startTime, 'ms');
                  
                  // 检查刷新后的数据状态
                  setTimeout(() => {
                    console.log('📊 [MobileFollowups] 清除筛选后数据状态检查:', {
                      dataLength: followupsData?.data?.length || 0,
                      total: followupsData?.pagination?.total || 0,
                      currentPage: followupsData?.pagination?.current || 1,
                      pageSize: followupsData?.pagination?.pageSize || 20,
                      hasMore: followupsData?.hasMore,
                      loading: followupsData?.loading,
                      loadingMore: followupsData?.loadingMore
                    });
                  }, 100);
                } catch (error) {
                  console.error('⚠️ [MobileFollowups] 清除筛选后数据刷新失败:', error);
                }
                
                // 关闭筛选抽屉
                setFilterDrawerOpen(false);
                
                // 显示成功消息
                message.success('已清除所有筛选条件');
                
                console.log('🧹 [MobileFollowups] 所有筛选条件清除完成');
              }}
            >
              清除全部
            </MobileButton>
            <MobileButton
              block
              color="primary"
              onClick={() => {
                // 构建筛选条件对象
                const filters: any = {};
                
                // 添加非空筛选条件
                Object.entries(filterValues).forEach(([key, value]) => {
                  if (Array.isArray(value)) {
                    // 数组类型：检查是否有值
                    if (value.length > 0) {
                      filters[key] = value;
                    }
                  } else {
                    // 非数组类型：检查是否为空
                    if (value !== '' && value !== null && value !== undefined) {
                      filters[key] = value;
                    }
                  }
                });
                
                
                // 应用筛选条件
                if (Object.keys(filters).length > 0) {
                  handleFilterChange(filters);
                }
                
                setFilterDrawerOpen(false);
              }}
            >
              确定
            </MobileButton>
          </Space>
        </div>
      </div>
    </Popup>
  );

  return (
    <div className="min-h-screen flex flex-col p-0 m-0">
      {/* 头部组件 */}
      <MobileHeader
        keywordSearch={filterManager?.keywordSearch}
        onKeywordChange={handleKeywordChange}
        onKeywordSearch={handleKeywordSearch}
        onKeywordClear={handleKeywordClear}
        onFilterClick={() => setFilterDrawerOpen(true)}
        onQuickFilter={handleQuickFilter}
      />

      {/* 主要内容区域 - 使用Card组件包装 */}
      <Card className="flex-1 flex flex-col p-0 m-0 border-0" style={{ padding: 0, background: 'transparent' }}>
        {/* 客户卡片列表容器 - 使用Flexbox列容器实现瀑布流 */}
        <div className="flex flex-col w-full">
          {/* 双列容器 */}
          <div className="flex flex-row w-full gap-4 items-start justify-center">
            {/* 左列容器 */}
            <div className="flex flex-col w-[calc(50%-8px)]" id="column-1">
              {distributeCardsToColumns(followupsData?.data || []).leftColumn.map((record: any) => (
                <div key={`${record.id}-${followupsData?.forceUpdate || 0}`} className="mb-4">
                  <CustomerCard
                    record={record}
                    onEdit={handleCardEdit}
                    onRollback={handleLeadRollback}
                  />
                </div>
              ))}
            </div>
            
            {/* 右列容器 */}
            <div className="flex flex-col w-[calc(50%-8px)]" id="column-2">
              {distributeCardsToColumns(followupsData?.data || []).rightColumn.map((record: any) => (
                <div key={`${record.id}-${followupsData?.forceUpdate || 0}`} className="mb-4">
                  <CustomerCard
                    record={record}
                    onEdit={handleCardEdit}
                    onRollback={handleLeadRollback}
                  />
                </div>
              ))}
            </div>
          </div>
          
          {/* 🆕 卡片数据状态日志 */}
          {followupsData?.data && followupsData.data.length > 0 && (
            <div className="hidden">
              {/* 使用 useEffect 来记录日志，避免在 JSX 中直接调用 console.log */}
            </div>
          )}
          
          {/* 空状态 */}
          {(!followupsData?.data || followupsData.data.length === 0) && !followupsData?.loading && (
            <div className="flex flex-col items-center justify-center h-50 text-center text-gray-500 text-sm p-0 m-0">
              <p className="p-0 m-0">暂无跟进记录</p>
            </div>
          )}
          
          {/* 无限滚动哨兵元素 */}
          {followupsData?.data && followupsData.data.length > 0 && (
            <div 
              ref={sentinelRef} 
              className="w-full h-5 opacity-0 pointer-events-none"
            />
          )}
          
          {/* 加载更多状态 */}
          {followupsData?.loadingMore && (
            <div className="flex items-center justify-center p-0 m-0 text-gray-500 text-sm bg-gray-50 rounded-lg shadow-sm w-full text-center">
              <Spin size="small" />
              <span className="p-0 m-0">加载更多...</span>
            </div>
          )}
          
          {/* 无更多记录提示 */}
          {followupsData?.data && followupsData.data.length > 0 && !followupsData?.hasMore && !followupsData?.loadingMore && (
            <div className="flex flex-col items-center justify-center h-50 text-center text-gray-500 text-sm p-0 m-0">
              <p className="p-0 m-0">— 已显示全部记录 —</p>
            </div>
          )}
        </div>
      </Card>

      {/* 筛选面板 */}
      {renderFilterPanel()}

      {/* 跟进阶段编辑抽屉 */}
      <MobileFollowupStageDrawer
        open={stageDrawerOpen}
        onClose={handleStageDrawerClose}
        record={currentEditRecord}
        onSave={handleStageDrawerSave}
        isFieldDisabled={frequencyControl.isFieldDisabled}
        forceUpdate={followupsData?.forceUpdate}
        communityEnum={enumData.communityEnum}
        followupstageEnum={enumData.followupstageEnum}
        customerprofileEnum={enumData.customerprofileEnum}
        userratingEnum={enumData.userratingEnum}
        majorCategoryOptions={enumData.majorCategoryOptions}
        metroStationOptions={enumData.metroStationOptions}
        disableAutoSave={false}
      />

      {/* 回退弹窗 */}
      <Modal
        open={rollbackModalVisible}
        title="回退操作"
        onCancel={handleRollbackModalCancel}
        destroyOnHidden
        centered
        width={340}
        footer={
          <div style={{ display: 'flex', gap: 12, padding: '0 4px' }}>
            <Button 
              size="large"
              style={{ 
                flex: 1, 
                height: '44px',
                fontSize: '16px',
                borderRadius: '8px'
              }}
              onClick={handleRollbackModalCancel}
            >
              取消
            </Button>
            <Button 
              type="primary" 
              size="large"
              style={{ 
                flex: 1, 
                height: '44px',
                fontSize: '16px',
                borderRadius: '8px'
              }}
              loading={rollbackUploading}
              onClick={handleRollbackConfirm}
            >
              确认回退
            </Button>
          </div>
        }
      >
        <Form layout="vertical">
          <Form.Item label="回退理由" required>
            <Select
              placeholder="请选择回退理由"
              options={rollbackReasonOptions}
              value={rollbackReason}
              onChange={setRollbackReason}
              allowClear
            />
          </Form.Item>
          <Form.Item label="回退证据（图片，最多5张）" required>
            <Upload
              listType="picture-card"
              fileList={rollbackEvidenceFileList}
              customRequest={() => {}}
              beforeUpload={handleBeforeUpload}
              onRemove={handleRemoveEvidence}
              showUploadList={{ showRemoveIcon: true }}
              multiple
              accept="image/*"
              disabled={isUploadDisabled}
            >
              {shouldShowUploadButton && (
                <div>
                  <UploadOutlined />
                  <div style={{ marginTop: 8 }}>上传</div>
                </div>
              )}
            </Upload>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default MobileFollowups;