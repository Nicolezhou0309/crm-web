import React, { useEffect, useState, useMemo } from 'react';
import { 
  Table, 
  Spin, 
  Typography, 
  Button, 
  Space, 
  Tag, 
  Input, 
  Modal, 
  Form, 
  message,
  Select,
  DatePicker,
  Row,
  Col,
  Card,
  InputNumber,
  Tooltip,
  Popconfirm
} from 'antd';
import { 
  PlusOutlined, 
  ReloadOutlined,
  SearchOutlined,
  FilterOutlined,
  EditOutlined,
  DeleteOutlined,
  EyeOutlined
} from '@ant-design/icons';
import LeadDetailDrawer from '../components/LeadDetailDrawer';
import { 
  getShowings, 
  getShowingsCount, 
  getCommunityOptions, 
  getViewResultOptions, 
  getSalesOptions,
  createShowing,
  updateShowing,
  deleteShowing,
  type Showing,
  type ShowingFilters
} from '../api/showingsApi';
import dayjs from 'dayjs';
import { supabase } from '../supaClient';
import type { Key } from 'react';
import type { FilterDropdownProps } from 'antd/es/table/interface';
import './compact-table.css';

const { Title } = Typography;
const { Search } = Input;
const { TextArea } = Input;
const { RangePicker } = DatePicker;

// 1. 字段类型适配
interface ShowingWithRelations {
  id: string;
  leadid: string;
  scheduletime: string | null;
  community: string | null;
  arrivaltime: string | null;
  showingsales: number | null;
  trueshowingsales: number | null;
  viewresult: string;
  budget: number;
  moveintime: string;
  remark: string;
  renttime: number;
  created_at: string;
  updated_at: string;
  showingsales_nickname?: string;
  trueshowingsales_nickname?: string;
  interviewsales_nickname?: string;
  lead_phone?: string;
  lead_wechat?: string;
  lead_source?: string;
  lead_status?: string;
  lead_type?: string;
}

// 直通/轮空卡明细类型
interface QueueCardDetail {
  id: number;
  user_id: number;
  community: string;
  queue_type: 'direct' | 'skip';
  created_at: string;
  consumed: boolean;
  consumed_at: string | null;
}

// 在顶部添加脱敏函数
const maskPhone = (phone: string) => {
  if (!phone) return '-';
  return phone.replace(/(\d{3})\d{4}(\d{4})/, '$1****$2');
};
const maskWechat = (wechat: string) => {
  if (!wechat) return '-';
  if (wechat.length < 4) return wechat;
  return wechat.substring(0, 2) + '****' + wechat.substring(wechat.length - 2);
};

