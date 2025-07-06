import React, { useEffect, useState, useMemo, useRef, useCallback } from 'react';
import { Table, Spin, Typography, Button, Space, Tag, Input, Form, message, Select, DatePicker, Drawer, Steps, Tooltip, ConfigProvider } from 'antd';
import { EditOutlined, SaveOutlined, CloseOutlined, ReloadOutlined, CopyOutlined } from '@ant-design/icons';
import { supabase, fetchEnumValues } from '../../supaClient';
import type { Key } from 'react';
import type { FilterDropdownProps } from 'antd/es/table/interface';
import dayjs from 'dayjs';
import locale from 'antd/es/date-picker/locale/zh_CN';
import zhCN from 'antd/locale/zh_CN';
// @ts-expect-error
import confetti from 'canvas-confetti';

const { Title, Paragraph } = Typography;
const { Search } = Input;
const { RangePicker } = DatePicker;

interface Followup {
  id: string;
  leadid: string;
  created_at: string;
  source: string;
  leadtype: string;
  interviewsales: string;
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
  showingsales: string;
  phone: string;
  wechat: string;
  remark: string;
}

const FollowupsList: React.FC = () => {
  const [data, setData] = useState<Followup[]>([]);
  const [loading, setLoading] = useState(false);
  const [editingKey, setEditingKey] = useState<string>('');
  const [] = Form.useForm();
  const [, setSearchText] = useState('');

  // 日期范围筛选状态
  const [] = useState<[string, string] | null>(null);
  const [] = useState<[string, string] | null>(null);

  // 新增：原位编辑状态
  const [editingCell] = useState<{rowId: string, dataIndex: string} | null>(null);
  const [cellValue] = useState<any>(null);

  // 新增：本地输入状态
  const [inputCache, setInputCache] = useState<{ [key: string]: string }>({});

  // 新增：Drawer相关state和form
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [currentStage, setCurrentStage] = useState('');
  const [currentRecord, setCurrentRecord] = useState<Followup | null>(null);
  const [stageForm] = Form.useForm();
  const [currentStep, setCurrentStep] = useState(0);

  const [communityEnum, setCommunityEnum] = useState<{ label: string; value: string }[]>([]);
  const [followupstageEnum, setFollowupstageEnum] = useState<{ label: string; value: string }[]>([]);
  const [customerprofileEnum, setCustomerprofileEnum] = useState<{ label: string; value: string }[]>([]);
  const [sourceEnum, setSourceEnum] = useState<{ label: string; value: string }[]>([]);
  const [userratingEnum, setUserratingEnum] = useState<{ label: string; value: string }[]>([]);

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
    '已到店': ['showingsales'],
    '赢单': []
  };

  // 枚举字段配置

  // 字段label中英文映射
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
    showingsales: '带看管家',
    followupstage: '跟进阶段',
  };

  const winAnimationPlayed = useRef(false);

  // 1. 新增筛选条件state
  const [tableFilters, setTableFilters] = useState<any>({});

  // 时间字段列表

  // 字段到filter_followups参数名映射
  const filterKeyMap: Record<string, string> = {
    leadid: 'p_leadid',
    leadtype: 'p_leadtype',
    interviewsales: 'p_interviewsales',
    followupstage: 'p_followupstage',
    customerprofile: 'p_customerprofile',
    worklocation: 'p_worklocation',
    userbudget: 'p_userbudget',
    userrating: 'p_userrating',
    majorcategory: 'p_majorcategory',
    subcategory: 'p_subcategory',
    followupresult: 'p_followupresult',
    scheduledcommunity: 'p_scheduledcommunity',
    showingsales: 'p_showingsales',
    wechat: 'p_wechat',
    source: 'p_source',
    remark: 'p_remark',
  };

  const multiSelectFields = [
    'leadid', 'leadtype', 'interviewsales', 'followupstage', 'customerprofile', 'worklocation', 'userbudget',
    'userrating', 'majorcategory', 'subcategory', 'followupresult', 'showingsales', 'wechat', 'source'
  ];

  useEffect(() => {
    fetchFollowups();
    // 获取社区枚举（直接用后端返回的文本）
    fetchEnumValues('community').then(arr => {
      setCommunityEnum(arr.map(v => ({ value: v, label: v })));
    });
    // 获取阶段枚举（直接用后端返回的文本）
    fetchEnumValues('followupstage').then(arr => {
      setFollowupstageEnum(arr.map(v => ({ value: v, label: v })));
    });
    // 获取用户画像枚举（直接用后端返回的文本）
    fetchEnumValues('customerprofile').then(arr => {
      setCustomerprofileEnum(arr.map(v => ({ value: v, label: v })));
    });
    // 获取来源枚举（直接用后端返回的文本）
    fetchEnumValues('source').then(arr => {
      setSourceEnum(arr.map(v => ({ value: v, label: v })));
    });
    // 获取来访意向枚举
    fetchEnumValues('userrating').then(arr => {
      setUserratingEnum(arr.map(v => ({ value: v, label: v })));
    });
  }, []);

  useEffect(() => {
    // 切换到赢单阶段时触发庆祝动画
    if (currentStage === '赢单' && !winAnimationPlayed.current) {
      winAnimationPlayed.current = true;
      setTimeout(() => {
        confetti({
          particleCount: 120,
          spread: 90,
          origin: { y: 0.6 },
        });
      }, 300);
    }
    if (currentStage !== '赢单') {
      winAnimationPlayed.current = false;
    }
  }, [currentStage]);

  const allowedParams = [
    'p_leadid','p_leadtype','p_interviewsales','p_followupstage','p_customerprofile','p_worklocation','p_userbudget',
    'p_moveintime_start','p_moveintime_end','p_userrating','p_majorcategory','p_subcategory','p_followupresult',
    'p_scheduletime_start','p_scheduletime_end','p_showingsales',
    'p_scheduledcommunity','p_keyword','p_wechat','p_source','p_remark',
    'p_created_at_start', 'p_created_at_end',
  ];

  const fetchFollowups = useCallback(async (filters: Record<string, unknown> = {}) => {
    setLoading(true);
    try {
      // 处理所有日期范围参数
      const patchDateRange = (range: string[] | undefined) => {
        if (!range || range.length !== 2) return [null, null];
        return [
          dayjs(range[0]).tz('Asia/Shanghai').startOf('day').toISOString(),
          dayjs(range[1]).tz('Asia/Shanghai').endOf('day').toISOString(),
        ];
      };
      const [lastfollowuptime_start, lastfollowuptime_end] = patchDateRange(filters.lastfollowuptime as string[] | undefined);
      // 构造参数对象，只保留函数定义的参数
      const allParams = {
        ...filters,
        p_lastfollowuptime_start: lastfollowuptime_start,
        p_lastfollowuptime_end: lastfollowuptime_end,
      };
      const params: Record<string, unknown> = Object.fromEntries(
        Object.entries(allParams).filter(([key]) => allowedParams.includes(key))
      );
      const res = await supabase.rpc('filter_followups', params);
      const data = res.data || [];
      const error = res.error;
      if (error) {
        message.error('获取跟进记录失败: ' + error.message);
      } else {
        // 前端校验：只保留id非空且唯一的行
        const filtered: Followup[] = (data || []).filter((item: any): item is Followup => !!item && !!item.id);
        const unique: Followup[] = Array.from(new Map(filtered.map(i => [i.id, i])).values());
        const safeData = unique.map(item => convertDateFields(item));
        setData(safeData);
        setInputCache({});
      }
    } catch (error) {
      message.error('获取跟进记录失败');
    } finally {
      setLoading(false);
    }
  }, [allowedParams]);

  const isEditing = (record: Followup) => record.id === editingKey;
  const edit = (record: Followup) => setEditingKey(record.id);
  const cancel = () => setEditingKey('');

  const save = async (record: Followup) => {
    try {
      const { error } = await supabase
        .from('followups')
        .update(record)
        .eq('id', record.id);
      if (error) {
        message.error('保存失败: ' + error.message);
      } else {
        message.success('保存成功！');
        setEditingKey('');
        fetchFollowups();
      }
    } catch (error) {
      message.error('保存失败');
    }
  };

  // 优化：保存后延迟清除inputCache
  const handleCellSave = async (record: Followup, dataIndex: keyof Followup, value: any) => {
    let saveVal = value;
    // 空值处理：空字符串转为null
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
        // 只更新本地data，不刷新全表
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
      }
    } catch (error) {
      message.error('保存失败');
    }
  };

  // 修正 getFilters，确保唯一且无空值
  const getFilters = (key: keyof Followup) => {
    const arr = Array.from(new Set(data.map(item => item[key]))).filter(val => !!val && val !== '');
    if (key === 'wechat') console.log('微信号筛选项:', arr);
    return arr.map(val => ({ text: val, value: val }));
  };

  const columns = useMemo(() => [
    // 线索编号，唯一标识，带复制功能，左侧冻结
    {
      title: '线索编号',
      dataIndex: 'leadid',
      key: 'leadid',
      fixed: 'left' as const,
      ellipsis: true,
      filters: getFilters('leadid'),
      filterSearch: true,
      onCell: () => ({ style: { minWidth: 120, maxWidth: 180, paddingLeft: 12, paddingRight: 12, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' } }),
      render: (text: string) => text ? (
        <Tooltip title={text}>
          <Paragraph copyable={{ text, tooltips: ['复制', '已复制'], icon: <CopyOutlined style={{ color: '#1677ff' }} /> }} style={{ margin: 0, color: '#1677ff', fontWeight: 600, display: 'inline-block', whiteSpace: 'nowrap' }}>{text}</Paragraph>
        </Tooltip>
      ) : <span style={{ color: '#bbb' }}>-</span>
    },
    // 跟进阶段，按钮渲染，颜色区分不同阶段，左侧冻结
    {
      title: '阶段',
      dataIndex: 'followupstage',
      key: 'followupstage',
      fixed: 'left' as const,
      ellipsis: true,
      thStyle: { paddingRight: 60 },
      filters: getFilters('followupstage'),
      onCell: () => ({
        style: {
          minWidth: 100,
          paddingLeft: 12,
          paddingRight: 12,
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          position: 'relative' as const
        }
      }),
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
            onMouseOver={e => { (e.currentTarget as HTMLButtonElement).style.background = color; (e.currentTarget as HTMLButtonElement).style.borderColor = color; (e.currentTarget as HTMLButtonElement).style.color = '#fff'; }}
            onMouseDown={e => { (e.currentTarget as HTMLButtonElement).style.background = color; (e.currentTarget as HTMLButtonElement).style.borderColor = color; (e.currentTarget as HTMLButtonElement).style.color = '#fff'; }}
            onFocus={e => { (e.currentTarget as HTMLButtonElement).style.background = color; (e.currentTarget as HTMLButtonElement).style.borderColor = color; (e.currentTarget as HTMLButtonElement).style.color = '#fff'; }}
            onClick={async () => { const isPending = (item?.label || text) === '待接收'; if (isPending) { const nextStage = followupstageEnum.find(i => i.label === '确认需求')?.value || ''; if (!nextStage) return; const { error } = await supabase.from('followups').update({ followupstage: nextStage }).eq('id', record.id); if (!error) { setData(prev => prev.map(item => item.id === record.id ? { ...item, followupstage: nextStage } : item)); message.success('已接收，阶段已推进到"确认需求"'); } } else { setCurrentStage(text || '待接收'); setCurrentStep(followupStages.indexOf(text || '待接收')); setCurrentRecord(record); setDrawerOpen(true); stageForm.setFieldsValue(convertDateFields(record)); } }}
          >{item?.label || text}</Button>
        );
      }
    },
    // 手机号，带复制功能
    {
      title: '手机号',
      dataIndex: 'phone',
      key: 'phone',
      ellipsis: true,
      filters: getFilters('phone'),
      filterMultiple: false,
      filterSearch: true,
      onCell: () => ({ style: { minWidth: 120, maxWidth: 160, paddingLeft: 12, paddingRight: 12, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' } }),
      render: (text: string) => text ? (
        <Tooltip title={text}>
          <Paragraph copyable={{ text, tooltips: ['复制', '已复制'], icon: <CopyOutlined style={{ color: '#1677ff' }} /> }} style={{ margin: 0, display: 'inline-block', whiteSpace: 'nowrap' }}>{text}</Paragraph>
        </Tooltip>
      ) : <span style={{ color: '#bbb' }}>-</span>
    },
    // 微信号，带复制功能，筛选方式与手机号完全一致
    {
      title: '微信号',
      dataIndex: 'wechat',
      key: 'wechat',
      ellipsis: true,
      filters: getFilters('wechat'),
      filterMultiple: false,
      filterSearch: true,
      onCell: () => ({ style: { minWidth: 120, maxWidth: 160, paddingLeft: 12, paddingRight: 12, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' } }),
      render: (text: string) => text ? (
        <Tooltip title={text}>
          <Paragraph copyable={{ text, tooltips: ['复制', '已复制'], icon: <CopyOutlined style={{ color: '#1677ff' }} /> }} style={{ margin: 0, display: 'inline-block', whiteSpace: 'nowrap' }}>{text}</Paragraph>
        </Tooltip>
      ) : <span style={{ color: '#bbb' }}>-</span>
    },
    // 创建日期
    {
      title: '创建日期',
      dataIndex: 'created_at',
      key: 'created_at',
      ellipsis: true,
      filterDropdown: ({ setSelectedKeys, selectedKeys, confirm, clearFilters }: FilterDropdownProps) => {
        return (
          <div style={{ padding: 8 }}>
            <RangePicker
              locale={locale}
              value={selectedKeys.length === 2 ? [dayjs(String(selectedKeys[0])), dayjs(String(selectedKeys[1]))] : undefined}
              onChange={(dates, dateStrings) => {
                if (dates) {
                  setSelectedKeys(dateStrings.filter(Boolean) as Key[]);
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
        );
      },
      onCell: () => ({ style: { minWidth: 140, maxWidth: 180, paddingLeft: 12, paddingRight: 12, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' } }),
      render: (text: string) => {
        // 只渲染字符串
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
      filters: getFilters('source'),
      filterMultiple: true,
      onCell: () => ({ style: { minWidth: 100, maxWidth: 140, paddingLeft: 12, paddingRight: 12, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' } }),
      render: (text: string) => {
        const item = sourceEnum.find(i => i.value === text);
        return <Tag color="blue">{item?.label || text}</Tag>;
      }
    },
    // 来源，枚举筛选
    {
      title: '线索来源',
      dataIndex: 'leadtype',
      key: 'leadtype',
      ellipsis: true,
      filters: getFilters('leadtype'),
      onCell: () => ({ style: { minWidth: 100, maxWidth: 140, paddingLeft: 12, paddingRight: 12, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' } }),
    },
    // 约访管家，枚举筛选
    {
      title: '约访管家',
      dataIndex: 'interviewsales',
      key: 'interviewsales',
      ellipsis: true,
      filters: getFilters('interviewsales'),
      onCell: () => ({ style: { minWidth: 100, maxWidth: 140, paddingLeft: 12, paddingRight: 12, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' } }),
    },   
     // 客服备注，长文本省略，悬浮显示全部
    {
      title: '客服备注',
      dataIndex: 'remark',
      key: 'remark',
      ellipsis: true,
      filters: getFilters('remark'),
      filterSearch: true,
      onCell: () => ({ style: { minWidth: 100, maxWidth: 260, paddingLeft: 12, paddingRight: 12, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' } }),
      render: (text: string) => text ? <Tooltip title={text}><span>{text}</span></Tooltip> : '-'
    },
    // 用户画像，枚举下拉，原位编辑
    {
      title: '用户画像',
      dataIndex: 'customerprofile',
      key: 'customerprofile',
      filters: getFilters('customerprofile'),
      onFilter: (value: boolean | Key, record: Followup) => record.customerprofile === String(value),
      onCell: () => ({ style: { minWidth: 120, paddingLeft: 12, paddingRight: 12, whiteSpace: 'nowrap', overflow: 'hidden' } }),
      render: (text: string, record: Followup) => (
        <Select value={text} options={customerprofileEnum} style={{ width: '100%', minWidth: 100 }} onChange={val => handleCellSave(record, 'customerprofile', val)} />
      )
    },
    // 工作地点，原位编辑，长文本省略
    {
      title: '工作地点',
      dataIndex: 'worklocation',
      key: 'worklocation',
      ellipsis: true,
      filters: getFilters('worklocation'),
      onCell: () => ({ style: { minWidth: 140, maxWidth: 200, paddingLeft: 12, paddingRight: 12, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' } }),
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
      filters: getFilters('userbudget'),
      onCell: () => ({ style: { minWidth: 100, maxWidth: 140, paddingLeft: 12, paddingRight: 12, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' } }),
      render: (text: string, record: Followup) => (
        <Input value={inputCache[record.id + '-userbudget'] ?? text} onChange={e => setInputCache(cache => ({ ...cache, [record.id + '-userbudget']: e.target.value }))} onBlur={() => { const val = inputCache[record.id + '-userbudget'] ?? text; if (val !== text) { handleCellSave(record, 'userbudget', val); } else { setInputCache(cache => { const c = { ...cache }; delete c[record.id + '-userbudget']; return c; }); } }} style={{ minWidth: 100, maxWidth: 140 }} />
      )
    },
    // 入住日期，无论有无内容都展示DatePicker，选择后自动补充00:00:00并保存
    {
      title: '入住日期',
      dataIndex: 'moveintime',
      key: 'moveintime',
      ellipsis: true,
      filterDropdown: ({ setSelectedKeys, selectedKeys, confirm, clearFilters }: FilterDropdownProps) => {
        return (
          <div style={{ padding: 8 }}>
            <RangePicker
              locale={locale}
              value={selectedKeys.length === 2 ? [dayjs(String(selectedKeys[0])), dayjs(String(selectedKeys[1]))] : undefined}
              onChange={(dates, dateStrings) => {
                if (dates) {
                  setSelectedKeys(dateStrings.filter(Boolean) as Key[]);
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
        );
      },
      onCell: () => ({ style: { minWidth: 120, maxWidth: 160, paddingLeft: 12, paddingRight: 12, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' } }),
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
    // 来访意向，枚举下拉，原位编辑
    {
      title: '来访意向',
      dataIndex: 'userrating',
      key: 'userrating',
      ellipsis: true,
      filters: getFilters('userrating'),
      onFilter: (value: boolean | Key, record: Followup) => record.userrating === String(value),
      onCell: () => ({ style: { minWidth: 100, maxWidth: 140, paddingLeft: 12, paddingRight: 12, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' } }),
      render: (text: string, record: Followup) => (
        <Select
          value={text}
          options={userratingEnum}
          style={{ minWidth: 100, maxWidth: 140 }}
          onChange={val => handleCellSave(record, 'userrating', val)}
        />
      )
    },
    // 跟进结果，原位编辑，长文本省略
    {
      title: '跟进结果',
      dataIndex: 'majorcategory',
      key: 'majorcategory',
      ellipsis: true,
      filters: getFilters('majorcategory'),
      onCell: () => ({ style: { minWidth: 140, maxWidth: 200, paddingLeft: 12, paddingRight: 12, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' } }),
      render: (text: string, record: Followup) => (
        <Tooltip title={text}>
          <Input value={inputCache[record.id + '-majorcategory'] ?? text} onChange={e => setInputCache(cache => ({ ...cache, [record.id + '-majorcategory']: e.target.value }))} onBlur={() => { const val = inputCache[record.id + '-majorcategory'] ?? text; if (val !== text) { handleCellSave(record, 'majorcategory', val); } else { setInputCache(cache => { const c = { ...cache }; delete c[record.id + '-majorcategory']; return c; }); } }} style={{ minWidth: 120, maxWidth: 180 }} />
        </Tooltip>
      )
    },
    // 跟进备注，原位编辑，长文本省略
    {
      title: '跟进备注',
      dataIndex: 'followupresult',
      key: 'followupresult',
      ellipsis: true,
      filters: getFilters('followupresult'),
      filterSearch: true,
      onCell: () => ({ style: { minWidth: 160, maxWidth: 260, paddingLeft: 12, paddingRight: 12, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' } }),
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
    // 预约社区，枚举下拉，原位编辑
    {
      title: '预约社区',
      dataIndex: 'scheduledcommunity',
      key: 'scheduledcommunity',
      ellipsis: true,
      filters: getFilters('scheduledcommunity'),
      onFilter: (value: boolean | Key, record: Followup) => record.scheduledcommunity === String(value),
      onCell: () => ({ style: { minWidth: 140, maxWidth: 200, paddingLeft: 12, paddingRight: 12, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' } }),
      render: (text: string, record: Followup) => (
        <Tooltip title={text}>
          <Select value={text} options={communityEnum} style={{ minWidth: 120, maxWidth: 180 }} onChange={val => handleCellSave(record, 'scheduledcommunity', val)} />
        </Tooltip>
      )
    },
    // 带看管家，原位编辑
    {
      title: '带看管家',
      dataIndex: 'showingsales',
      key: 'showingsales',
      ellipsis: true,
      filters: getFilters('showingsales'),
      onCell: () => ({ style: { minWidth: 100, maxWidth: 140, paddingLeft: 12, paddingRight: 12, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' } }),
      render: (text: string, record: Followup) => (
        <Input value={inputCache[record.id + '-showingsales'] ?? text} onChange={e => setInputCache(cache => ({ ...cache, [record.id + '-showingsales']: e.target.value }))} onBlur={() => { const val = inputCache[record.id + '-showingsales'] ?? text; if (val !== text) { handleCellSave(record, 'showingsales', val); } else { setInputCache(cache => { const c = { ...cache }; delete c[record.id + '-showingsales']; return c; }); } }} style={{ minWidth: 100, maxWidth: 140 }} />
      )
    },
    // 操作列，编辑/保存/取消，右侧冻结
    {
      title: '操作',
      key: 'action',
      fixed: 'right' as const,
      ellipsis: true,
      render: (_: any, record: Followup) => {
        const editable = isEditing(record);
        return editable ? (
          <Space size="small">
            <Button type="link" size="small" icon={<SaveOutlined />} onClick={() => save(record)}>
              保存
            </Button>
            <Button type="link" size="small" icon={<CloseOutlined />} onClick={cancel}>
              取消
            </Button>
          </Space>
        ) : (
          <Button type="link" size="small" icon={<EditOutlined />} onClick={() => edit(record)}>
            编辑
          </Button>
        );
      }
    },
  ], [data, inputCache, editingCell, cellValue, communityEnum, followupstageEnum, customerprofileEnum, sourceEnum, userratingEnum, followupStages, getFilters, isEditing, save, stageForm]);

  // 点击单元格进入编辑状态

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

  // 2. Table onChange事件处理服务端筛选
  const handleTableChange = (_pagination: any, filters: any) => {
    const params: any = { ...tableFilters };
    Object.keys(filters).forEach(key => {
      // 手机号筛选特殊处理，走p_keyword
      if (key === 'phone') {
        if (filters[key] && filters[key].length > 0) {
          params['p_keyword'] = filters[key][0];
        } else {
          params['p_keyword'] = null;
        }
        return;
      }
      // 微信号筛选精确匹配，传递给p_wechat，前端做trim
      if (key === 'wechat') {
        let val = filters[key];
        if (typeof val === 'string') val = [val];
        if (Array.isArray(val) && val.length > 0) {
          params['p_wechat'] = val.map(v => v.trim());
        } else {
          params['p_wechat'] = null;
        }
        return;
      }
      // 时间字段特殊处理
      if (key === 'moveintime' || key === 'created_at') {
        const val = filters[key] as string[];
        if (val && val.length === 2) {
          params[`p_${key}_start`] = dayjs(val[0]).tz('Asia/Shanghai').startOf('day').toISOString();
          params[`p_${key}_end`] = dayjs(val[1]).tz('Asia/Shanghai').endOf('day').toISOString();
          params[key] = val;
        } else {
          params[`p_${key}_start`] = null;
          params[`p_${key}_end`] = null;
          params[key] = null;
        }
        return;
      }
      // 多选字段，直接传数组
      if (multiSelectFields.includes(key)) {
        if (filters[key] && filters[key].length > 0) {
          params[filterKeyMap[key]] = filters[key];
        } else {
          params[filterKeyMap[key]] = null;
        }
        return;
      }
      // 普通字段，remark只传字符串
      const paramKey = filterKeyMap[key];
      if (!paramKey) return;
      if (filters[key] && filters[key].length > 0) {
        params[paramKey] = key === 'remark' ? filters[key][0] : [filters[key][0]];
      } else {
        params[paramKey] = null;
      }
      // 特殊处理 scheduledcommunity
      if (key === 'scheduledcommunity') {
        if (filters[key] && filters[key].length > 0) {
          params['p_scheduledcommunity'] = filters[key][0]; // 只传字符串
        } else {
          params['p_scheduledcommunity'] = null;
        }
        return;
      }
    });
    setTableFilters(params);
    fetchFollowups(params);
  };

  // 3. 初始化和刷新时也用tableFilters
  useEffect(() => {
    fetchFollowups(tableFilters);
  }, [tableFilters]);

  // 4. 搜索框和其它筛选也合并到tableFilters
  const handleGlobalSearch = (value: string) => {
    setSearchText(value);
    // 只用filter_followups的p_keyword参数，支持多字段模糊搜索
    const params = { ...tableFilters };
    params.p_keyword = value || null;
    // 清空单独的leadid/phone/wechat筛选，避免干扰
    delete params.leadid;
    delete params.phone;
    delete params.wechat;
    setTableFilters(params);
    fetchFollowups(params);
  };

  return (
    <ConfigProvider locale={zhCN}>
      <div className="page-card">
        <div className="page-header">
          <Title level={4} style={{ margin: 0, fontWeight: 700, color: '#222' }}>
            跟进记录
          </Title>
          <Space>
            <Search
              placeholder="搜索线索编号、手机号、微信号"
              allowClear
              onSearch={handleGlobalSearch}
              className="page-search"
            />
            <Button icon={<ReloadOutlined />} onClick={() => fetchFollowups()} className="page-btn">
              刷新
            </Button>
          </Space>
        </div>
        <div className="page-table-wrap">
          <Spin spinning={loading || communityEnum.length === 0}>
            <Table
              rowKey="id"
              columns={columns}
              dataSource={data}
              bordered
              className="page-table"
              scroll={{ x: 'max-content' }}
              pagination={{
                pageSize: 10,
                showSizeChanger: true,
                showQuickJumper: true,
                showTotal: (total, range) =>
                  `第 ${range[0]}-${range[1]} 条，共 ${total} 条`,
              }}
              onChange={handleTableChange}
            />
          </Spin>
        </div>
        <Drawer
          title="跟进阶段进度"
          placement="bottom"
          height={400}
          open={drawerOpen}
          onClose={() => setDrawerOpen(false)}
          destroyOnClose
          footer={null}
        >
          <div style={{ display: 'flex', flexDirection: 'row', gap: 32 }}>
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
                  <Paragraph copyable={{ text: currentRecord.phone, tooltips: ['复制', '已复制'], icon: <CopyOutlined style={{ color: '#1677ff' }} /> }} style={{ margin: 0, display: 'inline-block', whiteSpace: 'nowrap', maxWidth: 320 }}>{currentRecord.phone}</Paragraph>
                ) : <span className="text-muted">-</span>}
              </div>
              <div className="mb-12">
                <span className="text-secondary">微信号：</span>
                {currentRecord?.wechat ? (
                  <Paragraph copyable={{ text: currentRecord.wechat, tooltips: ['复制', '已复制'], icon: <CopyOutlined style={{ color: '#1677ff' }} /> }} style={{ margin: 0, display: 'inline-block', whiteSpace: 'nowrap', maxWidth: 320 }}>{currentRecord.wechat}</Paragraph>
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
                onChange={step => {
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
                onFinish={async (values) => {
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
                                        onChange={v => {
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
                              stageForm.setFieldsValue(convertDateFields({ ...currentRecord, ...values, followupstage: followupStages[currentStep - 1] }));
                            }
                          } catch {}
                        }}
                      >上一步</Button>
                      <Button
                        type="primary"
                        disabled={
                          communityEnum.length === 0 ||
                          followupstageEnum.length === 0 ||
                          customerprofileEnum.length === 0 ||
                          userratingEnum.length === 0
                        }
                        onClick={async () => {
                          if (!currentRecord) return;
                          const values = stageForm.getFieldsValue();
                          const nextStep = currentStep + 1;
                          if (nextStep >= followupStages.length) return;
                          const nextStage = followupStages[nextStep];
                          const updateObj = { ...values, followupstage: nextStage };
                          const { error } = await supabase
                            .from('followups')
                            .update(updateObj)
                            .eq('id', currentRecord.id);
                          if (!error) {
                            setData(prev => prev.map(item =>
                              item.id === currentRecord.id
                                ? { ...item, ...values, followupstage: nextStage }
                                : item
                            ));
                            setCurrentStep(nextStep);
                            setCurrentStage(nextStage);
                            stageForm.setFieldsValue(convertDateFields({ ...currentRecord, ...values, followupstage: nextStage }));
                          } else {
                            message.error('推进阶段失败: ' + error.message);
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
    </ConfigProvider>
  );
};

export default FollowupsList;
