// 复制自FollowupsList.tsx，后续将在此文件实现自定义字段分组功能
// ... existing code from FollowupsList.tsx ... 

import React, { useEffect, useState, useMemo } from 'react';
import { Table, Typography, Button, Space, Select, message, Input, Tag, Tooltip, DatePicker, Form, Steps, Drawer, Checkbox } from 'antd';
import { ReloadOutlined, CopyOutlined } from '@ant-design/icons';
import { supabase, fetchEnumValues } from '../supaClient';
import dayjs from 'dayjs';
import type { FilterDropdownProps } from 'antd/es/table/interface';

import locale from 'antd/es/date-picker/locale/zh_CN';
import '../index.css'; // 假设全局样式在index.css

const { Title, Paragraph } = Typography;
const { Search } = Input;
const { RangePicker } = DatePicker;

// 跟进记录数据类型定义
interface Followup {
  id: string;
  leadid: string;
  created_at: string;
  source: string;
  leadtype: string;
  interviewsales_user_id?: number | null;
  interviewsales_user?: string; // 昵称
  interviewsales_user_name?: string; // 兼容后端不同字段
  showingsales_user_id?: number | null;
  showingsales_user?: string;
  showingsales_user_name?: string; // 新增，带看管家昵称
  followupstage: string;
  customerprofile: string;
  worklocation: string;
  userbudget: string;
  moveintime: string;
  userrating: string;
  majorcategory: string;
  subcategory: string;
  followupresult: string;
  scheduletime: string;
  scheduledcommunity: string;
  phone: string;
  wechat: string;
  remark: string;
}

