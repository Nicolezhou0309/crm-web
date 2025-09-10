import React, { useState, useEffect } from 'react';
import { Modal, Form, Input, Select, Button, message } from 'antd';
import { UserOutlined, TeamOutlined } from '@ant-design/icons';
import { supabase } from '../supaClient';

interface Organization {
  id: string;
  name: string;
  parent_id?: string | null;
  admin?: string;
}

interface ProfileSetupModalProps {
  visible: boolean;
  onComplete: () => void;
  userProfile: {
    id: number;
    user_id: string;
    nickname?: string;
    organization_id?: string;
  } | null;
}

const ProfileSetupModal: React.FC<ProfileSetupModalProps> = ({
  visible,
  onComplete,
  userProfile
}) => {
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [loadingOrgs, setLoadingOrgs] = useState(false);
  const [adminProfiles, setAdminProfiles] = useState<Map<string, { nickname: string; email: string }>>(new Map());

  // 获取组织列表
  const fetchOrganizations = async () => {
    setLoadingOrgs(true);
    try {
      const { data, error } = await supabase
        .from('organizations')
        .select('id, name, parent_id, admin')
        .order('name');
      
      if (error) throw error;
      setOrganizations(data || []);
      
      // 获取管理员信息
      const adminIds = (data || []).map(org => org.admin).filter(Boolean);
      if (adminIds.length > 0) {
        const { data: adminData, error: adminError } = await supabase
          .from('users_profile')
          .select('user_id, nickname, email')
          .in('user_id', adminIds);
        
        if (!adminError && adminData) {
          const adminMap = new Map();
          adminData.forEach(admin => {
            adminMap.set(admin.user_id, {
              nickname: admin.nickname || '未知用户',
              email: admin.email || ''
            });
          });
          setAdminProfiles(adminMap);
        }
      }
    } catch (error) {
      console.error('获取组织列表失败:', error);
      message.error('获取组织列表失败');
    } finally {
      setLoadingOrgs(false);
    }
  };

  // 组件挂载时获取组织列表
  useEffect(() => {
    if (visible) {
      fetchOrganizations();
    }
  }, [visible]);

  // 初始化表单值
  useEffect(() => {
    if (visible && userProfile) {
      form.setFieldsValue({
        nickname: userProfile.nickname || '',
        organization_id: userProfile.organization_id || undefined
      });
    }
  }, [visible, userProfile, form]);

  // 处理表单提交
  const handleSubmit = async (values: { nickname: string; organization_id: string }) => {
    if (!userProfile) return;

    setLoading(true);
    try {
      const { error } = await supabase
        .from('users_profile')
        .update({
          nickname: values.nickname.trim(),
          organization_id: values.organization_id || null,
          updated_at: new Date().toISOString()
        })
        .eq('id', userProfile.id);

      if (error) throw error;

      message.success('个人信息设置成功！');
      onComplete();
    } catch (error) {
      console.error('更新用户信息失败:', error);
      message.error('更新失败，请重试');
    } finally {
      setLoading(false);
    }
  };

  // 构建组织选项（支持层级显示和管理员信息）
  const buildOrganizationOptions = (orgs: Organization[], parentId: string | null = null, level: number = 0): any[] => {
    const children = orgs.filter(org => org.parent_id === parentId);
    const options: any[] = [];

    children.forEach(org => {
      const prefix = '　'.repeat(level);
      const adminInfo = org.admin ? adminProfiles.get(org.admin) : null;
      const adminText = adminInfo ? ` (管理员: ${adminInfo.nickname})` : '';
      
      options.push({
        label: `${prefix}${org.name}${adminText}`,
        value: org.id
      });
      
      // 递归添加子组织
      const subOptions = buildOrganizationOptions(orgs, org.id, level + 1);
      options.push(...subOptions);
    });

    return options;
  };

  const organizationOptions = buildOrganizationOptions(organizations);

  return (
    <Modal
      title="完善个人信息"
      open={visible}
      closable={false}
      maskClosable={false}
      footer={null}
      width={500}
      centered
    >
      <div style={{ padding: '10px' }}>
        <p style={{ marginBottom: 16, color: '#666', fontSize: 14 }}>
          为了更好的使用体验，请完善您的基本信息
        </p>
        
        <Form
          form={form}
          layout="vertical"
          onFinish={handleSubmit}
          requiredMark={false}
        >
          <Form.Item
            name="nickname"
            label="姓名"
            rules={[
              { required: true, message: '请输入您的姓名' },
              { min: 2, message: '姓名至少2个字符' },
              { max: 20, message: '姓名不能超过20个字符' }
            ]}
          >
            <Input
              prefix={<UserOutlined />}
              placeholder="请输入您的真实姓名"
              size="large"
            />
          </Form.Item>

          <Form.Item
            name="organization_id"
            label="所属小组"
            rules={[
              { required: true, message: '请选择您所属的小组' }
            ]}
          >
            <Select
              prefix={<TeamOutlined />}
              placeholder="请选择您所属的小组"
              size="large"
              loading={loadingOrgs}
              showSearch
              filterOption={(input, option) =>
                (option?.label ?? '').toLowerCase().includes(input.toLowerCase())
              }
              options={organizationOptions}
            />
          </Form.Item>

          <Form.Item style={{ marginBottom: 0, marginTop: 32 }}>
            <Button
              type="primary"
              htmlType="submit"
              loading={loading}
              size="large"
              block
            >
              完成设置
            </Button>
          </Form.Item>
        </Form>
      </div>
    </Modal>
  );
};

export default ProfileSetupModal;
