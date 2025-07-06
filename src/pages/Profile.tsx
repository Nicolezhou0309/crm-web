import { Form, Input, Button, message, Card, Tag, Divider, List, Typography, Space, Badge } from 'antd';
import { useEffect, useState } from 'react';
import { supabase } from '../supaClient';
import { useRolePermissions } from '../hooks/useRolePermissions';
import { 
  UserOutlined, 
  KeyOutlined, 
  SafetyCertificateOutlined,
  ClockCircleOutlined,
  CheckCircleOutlined,
  ExclamationCircleOutlined
} from '@ant-design/icons';

const { Title, Text } = Typography;

const Profile = () => {
  const [form] = Form.useForm();
  const [nameForm] = Form.useForm();
  const [emailForm] = Form.useForm();
  const [user, setUser] = useState<any>(null);
  const [email, setEmail] = useState('');
  const [department, setDepartment] = useState<string>('');
  
  // 使用角色权限Hook
  const { 
    userRoles, 
    userPermissions, 
    loading, 
    isSuperAdmin, 
    isSystemAdmin,

    getPermissionsByCategory,
    getExpiringRoles
  } = useRolePermissions();

  // 获取当前用户信息
  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (data.user) {
        setUser(data.user);
        setEmail(data.user.email || '');
        nameForm.setFieldsValue({ name: data.user.user_metadata?.name || '' });
      }
    });
  }, [nameForm]);

  // 监听email变化，同步到邮箱表单
  useEffect(() => {
    if (email) {
      emailForm.setFieldsValue({ email });
    }
  }, [email, emailForm]);

  // 获取当前用户部门
  useEffect(() => {
    const fetchDepartment = async () => {
      const { data: userData } = await supabase.auth.getUser();
      const userId = userData?.user?.id;
      if (!userId) return;
      const { data: profile } = await supabase
        .from('users_profile')
        .select('organization_id')
        .eq('user_id', userId)
        .single();
      if (profile?.organization_id) {
        const { data: org } = await supabase
          .from('organizations')
          .select('name')
          .eq('id', profile.organization_id)
          .single();
        setDepartment(org?.name || '');
      } else {
        setDepartment('未分配');
      }
    };
    fetchDepartment();
  }, []);

  // 修改名称
  const handleChangeName = async (values: any) => {
    const { name } = values;
    const { error } = await supabase.auth.updateUser({ data: { name } });
    if (error) {
      message.error(error.message);
    } else {
      message.success('名称修改成功');
      setUser((u: any) => ({ ...u, user_metadata: { ...u.user_metadata, name } }));
    }
  };

  // 修改密码
  const handleChangePassword = async (values: any) => {
    const { oldPassword, password } = values;
    const { error: loginError } = await supabase.auth.signInWithPassword({
      email,
      password: oldPassword,
    });
    if (loginError) {
      message.error('旧密码错误，请重新输入');
      return;
    }
    const { error } = await supabase.auth.updateUser({ password });
    if (error) {
      message.error(error.message);
    } else {
      message.success('密码修改成功，请重新登录');
      await supabase.auth.signOut();
      window.location.href = '/login';
    }
  };

  // 修改邮箱，增加唯一性校验
  const handleChangeEmail = async (values: any) => {
    const { email: newEmail } = values;
    // 唯一性校验
    const { data: exist } = await supabase
      .from('users_profile')
      .select('user_id')
      .eq('email', newEmail)
      .limit(1);
    if (exist && exist.length > 0) {
      message.error('该邮箱已被注册');
      return;
    }
    const { error } = await supabase.auth.updateUser({ email: newEmail });
    if (error) {
      message.error(error.message);
    } else {
      // 同步 users_profile.email
      if (user) {
        await supabase.from('users_profile').update({ email: newEmail }).eq('user_id', user.id);
      }
      message.success('邮箱修改成功，请前往新邮箱查收验证邮件');
      setEmail(newEmail);
    }
  };

  // 获取即将过期的角色
  const expiringRoles = getExpiringRoles(7);

  // 获取权限按分类分组
  const permissionsByCategory = getPermissionsByCategory();

  return (
    <div style={{ maxWidth: 800, margin: '40px auto', padding: '0 20px' }}>
      {/* 基本信息卡片 */}
      <Card title="基本信息" style={{ marginBottom: 24 }}>
        <div style={{ marginBottom: 40 }}>
          <Form form={nameForm} onFinish={handleChangeName} layout="vertical">
            <Form.Item
              name="name"
              label="名称"
              rules={[{ required: true, message: '请输入名称' }]}
            >
              <Input />
            </Form.Item>
            <Button type="primary" htmlType="submit" block>
              保存名称
            </Button>
          </Form>
        </div>
        <div style={{ marginBottom: 40 }}>
          <Form form={emailForm} onFinish={handleChangeEmail} layout="vertical">
            <Form.Item
              name="email"
              label="邮箱"
              rules={[{ required: true, type: 'email', message: '请输入有效邮箱' }]}
            >
              <Input />
            </Form.Item>
            <Form.Item label="部门">
              <Input value={department} disabled />
            </Form.Item>
            <Button type="primary" htmlType="submit" block>
              修改邮箱
            </Button>
          </Form>
        </div>
        <div>
          <Form form={form} onFinish={handleChangePassword} layout="vertical">
            <Form.Item
              name="oldPassword"
              label="旧密码"
              rules={[{ required: true, message: '请输入旧密码' }]}
            >
              <Input.Password />
            </Form.Item>
            <Form.Item
              name="password"
              label="新密码"
              rules={[{ required: true, min: 6, message: '密码至少6位' }]}
            >
              <Input.Password />
            </Form.Item>
            <Button type="primary" htmlType="submit" block>
              修改密码
            </Button>
          </Form>
        </div>
      </Card>

      {/* 角色权限卡片 */}
      <Card 
        title={
          <Space>
            <SafetyCertificateOutlined />
            角色权限
            {loading && <Badge status="processing" text="加载中..." />}
          </Space>
        }
        style={{ marginBottom: 24 }}
      >
        {/* 管理员标识 */}
        {(isSuperAdmin || isSystemAdmin) && (
          <div style={{ marginBottom: 16 }}>
            <Tag color="red" icon={<KeyOutlined />}>
              {isSuperAdmin ? '超级管理员' : '系统管理员'}
            </Tag>
            <Text type="secondary">拥有系统最高权限</Text>
          </div>
        )}

        {/* 用户角色 */}
        <div style={{ marginBottom: 24 }}>
          <Title level={5}>
            <UserOutlined /> 我的角色
          </Title>
          <Space wrap>
            {userRoles.map((role) => (
              <Tag 
                key={role.role_id}
                color={role.is_active ? 'blue' : 'default'}
                icon={role.is_active ? <CheckCircleOutlined /> : <ExclamationCircleOutlined />}
              >
                {role.role_display_name}
                {role.expires_at && (
                  <Text type="secondary" style={{ marginLeft: 8 }}>
                    (到期: {new Date(role.expires_at).toLocaleDateString()})
                  </Text>
                )}
              </Tag>
            ))}
            {userRoles.length === 0 && (
              <Text type="secondary">暂无角色</Text>
            )}
          </Space>
          
          {/* 即将过期的角色提醒 */}
          {expiringRoles.length > 0 && (
            <div style={{ marginTop: 12 }}>
              <Tag color="orange" icon={<ClockCircleOutlined />}>
                即将过期的角色 ({expiringRoles.length})
              </Tag>
              <List
                size="small"
                dataSource={expiringRoles}
                renderItem={(role) => (
                  <List.Item>
                    <Text>{role.role_display_name}</Text>
                    <Text type="secondary">
                      到期时间: {new Date(role.expires_at!).toLocaleString()}
                    </Text>
                  </List.Item>
                )}
              />
            </div>
          )}
        </div>

        <Divider />

        {/* 权限列表 */}
        <div>
          <Title level={5}>
            <KeyOutlined /> 我的权限
          </Title>
          {Object.keys(permissionsByCategory).length > 0 ? (
            Object.entries(permissionsByCategory).map(([category, permissions]) => (
              <div key={category} style={{ marginBottom: 16 }}>
                <Text strong style={{ display: 'block', marginBottom: 8 }}>
                  {category === 'leads' ? '线索管理' :
                   category === 'followups' ? '跟进管理' :
                   category === 'deals' ? '成交管理' :
                   category === 'dashboard' ? '仪表盘' :
                   category === 'departments' ? '部门管理' :
                   category === 'system' ? '系统管理' :
                   category}
                </Text>
                <Space wrap>
                  {permissions.map((permission) => (
                    <Tag key={permission.permission_name} color="green">
                      {permission.permission_display_name}
                    </Tag>
                  ))}
                </Space>
              </div>
            ))
          ) : (
            <Text type="secondary">暂无权限</Text>
          )}
        </div>

        {/* 权限统计 */}
        <Divider />
        <div>
          <Text type="secondary">
            总计: {userRoles.length} 个角色, {userPermissions.length} 个权限
          </Text>
        </div>
      </Card>
    </div>
  );
};

export default Profile;
