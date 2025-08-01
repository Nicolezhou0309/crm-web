import React, { useState } from 'react';
import {
  Card,
  Table,
  Button,
  Modal,
  Form,
  Select,
  DatePicker,
  Row,
  Col,
  Tag,
  Space,
  Typography,
  message,
  Popconfirm,
  Tooltip,
  Statistic,
  Progress,
  Empty,
  Spin,
  Tabs
} from 'antd';
import {
  CalendarOutlined,
  ClockCircleOutlined,
  UserOutlined,
  EnvironmentOutlined,
  HomeOutlined,
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  VideoCameraOutlined
} from '@ant-design/icons';
import dayjs, { Dayjs } from 'dayjs';
import type { 
  LiveStreamSchedule, 
  LiveStreamManager, 
  LiveStreamLocation, 
  LiveStreamPropertyType,
  LiveStreamRegistration
} from '../types/liveStream';
import { 
  TIME_SLOTS
} from '../types/liveStream';
import { 
  getLiveStreamManagers,
  getLiveStreamLocations,
  getLiveStreamPropertyTypes,
  getWeeklySchedule,
  createLiveStreamSchedule,
  updateLiveStreamSchedule,
  deleteLiveStreamSchedule,
  getUserRegistrations,
  getLiveStreamStats
} from '../api/liveStreamApi';
import './LiveStreamManagement.css';

const { Title, Text } = Typography;
const { Option } = Select;
const { TabPane } = Tabs;

interface LiveStreamManagementProps {}

