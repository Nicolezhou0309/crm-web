import React, { useState, useEffect } from 'react';
import {
  Card,
  Table,
  Button,
  Modal,
  Form,
  Input,
  Select,
  Space,
  Tag,
  message,
  Row,
  Col,
  Typography,
  Popconfirm,
  Switch,
  Tooltip,
  Statistic,
  DatePicker
} from 'antd';
import {
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
  EyeOutlined,
  BellOutlined,
  ExclamationCircleOutlined,
  CheckCircleOutlined,
  InfoCircleOutlined,
  WarningOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import { supabase } from '../supaClient';
import { useUser } from '../context/UserContext';

// 定义公告接口
interface Announcement {
  id: string;
  title: string;
  content: string;
  type: 'info' | 'warning' | 'success' | 'error';
  priority: number;
  target_roles?: string[];
  target_organizations?: string[];
  is_active: boolean;
  start_time: string;
  end_time?: string;
  created_by?: number;
  created_at: string;
  is_read?: boolean;
}

const { Title, Text } = Typography;
const { TextArea } = Input;
const { Option } = Select;

interface AnnouncementFormData {
  title: string;
  content: string;
  type: 'info' | 'warning' | 'success' | 'error';
  priority: number;
  is_active: boolean;
  start_time: string;
  end_time?: string;
  target_roles?: string[];
  target_organizations?: string[];
}

const AnnouncementManagement: React.FC = () => {
  const { user } = useUser();
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [loading, setLoading] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [editingAnnouncement, setEditingAnnouncement] = useState<Announcement | null>(null);
  const [form] = Form.useForm();
  const [stats, setStats] = useState({
    total: 0,
    active: 0,
    inactive: 0,
  });

  // 获取公告列表
  const fetchAnnouncements = async () => {
    setLoading(true);
    try {
      // 直接查询数据库，RLS 自动控制权限
      const { data, error } = await supabase
        .from('announcements')
        .select('*')
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      
      setAnnouncements(data || []);
      
      // 计算统计信息
      const activeCount = data.filter((a: Announcement) => a.is_active).length;
      setStats({
        total: data.length,
        active: activeCount,
        inactive: data.length - activeCount,
      });
    } catch (error) {
      message.error('获取公告列表失败');
      console.error('获取公告列表失败:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAnnouncements();
  }, []);

  // 重置表单
  const resetForm = () => {
    form.resetFields();
    setEditingAnnouncement(null);
  };

  // 打开创建模态框
  const handleCreate = () => {
    resetForm();
    setModalVisible(true);
  };

  // 打开编辑模态框
  const handleEdit = (record: Announcement) => {
    setEditingAnnouncement(record);
    form.setFieldsValue({
      ...record,
      start_time: record.start_time ? dayjs(record.start_time) : undefined,
      end_time: record.end_time ? dayjs(record.end_time) : undefined,
    });
    setModalVisible(true);
  };

  // 提交表单
  const handleSubmit = async (values: any) => {
    try {
      const formData: AnnouncementFormData = {
        ...values,
        start_time: values.start_time?.toISOString(),
        end_time: values.end_time?.toISOString(),
      };

      if (editingAnnouncement) {
        // 直接更新数据库，RLS 自动控制权限
        const { error } = await supabase
          .from('announcements')
          .update(formData)
          .eq('id', editingAnnouncement.id);
        
        if (error) throw error;
        
        message.success('公告更新成功');
        
        // 立即更新本地状态
        setAnnouncements(prev => prev.map(announcement => 
          announcement.id === editingAnnouncement.id 
            ? { ...announcement, ...formData }
            : announcement
        ));
      } else {
        // 直接创建数据库记录，RLS 自动控制权限
        const { error } = await supabase
          .from('announcements')
          .insert({
            ...formData,
            created_by: user?.id ? parseInt(user.id) : undefined,
          });
        
        if (error) throw error;
        
        message.success('公告创建成功');
        
        // 创建成功后重新获取数据以确保数据完整性
        fetchAnnouncements();
      }

      setModalVisible(false);
      resetForm();
    } catch (error) {
      message.error(editingAnnouncement ? '更新公告失败' : '创建公告失败');
      console.error('提交失败:', error);
    }
  };

  // 删除公告
  const handleDelete = async (id: string) => {
    try {
      // 直接删除数据库记录
      const { error } = await supabase
        .from('announcements')
        .delete()
        .eq('id', id);
      
      if (error) {
        console.error('数据库删除失败:', error);
        throw error;
      }
      
      message.success('公告删除成功');
      
      // 立即更新本地状态，同步窗口数据
      setAnnouncements(prev => prev.filter(announcement => announcement.id !== id));
      
      // 重新计算统计信息
      const updatedAnnouncements = announcements.filter(announcement => announcement.id !== id);
      const activeCount = updatedAnnouncements.filter(a => a.is_active).length;
      setStats({
        total: updatedAnnouncements.length,
        active: activeCount,
        inactive: updatedAnnouncements.length - activeCount,
      });
      
      // 可选：重新获取完整数据以确保数据一致性
      // fetchAnnouncements();
    } catch (error) {
      console.error('删除公告失败，ID:', id, '错误详情:', error);
      message.error('删除公告失败');
    }
  };

  // 切换公告状态
  const handleToggleStatus = async (record: Announcement) => {
    try {
      // 直接更新数据库，RLS 自动控制权限
      const { error } = await supabase
        .from('announcements')
        .update({ is_active: !record.is_active })
        .eq('id', record.id);
      
      if (error) throw error;
      
      message.success(`公告已${record.is_active ? '停用' : '启用'}`);
      
      // 立即更新本地状态
      setAnnouncements(prev => prev.map(announcement => 
        announcement.id === record.id 
          ? { ...announcement, is_active: !record.is_active }
          : announcement
      ));
      
      // 重新计算统计信息
      const updatedAnnouncements = announcements.map(announcement => 
        announcement.id === record.id 
          ? { ...announcement, is_active: !record.is_active }
          : announcement
      );
      const activeCount = updatedAnnouncements.filter(a => a.is_active).length;
      setStats({
        total: updatedAnnouncements.length,
        active: activeCount,
        inactive: updatedAnnouncements.length - activeCount,
      });
    } catch (error) {
      message.error('状态更新失败');
      console.error('状态更新失败:', error);
    }
  };

  // 获取类型图标
  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'info':
        return <InfoCircleOutlined style={{ color: '#1890ff' }} />;
      case 'warning':
        return <WarningOutlined style={{ color: '#faad14' }} />;
      case 'success':
        return <CheckCircleOutlined style={{ color: '#52c41a' }} />;
      case 'error':
        return <ExclamationCircleOutlined style={{ color: '#ff4d4f' }} />;
      default:
        return <InfoCircleOutlined />;
    }
  };

  // 获取类型标签
  const getTypeTag = (type: string) => {
    const typeMap = {
      info: { color: 'blue', text: '信息' },
      warning: { color: 'orange', text: '警告' },
      success: { color: 'green', text: '成功' },
      error: { color: 'red', text: '错误' },
    };
    const config = typeMap[type as keyof typeof typeMap] || typeMap.info;
    return <Tag color={config.color}>{config.text}</Tag>;
  };

  // 表格列定义
  const columns = [
    {
      title: '标题',
      dataIndex: 'title',
      key: 'title',
      width: 200,
      render: (text: string) => (
        <Text strong style={{ fontSize: 14 }}>
          {text}
        </Text>
      ),
    },
    {
      title: '类型',
      dataIndex: 'type',
      key: 'type',
      width: 100,
      render: (type: string) => (
        <Space>
          {getTypeIcon(type)}
          {getTypeTag(type)}
        </Space>
      ),
    },
    {
      title: '优先级',
      dataIndex: 'priority',
      key: 'priority',
      width: 80,
      render: (priority: number) => (
        <Tag color={priority > 1 ? 'red' : priority > 0 ? 'orange' : 'default'}>
          {priority}
        </Tag>
      ),
    },
    {
      title: '状态',
      dataIndex: 'is_active',
      key: 'is_active',
      width: 100,
      render: (isActive: boolean) => (
        <Tag color={isActive ? 'green' : 'red'}>
          {isActive ? '启用' : '停用'}
        </Tag>
      ),
    },
    {
      title: '生效时间',
      dataIndex: 'start_time',
      key: 'start_time',
      width: 150,
      render: (time: string) => dayjs(time).format('YYYY-MM-DD HH:mm'),
    },
    {
      title: '过期时间',
      dataIndex: 'end_time',
      key: 'end_time',
      width: 150,
      render: (time: string) => time ? dayjs(time).format('YYYY-MM-DD HH:mm') : '-',
    },
    {
      title: '创建时间',
      dataIndex: 'created_at',
      key: 'created_at',
      width: 150,
      render: (time: string) => dayjs(time).format('YYYY-MM-DD HH:mm'),
    },
    {
      title: '操作',
      key: 'actions',
      width: 200,
      render: (_: any, record: Announcement) => (
        <Space>
          <Tooltip title="编辑">
            <Button
              type="text"
              icon={<EditOutlined />}
              onClick={() => handleEdit(record)}
            />
          </Tooltip>
          <Tooltip title={record.is_active ? '停用' : '启用'}>
            <Button
              type="text"
              icon={record.is_active ? <EyeOutlined /> : <BellOutlined />}
              onClick={() => handleToggleStatus(record)}
            />
          </Tooltip>
          <Popconfirm
            title="确定要删除这个公告吗？"
            description="删除后无法恢复"
            onConfirm={() => handleDelete(record.id)}
            okText="确定"
            cancelText="取消"
          >
            <Tooltip title="删除">
              <Button
                type="text"
                danger
                icon={<DeleteOutlined />}
              />
            </Tooltip>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <div style={{ padding: '24px' }}>
      <Card>
        <div style={{ marginBottom: 24 }}>
          <Row gutter={16} align="middle">
            <Col flex="auto">
              <Title level={3} style={{ margin: 0 }}>
                <BellOutlined style={{ marginRight: 8 }} />
                公告配置管理
              </Title>
              <Text type="secondary">
                管理系统公告，面向全体人员的通知配置
              </Text>
            </Col>
            <Col>
              <Button
                type="primary"
                icon={<PlusOutlined />}
                onClick={handleCreate}
                size="large"
              >
                创建公告
              </Button>
            </Col>
          </Row>
        </div>

        {/* 统计信息 */}
        <Row gutter={16} style={{ marginBottom: 24 }}>
          <Col span={8}>
            <Card>
              <Statistic
                title="总公告数"
                value={stats.total}
                prefix={<BellOutlined />}
              />
            </Card>
          </Col>
          <Col span={8}>
            <Card>
              <Statistic
                title="启用公告"
                value={stats.active}
                valueStyle={{ color: '#3f8600' }}
                prefix={<CheckCircleOutlined />}
              />
            </Card>
          </Col>
          <Col span={8}>
            <Card>
              <Statistic
                title="停用公告"
                value={stats.inactive}
                valueStyle={{ color: '#cf1322' }}
                prefix={<ExclamationCircleOutlined />}
              />
            </Card>
          </Col>
        </Row>

        {/* 公告列表 */}
        <Table
          columns={columns}
          dataSource={announcements}
          rowKey="id"
          loading={loading}
          pagination={{
            showSizeChanger: true,
            showQuickJumper: true,
            showTotal: (total) => `共 ${total} 条公告`,
          }}
          scroll={{ x: 1200 }}
        />
      </Card>

      {/* 创建/编辑模态框 */}
      <Modal
        title={editingAnnouncement ? '编辑公告' : '创建公告'}
        open={modalVisible}
        onCancel={() => {
          setModalVisible(false);
          resetForm();
        }}
        footer={null}
        width={800}
        destroyOnHidden
      >
        <Form
          form={form}
          layout="vertical"
          onFinish={handleSubmit}
          initialValues={{
            type: 'info',
            priority: 0,
            is_active: true,
          }}
        >
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                name="title"
                label="公告标题"
                rules={[{ required: true, message: '请输入公告标题' }]}
              >
                <Input placeholder="请输入公告标题" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                name="type"
                label="公告类型"
                rules={[{ required: true, message: '请选择公告类型' }]}
              >
                <Select placeholder="请选择公告类型">
                  <Option value="info">信息</Option>
                  <Option value="warning">警告</Option>
                  <Option value="success">成功</Option>
                  <Option value="error">错误</Option>
                </Select>
              </Form.Item>
            </Col>
          </Row>

          <Form.Item
            name="content"
            label="公告内容"
            rules={[{ required: true, message: '请输入公告内容' }]}
          >
            <TextArea
              rows={6}
              placeholder="请输入公告内容"
              showCount
              maxLength={1000}
            />
          </Form.Item>

          <Row gutter={16}>
            <Col span={8}>
              <Form.Item
                name="priority"
                label="优先级"
                rules={[{ required: true, message: '请选择优先级' }]}
              >
                <Select placeholder="请选择优先级">
                  <Option value={0}>基础</Option>
                  <Option value={1}>重要</Option>
                  <Option value={2}>紧急</Option>
                  <Option value={3}>特急</Option>
                </Select>
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item
                name="start_time"
                label="生效时间"
                rules={[{ required: true, message: '请选择生效时间' }]}
              >
                <DatePicker
                  showTime
                  format="YYYY-MM-DD HH:mm:ss"
                  placeholder="请选择生效时间"
                  style={{ width: '100%' }}
                />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item
                name="end_time"
                label="过期时间"
              >
                <DatePicker
                  showTime
                  format="YYYY-MM-DD HH:mm:ss"
                  placeholder="请选择过期时间（可选）"
                  style={{ width: '100%' }}
                />
              </Form.Item>
            </Col>
          </Row>

          <Form.Item
            name="is_active"
            label="状态"
            valuePropName="checked"
          >
            <Switch
              checkedChildren="启用"
              unCheckedChildren="停用"
            />
          </Form.Item>

          <Form.Item style={{ marginBottom: 0, textAlign: 'right' }}>
            <Space>
              <Button onClick={() => {
                setModalVisible(false);
                resetForm();
              }}>
                取消
              </Button>
              <Button type="primary" htmlType="submit">
                {editingAnnouncement ? '更新' : '创建'}
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default AnnouncementManagement; 