import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Layout, message, Modal, Button, Form, Select, Upload, Drawer } from 'antd';
import { UploadOutlined } from '@ant-design/icons';
import { PageHeader } from './components/PageHeader';
import { FilterPanel } from './components/FilterPanel';
import { GroupPanel } from './components/GroupPanel';
import { FollowupsTable } from './components/FollowupsTable';
import { FrequencyAlert } from './components/FrequencyAlert';
import { FollowupStageDrawer } from './components/FollowupStageDrawer';
import { useFollowupsData } from './hooks/useFollowupsData';
import { useFilterManager } from './hooks/useFilterManager';
import { useGroupManager } from './hooks/useGroupManager';
import { useEnumData } from './hooks/useEnumData';
import { useFrequencyControl } from './hooks/useFrequencyControl';
import { useAutoSave } from './hooks/useAutoSave';
import { useOptimizedLocalData } from './hooks/useOptimizedLocalData';
import { getServiceManager } from '../../components/Followups/services/ServiceManager';
import { useUser } from '../../context/UserContext';
import { supabase } from '../../supaClient';
import imageCompression from 'browser-image-compression';
import RollbackList from '../RollbackList.tsx';
import FollowupsCalendarView from '../FollowupsCalendarView';
import LeadDetailDrawer from '../../components/LeadDetailDrawer';
import './Followups.css';
import { toBeijingTime } from '../../utils/timeUtils';

const { Content } = Layout;