const LiveStreamManagement: React.FC<LiveStreamManagementProps> = () => {
  const [schedules, setSchedules] = useState<LiveStreamSchedule[]>([]);
  const [registrations, setRegistrations] = useState<LiveStreamRegistration[]>([]);
  const [managers, setManagers] = useState<LiveStreamManager[]>([]);
  const [locations, setLocations] = useState<LiveStreamLocation[]>([]);
  const [propertyTypes, setPropertyTypes] = useState<LiveStreamPropertyType[]>([]);
  const [loading, setLoading] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [editingSchedule, setEditingSchedule] = useState<LiveStreamSchedule | null>(null);
  const [selectedWeek] = useState<Dayjs>(dayjs());
  const [stats, setStats] = useState<any>(null);
  const [form] = Form.useForm();

  // 加载数据
  React.useEffect(() => {
    loadData();
  }, [selectedWeek]);

  const loadData = async () => {
    try {
      setLoading(true);
      const weekStart = selectedWeek.startOf('week').format('YYYY-MM-DD');
      const weekEnd = selectedWeek.endOf('week').format('YYYY-MM-DD');
      
      const [schedulesData, registrationsData, managersData, locationsData, propertyTypesData, statsData] = await Promise.all([
        getWeeklySchedule(weekStart, weekEnd),
        getUserRegistrations('current-user-id'),
        getLiveStreamManagers(),
        getLiveStreamLocations(),
        getLiveStreamPropertyTypes(),
        getLiveStreamStats(weekStart, weekEnd)
      ]);

      setSchedules(schedulesData);
      setRegistrations(registrationsData);
      setManagers(managersData);
      setLocations(locationsData);
      setPropertyTypes(propertyTypesData);
      setStats(statsData);
    } catch (error) {
      message.error('加载数据失败');
      console.error('加载数据失败:', error);
    } finally {
      setLoading(false);
    }
  };

  // 处理创建/编辑安排
  const handleScheduleSubmit = async (values: any) => {
    try {
      setLoading(true);
      
      const scheduleData = {
        date: values.date.format('YYYY-MM-DD'),
        timeSlotId: values.timeSlot,
        managerIds: values.managers,
        locationId: values.location,
        propertyTypeId: values.propertyType,
        status: values.status || 'available',
      };

      if (editingSchedule) {
        await updateLiveStreamSchedule(editingSchedule.id, scheduleData);
        message.success('安排更新成功');
      } else {
        await createLiveStreamSchedule(scheduleData);
        message.success('安排创建成功');
      }

      setModalVisible(false);
      form.resetFields();
      setEditingSchedule(null);
      loadData();
    } catch (error) {
      message.error('操作失败');
      console.error('操作失败:', error);
    } finally {
      setLoading(false);
    }
  };

  // 处理删除安排
  const handleDeleteSchedule = async (scheduleId: string) => {
    try {
      await deleteLiveStreamSchedule(scheduleId);
      message.success('删除成功');
      loadData();
    } catch (error) {
      message.error('删除失败');
      console.error('删除失败:', error);
    }
  };

  // 处理编辑安排
  const handleEditSchedule = (schedule: LiveStreamSchedule) => {
    setEditingSchedule(schedule);
    form.setFieldsValue({
      date: dayjs(schedule.date),
      timeSlot: schedule.timeSlotId,
      managers: schedule.managers.map(m => m.id),
      location: schedule.location.id,
      propertyType: schedule.propertyType.id,
      status: schedule.status,
    });
    setModalVisible(true);
  };

  // 处理新建安排
  const handleCreateSchedule = () => {
    setEditingSchedule(null);
    form.resetFields();
    setModalVisible(true);
  };

  // 表格列定义
  const scheduleColumns = [
    {
      title: '日期',
      dataIndex: 'date',
      key: 'date',
      render: (date: string) => dayjs(date).format('MM-DD (ddd)'),
      sorter: (a: LiveStreamSchedule, b: LiveStreamSchedule) => 
        dayjs(a.date).unix() - dayjs(b.date).unix(),
    },
    {
      title: '时间段',
      dataIndex: 'timeSlotId',
      key: 'timeSlot',
      render: (timeSlotId: string) => {
        const timeSlot = TIME_SLOTS.find(ts => ts.id === timeSlotId);
        return timeSlot ? `${timeSlot.startTime}-${timeSlot.endTime}` : timeSlotId;
      },
    },
    {
      title: '直播管家',
      dataIndex: 'managers',
      key: 'managers',
      render: (managers: LiveStreamManager[]) => (
        <Space>
          {managers.map(manager => (
            <Tag key={manager.id} color="blue">
              <UserOutlined /> {manager.name}
            </Tag>
          ))}
        </Space>
      ),
    },
    {
      title: '直播地点',
      dataIndex: 'location',
      key: 'location',
      render: (location: LiveStreamLocation) => (
        <Tag color="green">
          <EnvironmentOutlined /> {location.name}
        </Tag>
      ),
    },
    {
      title: '直播户型',
      dataIndex: 'propertyType',
      key: 'propertyType',
      render: (propertyType: LiveStreamPropertyType) => (
        <Tag color="orange">
          <HomeOutlined /> {propertyType.name}
        </Tag>
      ),
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      render: (status: string) => {
        const statusConfig = {
          available: { color: 'green', text: '可报名', icon: <CheckCircleOutlined /> },
          booked: { color: 'blue', text: '已报名', icon: <ClockCircleOutlined /> },
          completed: { color: 'purple', text: '已完成', icon: <CheckCircleOutlined /> },
          cancelled: { color: 'red', text: '已取消', icon: <CloseCircleOutlined /> },
        };
        const config = statusConfig[status as keyof typeof statusConfig] || statusConfig.available;
        return (
          <Tag color={config.color} icon={config.icon}>
            {config.text}
          </Tag>
        );
      },
    },
    {
      title: '操作',
      key: 'actions',
      render: (_: any, record: LiveStreamSchedule) => (
        <Space>
          <Tooltip title="编辑">
            <Button
              type="link"
              icon={<EditOutlined />}
              onClick={() => handleEditSchedule(record)}
            />
          </Tooltip>
          <Popconfirm
            title="确定要删除这个安排吗？"
            onConfirm={() => handleDeleteSchedule(record.id)}
            okText="确定"
            cancelText="取消"
          >
            <Tooltip title="删除">
              <Button
                type="link"
                danger
                icon={<DeleteOutlined />}
              />
            </Tooltip>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  // 报名记录表格列定义
  const registrationColumns = [
    {
      title: '报名时间',
      dataIndex: 'createdAt',
      key: 'createdAt',
      render: (createdAt: string) => dayjs(createdAt).format('YYYY-MM-DD HH:mm'),
    },
    {
      title: '直播管家',
      dataIndex: 'managerIds',
      key: 'managers',
      render: (managerIds: string[]) => (
        <Space>
          {managerIds.map(managerId => {
            const manager = managers.find(m => m.id === managerId);
            return manager ? (
              <Tag key={managerId} color="blue">
                <UserOutlined /> {manager.name}
              </Tag>
            ) : null;
          })}
        </Space>
      ),
    },
    {
      title: '直播地点',
      dataIndex: 'locationId',
      key: 'location',
      render: (locationId: string) => {
        const location = locations.find(l => l.id === locationId);
        return location ? (
          <Tag color="green">
            <EnvironmentOutlined /> {location.name}
          </Tag>
        ) : null;
      },
    },
    {
      title: '直播户型',
      dataIndex: 'propertyTypeId',
      key: 'propertyType',
      render: (propertyTypeId: string) => {
        const propertyType = propertyTypes.find(p => p.id === propertyTypeId);
        return propertyType ? (
          <Tag color="orange">
            <HomeOutlined /> {propertyType.name}
          </Tag>
        ) : null;
      },
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      render: (status: string) => {
        const statusConfig = {
          pending: { color: 'orange', text: '待审核', icon: <ClockCircleOutlined /> },
          approved: { color: 'green', text: '已通过', icon: <CheckCircleOutlined /> },
          rejected: { color: 'red', text: '已拒绝', icon: <CloseCircleOutlined /> },
        };
        const config = statusConfig[status as keyof typeof statusConfig] || statusConfig.pending;
        return (
          <Tag color={config.color} icon={config.icon}>
            {config.text}
          </Tag>
        );
      },
    },
  ];

  return (
    <div className="live-stream-management">
      <div className="page-header">
        <Title level={2}>
          <VideoCameraOutlined /> 直播管理
        </Title>
        <Text type="secondary">
          管理直播安排和报名记录
        </Text>
      </div>

      {/* 统计卡片 */}
      {stats && (
        <Row gutter={[16, 16]} className="stats-section">
          <Col xs={24} sm={12} md={6}>
            <Card>
              <Statistic
                title="总安排数"
                value={stats.total}
                prefix={<CalendarOutlined />}
              />
            </Card>
          </Col>
          <Col xs={24} sm={12} md={6}>
            <Card>
              <Statistic
                title="已报名"
                value={stats.booked}
                prefix={<CheckCircleOutlined />}
                valueStyle={{ color: '#52c41a' }}
              />
            </Card>
          </Col>
          <Col xs={24} sm={12} md={6}>
            <Card>
              <Statistic
                title="可报名"
                value={stats.available}
                prefix={<ClockCircleOutlined />}
                valueStyle={{ color: '#1890ff' }}
              />
            </Card>
          </Col>
          <Col xs={24} sm={12} md={6}>
            <Card>
              <Statistic
                title="已完成"
                value={stats.completed}
                prefix={<CheckCircleOutlined />}
                valueStyle={{ color: '#722ed1' }}
              />
            </Card>
          </Col>
        </Row>
      )}

      {/* 进度条 */}
      {stats && stats.total > 0 && (
        <Card className="progress-section">
          <Text strong>本周报名进度</Text>
          <Progress
            percent={Math.round((stats.booked / stats.total) * 100)}
            status="active"
            strokeColor={{
              '0%': '#108ee9',
              '100%': '#87d068',
            }}
          />
        </Card>
      )}

      <Tabs defaultActiveKey="schedules" className="management-tabs">
        <TabPane tab="直播安排" key="schedules">
          <Card
            title="本周直播安排"
            extra={
              <Button
                type="primary"
                icon={<PlusOutlined />}
                onClick={handleCreateSchedule}
              >
                新建安排
              </Button>
            }
          >
            <Spin spinning={loading}>
              <Table
                dataSource={schedules}
                columns={scheduleColumns}
                rowKey="id"
                pagination={false}
                locale={{
                  emptyText: (
                    <Empty
                      description="暂无直播安排"
                      image={Empty.PRESENTED_IMAGE_SIMPLE}
                    />
                  ),
                }}
              />
            </Spin>
          </Card>
        </TabPane>

        <TabPane tab="报名记录" key="registrations">
          <Card title="报名记录">
            <Spin spinning={loading}>
              <Table
                dataSource={registrations}
                columns={registrationColumns}
                rowKey="id"
                pagination={{
                  pageSize: 10,
                  showSizeChanger: true,
                  showQuickJumper: true,
                }}
                locale={{
                  emptyText: (
                    <Empty
                      description="暂无报名记录"
                      image={Empty.PRESENTED_IMAGE_SIMPLE}
                    />
                  ),
                }}
              />
            </Spin>
          </Card>
        </TabPane>
      </Tabs>

      {/* 创建/编辑安排弹窗 */}
      <Modal
        title={editingSchedule ? '编辑直播安排' : '新建直播安排'}
        open={modalVisible}
        onCancel={() => {
          setModalVisible(false);
          setEditingSchedule(null);
          form.resetFields();
        }}
        footer={null}
        width={600}
        destroyOnClose
      >
        <Form
          form={form}
          layout="vertical"
          onFinish={handleScheduleSubmit}
        >
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                label="日期"
                name="date"
                rules={[{ required: true, message: '请选择日期' }]}
              >
                <DatePicker
                  style={{ width: '100%' }}
                  placeholder="选择日期"
                />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                label="时间段"
                name="timeSlot"
                rules={[{ required: true, message: '请选择时间段' }]}
              >
                <Select placeholder="选择时间段">
                  {TIME_SLOTS.map(slot => (
                    <Option key={slot.id} value={slot.id}>
                      {slot.startTime}-{slot.endTime}
                    </Option>
                  ))}
                </Select>
              </Form.Item>
            </Col>
          </Row>

          <Form.Item
            label="直播管家"
            name="managers"
            rules={[
              { required: true, message: '请选择直播管家' },
              { 
                validator: (_, value) => {
                  if (!value || value.length !== 2) {
                    return Promise.reject(new Error('请选择2名直播管家'));
                  }
                  return Promise.resolve();
                }
              }
            ]}
          >
            <Select
              mode="multiple"
              placeholder="请选择2名直播管家"
              maxTagCount={2}
              showSearch
              filterOption={(input, option) =>
                (option?.children as unknown as string)?.toLowerCase().includes(input.toLowerCase())
              }
            >
              {managers.map(manager => (
                <Option key={manager.id} value={manager.id}>
                  <Space>
                    <UserOutlined />
                    {manager.name}
                    {manager.department && (
                      <Tag color="blue">{manager.department}</Tag>
                    )}
                  </Space>
                </Option>
              ))}
            </Select>
          </Form.Item>

          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                label="直播地点"
                name="location"
                rules={[{ required: true, message: '请选择直播地点' }]}
              >
                <Select
                  placeholder="请选择直播地点"
                  showSearch
                  filterOption={(input, option) =>
                    (option?.children as unknown as string)?.toLowerCase().includes(input.toLowerCase())
                  }
                >
                  {locations.map(location => (
                    <Option key={location.id} value={location.id}>
                      <Space>
                        <EnvironmentOutlined />
                        {location.name}
                      </Space>
                    </Option>
                  ))}
                </Select>
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                label="直播户型"
                name="propertyType"
                rules={[{ required: true, message: '请选择直播户型' }]}
              >
                <Select
                  placeholder="请选择直播户型"
                  showSearch
                  filterOption={(input, option) =>
                    (option?.children as unknown as string)?.toLowerCase().includes(input.toLowerCase())
                  }
                >
                  {propertyTypes.map(type => (
                    <Option key={type.id} value={type.id}>
                      <Space>
                        <HomeOutlined />
                        {type.name}
                      </Space>
                    </Option>
                  ))}
                </Select>
              </Form.Item>
            </Col>
          </Row>

          <Form.Item
            label="状态"
            name="status"
            initialValue="available"
          >
            <Select>
              <Option value="available">可报名</Option>
              <Option value="booked">已报名</Option>
              <Option value="completed">已完成</Option>
              <Option value="cancelled">已取消</Option>
            </Select>
          </Form.Item>

          <Form.Item>
            <Space>
              <Button 
                type="primary" 
                htmlType="submit" 
                loading={loading}
                icon={<CheckCircleOutlined />}
              >
                {editingSchedule ? '更新' : '创建'}
              </Button>
              <Button 
                onClick={() => {
                  setModalVisible(false);
                  setEditingSchedule(null);
                  form.resetFields();
                }}
                icon={<CloseCircleOutlined />}
              >
                取消
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default LiveStreamManagement;