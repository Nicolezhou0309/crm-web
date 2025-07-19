// 复制自FollowupsList.tsx，后续将在此文件实现自定义字段分组功能
// ... existing code from FollowupsList.tsx ... 

import React, { useEffect, useState, useMemo, useRef, useCallback } from 'react';
import { Table, Typography, Button, Space, Select, message, Input, Tag, Tooltip, DatePicker, Form, Steps, Drawer, Checkbox, Spin, Cascader, InputNumber, Divider, Alert } from 'antd';
import { ReloadOutlined, CopyOutlined, UserOutlined } from '@ant-design/icons';
import { supabase, fetchEnumValues, fetchMetroStations } from '../supaClient';
import dayjs from 'dayjs';
import type { FilterDropdownProps } from 'antd/es/table/interface';

import locale from 'antd/es/date-picker/locale/zh_CN';
import '../index.css'; // 假设全局样式在index.css
import LeadDetailDrawer from '../components/LeadDetailDrawer';
import { useFrequencyController, FrequencyController } from '../components/Followups/useFrequencyController';
import { ContractDealsTable } from '../components/Followups/ContractDealsTable';
import { saveFieldWithFrequency } from '../components/Followups/followupApi';
import { toBeijingTimeStr, normalizeUtcString } from '../utils/timeUtils';
import { useUser } from '../context/UserContext';

const { Title, Paragraph } = Typography;
const { Search } = Input;
const { RangePicker } = DatePicker;

// 可选分组字段配置
const groupFieldOptions = [
  { label: '跟进阶段', value: 'followupstage' },
  { label: '约访管家', value: 'interviewsales_user_id' },
  { label: '创建日期', value: 'created_at' },
  { label: '社区', value: 'scheduledcommunity' },
  { label: '渠道', value: 'source' },
  // 可继续扩展
];

// 统一单元格样式，减少重复
const defaultCellStyle = {
  minWidth: 140,
  maxWidth: 180,
  paddingLeft: 12,
  paddingRight: 12,
  whiteSpace: 'nowrap',
  overflow: 'hidden',
  textOverflow: 'ellipsis'
};

// 数据脱敏工具函数
const maskPhone = (phone: string): string => {
  if (!phone || phone.length < 7) return phone;
  return phone.substring(0, 4) + '****' + phone.substring(phone.length - 3);
};

const maskWechat = (wechat: string): string => {
  if (!wechat || wechat.length < 4) return wechat;
  return wechat.substring(0, 2) + '****' + wechat.substring(wechat.length - 2);
};

