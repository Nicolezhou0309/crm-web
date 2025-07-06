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
  Tabs,
  Row,
  Col,
  Typography,

  Popconfirm,
  Checkbox
} from 'antd';
import {
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
  KeyOutlined,
} from '@ant-design/icons';
import { supabase } from '../supaClient';
import { useRolePermissions } from '../hooks/useRolePermissions';
import { PermissionGate } from '../components/PermissionGate';

const { Title, Text } = Typography;

const RolePermissionManagement: React.FC = () => {
  const { isSuperAdmin, isSystemAdmin } = useRolePermissions();
  const [roles, setRoles] = useState<any[]>([]);
  const [permissions, setPermissions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [roleModalVisible, setRoleModalVisible] = useState(false);

  const [assignRoleModalVisible, setAssignRoleModalVisible] = useState(false);
  const [editingRole, setEditingRole] = useState<any>(null);

  const [selectedUser, setSelectedUser] = useState<any>(null);
  const [form] = Form.useForm();

  const [assignForm] = Form.useForm();

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      
      // 获取角色
      const { data: rolesData, error: rolesError } = await supabase
        .from('roles')
        .select('*')
        .order('name');
      if (rolesError) throw rolesError;
      setRoles(rolesData || []);

      // 获取权限
      const { data: permissionsData, error: permissionsError } = await supabase
        .from('permissions')
        .select('*')
        .order('name');
      if (permissionsError) throw permissionsError;
      setPermissions(permissionsData || []);

    } catch (error) {
      console.error('获取数据失败:', error);
      message.error('获取数据失败');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateRole = async (values: any) => {
    try {
      const { error } = await supabase
        .from('roles')
        .insert({
          name: values.name,
          display_name: values.display_name,
          description: values.description,
          is_system: false
        })
        .select()
        .single();

      if (error) throw error;

      message.success('角色创建成功');
      setRoleModalVisible(false);
      form.resetFields();
      fetchData();
    } catch (error) {
      console.error('创建角色失败:', error);
      message.error('创建角色失败');
    }
  };

  const handleEditRole = async (role: any) => {
    setEditingRole(role);
    form.setFieldsValue({
      name: role.name,
      description: role.description,
    });
    // 查询该角色已分配的权限
    const { data, error } = await supabase
      .from('role_permissions')
      .select('permission_id')
      .eq('role_id', role.id);
    if (!error && data) {
      form.setFieldsValue({ permissions: data.map((item: any) => item.permission_id) });
    } else {
      form.setFieldsValue({ permissions: [] });
    }
    setRoleModalVisible(true);
  };

  const handleUpdateRole = async (values: any) => {
    try {
      // 1. 更新角色基本信息
      const { error } = await supabase
        .from('roles')
        .update({
          name: values.name,
          description: values.description
        })
        .eq('id', editingRole.id);
      if (error) throw error;

      // 2. 更新角色权限
      // 先删除原有权限
      await supabase.from('role_permissions').delete().eq('role_id', editingRole.id);
      // 再插入新权限
      if (values.permissions && values.permissions.length > 0) {
        const insertData = values.permissions.map((pid: string) => ({
          role_id: editingRole.id,
          permission_id: pid
        }));
        await supabase.from('role_permissions').insert(insertData);
      }

      message.success('角色更新成功');
      setRoleModalVisible(false);
      setEditingRole(null);
      form.resetFields();
      fetchData();
    } catch (error) {
      console.error('更新角色失败:', error);
      message.error('更新角色失败');
    }
  };

  const handleDeleteRole = async (roleId: string) => {
    try {
      const { error } = await supabase
        .from('roles')
        .delete()
        .eq('id', roleId);

      if (error) throw error;

      message.success('角色删除成功');
      fetchData();
    } catch (error) {
      console.error('删除角色失败:', error);
      message.error('删除角色失败');
    }
  };

  const handleAssignRole = async (values: any) => {
    try {
      const { error } = await supabase.rpc('assign_role_to_user', {
        target_user_id: selectedUser.user_id,
        role_name: values.role_name,
        expires_at: values.expires_at || null
      });

      if (error) throw error;

      message.success('角色分配成功');
      setAssignRoleModalVisible(false);
      setSelectedUser(null);
      assignForm.resetFields();
      fetchData();
    } catch (error) {
      console.error('分配角色失败:', error);
      message.error('分配角色失败');
    }
  };

  const roleColumns = [
    {
      title: '角色名称',
      dataIndex: 'name',
      key: 'name',
      render: (_text: string, record: any) => (
        <Space>
          <Text strong>{_text}</Text>
          {record.is_system && <Tag color="blue">系统</Tag>}
        </Space>
      )
    },
    {
      title: '描述',
      dataIndex: 'description',
      key: 'description',
      render: (text: string) => <span>{text}</span>
    },
    {
      title: '用户数量',
      dataIndex: 'user_count',
      key: 'user_count',
      render: (text: number) => <span>{text || 0}</span>
    },
    {
      title: '操作',
      key: 'action',
      render: (_: any, record: any) => (
      <Space>
        <PermissionGate permission="role:update">
          <Button
            type="link"
            icon={<EditOutlined />}
            onClick={() => handleEditRole(record)}
          >
            编辑
          </Button>
        </PermissionGate>
        {!record.is_system && (
          <PermissionGate permission="role:delete">
            <Popconfirm
              title="确定要删除这个角色吗？"
              onConfirm={() => handleDeleteRole(record.id)}
            >
              <Button type="link" danger icon={<DeleteOutlined />}>
                删除
              </Button>
            </Popconfirm>
          </PermissionGate>
        )}
      </Space>
    )
  }];

  // 角色管理内容
  const roleTabContent = (
    <Card
      title="角色列表"
      extra={
        <PermissionGate permission="role:create">
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={() => {
              setEditingRole(null);
              form.resetFields();
              setRoleModalVisible(true);
            }}
          >
            创建角色
          </Button>
        </PermissionGate>
      }
    >
      <Table
        columns={roleColumns}
        dataSource={roles}
        rowKey="id"
        loading={loading}
        pagination={false}
      />
    </Card>
  );

  if (!isSuperAdmin && !isSystemAdmin) {
    return (
      <Card>
        <div style={{ textAlign: 'center', padding: '40px 0' }}>
          <KeyOutlined style={{ fontSize: '48px', color: '#d9d9d9', marginBottom: '16px' }} />
          <Title level={4}>您没有权限管理角色和权限</Title>
          <Text type="secondary">请联系系统管理员获取相应权限</Text>
        </div>
      </Card>
    );
  }

  return (
    <div style={{ padding: '24px' }}>
      <Title level={3} style={{ marginBottom: '24px' }}>
        <KeyOutlined style={{ marginRight: '8px' }} />
        角色权限管理
      </Title>
      <Tabs
        defaultActiveKey="1"
        items={[
          {
            key: '1',
            label: '角色管理',
            children: roleTabContent,
          },
        ]}
      />

      {/* 创建/编辑角色弹窗 */}
      <Modal
        title={editingRole ? '编辑角色' : '创建角色'}
        open={roleModalVisible}
        onCancel={() => {
          setRoleModalVisible(false);
          setEditingRole(null);
          form.resetFields();
        }}
        onOk={() => form.submit()}
        destroyOnClose
      >
        <Form form={form} onFinish={editingRole ? handleUpdateRole : handleCreateRole} layout="vertical">
          <Form.Item
            name="name"
            label="角色名称"
            rules={[{ required: true, message: '请输入角色名称' }]}
          >
            <Input />
          </Form.Item>
          <Form.Item
            name="description"
            label="描述"
            rules={[{ required: true, message: '请输入描述' }]}
          >
            <Input />
          </Form.Item>
          <Form.Item
            name="permissions"
            label="权限配置"
          >
            <Checkbox.Group style={{ width: '100%' }}>
              <Row gutter={[8, 8]}>
                {permissions.map((p: any) => (
                  <Col span={12} key={p.id}>
                    <Checkbox value={p.id}>{p.description || p.name}</Checkbox>
                  </Col>
                ))}
              </Row>
            </Checkbox.Group>
          </Form.Item>
        </Form>
      </Modal>

      {/* 分配角色弹窗 */}
      <Modal
        title="分配角色"
        open={assignRoleModalVisible}
        onCancel={() => {
          setAssignRoleModalVisible(false);
          setSelectedUser(null);
          assignForm.resetFields();
        }}
        footer={null}
      >
        <Form
          form={assignForm}
          layout="vertical"
          onFinish={handleAssignRole}
        >
          <Form.Item label="用户">
            <Text>{selectedUser?.nickname} ({selectedUser?.email})</Text>
          </Form.Item>
          <Form.Item
            name="role_name"
            label="选择角色"
            rules={[{ required: true, message: '请选择角色' }]}
          >
            <Select placeholder="请选择角色">
              {roles.map(role => (
                <Select.Option key={role.name} value={role.name}>
                  {role.display_name}
                </Select.Option>
              ))}
            </Select>
          </Form.Item>
          <Form.Item
            name="expires_at"
            label="过期时间"
          >
            <Input type="datetime-local" />
          </Form.Item>
          <Form.Item>
            <Space>
              <Button type="primary" htmlType="submit">
                分配
              </Button>
              <Button onClick={() => {
                setAssignRoleModalVisible(false);
                setSelectedUser(null);
                assignForm.resetFields();
              }}>
                取消
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default RolePermissionManagement; 