const Followups: React.FC = () => {
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
          .eq('id', 3) // 假设回退理由的Selection.id是3
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
  const groupManager = useGroupManager();
  const enumData = useEnumData();
  const frequencyControl = useFrequencyControl();
  
  // 分组面板展开/收起状态
  const [groupPanelOpen, setGroupPanelOpen] = useState(false);
  
  // 初始化默认分组字段
  useEffect(() => {
    // 分组字段现在总是有默认值，不需要额外检查
    setGroupPanelOpen(false); // 默认收起分组面板
  }, []);
  
  // 回退相关状态
  const [rollbackModalVisible, setRollbackModalVisible] = useState(false);
  const [rollbackRecord, setRollbackRecord] = useState<any>(null);
  const [rollbackReason, setRollbackReason] = useState<string | undefined>();
  const [rollbackEvidenceList, setRollbackEvidenceList] = useState<any[]>([]);
  const [rollbackUploading, setRollbackUploading] = useState(false);
  const [rollbackReasonOptions, setRollbackReasonOptions] = useState<any[]>([]);
  
  // 新增：回退列表和日历视图状态
  const [rollbackListVisible, setRollbackListVisible] = useState(false);
  const [calendarVisible, setCalendarVisible] = useState(false);
  
  // 抽屉状态
  const [stageDrawerOpen, setStageDrawerOpen] = useState(false);
  const [currentEditRecord, setCurrentEditRecord] = useState<any>(null);
  
  // 新增：线索详情抽屉状态
  const [leadDetailDrawerOpen, setLeadDetailDrawerOpen] = useState(false);
  const [selectedLeadId, setSelectedLeadId] = useState<string>('');
  
  // 优化：添加数据加载状态跟踪
  const [groupDataLoaded, setGroupDataLoaded] = useState(false);
  
  // 立即自动保存系统
  const autoSave = useAutoSave({
    maxRetries: 3,        // 最大重试3次
    retryDelay: 1000      // 重试延迟1秒
  });
  
  // 优化的本地数据管理 - 立即保存模式
  const optimizedLocalData = useOptimizedLocalData(followupsData.data, {
    enableOptimisticUpdates: true   // 启用乐观更新
  });

  // 优化：图片压缩选项常量，避免重复创建
  const imageCompressionOptions = useMemo(() => ({
    maxSizeMB: 0.5,
    maxWidthOrHeight: 1280,
    useWebWorker: true,
  }), []);

  // 确保传递给表格的数据是安全的
  const safeTableData = useMemo(() => {
    const data = optimizedLocalData.data;
    if (Array.isArray(data)) {
      return data;
    }
    console.warn('⚠️ [Followups] 表格数据不是数组:', data);
    return [];
  }, [optimizedLocalData.data]);

  // 处理关键词搜索 - 使用统一筛选参数
  const handleKeywordSearch = useCallback((value: string) => {
    // 先设置关键词状态
    filterManager.setKeywordSearch(value);
    
    // 直接构建包含关键词的筛选参数，避免状态更新时序问题
    const currentFilters = filterManager.getCurrentFiltersFn();
    const filtersWithKeyword = value.trim() 
      ? { ...currentFilters, p_keyword: value.trim() }
      : { ...currentFilters };
    
    // 删除 p_keyword 如果值为空
    if (!value.trim()) {
      delete filtersWithKeyword.p_keyword;
    }
    
    followupsData.refreshData(filtersWithKeyword);
  }, [filterManager, followupsData]);

  // 处理关键词状态更新（不触发搜索）
  const handleKeywordChange = useCallback((value: string) => {
    // 只更新关键词状态，不触发搜索
    filterManager.setKeywordSearch(value);
  }, [filterManager]);

  // 处理关键词清除 - 使用统一筛选参数
  const handleKeywordClear = useCallback(() => {
    // 先清除关键词状态
    filterManager.setKeywordSearch('');
    
    // 直接构建不包含关键词的筛选参数
    const currentFilters = filterManager.getCurrentFiltersFn();
    const filtersWithoutKeyword = { ...currentFilters };
    delete filtersWithoutKeyword.p_keyword;
    followupsData.refreshData(filtersWithoutKeyword);
  }, [filterManager, followupsData]);

  // 处理分组字段变更
  const handleGroupFieldChange = useCallback((value: string) => {
    // 设置分组字段
    groupManager.setGroupField(value);
    
    // 选择分组字段时，默认展开分组面板
    setGroupPanelOpen(true);
    
    // 重置数据加载状态，确保字段变更后能重新加载数据
    setGroupDataLoaded(false);
    
    // 检查枚举数据是否已加载
    const enumsStatus = enumData.getEnumsLoadingStatus();
    const requiredEnum = value === 'followupstage' ? 'followupstage' :
                       value === 'scheduledcommunity' ? 'community' :
                       value === 'source' ? 'source' : null;
    
    if (requiredEnum && !enumsStatus[requiredEnum as keyof typeof enumsStatus]) {
      console.warn(`⚠️ [Followups] 枚举数据 ${requiredEnum} 尚未加载完成，等待加载完成后再获取分组数据`);
      // 等待枚举数据加载完成后再获取分组数据
      const checkEnumLoaded = () => {
        const currentStatus = enumData.getEnumsLoadingStatus();
        if (currentStatus[requiredEnum as keyof typeof currentStatus]) {
          // 使用当前筛选条件获取分组数据
          const currentFilters = filterManager.getCurrentFiltersFn();
          groupManager.fetchGroupData(value, currentFilters);
          setGroupDataLoaded(true);
        } else {
          setTimeout(checkEnumLoaded, 100);
        }
      };
      checkEnumLoaded();
    } else {
      // 获取分组统计数据 - 使用统一筛选参数
      const currentFilters = filterManager.getCurrentFiltersFn();
      groupManager.fetchGroupData(value, currentFilters);
      setGroupDataLoaded(true);
    }
  }, [groupManager, enumData, filterManager, groupDataLoaded]);

  // 处理分组面板切换
  const handleGroupPanelToggle = useCallback((open: boolean) => {
    setGroupPanelOpen(open);
    
    // 只在面板打开且分组数据未加载时才加载数据
    if (open && !groupDataLoaded && groupManager.groupField) {
      const currentFilters = filterManager.getCurrentFiltersFn();
      groupManager.fetchGroupData(groupManager.groupField, currentFilters);
      setGroupDataLoaded(true);
    }
  }, [filterManager, groupManager, groupDataLoaded]);

  // 处理刷新 - 使用统一筛选参数
  const handleRefresh = useCallback(() => {
    const currentFilters = filterManager.getCurrentFiltersFn();
    followupsData.refreshData(currentFilters);
    groupManager.fetchGroupData(groupManager.groupField, currentFilters);
    enumData.refreshAllEnums();
    // 重置数据加载状态，确保下次打开面板时能重新加载
    setGroupDataLoaded(false);
    message.success('数据已刷新');
  }, [filterManager, followupsData, groupManager, enumData]);

  // 处理筛选条件移除 - 使用统一筛选参数
  const handleFilterRemove = useCallback((key: string, value?: any) => {
    filterManager.removeFilter(key, value);
    // 移除直接刷新，让 useEffect 自动处理，避免重复刷新
    // followupsData.refreshData(currentFilters);
    // if (groupManager.groupField) {
    //   groupManager.fetchGroupData(groupManager.groupField, currentFilters);
    // }
  }, [filterManager]);

  // 处理筛选条件重置 - 使用统一筛选参数
  const handleFilterReset = useCallback(() => {
    
    // 检查是否有活跃的筛选条件
    const activeFilterCount = Object.keys(filterManager.filters).length;
    if (activeFilterCount > 0) {
    }
    
    filterManager.resetAllFilters();
    followupsData.resetPagination();
    
    // 重置后自动刷新数据（通过 useEffect 监听）
    // 不需要手动调用，避免重复刷新
  }, [filterManager, followupsData]);

  // 处理分组点击 - 实现分组统计表和明细表的联动
  const handleGroupClick = useCallback((groupKey: string | number | null | undefined) => {
    const result = groupManager.handleGroupClick(groupKey);
    
    if (result?.shouldResetPagination) {
      followupsData.resetPagination();
    }
    
    // 应用新的筛选条件
    if (result?.newFilters && Object.keys(result.newFilters).length > 0) {
      
      // 更新筛选器状态
      filterManager.setFilters((prev: any) => ({
        ...prev,
        ...result.newFilters
      }));
      
      // 立即刷新明细数据 - 使用统一筛选参数
      const currentFilters = filterManager.getCurrentFiltersFn();
      followupsData.fetchFollowups(currentFilters, 1, followupsData.pagination.pageSize);
      
      // 同时刷新分组数据，确保分组统计与明细数据一致
      groupManager.fetchGroupData(groupManager.groupField, currentFilters);
      // 重置数据加载状态，确保分组筛选后能重新加载数据
      setGroupDataLoaded(false);
    } else {
      // 如果没有新的筛选条件，直接刷新 - 使用统一筛选参数
      const currentFilters = filterManager.getCurrentFiltersFn();
      followupsData.refreshData(currentFilters);
      
      // 同时刷新分组数据
      groupManager.fetchGroupData(groupManager.groupField, currentFilters);
      // 重置数据加载状态，确保分组筛选后能重新加载数据
      setGroupDataLoaded(false);
    }
  }, [groupManager, followupsData, filterManager, groupDataLoaded]);

  // 处理快捷日期变更
  const handleQuickDateChange = useCallback((key: string | null) => {
    
    // 设置时间筛选条件
    filterManager.setQuickDateFilter(key);
    
    // 让 useEffect 自动处理数据刷新，避免重复调用
    // 只重置分页，数据刷新由筛选条件变化的 useEffect 处理
    followupsData.resetPagination();
    
    // 注意：快捷日期变更后的数据刷新会通过 useEffect 自动处理
    // 包括明细数据和分组数据的同步更新
    
    
  }, [filterManager, followupsData]);

  // 监听筛选条件变化，自动刷新数据 - 统一筛选参数管理
  useEffect(() => {
    // 只在筛选条件真正变化时才刷新数据
    const currentFilters = filterManager.getCurrentFiltersFn();
    
    // 重置数据加载状态，确保筛选后能重新加载分组数据
    setGroupDataLoaded(false);
    
    // 使用防抖，避免频繁刷新，但提高响应性
    const timeoutId = setTimeout(() => {
      
      
      // 使用统一的筛选参数刷新明细数据
      followupsData.refreshData(currentFilters);
      
      // 始终刷新分组统计数据（确保时间筛选器生效）
      groupManager.fetchGroupData(groupManager.groupField, currentFilters);
    }, 200); // 减少到200ms，提高响应性
    
    return () => clearTimeout(timeoutId);
  }, [filterManager.filters, groupManager.groupField]); // 移除 groupPanelOpen 依赖，避免面板状态变化时重新加载数据

  // 处理表格变更 - 统一筛选参数管理
  const handleTableChange = useCallback((pagination: any, filters: any) => {
    // 检查是否是分页变化
    if (pagination.current !== followupsData.pagination.current || 
        pagination.pageSize !== followupsData.pagination.pageSize) {
      // 分页变化，保持当前筛选条件，直接调用fetchFollowups
      followupsData.setPagination({
        current: pagination.current,
        pageSize: pagination.pageSize,
        total: pagination.total
      });
          // 使用统一的筛选参数
    const currentFilters = filterManager.getCurrentFiltersFn();
    followupsData.fetchFollowups(currentFilters, pagination.current, pagination.pageSize);
      return;
    }
    
          // 筛选变化，更新筛选条件并刷新数据
      if (filters && Object.keys(filters).length > 0) {
        // 将表格筛选器转换为RPC参数格式
        const rpcFilters: any = {};
        Object.entries(filters).forEach(([key, value]) => {
          if (value && Array.isArray(value) && value.length > 0) {
            // 特殊处理创建日期范围筛选器
            if (key === 'created_at') {
              // 处理日期范围
              if (value.length >= 2) {
                const [start, end] = value;
                if (start && end) {
                  rpcFilters.p_created_at_start = start;
                  rpcFilters.p_created_at_end = end;
                }
              }
              // 处理非空条件
              const notNullItem = value.find((v: any) => v && typeof v === 'object' && v.notNull);
              if (notNullItem) {
                rpcFilters.p_created_at_not_null = [true];
              }
              return; // 使用return而不是continue
            }
            
            // 特殊处理入住时间范围筛选器
            if (key === 'moveintime') {
              // 处理日期范围
              if (value.length >= 2) {
                const [start, end] = value;
                if (start && end) {
                  rpcFilters.p_moveintime_start = start;
                  rpcFilters.p_moveintime_end = end;
                }
              }
              // 处理非空条件
              const notNullItem = value.find((v: any) => v && typeof v === 'object' && v.notNull);
              if (notNullItem) {
                rpcFilters.p_moveintime_not_null = [true];
              }
              return; // 使用return而不是continue
            }
            
            // 特殊处理预约时间范围筛选器
            if (key === 'scheduletime') {
              console.log('🔍 [Followups] 处理预约时间筛选器:', { key, value, valueType: typeof value, isArray: Array.isArray(value) });
              
              // 处理日期范围
              if (value.length >= 2) {
                const [start, end] = value;
                console.log('📅 [Followups] 预约时间范围:', { start, end, startType: typeof start, endType: typeof end });
                
                if (start && end) {
                  rpcFilters.p_scheduletime_start = start;
                  rpcFilters.p_scheduletime_end = end;
                  console.log('✅ [Followups] 预约时间范围参数已设置:', { 
                    p_scheduletime_start: rpcFilters.p_scheduletime_start, 
                    p_scheduletime_end: rpcFilters.p_scheduletime_end 
                  });
                } else {
                  console.log('⚠️ [Followups] 预约时间范围参数无效:', { start, end });
                }
              } else {
                console.log('⚠️ [Followups] 预约时间值长度不足:', { length: value.length, value });
              }
              
              // 处理非空条件
              const notNullItem = value.find((v: any) => v && typeof v === 'object' && v.notNull);
              if (notNullItem) {
                rpcFilters.p_scheduletime_not_null = [true];
                console.log('✅ [Followups] 预约时间非空条件已设置:', { 
                  p_scheduletime_not_null: rpcFilters.p_scheduletime_not_null 
                });
              } else {
                console.log('ℹ️ [Followups] 预约时间未选择非空条件');
              }
              
              console.log('🔍 [Followups] 预约时间筛选器处理完成，rpcFilters:', rpcFilters);
              return; // 使用return而不是continue
            }
            
            // 特殊处理预算范围筛选器
            if (key === 'userbudget' && value.length === 2) {
              const [min, max] = value;
              if (min !== null && min !== undefined && min !== '') {
                rpcFilters.p_userbudget_min = Number(min);
              }
              if (max !== null && max !== undefined && max !== '') {
                rpcFilters.p_userbudget_max = Number(max);
              }
            } else {
              const rpcKey = `p_${key}`;
              rpcFilters[rpcKey] = value;
            }
          }
        });
      
      // 验证枚举字段的值是否有效
      const enumFields = ['p_followupstage', 'p_customerprofile', 'p_userrating', 'p_scheduledcommunity', 'p_source'];
      enumFields.forEach(field => {
        if (rpcFilters[field] && Array.isArray(rpcFilters[field])) {
          // 过滤掉空值
          const validValues = rpcFilters[field].filter((v: any) => v !== null && v !== undefined && v !== '');
          if (validValues.length > 0) {
            rpcFilters[field] = validValues;
          } else {
            delete rpcFilters[field];
          }
        }
      });
      
      // 更新筛选器状态 - 让useEffect自动处理数据刷新，避免循环调用
      filterManager.setFilters((prev: any) => ({
        ...prev,
        ...rpcFilters
      }));
      
      // 重置分页 - 数据刷新由useEffect自动处理
      followupsData.resetPagination();
      
      // 同步分组选中状态
      groupManager.syncSelectedGroup(rpcFilters);
      
      // 注意：表格筛选变更后的数据刷新会通过 useEffect 自动处理
      // 包括明细数据和分组数据的同步更新
    } else {
      // 没有筛选器变化，需要同步清除对应的筛选条件
      // 使用专门的清除函数，确保筛选参数同步更新
      filterManager.clearTableFilters();
      
      // 更新列筛选状态
      filterManager.setColumnFilters(filters);
    }
  }, [followupsData, filterManager, groupManager]);

  // 处理行编辑 - 统一使用失焦更新模式
  const handleRowEdit = useCallback(async (record: any, field: keyof any, value: any) => {
    const originalValue = (followupsData.data.find(item => item.id === record.id) as any)?.[field];
    
    // 改进的值比较逻辑，处理类型转换
    const originalStr = originalValue !== undefined && originalValue !== null ? String(originalValue) : '';
    const newStr = value !== undefined && value !== null ? String(value) : '';
    
    if (originalStr === newStr) { 
      console.log(`🔄 [Followups] 字段 ${String(field)} 值未变化，跳过保存:`, { original: originalValue, new: value });
      return; // 值没有变化，不需要保存
    }
    
    console.log(`💾 [Followups] 开始保存字段 ${String(field)}:`, { 
      recordId: record.id, 
      original: originalValue, 
      new: value,
      field: String(field) 
    });
    
    // 失焦更新：更新本地数据并保存到数据库
    optimizedLocalData.updateField(record.id, field as any, value);
    
    // 保存到数据库
    const result = await autoSave.saveField(record.id, field as string, value, originalValue);

    if (!result.success) {
      // 保存失败，回滚本地数据
      optimizedLocalData.rollbackField(record.id, field as any, originalValue);
      message.error('保存失败: ' + (result.error || '未知错误'));
      console.error(`❌ [Followups] 字段 ${String(field)} 保存失败:`, result.error);
    } else if (!result.skipped) {
      // 保存成功（非跳过）
      message.success('保存成功');
      console.log(`✅ [Followups] 字段 ${String(field)} 保存成功`);
    } else {
      // 保存被跳过（值相同）
      console.log(`⏭️ [Followups] 字段 ${String(field)} 保存被跳过（值相同）`);
    }
  }, [followupsData.data, optimizedLocalData, autoSave]);

  // 处理线索详情点击
  const handleLeadDetailClick = useCallback((leadid: string) => {
    setSelectedLeadId(leadid);
    setLeadDetailDrawerOpen(true);
  }, []);

  // 处理阶段点击
  const handleStageClick = useCallback((record: any) => {
    setCurrentEditRecord(record);
    setStageDrawerOpen(true);
  }, []);

  // 处理抽屉保存
  const handleStageDrawerSave = useCallback((record: any, updatedFields: any) => {
    // 更新本地数据
    optimizedLocalData.updateMultipleFields(record.id, updatedFields);
    
    // 检查是否是关闭时的自动保存，如果是则不触发全局刷新
    if (updatedFields._autoSaveOnClose) {
      // 自动保存时只更新本地数据，不触发全局刷新
      console.log('🔄 [Followups] 抽屉关闭时自动保存，跳过全局刷新');
      return;
    }
    
    // 手动保存时刷新数据以确保同步
    const currentFilters = filterManager.getCurrentFiltersFn();
    followupsData.refreshData(currentFilters);
    
    // 刷新分组统计
    groupManager.fetchGroupData(groupManager.groupField, currentFilters);
  }, [optimizedLocalData, filterManager, followupsData, groupManager]);

  // 处理抽屉关闭
  const handleStageDrawerClose = useCallback(() => {
    setStageDrawerOpen(false);
    setCurrentEditRecord(null);
  }, []);

  // 处理回退操作
  const handleRollbackClick = useCallback((record: any) => {
    setRollbackRecord(record);
    setRollbackModalVisible(true);
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
    return false; // 阻止自动上传
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
      // 清理被删除项的预览URL
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
      // 0. 检查同一线索是否已存在未完成的回退审批流实例
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
      // 1. 上传所有图片，获取url
      const uploaded: any[] = [];
      for (const item of rollbackEvidenceList) {
        if (item.url) {
          uploaded.push(item.url);
          continue;
        }
        // 使用图片压缩优化上传
        const compressedFile = await imageCompression(item.file, imageCompressionOptions);
        const fileExt = compressedFile.name.split('.').pop();
        const fileName = `rollback-${toBeijingTime(new Date()).valueOf()}-${Math.floor(Math.random()*10000)}.${fileExt}`;
        const filePath = `rollback/${fileName}`;
        const { error } = await supabase.storage.from('rollback').upload(filePath, compressedFile);
        if (error) throw error;
        const { data } = supabase.storage.from('rollback').getPublicUrl(filePath);
        uploaded.push(data.publicUrl);
      }
      // 2. 查找审批流模板id
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
      // 3. 插入审批流实例
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
      // 刷新数据
      handleRefresh();
    } catch (e: any) {
      message.error('回退提交失败: ' + (e.message || e.toString()));
    }
    setRollbackUploading(false);
  }, [rollbackReason, rollbackEvidenceList, rollbackRecord, profile, clearPreviewUrls, handleRefresh, imageCompressionOptions]);

  // 同步外部数据变化到乐观更新系统（添加防抖）
  useEffect(() => {
    if (followupsData.data && followupsData.data.length > 0) {
      // 使用防抖，避免频繁同步导致的数据闪烁
      const timer = setTimeout(() => {
        optimizedLocalData.syncExternalData(followupsData.data);
      }, 300);
      
      return () => clearTimeout(timer);
    }
  }, [followupsData.data, optimizedLocalData.syncExternalData]);

  // 清理资源
  useEffect(() => {
    return () => {
      optimizedLocalData.cleanup();
    };
  }, [optimizedLocalData]);

  // 新增：回退菜单配置
  const rollbackMenu = useMemo(() => ({
    items: [
      {
        key: 'rollback-list',
        label: '回退列表',
        onClick: () => setRollbackListVisible(true),
      },
      {
        key: 'calendar-view',
        label: '入住日历',
        onClick: () => setCalendarVisible(true),
      },
    ]
  }), []);

  // 优化：提取 Modal 关闭处理函数
  const handleRollbackModalCancel = useCallback(() => {
    setRollbackModalVisible(false);
    // 关闭时清空所有相关状态
    clearPreviewUrls(rollbackEvidenceList);
    setRollbackRecord(null);
    setRollbackReason(undefined);
    setRollbackEvidenceList([]);
    setRollbackUploading(false);
  }, [rollbackEvidenceList, clearPreviewUrls]);

  const handleRollbackModalClose = useCallback(() => {
    setRollbackModalVisible(false);
    // 关闭时清空所有相关状态
    clearPreviewUrls(rollbackEvidenceList);
    setRollbackRecord(null);
    setRollbackReason(undefined);
    setRollbackEvidenceList([]);
    setRollbackUploading(false);
  }, [rollbackEvidenceList, clearPreviewUrls]);

  const handleRollbackListClose = useCallback(() => {
    setRollbackListVisible(false);
  }, []);

  const handleCalendarClose = useCallback(() => {
    setCalendarVisible(false);
  }, []);

  // 优化：缓存回退证据的文件列表映射
  const rollbackEvidenceFileList = useMemo(() => {
    return rollbackEvidenceList.map((item, idx) => ({
      uid: idx + '',
      name: item.name,
      status: 'done' as const,
      url: item.url || item.preview,
      thumbUrl: item.preview,
    }));
  }, [rollbackEvidenceList]);

  // 优化：缓存 Upload 组件的禁用状态
  const isUploadDisabled = useMemo(() => {
    return rollbackEvidenceList.length >= 5 || rollbackUploading;
  }, [rollbackEvidenceList.length, rollbackUploading]);

  // 优化：缓存 Upload 组件的显示状态
  const shouldShowUploadButton = useMemo(() => {
    return rollbackEvidenceList.length < 5 && !rollbackUploading;
  }, [rollbackEvidenceList.length, rollbackUploading]);

  // 优化：缓存静态值，避免每次渲染时重新创建
  const staticValues = useMemo(() => ({
    interviewsalesUserList: [],
    interviewsalesUserLoading: false,
  }), []);

  return (
    <div className="followups-page-card">
            {/* 页面头部 */}
            <PageHeader
              title="跟进记录"
              keywordSearch={filterManager.keywordSearch}
              groupField={groupManager.groupField}
              groupFieldOptions={enumData.groupFieldOptions}
              onKeywordSearch={handleKeywordSearch}
              onKeywordChange={handleKeywordChange}
              onKeywordClear={handleKeywordClear}
              onGroupFieldChange={handleGroupFieldChange}
              onRefresh={handleRefresh}
              onGroupPanelToggle={handleGroupPanelToggle}
              groupPanelOpen={groupPanelOpen}
              rollbackMenu={rollbackMenu}
            />

            {/* 频率控制提示 */}
            <FrequencyAlert cooldown={frequencyControl.cooldown} />
            

            {/* 筛选面板 */}
            <FilterPanel
              filters={filterManager.filters}
              onFilterRemove={handleFilterRemove}
              onFilterReset={handleFilterReset}
            />

            {/* 主要内容区域 */}
            <div className="followups-main-content">
          {/* 左侧分组面板 */}
          <div className={`followups-sidebar ${groupPanelOpen ? '' : 'closed'}`}>
            <GroupPanel
              groupPanelOpen={groupPanelOpen}
              groupTotal={groupManager.groupTotal}
              groupData={groupManager.groupData}
              selectedGroup={groupManager.selectedGroup}
              quickDateKey={filterManager.quickDateKey}
              onGroupClick={handleGroupClick}
              onQuickDateChange={handleQuickDateChange}
            />
          </div>

          {/* 右侧表格区域 */}
          <div className="followups-table-area">
            <FollowupsTable
              data={safeTableData}
              loading={followupsData.loading}
              pagination={followupsData.pagination}
              columnFilters={filterManager.columnFilters}
              communityEnum={enumData.communityEnum}
              followupstageEnum={enumData.followupstageEnum}
              customerprofileEnum={enumData.customerprofileEnum}
              sourceEnum={enumData.sourceEnum}
              userratingEnum={enumData.userratingEnum}
              majorCategoryOptions={enumData.majorCategoryOptions}
              metroStationOptions={enumData.metroStationOptions}
              onTableChange={handleTableChange}
              onRowEdit={handleRowEdit}
              onLeadDetailClick={handleLeadDetailClick}
              onStageClick={handleStageClick}
              onRollbackClick={handleRollbackClick}
              isFieldDisabled={frequencyControl.isFieldDisabled}
              forceUpdate={followupsData.forceUpdate}
              // 新增的筛选选项
              leadtypeFilters={enumData.leadtypeFilters}
              remarkFilters={enumData.remarkFilters}
              worklocationFilters={enumData.worklocationFilters}
              followupresultFilters={enumData.followupresultFilters}
              majorcategoryFilters={enumData.majorcategoryFilters}
              scheduledcommunityFilters={enumData.scheduledcommunityFilters}
              // 新增的枚举数据
              interviewsalesUserList={staticValues.interviewsalesUserList}
              interviewsalesUserLoading={staticValues.interviewsalesUserLoading}
              // 新增的工具函数
              findCascaderPath={enumData.findCascaderPath}
            />
          </div>
        </div>

      {/* 回退弹窗 */}
      <Modal
        open={rollbackModalVisible}
        title="回退操作"
        onCancel={handleRollbackModalCancel}
        destroyOnHidden
        centered
        width={500}
        footer={
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
            <Button onClick={handleRollbackModalCancel}>
              取消
            </Button>
            <Button 
              type="primary" 
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

      {/* 新增：回退列表弹窗 */}
      <Modal
        open={rollbackListVisible}
        title="回退申请列表"
        onCancel={handleRollbackListClose}
        footer={null}
        width={900}
        destroyOnHidden
        centered
        styles={{ 
          body: { 
            padding: '0',
            background: '#fff'
          } 
        }}
      >
        <RollbackList />
      </Modal>

      {/* 新增：入住日历视图弹窗 */}
      <Modal
        open={calendarVisible}
        title="入住日历视图"
        onCancel={handleCalendarClose}
        footer={null}
        width="95vw"
        style={{ top: 20 }}
        styles={{ body: { padding: '24px', maxHeight: '85vh', overflow: 'auto' } }}
        destroyOnClose
      >
        <FollowupsCalendarView />
      </Modal>

      {/* 线索详情抽屉 */}
      <Drawer
        open={leadDetailDrawerOpen}
        onClose={() => {
          setLeadDetailDrawerOpen(false);
          setSelectedLeadId('');
        }}
        title="线索详情"
        width={800}
        destroyOnHidden
        placement="right"
      >
        {selectedLeadId && <LeadDetailDrawer leadid={selectedLeadId} />}
      </Drawer>

      {/* 跟进阶段编辑抽屉 */}
      <FollowupStageDrawer
        open={stageDrawerOpen}
        onClose={handleStageDrawerClose}
        record={currentEditRecord}
        onSave={handleStageDrawerSave}
        isFieldDisabled={frequencyControl.isFieldDisabled}
        forceUpdate={followupsData.forceUpdate}
        communityEnum={enumData.communityEnum}
        followupstageEnum={enumData.followupstageEnum}
        customerprofileEnum={enumData.customerprofileEnum}
        userratingEnum={enumData.userratingEnum}
        majorCategoryOptions={enumData.majorCategoryOptions}
        metroStationOptions={enumData.metroStationOptions}
      />
    </div>
  );
};

export default Followups;