const FollowupsGroupList: React.FC = () => {
  // 使用 UserContext 中的用户信息
  const { user, profile, loading: userLoading } = useUser();
  
  // 1. 优化 userId 和 frequencyController 初始化
  const [userId, setUserId] = useState<number | null>(null);
  const [frequencyController, setFrequencyController] = useState<FrequencyController | null>(null);
  const [frequencyControllerReady, setFrequencyControllerReady] = useState(false); // 标记 frequencyController 是否已准备就绪

  // 合并用户认证和频控初始化，确保顺序执行
  useEffect(() => {
    async function initializeUserAndFrequency() {

      
      if (user && profile) { 
        setUserId(profile.id);
        
        // 立即创建 FrequencyController
        const controller = new FrequencyController(profile.id);
        setFrequencyController(controller);
        setFrequencyControllerReady(true);
      } else {
        setFrequencyControllerReady(true);
      }
    }
    
    initializeUserAndFrequency();
  }, [user, profile, userLoading]);

  // 跟进数据
  const [data, setData] = useState<any[]>([]);
  const [localData, setLocalData] = useState<any[]>([]);

  const [loading, setLoading] = useState(false);
  const [groupField, setGroupField] = useState<string | undefined>(undefined);
  const [selectedGroup, setSelectedGroup] = useState<string>('');
  const [tableFilters, setTableFilters] = useState<any>({});
  const [pagination, setPagination] = useState({ current: 1, pageSize: 10, total: 0 });
  // 枚举
  const [communityEnum, setCommunityEnum] = useState<{ label: string; value: string }[]>([]);
  const [followupstageEnum, setFollowupstageEnum] = useState<{ label: string; value: string }[]>([]);
  const [customerprofileEnum, setCustomerprofileEnum] = useState<{ label: string; value: string }[]>([]);
  const [sourceEnum, setSourceEnum] = useState<{ label: string; value: string }[]>([]);
  const [userratingEnum, setUserratingEnum] = useState<{ label: string; value: string }[]>([]);
  const [groupPanelOpen, setGroupPanelOpen] = useState(false);
  const [groupRowsCache, setGroupRowsCache] = useState<{ key: string; groupValue: string; groupText: string; count: number }[]>([]);
  // 新增：分组总数
  const [groupTotal, setGroupTotal] = useState(0);
  // 新增：受控Table字段筛选
  const [tableColumnFilters, setTableColumnFilters] = useState<any>({});
  // 快捷日期筛选key
  const [quickDateKey, setQuickDateKey] = useState<string | null>(null);
  // 1. State
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [currentStage, setCurrentStage] = useState('');
  const [currentRecord, setCurrentRecord] = useState<any | null>(null);
  const [stageForm] = Form.useForm();
  const [currentStep, setCurrentStep] = useState(0);
  // 在组件内部
  const [phoneSearch, setPhoneSearch] = useState('');
  const [wechatSearch, setWechatSearch] = useState('');
  const [keywordSearch, setKeywordSearch] = useState('');
  // 签约记录列表状态
  const [dealsList, setDealsList] = useState<any[]>([]);
  const [dealsLoading, setDealsLoading] = useState(false);
  const [leadDetailDrawerOpen, setLeadDetailDrawerOpen] = useState(false);
  const [leadDetailId, setLeadDetailId] = useState<string | null>(null);
  const [majorCategoryOptions, setMajorCategoryOptions] = useState<any[]>([]);
  const [forceUpdate, setForceUpdate] = useState(0); // 强制更新计数器
  const [shouldResetPagination, setShouldResetPagination] = useState(false); // 是否需要重置分页
  const [metroStationOptions, setMetroStationOptions] = useState<any[]>([]); // 地铁站多级选择选项

  
  // 使用 useRef 跟踪 localData 引用，避免不必要的 setState
  const localDataRef = useRef<any[]>([]);

  // 2. 步骤条、表单字段、label
  const followupStages = [
    '丢单', '待接收', '确认需求', '邀约到店', '已到店', '赢单'
  ];
  const stageFields = {
    '丢单': ['followupresult'],
    '待接收': [],
    '确认需求': [
      'customerprofile',
      'worklocation',
      'userbudget',
      'moveintime',
      'userrating',
      'majorcategory',
      'followupresult'
    ],
    '邀约到店': ['scheduletime', 'scheduledcommunity'],
    '已到店': [],
    '赢单': []
  };
  const fieldLabelMap: Record<string, string> = {
    customerprofile: '用户画像',
    worklocation: '工作地点',
    userbudget: '用户预算',
    moveintime: '入住时间',
    userrating: '来访意向',
    majorcategory: '跟进结果',
    followupresult: '跟进备注',
    scheduletime: '预约到店时间',
    scheduledcommunity: '预约社区',
    showingsales_user: '带看管家',
    followupstage: '跟进阶段',
  };

  // 获取枚举
  useEffect(() => {
    // 检查缓存
    const loadEnumWithCache = async (enumName: string, setter: any) => {
      const cacheKey = `enum_${enumName}`;
      const cacheTimestamp = localStorage.getItem(`${cacheKey}_timestamp`);
      
      // 缓存5分钟有效
      if (cacheTimestamp && Date.now() - parseInt(cacheTimestamp) < 5 * 60 * 1000) {
        const cached = localStorage.getItem(cacheKey);
        if (cached) {
          setter(JSON.parse(cached));
          return;
        }
      }
      
      try {
        const arr = await fetchEnumValues(enumName);
        const enumData = arr.map(v => ({ value: v, label: v }));
        setter(enumData);
        
        // 更新缓存
        localStorage.setItem(cacheKey, JSON.stringify(enumData));
        localStorage.setItem(`${cacheKey}_timestamp`, Date.now().toString());
      } catch (error) {
        console.error(`加载${enumName}枚举失败:`, error);
      }
    };
    
    // 并行加载所有枚举
    Promise.all([
      loadEnumWithCache('community', setCommunityEnum),
      loadEnumWithCache('followupstage', setFollowupstageEnum),
      loadEnumWithCache('customerprofile', setCustomerprofileEnum),
      loadEnumWithCache('source', setSourceEnum),
      loadEnumWithCache('userrating', setUserratingEnum)
    ]);
  }, []);

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
    'p_wechat', 'p_worklocation', 'p_phone', 'p_keyword'
  ];

  // 查询明细数据（后端分页）
  const fetchFollowups = async (
    filters: any = tableFilters,
    page = pagination.current,
    pageSize = pagination.pageSize
  ) => {
    console.log('[fetchFollowups] 调用参数:', { page, pageSize, filters: Object.keys(filters) });
    setLoading(true);
    try {
      // 计算分页参数
      const p_limit = pageSize;
      const p_offset = (page - 1) * pageSize;

      console.log('[fetchFollowups] 分页参数:', { p_limit, p_offset });

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

      // 确保日期参数格式正确
      const dateParams = [
        'p_created_at_start', 'p_created_at_end',
        'p_moveintime_start', 'p_moveintime_end'
      ];
      dateParams.forEach(key => {
        if (key in params && params[key]) {
          params[key] = dayjs(params[key]).format('YYYY-MM-DD HH:mm:ssZ');
        }
      });

      // 只传 allowedParams
      const rpcParams = Object.fromEntries(
        Object.entries(params).filter(([key]) => allowedParams.includes(key) || key === 'p_groupby_field')
      );

      const { data, error } = await supabase.rpc('filter_followups', rpcParams);
      

      
      if (error) {
        message.error('获取跟进记录失败: ' + error.message);
      } else {
        const total = data && data.length > 0 ? Number(data[0].total_count) : 0;
        
        // 前端校验：只保留id非空且唯一的行
        const filtered = (data || []).filter((item: any): item is any => !!item && !!item.id);
        const unique = Array.from(new Map(filtered.map((i: any) => [i.id, i])).values()) as any[];
        
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
        setLocalData(safeData); // 同步更新 localData
        localDataRef.current = safeData; // 同步更新 ref
        
        // 更新分页信息，保持当前页或使用传入的页数
        setPagination(prev => ({ ...prev, total, current: page, pageSize }));
        
        console.log('[fetchFollowups] 结果:', { 
          total, 
          current: page, 
          pageSize, 
          dataCount: safeData.length 
        });
      }
    } catch (error) {
      message.error('获取跟进记录失败');
    } finally {
      setLoading(false);
    }
  };

  // 获取分组统计
  const fetchGroupCount = async (groupFieldParam = groupField) => {
    
    if (!groupFieldParam) {
      setGroupRowsCache([]);
      setGroupTotal(0); // 分组字段为空时总数为0
      return;
    }
    setLoading(true);
    try {
      // 移除当前分组字段的筛选条件，其它字段筛选条件全部保留
      const filterKey = 'p_' + groupFieldParam;
      const { [filterKey]: _, ...restFilters } = tableFilters;
      const params = { p_groupby_field: groupFieldParam, ...restFilters };
      
      // 确保数组参数正确传递（与fetchFollowups保持一致）
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

      const rpcParams = Object.fromEntries(
        Object.entries(params).filter(([key]) => allowedParams.includes(key) || key === 'p_groupby_field')
      );
      
      
      const { data, error } = await supabase.rpc('group_count_filter_followups', rpcParams);

      
      if (error) {
        message.error('获取分组统计失败: ' + error.message);
        setGroupRowsCache([]);
        setGroupTotal(0);
        return;
      }
      
      // 对分组结果进行排序，未分配/空值置顶
      const sortedData = data.sort((a: any, b: any) => {
        const aIsNull = a.group_id === null || a.group_value === null || 
                        a.group_id === undefined || a.group_value === undefined ||
                        String(a.group_id).toLowerCase() === 'null' || 
                        String(a.group_value).toLowerCase() === 'null' ||
                        a.group_value === '' || a.group_value === '未分组';
        const bIsNull = b.group_id === null || b.group_value === null || 
                        b.group_id === undefined || b.group_value === undefined ||
                        String(b.group_id).toLowerCase() === 'null' || 
                        String(b.group_value).toLowerCase() === 'null' ||
                        b.group_value === '' || b.group_value === '未分组';
        
        if (aIsNull && !bIsNull) return -1; // a是null，b不是null，a排在前面
        if (!aIsNull && bIsNull) return 1;  // a不是null，b是null，b排在前面
        return 0; // 都是null或都不是null，保持原有顺序
      });
      
      const groupRows = sortedData.map((g: any) => ({
        key: g.group_id ?? g.group_value, // key用ID
        groupValue: g.group_id ?? g.group_value, // groupValue用ID
        groupText: g.group_value, // groupText用昵称
        count: g.count,
      }));
      
      
      setGroupRowsCache(groupRows);
      // 统计总数
      const total = data.reduce((sum: number, g: any) => sum + Number(g.count), 0);
      setGroupTotal(total);

    } finally {
      setLoading(false);
    }
  };

  // 分组按钮点击时，强制传递ID（number）
  const handleGroupClick = (groupKey: string | number | null | undefined) => {
    if (!groupField) return;
    const filterKey = 'p_' + groupField;
    let newFilters;
    const isIdField = groupField === 'interviewsales_user_id' || groupField === 'showingsales_user_id';
    
    // 判断未分组/NULL值 - 改进判断逻辑
    const isNullOrEmpty = groupKey === null || groupKey === undefined || 
      String(groupKey).toLowerCase() === 'null' || String(groupKey) === '' || 
      (typeof groupKey === 'number' && (isNaN(groupKey) || groupKey === 0)) ||
      // 预约社区字段特殊处理：如果groupKey是"未分组"字符串，也视为NULL
      (groupField === 'scheduledcommunity' && String(groupKey) === '未分组');

    if (selectedGroup === String(groupKey)) {
      // 取消分组：移除该filterKey和日期区间
      const { [filterKey]: _, p_created_at_start, p_created_at_end, ...rest } = tableFilters;
      newFilters = rest;
      setSelectedGroup('');
    } else if (groupField === 'created_at') {
      // 日期分组，传递区间参数
      const dateStr = String(groupKey);
      newFilters = { ...tableFilters };
      delete newFilters[filterKey];
      if (isNullOrEmpty) {
        newFilters.p_created_at_start = null;
        newFilters.p_created_at_end = null;
      } else {
        newFilters.p_created_at_start = dayjs(dateStr).startOf('day').format('YYYY-MM-DD HH:mm:ss');
        newFilters.p_created_at_end = dayjs(dateStr).endOf('day').format('YYYY-MM-DD HH:mm:ss');
      }
      setSelectedGroup(isNullOrEmpty ? 'null' : dateStr);
    } else {
      // 统一处理所有字段的NULL值
      if (isNullOrEmpty) {
        // 传递[null]表示IS NULL条件
        newFilters = { ...tableFilters, [filterKey]: [null] };
        setSelectedGroup('null');
      } else {
        // 非空值分组
        if (isIdField) {
          // ID字段转换为number
          const numVal = Number(groupKey);
          newFilters = { ...tableFilters, [filterKey]: [isNaN(numVal) ? null : numVal] };
        } else {
          // 其他字段保持字符串
          newFilters = { ...tableFilters, [filterKey]: [String(groupKey)] };
        }
        setSelectedGroup(String(groupKey));
      }
    }
    
    setTableFilters(newFilters);
    // 分组条件变化时重置分页
    setShouldResetPagination(true);
    // 刷新明细数据和分组统计
    fetchFollowups(newFilters, 1, pagination.pageSize);
    
    // 同时更新分组统计
    if (groupField) {
      fetchGroupCount(groupField);
    }
  };

  // 只在分组字段变化时 fetch 分组统计，并同步 selectedGroup
  useEffect(() => {
    if (groupField) {
      fetchGroupCount(groupField);
      // 检查当前分组条件是否存在，自动高亮
      const filterKey = 'p_' + groupField;
      if (tableFilters[filterKey] && Array.isArray(tableFilters[filterKey]) && tableFilters[filterKey][0]) {
        setSelectedGroup(tableFilters[filterKey][0]);
      } else if (groupField === 'created_at' && (tableFilters.p_created_at_start || tableFilters.p_created_at_end)) {
        // 创建日期分组特殊处理：检查日期区间
        const startDate = tableFilters.p_created_at_start;
        if (startDate) {
          setSelectedGroup(dayjs(startDate).format('YYYY-MM-DD'));
        } else {
          setSelectedGroup('');
        }
      } else {
        setSelectedGroup('');
      }
    } else {
      setSelectedGroup('');
      setGroupRowsCache([]);
    }
    // 只在分组字段变化时重置分页，而不是在每次tableFilters变化时都重置
    setShouldResetPagination(true);
  }, [groupField]);

  // 优化：分离明细数据刷新和分组统计刷新
  // 当tableFilters变化时，同时刷新明细数据和分组统计
  useEffect(() => {
    // 避免初始化时的重复调用
    if (Object.keys(tableFilters).length > 0) {
      // 只有在筛选条件变化时才重置分页，否则保持当前分页
      const shouldReset = shouldResetPagination;
      const targetPage = shouldReset ? 1 : pagination.current;
      fetchFollowups(tableFilters, targetPage, pagination.pageSize);
      
      // 同时更新分组统计
      if (groupField) {
        fetchGroupCount(groupField);
      }
      
      // 重置标志
      if (shouldReset) {
        setShouldResetPagination(false);
      }
    }
  }, [JSON.stringify(tableFilters), shouldResetPagination]);

  // 监听分组字段选择，控制分组区动画展开/收起
  useEffect(() => {
    setGroupPanelOpen(!!groupField);
  }, [groupField]);

  // 移除重复的useEffect，避免多次调用
  // useEffect(() => {
  //   if (groupField) {
  //     fetchGroupCount(groupField);
  //   }
  //   fetchFollowups(tableFilters);
  // }, [groupField, JSON.stringify(tableFilters)]);

  // 首次加载数据
  useEffect(() => {
    // 直接加载数据，移除不必要的权限检查
    fetchFollowups();
    // 获取管家列表
    fetchInterviewsalesUserList();
  }, []);

  // 监听筛选条件变化，重新获取管家列表
  useEffect(() => {
    // 避免在初始化时重复调用
    if (Object.keys(tableFilters).length > 0 && interviewsalesUserList.length === 0) {
      fetchInterviewsalesUserList();
    }
  }, [tableFilters]);

  // handleCellSave

  // getFilters 逻辑，value为ID（number），text为昵称，只收集number类型id
  const getFilters = (idKey: keyof any, nameKey: keyof any) => {
    const map = new Map();
    data.forEach(item => {
      const id = item[idKey];
      const name = item[nameKey];
      // ID类字段只收集number，普通字段收集非空字符串和空值
      if (idKey === 'interviewsales_user_id' || idKey === 'showingsales_user_id') {
        if (typeof id === 'number' && !isNaN(id) && id !== 0) {
          map.set(id, name || String(id));
        }
      } else {
        // 普通字段，收集非空字符串和空值（包括null/undefined/空字符串）
        if (typeof id === 'string') {
          if (id && id.trim()) {
            // 对手机号和微信号进行脱敏处理
            let displayText = name || id;
            if (idKey === 'phone') {
              displayText = maskPhone(id);
            } else if (idKey === 'wechat') {
              displayText = maskWechat(id);
            }
            map.set(id, displayText);
          } else if (id === '' || id === null || id === undefined) {
            map.set('', name || '为空');
          }
        } else if (id === null || id === undefined) {
          map.set('', '为空');
        }
      }
    });

    const filters = Array.from(map.entries()).map(([id, name]) => ({
      text: name || String(id),
      value: id === '' ? null : id, // 空字符串转换为null
      // 为手机号和微信号添加搜索文本，包含原始值和脱敏值
      searchText: (idKey === 'phone' || idKey === 'wechat') ? 
        `${id} ${name || id}` : undefined // 搜索时同时匹配原始值和显示值
    }));

    // 增加"未分配/为空"选项（如果还没有的话）
    const hasNullOption = filters.some(f => f.value === null);
    if (!hasNullOption) {
      filters.push({
        text: (idKey === 'interviewsales_user_id' || idKey === 'showingsales_user_id') ? '未分配' : '为空',
        value: null,
        searchText: undefined
      });
    }

    return filters;
  };



  // 在FollowupsGroupList组件内部，columns useMemo之前，定义render函数
  const renderUserbudget = (_text: string, record: any) => {
    return (
      <Tooltip title={record.userbudget ? `预算: ${record.userbudget}元` : '未设置预算'}>
        <InputNumber
          defaultValue={record.userbudget === '' ? undefined : Number(record.userbudget)}
          min={0}
          max={99999999}
          step={100}
          precision={0}
          style={{ minWidth: 100, maxWidth: 140, width: '100%' }}
          placeholder="请输入用户预算"
          onChange={(value) => {
            // 实时更新本地数据，提供即时反馈
            const val = value === null ? '' : String(value);
            updateLocalData(record.id, 'userbudget', val);
          }}
          onBlur={async (e) => {
            const val = (e.target as HTMLInputElement).value;
            const valStr = val === '' ? '' : String(val);
            const originalValue = data.find(item => item.id === record.id)?.userbudget || '';
            if (valStr !== originalValue) {
              await handleAnyFieldSave(record, 'userbudget', valStr);
            }
          }}
          onPressEnter={async (e) => {
            const val = (e.target as HTMLInputElement).value;
            const valStr = val === '' ? '' : String(val);
            const originalValue = data.find(item => item.id === record.id)?.userbudget || '';
            if (valStr !== originalValue) {
              await handleAnyFieldSave(record, 'userbudget', valStr);
            }
          }}
          disabled={isFieldDisabled()}
          key={forceUpdate}
        />
      </Tooltip>
    );
  };

  const renderFollowupresult = (_text: string, record: any) => (
    <Tooltip title={record.followupresult || '未设置跟进备注'}>
      <Input
        defaultValue={record.followupresult || ''}
        onChange={(e) => {
          // 实时更新本地数据，提供即时反馈
          const val = e.target.value;
          updateLocalData(record.id, 'followupresult', val);
        }}
        onBlur={async (e) => {
          const val = (e.target as HTMLInputElement).value;
          const originalValue = data.find(item => item.id === record.id)?.followupresult || '';
          if (val !== originalValue) {
            await handleAnyFieldSave(record, 'followupresult', val);
          }
        }}
        onPressEnter={async (e) => {
          const val = (e.target as HTMLInputElement).value;
          const originalValue = data.find(item => item.id === record.id)?.followupresult || '';
          if (val !== originalValue) {
            await handleAnyFieldSave(record, 'followupresult', val);
          }
        }}
        style={{ minWidth: 120, maxWidth: 180 }}
        placeholder="请输入跟进备注"
        disabled={isFieldDisabled()}
        key={forceUpdate}
      />
    </Tooltip>
  );

  // 使用混合方案的筛选选项
  // 枚举字段使用预定义选项
  const followupstageFilters = useMemo(() => 
    followupstageEnum.map(item => ({
      text: item.label,
      value: item.value
    })), [followupstageEnum]
  );

  const customerprofileFilters = useMemo(() => 
    customerprofileEnum.map(item => ({
      text: item.label,
      value: item.value
    })), [customerprofileEnum]
  );

  const sourceFilters = useMemo(() => 
    sourceEnum.map(item => ({
      text: item.label,
      value: item.value
    })), [sourceEnum]
  );

  const userratingFilters = useMemo(() => 
    userratingEnum.map(item => ({
      text: item.label,
      value: item.value
    })), [userratingEnum]
  );

  const scheduledcommunityFilters = useMemo(() => 
    communityEnum.map(item => ({
      text: item.label,
      value: item.value
    })), [communityEnum]
  );

  // 动态字段状态管理
  const [dynamicFilters, setDynamicFilters] = useState<{
    leadid: any[];
    phone: any[];
    wechat: any[];
    interviewsalesUser: any[];
    remark: any[];
    worklocation: any[];
    userbudget: any[];
    followupresult: any[];
    majorcategory: any[];
    leadtype: any[];
  }>({
    leadid: [],
    phone: [],
    wechat: [],
    interviewsalesUser: [],
    remark: [],
    worklocation: [],
    userbudget: [],
    followupresult: [],
    majorcategory: [],
    leadtype: []
  });

  // 动态字段的筛选选项获取（带缓存）
  const getDynamicFilters = useCallback(async (fieldName: string) => {
    const cacheKey = `dynamic_filters_${fieldName}`;
    const cacheTimestamp = localStorage.getItem(`${cacheKey}_timestamp`);
    
    // 缓存5分钟有效
    if (cacheTimestamp && Date.now() - parseInt(cacheTimestamp) < 5 * 60 * 1000) {
      const cached = localStorage.getItem(cacheKey);
      if (cached) {
        return JSON.parse(cached);
      }
    }

    const options = await fetchDynamicFilterOptions(fieldName);
    
    // 更新缓存
    localStorage.setItem(cacheKey, JSON.stringify(options));
    localStorage.setItem(`${cacheKey}_timestamp`, Date.now().toString());
    
    return options;
  }, []); // 移除tableFilters依赖，避免无限循环

  // 初始化动态筛选选项
  useEffect(() => {
    const initializeDynamicFilters = async () => {
      console.log('[动态筛选] 开始初始化动态筛选选项');
      
      const [
        remarkOptions,
        worklocationOptions,
        userbudgetOptions,
        followupresultOptions,
        majorcategoryOptions,
        leadtypeOptions
      ] = await Promise.all([
        getDynamicFilters('remark'),
        getDynamicFilters('worklocation'),
        getDynamicFilters('userbudget'),
        getDynamicFilters('followupresult'),
        getDynamicFilters('majorcategory'),
        getDynamicFilters('leadtype')
      ]);

      console.log('[动态筛选] 获取到的选项:', {
        remark: remarkOptions.length,
        worklocation: worklocationOptions.length,
        userbudget: userbudgetOptions.length,
        followupresult: followupresultOptions.length,
        majorcategory: majorcategoryOptions.length,
        leadtype: leadtypeOptions.length
      });

      setDynamicFilters({
        leadid: [],
        phone: [],
        wechat: [],
        interviewsalesUser: [],
        remark: remarkOptions,
        worklocation: worklocationOptions,
        userbudget: userbudgetOptions,
        followupresult: followupresultOptions,
        majorcategory: majorcategoryOptions,
        leadtype: leadtypeOptions
      });
    };

    initializeDynamicFilters();
  }, [getDynamicFilters]);

  // 动态字段使用后端数据
  const remarkFilters = useMemo(() => dynamicFilters.remark, [dynamicFilters.remark]);
  const worklocationFilters = useMemo(() => dynamicFilters.worklocation, [dynamicFilters.worklocation]);
  const userbudgetFilters = useMemo(() => dynamicFilters.userbudget, [dynamicFilters.userbudget]);
  const followupresultFilters = useMemo(() => {
    console.log('[跟进备注筛选] 当前筛选选项:', dynamicFilters.followupresult);
    return dynamicFilters.followupresult;
  }, [dynamicFilters.followupresult]);
  const majorcategoryFilters = useMemo(() => {
    console.log('[跟进结果筛选] 当前筛选选项:', dynamicFilters.majorcategory);
    return dynamicFilters.majorcategory;
  }, [dynamicFilters.majorcategory]);
  const leadtypeFilters = useMemo(() => dynamicFilters.leadtype, [dynamicFilters.leadtype]);

  // 管家列表状态
  const [interviewsalesUserList, setInterviewsalesUserList] = useState<Array<{id: number, name: string}>>([]);
  const [interviewsalesUserLoading, setInterviewsalesUserLoading] = useState(false);

  const columns = useMemo(() => [
    {
      title: '线索编号',
      dataIndex: 'leadid',
      key: 'leadid',
      fixed: 'left' as const,
      ellipsis: true,
      filterDropdown: ({ setSelectedKeys, selectedKeys, confirm, clearFilters }: FilterDropdownProps) => (
        <div style={{ padding: 8 }}>
          <Input.Search
            placeholder="输入线索编号关键词"
            value={selectedKeys[0] || ''}
            onChange={e => setSelectedKeys(e.target.value ? [e.target.value] : [])}
            onSearch={value => {
              setSelectedKeys(value ? [value] : []);
              confirm();
            }}
            style={{ width: 200, marginBottom: 8 }}
          />
          <div style={{ textAlign: 'right' }}>
            <Button type="primary" size="small" onClick={() => confirm()} style={{ marginRight: 8 }}>
              筛选
            </Button>
            <Button size="small" onClick={() => { 
              setSelectedKeys([]); // 清空当前选中的值
              clearFilters && clearFilters(); 
              resetFilter('leadid');
              confirm && confirm(); 
            }}>
              重置
            </Button>
          </div>
        </div>
      ),
      onCell: () => ({ style: { ...defaultCellStyle, minWidth: 120, maxWidth: 180 } }),
      filteredValue: tableColumnFilters.leadid ?? null,
      render: (text: string, record: any) => {
        return text ? (
          <span style={{ display: 'inline-flex', alignItems: 'center' }}>
            <Button
              type="link"
              size="small"
              style={{ padding: 0, height: 'auto', fontSize: 15, color: '#1677ff', fontWeight: 'normal', display: 'inline-block', whiteSpace: 'nowrap' }}
              onClick={() => {
                setLeadDetailId(record.leadid);
                setLeadDetailDrawerOpen(true);
              }}
            >
              {text}
            </Button>
            <Typography.Paragraph
              copyable={{ text, tooltips: false, icon: <CopyOutlined style={{ color: '#1677ff' }} /> }}
              style={{ margin: 0, marginLeft: 4, display: 'inline-block', whiteSpace: 'nowrap' }}
            />
          </span>
        ) : <span style={{ color: '#bbb' }}>-</span>;
      }
    },
    {
      title: '跟进阶段',
      dataIndex: 'followupstage',
      key: 'followupstage',
      fixed: 'left' as const,
      ellipsis: true,
      filters: followupstageFilters,
      onCell: () => ({
        style: {
          ...defaultCellStyle,
          minWidth: 100
        }
      }),
      filteredValue: tableColumnFilters.followupstage ?? null,
      render: (text: string, record: any) => {
        const item = followupstageEnum.find(i => i.value === text);
        const stageColorMap: Record<string, string> = {
          '丢单': '#ff4d4f', '待接收': '#bfbfbf', '确认需求': '#1677ff', '邀约到店': '#fa8c16', '已到店': '#52c41a', '赢单': '#faad14',
        };
        const color = stageColorMap[item?.label || text] || '#1677ff';
        return (
          <Button
            type="primary"
            size="small"
            style={{
              background: color,
              borderColor: color,
              color: '#fff',
              boxShadow: 'none',
              minWidth: 60,
              display: 'inline-block',
              textAlign: 'center',
              padding: '0 8px',
              zIndex: 2
            }}
            onClick={() => {
              if (isFieldDisabled()) return;
              const isPending = (typeof item === 'object' ? item.label : item) === '待接收' || (typeof text === 'string' && text === '待接收');
              if (isPending) {
                followupstageEnum.forEach((enumItem) => {
                  if (typeof enumItem === 'object') {
                  } else {
                  }
                });
                // 兼容字符串和对象两种情况
                const confirmStageItem = followupstageEnum.find(i =>
                  (typeof i === 'string' && String(i).replace(/\s/g, '') === '确认需求') ||
                  (typeof i === 'object' && ((i.label && String(i.label).replace(/\s/g, '') === '确认需求') || (i.value && String(i.value).replace(/\s/g, '') === '确认需求')))
                );
                const nextStage = typeof confirmStageItem === 'string' ? confirmStageItem : confirmStageItem?.value;
                if (!nextStage) {
                  message.error('系统错误：未找到确认需求阶段配置');
                  return;
                }
                (async () => {
                  try {
                    // 乐观更新：先更新本地数据
                    updateLocalData(record.id, 'followupstage', nextStage);
                    
                    const { error } = await supabase
                      .from('followups')
                      .update({ followupstage: nextStage })
                      .eq('id', record.id)
                      .select();
                    if (error) {
                      // 保存失败，回滚本地数据
                      updateLocalData(record.id, 'followupstage', record.followupstage);
                      message.error('更新失败: ' + error.message);
                    } else {
                      message.success('已接收，阶段已推进到"确认需求"');
                    }
                  } catch (error) {
                    // 异常处理，回滚本地数据
                    updateLocalData(record.id, 'followupstage', record.followupstage);
                    message.error('操作失败: ' + (error as Error).message);
                  }
                })();
              } else {
                setCurrentRecord(record);
                setDrawerOpen(true);
                setCurrentStage(record.followupstage);
                setCurrentStep(followupStages.indexOf(record.followupstage));
                stageForm.setFieldsValue(convertDateFields(record));
                if (record.followupstage === '已到店' || record.followupstage === '赢单') {
                  checkDealsRecord(record.leadid);
                  fetchDealsList(record.leadid);
                }
              }
            }}
          >{item?.label || text}</Button>
        );
      }
    },
    {
      title: '手机号',
      dataIndex: 'phone',
      key: 'phone',
      ellipsis: true,
      filterDropdown: ({ setSelectedKeys, selectedKeys, confirm, clearFilters }: FilterDropdownProps) => (
        <div style={{ padding: 8 }}>
          <Input.Search
            placeholder="输入手机号关键词"
            value={selectedKeys[0] || ''}
            onChange={e => setSelectedKeys(e.target.value ? [e.target.value] : [])}
            onSearch={value => {
              setSelectedKeys(value ? [value] : []);
              confirm();
            }}
            style={{ width: 200, marginBottom: 8 }}
          />
          <div style={{ textAlign: 'right' }}>
            <Button type="primary" size="small" onClick={() => confirm()} style={{ marginRight: 8 }}>
              筛选
            </Button>
            <Button size="small" onClick={() => { 
              setSelectedKeys([]); // 清空当前选中的值
              clearFilters && clearFilters(); 
              resetFilter('phone');
              confirm && confirm(); 
            }}>
              重置
            </Button>
          </div>
        </div>
      ),
      onCell: () => ({ style: { ...defaultCellStyle } }),
      filteredValue: tableColumnFilters.phone ?? null,
      render: (text: string) => {
        if (!text) return <span style={{ color: '#bbb' }}>-</span>;
        
        const maskedText = maskPhone(text);
        
        return (
          <Tooltip title={text}>
            <Paragraph copyable={{ text, tooltips: false, icon: <CopyOutlined style={{ color: '#1677ff' }} /> }} style={{ margin: 0, display: 'inline-block', whiteSpace: 'nowrap' }}>{maskedText}</Paragraph>
          </Tooltip>
        );
      }
    },
    {
      title: '微信号',
      dataIndex: 'wechat',
      key: 'wechat',
      ellipsis: true,
      filterDropdown: ({ setSelectedKeys, selectedKeys, confirm, clearFilters }: FilterDropdownProps) => (
        <div style={{ padding: 8 }}>
          <Input.Search
            placeholder="输入微信号关键词"
            value={selectedKeys[0] || ''}
            onChange={e => setSelectedKeys(e.target.value ? [e.target.value] : [])}
            onSearch={value => {
              setSelectedKeys(value ? [value] : []);
              confirm();
            }}
            style={{ width: 200, marginBottom: 8 }}
          />
          <div style={{ textAlign: 'right' }}>
            <Button type="primary" size="small" onClick={() => confirm()} style={{ marginRight: 8 }}>
              筛选
            </Button>
            <Button size="small" onClick={() => { 
              setSelectedKeys([]); // 清空当前选中的值
              clearFilters && clearFilters(); 
              resetFilter('wechat');
              confirm && confirm(); 
            }}>
              重置
            </Button>
          </div>
        </div>
      ),
      onCell: () => ({ style: { ...defaultCellStyle } }),
      filteredValue: tableColumnFilters.wechat ?? null,
      render: (text: string) => {
        if (!text) return <span style={{ color: '#bbb' }}>-</span>;
        
        const maskedText = maskWechat(text);
        
        return (
          <Tooltip title={text}>
            <Paragraph copyable={{ text, tooltips: false, icon: <CopyOutlined style={{ color: '#1677ff' }} /> }} style={{ margin: 0, display: 'inline-block', whiteSpace: 'nowrap' }}>{maskedText}</Paragraph>
          </Tooltip>
        );
      }
    },
    {
      title: '创建日期',
      dataIndex: 'created_at',
      key: 'created_at',
      ellipsis: true,
      filterDropdown: ({ setSelectedKeys, selectedKeys, confirm, clearFilters }: FilterDropdownProps) => (
        <div style={{ padding: 8 }}>
          <RangePicker
            locale={locale}
            value={selectedKeys.length === 2 ? [dayjs(String(selectedKeys[0])), dayjs(String(selectedKeys[1]))] : undefined}
            onChange={(dates, dateStrings) => {
              if (dates) {
                setSelectedKeys(dateStrings.filter(Boolean));
              } else {
                setSelectedKeys([]);
              }
            }}
            style={{ width: 240 }}
            format="YYYY-MM-DD"
          />
          <div style={{ marginTop: 8, textAlign: 'right' }}>
            <Button type="primary" size="small" onClick={() => confirm()} style={{ marginRight: 8 }}>
              筛选
            </Button>
            <Button size="small" onClick={() => { 
              setSelectedKeys([]); // 清空当前选中的值
              clearFilters && clearFilters(); 
              resetFilter('created_at');
              confirm && confirm(); 
            }}>
              重置
            </Button>
          </div>
        </div>
      ),
      onCell: () => ({ style: { ...defaultCellStyle } }),
      filteredValue: tableColumnFilters.created_at ?? null,
      render: (text: string) => {
        const full = text ? new Date(text).toLocaleString('zh-CN') : '';
        return (
          <Tooltip title={full} placement="topLeft">
            <div style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', cursor: 'pointer' }}>{full}</div>
          </Tooltip>
        );
      },
      sorter: (a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
    },
    {
      title: '渠道',
      dataIndex: 'source',
      key: 'source',
      width: 80,
      ellipsis: true,
      filters: sourceFilters,
      filterMultiple: true,
      onCell: () => ({ style: { ...defaultCellStyle, minWidth: 60, maxWidth: 100 } }),
      filteredValue: tableColumnFilters.source ?? null,
      render: (text: string) => {
        const item = sourceEnum.find(i => i.value === text);
        return <Tag color="blue">{item?.label || text}</Tag>;
      }
    },
    {
      title: '线索来源',
      dataIndex: 'leadtype',
      key: 'leadtype',
      ellipsis: true,
      filters: leadtypeFilters,
      onCell: () => ({ style: { ...defaultCellStyle } }),
      filteredValue: tableColumnFilters.leadtype ?? null,
    },
    {
      title: '约访管家',
      dataIndex: 'interviewsales_user_id',
      key: 'interviewsales_user_id',
      ellipsis: true,
      filterDropdown: ({ setSelectedKeys, selectedKeys, confirm, clearFilters }: FilterDropdownProps) => {
        // 使用从后端获取的管家列表
        const userList = interviewsalesUserList.length > 0 ? interviewsalesUserList : localData
          .filter(item => item.interviewsales_user_id && item.interviewsales_user_name)
          .map(item => ({
            id: item.interviewsales_user_id,
            name: item.interviewsales_user_name || item.interviewsales_user
          }))
          .filter((item, index, arr) => 
            arr.findIndex(i => i.id === item.id) === index
          )
          .sort((a, b) => a.name.localeCompare(b.name));

        console.log('[约访管家筛选] 可用管家列表:', userList);

        const [searchText, setSearchText] = useState('');
        const filteredUsers = useMemo(() => {
          const filtered = userList.filter(user => 
            user.name.toLowerCase().includes(searchText.toLowerCase())
          );
          console.log('[约访管家筛选] 搜索关键词:', searchText, '筛选结果:', filtered);
          return filtered;
        }, [userList, searchText]);

        return (
          <div style={{ padding: 8 }}>
            {interviewsalesUserLoading && (
              <div style={{ textAlign: 'center', padding: '8px 0', color: '#999' }}>
                <Spin size="small" /> 加载中...
              </div>
            )}
            <Input.Search
              placeholder="搜索管家姓名"
              value={searchText}
              onChange={e => setSearchText(e.target.value)}
              style={{ width: 200, marginBottom: 8 }}
            />
            <div style={{ maxHeight: 200, overflowY: 'auto' }}>
              {filteredUsers.map((user) => (
                <div
                  key={user.id}
                  style={{
                    padding: '4px 8px',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    backgroundColor: selectedKeys.includes(user.id) ? '#e6f7ff' : undefined
                  }}
                  onClick={() => {
                    const newKeys = selectedKeys.includes(user.id)
                      ? selectedKeys.filter((key: any) => key !== user.id)
                      : [...selectedKeys, user.id];
                    console.log('[约访管家筛选] 用户选择变化:', {
                      user: { id: user.id, name: user.name },
                      action: selectedKeys.includes(user.id) ? '取消选择' : '选择',
                      newKeys
                    });
                    setSelectedKeys(newKeys);
                  }}
                >
                  <Checkbox
                    checked={selectedKeys.includes(user.id)}
                    style={{ marginRight: 8 }}
                    tabIndex={-1}
                    onChange={() => {}}
                  />
                  <span>{user.name}</span>
                </div>
              ))}
            </div>
            <div style={{ textAlign: 'right' }}>
              <Button type="primary" size="small" onClick={() => {
                confirm();
              }} style={{ marginRight: 8 }}>
                筛选
              </Button>
              <Button size="small" onClick={() => { 
                setSelectedKeys([]); // 清空当前选中的值
                clearFilters && clearFilters(); 
                resetFilter('interviewsales_user_id');
                confirm && confirm(); 
              }}>
                重置
              </Button>
            </div>
          </div>
        );
      },
      filteredValue: tableColumnFilters.interviewsales_user_id ?? null,
      onCell: () => ({ style: { ...defaultCellStyle } }),
      render: (_: any, record: any) => (
        <span style={{ display: 'inline-flex', alignItems: 'center' }}>
          <UserOutlined style={{ color: '#bfbfbf', marginRight: 6, fontSize: 18}} />
          {record.interviewsales_user_name || record.interviewsales_user || '-'}
        </span>
      ),
    },
    {
      title: '客服备注',
      dataIndex: 'remark',
      key: 'remark',
      ellipsis: true,
      filters: remarkFilters,
      filterSearch: true,
      onCell: () => ({ style: { ...defaultCellStyle } }),
      filteredValue: tableColumnFilters.remark ?? null,
      render: (text: string) => text ? <Tooltip title={text}><span>{text}</span></Tooltip> : '-'
    },
    {
      title: '用户画像',
      dataIndex: 'customerprofile',
      key: 'customerprofile',
      filters: customerprofileFilters,
      onCell: () => ({ style: { ...defaultCellStyle } }),
      filteredValue: tableColumnFilters.customerprofile ?? null,
      render: (text: string, record: any) => (
        <Select 
          value={text} 
          options={customerprofileEnum} 
          style={{ width: '100%', minWidth: 100 }} 
          onChange={val => handleAnyFieldSave(record, 'customerprofile', val)} 
          disabled={isFieldDisabled()}
          key={forceUpdate}
        />
      )
    },
    {
      title: '工作地点',
      dataIndex: 'worklocation',
      key: 'worklocation',
      ellipsis: true,
      width: 200, // 增加列宽以适应多级选择
      filterDropdown: ({ setSelectedKeys, selectedKeys, confirm, clearFilters }: FilterDropdownProps) => {
        // 处理多级选项，将线路转换为具体站点
        const processSelectedKeys = (keys: any[]) => {
          const processedKeys: string[] = [];
          
          keys.forEach(key => {
            if (typeof key === 'string') {
              if (key.includes('号线')) {
                // 如果是线路，找到该线路下的所有站点
                const line = metroStationOptions.find(line => line.value === key);
                if (line && line.children) {
                  line.children.forEach((station: any) => {
                    processedKeys.push(station.value);
                  });
                }
              } else {
                // 如果是具体站点，直接添加
                processedKeys.push(key);
              }
            }
          });
          
          return processedKeys;
        };

        return (
          <div className="custom-filter-card">
            <div className="filter-section">
              <div className="filter-label">按线路筛选：</div>
              <Select
                mode="multiple"
                placeholder="选择地铁线路"
                value={selectedKeys.filter((key: any) => typeof key === 'string' && key.includes('号线'))}
                onChange={(values) => {
                  const stationKeys = selectedKeys.filter((key: any) => typeof key === 'string' && !key.includes('号线'));
                  setSelectedKeys([...stationKeys, ...values]);
                }}
                options={metroStationOptions.map(line => ({
                  label: line.label,
                  value: line.value
                }))}
                allowClear
                maxTagCount={2}
                maxTagTextLength={8}
                maxTagPlaceholder={(omittedValues) => `+${omittedValues.length}`}
                className="filter-select"
                dropdownStyle={{
                  maxHeight: 200,
                  overflow: 'auto'
                }}
              />
            </div>
            <div className="filter-section">
              <div className="filter-label">按站点筛选：</div>
              <Select
                mode="multiple"
                placeholder="选择具体站点"
                value={selectedKeys.filter((key: any) => typeof key === 'string' && !key.includes('号线'))}
                onChange={(values) => {
                  const lineKeys = selectedKeys.filter((key: any) => typeof key === 'string' && key.includes('号线'));
                  setSelectedKeys([...lineKeys, ...values]);
                }}
                options={metroStationOptions.flatMap(line => 
                  line.children ? line.children.map((station: any) => ({
                    label: `${line.label} - ${station.label}`,
                    value: station.value,
                    title: `${line.label} - ${station.label}` // 添加title用于tooltip
                  })) : []
                )}
                allowClear
                showSearch
                maxTagCount={2}
                maxTagTextLength={10}
                maxTagPlaceholder={(omittedValues) => `+${omittedValues.length}`}
                filterOption={(input, option) =>
                  (option?.label ?? '').toLowerCase().includes(input.toLowerCase())
                }
                className="filter-select"
                dropdownStyle={{
                  maxHeight: 200,
                  overflow: 'auto'
                }}
                optionLabelProp="title"
              />
            </div>
            <div className="filter-actions">
              <Button 
                className="filter-reset-btn"
                size="small" 
                onClick={() => { 
                  setSelectedKeys([]); // 清空当前选中的值
                  clearFilters && clearFilters(); 
                  resetFilter('worklocation');
                  confirm && confirm(); 
                }}
              >
                重置
              </Button>
              <Button 
                type="primary" 
                size="small" 
                className="filter-confirm-btn"
                onClick={() => {
                  // 在确认时处理多级选项
                  const processedKeys = processSelectedKeys(selectedKeys);
                  setSelectedKeys(processedKeys);
                  confirm();
                }}
              >
                筛选
              </Button>
            </div>
          </div>
        );
      },
      onCell: () => ({ style: { ...defaultCellStyle, minWidth: 180, maxWidth: 220 } }),
      filteredValue: tableColumnFilters.worklocation ?? null,
      render: (text: string, record: any) => (
        <Tooltip title={text || '未设置工作地点'}>
          <Cascader
            options={metroStationOptions}
            value={findCascaderPath(metroStationOptions, text)}
            onChange={async (_value, selectedOptions) => {
              const selectedText = selectedOptions && selectedOptions.length > 1 ? selectedOptions[1].label : '';
              if (selectedText !== text) {
                await handleAnyFieldSave(record, 'worklocation', selectedText);
              }
            }}
            placeholder="请选择工作地点"
            style={{ minWidth: 180, maxWidth: 220, width: '100%' }}
            showSearch
            changeOnSelect={false}
            allowClear
            disabled={isFieldDisabled()}
            key={forceUpdate}
          />
        </Tooltip>
      )
    },
    {
      title: '用户预算',
      dataIndex: 'userbudget',
      key: 'userbudget',
      ellipsis: true,
      filterDropdown: ({ setSelectedKeys, selectedKeys, confirm, clearFilters }: FilterDropdownProps) => (
        <div style={{ padding: 8 }}>
          <div style={{ marginBottom: 8 }}>
            <div style={{ marginBottom: 4 }}>预算范围筛选：</div>
            <InputNumber
              placeholder="最小预算"
              style={{ width: 100, marginRight: 8 }}
              value={selectedKeys.length >= 1 && typeof selectedKeys[0] === 'number' ? selectedKeys[0] : undefined}
              onChange={(value) => {
                const newKeys = [...selectedKeys];
                newKeys[0] = value as any;
                setSelectedKeys(newKeys);
              }}
            />
            <InputNumber
              placeholder="最大预算"
              style={{ width: 100 }}
              value={selectedKeys.length >= 2 && typeof selectedKeys[1] === 'number' ? selectedKeys[1] : undefined}
              onChange={(value) => {
                const newKeys = [...selectedKeys];
                newKeys[1] = value as any;
                setSelectedKeys(newKeys);
              }}
            />
          </div>
          <div style={{ marginBottom: 8 }}>
            <div style={{ marginBottom: 4 }}>预算选项筛选：</div>
            <Select
              mode="multiple"
              placeholder="选择预算选项"
              style={{ width: '100%' }}
              value={selectedKeys.filter((key: any) => typeof key === 'string')}
              onChange={(values) => {
                const rangeKeys = selectedKeys.filter((key: any) => typeof key === 'number');
                setSelectedKeys([...rangeKeys, ...values]);
              }}
              options={userbudgetFilters}
              allowClear
            />
          </div>
          <div style={{ textAlign: 'right' }}>
            <Button type="primary" size="small" onClick={() => confirm()} style={{ marginRight: 8 }}>
              筛选
            </Button>
            <Button size="small" onClick={() => { 
              setSelectedKeys([]); // 清空当前选中的值
              clearFilters && clearFilters(); 
              resetFilter('userbudget');
              confirm && confirm(); 
            }}>
              重置
            </Button>
          </div>
        </div>
      ),
      onCell: () => ({ style: { ...defaultCellStyle } }),
      filteredValue: tableColumnFilters.userbudget ?? null,
      render: renderUserbudget
    },
    {
      title: '入住日期',
      dataIndex: 'moveintime',
      key: 'moveintime',
      ellipsis: true,
      filterDropdown: ({ setSelectedKeys, selectedKeys, confirm, clearFilters }: FilterDropdownProps) => (
        <div style={{ padding: 8 }}>
          <RangePicker
            locale={locale}
            value={selectedKeys.length === 2 ? [dayjs(String(selectedKeys[0])), dayjs(String(selectedKeys[1]))] : undefined}
            onChange={(dates, dateStrings) => {
              if (dates) {
                setSelectedKeys(dateStrings.filter(Boolean));
              } else {
                setSelectedKeys([]);
              }
            }}
            style={{ width: 240 }}
            format="YYYY-MM-DD"
          />
          <div style={{ marginTop: 8, textAlign: 'right' }}>
            <Button type="primary" size="small" onClick={() => confirm()} style={{ marginRight: 8 }}>
              筛选
            </Button>
            <Button size="small" onClick={() => { 
              setSelectedKeys([]); // 清空当前选中的值
              clearFilters && clearFilters(); 
              resetFilter('moveintime');
              confirm && confirm(); 
            }}>
              重置
            </Button>
          </div>
        </div>
      ),
      onCell: () => ({ style: { ...defaultCellStyle } }),
      filteredValue: tableColumnFilters.moveintime ?? null,
      render: (text: string, record: any) => {
        return (
        <DatePicker
          locale={locale}
          style={{ minWidth: 120, maxWidth: 180 }}
          placeholder="请选择入住日期"
            value={text ? dayjs(text) : undefined}
          format="YYYY-MM-DD"
          onChange={async v => {
              if (v) {
                const val = v.format('YYYY-MM-DD') + ' 00:00:00';
                await handleAnyFieldSave(record, 'moveintime', val);
              }
          }}
          disabled={isFieldDisabled()}
          key={forceUpdate}
        />
        );
      }
    },
    {
      title: '来访意向',
      dataIndex: 'userrating',
      key: 'userrating',
      ellipsis: true,
      filters: userratingFilters,
      onCell: () => ({ style: { ...defaultCellStyle } }),
      filteredValue: tableColumnFilters.userrating ?? null,
      render: (text: string, record: any) => (
        <Select
          value={text}
          options={userratingEnum}
          style={{ minWidth: 100, maxWidth: 140 }}
          onChange={val => handleAnyFieldSave(record, 'userrating', val)}
          disabled={isFieldDisabled()}
          key={forceUpdate}
        />
      )
    },
    {
      title: '跟进结果',
      dataIndex: 'majorcategory',
      key: 'majorcategory',
      width: 220,
      filterDropdown: ({ setSelectedKeys, selectedKeys, confirm, clearFilters }: FilterDropdownProps) => {
        // 处理多级选项，将一级分类转换为分类值，具体结果转换为对应的分类值
        const processSelectedKeys = (keys: any[]) => {
          const processedKeys: string[] = [];
          
          keys.forEach(key => {
            if (typeof key === 'string') {
              // 检查是否是一级分类（包含子选项的分类）
              const category = majorCategoryOptions.find(cat => cat.value === key);
              if (category && category.children && category.children.length > 0) {
                // 如果是一级分类，直接添加分类值
                processedKeys.push(category.value);
              } else {
                // 如果是具体结果，找到对应的分类值
                const parentCategory = majorCategoryOptions.find(cat => 
                  cat.children && cat.children.some((child: any) => child.value === key)
                );
                if (parentCategory) {
                  processedKeys.push(parentCategory.value);
                } else {
                  // 如果找不到父分类，直接添加原值
                  processedKeys.push(key);
                }
              }
            }
          });
          
          return processedKeys;
        };

        return (
          <div className="custom-filter-card">
            <div className="filter-section">
              <div className="filter-label">按分类筛选：</div>
              <Select
                mode="multiple"
                placeholder="选择跟进分类"
                value={selectedKeys.filter((key: any) => {
                  const category = majorCategoryOptions.find(cat => cat.value === key);
                  return category && category.children && category.children.length > 0;
                })}
                onChange={(values) => {
                  const resultKeys = selectedKeys.filter((key: any) => {
                    const category = majorCategoryOptions.find(cat => cat.value === key);
                    return !category || !category.children || category.children.length === 0;
                  });
                  setSelectedKeys([...resultKeys, ...values]);
                }}
                options={majorCategoryOptions.filter(cat => cat.children && cat.children.length > 0).map(category => ({
                  label: category.label,
                  value: category.value
                }))}
                allowClear
                maxTagCount={2}
                maxTagTextLength={8}
                maxTagPlaceholder={(omittedValues) => `+${omittedValues.length}`}
                className="filter-select"
                dropdownStyle={{
                  maxHeight: 200,
                  overflow: 'auto'
                }}
              />
            </div>
            <div className="filter-section">
              <div className="filter-label">按具体结果筛选：</div>
              <Select
                mode="multiple"
                placeholder="选择具体跟进结果"
                value={selectedKeys.filter((key: any) => {
                  const category = majorCategoryOptions.find(cat => cat.value === key);
                  return !category || !category.children || category.children.length === 0;
                })}
                onChange={(values) => {
                  const categoryKeys = selectedKeys.filter((key: any) => {
                    const category = majorCategoryOptions.find(cat => cat.value === key);
                    return category && category.children && category.children.length > 0;
                  });
                  setSelectedKeys([...categoryKeys, ...values]);
                }}
                options={majorCategoryOptions.flatMap(category => 
                  category.children ? category.children.map((child: any) => ({
                    label: `${category.label} - ${child.label}`,
                    value: child.value,
                    title: `${category.label} - ${child.label}` // 添加title用于tooltip
                  })) : []
                )}
                allowClear
                showSearch
                maxTagCount={2}
                maxTagTextLength={10}
                maxTagPlaceholder={(omittedValues) => `+${omittedValues.length}`}
                filterOption={(input, option) =>
                  (option?.label ?? '').toLowerCase().includes(input.toLowerCase())
                }
                className="filter-select"
                dropdownStyle={{
                  maxHeight: 200,
                  overflow: 'auto'
                }}
                optionLabelProp="title"
              />
            </div>
            <div className="filter-actions">
              <Button 
                className="filter-reset-btn"
                size="small" 
                onClick={() => { 
                  setSelectedKeys([]); // 清空当前选中的值
                  clearFilters && clearFilters(); 
                  resetFilter('majorcategory');
                  confirm && confirm(); 
                }}
              >
                重置
              </Button>
              <Button 
                type="primary" 
                size="small" 
                className="filter-confirm-btn"
                onClick={() => {
                  // 在确认时处理多级选项
                  const processedKeys = processSelectedKeys(selectedKeys);
                  setSelectedKeys(processedKeys);
                  confirm();
                }}
              >
                筛选
              </Button>
            </div>
          </div>
        );
      },
      onCell: () => ({ style: { ...defaultCellStyle, minWidth: 180, maxWidth: 260 } }),
      filteredValue: tableColumnFilters.majorcategory ?? null,
      render: (text: string, record: any) => (
        <Cascader
          options={majorCategoryOptions}
          value={findCascaderPath(majorCategoryOptions, text)}
          onChange={async (_value, selectedOptions) => {
            const selectedText = selectedOptions && selectedOptions.length > 1 ? selectedOptions[1].label : '';
            if (selectedText !== text) {
              await handleAnyFieldSave(record, 'majorcategory', selectedText);
            }
          }}
          placeholder="请选择跟进结果"
          style={{ minWidth: 180, maxWidth: 260 }}
          showSearch
          changeOnSelect={false}
          allowClear
          disabled={isFieldDisabled()}
          key={forceUpdate}
        />
      )
    },
    {
      title: '跟进备注',
      dataIndex: 'followupresult',
      key: 'followupresult',
      ellipsis: true,
      filters: followupresultFilters,
      filterSearch: true,
      onCell: () => ({ style: { ...defaultCellStyle } }),
      filteredValue: tableColumnFilters.followupresult ?? null,
      render: renderFollowupresult
    },
    {
      title: '预约社区',
      dataIndex: 'scheduledcommunity',
      key: 'scheduledcommunity',
      ellipsis: true,
      filters: scheduledcommunityFilters,
      onCell: () => ({ style: { ...defaultCellStyle } }),
      filteredValue: tableColumnFilters.scheduledcommunity ?? null,
      render: (text: string, record: any) => (
        <Tooltip title={text}>
          <Select 
            value={text} 
            options={communityEnum} 
            style={{ minWidth: 120, maxWidth: 180 }} 
            onChange={val => handleAnyFieldSave(record, 'scheduledcommunity', val)} 
            disabled={isFieldDisabled()}
            key={forceUpdate}
          />
        </Tooltip>
      )
    },
  ], [followupstageFilters, sourceFilters, leadtypeFilters, remarkFilters, customerprofileFilters, worklocationFilters, userbudgetFilters, userratingFilters, followupresultFilters, majorcategoryFilters, scheduledcommunityFilters, communityEnum, followupstageEnum, customerprofileEnum, sourceEnum, userratingEnum, majorCategoryOptions, metroStationOptions, tableColumnFilters, forceUpdate]);

  const filterKeyMap: Record<string, string> = {
    leadid: 'p_leadid',
    leadtype: 'p_leadtype',
    interviewsales_user: 'p_interviewsales_user_id',
    followupstage: 'p_followupstage',
    customerprofile: 'p_customerprofile',
    worklocation: 'p_worklocation',
    userbudget: 'p_userbudget',
    userrating: 'p_userrating',
    majorcategory: 'p_majorcategory',
    subcategory: 'p_subcategory',
    followupresult: 'p_followupresult',
    scheduledcommunity: 'p_scheduledcommunity',
    wechat: 'p_wechat',
    phone: 'p_phone',
    source: 'p_source',
    remark: 'p_remark',
  };
  
  const multiSelectFields = [
    'leadid', 'leadtype', 'interviewsales_user', 'followupstage', 'customerprofile', 'worklocation', 'userbudget',
    'userrating', 'majorcategory', 'subcategory', 'followupresult', 'scheduledcommunity', 'wechat', 'phone', 'source'
  ];

  // Table onChange事件处理（支持分页+受控筛选）
  const handleTableChange = (_pagination: any, filters: any) => {
    
    if (_pagination.current !== pagination.current || _pagination.pageSize !== pagination.pageSize) {
      // 分页变化，保持当前筛选条件
      setPagination(prev => ({ ...prev, current: _pagination.current, pageSize: _pagination.pageSize }));
      fetchFollowups(tableFilters, _pagination.current, _pagination.pageSize);
      return;
    }
    
    const params: any = { ...tableFilters };
    
    Object.keys(filters).forEach(key => {
      
      if (key === 'interviewsales_user_id') {
        if (filters[key] && filters[key].length > 0) {
          const values = filters[key].map((v: any) => {
            if (v === null || v === 'null' || v === undefined || v === '') return null;
            const num = Number(v);
            return isNaN(num) ? null : num;
          });
          
          // 获取对应的管家姓名用于日志
          const selectedNames = values
            .filter((v: any) => v !== null)
            .map((id: any) => {
              const user = localData.find(item => item.interviewsales_user_id === id);
              return user ? (user.interviewsales_user_name || user.interviewsales_user) : `ID:${id}`;
            });
          
          // 如果只包含null，传递[null]表示IS NULL条件
          if (values.length === 1 && values[0] === null) {
            params[`p_${key}`] = [null];
          } else if (values.includes(null)) {
            // 如果包含null和其他值，传递所有值（后端会处理IS NULL和= ANY）
            params[`p_${key}`] = values;
          } else {
            // 只有非null值
            params[`p_${key}`] = values;
          }
        } else {
          delete params[`p_${key}`];
        }
        return;
      }

      // 枚举字段处理
      if (['followupstage', 'customerprofile', 'source', 'scheduledcommunity', 'userrating'].includes(key)) {
        if (filters[key] && filters[key].length > 0) {
          // 如果只包含null，传递[null]表示IS NULL条件
          if (filters[key].length === 1 && filters[key][0] === null) {
            params[`p_${key}`] = [null];
          } else if (filters[key].includes(null)) {
            // 如果包含null和其他值，传递所有值
            params[`p_${key}`] = filters[key].map((v: any) => v === null ? null : String(v));
          } else {
            // 只有非null值
            params[`p_${key}`] = filters[key].map((v: any) => String(v));
          }
        } else {
          delete params[`p_${key}`];
        }
        return;
      }

      // 手机号和微信号处理
      if (key === 'phone' || key === 'wechat') {
        if (filters[key] && Array.isArray(filters[key]) && filters[key].length > 0) {
          // 如果只包含null，传递[null]表示IS NULL条件
          if (filters[key].length === 1 && filters[key][0] === null) {
            params[`p_${key}`] = [null];
          } else if (filters[key].includes(null)) {
            // 如果包含null和其他值，传递所有值
            params[`p_${key}`] = filters[key].map((v: string | null) => 
              v === null ? null : String(v).trim()
            ).filter(v => v !== undefined);
          } else {
            // 只有非null值
            params[`p_${key}`] = filters[key].map((v: string | null) => String(v).trim());
          }
        } else {
          delete params[`p_${key}`];
        }
        return;
      }

      // 时间字段处理
      if (key === 'moveintime' || key === 'created_at') {
        const val = filters[key] as string[];
        if (val && val.length === 2) {
          params[`p_${key}_start`] = dayjs(val[0]).startOf('day').format('YYYY-MM-DD HH:mm:ss');
          params[`p_${key}_end`] = dayjs(val[1]).endOf('day').format('YYYY-MM-DD HH:mm:ss');
          params[key] = val;
        } else {
          delete params[`p_${key}_start`];
          delete params[`p_${key}_end`];
          delete params[key];
        }
        return;
      }

      // 预算范围字段处理
      if (key === 'userbudget') {
        const val = filters[key] as any;
        if (val && val.length > 0) {
          // 处理预算范围筛选
          if (val.length === 2 && typeof val[0] === 'number' && typeof val[1] === 'number') {
            // 范围筛选
            params['p_userbudget_min'] = val[0];
            params['p_userbudget_max'] = val[1];
            delete params['p_userbudget']; // 删除普通预算筛选
          } else {
            // 普通多选筛选
            if (val.length === 1 && val[0] === null) {
              params['p_userbudget'] = [null];
            } else if (val.includes(null)) {
              params['p_userbudget'] = val;
            } else {
              params['p_userbudget'] = val;
            }
            delete params['p_userbudget_min'];
            delete params['p_userbudget_max'];
          }
        } else {
          delete params['p_userbudget'];
          delete params['p_userbudget_min'];
          delete params['p_userbudget_max'];
        }
        return;
      }

      // 多选字段处理
      if (multiSelectFields.includes(key)) {
        const paramKey = filterKeyMap[key];
        if (!paramKey) return;
        
        // 跟进备注字段特殊处理
        if (key === 'followupresult') {
          console.log('[跟进备注筛选] 处理筛选参数:', {
            key,
            filters: filters[key],
            paramKey
          });
          
          if (filters[key] && filters[key].length > 0) {
            console.log('[跟进备注筛选] 筛选值:', filters[key]);
            
            // 如果只包含null，传递[null]表示IS NULL条件
            if (filters[key].length === 1 && filters[key][0] === null) {
              params[paramKey] = [null];
              console.log('[跟进备注筛选] 传递NULL条件');
            } else if (filters[key].includes(null)) {
              // 如果包含null和其他值，传递所有值
              params[paramKey] = filters[key];
              console.log('[跟进备注筛选] 传递混合条件:', filters[key]);
            } else {
              // 只有非null值
              params[paramKey] = filters[key];
              console.log('[跟进备注筛选] 传递筛选值:', filters[key]);
            }
          } else {
            delete params[paramKey];
            console.log('[跟进备注筛选] 清除筛选条件');
          }
          return;
        }
        
        // 跟进结果字段特殊处理
        if (key === 'majorcategory') {
          console.log('[跟进结果筛选] 处理筛选参数:', {
            key,
            filters: filters[key],
            paramKey
          });
          
          if (filters[key] && filters[key].length > 0) {
            console.log('[跟进结果筛选] 筛选值:', filters[key]);
            
            // 如果只包含null，传递[null]表示IS NULL条件
            if (filters[key].length === 1 && filters[key][0] === null) {
              params[paramKey] = [null];
              console.log('[跟进结果筛选] 传递NULL条件');
            } else if (filters[key].includes(null)) {
              // 如果包含null和其他值，传递所有值
              params[paramKey] = filters[key];
              console.log('[跟进结果筛选] 传递混合条件:', filters[key]);
            } else {
              // 只有非null值
              params[paramKey] = filters[key];
              console.log('[跟进结果筛选] 传递筛选值:', filters[key]);
            }
          } else {
            delete params[paramKey];
            console.log('[跟进结果筛选] 清除筛选条件');
          }
          return;
        }
        
        if (filters[key] && filters[key].length > 0) {
          // 如果只包含null，传递[null]表示IS NULL条件
          if (filters[key].length === 1 && filters[key][0] === null) {
            params[paramKey] = [null];
          } else if (filters[key].includes(null)) {
            // 如果包含null和其他值，传递所有值
            params[paramKey] = filters[key];
          } else {
            // 只有非null值
            params[paramKey] = filters[key];
          }
        } else {
          delete params[paramKey];
        }
        return;
      }

      // 普通字段处理
      const paramKey = filterKeyMap[key];
      if (!paramKey) return;
      
      if (filters[key] && filters[key].length > 0) {
        // 如果只包含null，传递[null]表示IS NULL条件
        if (filters[key].length === 1 && filters[key][0] === null) {
          params[paramKey] = [null];
        } else if (filters[key].includes(null)) {
          // 如果包含null和其他值，传递所有值
          params[paramKey] = key === 'remark' ? filters[key] : filters[key];
        } else {
          // 只有非null值
          params[paramKey] = key === 'remark' ? filters[key][0] : filters[key];
        }
      } else {
        delete params[paramKey]; 
      }
    });

    // 保证分组条件始终生效
    if (groupField && selectedGroup) {
      const filterKey = 'p_' + groupField;
      if (selectedGroup === 'null') {
        params[filterKey] = [null];
      } else {
        params[filterKey] = [selectedGroup];
      }
    }

    setTableFilters(params);
    setTableColumnFilters(filters);
    // 筛选条件变化时重置分页
    setShouldResetPagination(true);
    
    // 同时更新分组统计
    if (groupField) {
      fetchGroupCount(groupField);
    }
  };

  // 工具函数：将时间字段转为dayjs对象（支持null/undefined/空字符串）
  const convertDateFields = (record: any) => {
    const fields = ['moveintime', 'scheduletime'];
    const result = { ...record };
    fields.forEach(field => {
      const v = result[field];
      if (!v || v === '' || v === null) {
        result[field] = undefined;
      } else if (!dayjs.isDayjs(v)) {
        result[field] = dayjs(v);
      }
    });
    return result;
  };

  // 检查并获取deals记录
  const checkDealsRecord = async (leadid: string) => {
    try {
      const { data, error } = await supabase
        .from('deals')
        .select('*')
        .eq('leadid', leadid)
        .single();
      
      if (error && error.code !== 'PGRST116') { 
        return null;
      }
      
      if (data) {
        message.info('已加载现有签约信息');
        return data;
      }
      
      return null;
    } catch (error) {
      console.error('检查deals记录时出错:', error);
      return null;
    }
  };

  // 获取该线索的所有签约记录
  const fetchDealsList = async (leadid: string) => {
    setDealsLoading(true);
    try {
      const { data, error } = await supabase
        .from('deals')
        .select('*')
        .eq('leadid', leadid)
        .order('created_at', { ascending: false });
      
      if (error) {
        console.error('获取签约记录失败:', error);
        message.error('获取签约记录失败');
        setDealsList([]);
        return;
      }
      
      setDealsList(data || []);
    } catch (error) {
      console.error('获取签约记录时出错:', error);
      setDealsList([]);
    } finally {
      setDealsLoading(false);
    }
  };

  // 模糊搜索
  const handleGlobalSearch = (value: string) => {
    setKeywordSearch(value);
    const params = { ...tableFilters };
    
    if (value && value.trim()) {
      params.p_keyword = value.trim();
    } else {
      delete params.p_keyword;
    }
    
    setTableFilters(params);
    // 搜索条件变化时重置分页
    setShouldResetPagination(true);
    
    // 同时更新分组统计
    if (groupField) {
      fetchGroupCount(groupField);
    }
  };

  // 快捷日期筛选处理
  function handleQuickDate(key: string | null) {
    let start: string | null = null;
    let end: string | null = null;
    if (key === 'thisWeek') {
      start = dayjs().startOf('week').toISOString();
      end = dayjs().endOf('week').toISOString();
    } else if (key === 'lastWeek') {
      start = dayjs().subtract(1, 'week').startOf('week').toISOString();
      end = dayjs().subtract(1, 'week').endOf('week').toISOString();
    } else if (key === 'thisMonth') {
      start = dayjs().startOf('month').toISOString();
      end = dayjs().endOf('month').toISOString();
    } else if (key === 'lastMonth') {
      start = dayjs().subtract(1, 'month').startOf('month').toISOString();
      end = dayjs().subtract(1, 'month').endOf('month').toISOString();
    }
    setQuickDateKey(key);
    const newFilters = { ...tableFilters };
    if (start && end) {
      newFilters.p_created_at_start = start;
      newFilters.p_created_at_end = end;
    } else {
      delete newFilters.p_created_at_start;
      delete newFilters.p_created_at_end;
    }
    setTableFilters(newFilters);
    // 日期筛选条件变化时重置分页
    setShouldResetPagination(true);
    
    // 同时更新分组统计
    if (groupField) {
      fetchGroupCount(groupField);
    }
  }

  // 监听tableFilters变化，自动高亮快捷日期按钮
  useEffect(() => {
    if (groupField === 'created_at') {
      const start = tableFilters.p_created_at_start;
      const end = tableFilters.p_created_at_end;
      let matched: string | null = null;
      if (start && end) {
        if (
          dayjs(start).isSame(dayjs().startOf('week'), 'day') &&
          dayjs(end).isSame(dayjs().endOf('week'), 'day')
        ) {
          matched = 'thisWeek';
        } else if (
          dayjs(start).isSame(dayjs().subtract(1, 'week').startOf('week'), 'day') &&
          dayjs(end).isSame(dayjs().subtract(1, 'week').endOf('week'), 'day')
        ) {
          matched = 'lastWeek';
        } else if (
          dayjs(start).isSame(dayjs().startOf('month'), 'day') &&
          dayjs(end).isSame(dayjs().endOf('month'), 'day')
        ) {
          matched = 'thisMonth';
        } else if (
          dayjs(start).isSame(dayjs().subtract(1, 'month').startOf('month'), 'day') &&
          dayjs(end).isSame(dayjs().subtract(1, 'month').endOf('month'), 'day')
        ) {
          matched = 'lastMonth';
        }
      }
      setQuickDateKey(matched);
    } else {
      setQuickDateKey(null);
    }
  }, [groupField, tableFilters.p_created_at_start, tableFilters.p_created_at_end]);

  // 专门处理分组统计刷新：只在分组字段变化时刷新，不在分组点击时刷新
  useEffect(() => {
    if (groupField) {
      fetchGroupCount(groupField);
    }
  }, [groupField]);

  // 首次加载数据
  useEffect(() => {
    // 直接加载数据，移除不必要的权限检查
    fetchFollowups();
  }, []);

  // 加载majorcategory分级选项
  useEffect(() => {
    async function fetchMajorCategoryOptions() {
      // 读取Selection表id=1的selection字段
      const { data, error } = await supabase
        .from('Selection')
        .select('selection')
        .eq('id', 1)
        .single();
      if (!error && data && data.selection) {
        setMajorCategoryOptions(data.selection);
      }
    }
    fetchMajorCategoryOptions();
  }, []);

  // 加载地铁站数据
  useEffect(() => {
    async function fetchMetroStationOptions() {
      try {
        const metroData = await fetchMetroStations();
        
        // 按线路分组
        const lineGroups = metroData.reduce((acc, station) => {
          const line = station.line || '其他';
          if (!acc[line]) {
            acc[line] = [];
          }
          acc[line].push(station);
          return acc;
        }, {} as Record<string, typeof metroData>);

        // 构建Cascader选项结构，按线路数字顺序排列
        const options = Object.entries(lineGroups)
          .sort(([lineA], [lineB]) => {
            // 提取数字进行排序
            const getLineNumber = (line: string) => {
              const match = line.match(/^(\d+)号线$/);
              return match ? parseInt(match[1]) : 999999;
            };
            return getLineNumber(lineA) - getLineNumber(lineB);
          })
          .map(([line, stations]) => ({
            value: line,
            label: line,
            children: stations.map(station => ({
              value: station.name,
              label: station.name
            }))
          }));

        setMetroStationOptions(options);
      } catch (error) {
        console.error('加载地铁站数据失败:', error);
      }
    }
    fetchMetroStationOptions();
  }, []);

  // 辅助函数：根据二级value找到完整路径
  function findCascaderPath(options: any[], value: string): string[] {
    for (const opt of options) {
      if (opt.children) {
        const child = opt.children.find((c: any) => c.value === value);
        if (child) return [opt.value, child.value];
      }
    }
    return [];
  }

  // 优化的 localData 更新函数
  const updateLocalData = (id: string, field: keyof any, value: any) => {
    const currentData = localDataRef.current;
    const recordIndex = currentData.findIndex(item => item.id === id);
    
    if (recordIndex === -1) return;
    
    const record = currentData[recordIndex];
    
    if (record[field] === value) {
      return; // 值没有变化，不更新
    }
    
    // 创建新的数据
    const newData = [...currentData];
    newData[recordIndex] = { ...record, [field]: value };
    
    // 同时更新 ref、localData 和 data，确保所有状态同步
    localDataRef.current = newData;
    setLocalData(newData);
    
    // 同步更新主数据状态
    setData(prev => 
      prev.map(item => 
        item.id === id 
          ? { ...item, [field]: value }
          : item
      )
    );
  };

  // 批量更新函数（用于多个字段同时更新）

  // 频率控制相关状态
  const [isFrequencyLimited, setIsFrequencyLimited] = useState<boolean>(false);
  const [hasCheckedFrequency, setHasCheckedFrequency] = useState<boolean>(false);
  const [cooldown, setCooldown] = useState<{ until: number, secondsLeft: number, message: string } | null>(null);
  
  // 调试：监听 cooldown 状态变化
  useEffect(() => {
  }, [cooldown]);
  const cooldownTimer = useRef<NodeJS.Timeout | null>(null);

  // 页面加载后自动读取一次频控状态
  useEffect(() => {
    if (frequencyController && frequencyControllerReady) {
      (async () => {
        const freqResult = await frequencyController.checkFrequency();
        setHasCheckedFrequency(true);
        if (!freqResult.allowed) {
          // 直接用 cooldown_until 字段
          let bjStr = '';
          let msg = '';
          let until = Date.now();
          let secondsLeft = 0;
          if (freqResult.cooldown_until) {
            bjStr = toBeijingTimeStr(freqResult.cooldown_until);
            msg = `请按实际情况填写用户真实信息，勿敷衍了事，避免被系统暂时锁定。请在 ${bjStr} 后重试。`;
            until = dayjs(freqResult.cooldown_until).valueOf();
            secondsLeft = Math.ceil((until - Date.now()) / 1000);
          } else {
            msg = freqResult.message || '操作过于频繁，请稍后再试';
          }
          setCooldown({ until, secondsLeft, message: msg });
          setIsFrequencyLimited(true);
          setForceUpdate(prev => prev + 1); // 页面加载时检查到频控限制，强制更新控件状态
          // 设置 cooldown 定时器
          if (cooldownTimer.current) clearInterval(cooldownTimer.current);
          cooldownTimer.current = setInterval(() => {
            setCooldown(prev => {
              if (!prev) return null;
              const left = Math.ceil((prev.until - Date.now()) / 1000);
              if (left < 1) {
                clearInterval(cooldownTimer.current!);
                setForceUpdate(prev => prev + 1);
                setIsFrequencyLimited(false); // cooldown 结束时重置频控状态
                return null;
              }
              return { ...prev, secondsLeft: left };
            });
          }, 1000);
        } else {
          setIsFrequencyLimited(false);
        }
      })();
    } else if (frequencyControllerReady && !frequencyController) {
      setHasCheckedFrequency(true);
    }
  }, [frequencyController, frequencyControllerReady]);

  // 统一频控禁用判断：实时检查频控状态
  const isFieldDisabled = useCallback(() => {
    // 如果有 cooldown 或频控限制，禁用
    if (cooldown || isFrequencyLimited) {
      return true;
    }
    
    // 如果还没检查过频控状态，禁用（等待状态确定）
    if (!hasCheckedFrequency) {
      return true;
    }
    
    // 如果 frequencyController 不存在但已准备好，说明没有频控系统，允许编辑
    if (!frequencyController && frequencyControllerReady) {
      return false;
    }
    
    // 如果 frequencyController 还没准备好，禁用（等待状态确定）
    if (!frequencyControllerReady) {
      return true;
    }
    
    // 其他情况不禁用
    return false;
  }, [cooldown, isFrequencyLimited, hasCheckedFrequency, frequencyController, frequencyControllerReady]);

  // 统一的频率控制保存函数（唯一入口）
  const handleAnyFieldSave = async (record: any, field: keyof any, value: any) => {
    
    // 1. 只在此处做频控检查
    if (frequencyController && frequencyControllerReady) {
      const freqResult = await frequencyController.checkFrequency();
      
      if (!freqResult.allowed) {
        // 只用 allowed 字段判断，立即设置 cooldown 状态
        let bjStr = '';
        let msg = '';
        let until = Date.now();
        let secondsLeft = 0;
        if (freqResult.cooldown_until) {
          bjStr = toBeijingTimeStr(freqResult.cooldown_until);
          msg = `请按实际情况填写用户真实信息，勿敷衍了事，避免被系统暂时锁定。请在 ${bjStr} 后重试。`;
          until = dayjs(freqResult.cooldown_until).valueOf();
          secondsLeft = Math.ceil((until - Date.now()) / 1000);
        } else {
          msg = freqResult.message || '操作过于频繁，请稍后再试';
        }
        setCooldown({ until, secondsLeft, message: msg });
        setIsFrequencyLimited(true); // 立即设置频控限制状态，使编辑窗口置灰
        setForceUpdate(prev => prev + 1);
        if (cooldownTimer.current) clearInterval(cooldownTimer.current);
        cooldownTimer.current = setInterval(() => {
          setCooldown(prev => {
            if (!prev) return null;
            const left = Math.ceil((prev.until - Date.now()) / 1000);
            if (left < 1) {
              clearInterval(cooldownTimer.current!);
              setForceUpdate(prev => prev + 1);
              setIsFrequencyLimited(false); // cooldown 结束时重置频控状态
              return null;
            }
            return { ...prev, secondsLeft: left };
          });
        }, 1000);
        message.error(msg);
        return;
      } else {
      }
    }
    
    // 2. 频控未命中，允许保存
    const originalValue = data.find(item => item.id === record.id)?.[field];
    if (originalValue === value) {
      return; // 值没有变化，不需要保存
    }
    
    // 3. 乐观更新：立即更新本地数据，UI立即响应
    updateLocalData(record.id, field, value);
    
    try {
      // 4. 异步保存到后端
      const result = await saveFieldWithFrequency(frequencyController, record, String(field), value, originalValue);
      
      if (!result.success) {
        // 5. 保存失败，回滚本地数据
        updateLocalData(record.id, field, originalValue);
        message.error(result.error || '保存失败，已回滚到原值');
        return;
      }
      
      // 6. 保存成功，显示成功消息（可选，避免过多提示）
      if (!result.skipped) {
        message.success('保存成功');
      }
      
    } catch (error) {
      // 7. 异常处理，回滚本地数据
      updateLocalData(record.id, field, originalValue);
      message.error('保存过程中发生错误，已回滚到原值');
      console.error('保存字段失败:', error);
    }
  };

  // 统一的抽屉保存函数
  const saveDrawerForm = async (additionalFields: any = {}) => {
    if (!currentRecord) return { success: false, error: '无当前记录' };

    try {
      // 获取表单当前值
      const values = stageForm.getFieldsValue();
      
      // 格式化日期字段
      ['moveintime', 'scheduletime'].forEach(field => {
        if (values[field] && typeof values[field]?.format === 'function') {
          values[field] = values[field].format('YYYY-MM-DD HH:mm:ss');
        }
      });

      // 从values中移除deals表特有的字段
      const { contractcommunity, contractnumber, roomnumber, ...followupValues } = values;
      
      // 合并额外字段（如阶段推进）
      const updateObj = { ...followupValues, ...additionalFields };
      
      // 乐观更新：使用统一的updateLocalData函数更新所有相关状态
      Object.entries(updateObj).forEach(([field, value]) => {
        if (value !== currentRecord[field]) {
          updateLocalData(currentRecord.id, field, value);
        }
      });

      // 异步保存到后端
      const { error } = await supabase
        .from('followups')
        .update(updateObj)
        .eq('id', currentRecord.id);

      if (error) {
        // 保存失败，回滚所有修改的字段
        Object.entries(updateObj).forEach(([field, value]) => {
          if (value !== currentRecord[field]) {
            updateLocalData(currentRecord.id, field, currentRecord[field]);
          }
        });
        return { success: false, error: error.message };
      }
      
      return { success: true };
    } catch (error) {
      // 异常处理，回滚所有修改的字段
      const values = stageForm.getFieldsValue();
      const { contractcommunity, contractnumber, roomnumber, ...followupValues } = values;
      const updateObj = { ...followupValues, ...additionalFields };
      Object.entries(updateObj).forEach(([field, value]) => {
        if (value !== currentRecord[field]) {
          updateLocalData(currentRecord.id, field, currentRecord[field]);
        }
      });
      return { success: false, error: '保存过程中发生错误' };
    }
  };

  // 添加自动保存并关闭抽屉的函数
  const handleDrawerClose = async () => {
    if (!currentRecord) {
      setDrawerOpen(false);
      setDealsList([]);
      return;
    }

    const result = await saveDrawerForm();
    
    if (result.success) {
      message.success('已自动保存');
    } else {
      message.error('保存失败: ' + result.error);
    }
    
    // 无论成功失败都关闭抽屉
    setDrawerOpen(false);
    setDealsList([]);
  };

  // 修改丢单按钮的处理
  const handleDropout = async () => {
    if (!currentRecord) return;
    
    // 检查丢单频率限制
    if (!frequencyController) {
      return;
    }
    
    const result = await saveDrawerForm({ followupstage: followupStages[0] });
    
    if (result.success) {
      setDrawerOpen(false);
      message.success('已丢单');
      
      // 记录丢单操作
      await frequencyController?.recordOperation(currentRecord.id, currentRecord.followupstage, followupStages[0]);
    } else {
      message.error('丢单失败: ' + result.error);
    }
  };

  // 添加频率控制监控功能
  const [frequencyStats] = useState<any>(null);

  // 统一的筛选重置函数
  const resetFilter = (fieldName: string) => {
    // 清空当前字段的Table筛选条件
    setTableColumnFilters((filters: any) => {
      const updated = { ...filters };
      updated[fieldName] = null;
      return updated;
    });
    
    // 清空tableFilters中的对应字段
    setTableFilters((prev: any) => {
      const updated = { ...prev };
      // 处理特殊字段（日期范围字段）
      if (fieldName === 'created_at') {
        delete updated.p_created_at_start;
        delete updated.p_created_at_end;
      } else if (fieldName === 'moveintime') {
        delete updated.p_moveintime_start;
        delete updated.p_moveintime_end;
      } else {
        // 普通字段
        const paramKey = `p_${fieldName}`;
        delete updated[paramKey];
      }
      return updated;
    });
    
    // 重新获取数据
    const newFilters = { ...tableFilters };
    if (fieldName === 'created_at') {
      delete newFilters.p_created_at_start;
      delete newFilters.p_created_at_end;
    } else if (fieldName === 'moveintime') {
      delete newFilters.p_moveintime_start;
      delete newFilters.p_moveintime_end;
    } else {
      const paramKey = `p_${fieldName}`;
      delete newFilters[paramKey];
    }
    fetchFollowups(newFilters, 1, pagination.pageSize);
    
    // 同时更新分组统计
    if (groupField) {
      fetchGroupCount(groupField);
    }
  };

  // 获取频率控制统计信息

  // 手动触发清理

  // 日志：初始化 frequencyController 和 userId
  useEffect(() => {
    if (frequencyController) {
      const userId = frequencyController.getUserId ? frequencyController.getUserId() : undefined;
    } else {
    }
  }, [frequencyController]);

  // 调试：监听分页状态变化
  useEffect(() => {
    console.log('[FollowupsGroupList] 分页状态变化:', {
      current: pagination.current,
      pageSize: pagination.pageSize,
      total: pagination.total,
      shouldResetPagination
    });
  }, [pagination.current, pagination.pageSize, pagination.total, shouldResetPagination]);

  // 调试：监听 cooldown 状态变化
  useEffect(() => {
  }, [cooldown]);

  // 获取动态字段的筛选选项（从后端获取）
  const fetchDynamicFilterOptions = async (fieldName: string) => {
    try {
      console.log(`[动态筛选] 开始获取${fieldName}选项`);
      
      // 跟进备注和跟进结果字段使用后端函数获取所有选项
      if (fieldName === 'followupresult' || fieldName === 'majorcategory') {
        console.log(`[${fieldName === 'followupresult' ? '跟进备注' : '跟进结果'}筛选] 使用后端函数获取选项`);
        
        const { data, error } = await supabase.rpc('get_filter_options', {
          p_field_name: fieldName,
          p_filters: {} // 不传递筛选条件，获取所有选项
        });
        
        if (error) {
          console.error(`[${fieldName === 'followupresult' ? '跟进备注' : '跟进结果'}筛选] 获取筛选选项失败:`, error);
          // 回退到本地数据
          const fallbackData = getFilters(fieldName, fieldName);
          console.log(`[${fieldName === 'followupresult' ? '跟进备注' : '跟进结果'}筛选] 使用本地数据作为回退:`, fallbackData);
          return fallbackData;
        }
        
        console.log(`[${fieldName === 'followupresult' ? '跟进备注' : '跟进结果'}筛选] 获取选项成功:`, data);
        return data || [];
      }
      
      // 其他字段暂时使用本地数据
      console.log(`[动态筛选] ${fieldName}使用本地数据`);
      const filters = getFilters(fieldName, fieldName);
      console.log(`[动态筛选] ${fieldName}本地数据:`, filters);
      return filters;
    } catch (error) {
      console.error(`[动态筛选] 获取${fieldName}筛选选项出错:`, error);
      return [];
    }
  };

  // 获取管家列表
  const fetchInterviewsalesUserList = async () => {
    if (interviewsalesUserLoading) return;
    
    setInterviewsalesUserLoading(true);
    try {
      const { data, error } = await supabase.rpc('get_filter_options', {
        p_field_name: 'interviewsales_user_id',
        p_filters: tableFilters // 传递当前筛选条件
      });
      
      if (error) {
        console.error('[约访管家筛选] 获取管家列表失败:', error);
        // 如果后端函数不可用，回退到本地数据
        const fallbackList = localData
          .filter(item => item.interviewsales_user_id && item.interviewsales_user_name)
          .map(item => ({
            id: item.interviewsales_user_id,
            name: item.interviewsales_user_name || item.interviewsales_user
          }))
          .filter((item, index, arr) => 
            arr.findIndex(i => i.id === item.id) === index
          )
          .sort((a, b) => a.name.localeCompare(b.name));
        
        setInterviewsalesUserList(fallbackList);
        return;
      }
      
      // 转换后端数据格式
      const userList = (data || []).map((item: any) => ({
        id: parseInt(item.value),
        name: item.text
      })).filter((item: any) => !isNaN(item.id) && item.id > 0 && item.name && item.name.trim());
      
      // 按名称排序
      userList.sort((a: any, b: any) => a.name.localeCompare(b.name));
      
      setInterviewsalesUserList(userList);
      
    } catch (error) {
      console.error('[约访管家筛选] 获取管家列表出错:', error);
      // 出错时也使用本地数据作为回退
      const fallbackList = localData
        .filter(item => item.interviewsales_user_id && item.interviewsales_user_name)
        .map(item => ({
          id: item.interviewsales_user_id,
          name: item.interviewsales_user_name || item.interviewsales_user
        }))
        .filter((item, index, arr) => 
          arr.findIndex(i => i.id === item.id) === index
        )
        .sort((a, b) => a.name.localeCompare(b.name));
      
      setInterviewsalesUserList(fallbackList);
    } finally {
      setInterviewsalesUserLoading(false);
    }
  };





  return (
    <>
      {/* 优化：用Antd Alert展示冷却条，放在主内容card上方 */}
      {cooldown && (
        <Alert
          type="warning"
          showIcon
          banner
          style={{ marginBottom: 16, fontSize: 14, fontWeight: 'normal', textAlign: 'left' }}
          message={
            <span>
               {cooldown.message} 
            </span>
          }
        />
      )}
      <div className="page-card" style={{ marginTop: 0 }}>
        {/* 顶部操作区 */}
        <div className="page-header">
          <Title level={4} style={{ margin: 0, fontWeight: 700, color: '#222' }}>
            跟进记录
          </Title>
          <Space>
            {/* 现有的搜索和刷新按钮 */}
            <Search
              placeholder="编号、联系方式、管家..."
              allowClear
              value={keywordSearch}
              onChange={(e) => setKeywordSearch(e.target.value)}
              onSearch={handleGlobalSearch}
              className="page-search"
              style={{ width: 260 }}
            />
            <Select
              options={groupFieldOptions}
              value={groupField}
              onChange={val => {
                setGroupField(val || undefined);
                if (!val) setSelectedGroup(''); // 选"全部"时自动恢复明细
              }}
              className="page-btn"
              style={{ width: 120 }}
              placeholder="选择分组"
              allowClear
            />
            <Button icon={<ReloadOutlined />} onClick={() => {
              fetchFollowups(tableFilters);
              if (groupField) {
                fetchGroupCount(groupField);
              }
            }} className="page-btn">
              刷新
            </Button>
          </Space>
        </div>

        {/* 频率控制统计信息 */}
        {frequencyStats && (
          <div style={{ 
            margin: '8px 0', 
            padding: '8px 12px', 
            background: '#f6f8fa', 
            borderRadius: '4px',
            fontSize: '12px'
          }}>
            <Space split={<Divider type="vertical" />}>
              {frequencyStats.map((stat: any) => (
                <span key={stat.table_name}>
                  {stat.table_name}: {stat.row_count}条记录
                </span>
              ))}
            </Space>
        </div>
        )}

        {/* 筛选条件标签区 */}
        <div style={{ margin: '8px 0 0 0', display: 'flex', flexWrap: 'wrap', justifyContent: 'flex-start' }}>
          {/* 合并创建日期区间Tag */}
          {tableFilters.p_created_at_start && tableFilters.p_created_at_end && (
            <Tag
              closable
              className="filter-tag"
              onClose={() => {
                const newFilters = { ...tableFilters };
                delete newFilters.p_created_at_start;
                delete newFilters.p_created_at_end;
                setTableFilters(newFilters);
                setTableColumnFilters((filters: any) => ({ ...filters, created_at: null }));
                setPagination(p => ({ ...p, current: 1 }));
                fetchFollowups(newFilters, 1, pagination.pageSize);
                
                // 同时更新分组统计
                if (groupField) {
                  fetchGroupCount(groupField);
                }
              }}
              style={{ marginRight: 8, marginBottom: 8 }}
            >
              创建日期: {dayjs(tableFilters.p_created_at_start).format('YYYY-MM-DD')} ~ {dayjs(tableFilters.p_created_at_end).format('YYYY-MM-DD')}
            </Tag>
          )}
          {/* 合并入住日期区间Tag */}
          {tableFilters.p_moveintime_start && tableFilters.p_moveintime_end && (
            <Tag
              closable
              className="filter-tag"
              onClose={() => {
                const newFilters = { ...tableFilters };
                delete newFilters.p_moveintime_start;
                delete newFilters.p_moveintime_end;
                setTableFilters(newFilters);
                setTableColumnFilters((filters: any) => ({ ...filters, moveintime: null }));
                setPagination(p => ({ ...p, current: 1 }));
                fetchFollowups(newFilters, 1, pagination.pageSize);
                
                // 同时更新分组统计
                if (groupField) {
                  fetchGroupCount(groupField);
                }
              }}
              style={{ marginRight: 8, marginBottom: 8 }}
            >
              入住日期: {dayjs(tableFilters.p_moveintime_start).format('YYYY-MM-DD')} ~ {dayjs(tableFilters.p_moveintime_end).format('YYYY-MM-DD')}
            </Tag>
          )}
          {/* 其它字段Tag */}
          {Object.entries(tableFilters)
            .filter(([key, value]) =>
              value != null &&
              (Array.isArray(value) ? value.length > 0 : String(value).length > 0) &&
              ![
                'p_keyword',
                'p_created_at_start', 'p_created_at_end',
                'p_moveintime_start', 'p_moveintime_end',
                'created_at', 'moveintime' // 新增，彻底排除
              ].includes(key)
            )
            .map(([key, value]) => {
              const fieldLabelMap: Record<string, string> = {
                p_leadid: '线索编号',
                p_leadtype: '线索来源',
                p_interviewsales_user_id: '约访管家',
                p_showingsales_user_id: '带看管家',
                p_followupstage: '阶段',
                p_customerprofile: '用户画像',
                p_worklocation: '工作地点',
                p_userbudget: '用户预算',
                p_userrating: '来访意向',
                p_majorcategory: '跟进结果',
                p_subcategory: '子类目',
                p_followupresult: '跟进备注',
                p_showingsales_user: '带看管家',
                p_scheduledcommunity: '预约社区',
                p_source: '渠道',
                p_remark: '客服备注',
                p_phone: '手机号',
                p_wechat: '微信号',
                moveintime: '入住日期',
                created_at: '创建日期',
                // ...如有其它字段
              };
              const label = fieldLabelMap[key] || key.replace(/^p_/, '');
              const values = Array.isArray(value) ? value : [value];
              return values.map((v: string, idx: number) => {
                // 约访管家和带看管家特殊处理，显示昵称
                let displayText = v;
                if (key === 'p_interviewsales_user_id') {
                  // 从当前数据中查找对应的昵称
                  const found = localData.find(item => String(item.interviewsales_user_id) === String(v));
                  if (v === null || v === undefined || String(v) === 'null' || (typeof v === 'number' && isNaN(v))) {
                    displayText = '未分配';
                  } else {
                    displayText = found?.interviewsales_user_name || found?.interviewsales_user || v;
                  }
                } else if (key === 'p_showingsales_user_id') {
                  // 从当前数据中查找对应的昵称
                  const found = localData.find(item => String(item.showingsales_user_id) === String(v));
                  if (v === null || v === undefined || String(v) === 'null' || (typeof v === 'number' && isNaN(v))) {
                    displayText = '未分配';
                  } else {
                    displayText = found?.showingsales_user_name || found?.showingsales_user || v;
                  }
                } else if (key === 'p_scheduledcommunity' && (v === null || v === undefined || String(v) === 'null' || String(v) === '')) {
                  displayText = '未分配';
                } else if (key === 'p_phone' && v) {
                  // 手机号筛选标签脱敏
                  displayText = maskPhone(String(v));
                } else if (key === 'p_wechat' && v) {
                  // 微信号筛选标签脱敏
                  displayText = maskWechat(String(v));
                } else if (v === null || v === undefined || String(v) === 'null' || (typeof v === 'number' && isNaN(v))) {
                  displayText = '为空';
                }
                return (
                  <Tag
                    key={`filter_${key}_${String(v)}_${idx}`}
                    closable
                    className="filter-tag"
                    onClose={() => {
                      const updatedFilters = { ...tableFilters };
                      if (Array.isArray(updatedFilters[key])) {
                        updatedFilters[key] = updatedFilters[key].filter((item: string) => item !== v);
                        if (updatedFilters[key].length === 0) delete updatedFilters[key];
                      } else {
                        delete updatedFilters[key];
                      }
                      // 只清空当前字段的Table筛选条件，其它字段不变
                      const columnKey = key.replace(/^p_/, '');
                      setTableColumnFilters((filters: any) => {
                        const updated = { ...filters };
                        updated[columnKey] = null;
                        return updated;
                      });
                      setTableFilters(updatedFilters);
                      setPagination(p => ({ ...p, current: 1 }));
                      fetchFollowups(updatedFilters, 1, pagination.pageSize);
                      
                      // 同时更新分组统计
                      if (groupField) {
                        fetchGroupCount(groupField);
                      }
                    }}
                    style={{ marginRight: 8, marginBottom: 8 }}
                  >
                    {/* 时间字段格式化 */}
                    {(key === 'moveintime' || key === 'created_at') ? `${label}: ${dayjs(v).format('YYYY-MM-DD')}` : `${label}: ${displayText}`}
                  </Tag>
                );
              });
            })}
        </div>

        {/* 主体区：左右分栏布局 */}
        <div className="main-flex-layout">
          {/* 左侧分组区（分组按钮+总数卡片） */}
          <div className={`group-panel-sidebar ${groupPanelOpen ? 'open' : 'closed'}`}>
            {/* 总记录数卡片 */}
            <div style={{ paddingTop: 16, paddingBottom: 8,borderRadius: 16 }}>
              <span className="group-card-title">总记录数</span>
              <span className="group-card-count">{groupTotal}</span>
            </div>
                        {/* quick-date-bar 始终显示在分组区顶部 */}
                        <div className="quick-date-bar">
              <Button
                className={`quick-date-btn${quickDateKey === 'thisWeek' ? ' active' : ''}`}
                size="small"
                onClick={() => handleQuickDate('thisWeek')}
              >
                本周
              </Button>
              <Button
                className={`quick-date-btn${quickDateKey === 'lastWeek' ? ' active' : ''}`}
                size="small"
                onClick={() => handleQuickDate('lastWeek')}
              >
                上周
              </Button>
              <Button
                className={`quick-date-btn${quickDateKey === 'thisMonth' ? ' active' : ''}`}
                size="small"
                onClick={() => handleQuickDate('thisMonth')}
              >
                本月
              </Button>
              <Button
                className={`quick-date-btn${quickDateKey === 'lastMonth' ? ' active' : ''}`}
                size="small"
                onClick={() => handleQuickDate('lastMonth')}
              >
                上月
              </Button>
            </div>
            {/* 分组按钮列表：每个分组一个按钮，支持高亮和取消分组 */}
            <div style={{ maxHeight: 600, overflowY: 'auto' }}>
              {groupRowsCache.map(group => {
                // 约访管家和带看管家分组时展示昵称
                let groupLabel = group.groupText || group.key;
                // 处理预约社区字段的NULL值显示
                if (groupField === 'scheduledcommunity' && (group.key === null || group.key === 'null' || group.key === '' || group.groupText === '未分组')) {
                  groupLabel = '未分配';
                }

                // 统一未分配分组的选中判断逻辑
                const isNullOrEmpty = (val: any) =>
                  val === null ||
                  val === undefined ||
                  String(val).toLowerCase() === 'null' ||
                  String(val) === '' ||
                  val === '未分组';

                const isSelected =
                  (isNullOrEmpty(group.key) && (selectedGroup === 'null' || isNullOrEmpty(selectedGroup))) ||
                  String(selectedGroup) === String(group.key);

                return (
                  <div
                    key={`group_${groupField || 'unknown'}_${group.key}`}
                    onClick={() => handleGroupClick(group.key)}
                    className={`group-btn${isSelected ? ' group-btn-selected' : ''}`}
                  >
                    <span className="group-btn-title">{groupLabel}</span>
                    <span className="group-btn-count">{group.count} 条</span>
                  </div>
                );
              })}
            </div>
          </div>
          {/* 右侧明细区 */}
          <div className={`main-content-area ${groupPanelOpen ? 'sidebar-open' : 'sidebar-closed'}`}>
            <Spin spinning={loading}>
              <Table
                columns={columns}
                dataSource={localData}
                loading={loading}
                pagination={{
                  current: pagination.current,
                  pageSize: pagination.pageSize,
                  total: pagination.total,
                  showSizeChanger: true,
                  pageSizeOptions: ['10', '20', '50'],
                  showQuickJumper: true,
                  showTotal: (total: number, range: [number, number]) => `第 ${range[0]}-${range[1]} 条，共 ${total} 条`,
                }}
                rowKey="id"
                size="small"
                bordered={false}
                className="page-table compact-table"
                onChange={handleTableChange}
                scroll={{ x: 'max-content', y: 600 }}
                rowClassName={() => 'compact-table-row'}
                sticky
                tableLayout="fixed"
              />
            </Spin>
          </div>
        </div>
        {/* Drawer 组件（放在 return 的最外层） */}
        <Drawer
          title="跟进阶段进度"
          placement="bottom"
          open={drawerOpen}
          onClose={handleDrawerClose}
          destroyOnClose
          footer={null}
        >
          <div className="drawer-flex-row">
            {/* 左侧线索信息 */}
            <div className="page-drawer-info">
              <div className="mb-12">
                <span className="text-secondary">线索编号：</span>
                {currentRecord?.leadid ? (
                  <Paragraph copyable={{ text: currentRecord.leadid, tooltips: ['复制', '已复制'], icon: <CopyOutlined style={{ color: '#1677ff' }} /> }} style={{ margin: 0, color: '#1677ff', fontWeight: 600, display: 'inline-block', whiteSpace: 'nowrap', maxWidth: 320 }}>{currentRecord.leadid}</Paragraph>
                ) : <span className="text-muted">-</span>}
              </div>
              <div className="mb-12">
                <span className="text-secondary">手机号：</span>
                {currentRecord?.phone ? (
                  <Paragraph copyable={{ text: currentRecord.phone, tooltips: ['复制', '已复制'], icon: <CopyOutlined style={{ color: '#1677ff' }} /> }} style={{ margin: 0, display: 'inline-block', whiteSpace: 'nowrap', maxWidth: 320 }}>
                    {maskPhone(currentRecord.phone)}
                  </Paragraph>
                ) : <span className="text-muted">-</span>}
              </div>
              <div className="mb-12">
                <span className="text-secondary">微信号：</span>
                {currentRecord?.wechat ? (
                  <Paragraph copyable={{ text: currentRecord.wechat, tooltips: ['复制', '已复制'], icon: <CopyOutlined style={{ color: '#1677ff' }} /> }} style={{ margin: 0, display: 'inline-block', whiteSpace: 'nowrap', maxWidth: 320 }}>
                    {maskWechat(currentRecord.wechat)}
                  </Paragraph>
                ) : <span className="text-muted">-</span>}
              </div>
              <div className="mb-12">
                <span className="text-secondary">渠道：</span>
                <span className="text-primary">{currentRecord?.source || '-'}</span>
              </div>
              <div className="mb-12">
                <span className="text-secondary">创建时间：</span>
                <span>{currentRecord?.created_at ? new Date(currentRecord.created_at).toLocaleString('zh-CN') : '-'}</span>
              </div>
            </div>
            {/* 右侧步骤条和表单 */}
            <div className="page-drawer-form">
              <Steps
                current={currentStep}
                items={followupStages.map((stage, idx) => ({ title: stage, disabled: idx !== 0 }))}
                onChange={(step: number) => {
                  if (step === 0) {
                    setCurrentStep(step);
                    setCurrentStage(followupStages[step]);
                    if (currentRecord) stageForm.setFieldsValue(convertDateFields(currentRecord));
                  }
                }}
                style={{ marginBottom: 32 }}
              />
              <Form
                form={stageForm}
                layout="vertical"
                onFinishFailed={() => message.error('请完整填写所有必填项')}
                onValuesChange={(changed) => {
                  // 保证所有时间字段始终为 dayjs 对象，且清空时为 undefined
                  const dateFields = ['moveintime', 'scheduletime'];
                  let needSet = false;
                  const patch: any = {};
                  dateFields.forEach(field => {
                    if (field in changed) {
                      const v = changed[field];
                      if (!v || v === '' || v === null) {
                        patch[field] = undefined;
                        needSet = true;
                      } else if (!dayjs.isDayjs(v)) {
                        patch[field] = dayjs(v);
                        needSet = true;
                      }
                    }
                  });
                  if (needSet) {
                    stageForm.setFieldsValue(patch);
                  }
                }}
              >
                {currentStage === '丢单' ? (
                  <>
                    <Form.Item
                      name="followupresult"
                      label="丢单原因"
                    >
                      <Input placeholder="请输入丢单原因" disabled={isFieldDisabled()} key={forceUpdate} />
                    </Form.Item>
                    <div className="mt-16">
                      <Button type="primary" className="mr-8"
                        onClick={handleDropout}
                      >确定丢单</Button>
                    </div>
                  </>
                                  ) : (
                  <>
                    {/* 其他阶段使用三分栏布局 */}
                    {currentStage !== '已到店' && currentStage !== '赢单' && (
                      <div className="page-step-fields">
                        {(stageFields[currentStage as keyof typeof stageFields] || []).map((field: string) => (
                          <div key={field} className="page-step-field-item">
                            <Form.Item
                              name={field}
                              label={fieldLabelMap[field] || field}
                            >
                              {field === 'scheduledcommunity'
                                ? <Select options={communityEnum} placeholder="请选择社区" loading={communityEnum.length === 0} disabled={communityEnum.length === 0 || isFieldDisabled()} key={forceUpdate} />
                                : field === 'customerprofile'
                                  ? <Select options={customerprofileEnum} placeholder="请选择用户画像" loading={customerprofileEnum.length === 0} disabled={customerprofileEnum.length === 0 || isFieldDisabled()} key={forceUpdate} />
                                  : field === 'followupstage'
                                    ? <Select options={followupstageEnum} placeholder="请选择阶段" loading={followupstageEnum.length === 0} disabled={followupstageEnum.length === 0 || isFieldDisabled()} key={forceUpdate} />
                                    : field === 'userrating'
                                      ? <Select options={userratingEnum} placeholder="请选择来访意向" loading={userratingEnum.length === 0} disabled={userratingEnum.length === 0 || isFieldDisabled()} key={forceUpdate} />
                                      : field === 'worklocation'
                                        ? <Cascader
                                            options={metroStationOptions}
                                            value={findCascaderPath(metroStationOptions, stageForm.getFieldValue(field))}
                                            onChange={(_value, selectedOptions) => {
                                              const selectedText = selectedOptions && selectedOptions.length > 1 ? selectedOptions[1].label : '';
                                              stageForm.setFieldValue(field, selectedText);
                                            }}
                                            placeholder="请选择工作地点"
                                            style={{ width: '100%', minWidth: 200 }}
                                            showSearch
                                            changeOnSelect={false}
                                            allowClear
                                            disabled={isFieldDisabled()}
                                            key={forceUpdate}
                                          />
                                        : field === 'moveintime' || field === 'scheduletime'
                                          ? <DatePicker
                                              showTime
                                              locale={locale}
                                              style={{ width: '100%' }}
                                              placeholder="请选择时间"
                                              disabled={isFieldDisabled()}
                                              key={forceUpdate}
                                              value={(() => {
                                                const v = stageForm.getFieldValue(field);
                                                if (!v || v === '' || v === null) return undefined;
                                                if (dayjs.isDayjs(v)) return v;
                                                if (typeof v === 'string') return dayjs(v);
                                                return undefined;
                                              })()}
                                              onChange={(v: any) => {
                                                stageForm.setFieldValue(field, v || undefined);
                                              }}
                                            />
                                          : <Input disabled={isFieldDisabled()} key={forceUpdate} />}
                            </Form.Item>
                          </div>
                        ))}
                      </div>
                    )}
                      
                    {/* 已到店阶段显示签约信息表格 */}
                    {currentStage === '已到店' && (
                      <div className="page-step-fields-single">
                        <ContractDealsTable
                          dealsList={dealsList}
                          dealsLoading={dealsLoading}
                          onAdd={() => {
                            const newRow: any = {
                              id: `new_${Date.now()}`,
                              leadid: currentRecord?.leadid || '',
                              contractdate: dayjs().format('YYYY-MM-DD'),
                              community: '',
                              contractnumber: '',
                              roomnumber: '',
                              created_at: dayjs().format('YYYY-MM-DD HH:mm:ss'),
                              isNew: true,
                              isEditing: true,
                            };
                            setDealsList((prev: any[]) => [newRow, ...prev]);
                          }}
                          onEdit={async (record) => {
                            // 编辑/保存逻辑
                            if (record.isNew) {
                              // 新增记录
                              const dealData = {
                                leadid: currentRecord?.leadid,
                                contractdate: record.contractdate || dayjs().format('YYYY-MM-DD'),
                                community: record.community,
                                contractnumber: record.contractnumber,
                                roomnumber: record.roomnumber
                              };
                              const { data: newDeal, error } = await supabase
                                .from('deals')
                                .insert([dealData])
                                .select()
                                .single();
                              if (error) {
                                message.error('创建签约记录失败: ' + error.message);
                                return;
                              }
                              setDealsList(prev => prev.map(item =>
                                item.id === record.id
                                  ? { ...newDeal, isEditing: false }
                                  : item
                              ));
                              message.success('签约记录已保存');
                            } else {
                              // 更新现有记录
                              const { error } = await supabase
                                .from('deals')
                                .update({
                                  contractdate: record.contractdate,
                                  community: record.community,
                                  contractnumber: record.contractnumber,
                                  roomnumber: record.roomnumber
                                })
                                .eq('id', record.id);
                              if (error) {
                                message.error('更新签约记录失败: ' + error.message);
                                return;
                              }
                              setDealsList(prev => prev.map(item =>
                                item.id === record.id
                                  ? { ...item, isEditing: false }
                                  : item
                              ));
                              message.success('签约记录已更新');
                            }
                          }}
                          onDelete={(record) => {
                            if (record.isNew) {
                              setDealsList(prev => prev.filter(item => item.id !== record.id));
                            } else {
                              setDealsList(prev => prev.map(item =>
                                item.id === record.id
                                  ? { ...item, isEditing: false }
                                  : item
                              ));
                            }
                          }}
                          currentRecord={currentRecord}
                          communityEnum={communityEnum}
                          setDealsList={setDealsList}
                        />
                      </div>
                    )}
                      
                    {/* 赢单阶段显示成交记录信息 */}
                    {currentStage === '赢单' && (
                      <div className="page-step-fields-single">
                        <ContractDealsTable
                          dealsList={dealsList}
                          dealsLoading={dealsLoading}
                          onAdd={() => {
                            const newRow: any = {
                              id: `new_${Date.now()}`,
                              leadid: currentRecord?.leadid || '',
                              contractdate: dayjs().format('YYYY-MM-DD'),
                              community: '',
                              contractnumber: '',
                              roomnumber: '',
                              created_at: dayjs().format('YYYY-MM-DD HH:mm:ss'),
                              isNew: true,
                              isEditing: true,
                            };
                            setDealsList((prev: any[]) => [newRow, ...prev]);
                          }}
                          onEdit={async (record) => {
                            // 编辑/保存逻辑
                            if (record.isNew) {
                              // 新增记录
                              const dealData = {
                                leadid: currentRecord?.leadid,
                                contractdate: record.contractdate || dayjs().format('YYYY-MM-DD'),
                                community: record.community,
                                contractnumber: record.contractnumber,
                                roomnumber: record.roomnumber
                              };
                              const { data: newDeal, error } = await supabase
                                .from('deals')
                                .insert([dealData])
                                .select()
                                .single();
                              if (error) {
                                message.error('创建签约记录失败: ' + error.message);
                                return;
                              }
                              setDealsList(prev => prev.map(item =>
                                item.id === record.id
                                  ? { ...newDeal, isEditing: false }
                                  : item
                              ));
                              message.success('签约记录已保存');
                            } else {
                              // 更新现有记录
                              const { error } = await supabase
                                .from('deals')
                                .update({
                                  contractdate: record.contractdate,
                                  community: record.community,
                                  contractnumber: record.contractnumber,
                                  roomnumber: record.roomnumber
                                })
                                .eq('id', record.id);
                              if (error) {
                                message.error('更新签约记录失败: ' + error.message);
                                return;
                              }
                              setDealsList(prev => prev.map(item =>
                                item.id === record.id
                                  ? { ...item, isEditing: false }
                                  : item
                              ));
                              message.success('签约记录已更新');
                            }
                          }}
                          onDelete={(record) => {
                            if (record.isNew) {
                              setDealsList(prev => prev.filter(item => item.id !== record.id));
                            } else {
                              setDealsList(prev => prev.map(item =>
                                item.id === record.id
                                  ? { ...item, isEditing: false }
                                  : item
                              ));
                            }
                          }}
                          currentRecord={currentRecord}
                          communityEnum={communityEnum}
                          setDealsList={setDealsList}
                        />
                      </div>
                    )}
                    
                    <div className="mt-16">
                      <Button
                        disabled={currentStep === 0}
                        className="mr-8"
                        style={{ marginRight: 8 }}
                        onClick={async () => {
                          // 上一步前自动保存
                          try {
                            await stageForm.validateFields();
                            const result = await saveDrawerForm({ followupstage: followupStages[currentStep - 1] });
                            
                            if (result.success) {
                              setCurrentStep(currentStep - 1);
                              setCurrentStage(followupStages[currentStep - 1]);
                            } else {
                              message.error('保存失败: ' + result.error);
                            }
                          } catch {
                            message.error('请完整填写所有必填项');
                          }
                        }}
                      >上一步</Button>
                      {/* 新增发放带看单按钮，仅在邀约到店阶段显示 */}
                      {currentStage === '邀约到店' && (
                        <Button
                          type="primary"
                          style={{ marginRight: 8 }}
                          onClick={async () => {
                            if (isFieldDisabled()) return;
                            if (!currentRecord) return;
                            const values = stageForm.getFieldsValue();
                            const community = values.scheduledcommunity || null;
                            if (!community) {
                              message.error('请先选择预约社区');
                              return;
                            }
                            // 1. 调用分配函数
                            const { data: assignedUserId, error } = await supabase.rpc('assign_showings_user', { p_community: community });
                            if (error || !assignedUserId) {
                              message.error('分配带看人员失败: ' + (error?.message || '无可用人员'));
                              return;
                            }
                            // 2. 查询成员昵称
                            let nickname = '';
                            if (assignedUserId) {
                              const { data: userData } = await supabase
                                .from('users_profile')
                                .select('nickname')
                                .eq('id', assignedUserId)
                                .single();
                              nickname = userData?.nickname || String(assignedUserId);
                            }
                            // 3. 新增showings记录
                            const insertParams = {
                              leadid: currentRecord.leadid,
                              scheduletime: values.scheduletime ? dayjs(values.scheduletime).toISOString() : null,
                              community,
                              showingsales: assignedUserId,
                            };
                            const { error: insertError } = await supabase.from('showings').insert(insertParams).select();
                            if (insertError) {
                              message.error('发放带看单失败: ' + insertError.message);
                              return;
                            }
                            // 4. 推进到"已到店"阶段
                            const result = await saveDrawerForm({ followupstage: '已到店' });
                            
                            if (result.success) {
                              setCurrentStep(currentStep + 1);
                              setCurrentStage('已到店');
                              message.success(`带看单已发放，分配给 ${nickname}`);
                            } else {
                              message.error('推进阶段失败: ' + result.error);
                            }
                          }}
                        >
                          发放带看单
                        </Button>
                      )}
                      {currentStep === followupStages.length - 1 ? (
                        <Button
                          type="primary"
                          style={{ marginLeft: 8 }}
                          onClick={() => {
                            message.success('跟进阶段管理完成');
                            setDrawerOpen(false);
                          }}
                        >
                          完成
                        </Button>
                      ) : (
                        <Button
                          type="primary"
                          style={{ marginLeft: 8 }}
                          onClick={async () => {
                            // 下一步前自动保存
                            try {
                              const values = await stageForm.validateFields();
                              if (!currentRecord) return;
                              
                              // 如果是"已到店"阶段推进到"赢单"阶段，需要验证是否有签约记录
                              if (currentStage === '已到店' && currentStep + 1 === followupStages.length - 1) {
                                // 检查是否有签约记录
                                if (dealsList.length === 0) {
                                  message.error('请至少添加一条签约记录后再推进到"赢单"阶段');
                                  return;
                                }
                                
                                // 检查是否有正在编辑的记录
                                const hasEditingRecord = dealsList.some(record => record.isEditing);
                                if (hasEditingRecord) {
                                  message.error('请先完成当前编辑的签约记录');
                                  return;
                                }
                                
                                message.success('可以推进到"赢单"阶段');
                              }
                              
                              const result = await saveDrawerForm({ followupstage: followupStages[currentStep + 1] });
                              
                              if (result.success) {
                                setCurrentStep(currentStep + 1);
                                setCurrentStage(followupStages[currentStep + 1]);
                              } else {
                                message.error('保存失败: ' + result.error);
                              }
                            } catch {
                              message.error('请完整填写所有必填项');
                            }
                          }}
                        >
                          下一步
                        </Button>
                      )}
                    </div>
                  </>
                )}
              </Form>
            </div>
          </div>
        </Drawer>
        <LeadDetailDrawer
          visible={leadDetailDrawerOpen}
          leadid={leadDetailId || ''}
          onClose={() => setLeadDetailDrawerOpen(false)}
        />
      </div>
    </>
  );
};

export default FollowupsGroupList; 