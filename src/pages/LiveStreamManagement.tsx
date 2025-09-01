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
  DatePicker
} from 'antd';
import { 
  PlusOutlined, 
  EditOutlined, 
  DeleteOutlined, 
  FilterOutlined
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

  // 加载数据
  useEffect(() => {
    loadData();
  }, [filterParams]);

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
        </Tabs>
      </Card>

      {/* 评分抽屉 */}
      <LiveStreamScoringDrawer
        visible={scoringDrawerVisible}
        schedule={selectedSchedule}
        onClose={handleCloseScoring}
        onRefresh={handleRefresh}
      />

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