// 可选分组字段配置
const groupFieldOptions = [
  { label: '跟进阶段', value: 'followupstage' },
  { label: '约访管家', value: 'interviewsales_user_id' },
  { label: '创建日期', value: 'created_at' },
  { label: '社区', value: 'scheduledcommunity' },
  { label: '来源', value: 'source' },
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
  // 跟进数据
  const [data, setData] = useState<Followup[]>([]);
  const [loading, setLoading] = useState(false);
  const [groupField, setGroupField] = useState<string | undefined>(undefined);
  const [selectedGroup, setSelectedGroup] = useState<string>('');
  const [tableFilters, setTableFilters] = useState<any>({});
  const [pagination, setPagination] = useState({ current: 1, pageSize: 20, total: 0 });
  // 编辑相关
  const [inputCache, setInputCache] = useState<{ [key: string]: string }>({});
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
  const [currentRecord, setCurrentRecord] = useState<Followup | null>(null);
  const [stageForm] = Form.useForm();
  const [currentStep, setCurrentStep] = useState(0);
  // 在组件内部
  const [phoneSearch, setPhoneSearch] = useState('');
  const [wechatSearch, setWechatSearch] = useState('');
  const [keywordSearch, setKeywordSearch] = useState('');

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
    '已到店': ['showingsales_user'],
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
    fetchEnumValues('community').then(arr => setCommunityEnum(arr.map(v => ({ value: v, label: v }))));
    fetchEnumValues('followupstage').then(arr => setFollowupstageEnum(arr.map(v => ({ value: v, label: v }))));
    fetchEnumValues('customerprofile').then(arr => setCustomerprofileEnum(arr.map(v => ({ value: v, label: v }))));
    fetchEnumValues('source').then(arr => setSourceEnum(arr.map(v => ({ value: v, label: v }))));
    fetchEnumValues('userrating').then(arr => setUserratingEnum(arr.map(v => ({ value: v, label: v }))));
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
    'p_source', 'p_userbudget', 'p_userrating',
    'p_wechat', 'p_worklocation', 'p_phone', 'p_keyword'
  ];

  // 查询明细数据（后端分页）
  const fetchFollowups = async (
    filters: any = tableFilters,
    page = pagination.current,
    pageSize = pagination.pageSize
  ) => {
    console.log('🔍 [fetchFollowups] 开始获取跟进记录...', {
      filters,
      page,
      pageSize
    });
    
    setLoading(true);
    try {
      // 计算分页参数
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

      console.log('📤 [fetchFollowups] 发送参数:', rpcParams);
      console.log('🔍 [fetchFollowups] interviewsales_user_id类型:', typeof rpcParams.p_interviewsales_user_id, '值:', rpcParams.p_interviewsales_user_id);
      console.log('🔍 [fetchFollowups] p_scheduledcommunity:', rpcParams.p_scheduledcommunity, '类型:', typeof rpcParams.p_scheduledcommunity);

      const { data, error } = await supabase.rpc('filter_followups', rpcParams);
      
      console.log('📥 [fetchFollowups] 接收结果:', {
        dataCount: data?.length || 0,
        error: error?.message,
        firstRecord: data?.[0]
      });
      
      if (error) {
        console.error('❌ [fetchFollowups] 获取跟进记录失败:', error);
        message.error('获取跟进记录失败: ' + error.message);
      } else {
        const total = data && data.length > 0 ? Number(data[0].total_count) : 0;
        
        console.log('📊 [fetchFollowups] 数据统计:', {
          total,
          dataLength: data?.length || 0,
          firstRecordId: data?.[0]?.id,
          firstRecordInterviewsalesUserId: data?.[0]?.interviewsales_user_id
        });
        
        // 前端校验：只保留id非空且唯一的行
        const filtered = (data || []).filter((item: any): item is Followup => !!item && !!item.id);
        const unique = Array.from(new Map(filtered.map((i: Followup) => [i.id, i])).values()) as Followup[];
        
        console.log('🔍 [fetchFollowups] 数据过滤结果:', {
          originalCount: data?.length || 0,
          filteredCount: filtered.length,
          uniqueCount: unique.length
        });
        
        // 类型安全处理
        const safeData = unique.map((item: unknown) => {
          const newItem = { ...item as Followup };
          
          // ID类字段统一转为number或null
          ['interviewsales_user_id', 'showingsales_user_id'].forEach(field => {
            const val = (newItem as any)[field];
            if (val === null || val === undefined || val === '' || (typeof val === 'number' && isNaN(val))) {
              (newItem as any)[field] = null;
            } else if (typeof val !== 'number') {
              (newItem as any)[field] = Number(val);
            }
          });
          
          // 确保日期字段格式正确
          ['created_at', 'moveintime', 'scheduletime'].forEach(field => {
            const val = (newItem as any)[field];
            if (val) {
              (newItem as any)[field] = dayjs(val).format('YYYY-MM-DD HH:mm:ss');
            }
          });
          
          return newItem as Followup;
        });

        console.log('✅ [fetchFollowups] 最终数据:', {
          safeDataLength: safeData.length,
          sampleRecord: safeData[0] ? {
            id: safeData[0].id,
            leadid: safeData[0].leadid,
            interviewsales_user_id: safeData[0].interviewsales_user_id,
            interviewsales_user_name: safeData[0].interviewsales_user_name
          } : null
        });

        setData(safeData);
        setPagination(prev => ({ ...prev, total, current: page, pageSize }));
        setInputCache({});
      }
    } catch (error) {
      console.error('❌ [fetchFollowups] 异常:', error);
      message.error('获取跟进记录失败');
    } finally {
      setLoading(false);
    }
  };

  // 获取分组统计
  const fetchGroupCount = async (groupFieldParam = groupField) => {
    console.log('📊 [fetchGroupCount] 开始获取分组统计...', {
      groupFieldParam,
      groupField
    });
    
    if (!groupFieldParam) {
      console.log('⚠️ [fetchGroupCount] 分组字段为空，清空分组数据');
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
      
      console.log('🔍 [fetchGroupCount] 分组参数:', {
        groupFieldParam,
        filterKey,
        restFilters,
        params
      });
      
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
      
      console.log('📤 [fetchGroupCount] 发送参数:', rpcParams);
      
      const { data, error } = await supabase.rpc('group_count_filter_followups', rpcParams);
      
      console.log('📥 [fetchGroupCount] 接收结果:', {
        dataCount: data?.length || 0,
        error: error?.message,
        sampleGroup: data?.[0]
      });
      
      if (error) {
        console.error('❌ [fetchGroupCount] 获取分组统计失败:', error);
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
      
      console.log('📊 [fetchGroupCount] 分组结果:', {
        originalCount: data?.length || 0,
        sortedCount: sortedData.length,
        groupRowsCount: groupRows.length,
        sampleGroup: groupRows[0]
      });
      
      setGroupRowsCache(groupRows);
      // 统计总数
      const total = data.reduce((sum: number, g: any) => sum + Number(g.count), 0);
      setGroupTotal(total);
      
      console.log('✅ [fetchGroupCount] 分组统计完成:', {
        total,
        groupRowsCount: groupRows.length
      });
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
    setPagination(p => ({ ...p, current: 1 }));
    // 只刷新明细数据，不刷新分组统计
    fetchFollowups(newFilters, 1, pagination.pageSize);
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
    setPagination(p => ({ ...p, current: 1 }));
  }, [groupField]);

  // 优化：分离明细数据刷新和分组统计刷新
  // 当tableFilters变化时，只刷新明细数据
  useEffect(() => {
    // 避免初始化时的重复调用
    if (Object.keys(tableFilters).length > 0) {
      fetchFollowups(tableFilters);
    }
  }, [JSON.stringify(tableFilters)]);

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
    console.log('🚀 [FollowupsGroupList] 组件初始化，开始加载数据');
    console.log('🔍 [FollowupsGroupList] 当前用户信息检查...');
    
    // 检查当前用户信息
    supabase.auth.getUser().then(({ data: { user }, error }) => {
      console.log('👤 [FollowupsGroupList] 当前用户:', {
        id: user?.id,
        email: user?.email,
        error: error?.message
      });
    });
    
    // 检查用户权限
    supabase.rpc('has_permission', { resource: 'lead', action: 'manage' }).then(({ data, error }) => {
      console.log('🔑 [FollowupsGroupList] lead管理权限检查:', {
        hasPermission: data,
        error: error?.message
      });
    });
    
    // 检查用户角色
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) {
        supabase.rpc('get_user_roles', { p_user_id: user.id }).then(({ data: roles, error }) => {
          console.log('🎭 [FollowupsGroupList] 用户角色:', {
            roles,
            error: error?.message
          });
        });
      }
    });
    
    // 初始化时加载数据
    fetchFollowups();
  }, []);

  // handleCellSave
  const handleCellSave = async (record: Followup, dataIndex: keyof Followup, value: any) => {
    let saveVal = value;
    if (value === '') {
      saveVal = null;
    }
    try {
      const { error } = await supabase
        .from('followups')
        .update({ [dataIndex]: saveVal })
        .eq('id', record.id);
      if (error) {
        message.error(`保存失败: ${error.message} (字段: ${dataIndex})`);
      } else {
        setData(prevData => prevData.map(item =>
          item.id === record.id
            ? { ...item, [dataIndex]: saveVal }
            : item
        ));
        setInputCache(cache => {
          const c = { ...cache };
          delete c[record.id + '-' + dataIndex];
          return c;
        });
        message.success('保存成功');
      }
    } catch (error) {
      message.error('保存失败');
    }
  };

  // getFilters 逻辑，value为ID（number），text为昵称，只收集number类型id
  const getFilters = (idKey: keyof Followup, nameKey: keyof Followup) => {
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

  // columns完整定义
  const columns = useMemo(() => [
    // 线索编号，唯一标识，带复制功能，左侧冻结
    {
      title: '线索编号',
      dataIndex: 'leadid',
      key: 'leadid',
      fixed: 'left' as const,
      ellipsis: true,
      filters: getFilters('leadid', 'leadid'),
      filterSearch: true,
      onCell: () => ({ style: { ...defaultCellStyle, minWidth: 120, maxWidth: 180 } }),
      filteredValue: tableColumnFilters.leadid ?? null,
      render: (text: string) => text ? (
        <Tooltip title={text}>
          <Paragraph copyable={{ text, tooltips: ['复制', '已复制'], icon: <CopyOutlined style={{ color: '#1677ff' }} /> }} style={{ margin: 0, color: '#1677ff', fontWeight: 600, display: 'inline-block', whiteSpace: 'nowrap' }}>{text}</Paragraph>
        </Tooltip>
      ) : <span style={{ color: '#bbb' }}>-</span>
    },
    // 跟进阶段，按钮渲染，颜色区分不同阶段，左侧冻结
    {
      title: '跟进阶段',
      dataIndex: 'followupstage',
      key: 'followupstage',
      fixed: 'left' as const,
      ellipsis: true,
      filters: getFilters('followupstage', 'followupstage'),
      onCell: () => ({
        style: {
          ...defaultCellStyle,
          minWidth: 100
        }
      }),
      filteredValue: tableColumnFilters.followupstage ?? null,
      render: (text: string, record: Followup) => {
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
            onClick={async () => {
              const isPending = (item?.label || text) === '待接收';
              if (isPending) {
                const nextStage = followupstageEnum.find(i => i.label === '确认需求')?.value || '';
                if (!nextStage) return;
                const { error } = await supabase.from('followups').update({ followupstage: nextStage }).eq('id', record.id);
                if (!error) {
                  setData(prev => prev.map(item => item.id === record.id ? { ...item, followupstage: nextStage } : item));
                  message.success('已接收，阶段已推进到"确认需求"');
                }
              } else {
                setCurrentRecord(record);
                setDrawerOpen(true);
                setCurrentStage(record.followupstage);
                setCurrentStep(followupStages.indexOf(record.followupstage));
                stageForm.setFieldsValue(convertDateFields(record));
              }
            }}
          >{item?.label || text}</Button>
        );
      }
    },
    // 手机号，带复制功能，数据脱敏
    {
      title: '手机号',
      dataIndex: 'phone',
      key: 'phone',
      ellipsis: true,
      filterDropdown: ({ setSelectedKeys, selectedKeys, confirm, clearFilters }: FilterDropdownProps) => {
        const phoneFilters = getFilters('phone', 'phone');
        const filteredPhoneFilters = useMemo(() =>
          phoneFilters.filter(filter => {
            if (!phoneSearch) return true;
            const val = String(filter.value || '').toLowerCase();
            const text = String(filter.text || '').toLowerCase();
            return val.includes(phoneSearch.toLowerCase()) || text.includes(phoneSearch.toLowerCase());
          }), [phoneFilters, phoneSearch]);
        return (
          <div style={{ padding: 8 }}>
            <Input.Search
              placeholder="在筛选项中搜索"
              value={phoneSearch}
              onChange={e => setPhoneSearch(e.target.value)}
              style={{ marginBottom: 8 }}
            />
            <div style={{ maxHeight: 200, overflowY: 'auto' }}>
              {filteredPhoneFilters.map((filter, index) => (
                <div
                  key={index}
                  style={{
                    padding: '4px 8px',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    backgroundColor: selectedKeys.includes(filter.value) ? '#e6f7ff' : undefined
                  }}
                  onClick={() => {
                    const newKeys = selectedKeys.includes(filter.value)
                      ? selectedKeys.filter((key: any) => key !== filter.value)
                      : [...selectedKeys, filter.value];
                    setSelectedKeys(newKeys);
                  }}
                >
                  <Checkbox
                    checked={selectedKeys.includes(filter.value)}
                    style={{ marginRight: 8 }}
                    tabIndex={-1}
                    onChange={() => {}}
                  />
                  <span>{filter.text}</span>
                </div>
              ))}
            </div>
            <div style={{ textAlign: 'right' }}>
              <Button type="primary" size="small" onClick={() => confirm()} style={{ marginRight: 8 }}>
                筛选
              </Button>
              <Button size="small" onClick={() => { clearFilters && clearFilters(); confirm && confirm(); }}>
                重置
              </Button>
            </div>
          </div>
        );
      },
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
    // 微信号，带复制功能，数据脱敏
    {
      title: '微信号',
      dataIndex: 'wechat',
      key: 'wechat',
      ellipsis: true,
      filterDropdown: ({ setSelectedKeys, selectedKeys, confirm, clearFilters }: FilterDropdownProps) => {
        const wechatFilters = getFilters('wechat', 'wechat');
        const filteredWechatFilters = useMemo(() =>
          wechatFilters.filter(filter => {
            if (!wechatSearch) return true;
            const val = String(filter.value || '').toLowerCase();
            const text = String(filter.text || '').toLowerCase();
            return val.includes(wechatSearch.toLowerCase()) || text.includes(wechatSearch.toLowerCase());
          }), [wechatFilters, wechatSearch]);
        return (
          <div style={{ padding: 8 }}>
            <Input.Search
              placeholder="在筛选项中搜索"
              value={wechatSearch}
              onChange={e => setWechatSearch(e.target.value)}
              style={{ marginBottom: 8 }}
            />
            <div style={{ maxHeight: 200, overflowY: 'auto' }}>
              {filteredWechatFilters.map((filter, index) => (
                <div
                  key={index}
                  style={{
                    padding: '4px 8px',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    backgroundColor: selectedKeys.includes(filter.value) ? '#e6f7ff' : undefined
                  }}
                  onClick={() => {
                    const newKeys = selectedKeys.includes(filter.value)
                      ? selectedKeys.filter((key: any) => key !== filter.value)
                      : [...selectedKeys, filter.value];
                    setSelectedKeys(newKeys);
                  }}
                >
                  <Checkbox
                    checked={selectedKeys.includes(filter.value)}
                    style={{ marginRight: 8 }}
                    tabIndex={-1}
                    onChange={() => {}}
                  />
                  <span>{filter.text}</span>
                </div>
              ))}
            </div>
            <div style={{ textAlign: 'right' }}>
              <Button type="primary" size="small" onClick={() => confirm()} style={{ marginRight: 8 }}>
                筛选
              </Button>
              <Button size="small" onClick={() => { clearFilters && clearFilters(); confirm && confirm(); }}>
                重置
              </Button>
            </div>
          </div>
        );
      },
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
    // 创建日期
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
            <Button size="small" onClick={() => { clearFilters && clearFilters(); confirm && confirm(); }}>
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
      sorter: (a: Followup, b: Followup) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
    },
    // 渠道，枚举渲染Tag
    {
      title: '渠道',
      dataIndex: 'source',
      key: 'source',
      ellipsis: true,
      filters: getFilters('source', 'source'),
      filterMultiple: true,
      onCell: () => ({ style: { ...defaultCellStyle } }),
      filteredValue: tableColumnFilters.source ?? null,
      render: (text: string) => {
        const item = sourceEnum.find(i => i.value === text);
        return <Tag color="blue">{item?.label || text}</Tag>;
      }
    },
    // 来源
    {
      title: '线索来源',
      dataIndex: 'leadtype',
      key: 'leadtype',
      ellipsis: true,
      filters: getFilters('leadtype', 'leadtype'),
      onCell: () => ({ style: { ...defaultCellStyle } }),
      filteredValue: tableColumnFilters.leadtype ?? null,
    },
    // 约访管家
    {
      title: '约访管家',
      dataIndex: 'interviewsales_user_id',
      key: 'interviewsales_user_id',
      ellipsis: true,
      filters: getFilters('interviewsales_user_id', 'interviewsales_user_name'),
      filterSearch: true,
      filteredValue: tableColumnFilters.interviewsales_user_id ?? null,
      onCell: () => ({ style: { ...defaultCellStyle } }),
      render: (_: any, record: Followup) => record.interviewsales_user_name || record.interviewsales_user || '-',
    },
    // 客服备注
    {
      title: '客服备注',
      dataIndex: 'remark',
      key: 'remark',
      ellipsis: true,
      filters: getFilters('remark', 'remark'),
      filterSearch: true,
      onCell: () => ({ style: { ...defaultCellStyle } }),
      filteredValue: tableColumnFilters.remark ?? null,
      render: (text: string) => text ? <Tooltip title={text}><span>{text}</span></Tooltip> : '-'
    },
    // 用户画像，原位编辑
    {
      title: '用户画像',
      dataIndex: 'customerprofile',
      key: 'customerprofile',
      filters: getFilters('customerprofile', 'customerprofile'),
      onCell: () => ({ style: { ...defaultCellStyle } }),
      filteredValue: tableColumnFilters.customerprofile ?? null,
      render: (text: string, record: Followup) => (
        <Select value={text} options={customerprofileEnum} style={{ width: '100%', minWidth: 100 }} onChange={val => handleCellSave(record, 'customerprofile', val)} />
      )
    },
    // 工作地点，原位编辑
    {
      title: '工作地点',
      dataIndex: 'worklocation',
      key: 'worklocation',
      ellipsis: true,
      filters: getFilters('worklocation', 'worklocation'),
      onCell: () => ({ style: { ...defaultCellStyle } }),
      filteredValue: tableColumnFilters.worklocation ?? null,
      render: (text: string, record: Followup) => (
        <Tooltip title={text}>
          <Input value={inputCache[record.id + '-worklocation'] ?? text} onChange={e => setInputCache(cache => ({ ...cache, [record.id + '-worklocation']: e.target.value }))} onBlur={() => { const val = inputCache[record.id + '-worklocation'] ?? text; if (val !== text) { handleCellSave(record, 'worklocation', val); } else { setInputCache(cache => { const c = { ...cache }; delete c[record.id + '-worklocation']; return c; }); } }} style={{ minWidth: 120, maxWidth: 180 }} />
        </Tooltip>
      )
    },
    // 用户预算，原位编辑
    {
      title: '用户预算',
      dataIndex: 'userbudget',
      key: 'userbudget',
      ellipsis: true,
      filters: getFilters('userbudget', 'userbudget'),
      onCell: () => ({ style: { ...defaultCellStyle } }),
      filteredValue: tableColumnFilters.userbudget ?? null,
      render: (text: string, record: Followup) => (
        <Input value={inputCache[record.id + '-userbudget'] ?? text} onChange={e => setInputCache(cache => ({ ...cache, [record.id + '-userbudget']: e.target.value }))} onBlur={() => { const val = inputCache[record.id + '-userbudget'] ?? text; if (val !== text) { handleCellSave(record, 'userbudget', val); } else { setInputCache(cache => { const c = { ...cache }; delete c[record.id + '-userbudget']; return c; }); } }} style={{ minWidth: 100, maxWidth: 140 }} />
      )
    },
    // 入住日期，原位编辑
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
            <Button size="small" onClick={() => { clearFilters && clearFilters(); confirm && confirm(); }}>
              重置
            </Button>
          </div>
        </div>
      ),
      onCell: () => ({ style: { ...defaultCellStyle } }),
      filteredValue: tableColumnFilters.moveintime ?? null,
      render: (text: string, record: Followup) => (
        <DatePicker
          locale={locale}
          style={{ minWidth: 120, maxWidth: 180 }}
          placeholder="请选择入住日期"
          value={inputCache[record.id + '-moveintime'] ? dayjs(inputCache[record.id + '-moveintime']) : (text ? dayjs(text) : undefined)}
          format="YYYY-MM-DD"
          onChange={v => {
            const val = v ? v.format('YYYY-MM-DD') + ' 00:00:00' : '';
            setInputCache(cache => ({ ...cache, [record.id + '-moveintime']: val }));
            handleCellSave(record, 'moveintime', val);
          }}
        />
      )
    },
    // 来访意向，原位编辑
    {
      title: '来访意向',
      dataIndex: 'userrating',
      key: 'userrating',
      ellipsis: true,
      filters: getFilters('userrating', 'userrating'),
      onCell: () => ({ style: { ...defaultCellStyle } }),
      filteredValue: tableColumnFilters.userrating ?? null,
      render: (text: string, record: Followup) => (
        <Select
          value={text}
          options={userratingEnum}
          style={{ minWidth: 100, maxWidth: 140 }}
          onChange={val => handleCellSave(record, 'userrating', val)}
        />
      )
    },
    // 跟进结果，原位编辑
    {
      title: '跟进结果',
      dataIndex: 'majorcategory',
      key: 'majorcategory',
      ellipsis: true,
      filters: getFilters('majorcategory', 'majorcategory'),
      onCell: () => ({ style: { ...defaultCellStyle } }),
      filteredValue: tableColumnFilters.majorcategory ?? null,
      render: (text: string, record: Followup) => (
        <Tooltip title={text}>
          <Input value={inputCache[record.id + '-majorcategory'] ?? text} onChange={e => setInputCache(cache => ({ ...cache, [record.id + '-majorcategory']: e.target.value }))} onBlur={() => { const val = inputCache[record.id + '-majorcategory'] ?? text; if (val !== text) { handleCellSave(record, 'majorcategory', val); } else { setInputCache(cache => { const c = { ...cache }; delete c[record.id + '-majorcategory']; return c; }); } }} style={{ minWidth: 120, maxWidth: 180 }} />
        </Tooltip>
      )
    },
    // 跟进备注，原位编辑
    {
      title: '跟进备注',
      dataIndex: 'followupresult',
      key: 'followupresult',
      ellipsis: true,
      filters: getFilters('followupresult', 'followupresult'),
      filterSearch: true,
      onCell: () => ({ style: { ...defaultCellStyle } }),
      filteredValue: tableColumnFilters.followupresult ?? null,
      render: (text: string, record: Followup) => (
        <Tooltip title={text}>
          <Input
            value={inputCache[record.id + '-followupresult'] ?? text}
            onChange={e => setInputCache(cache => ({ ...cache, [record.id + '-followupresult']: e.target.value }))}
            onBlur={() => {
              const val = inputCache[record.id + '-followupresult'] ?? text;
              if (val !== text) {
                handleCellSave(record, 'followupresult', val);
              } else {
                setInputCache(cache => {
                  const c = { ...cache };
                  delete c[record.id + '-followupresult'];
                  return c;
                });
              }
            }}
            style={{ minWidth: 120, maxWidth: 180 }}
            placeholder="请输入跟进备注"
          />
        </Tooltip>
      )
        },
    // 预约社区，原位编辑
    {
      title: '预约社区',
      dataIndex: 'scheduledcommunity',
      key: 'scheduledcommunity',
      ellipsis: true,
      filters: getFilters('scheduledcommunity', 'scheduledcommunity'),
      onCell: () => ({ style: { ...defaultCellStyle } }),
      filteredValue: tableColumnFilters.scheduledcommunity ?? null,
      render: (text: string, record: Followup) => (
        <Tooltip title={text}>
          <Select value={text} options={communityEnum} style={{ minWidth: 120, maxWidth: 180 }} onChange={val => handleCellSave(record, 'scheduledcommunity', val)} />
        </Tooltip>
      )
    },
  ], [data, inputCache, communityEnum, followupstageEnum, customerprofileEnum, sourceEnum, userratingEnum, getFilters, tableColumnFilters]);

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
    console.log('🔄 [handleTableChange] 表格筛选变化:', {
      pagination: _pagination,
      filters,
      currentPagination: pagination,
      currentTableFilters: tableFilters
    });
    
    if (_pagination.current !== pagination.current || _pagination.pageSize !== pagination.pageSize) {
      console.log('📄 [handleTableChange] 分页变化，直接更新分页');
      setPagination(prev => ({ ...prev, current: _pagination.current, pageSize: _pagination.pageSize }));
      fetchFollowups(tableFilters, _pagination.current, _pagination.pageSize);
      return;
    }
    
    const params: any = { ...tableFilters };
    
    Object.keys(filters).forEach(key => {
      console.log(`🔍 [handleTableChange] 处理筛选字段: ${key}`, {
        filterValue: filters[key],
        currentParams: params[key]
      });
      
      if (key === 'interviewsales_user_id') {
        if (filters[key] && filters[key].length > 0) {
          const values = filters[key].map((v: any) => {
            if (v === null || v === 'null' || v === undefined || v === '') return null;
            const num = Number(v);
            return isNaN(num) ? null : num;
          });
          // 如果只包含null，传递[null]表示IS NULL条件
          if (values.length === 1 && values[0] === null) {
            params[`p_${key}`] = [null];
            console.log(`✅ [handleTableChange] 设置 ${key} 为 [null] (IS NULL条件)`);
          } else if (values.includes(null)) {
            // 如果包含null和其他值，传递所有值（后端会处理IS NULL和= ANY）
            params[`p_${key}`] = values;
            console.log(`✅ [handleTableChange] 设置 ${key} 为混合值:`, values);
          } else {
            // 只有非null值
            params[`p_${key}`] = values;
            console.log(`✅ [handleTableChange] 设置 ${key} 为非null值:`, values);
          }
        } else {
          delete params[`p_${key}`];
          console.log(`🗑️ [handleTableChange] 移除 ${key} 参数`);
        }
        return;
      }

      // 枚举字段处理
      if (['followupstage', 'customerprofile', 'source', 'scheduledcommunity', 'userrating'].includes(key)) {
        if (filters[key] && filters[key].length > 0) {
          // 如果只包含null，传递[null]表示IS NULL条件
          if (filters[key].length === 1 && filters[key][0] === null) {
            params[`p_${key}`] = [null];
            console.log(`✅ [handleTableChange] 设置枚举字段 ${key} 为 [null] (IS NULL条件)`);
          } else if (filters[key].includes(null)) {
            // 如果包含null和其他值，传递所有值
            params[`p_${key}`] = filters[key].map((v: any) => v === null ? null : String(v));
            console.log(`✅ [handleTableChange] 设置枚举字段 ${key} 为混合值:`, params[`p_${key}`]);
          } else {
            // 只有非null值
            params[`p_${key}`] = filters[key].map((v: any) => String(v));
            console.log(`✅ [handleTableChange] 设置枚举字段 ${key} 为非null值:`, params[`p_${key}`]);
          }
        } else {
          delete params[`p_${key}`];
          console.log(`🗑️ [handleTableChange] 移除枚举字段 ${key} 参数`);
        }
        return;
      }

      // 手机号和微信号处理
      if (key === 'phone' || key === 'wechat') {
        if (filters[key] && Array.isArray(filters[key]) && filters[key].length > 0) {
          // 如果只包含null，传递[null]表示IS NULL条件
          if (filters[key].length === 1 && filters[key][0] === null) {
            params[`p_${key}`] = [null];
            console.log(`✅ [handleTableChange] 设置 ${key} 为 [null] (IS NULL条件)`);
          } else if (filters[key].includes(null)) {
            // 如果包含null和其他值，传递所有值
            params[`p_${key}`] = filters[key].map((v: string | null) => 
              v === null ? null : String(v).trim()
            ).filter(v => v !== undefined);
            console.log(`✅ [handleTableChange] 设置 ${key} 为混合值:`, params[`p_${key}`]);
          } else {
            // 只有非null值
            params[`p_${key}`] = filters[key].map((v: string | null) => String(v).trim());
            console.log(`✅ [handleTableChange] 设置 ${key} 为非null值:`, params[`p_${key}`]);
          }
        } else {
          delete params[`p_${key}`];
          console.log(`🗑️ [handleTableChange] 移除 ${key} 参数`);
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
          console.log(`✅ [handleTableChange] 设置时间字段 ${key} 范围:`, {
            start: params[`p_${key}_start`],
            end: params[`p_${key}_end`]
          });
        } else {
          delete params[`p_${key}_start`];
          delete params[`p_${key}_end`];
          delete params[key];
          console.log(`🗑️ [handleTableChange] 移除时间字段 ${key} 参数`);
        }
        return;
      }

      // 多选字段处理
      if (multiSelectFields.includes(key)) {
        const paramKey = filterKeyMap[key];
        if (!paramKey) return;
        
        if (filters[key] && filters[key].length > 0) {
          // 如果只包含null，传递[null]表示IS NULL条件
          if (filters[key].length === 1 && filters[key][0] === null) {
            params[paramKey] = [null];
            console.log(`✅ [handleTableChange] 设置多选字段 ${paramKey} 为 [null] (IS NULL条件)`);
          } else if (filters[key].includes(null)) {
            // 如果包含null和其他值，传递所有值
            params[paramKey] = filters[key];
            console.log(`✅ [handleTableChange] 设置多选字段 ${paramKey} 为混合值:`, params[paramKey]);
          } else {
            // 只有非null值
            params[paramKey] = filters[key];
            console.log(`✅ [handleTableChange] 设置多选字段 ${paramKey} 为非null值:`, params[paramKey]);
          }
        } else {
          delete params[paramKey];
          console.log(`🗑️ [handleTableChange] 移除多选字段 ${paramKey} 参数`);
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
          console.log(`✅ [handleTableChange] 设置普通字段 ${paramKey} 为 [null] (IS NULL条件)`);
        } else if (filters[key].includes(null)) {
          // 如果包含null和其他值，传递所有值
          params[paramKey] = key === 'remark' ? filters[key] : filters[key];
          console.log(`✅ [handleTableChange] 设置普通字段 ${paramKey} 为混合值:`, params[paramKey]);
        } else {
          // 只有非null值
          params[paramKey] = key === 'remark' ? filters[key][0] : filters[key];
          console.log(`✅ [handleTableChange] 设置普通字段 ${paramKey} 为非null值:`, params[paramKey]);
        }
      } else {
        delete params[paramKey];
        console.log(`🗑️ [handleTableChange] 移除普通字段 ${paramKey} 参数`);
      }
    });

    // 保证分组条件始终生效
    if (groupField && selectedGroup) {
      const filterKey = 'p_' + groupField;
      if (selectedGroup === 'null') {
        params[filterKey] = [null];
        console.log(`✅ [handleTableChange] 设置分组筛选 ${filterKey} 为 [null]`);
      } else {
        params[filterKey] = [selectedGroup];
        console.log(`✅ [handleTableChange] 设置分组筛选 ${filterKey} 为 [${selectedGroup}]`);
      }
    }

    console.log('📤 [handleTableChange] 最终参数:', params);
    setTableFilters(params);
    setTableColumnFilters(filters);
    setPagination(p => ({ ...p, current: 1 }));
    fetchFollowups(params, 1, pagination.pageSize);
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
    setPagination(p => ({ ...p, current: 1 }));
    // 只刷新明细数据，不刷新分组统计
    fetchFollowups(params);
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
    setPagination(p => ({ ...p, current: 1 }));
    // 只刷新明细数据，不刷新分组统计
    fetchFollowups(newFilters, 1, pagination.pageSize);
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
    console.log('🚀 [FollowupsGroupList] 组件初始化，开始加载数据');
    console.log('🔍 [FollowupsGroupList] 当前用户信息检查...');
    
    // 检查当前用户信息
    supabase.auth.getUser().then(({ data: { user }, error }) => {
      console.log('👤 [FollowupsGroupList] 当前用户:', {
        id: user?.id,
        email: user?.email,
        error: error?.message
      });
    });
    
    // 检查用户权限
    supabase.rpc('has_permission', { resource: 'lead', action: 'manage' }).then(({ data, error }) => {
      console.log('🔑 [FollowupsGroupList] lead管理权限检查:', {
        hasPermission: data,
        error: error?.message
      });
    });
    
    // 检查用户角色
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) {
        supabase.rpc('get_user_roles', { p_user_id: user.id }).then(({ data: roles, error }) => {
          console.log('🎭 [FollowupsGroupList] 用户角色:', {
            roles,
            error: error?.message
          });
        });
      }
    });
    
    // 初始化时加载数据
    fetchFollowups();
  }, []);

  return (
    <div className="page-card">
      {/* 顶部操作区 */}
      <div className="page-header">
        <Title level={4} style={{ margin: 0, fontWeight: 700, color: '#222' }}>
          跟进记录
        </Title>
        <Space>
          <Search
            placeholder="线索编号、手机号、微信号、管家昵称等"
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
      {/* 筛选条件标签区 */}
      <div style={{ margin: '8px 0 0 0', display: 'flex', flexWrap: 'wrap', justifyContent: 'flex-start' }}>
        {/* 关键字搜索Tag */}
        {tableFilters.p_keyword && (
          <Tag
            closable
            className="filter-tag"
            onClose={() => {
              const newFilters = { ...tableFilters };
              delete newFilters.p_keyword;
              setTableFilters(newFilters);
              setKeywordSearch('');
              setPagination(p => ({ ...p, current: 1 }));
              fetchFollowups(newFilters, 1, pagination.pageSize);
            }}
            style={{ marginRight: 8, marginBottom: 8 }}
          >
            关键字: {tableFilters.p_keyword}
          </Tag>
        )}
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
                const found = data.find(item => String(item.interviewsales_user_id) === String(v));
                if (v === null || v === undefined || String(v) === 'null' || (typeof v === 'number' && isNaN(v))) {
                  displayText = '未分配';
                } else {
                  displayText = found?.interviewsales_user_name || found?.interviewsales_user || v;
                }
              } else if (key === 'p_showingsales_user_id') {
                // 从当前数据中查找对应的昵称
                const found = data.find(item => String(item.showingsales_user_id) === String(v));
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
          <div className="group-card">
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
          <Table
            columns={columns}
            dataSource={data}
            loading={loading}
            pagination={{
              current: pagination.current,
              pageSize: pagination.pageSize,
              total: pagination.total,
              showSizeChanger: true,
              showQuickJumper: true,
              showTotal: (total: number, range: [number, number]) => `第 ${range[0]}-${range[1]} 条，共 ${total} 条`,
            }}
            rowKey="id"
            size="middle"
            bordered={false}
            className="page-table"
            onChange={handleTableChange}
            scroll={{ x: 'max-content' }}
          />
        </div>
      </div>
      {/* Drawer 组件（放在 return 的最外层） */}
      <Drawer
        title="跟进阶段进度"
        placement="bottom"
        height={400}
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
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
              onFinish={async (values: any) => {
                // 1. 格式化所有日期字段为字符串
                ['moveintime', 'scheduletime'].forEach(field => {
                  if (values[field] && typeof values[field]?.format === 'function') {
                    values[field] = values[field].format('YYYY-MM-DD HH:mm:ss');
                  }
                });
                if (!currentRecord) return;
                // 2. 调用supabase update，保证数据同步到后端
                const { error } = await supabase
                  .from('followups')
                  .update(values)
                  .eq('id', currentRecord.id);
                if (!error) {
                  // 3. 只局部更新本地data，避免全表刷新
                  setData(prev =>
                    prev.map(item =>
                      item.id === currentRecord.id
                        ? { ...item, ...values }
                        : item
                    )
                  );
                  // 可选：setDrawerOpen(false); 或 message.success('保存成功');
                } else {
                  message.error('保存失败: ' + error.message);
                }
              }}
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
                    <Input placeholder="请输入丢单原因" />
                  </Form.Item>
                  <div className="mt-16">
                    <Button type="primary" className="mr-8"
                      onClick={async () => {
                        if (!currentRecord) return;
                        const values = stageForm.getFieldsValue();
                        const updateObj = { ...values, followupstage: followupStages[0] };
                        const { error } = await supabase
                          .from('followups')
                          .update(updateObj)
                          .eq('id', currentRecord.id);
                        if (!error) {
                          setData(prev => prev.map(item =>
                            item.id === currentRecord.id
                              ? { ...item, ...values, followupstage: followupStages[0] }
                              : item
                          ));
                          setDrawerOpen(false);
                          message.success('已丢单');
                        } else {
                          message.error('丢单失败: ' + error.message);
                        }
                      }}
                    >确定丢单</Button>
                    <Button
                      type="default"
                      onClick={async () => {
                        if (!currentRecord) return;
                        // 恢复到"确认需求"阶段
                        const nextStage = followupStages[2];
                        const { error } = await supabase
                          .from('followups')
                          .update({ followupstage: nextStage })
                          .eq('id', currentRecord.id);
                        if (!error) {
                          setData(prev => prev.map(item =>
                            item.id === currentRecord.id
                              ? { ...item, followupstage: nextStage }
                              : item
                          ));
                          setDrawerOpen(false);
                          message.success('已恢复至确认需求');
                        } else {
                          message.error('恢复失败: ' + error.message);
                        }
                      }}
                    >恢复</Button>
                  </div>
                </>
              ) : (
                <>
                  <div className="page-step-fields">
                    {(stageFields[currentStage as keyof typeof stageFields] || []).map((field: string) => (
                      <div key={field} className="page-step-field-item">
                        <Form.Item
                          name={field}
                          label={fieldLabelMap[field] || field}
                        >
                          {field === 'scheduledcommunity'
                            ? <Select options={communityEnum} placeholder="请选择社区" loading={communityEnum.length === 0} disabled={communityEnum.length === 0} />
                            : field === 'customerprofile'
                              ? <Select options={customerprofileEnum} placeholder="请选择用户画像" loading={customerprofileEnum.length === 0} disabled={customerprofileEnum.length === 0} />
                              : field === 'followupstage'
                                ? <Select options={followupstageEnum} placeholder="请选择阶段" loading={followupstageEnum.length === 0} disabled={followupstageEnum.length === 0} />
                                : field === 'userrating'
                                  ? <Select options={userratingEnum} placeholder="请选择来访意向" loading={userratingEnum.length === 0} disabled={userratingEnum.length === 0} />
                                : field === 'moveintime' || field === 'scheduletime'
                                  ? <DatePicker
                                      showTime
                                      locale={locale}
                                      style={{ width: '100%' }}
                                      placeholder="请选择时间"
                                      value={(() => {
                                        const v = stageForm.getFieldValue(field);
                                        if (!v || v === '' || v === null) return undefined;
                                        if (dayjs.isDayjs(v)) return v;
                                        if (typeof v === 'string') return dayjs(v);
                                        return undefined;
                                      })()}
                                      onChange={(v: any) => {
                                        stageForm.setFieldValue(field, v || undefined);
                                        setTimeout(() => stageForm.submit(), 0);
                                      }}
                                    />
                                  : <Input />}
                        </Form.Item>
                      </div>
                    ))}
                  </div>
                  <div className="mt-16">
                    <Button
                      disabled={currentStep === 0}
                      className="mr-8"
                      style={{ marginRight: 8 }}
                      onClick={async () => {
                        // 上一步前自动保存
                        try {
                          const values = await stageForm.validateFields();
                          if (!currentRecord) return;
                          const updateObj = { ...values, followupstage: followupStages[currentStep - 1] };
                          const { error } = await supabase
                            .from('followups')
                            .update(updateObj)
                            .eq('id', currentRecord.id);
                          if (!error) {
                            setData(prev => prev.map(item =>
                              item.id === currentRecord.id
                                ? { ...item, ...values, followupstage: followupStages[currentStep - 1] }
                                : item
                            ));
                            setCurrentStep(currentStep - 1);
                            setCurrentStage(followupStages[currentStep - 1]);
                          } else {
                            message.error('保存失败: ' + error.message);
                          }
                        } catch {
                          message.error('请完整填写所有必填项');
                        }
                      }}
                    >上一步</Button>
                    <Button
                      type="primary"
                      disabled={currentStep === followupStages.length - 1}
                      style={{ marginLeft: 8 }}
                      onClick={async () => {
                        // 下一步前自动保存
                        try {
                          const values = await stageForm.validateFields();
                          if (!currentRecord) return;
                          const updateObj = { ...values, followupstage: followupStages[currentStep + 1] };
                          const { error } = await supabase
                            .from('followups')
                            .update(updateObj)
                            .eq('id', currentRecord.id);
                          if (!error) {
                            setData(prev => prev.map(item =>
                              item.id === currentRecord.id
                                ? { ...item, ...values, followupstage: followupStages[currentStep + 1] }
                                : item
                            ));
                            setCurrentStep(currentStep + 1);
                            setCurrentStage(followupStages[currentStep + 1]);
                          } else {
                            message.error('保存失败: ' + error.message);
                          }
                        } catch {
                          message.error('请完整填写所有必填项');
                        }
                      }}
                    >下一步</Button>
                  </div>
                </>
              )}
            </Form>
          </div>
        </div>
      </Drawer>
    </div>
  );
};

export default FollowupsGroupList; 