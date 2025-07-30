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
  Checkbox,
  Badge} from 'antd';
import {
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
  KeyOutlined,
  UserOutlined,
  TeamOutlined,
  SafetyCertificateOutlined,
  SearchOutlined} from '@ant-design/icons';
import { supabase } from '../supaClient';
import { useRolePermissions } from '../hooks/useRolePermissions';

const { Title, Text } = Typography;

const RolePermissionManagement: React.FC = () => {
  const { isSuperAdmin, isSystemAdmin } = useRolePermissions();
  
  // 基础数据状态
  const [roles, setRoles] = useState<any[]>([]);
  const [permissions, setPermissions] = useState<any[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  
  // 权限点配置状态
  const [permissionModalVisible, setPermissionModalVisible] = useState(false);
  const [editingPermission, setEditingPermission] = useState<any>(null);
  const [permissionForm] = Form.useForm();
  
  // 角色管理状态
  const [roleModalVisible, setRoleModalVisible] = useState(false);
  const [editingRole, setEditingRole] = useState<any>(null);
  const [roleForm] = Form.useForm();
  const [rolePermissions, setRolePermissions] = useState<any[]>([]);
  const [selectedPermissions, setSelectedPermissions] = useState<string[]>([]);
  
  // 人员角色配置状态
  const [userRoleModalVisible, setUserRoleModalVisible] = useState(false);
  const [selectedUser, setSelectedUser] = useState<any>(null);
  const [userRoleForm] = Form.useForm();
  const [userRoleMappings, setUserRoleMappings] = useState<any[]>([]);
  
  // 搜索状态
  const [userSearchText, setUserSearchText] = useState('');
  const [filteredUsers, setFilteredUsers] = useState<any[]>([]);

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

      // 获取用户列表
      const { data: usersData, error: usersError } = await supabase
        .from('users_profile')
        .select('id, user_id, nickname, email, status')
        .order('nickname');
      if (usersError) throw usersError;
      setUsers(usersData || []);
      setFilteredUsers(usersData || []);

      // 获取用户角色关联
      const { data: userRolesData, error: userRolesError } = await supabase
        .from('user_roles')
        .select(`
          user_id,
          role_id,
          roles(name, description)
        `);
      if (userRolesError) throw userRolesError;
      setUserRoleMappings(userRolesData || []);
      
      // 获取角色权限关联
      const { data: rolePermissionsData, error: rolePermissionsError } = await supabase
        .from('role_permissions')
        .select(`
          role_id,
          permission_id,
          roles(name),
          permissions(name, resource, action)
        `);
      if (rolePermissionsError) {
      } else {
        setRolePermissions(rolePermissionsData || []);
      }

    } catch (error) {
      message.error('获取数据失败');
    } finally {
      setLoading(false);
    }
  };

  // 搜索处理函数
  const handleUserSearch = (searchText: string) => {
    setUserSearchText(searchText);
    if (!searchText.trim()) {
      setFilteredUsers(users);
      return;
    }
    
    const filtered = users.filter(user => 
      user.nickname?.toLowerCase().includes(searchText.toLowerCase()) ||
      user.email?.toLowerCase().includes(searchText.toLowerCase())
    );
    setFilteredUsers(filtered);
  };

  // ==================== 权限点配置 ====================
  const handleCreatePermission = async (values: any) => {
    try {
      const { error } = await supabase
        .from('permissions')
        .insert({
          name: values.name,
          description: values.description,
          resource: values.resource,
          action: values.action
        });

      if (error) throw error;

      message.success('权限点创建成功');
      setPermissionModalVisible(false);
      permissionForm.resetFields();
      fetchData();
    } catch (error: any) {
      message.error(`创建权限点失败: ${error.message || '未知错误'}`);
    }
  };

  const handleEditPermission = async (permission: any) => {
    setEditingPermission(permission);
    setPermissionModalVisible(true);
    
    setTimeout(() => {
      permissionForm.setFieldsValue({
        name: permission.name,
        description: permission.description,
        resource: permission.resource,
        action: permission.action
      });
    }, 100);
  };

  const handleUpdatePermission = async (values: any) => {
    try {
      const { error } = await supabase
        .from('permissions')
        .update({
          name: values.name,
          description: values.description,
          resource: values.resource,
          action: values.action
        })
        .eq('id', editingPermission.id);
      if (error) throw error;

      message.success('权限点更新成功');
      setPermissionModalVisible(false);
      setEditingPermission(null);
      permissionForm.resetFields();
      fetchData();
    } catch (error: any) {
      message.error(`更新权限点失败: ${error.message || '未知错误'}`);
    }
  };

  const handleDeletePermission = async (permissionId: string) => {
    try {
      const { error } = await supabase
        .from('permissions')
        .delete()
        .eq('id', permissionId);

      if (error) throw error;

      message.success('权限点删除成功');
      fetchData();
    } catch (error: any) {
      message.error(`删除权限点失败: ${error.message || '未知错误'}`);
    }
  };

  const permissionColumns = [
    {
      title: '权限信息',
      key: 'permission_info',
      render: (_: any, record: any) => (
        <div>
          <div style={{ marginBottom: '4px' }}>
            <Text strong style={{ fontSize: '14px' }}>{record.name}</Text>
          </div>
          <div style={{ fontSize: '12px', color: '#666', marginBottom: '6px' }}>
            {record.description}
          </div>
          <div>
            <Tag color="blue" style={{ marginRight: '4px' }}>{record.resource}</Tag>
            <Tag color="green">{record.action}</Tag>
          </div>
        </div>
      )
    },
    {
      title: '操作',
      key: 'action',
      width: 120,
      render: (_: any, record: any) => (
        <Space>
          <Button
            type="link"
            size="small"
            icon={<EditOutlined />}
            onClick={() => handleEditPermission(record)}
          >
            编辑
          </Button>
          <Popconfirm
            title="确定要删除这个权限点吗？"
            onConfirm={() => handleDeletePermission(record.id)}
          >
            <Button type="link" size="small" danger icon={<DeleteOutlined />}>
              删除
            </Button>
          </Popconfirm>
        </Space>
      )
    }
  ];

  // ==================== 角色管理 ====================
  const handleCreateRole = async (values: any) => {
    try {
      const { data: newRole, error } = await supabase
        .from('roles')
        .insert({
          name: values.name,
          description: values.description
        })
        .select()
        .single();

      if (error) throw error;

      // 如果有权限配置，为角色分配权限
      let permissionsArray: string[] = [];
      
      
      if (Array.isArray(selectedPermissions) && selectedPermissions.length > 0) {
        permissionsArray = selectedPermissions;
      } else {
        // 备用方案：从表单中获取权限值
        const currentPermissions = roleForm.getFieldValue('permissions');
        
        if (Array.isArray(currentPermissions) && currentPermissions.length > 0) {
          permissionsArray = currentPermissions;
        } else if (Array.isArray(values.permissions) && values.permissions.length > 0) {
          permissionsArray = values.permissions;
        } else if (values.permissions) {
          // 如果不是数组，尝试转换为数组
          permissionsArray = [values.permissions];
        }
      }
      
      
      if (permissionsArray.length > 0) {
        
        // 批量插入所有权限
        const permissionsToInsert = permissionsArray.map(permissionId => ({
          role_id: newRole.id,
          permission_id: permissionId
        }));
        
        const { error: insertError } = await supabase
          .from('role_permissions')
          .insert(permissionsToInsert)
          .select();
        
        if (insertError) {
        } else {
        }
      } else {
      }

      // 验证权限是否真的被插入
      const { error: verifyError } = await supabase
        .from('role_permissions')
        .select(`
          role_id,
          permission_id,
          permissions(name, resource, action)
        `)
        .eq('role_id', newRole.id);
      
      if (verifyError) {
      } else {
      }
      
      message.success('角色创建成功');
      setRoleModalVisible(false);
      roleForm.resetFields();
      fetchData();
    } catch (error: any) {
      message.error(`创建角色失败: ${error.message || '未知错误'}`);
    }
  };

  const handleEditRole = async (role: any) => {
    setEditingRole(role);
    setRoleModalVisible(true);
    
    setTimeout(async () => {
      // 设置基本信息
      roleForm.setFieldsValue({
        name: role.name,
        description: role.description,
      });
      
      // 查询该角色已分配的权限
      const { data: rolePerms, error } = await supabase
        .from('role_permissions')
        .select('permission_id')
        .eq('role_id', role.id);
        
      if (error) {
        roleForm.setFieldsValue({ permissions: [] });
        setSelectedPermissions([]);
      } else {
        const permissionIds = rolePerms?.map((item: any) => item.permission_id) || [];
        roleForm.setFieldsValue({ permissions: permissionIds });
        setSelectedPermissions(permissionIds);
      }
    }, 100);
  };

  const handleUpdateRole = async (values: any) => {
    try {
      
      // 在提交前验证表单中的权限值
      
      // 1. 更新角色基本信息
      const { error: updateError } = await supabase
        .from('roles')
        .update({
          name: values.name,
          description: values.description
        })
        .eq('id', editingRole.id);
      if (updateError) throw updateError;

      // 2. 获取当前角色的权限
      const { data: currentRolePermissions, error: currentError } = await supabase
        .from('role_permissions')
        .select(`
          permission_id,
          permissions(resource, action)
        `)
        .eq('role_id', editingRole.id);
      
      if (currentError) {
      }
      

      // 3. 获取新的权限数组
      let newPermissionsArray: string[] = [];
      
      // 优先使用状态中存储的权限选择
      
      if (Array.isArray(selectedPermissions) && selectedPermissions.length > 0) {
        newPermissionsArray = selectedPermissions;
      } else {
        // 备用方案：从表单中获取权限值
        const currentPermissions = roleForm.getFieldValue('permissions');
        
        if (Array.isArray(currentPermissions) && currentPermissions.length > 0) {
          newPermissionsArray = currentPermissions;
        } else if (Array.isArray(values.permissions) && values.permissions.length > 0) {
          newPermissionsArray = values.permissions;
        } else if (values.permissions) {
          // 如果不是数组，尝试转换为数组
          newPermissionsArray = [values.permissions];
        }
      }
      
      
      // 4. 计算需要添加和删除的权限
      const currentPermissionIds = currentRolePermissions?.map((rp: any) => rp.permission_id) || [];
      const newPermissionIds = newPermissionsArray;
      
      
      // 需要添加的权限（在新列表中但不在当前列表中）
      const permissionsToAdd = newPermissionIds.filter(id => !currentPermissionIds.includes(id));
      // 需要删除的权限（在当前列表中但不在新列表中）
      const permissionsToRemove = currentPermissionIds.filter(id => !newPermissionIds.includes(id));
      
      
      // 5. 删除需要移除的权限
      if (permissionsToRemove.length > 0) {
        const { error: deleteError } = await supabase
          .from('role_permissions')
          .delete()
          .eq('role_id', editingRole.id)
          .in('permission_id', permissionsToRemove);
        
        if (deleteError) { 
        } else {
        }
      }
      
      // 6. 添加新的权限
      if (permissionsToAdd.length > 0) {
        
        // 批量插入新权限
        const permissionsToInsert = permissionsToAdd.map(permissionId => ({
          role_id: editingRole.id,
          permission_id: permissionId
        }));
        
        const { error: insertError } = await supabase
          .from('role_permissions')
          .insert(permissionsToInsert)
          .select();
        
        if (insertError) {
        } else {
        }
      }
      
      if (permissionsToAdd.length === 0 && permissionsToRemove.length === 0) {
      }

      // 验证权限是否真的被插入
      const { error: verifyError } = await supabase
        .from('role_permissions')
        .select(`
          role_id,
          permission_id,
          permissions(name, resource, action)
        `)
        .eq('role_id', editingRole.id);
      
      if (verifyError) {
      } else {
      }
      
      message.success('角色更新成功');
      setRoleModalVisible(false);
      setEditingRole(null);
      roleForm.resetFields();
      fetchData();
    } catch (error: any) {
      message.error(`更新角色失败: ${error.message || '未知错误'}`);
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
    } catch (error: any) {
      message.error(`删除角色失败: ${error.message || '未知错误'}`);
    }
  };

  // 获取角色的权限列表
  const getRolePermissions = (roleId: string) => {
    return rolePermissions
      .filter(rp => rp.role_id === roleId)
      .map(rp => rp.permissions);
  };

    const roleColumns = [
    {
      title: '角色信息',
      key: 'role_info',
      width: '25%',
      render: (_: any, record: any) => (
        <div>
          <div style={{ marginBottom: '4px' }}>
            <Space>
              <Text strong style={{ fontSize: '14px' }}>{record.name}</Text>
            </Space>
          </div>
          <div style={{ fontSize: '12px', color: '#666' }}>
            {record.description}
          </div>
        </div>
      )
    },
    {
      title: '权限',
      key: 'permissions',
      width: '50%',
      render: (_: any, record: any) => {
        const rolePerms = getRolePermissions(record.id);
        return (
          <div>
            {rolePerms.length > 0 ? (
              (() => {
                // 按resource分组权限
                const groupedPerms = rolePerms.reduce((groups: any, perm: any) => {
                  const resource = perm.resource;
                  if (!groups[resource]) {
                    groups[resource] = [];
                  }
                  groups[resource].push(perm);
                  return groups;
                }, {});

                const resourceCount = Object.keys(groupedPerms).length;
                const totalPerms = rolePerms.length;

                return (
                  <div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', marginBottom: '4px' }}>
                      {Object.entries(groupedPerms).slice(0, 2).map(([resource, perms]: [string, any]) => (
                        <Tag key={resource} color="blue" style={{ marginBottom: '2px' }}>
                          {resource} ({perms.length})
                        </Tag>
                      ))}
                      {resourceCount > 2 && (
                        <Tag color="default">
                          +{resourceCount - 2} 资源
                        </Tag>
                      )}
                    </div>
                    <div style={{ fontSize: '11px', color: '#666' }}>
                      共 {totalPerms} 个权限
                    </div>
                  </div>
                );
              })()
            ) : (
              <Text type="secondary" style={{ fontSize: '12px' }}>无权限</Text>
            )}
          </div>
        );
      }
    },
    {
      title: '用户数量',
      key: 'user_count',
      width: '10%',
      render: (_: any, record: any) => {
        // 计算该角色实际分配的用户数量
        const userCount = userRoleMappings.filter((ur: any) => ur.role_id === record.id).length;
        return (
          <Text type="secondary" style={{ fontSize: '12px' }}>
            {userCount} 人
          </Text>
        );
      }
    },
    {
      title: '操作',
      key: 'action',
      width: '15%',
      render: (_: any, record: any) => (
        <Space>
          <Button
            type="link"
            size="small"
            icon={<EditOutlined />}
            onClick={() => handleEditRole(record)}
          >
            编辑
          </Button>
          <Popconfirm
            title="确定要删除这个角色吗？"
            onConfirm={() => handleDeleteRole(record.id)}
          >
            <Button type="link" size="small" danger icon={<DeleteOutlined />}>
              删除
            </Button>
          </Popconfirm>
        </Space>
      )
    }
  ];

  // ==================== 人员角色配置 ====================
  const handleAssignUserRole = async (values: any) => {
    try {
      // 获取角色ID
      const { data: roleData, error: roleError } = await supabase
        .from('roles')
        .select('id')
        .eq('name', values.role_name)
        .single();

      if (roleError || !roleData) {
        throw new Error('角色不存在');
      }

      // 直接插入用户角色关联
      const { error } = await supabase
        .from('user_roles')
        .insert({
          user_id: selectedUser.user_id,
          role_id: roleData.id
        });

      if (error) throw error;

      message.success('角色分配成功');
      setUserRoleModalVisible(false);
      setSelectedUser(null);
      userRoleForm.resetFields();
      fetchData();
    } catch (error: any) { 
      message.error(`分配角色失败: ${error.message || '未知错误'}`);
    }
  };

  const userColumns = [
    {
      title: '用户信息',
      key: 'user',
      render: (record: any) => (
        <div>
          <div style={{ marginBottom: '4px' }}>
            <Space>
              <UserOutlined style={{ color: '#1890ff' }} />
              <Text strong style={{ fontSize: '14px' }}>
                {record.nickname || '未设置昵称'}
              </Text>
            </Space>
          </div>
          <div style={{ fontSize: '12px', color: '#666' }}>
            {record.email}
          </div>
        </div>
      )
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 100,
      render: (status: string) => (
        <Badge 
          status={status === 'active' ? 'success' : 'default'} 
          text={status === 'active' ? '活跃' : '非活跃'} 
        />
      )
    },
    {
      title: '当前角色',
      key: 'roles',
      render: (record: any) => {
        const userRoles = userRoleMappings.filter((ur: any) => ur.user_id === record.user_id);
        return (
          <div style={{ maxWidth: '250px' }}>
            {userRoles.length > 0 ? (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                {userRoles.slice(0, 2).map((ur: any) => (
                  <Tag key={ur.role_id} color="blue">
                    {ur.roles?.name || '未知角色'}
                  </Tag>
                ))}
                {userRoles.length > 2 && (
                  <Tag color="default">
                    +{userRoles.length - 2} 更多
                  </Tag>
                )}
              </div>
            ) : (
              <Text type="secondary" style={{ fontSize: '12px' }}>无角色</Text>
            )}
          </div>
        );
      }
    },
    {
      title: '操作',
      key: 'action',
      width: 120,
      render: (record: any) => (
        <Button
          type="link"
          size="small"
          icon={<TeamOutlined />}
          onClick={() => {
            setSelectedUser(record);
            setUserRoleModalVisible(true);
          }}
        >
          分配角色
        </Button>
      )
    }
  ];

  // ==================== 页面内容 ====================
  const permissionTabContent = (
    <Card
      title="权限点配置"
      extra={
        <Button
          type="primary"
          icon={<PlusOutlined />}
          onClick={() => {
            setEditingPermission(null);
            setPermissionModalVisible(true);
            setTimeout(() => {
              permissionForm.resetFields();
            }, 100);
          }}
        >
          创建权限点
        </Button>
      }
    >
      {(() => {
        // 按resource分组权限
        const groupedPermissions = permissions.reduce((groups: any, permission: any) => {
          const resource = permission.resource;
          if (!groups[resource]) {
            groups[resource] = [];
          }
          groups[resource].push(permission);
          return groups;
        }, {});

        return Object.entries(groupedPermissions).map(([resource, perms]: [string, any]) => (
          <div key={resource} style={{ marginBottom: '24px' }}>
            {/* 资源分组标题 */}
            <div style={{ 
              marginBottom: '12px',
              padding: '8px 0',
              borderBottom: '2px solid #f0f0f0',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center'
            }}>
              <div>
                <Text strong style={{ fontSize: '15px', color: '#262626' }}>
                  {resource}
                </Text>
                <Text type="secondary" style={{ fontSize: '12px', marginLeft: '8px' }}>
                  {perms.length} 个权限
                </Text>
              </div>
            </div>
            
            {/* 该资源下的权限表格 */}
            <Table
              columns={permissionColumns}
              dataSource={perms}
              rowKey="id"
              loading={loading}
              pagination={false}
              size="small"
              style={{ backgroundColor: 'white' }}
            />
          </div>
        ));
      })()}
    </Card>
  );

  const roleTabContent = (
    <Card
      title="角色管理"
      extra={
        <Button
          type="primary"
          icon={<PlusOutlined />}
          onClick={() => {
            setEditingRole(null);
            setRoleModalVisible(true);
            setSelectedPermissions([]);
            roleForm.resetFields();
          }}
        >
          创建角色
        </Button>
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

  const userRoleTabContent = (
    <Card title="人员角色配置">
      <div style={{ marginBottom: '16px' }}>
        <Input.Search
          placeholder="搜索用户昵称或邮箱"
          allowClear
          enterButton={<SearchOutlined />}
          size="large"
          value={userSearchText}
          onChange={(e) => handleUserSearch(e.target.value)}
          onSearch={handleUserSearch}
          style={{ maxWidth: '400px' }}
        />
      </div>
      <Table
        columns={userColumns}
        dataSource={filteredUsers}
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
            label: (
              <span>
                <SafetyCertificateOutlined />
                权限点配置
              </span>
            ),
            children: permissionTabContent,
          },
          {
            key: '2',
            label: (
              <span>
                <KeyOutlined />
                角色管理
              </span>
            ),
            children: roleTabContent,
          },
          {
            key: '3',
            label: (
              <span>
                <TeamOutlined />
                人员角色配置
              </span>
            ),
            children: userRoleTabContent,
          },
        ]}
      />

      {/* 权限点配置弹窗 */}
      <Modal
        title={editingPermission ? '编辑权限点' : '创建权限点'}
        open={permissionModalVisible}
        onCancel={() => {
          setPermissionModalVisible(false);
          setEditingPermission(null);
          permissionForm.resetFields();
        }}
        onOk={() => permissionForm.submit()}
        destroyOnHidden
      >
        <Form form={permissionForm} onFinish={editingPermission ? handleUpdatePermission : handleCreatePermission} layout="vertical">
          <Form.Item
            name="name"
            label="权限名称"
            rules={[{ required: true, message: '请输入权限名称' }]}
          >
            <Input placeholder="例如：lead_manage" />
          </Form.Item>
          <Form.Item
            name="description"
            label="权限描述"
            rules={[{ required: true, message: '请输入权限描述' }]}
          >
            <Input placeholder="例如：线索管理权限" />
          </Form.Item>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                name="resource"
                label="资源"
                rules={[{ required: true, message: '请输入资源名称' }]}
              >
                <Input placeholder="例如：leads" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                name="action"
                label="操作"
                rules={[{ required: true, message: '请输入操作名称' }]}
              >
                <Input placeholder="例如：manage" />
              </Form.Item>
            </Col>
          </Row>
        </Form>
      </Modal>

      {/* 角色管理弹窗 */}
      <Modal
        title={editingRole ? '编辑角色' : '创建角色'}
        open={roleModalVisible}
        onCancel={() => {
          setRoleModalVisible(false);
          setEditingRole(null);
          setSelectedPermissions([]);
          roleForm.resetFields();
        }}
        onOk={() => roleForm.submit()}
        width={600}
        destroyOnHidden
      >
        <Form form={roleForm} onFinish={editingRole ? handleUpdateRole : handleCreateRole} layout="vertical">
          <Form.Item
            name="name"
            label="角色名称"
            rules={[{ required: true, message: '请输入角色名称' }]}
          >
            <Input placeholder="例如：manager" />
          </Form.Item>
          <Form.Item
            name="description"
            label="描述"
            rules={[{ required: true, message: '请输入描述' }]}
          >
            <Input placeholder="例如：部门经理角色" />
          </Form.Item>
                    <Form.Item
            name="permissions"
            label="选择权限"
          >
            <div style={{ 
              marginBottom: '8px', 
              padding: '6px 10px',
              backgroundColor: '#f6ffed',
              border: '1px solid #b7eb8f',
              borderRadius: '4px',
              fontSize: '11px',
              color: '#52c41a'
            }}>
              ✓ 已选择 {selectedPermissions.length} 个权限
            </div>
            <div style={{ 
              maxHeight: '400px', 
              overflowY: 'auto', 
              padding: '8px',
              backgroundColor: '#fafafa',
              borderRadius: '6px'
            }}>
              <Checkbox.Group 
                style={{ width: '100%' }}
                value={selectedPermissions}
                onChange={(checkedValues) => {
                  
                  // 确保权限值被正确设置到表单中
                  roleForm.setFieldsValue({ permissions: checkedValues });
                  // 同时更新状态
                  setSelectedPermissions(checkedValues);
                }}
              >
                {(() => {
                  // 将所有权限展平，按resource分组显示
                  const groupedPermissions = permissions.reduce((groups: any, permission: any) => {
                    const resource = permission.resource;
                    if (!groups[resource]) {
                      groups[resource] = [];
                    }
                    groups[resource].push(permission);
                    return groups;
                  }, {});

                  // 创建分组标题和权限项的混合数组
                  const allItems: any[] = [];
                  Object.entries(groupedPermissions).forEach(([resource, perms]: [string, any]) => {
                    // 添加分组标题
                    allItems.push({
                      type: 'header',
                      resource,
                      perms
                    });
                    // 添加该分组的所有权限
                    perms.forEach((permission: any) => {
                      allItems.push({
                        type: 'permission',
                        permission,
                        resource
                      });
                    });
                  });

                  // 使用双栏布局渲染所有项目
                  return (
                    <div>
                      {(() => {
                        let currentRow: any[] = [];
                        const rows: any[][] = [];
                        
                        allItems.forEach((item: any) => {
                          if (item.type === 'header') {
                            // 如果有未完成的权限行，先处理
                            if (currentRow.length > 0) {
                              rows.push(currentRow);
                              currentRow = [];
                            }
                            // 分组标题单独一行
                            rows.push([item]);
                          } else {
                            // 权限项添加到当前行
                            currentRow.push(item);
                            if (currentRow.length === 2) {
                              rows.push(currentRow);
                              currentRow = [];
                            }
                          }
                        });
                        
                        // 处理最后一个不完整的行
                        if (currentRow.length > 0) {
                          rows.push(currentRow);
                        }
                        
                        return rows.map((row: any[], rowIndex: number) => (
                          <Row gutter={[12, 4]} key={rowIndex} style={{ marginBottom: '4px' }}>
                            {row.map((item: any, colIndex: number) => (
                              <Col span={item.type === 'header' ? 24 : 12} key={colIndex}>
                                {item.type === 'header' ? (
                                  // 分组标题 - 占满整行
                                                                    <div style={{ 
                                    marginTop: rowIndex > 0 ? '8px' : '0',
                                    marginBottom: '4px',
                                    padding: '6px 10px',
                                    backgroundColor: '#f8f9fa',
                                    borderRadius: '4px'
                                  }}>
                                    <div>
                                      <Text strong style={{ fontSize: '13px', color: '#262626' }}>
                                        {item.resource}
                                      </Text>
                                      <Text type="secondary" style={{ fontSize: '11px', marginLeft: '6px' }}>
                                        {item.perms.length} 个权限
                                      </Text>
                                    </div>
                                  </div>
                                                                ) : (
                                  // 权限项 - 在双栏中显示
                                  <Checkbox value={item.permission.id} style={{ width: '100%' }}>
                                    <div style={{ 
                                      display: 'flex', 
                                      alignItems: 'center', 
                                      justifyContent: 'space-between',
                                      padding: '6px 10px',
                                      backgroundColor: 'white',
                                      borderRadius: '4px',
                                      transition: 'all 0.2s',
                                      border: '1px solid transparent',
                                      marginBottom: '2px'
                                    }}>
                                      <div style={{ flex: 1, marginRight: '8px' }}>
                                        <div style={{ 
                                          fontWeight: '500', 
                                          fontSize: '12px', 
                                          color: '#262626',
                                          lineHeight: '1.3'
                                        }}>
                                          {item.permission.description || item.permission.name}
                                        </div>
                                      </div>
                                      <Tag color="green" style={{ fontSize: '9px', padding: '0 4px', flexShrink: 0 }}>
                                        {item.permission.action}
                                      </Tag>
                                    </div>
                                  </Checkbox>
                                )}
                              </Col>
                            ))}
                          </Row>
                        ));
                      })()}
                    </div>
                  );
                })()}
              </Checkbox.Group>
            </div>
          </Form.Item>
        </Form>
      </Modal>

      {/* 人员角色配置弹窗 */}
      <Modal
        title="分配角色"
        open={userRoleModalVisible}
        onCancel={() => {
          setUserRoleModalVisible(false);
          setSelectedUser(null);
          userRoleForm.resetFields();
        }}
        footer={null}
        destroyOnHidden
      >
        <Form
          form={userRoleForm}
          layout="vertical"
          onFinish={handleAssignUserRole}
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
                  {role.name}
                </Select.Option>
              ))}
            </Select>
          </Form.Item>
          <Form.Item>
            <Space>
              <Button type="primary" htmlType="submit">
                分配
              </Button>
              <Button onClick={() => {
                setUserRoleModalVisible(false);
                setSelectedUser(null);
                userRoleForm.resetFields();
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