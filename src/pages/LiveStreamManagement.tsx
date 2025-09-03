import React, { useState, useEffect } from 'react';
import { 
  Card, 
  Table, 
  Button, 
  Space, 
  Tag, 
  Modal, 
  Form, 
  Input, 
  InputNumber, 
  Select, 
  message,
  Tabs,
  Tooltip,
  Popconfirm,
  Slider,
  DatePicker,
  TimePicker,
  Switch,
  Divider
} from 'antd';
import { 
  PlusOutlined, 
  EditOutlined, 
  DeleteOutlined, 
  FilterOutlined,
  SettingOutlined,
  SaveOutlined
} from '@ant-design/icons';
import dayjs from 'dayjs';
import isBetween from 'dayjs/plugin/isBetween';
import { toBeijingDateStr, isBetween as dayjsIsBetween, toBeijingTime } from '../utils/timeUtils';

dayjs.extend(isBetween);
import { 
  getWeeklySchedule, 
  type LiveStreamFilterParams 
} from '../api/liveStreamApi';

import { 
  getScoringDimensions, 
  getScoringOptions,
  createScoringDimension,
  updateScoringDimension,
  deleteScoringDimension,
  createScoringOption,
  updateScoringOption,
  deleteScoringOption,
  type ScoringDimension,
  type ScoringOption
} from '../api/scoringApi';
import LiveStreamScoringDrawer from '../components/LiveStreamScoringDrawer';
import type { LiveStreamSchedule } from '../types/liveStream';
import { supabase } from '../supaClient';
import { liveStreamRegistrationService, type RegistrationConfig } from '../services/LiveStreamRegistrationService';
import UserTreeSelect from '../components/UserTreeSelect';
import './LiveStreamManagement.css';

const { TabPane } = Tabs;
const { Option } = Select;