const ShowingsList: React.FC = () => {
  const [data, setData] = useState<ShowingWithRelations[]>([]);
  const [loading, setLoading] = useState(false);
  const [total, setTotal] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [editingRecord, setEditingRecord] = useState<Showing | null>(null);
  const [form] = Form.useForm();
  const [filters, setFilters] = useState<ShowingFilters>({});
  const [showFilters, setShowFilters] = useState(false);
  
  // 线索详情抽屉状态
  const [detailDrawerVisible, setDetailDrawerVisible] = useState(false);
  const [selectedLeadId, setSelectedLeadId] = useState('');

  // 选项数据
  const [communityOptions, setCommunityOptions] = useState<{ value: string; label: string }[]>([]);
  const [viewResultOptions, setViewResultOptions] = useState<string[]>([]);
  const [salesOptions, setSalesOptions] = useState<{ value: number; label: string }[]>([]);

  // 统计卡片相关状态
  const [stats, setStats] = useState({
    monthShowings: 0,
    monthDeals: 0,
    conversionRate: 0,
    directCount: 0,
    skipCount: 0,
  });

  // 明细弹窗相关状态
  const [cardDetailModal, setCardDetailModal] = useState<{ visible: boolean; type: 'direct' | 'skip' | null }>({ visible: false, type: null });
  const [cardDetails, setCardDetails] = useState<QueueCardDetail[]>([]);
  const [cardDetailLoading, setCardDetailLoading] = useState(false);

  // 获取统计数据
  const fetchStats = async () => {
    const now = dayjs();
    const monthStart = now.startOf('month').toISOString();
    const monthEnd = now.endOf('month').toISOString();
    // 本月带看量
    const { count: showingsCount } = await supabase
      .from('showings')
      .select('id', { count: 'exact', head: true })
      .gte('created_at', monthStart)
      .lte('created_at', monthEnd);
    // 本月成交量（看房结果=成交）
    const { count: dealsCount } = await supabase
      .from('showings')
      .select('id', { count: 'exact', head: true })
      .gte('created_at', monthStart)
      .lte('created_at', monthEnd)
      .eq('viewresult', '成交');
    // 直通卡数量
    const { count: directCount } = await supabase
      .from('showings_queue_record')
      .select('id', { count: 'exact', head: true })
      .eq('queue_type', 'direct')
      .eq('consumed', false);
    // 轮空卡数量
    const { count: skipCount } = await supabase
      .from('showings_queue_record')
      .select('id', { count: 'exact', head: true })
      .eq('queue_type', 'skip')
      .eq('consumed', false);
    // 转化率
    const conversionRate = showingsCount && dealsCount ? (dealsCount / showingsCount) * 100 : 0;
    setStats({
      monthShowings: showingsCount || 0,
      monthDeals: dealsCount || 0,
      conversionRate: Number(conversionRate.toFixed(2)),
      directCount: directCount || 0,
      skipCount: skipCount || 0,
    });
  };

  useEffect(() => {
    fetchStats();
  }, []);

  useEffect(() => {
    fetchOptions();
    fetchData();
    fetchStats(); // 数据变动时也刷新统计
  }, [currentPage, pageSize, filters]);

  const fetchOptions = async () => {
    try {
      // 获取社区选项
      const communities = await getCommunityOptions();
      setCommunityOptions((communities as string[]).map((c: string) => ({ value: c, label: c })));

      // 获取带看结果选项
      const viewResults = await getViewResultOptions();
      setViewResultOptions(viewResults as string[]);

      // 获取销售员选项
      const sales = await getSalesOptions();
      setSalesOptions(sales.map((s: any) => ({ value: s.id, label: s.nickname })));
    } catch (error) {
      console.error('获取选项失败:', error);
    }
  };

  const fetchData = async () => {
    setLoading(true);
    try {
      const offset = (currentPage - 1) * pageSize;
      const [showings, count] = await Promise.all([
        getShowings({ 
          ...filters, 
          limit: pageSize, 
          offset,
          orderBy: 'created_at',
          ascending: false
        }),
        getShowingsCount(filters)
      ]);
      setData(showings || []);
      setTotal(count);
    } catch (error) {
      message.error('获取带看记录失败: ' + (error as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const handleAdd = async (values: any) => {
    try {
      const showingData = {
        ...values,
        scheduletime: values.scheduletime?.toISOString(),
        arrivaltime: values.arrivaltime?.toISOString(),
        moveintime: values.moveintime?.toISOString(),
      };

      if (editingRecord) {
        await updateShowing(editingRecord.id, showingData);
        message.success('更新带看记录成功！');
      } else {
        await createShowing(showingData);
        message.success('添加带看记录成功！');
      }

      setIsModalVisible(false);
      form.resetFields();
      setEditingRecord(null);
      fetchData();
    } catch (error) {
      message.error('操作失败: ' + (error as Error).message);
    }
  };

  const handleEdit = (record: Showing) => {
    setEditingRecord(record);
    form.setFieldsValue({
      ...record,
      scheduletime: record.scheduletime ? dayjs(record.scheduletime) : null,
      arrivaltime: record.arrivaltime ? dayjs(record.arrivaltime) : null,
      moveintime: record.moveintime ? dayjs(record.moveintime) : null,
    });
    setIsModalVisible(true);
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteShowing(id);
      message.success('删除带看记录成功！');
      fetchData();
    } catch (error) {
      message.error('删除失败: ' + (error as Error).message);
    }
  };

  // 4. 筛选参数适配（handleFilter）
  const handleFilter = (values: any) => {
    const newFilters: ShowingFilters = {};
    
    // 处理多选字段
    if (values.community && values.community.length > 0) {
      newFilters.community = values.community;
    }
    if (values.showingsales && values.showingsales.length > 0) {
      newFilters.showingsales = values.showingsales;
    }
    if (values.trueshowingsales && values.trueshowingsales.length > 0) {
      newFilters.trueshowingsales = values.trueshowingsales;
    }
    if (values.interviewsales && values.interviewsales.length > 0) {
      newFilters.interviewsales = values.interviewsales;
    }
    if (values.viewresult && values.viewresult.length > 0) {
      newFilters.viewresult = values.viewresult;
    }
    
    // 处理时间范围
    if (values.scheduletime_range?.length === 2) {
      newFilters.scheduletime_start = values.scheduletime_range[0].startOf('day').toISOString();
      newFilters.scheduletime_end = values.scheduletime_range[1].endOf('day').toISOString();
    }
    if (values.arrivaltime_range?.length === 2) {
      newFilters.arrivaltime_start = values.arrivaltime_range[0].startOf('day').toISOString();
      newFilters.arrivaltime_end = values.arrivaltime_range[1].endOf('day').toISOString();
    }
    if (values.moveintime_range?.length === 2) {
      newFilters.moveintime_start = values.moveintime_range[0].startOf('day').toISOString();
      newFilters.moveintime_end = values.moveintime_range[1].endOf('day').toISOString();
    }
    
    // 处理其他筛选条件
    if (values.leadid) {
      newFilters.leadid = values.leadid;
    }
    if (values.budget_min !== undefined && values.budget_min !== null) {
      newFilters.budget_min = values.budget_min;
    }
    if (values.budget_max !== undefined && values.budget_max !== null) {
      newFilters.budget_max = values.budget_max;
    }
    if (values.renttime_min !== undefined && values.renttime_min !== null) {
      newFilters.renttime_min = values.renttime_min;
    }
    if (values.renttime_max !== undefined && values.renttime_max !== null) {
      newFilters.renttime_max = values.renttime_max;
    }
    
    setFilters(newFilters);
    setCurrentPage(1);
  };

  const getViewResultColor = (result: string) => {
    const colorMap: { [key: string]: string } = {
      '满意': 'success',
      '不满意': 'error',
      '待定': 'warning',
      '成交': 'processing',
    };
    return colorMap[result] || 'default';
  };

  // 2. 表格字段适配
  const columns = useMemo(() => [
    {
      title: '线索ID',
      dataIndex: 'leadid',
      key: 'leadid',
      width: 120,
      filterDropdown: ({ setSelectedKeys, selectedKeys, confirm, clearFilters }: FilterDropdownProps) => (
        <div style={{ padding: 8 }}>
          <Input
            placeholder="搜索线索ID"
            value={selectedKeys[0]}
            onChange={e => setSelectedKeys(e.target.value ? [e.target.value] : [])}
            onPressEnter={() => confirm()}
            style={{ width: 188, marginBottom: 8, display: 'block' }}
          />
          <Button
            type="primary"
            onClick={() => confirm()}
            icon={<SearchOutlined />}
            size="small"
            style={{ width: 90, marginRight: 8 }}
          >
            搜索
          </Button>
          <Button onClick={() => clearFilters && clearFilters()} size="small" style={{ width: 90 }}>
            重置
          </Button>
        </div>
      ),
      onFilter: (value: boolean | Key, record: ShowingWithRelations) => !!record.leadid?.toString().includes(String(value)),
      render: (text: string) => (
        <Tooltip title="点击查看线索详情">
          <Button 
            type="link" 
            size="small" 
            onClick={() => {
              setSelectedLeadId(text);
              setDetailDrawerVisible(true);
            }}
          >
            {text}
          </Button>
        </Tooltip>
      ),
    },
    {
      title: '客户手机号',
      dataIndex: 'lead_phone',
      key: 'lead_phone',
      width: 130,
      filterDropdown: ({ setSelectedKeys, selectedKeys, confirm, clearFilters }: FilterDropdownProps) => (
        <div style={{ padding: 8 }}>
          <Input
            placeholder="搜索手机号"
            value={selectedKeys[0]}
            onChange={e => setSelectedKeys(e.target.value ? [e.target.value] : [])}
            onPressEnter={() => confirm()}
            style={{ width: 188, marginBottom: 8, display: 'block' }}
          />
          <Button
            type="primary"
            onClick={() => confirm()}
            icon={<SearchOutlined />}
            size="small"
            style={{ width: 90, marginRight: 8 }}
          >
            搜索
          </Button>
          <Button onClick={() => clearFilters && clearFilters()} size="small" style={{ width: 90 }}>
            重置
          </Button>
        </div>
      ),
      onFilter: (value: boolean | Key, record: ShowingWithRelations) => !!record.lead_phone?.toString().includes(String(value)),
      render: (text: string) => maskPhone(text),
    },
    {
      title: '客户微信',
      dataIndex: 'lead_wechat',
      key: 'lead_wechat',
      width: 130,
      filterDropdown: ({ setSelectedKeys, selectedKeys, confirm, clearFilters }: FilterDropdownProps) => (
        <div style={{ padding: 8 }}>
          <Input
            placeholder="搜索微信号"
            value={selectedKeys[0]}
            onChange={e => setSelectedKeys(e.target.value ? [e.target.value] : [])}
            onPressEnter={() => confirm()}
            style={{ width: 188, marginBottom: 8, display: 'block' }}
          />
          <Button
            type="primary"
            onClick={() => confirm()}
            icon={<SearchOutlined />}
            size="small"
            style={{ width: 90, marginRight: 8 }}
          >
            搜索
          </Button>
          <Button onClick={() => clearFilters && clearFilters()} size="small" style={{ width: 90 }}>
            重置
          </Button>
        </div>
      ),
      onFilter: (value: boolean | Key, record: ShowingWithRelations) => !!record.lead_wechat?.toString().includes(String(value)),
      render: (text: string) => maskWechat(text),
    },
    {
      title: '社区',
      dataIndex: 'community',
      key: 'community',
      filters: communityOptions.map(opt => ({ text: opt.label, value: opt.value })),
      onFilter: (value: boolean | Key, record: ShowingWithRelations) => record.community === value,
      width: 120,
      render: (text: string) => text || '-',
    },
    {
      title: '预约时间',
      dataIndex: 'scheduletime',
      key: 'scheduletime',
      width: 150,
      filterDropdown: ({ setSelectedKeys, selectedKeys, confirm, clearFilters }: FilterDropdownProps) => (
        <div style={{ padding: 8, minWidth: 200, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
          <RangePicker
            showTime
            value={(selectedKeys[0] as unknown as [dayjs.Dayjs, dayjs.Dayjs]) || undefined}
            onChange={dates => setSelectedKeys(((dates && dates.length === 2 ? [dates] : []) as unknown) as Key[])}
            style={{ width: 200, marginBottom: 8, height: 32, fontSize: 13 }}
            className="table-filter-range-picker"
            placeholder={['开始日期', '结束日期']}
            allowClear
          />
          <div style={{ display: 'flex', gap: 8 }}>
            <Button type="primary" size="small" style={{ flex: 1, height: 28, fontSize: 13 }} onClick={() => confirm()}>筛 选</Button>
            <Button size="small" style={{ flex: 1, height: 28, fontSize: 13 }} onClick={() => clearFilters && clearFilters()}>重 置</Button>
          </div>
        </div>
      ),
      onFilter: (value: boolean | Key, record: ShowingWithRelations) => {
        const dates = value as unknown as dayjs.Dayjs[];
        if (!dates || !Array.isArray(dates) || dates.length !== 2) return true;
        const [start, end] = dates;
        if (!record.scheduletime) return false;
        const t = dayjs(record.scheduletime);
        return t.isAfter(start) && t.isBefore(end);
      },
      render: (text: string) => text ? dayjs(text).format('YYYY-MM-DD HH:mm') : '-',
    },
    {
      title: '到达时间',
      dataIndex: 'arrivaltime',
      key: 'arrivaltime',
      width: 150,
      filterDropdown: ({ setSelectedKeys, selectedKeys, confirm, clearFilters }: FilterDropdownProps) => (
        <div style={{ padding: 8, minWidth: 200 }}>
          <RangePicker
            showTime
            value={(selectedKeys[0] as unknown as [dayjs.Dayjs, dayjs.Dayjs]) || undefined}
            onChange={dates => setSelectedKeys(((dates && dates.length === 2 ? [dates] : []) as unknown) as Key[])}
            style={{ width: 200, marginBottom: 8, height: 32, fontSize: 13 }}
            className="table-filter-range-picker"
            placeholder={['开始日期', '结束日期']}
            allowClear
          />
          <div style={{ display: 'flex', gap: 8 }}>
            <Button type="primary" size="small" style={{ flex: 1, height: 28, fontSize: 13 }} onClick={() => confirm()}>筛 选</Button>
            <Button size="small" style={{ flex: 1, height: 28, fontSize: 13 }} onClick={() => clearFilters && clearFilters()}>重 置</Button>
          </div>
        </div>
      ),
      onFilter: (value: boolean | Key, record: ShowingWithRelations) => {
        const dates = value as unknown as dayjs.Dayjs[];
        if (!dates || !Array.isArray(dates) || dates.length !== 2) return true;
        const [start, end] = dates;
        if (!record.arrivaltime) return false;
        const t = dayjs(record.arrivaltime);
        return t.isAfter(start) && t.isBefore(end);
      },
      render: (text: string) => text ? dayjs(text).format('YYYY-MM-DD HH:mm') : '-',
    },
    {
      title: '约访销售',
      dataIndex: 'interviewsales_nickname',
      key: 'interviewsales',
      width: 120,
      render: (text: string) => text || '-',
    },
    {
      title: '带看销售',
      dataIndex: 'showingsales_nickname',
      key: 'showingsales',
      filters: salesOptions.map(opt => ({ text: opt.label, value: opt.label })),
      onFilter: (value: boolean | Key, record: ShowingWithRelations) => record.showingsales_nickname === value,
      width: 120,
      render: (text: string) => text || '-',
    },
    {
      title: '实际销售',
      dataIndex: 'trueshowingsales_nickname',
      key: 'trueshowingsales',
      width: 120,
      render: (text: string) => text || '-',
    },
    {
      title: '看房结果',
      dataIndex: 'viewresult',
      key: 'viewresult',
      filters: viewResultOptions.map(opt => ({ text: opt, value: opt })),
      onFilter: (value: boolean | Key, record: ShowingWithRelations) => record.viewresult === value,
      width: 100,
      render: (text: string) => (
        <Tag color={getViewResultColor(text)}>{text}</Tag>
      ),
    },
    {
      title: '预算',
      dataIndex: 'budget',
      key: 'budget',
      width: 100,
      filterDropdown: ({ setSelectedKeys, selectedKeys, confirm, clearFilters }: FilterDropdownProps) => {
        const [min, max] = (selectedKeys[0] as unknown as [number, number]) || [undefined, undefined];
        return (
          <div style={{ padding: 8 }}>
            <InputNumber
              placeholder="最小值"
              value={min}
              onChange={val => setSelectedKeys(((val !== undefined && max !== undefined) ? [[val, max]] : [[val, undefined]]) as unknown as Key[])}
              style={{ width: 90, marginBottom: 8, display: 'inline-block', marginRight: 8 }}
            />
            <InputNumber
              placeholder="最大值"
              value={max}
              onChange={val => setSelectedKeys(((min !== undefined && val !== undefined) ? [[min, val]] : [[undefined, val]]) as unknown as Key[])}
              style={{ width: 90, marginBottom: 8, display: 'inline-block' }}
            />
            <div style={{ marginTop: 8 }}>
              <Button type="primary" onClick={() => confirm()} size="small" style={{ width: 90, marginRight: 8 }}>筛选</Button>
              <Button onClick={() => clearFilters && clearFilters()} size="small" style={{ width: 90 }}>重置</Button>
            </div>
          </div>
        );
      },
      onFilter: (value: boolean | Key, record: ShowingWithRelations) => {
        const [min, max] = (value as unknown as [number, number]) || [undefined, undefined];
        if (min !== undefined && max !== undefined) {
          return record.budget >= min && record.budget <= max;
        } else if (min !== undefined) {
          return record.budget >= min;
        } else if (max !== undefined) {
          return record.budget <= max;
        }
        return true;
      },
      render: (text: number | null) => (typeof text === 'number' ? `¥${text.toLocaleString()}` : '-'),
    },
    {
      title: '入住时间',
      dataIndex: 'moveintime',
      key: 'moveintime',
      width: 150,
      filterDropdown: ({ setSelectedKeys, selectedKeys, confirm, clearFilters }: FilterDropdownProps) => (
        <div style={{ padding: 8, minWidth: 200 }}>
          <RangePicker
            value={(selectedKeys[0] as unknown as [dayjs.Dayjs, dayjs.Dayjs]) || undefined}
            onChange={dates => setSelectedKeys(((dates && dates.length === 2 ? [dates] : []) as unknown) as Key[])}
            style={{ width: 200, marginBottom: 8, height: 32, fontSize: 13 }}
            className="table-filter-range-picker"
            placeholder={['开始日期', '结束日期']}
            allowClear
          />
          <div style={{ display: 'flex', gap: 8 }}>
            <Button type="primary" size="small" style={{ flex: 1, height: 28, fontSize: 13 }} onClick={() => confirm()}>筛 选</Button>
            <Button size="small" style={{ flex: 1, height: 28, fontSize: 13 }} onClick={() => clearFilters && clearFilters()}>重 置</Button>
          </div>
        </div>
      ),
      onFilter: (value: boolean | Key, record: ShowingWithRelations) => {
        const dates = value as unknown as dayjs.Dayjs[];
        if (!dates || !Array.isArray(dates) || dates.length !== 2) return true;
        const [start, end] = dates;
        if (!record.moveintime) return false;
        const t = dayjs(record.moveintime);
        return t.isAfter(start) && t.isBefore(end);
      },
      render: (text: string) => text ? dayjs(text).format('YYYY-MM-DD') : '-',
    },
    {
      title: '租期(月)',
      dataIndex: 'renttime',
      key: 'renttime',
      width: 100,
      filterDropdown: ({ setSelectedKeys, selectedKeys, confirm, clearFilters }: FilterDropdownProps) => {
        const [min, max] = (selectedKeys[0] as unknown as [number, number]) || [undefined, undefined];
        return (
          <div style={{ padding: 8 }}>
            <InputNumber
              placeholder="最小值"
              value={min}
              onChange={val => setSelectedKeys(((val !== undefined && max !== undefined) ? [[val, max]] : [[val, undefined]]) as unknown as Key[])}
              style={{ width: 90, marginBottom: 8, display: 'inline-block', marginRight: 8 }}
            />
            <InputNumber
              placeholder="最大值"
              value={max}
              onChange={val => setSelectedKeys(((min !== undefined && val !== undefined) ? [[min, val]] : [[undefined, val]]) as unknown as Key[])}
              style={{ width: 90, marginBottom: 8, display: 'inline-block' }}
            />
            <div style={{ marginTop: 8 }}>
              <Button type="primary" onClick={() => confirm()} size="small" style={{ width: 90, marginRight: 8 }}>筛选</Button>
              <Button onClick={() => clearFilters && clearFilters()} size="small" style={{ width: 90 }}>重置</Button>
            </div>
          </div>
        );
      },
      onFilter: (value: boolean | Key, record: ShowingWithRelations) => {
        const [min, max] = (value as unknown as [number, number]) || [undefined, undefined];
        if (min !== undefined && max !== undefined) {
          return record.renttime >= min && record.renttime <= max;
        } else if (min !== undefined) {
          return record.renttime >= min;
        } else if (max !== undefined) {
          return record.renttime <= max;
        }
        return true;
      },
      render: (text: number | null) => (typeof text === 'number' ? `${text}个月` : '-'),
    },
    {
      title: '备注',
      dataIndex: 'remark',
      key: 'remark',
      width: 200,
      ellipsis: true,
      render: (text: string) => (
        <Tooltip title={text}>
          <span>{text}</span>
        </Tooltip>
      ),
    },
    {
      title: '创建时间',
      dataIndex: 'created_at',
      key: 'created_at',
      width: 150,
      render: (text: string) => dayjs(text).format('YYYY-MM-DD HH:mm'),
    },
    {
      title: '操作',
      key: 'action',
      width: 120,
      render: (_: any, record: ShowingWithRelations) => (
        <Space size="small">
          <Button 
            type="link" 
            size="small" 
            icon={<EditOutlined />}
            onClick={() => handleEdit(record)}
          >
            编辑
          </Button>
          <Popconfirm
            title="确定要删除这条带看记录吗？"
            onConfirm={() => handleDelete(record.id)}
            okText="确定"
            cancelText="取消"
          >
            <Button 
              type="link" 
              size="small" 
              danger 
              icon={<DeleteOutlined />}
            >
              删除
            </Button>
          </Popconfirm>
        </Space>
      ),
    },
  ], [communityOptions, salesOptions, viewResultOptions]);

  // 拉取卡片明细
  const fetchCardDetails = async (type: 'direct' | 'skip') => {
    setCardDetailLoading(true);
    const { data, error } = await supabase
      .from('showings_queue_record')
      .select('*')
      .eq('queue_type', type)
      .order('created_at', { ascending: false });
    setCardDetails(data || []);
    setCardDetailLoading(false);
  };

  // 卡片点击事件
  const handleCardClick = (type: 'direct' | 'skip') => {
    setCardDetailModal({ visible: true, type });
    fetchCardDetails(type);
  };

  // 统计卡片区
  const statsCards = (
    <Row gutter={16} style={{ marginBottom: 16 }}>
      <Col span={4}>
        <Card bordered={false} style={{ textAlign: 'left' }}>
          <div style={{ fontSize: 14, color: '#888' }}>本月带看量</div>
          <div style={{ fontSize: 24, fontWeight: 700 }}>{stats.monthShowings}</div>
        </Card>
      </Col>
      <Col span={4}>
        <Card bordered={false} style={{ textAlign: 'left' }}>
          <div style={{ fontSize: 14, color: '#888' }}>本月成交量</div>
          <div style={{ fontSize: 24, fontWeight: 700 }}>{stats.monthDeals}</div>
        </Card>
      </Col>
      <Col span={4}>
        <Card bordered={false} style={{ textAlign: 'left' }}>
          <div style={{ fontSize: 14, color: '#888' }}>带看转化率</div>
          <div style={{ fontSize: 24, fontWeight: 700 }}>{stats.conversionRate}%</div>
        </Card>
      </Col>
      <Col span={4}>
        <Card bordered={false} style={{ textAlign: 'left', cursor: 'pointer' }} onClick={() => handleCardClick('direct')}>
          <div style={{ fontSize: 14, color: '#888' }}>直通卡数量</div>
          <div style={{ fontSize: 24, fontWeight: 700 }}>{stats.directCount}</div>
        </Card>
      </Col>
      <Col span={4}>
        <Card bordered={false} style={{ textAlign: 'left', cursor: 'pointer' }} onClick={() => handleCardClick('skip')}>
          <div style={{ fontSize: 14, color: '#888' }}>轮空卡数量</div>
          <div style={{ fontSize: 24, fontWeight: 700 }}>{stats.skipCount}</div>
        </Card>
      </Col>
      <Col span={4}>
        <Card bordered={false} style={{ textAlign: 'left' }}>
          <div style={{ fontSize: 14, color: '#888' }}>工单未填写数量</div>
          <div style={{ fontSize: 24, fontWeight: 700, color: '#ff4d4f' }}>0</div>
        </Card>
      </Col>
    </Row>
  );

  return (
    <div style={{ padding: '24px' }}>
      {statsCards}
      {/* 移除按钮区，原本在这里：
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <Space>
          <Button ...>筛选</Button>
          <Button ...>新增带看记录</Button>
          <Button ...>刷新</Button>
        </Space>
      </div>
      */}

      <Table
        columns={columns}
        dataSource={data}
        rowKey="id"
        loading={loading}
        pagination={{
          current: currentPage,
          pageSize: pageSize,
          total: total,
          showSizeChanger: true,
          showQuickJumper: true,
          showTotal: (total, range) => `第 ${range[0]}-${range[1]} 条，共 ${total} 条`,
          onChange: (page, size) => {
            setCurrentPage(page);
            setPageSize(size);
          },
        }}
        scroll={{ x: 1500 }}
        size="small"
        className="compact-table"
        rowClassName={() => 'compact-table-row'}
      />

      <Modal
        title={editingRecord ? '编辑带看记录' : '新增带看记录'}
        open={isModalVisible}
        onCancel={() => {
          setIsModalVisible(false);
          setEditingRecord(null);
          form.resetFields();
        }}
        footer={null}
        width={800}
      >
        <Form
          form={form}
          layout="vertical"
          onFinish={handleAdd}
        >
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                label="线索ID"
                name="leadid"
                rules={[{ required: true, message: '请输入线索ID' }]}
              >
                <Input placeholder="请输入线索ID" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                label="社区"
                name="community"
              >
                <Select placeholder="请选择社区" allowClear>
                  {communityOptions.map(option => (
                    <Select.Option key={option.value} value={option.value}>
                      {option.label}
                    </Select.Option>
                  ))}
                </Select>
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                label="预约时间"
                name="scheduletime"
              >
                <DatePicker 
                  showTime 
                  placeholder="请选择预约时间"
                  style={{ width: '100%' }}
                />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                label="到达时间"
                name="arrivaltime"
              >
                <DatePicker 
                  showTime 
                  placeholder="请选择到达时间"
                  style={{ width: '100%' }}
                />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                label="约访销售"
                name="interviewsales"
              >
                <Select placeholder="请选择约访销售" allowClear>
                  {salesOptions.map(option => (
                    <Select.Option key={option.value} value={option.value}>
                      {option.label}
                    </Select.Option>
                  ))}
                </Select>
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                label="带看销售"
                name="showingsales"
              >
                <Select placeholder="请选择带看销售" allowClear>
                  {salesOptions.map(option => (
                    <Select.Option key={option.value} value={option.value}>
                      {option.label}
                    </Select.Option>
                  ))}
                </Select>
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                label="实际销售"
                name="trueshowingsales"
              >
                <Select placeholder="请选择实际销售" allowClear>
                  {salesOptions.map(option => (
                    <Select.Option key={option.value} value={option.value}>
                      {option.label}
                    </Select.Option>
                  ))}
                </Select>
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                label="看房结果"
                name="viewresult"
                rules={[{ required: true, message: '请选择看房结果' }]}
              >
                <Select placeholder="请选择看房结果">
                  {viewResultOptions.map(option => (
                    <Select.Option key={option} value={option}>
                      {option}
                    </Select.Option>
                  ))}
                </Select>
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                label="预算"
                name="budget"
                rules={[{ required: true, message: '请输入预算' }]}
              >
                <InputNumber 
                  placeholder="请输入预算" 
                  style={{ width: '100%' }}
                  formatter={value => `¥ ${value}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
                  parser={value => value!.replace(/\¥\s?|(,*)/g, '')}
                />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                label="入住时间"
                name="moveintime"
                rules={[{ required: true, message: '请选择入住时间' }]}
              >
                <DatePicker 
                  placeholder="请选择入住时间"
                  style={{ width: '100%' }}
                />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                label="租期(月)"
                name="renttime"
                rules={[{ required: true, message: '请输入租期' }]}
              >
                <InputNumber 
                  placeholder="请输入租期" 
                  style={{ width: '100%' }}
                  min={1}
                />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                label="备注"
                name="remark"
                rules={[{ required: true, message: '请输入备注' }]}
              >
                <TextArea rows={4} placeholder="请输入备注" />
              </Form.Item>
            </Col>
          </Row>
          <Form.Item>
            <Space>
              <Button type="primary" htmlType="submit">
                {editingRecord ? '更新' : '创建'}
              </Button>
              <Button onClick={() => {
                setIsModalVisible(false);
                setEditingRecord(null);
                form.resetFields();
              }}>
                取消
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>
      
      {/* 线索详情抽屉 */}
      <LeadDetailDrawer
        visible={detailDrawerVisible}
        leadid={selectedLeadId}
        onClose={() => {
          setDetailDrawerVisible(false);
          setSelectedLeadId('');
        }}
      />

      {/* 直通/轮空卡明细弹窗 */}
      <Modal
        title={cardDetailModal.type === 'direct' ? '直通卡明细' : cardDetailModal.type === 'skip' ? '轮空卡明细' : ''}
        open={cardDetailModal.visible}
        onCancel={() => setCardDetailModal({ visible: false, type: null })}
        footer={null}
        width={800}
      >
        <Table
          dataSource={cardDetails}
          loading={cardDetailLoading}
          rowKey="id"
          size="small"
          columns={[
            { title: '用户ID', dataIndex: 'user_id', width: 100 },
            { title: '社区', dataIndex: 'community', width: 120 },
            { title: '创建时间', dataIndex: 'created_at', width: 180, render: (v: string) => v ? dayjs(v).format('YYYY-MM-DD HH:mm:ss') : '-' },
            { title: '已消耗', dataIndex: 'consumed', width: 80, render: (v: boolean) => v ? '是' : '否' },
            { title: '消耗时间', dataIndex: 'consumed_at', width: 180, render: (v: string | null) => v ? dayjs(v).format('YYYY-MM-DD HH:mm:ss') : '-' },
          ]}
          pagination={{ pageSize: 10 }}
        />
      </Modal>
    </div>
  );
};

export default ShowingsList; 