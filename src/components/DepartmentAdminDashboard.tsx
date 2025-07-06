import React, { useState, useEffect } from 'react';
import { Card, Row, Col, Statistic, List, Avatar, Tag, Space, Typography, Button } from 'antd';
import { UserOutlined, TeamOutlined, CrownOutlined, EyeOutlined } from '@ant-design/icons';
import { supabase } from '../supaClient';
import { usePermissions } from '../hooks/usePermissions';

const { Text, Title } = Typography;

interface DepartmentAdminDashboardProps {
  onViewDepartment: (deptId: string) => void;
}

interface DepartmentStats {
  id: string;
  name: string;
  admin?: string;
  users_profile?: {
    nickname: string;
    email: string;
  };
  activeMembers: number;
  totalMembers: number;
  pendingMembers: number;
  leftMembers: number;
}

const DepartmentAdminDashboard: React.FC<DepartmentAdminDashboardProps> = ({ onViewDepartment }) => {
  const { isSuperAdmin, isDepartmentAdmin, getManageableOrganizations } = usePermissions();
  const [departmentStats, setDepartmentStats] = useState<DepartmentStats[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchDepartmentStats();
  }, []);

  const fetchDepartmentStats = async () => {
    try {
      const manageableOrgs = await getManageableOrganizations();
      
      if (manageableOrgs.length === 0) {
        setLoading(false);
        return;
      }

      const deptIds = manageableOrgs.map((dept: any) => dept.id);
      
      // 获取每个部门的成员统计
      const { data: membersData } = await supabase
        .from('users_profile')
        .select('organization_id, status')
        .in('organization_id', deptIds);

      // 获取部门详细信息（包括管理员信息）
      const { data: deptDetails } = await supabase
        .from('organizations')
        .select('*, users_profile!admin(nickname, email)')
        .in('id', deptIds);

      // 计算统计信息
      const stats: DepartmentStats[] = manageableOrgs.map((dept: any) => {
        const deptMembers = membersData?.filter(member => member.organization_id === dept.id) || [];
        const deptDetail = deptDetails?.find(d => d.id === dept.id);
        const activeMembers = deptMembers.filter(member => member.status === 'active').length;
        const totalMembers = deptMembers.length;
        
        return {
          id: dept.id,
          name: dept.name,
          admin: deptDetail?.admin,
          users_profile: deptDetail?.users_profile,
          activeMembers,
          totalMembers,
          pendingMembers: deptMembers.filter(member => member.status === 'pending').length,
          leftMembers: deptMembers.filter(member => member.status === 'left').length
        };
      });

      setDepartmentStats(stats);
    } catch (error) {
      console.error('获取部门统计失败:', error);
    } finally {
      setLoading(false);
    }
  };

  if (!isDepartmentAdmin && !isSuperAdmin) {
    return (
      <Card>
        <div style={{ textAlign: 'center', padding: '40px 0' }}>
          <CrownOutlined style={{ fontSize: '48px', color: '#d9d9d9', marginBottom: '16px' }} />
          <Title level={4}>您没有部门管理权限</Title>
          <Text type="secondary">请联系超级管理员分配部门管理权限</Text>
        </div>
      </Card>
    );
  }

  return (
    <div style={{ padding: '24px' }}>
      <Title level={3} style={{ marginBottom: '24px' }}>
        <CrownOutlined style={{ marginRight: '8px' }} />
        部门管理仪表板
      </Title>

      {/* 总体统计 */}
      <Row gutter={[16, 16]} style={{ marginBottom: '24px' }}>
        <Col xs={24} sm={12} md={6}>
          <Card>
            <Statistic
              title="管理部门"
              value={departmentStats.length}
              prefix={<TeamOutlined />}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={6}>
          <Card>
            <Statistic
              title="总成员数"
              value={departmentStats.reduce((sum, dept) => sum + dept.totalMembers, 0)}
              prefix={<UserOutlined />}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={6}>
          <Card>
            <Statistic
              title="活跃成员"
              value={departmentStats.reduce((sum, dept) => sum + dept.activeMembers, 0)}
              prefix={<UserOutlined />}
              valueStyle={{ color: '#3f8600' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={6}>
          <Card>
            <Statistic
              title="待激活成员"
              value={departmentStats.reduce((sum, dept) => sum + dept.pendingMembers, 0)}
              prefix={<UserOutlined />}
              valueStyle={{ color: '#cf1322' }}
            />
          </Card>
        </Col>
      </Row>

      {/* 部门列表 */}
      <Card title="管理部门" loading={loading}>
        <List
          dataSource={departmentStats}
          renderItem={(dept) => (
            <List.Item
              actions={[
                <Button 
                  type="primary" 
                  icon={<EyeOutlined />}
                  onClick={() => onViewDepartment(dept.id)}
                >
                  查看详情
                </Button>
              ]}
            >
              <List.Item.Meta
                avatar={
                  <Avatar 
                    icon={<TeamOutlined />} 
                    style={{ backgroundColor: dept.admin ? '#1677ff' : '#52c41a' }}
                  />
                }
                title={
                  <Space>
                    <Text strong>{dept.name}</Text>
                    {dept.admin && (
                      <Tag color="blue" icon={<CrownOutlined />}>
                        管理员
                      </Tag>
                    )}
                  </Space>
                }
                description={
                  <Space direction="vertical" size="small">
                    <Text type="secondary">
                      成员: {dept.totalMembers} 人 
                      (活跃: {dept.activeMembers}, 待激活: {dept.pendingMembers}, 离职: {dept.leftMembers})
                    </Text>
                    {dept.admin && dept.users_profile && (
                      <Text type="secondary">
                        管理员: {dept.users_profile.nickname || '未知'}
                      </Text>
                    )}
                  </Space>
                }
              />
            </List.Item>
          )}
        />
      </Card>
    </div>
  );
};

export default DepartmentAdminDashboard; 