const LiveStreamManagement: React.FC = () => {
  const [schedules, setSchedules] = useState<LiveStreamSchedule[]>([]);
  const [dimensions, setDimensions] = useState<ScoringDimension[]>([]);
  const [options, setOptions] = useState<ScoringOption[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedSchedule, setSelectedSchedule] = useState<LiveStreamSchedule | null>(null);
  const [scoringDrawerVisible, setScoringDrawerVisible] = useState(false);
  const [dimensionModalVisible, setDimensionModalVisible] = useState(false);
  const [optionModalVisible, setOptionModalVisible] = useState(false);
  const [editingDimension, setEditingDimension] = useState<ScoringDimension | null>(null);
  const [editingOption, setEditingOption] = useState<ScoringOption | null>(null);
  const [dimensionForm] = Form.useForm();
  const [optionForm] = Form.useForm();
  const [dimensionOptions, setDimensionOptions] = useState<ScoringOption[]>([]);
  
  // 筛选和分页状态
  const [filterParams, setFilterParams] = useState<LiveStreamFilterParams>({
    dateRange: {
      start: dayjs().subtract(1, 'month').format('YYYY-MM-DD'),
      end: toBeijingDateStr(dayjs())
    },
    scoreRange: {
      min: 0,
      max: 10
    },
    page: 1,
    pageSize: 10
  });
  const [total, setTotal] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  // 新增：直播设置相关状态
  const [registrationConfig, setRegistrationConfig] = useState<RegistrationConfig | null>(null);
  const [configForm] = Form.useForm();
  const [configLoading, setConfigLoading] = useState(false);
  const [configModalVisible, setConfigModalVisible] = useState(false);
  const [privilegeUserNames, setPrivilegeUserNames] = useState<string[]>([]);

  // 加载数据
  useEffect(() => {
    loadData();
    loadRegistrationConfig();
  }, [filterParams]);

  // 新增：加载报名配置
  const loadRegistrationConfig = async () => {
    try {
      // 直接查询数据库获取配置
      const { data: configs, error } = await supabase
        .from('livestream_registration_config')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(1);
      
      if (error) {
        console.error('查询配置失败:', error);
        return;
      }
      
      if (configs && configs.length > 0) {
        const config = configs[0];
        setRegistrationConfig(config);
        
        // 获取VIP主播名称
        if (config.privilege_managers && config.privilege_managers.length > 0) {
          const { data: users, error: userError } = await supabase
            .from('users_profile')
            .select('id, nickname')
            .in('id', config.privilege_managers);
          
          if (!userError && users) {
            setPrivilegeUserNames(users.map(user => user.nickname || `用户${user.id}`));
          }
        } else {
          setPrivilegeUserNames([]);
        }
      } else {
        setRegistrationConfig(null);
        setPrivilegeUserNames([]);
      }
    } catch (error) {
      console.error('加载报名配置失败:', error);
    }
  };

  const loadData = async () => {
    setLoading(true);
    
    try {
      // 使用原始的getWeeklySchedule函数，确保功能正常工作
      
      const schedulesData = await getWeeklySchedule();
      
      // 手动应用筛选逻辑
      let filteredData = schedulesData;
      
      // 应用日期范围筛选
      if (filterParams.dateRange?.start && filterParams.dateRange?.end) {
        filteredData = filteredData.filter(schedule => {
          const scheduleDate = dayjs(schedule.date);
          return scheduleDate.isBetween(
            toBeijingTime(filterParams.dateRange!.start), 
            toBeijingTime(filterParams.dateRange!.end), 
            'day', 
            '[]'
          );
        });
      }
      
      // 应用评分范围筛选
      if (filterParams.scoreRange?.min !== undefined || filterParams.scoreRange?.max !== undefined) {
        filteredData = filteredData.filter(schedule => {
          if (!schedule.average_score) return true; // 无评分的数据保留
          const score = schedule.average_score;
          const min = filterParams.scoreRange?.min ?? 0;
          const max = filterParams.scoreRange?.max ?? 10;
          return score >= min && score <= max;
        });
      }
      
      // 应用状态筛选
      if (filterParams.statuses && filterParams.statuses.length > 0) {
        filteredData = filteredData.filter(schedule => 
          filterParams.statuses!.includes(schedule.status)
        );
      }
      
      // 应用时间段筛选
      if (filterParams.timeSlots && filterParams.timeSlots.length > 0) {
        filteredData = filteredData.filter(schedule => 
          filterParams.timeSlots!.includes(schedule.timeSlotId)
        );
      }
      
      // 应用评分状态筛选
      if (filterParams.scoringStatuses && filterParams.scoringStatuses.length > 0) {
        filteredData = filteredData.filter(schedule => 
          filterParams.scoringStatuses!.includes(schedule.scoring_status || 'not_scored')
        );
      }
      
      // 应用锁定类型筛选
      if (filterParams.lockTypes && filterParams.lockTypes.length > 0) {
        filteredData = filteredData.filter(schedule => 
          filterParams.lockTypes!.includes(schedule.lockType || 'none')
        );
      }
      
      // 应用参与人员筛选
      if (filterParams.participants && filterParams.participants.length > 0) {
        filteredData = filteredData.filter(schedule => {
          return schedule.managers.some(manager => 
            filterParams.participants!.some(participant => 
              manager.name.toLowerCase().includes(participant.toLowerCase())
            )
          );
        });
      }
      
      // 分页处理
      const page = filterParams.page || 1;
      const pageSize = filterParams.pageSize || 10;
      const startIndex = (page - 1) * pageSize;
      const endIndex = startIndex + pageSize;
      const paginatedData = filteredData.slice(startIndex, endIndex);
      
      const [dimensionsData, optionsData] = await Promise.all([
        getScoringDimensions(),
        getScoringOptions()
      ]);
      
      setSchedules(paginatedData);
      setTotal(filteredData.length);
      setCurrentPage(page);
      setPageSize(pageSize);
      setDimensions(dimensionsData);
      setOptions(optionsData);
      
    
      
    } catch (error) {
      console.error('加载数据失败:', error);
      message.error('加载数据失败');
    } finally {
      setLoading(false);
    }
  };

  // 更新筛选参数
  const updateFilterParams = (newParams: Partial<LiveStreamFilterParams>) => {
    setFilterParams(prev => ({
      ...prev,
      ...newParams,
      page: 1 // 重置到第一页
    }));
  };

  // 处理分页变化
  const handleTableChange = (pagination: any) => {
    updateFilterParams({
      page: pagination.current,
      pageSize: pagination.pageSize
    });
  };

  // 打开评分抽屉
  const handleOpenScoring = (schedule: LiveStreamSchedule) => {
    setSelectedSchedule(schedule);
    setScoringDrawerVisible(true);
  };

  // 关闭评分抽屉
  const handleCloseScoring = () => {
    setScoringDrawerVisible(false);
    setSelectedSchedule(null);
  };

  // 刷新数据
  const handleRefresh = () => {
    loadData();
  };

  // 获取状态标签
  const getStatusTag = (status: string) => {
    const statusMap: { [key: string]: { color: string; text: string } } = {
      'available': { color: 'green', text: '可报名' },
      'booked': { color: 'blue', text: '已报名' },
      'completed': { color: 'orange', text: '已完成' },
      'cancelled': { color: 'red', text: '已取消' },
      'editing': { color: 'processing', text: '编辑中' },
      'locked': { color: 'red', text: '已锁定' }
    };
    const config = statusMap[status] || { color: 'default', text: status };
    return <Tag color={config.color}>{config.text}</Tag>;
  };

  // 获取评分状态标签
  const getScoringStatusTag = (schedule: LiveStreamSchedule) => {
    if (!schedule.scoring_status) {
      return <Tag color="default">未评分</Tag>;
    }
    const statusMap: { [key: string]: { color: string; text: string } } = {
      'not_scored': { color: 'default', text: '未评分' },
      'scoring_in_progress': { color: 'processing', text: '评分中' },
      'scored': { color: 'blue', text: '已评分' },
      'approved': { color: 'green', text: '已确认' }
    };
    const config = statusMap[schedule.scoring_status] || { color: 'default', text: schedule.scoring_status };
    return <Tag color={config.color}>{config.text}</Tag>;
  };

  // 表格列定义
  const columns = [
    {
      title: '日期',
      dataIndex: 'date',
      key: 'date',
      width: 120,
      render: (date: string) => dayjs(date).format('MM-DD'),
      filterDropdown: ({ setSelectedKeys, selectedKeys, confirm, clearFilters }: any) => (
        <div style={{ padding: 8 }}>
          <div style={{ marginBottom: 8 }}>
            <span>日期范围：</span>
            <DatePicker.RangePicker
              value={selectedKeys[0] ? [dayjs(selectedKeys[0][0]), dayjs(selectedKeys[0][1])] : undefined}
              onChange={(dates) => {
                if (dates && dates[0] && dates[1]) {
                  setSelectedKeys([[dates[0].format('YYYY-MM-DD'), dates[1].format('YYYY-MM-DD')]]);
                }
              }}
              style={{ width: 200, marginBottom: 8 }}
            />
          </div>
          <div style={{ marginBottom: 8 }}>
            <span>快捷选择：</span>
            <Select
              placeholder="选择快捷日期范围"
              style={{ width: 200, marginTop: 4 }}
              onChange={(value) => {
                const now = dayjs();
                let startDate, endDate;
                
                switch (value) {
                  case 'today':
                    startDate = now.format('YYYY-MM-DD');
                    endDate = now.format('YYYY-MM-DD');
                    break;
                  case 'week':
                    startDate = now.subtract(7, 'day').format('YYYY-MM-DD');
                    endDate = now.format('YYYY-MM-DD');
                    break;
                  case 'month':
                    startDate = now.subtract(1, 'month').format('YYYY-MM-DD');
                    endDate = now.format('YYYY-MM-DD');
                    break;
                  case 'quarter':
                    startDate = now.subtract(3, 'month').format('YYYY-MM-DD');
                    endDate = now.format('YYYY-MM-DD');
                    break;
                  case 'year':
                    startDate = now.subtract(1, 'year').format('YYYY-MM-DD');
                    endDate = now.format('YYYY-MM-DD');
                    break;
                  default:
                    return;
                }
                
                setSelectedKeys([[startDate, endDate]]);
              }}
            >
              <Option value="today">今天</Option>
              <Option value="week">最近一周</Option>
              <Option value="month">最近一月</Option>
              <Option value="quarter">最近三月</Option>
              <Option value="year">最近一年</Option>
            </Select>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <Button
              type="primary"
              onClick={() => confirm()}
              icon={<FilterOutlined />}
              size="small"
              style={{ flex: 1 }}
            >
              筛选
            </Button>
            <Button onClick={() => clearFilters?.()} size="small" style={{ flex: 1 }}>
              重置
            </Button>
          </div>
        </div>
      ),
      onFilter: (value: any, record: LiveStreamSchedule) => {
        if (!value || !Array.isArray(value) || value.length !== 2) return true;
        
        const recordDate = dayjs(record.date);
        const startDate = dayjs(value[0]);
        const endDate = dayjs(value[1]);
        
        return recordDate.isBetween(
          toBeijingTime(startDate),
          toBeijingTime(endDate),
          'day',
          '[]'
        );
      }
    },
    {
      title: '时间段',
      dataIndex: 'timeSlotId',
      key: 'timeSlotId',
      width: 100,
      render: (timeSlotId: string) => {
        const timeMap: { [key: string]: string } = {
          'morning-10-12': '10-12点',
          'afternoon-14-16': '14-16点',
          'afternoon-16-18': '16-18点',
          'evening-19-21': '19-21点',
          'evening-21-23': '21-23点'
        };
        return timeMap[timeSlotId] || timeSlotId;
      },
      filterDropdown: ({ setSelectedKeys, selectedKeys, confirm, clearFilters }: any) => (
        <div style={{ padding: 8 }}>
          <Select
            mode="multiple"
            placeholder="选择时间段"
            value={selectedKeys}
            onChange={(value) => setSelectedKeys(value)}
            style={{ width: 200, marginBottom: 8 }}
          >
            <Option value="morning-10-12">10-12点</Option>
            <Option value="afternoon-14-16">14-16点</Option>
            <Option value="afternoon-16-18">16-18点</Option>
            <Option value="evening-19-21">19-21点</Option>
            <Option value="evening-21-23">21-23点</Option>
          </Select>
          <div style={{ display: 'flex', gap: 8 }}>
            <Button
              type="primary"
              onClick={() => confirm()}
              icon={<FilterOutlined />}
              size="small"
              style={{ flex: 1 }}
            >
              筛选
            </Button>
            <Button onClick={() => clearFilters?.()} size="small" style={{ flex: 1 }}>
              重置
            </Button>
          </div>
        </div>
      ),
      onFilter: (value: any, record: LiveStreamSchedule) => {
        if (Array.isArray(value)) {
          return value.includes(record.timeSlotId);
        }
        return record.timeSlotId === value;
      }
    },
    {
      title: '参与人',
      dataIndex: 'managers',
      key: 'managers',
      width: 150,
      render: (managers: any[]) => {
        if (!managers || managers.length === 0) return '-';
        return managers.map(m => m.name).join(' / ');
      },
      filterDropdown: ({ setSelectedKeys, selectedKeys, confirm, clearFilters }: any) => (
        <div style={{ padding: 8 }}>
          <Input
            placeholder="搜索参与人"
            value={selectedKeys[0]}
            onChange={(e) => setSelectedKeys(e.target.value ? [e.target.value] : [])}
            onPressEnter={() => confirm()}
            style={{ width: 188, marginBottom: 8, display: 'block' }}
          />
          <div style={{ display: 'flex', gap: 8 }}>
            <Button
              type="primary"
              onClick={() => confirm()}
              icon={<FilterOutlined />}
              size="small"
              style={{ flex: 1 }}
            >
              搜索
            </Button>
            <Button onClick={() => clearFilters?.()} size="small" style={{ flex: 1 }}>
              重置
            </Button>
          </div>
        </div>
      ),
      onFilter: (value: any, record: LiveStreamSchedule) => {
        return record.managers?.some(manager => 
          manager.name.toLowerCase().includes(value.toLowerCase())
        ) || false;
      }
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 100,
      render: (status: string) => getStatusTag(status),
      filterDropdown: ({ setSelectedKeys, selectedKeys, confirm, clearFilters }: any) => (
        <div style={{ padding: 8 }}>
          <Select
            mode="multiple"
            placeholder="选择状态"
            value={selectedKeys}
            onChange={(value) => setSelectedKeys(value)}
            style={{ width: 200, marginBottom: 8 }}
          >
            <Option value="available">可报名</Option>
            <Option value="booked">已报名</Option>
            <Option value="completed">已完成</Option>
            <Option value="cancelled">已取消</Option>
            <Option value="editing">编辑中</Option>
            <Option value="locked">已锁定</Option>
          </Select>
          <div style={{ display: 'flex', gap: 8 }}>
            <Button
              type="primary"
              onClick={() => confirm()}
              icon={<FilterOutlined />}
              size="small"
              style={{ flex: 1 }}
            >
              筛选
            </Button>
            <Button onClick={() => clearFilters?.()} size="small" style={{ flex: 1 }}>
              重置
            </Button>
          </div>
        </div>
      ),
      onFilter: (value: any, record: LiveStreamSchedule) => {
        if (Array.isArray(value)) {
          return value.includes(record.status);
        }
        return record.status === value;
      }
    },
    {
      title: '评分状态',
      key: 'scoring_status',
      width: 100,
      render: (record: LiveStreamSchedule) => getScoringStatusTag(record),
      filterDropdown: ({ setSelectedKeys, selectedKeys, confirm, clearFilters }: any) => (
        <div style={{ padding: 8 }}>
          <Select
            mode="multiple"
            placeholder="选择评分状态"
            value={selectedKeys}
            onChange={(value) => setSelectedKeys(value)}
            style={{ width: 200, marginBottom: 8 }}
          >
            <Option value="not_scored">未评分</Option>
            <Option value="scoring_in_progress">评分中</Option>
            <Option value="scored">已评分</Option>
            <Option value="approved">已确认</Option>
          </Select>
          <div style={{ display: 'flex', gap: 8 }}>
            <Button
              type="primary"
              onClick={() => confirm()}
              icon={<FilterOutlined />}
              size="small"
              style={{ flex: 1 }}
            >
              筛选
            </Button>
            <Button onClick={() => clearFilters?.()} size="small" style={{ flex: 1 }}>
              重置
            </Button>
          </div>
        </div>
      ),
      onFilter: (value: any, record: LiveStreamSchedule) => {
        if (Array.isArray(value)) {
          return value.includes(record.scoring_status);
        }
        return record.scoring_status === value;
      }
    },
    {
      title: '综合评分',
      key: 'average_score',
      width: 100,
      render: (record: LiveStreamSchedule) => {
        if (record.average_score !== null && record.average_score !== undefined) {
          return (
            <span style={{ color: '#1890ff', fontWeight: 'bold' }}>
              {record.average_score.toFixed(1)}分
            </span>
          );
        }
        return '-';
      },
      filterDropdown: ({ setSelectedKeys, selectedKeys, confirm, clearFilters }: any) => (
        <div style={{ padding: 8 }}>
          <div style={{ marginBottom: 8 }}>
            <span>评分范围：</span>
            <Slider
              range
              min={0}
              max={10}
              step={0.1}
              value={selectedKeys[0] ? selectedKeys[0] : [0, 10]}
              onChange={(value: number[]) => setSelectedKeys([value])}
              style={{ width: 200 }}
            />
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <Button
              type="primary"
              onClick={() => confirm()}
              icon={<FilterOutlined />}
              size="small"
              style={{ flex: 1 }}
            >
              筛选
            </Button>
            <Button onClick={() => clearFilters?.()} size="small" style={{ flex: 1 }}>
              重置
            </Button>
          </div>
        </div>
      ),
      onFilter: (value: any, record: LiveStreamSchedule) => {
        if (!record.average_score) return value[0] === 0 && value[1] === 10;
        return record.average_score >= value[0] && record.average_score <= value[1];
      }
    },
    {
      title: '锁定状态',
      key: 'lock_status',
      width: 100,
      render: (record: LiveStreamSchedule) => {
        if (record.lockType && record.lockType !== 'none') {
          return (
            <Tooltip title={record.lockReason || '系统锁定'}>
              <Tag color="red">{record.lockType}</Tag>
            </Tooltip>
          );
        }
        return '-';
      },
      filterDropdown: ({ setSelectedKeys, selectedKeys, confirm, clearFilters }: any) => (
        <div style={{ padding: 8 }}>
          <Select
            mode="multiple"
            placeholder="选择锁定状态"
            value={selectedKeys}
            onChange={(value) => setSelectedKeys(value)}
            style={{ width: 200, marginBottom: 8 }}
          >
            <Option value="none">无锁定</Option>
            <Option value="manual">手动锁定</Option>
            <Option value="system">系统锁定</Option>
            <Option value="maintenance">维护锁定</Option>
          </Select>
          <div style={{ display: 'flex', gap: 8 }}>
            <Button
              type="primary"
              onClick={() => confirm()}
              icon={<FilterOutlined />}
              size="small"
              style={{ flex: 1 }}
            >
              筛选
            </Button>
            <Button onClick={() => clearFilters?.()} size="small" style={{ flex: 1 }}>
              重置
            </Button>
          </div>
        </div>
      ),
      onFilter: (value: any, record: LiveStreamSchedule) => {
        if (Array.isArray(value)) {
          return value.includes(record.lockType);
        }
        return record.lockType === value;
      }
    },
    {
      title: '评分时间',
      key: 'scored_at',
      width: 120,
      render: (record: LiveStreamSchedule) => {
        if (record.scored_at) {
          return dayjs(record.scored_at).format('MM-DD HH:mm');
        }
        return '-';
      },
      filterDropdown: ({ setSelectedKeys, selectedKeys, confirm, clearFilters }: any) => (
        <div style={{ padding: 8 }}>
          <DatePicker.RangePicker
            value={selectedKeys[0] ? [dayjs(selectedKeys[0][0]), dayjs(selectedKeys[0][1])] : undefined}
            onChange={(dates) => {
              if (dates && dates[0] && dates[1]) {
                setSelectedKeys([[dates[0].format('YYYY-MM-DD'), dates[1].format('YYYY-MM-DD')]]);
              }
            }}
            style={{ width: 200, marginBottom: 8 }}
          />
          <div style={{ display: 'flex', gap: 8 }}>
            <Button
              type="primary"
              onClick={() => confirm()}
              icon={<FilterOutlined />}
              size="small"
              style={{ flex: 1 }}
            >
              筛选
            </Button>
            <Button onClick={() => clearFilters?.()} size="small" style={{ flex: 1 }}>
              重置
            </Button>
          </div>
        </div>
      ),
      onFilter: (value: any, record: LiveStreamSchedule) => {
        if (!record.scored_at) return false;
        const scoredDate = dayjs(record.scored_at);
        return scoredDate.isBetween(
          toBeijingTime(value[0]),
          toBeijingTime(value[1]),
          'day',
          '[]'
        );
      }
    },
    {
      title: '操作',
      key: 'action',
      width: 120,
      render: (record: LiveStreamSchedule) => (
        <div style={{ textAlign: 'left' }}>
          <Tooltip title="查看评分">
            <Button 
              type="link" 
              size="small" 
              onClick={() => handleOpenScoring(record)}
            >
              评分
            </Button>
          </Tooltip>
        </div>
      )
    }
  ];

  // 维度管理相关函数
  const handleAddDimension = () => {
    setEditingDimension(null);
    dimensionForm.resetFields();
    setDimensionOptions([]);
    setDimensionModalVisible(true);
  };

  const handleEditDimension = (dimension: ScoringDimension) => {
    setEditingDimension(dimension);
    dimensionForm.setFieldsValue(dimension);
    // 加载该维度的选项
    const dimensionOptions = options.filter(option => option.dimension_code === dimension.dimension_code);
    setDimensionOptions(dimensionOptions);
    setDimensionModalVisible(true);
  };

  const handleDeleteDimension = async (dimensionId: number) => {
    try {
      await deleteScoringDimension(dimensionId);
      message.success('删除成功');
      loadData();
    } catch (error) {
      message.error('删除失败');
    }
  };

  const handleDimensionSubmit = async (values: any) => {
    try {
      if (editingDimension) {
        await updateScoringDimension(editingDimension.id, values);
        message.success('编辑成功');
      } else {
        await createScoringDimension(values);
        message.success('添加成功');
      }
      setDimensionModalVisible(false);
      loadData();
    } catch (error) {
      message.error(editingDimension ? '编辑失败' : '添加失败');
    }
  };

  // 选项管理相关函数
  const handleAddOption = (dimensionCode?: string) => {
    setEditingOption(null);
    optionForm.resetFields();
    if (dimensionCode) {
      optionForm.setFieldsValue({ dimension_code: dimensionCode });
    }
    setOptionModalVisible(true);
  };

  const handleEditOption = (option: ScoringOption) => {
    setEditingOption(option);
    optionForm.setFieldsValue(option);
    setOptionModalVisible(true);
  };

  const handleDeleteOption = async (optionId: number) => {
    try {
      await deleteScoringOption(optionId);
      message.success('删除成功');
      loadData();
    } catch (error) {
      message.error('删除失败');
    }
  };

  const handleOptionSubmit = async (values: any) => {
    try {
      if (editingOption) {
        await updateScoringOption(editingOption.id, values);
        message.success('编辑成功');
      } else {
        await createScoringOption(values);
        message.success('添加成功');
      }
      setOptionModalVisible(false);
      loadData();
    } catch (error) {
      message.error(editingOption ? '编辑失败' : '添加失败');
    }
  };

  // 新增：配置管理函数
  const handleConfigEdit = () => {
    if (registrationConfig) {
      configForm.setFieldsValue({
        registration_open_time: dayjs(registrationConfig.registration_open_time, 'HH:mm:ss'),
        registration_close_time: dayjs(registrationConfig.registration_close_time, 'HH:mm:ss'),
        registration_open_day_of_week: registrationConfig.registration_open_day_of_week,
        registration_close_day_of_week: registrationConfig.registration_close_day_of_week,
        privilege_advance_open_time: dayjs(registrationConfig.privilege_advance_open_time, 'HH:mm:ss'),
        privilege_advance_close_time: dayjs(registrationConfig.privilege_advance_close_time, 'HH:mm:ss'),
        privilege_advance_open_day_of_week: registrationConfig.privilege_advance_open_day_of_week,
        privilege_advance_close_day_of_week: registrationConfig.privilege_advance_close_day_of_week,
        weekly_limit_per_user: registrationConfig.weekly_limit_per_user,
        privilege_advance_limit: registrationConfig.privilege_advance_limit,
        privilege_managers: registrationConfig.privilege_managers,
        is_active: registrationConfig.is_active,
        is_emergency_closed: registrationConfig.is_emergency_closed
      });
    }
    setConfigModalVisible(true);
  };

  const handleConfigSubmit = async (values: any) => {
    setConfigLoading(true);
    try {
      // 处理VIP主播ID列表
      let privilegeManagers = [];
      if (values.privilege_managers && Array.isArray(values.privilege_managers)) {
        privilegeManagers = values.privilege_managers
          .map((id: any) => parseInt(id))
          .filter((id: number) => !isNaN(id));
      }

      const configData = {
        ...values,
        registration_open_time: values.registration_open_time.format('HH:mm:ss'),
        registration_close_time: values.registration_close_time.format('HH:mm:ss'),
        privilege_advance_open_time: values.privilege_advance_open_time.format('HH:mm:ss'),
        privilege_advance_close_time: values.privilege_advance_close_time.format('HH:mm:ss'),
        privilege_managers: privilegeManagers,
        updated_at: new Date().toISOString()
      };

      if (registrationConfig) {
        // 更新现有配置
        const { error } = await supabase
          .from('livestream_registration_config')
          .update(configData)
          .eq('id', registrationConfig.id);
        
        if (error) throw error;
        message.success('配置更新成功');
      } else {
        // 创建新配置
        const { error } = await supabase
          .from('livestream_registration_config')
          .insert([configData]);
        
        if (error) throw error;
        message.success('配置创建成功');
      }

      setConfigModalVisible(false);
      configForm.resetFields();
      await loadRegistrationConfig();
      liveStreamRegistrationService.clearConfigCache(); // 清除缓存
      
      // 显示配置信息
      const configInfo = `
配置保存成功！

📅基础报名时间：
   • 开放时间：${configData.registration_open_time}
   • 关闭时间：${configData.registration_close_time}
   • 开放星期：周${configData.registration_open_day_of_week} 至 周${configData.registration_close_day_of_week}

⭐ 提前报名时间：
   • 开放时间：${configData.privilege_advance_open_time}
   • 关闭时间：${configData.privilege_advance_close_time}
   • 开放星期：周${configData.privilege_advance_open_day_of_week} 至 周${configData.privilege_advance_close_day_of_week}

📊 报名限制：
   • 基础用户：${configData.weekly_limit_per_user}场/周
   • VIP主播：${configData.privilege_advance_limit}场/周

👥 VIP主播：${privilegeManagers.length}人
🔧 配置状态：${configData.is_active ? '启用' : '禁用'}
🚨 紧急关闭：${configData.is_emergency_closed ? '是' : '否'}
      `;
      
      Modal.info({
        title: '配置保存成功',
        content: <pre style={{ whiteSpace: 'pre-wrap', fontFamily: 'monospace' }}>{configInfo}</pre>,
        width: 600,
        okText: '确定'
      });
    } catch (error) {
      console.error('保存配置失败:', error);
      message.error('保存配置失败');
    } finally {
      setConfigLoading(false);
    }
  };

  return (
    <div className="live-stream-management">
      <Card>

        <Tabs defaultActiveKey="schedules">
          <TabPane tab="直播数据" key="schedules">
            <Table
              columns={columns}
              dataSource={schedules}
              rowKey="id"
              loading={loading}
              pagination={{
                current: currentPage,
                pageSize: pageSize,
                total: total,
                showSizeChanger: true,
                showQuickJumper: true,
                showTotal: (total) => `共 ${total} 条记录`
              }}
              onChange={handleTableChange}
              scroll={{ x: 1000 }}
            />
          </TabPane>
          
          <TabPane tab="评分规则管理" key="rules">
            <div className="rules-management">
              <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h3 style={{ margin: 0 }}>评分维度管理</h3>
                <Button type="primary" icon={<PlusOutlined />} onClick={handleAddDimension}>添加维度</Button>
              </div>
              <Table
                columns={[
                  { title: '维度名称', dataIndex: 'dimension_name', key: 'dimension_name' },
                  { title: '维度代码', dataIndex: 'dimension_code', key: 'dimension_code' },
                  { title: '权重', dataIndex: 'weight', key: 'weight', render: (weight: number) => weight.toFixed(2) },
                  { title: '排序', dataIndex: 'sort_order', key: 'sort_order' },
                  { title: '状态', dataIndex: 'is_active', key: 'is_active', render: (active: boolean) => <Tag color={active ? 'green' : 'red'}>{active ? '启用' : '禁用'}</Tag> },
                  {
                    title: '操作',
                    key: 'action',
                    render: (record: ScoringDimension) => (
                      <Space>
                        <Button type="link" size="small" icon={<EditOutlined />} onClick={() => handleEditDimension(record)} />
                        <Popconfirm title="确定删除此维度吗？" onConfirm={() => handleDeleteDimension(record.id)}>
                          <Button type="link" size="small" danger icon={<DeleteOutlined />} />
                        </Popconfirm>
                      </Space>
                    )
                  }
                ]}
                dataSource={dimensions}
                rowKey="id"
                pagination={false}
              />
            </div>
          </TabPane>

          <TabPane tab="直播设置" key="settings">
            <div className="settings-management">
              <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h3 style={{ margin: 0 }}>报名配置管理</h3>
                <Space>
                  <Button 
                    type="default" 
                    onClick={async () => {
                      try {
                        const { error } = await supabase
                          .from('livestream_registration_config')
                          .insert([{
                            registration_open_time: '09:00:00',
                            registration_close_time: '18:00:00',
                            registration_open_day_of_week: 1,
                            registration_close_day_of_week: 5,
                            privilege_advance_open_time: '08:00:00',
                            privilege_advance_close_time: '20:00:00',
                            privilege_advance_open_day_of_week: 1,
                            privilege_advance_close_day_of_week: 7,
                            weekly_limit_per_user: 3,
                            privilege_advance_limit: 2,
                            privilege_managers: [],
                            is_active: true,
                            is_emergency_closed: false
                          }]);
                        if (error) throw error;
                        message.success('默认配置创建成功');
                        await loadRegistrationConfig();
                      } catch (error) {
                        console.error('创建默认配置失败:', error);
                        message.error('创建默认配置失败');
                      }
                    }}
                  >
                    创建默认配置
                  </Button>
                  <Button type="primary" icon={<SettingOutlined />} onClick={handleConfigEdit}>
                    {registrationConfig ? '编辑配置' : '创建配置'}
                  </Button>
                </Space>
              </div>
              
              {registrationConfig ? (
                <Card>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                    <div>
                      <h4>基础报名时间</h4>
                      <p>开放时间: {registrationConfig.registration_open_time}</p>
                      <p>关闭时间: {registrationConfig.registration_close_time}</p>
                      <p>开放星期: 周{registrationConfig.registration_open_day_of_week} 至 周{registrationConfig.registration_close_day_of_week}</p>
                    </div>
                    <div>
                      <h4>特权报名时间</h4>
                      <p>开放时间: {registrationConfig.privilege_advance_open_time}</p>
                      <p>关闭时间: {registrationConfig.privilege_advance_close_time}</p>
                      <p>开放星期: 周{registrationConfig.privilege_advance_open_day_of_week} 至 周{registrationConfig.privilege_advance_close_day_of_week}</p>
                    </div>
                    <div>
                      <h4>报名限制</h4>
                      <p>基础用户限制: {registrationConfig.weekly_limit_per_user}场/周</p>
                      <p>提前报名限制: {registrationConfig.privilege_advance_limit}场/周</p>
                    </div>
                    <div>
                      <h4>状态</h4>
                      <p>配置状态: {registrationConfig.is_active ? '启用' : '禁用'}</p>
                      <p>紧急关闭: {registrationConfig.is_emergency_closed ? '是' : '否'}</p>
                      <p>VIP主播: {privilegeUserNames.length > 0 ? privilegeUserNames.join(', ') : '无'}</p>
                      <p style={{ fontSize: '12px', color: '#666', marginTop: '8px' }}>
                        💡 系统会根据当前时间自动切换用户权益类型
                      </p>
                      {/* 实时显示当前时间窗口状态 */}
                      {registrationConfig && (
                        <div style={{ 
                          marginTop: '12px', 
                          padding: '8px', 
                          background: '#f0f2f5', 
                          borderRadius: '4px',
                          fontSize: '12px'
                        }}>
                          <div style={{ fontWeight: '600', marginBottom: '4px' }}>当前时间窗口状态：</div>
                          {(() => {
                            const status = liveStreamRegistrationService.getCurrentTimeWindowStatus(registrationConfig);
                            return (
                              <div>
                                <div>当前时间: 周{status.currentDay} {status.currentTime}</div>
                                <div>基础窗口: {status.inNormalWindow ? '✅ 开放' : '❌ 关闭'}</div>
                                <div>VIP主播窗口: {status.inPrivilegeWindow ? '✅ 开放' : '❌ 关闭'}</div>
                                <div style={{ 
                                  marginTop: '4px', 
                                  fontWeight: '600',
                                  color: status.privilegeType === 'vip' ? '#722ed1' : 
                                         status.privilegeType === 'normal' ? '#1890ff' : '#999'
                                }}>
                                  当前权益类型: {status.privilegeType === 'vip' ? '提前报名权益' : 
                                                status.privilegeType === 'normal' ? '基础权益' : '无权益'}
                                </div>

                              </div>
                            );
                          })()}
                        </div>
                      )}
                    </div>
                  </div>
                </Card>
              ) : (
                <Card>
                  <div style={{ textAlign: 'center', padding: '40px' }}>
                    <p>暂无配置，请点击"创建配置"按钮进行设置</p>
                  </div>
                </Card>
              )}
            </div>
          </TabPane>
        </Tabs>
      </Card>

      {/* 评分抽屉 */}
      <LiveStreamScoringDrawer
        visible={scoringDrawerVisible}
        schedule={selectedSchedule}
        onClose={handleCloseScoring}
        onRefresh={handleRefresh}
      />

      {/* 配置编辑 Modal */}
      <Modal
        title="直播报名配置"
        open={configModalVisible}
        onCancel={() => setConfigModalVisible(false)}
        footer={null}
        width={800}
      >
        <Form form={configForm} onFinish={handleConfigSubmit} layout="vertical">
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
            <div>
              <h4>基础报名时间设置</h4>
              <Form.Item name="registration_open_time" label="开放时间" rules={[{ required: true, message: '请选择开放时间' }]}>
                <TimePicker format="HH:mm" style={{ width: '100%' }} />
              </Form.Item>
              <Form.Item name="registration_close_time" label="关闭时间" rules={[{ required: true, message: '请选择关闭时间' }]}>
                <TimePicker format="HH:mm" style={{ width: '100%' }} />
              </Form.Item>
              <Form.Item name="registration_open_day_of_week" label="开放星期" rules={[{ required: true, message: '请选择开放星期' }]}>
                <Select placeholder="请选择开放星期">
                  <Option value={1}>周一</Option>
                  <Option value={2}>周二</Option>
                  <Option value={3}>周三</Option>
                  <Option value={4}>周四</Option>
                  <Option value={5}>周五</Option>
                  <Option value={6}>周六</Option>
                  <Option value={7}>周日</Option>
                </Select>
              </Form.Item>
              <Form.Item name="registration_close_day_of_week" label="关闭星期" rules={[{ required: true, message: '请选择关闭星期' }]}>
                <Select placeholder="请选择关闭星期">
                  <Option value={1}>周一</Option>
                  <Option value={2}>周二</Option>
                  <Option value={3}>周三</Option>
                  <Option value={4}>周四</Option>
                  <Option value={5}>周五</Option>
                  <Option value={6}>周六</Option>
                  <Option value={7}>周日</Option>
                </Select>
              </Form.Item>
            </div>

            <div>
              <h4>特权报名时间设置</h4>
              <Form.Item name="privilege_advance_open_time" label="特权开放时间" rules={[{ required: true, message: '请选择特权开放时间' }]}>
                <TimePicker format="HH:mm" style={{ width: '100%' }} />
              </Form.Item>
              <Form.Item name="privilege_advance_close_time" label="特权关闭时间" rules={[{ required: true, message: '请选择特权关闭时间' }]}>
                <TimePicker format="HH:mm" style={{ width: '100%' }} />
              </Form.Item>
              <Form.Item name="privilege_advance_open_day_of_week" label="特权开放星期" rules={[{ required: true, message: '请选择特权开放星期' }]}>
                <Select placeholder="请选择特权开放星期">
                  <Option value={1}>周一</Option>
                  <Option value={2}>周二</Option>
                  <Option value={3}>周三</Option>
                  <Option value={4}>周四</Option>
                  <Option value={5}>周五</Option>
                  <Option value={6}>周六</Option>
                  <Option value={7}>周日</Option>
                </Select>
              </Form.Item>
              <Form.Item name="privilege_advance_close_day_of_week" label="特权关闭星期" rules={[{ required: true, message: '请选择特权关闭星期' }]}>
                <Select placeholder="请选择特权关闭星期">
                  <Option value={1}>周一</Option>
                  <Option value={2}>周二</Option>
                  <Option value={3}>周三</Option>
                  <Option value={4}>周四</Option>
                  <Option value={5}>周五</Option>
                  <Option value={6}>周六</Option>
                  <Option value={7}>周日</Option>
                </Select>
              </Form.Item>
            </div>
          </div>

          <Divider />

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
            <div>
              <h4>报名限制设置</h4>
              <Form.Item name="weekly_limit_per_user" label="基础用户每周限制" rules={[{ required: true, message: '请输入每周限制' }]}>
                <InputNumber min={1} max={10} style={{ width: '100%' }} />
              </Form.Item>
              <Form.Item name="privilege_advance_limit" label="提前报名限制" rules={[{ required: true, message: '请输入提前报名限制' }]}>
                <InputNumber min={1} max={10} style={{ width: '100%' }} />
              </Form.Item>
            </div>

            <div>
              <h4>状态设置</h4>
              <Form.Item name="is_active" label="启用配置" valuePropName="checked">
                <Switch />
              </Form.Item>
              <Form.Item name="is_emergency_closed" label="紧急关闭报名" valuePropName="checked">
                <Switch />
              </Form.Item>
            </div>
          </div>

          <Form.Item name="privilege_managers" label="VIP主播" help="选择可提前报名的VIP主播">
            <UserTreeSelect
              placeholder="请选择VIP主播"
              multiple
              showSearch
              allowClear
              style={{ width: '100%' }}
            />
          </Form.Item>

          <Form.Item style={{ marginBottom: 0, textAlign: 'right' }}>
            <Space>
              <Button onClick={() => setConfigModalVisible(false)}>取消</Button>
              <Button type="primary" htmlType="submit" loading={configLoading} icon={<SaveOutlined />}>
                保存配置
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>

      {/* 维度编辑模态框 */}
      <Modal
        title={editingDimension ? '编辑评分维度' : '添加评分维度'}
        open={dimensionModalVisible}
        onCancel={() => setDimensionModalVisible(false)}
        footer={null}
        width={800}
      >
        <Tabs defaultActiveKey="dimension">
          <TabPane tab="维度信息" key="dimension">
            <Form form={dimensionForm} onFinish={handleDimensionSubmit} layout="vertical">
              <Form.Item name="dimension_name" label="维度名称" rules={[{ required: true, message: '请输入维度名称' }]}>
                <Input placeholder="请输入维度名称" />
              </Form.Item>
              <Form.Item name="dimension_code" label="维度代码" rules={[{ required: true, message: '请输入维度代码' }]}>
                <Input placeholder="请输入维度代码" />
              </Form.Item>
              <Form.Item name="description" label="描述">
                <Input.TextArea placeholder="请输入描述" />
              </Form.Item>
                        <Form.Item name="weight" label="权重" rules={[{ required: true, message: '请输入权重' }]}>
            <InputNumber min={0} max={9.99} step={0.01} placeholder="请输入权重" style={{ width: '100%' }} />
          </Form.Item>
              <Form.Item name="sort_order" label="排序" rules={[{ required: true, message: '请输入排序' }]}>
                <InputNumber min={0} placeholder="请输入排序" style={{ width: '100%' }} />
              </Form.Item>
              <Form.Item name="is_active" label="状态" initialValue={true}>
                <Select>
                  <Option value={true}>启用</Option>
                  <Option value={false}>禁用</Option>
                </Select>
              </Form.Item>
              <Form.Item>
                <Space>
                  <Button type="primary" htmlType="submit">
                    {editingDimension ? '保存' : '添加'}
                  </Button>
                  <Button onClick={() => setDimensionModalVisible(false)}>取消</Button>
                </Space>
              </Form.Item>
            </Form>
          </TabPane>
          
          {editingDimension && (
            <TabPane tab="评分选项" key="options">
              <div style={{ marginBottom: 16 }}>
                <Button 
                  type="primary" 
                  icon={<PlusOutlined />} 
                  onClick={() => handleAddOption(editingDimension.dimension_code)}
                >
                  添加选项
                </Button>
              </div>
              <Table
                columns={[
                  { title: '选项代码', dataIndex: 'option_code', key: 'option_code' },
                  { title: '选项文本', dataIndex: 'option_text', key: 'option_text' },
                  { title: '分数', dataIndex: 'score', key: 'score' },
                  { title: '排序', dataIndex: 'sort_order', key: 'sort_order' },
                  { title: '状态', dataIndex: 'is_active', key: 'is_active', render: (active: boolean) => <Tag color={active ? 'green' : 'red'}>{active ? '启用' : '禁用'}</Tag> },
                  {
                    title: '操作',
                    key: 'action',
                    render: (record: ScoringOption) => (
                      <Space>
                        <Button type="link" size="small" icon={<EditOutlined />} onClick={() => handleEditOption(record)} />
                        <Popconfirm title="确定删除此选项吗？" onConfirm={() => handleDeleteOption(record.id)}>
                          <Button type="link" size="small" danger icon={<DeleteOutlined />} />
                        </Popconfirm>
                      </Space>
                    )
                  }
                ]}
                dataSource={dimensionOptions}
                rowKey="id"
                pagination={false}
                size="small"
              />
            </TabPane>
          )}
        </Tabs>
      </Modal>

      {/* 选项编辑模态框 */}
      <Modal
        title={editingOption ? '编辑评分选项' : '添加评分选项'}
        open={optionModalVisible}
        onCancel={() => setOptionModalVisible(false)}
        footer={null}
      >
        <Form form={optionForm} onFinish={handleOptionSubmit} layout="vertical">
          <Form.Item name="dimension_code" label="所属维度" rules={[{ required: true, message: '请选择所属维度' }]}>
            <Select placeholder="请选择所属维度">
              {dimensions.map(dim => (
                <Option key={dim.dimension_code} value={dim.dimension_code}>
                  {dim.dimension_name}
                </Option>
              ))}
            </Select>
          </Form.Item>
          <Form.Item name="option_code" label="选项代码" rules={[{ required: true, message: '请输入选项代码' }]}>
            <Input placeholder="请输入选项代码" />
          </Form.Item>
          <Form.Item name="option_text" label="选项文本" rules={[{ required: true, message: '请输入选项文本' }]}>
            <Input.TextArea placeholder="请输入选项文本" />
          </Form.Item>
          <Form.Item name="score" label="分数" rules={[{ required: true, message: '请输入分数' }]}>
            <InputNumber min={0} max={10} step={0.1} placeholder="请输入分数" style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="sort_order" label="排序" rules={[{ required: true, message: '请输入排序' }]}>
            <InputNumber min={0} placeholder="请输入排序" style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="is_active" label="状态" initialValue={true}>
            <Select>
              <Option value={true}>启用</Option>
              <Option value={false}>禁用</Option>
            </Select>
          </Form.Item>
          <Form.Item>
            <Space>
              <Button type="primary" htmlType="submit">
                {editingOption ? '保存' : '添加'}
              </Button>
              <Button onClick={() => setOptionModalVisible(false)}>取消</Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default LiveStreamManagement; 