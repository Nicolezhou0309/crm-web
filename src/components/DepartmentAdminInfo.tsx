import React from 'react';
import { Card, Avatar, Tag, Space, Typography } from 'antd';
import { CrownOutlined, UserOutlined } from '@ant-design/icons';

const { Text } = Typography;

const DepartmentAdminInfo: React.FC<any> = ({ admin, organizationName }) => {
  if (!admin) {
    return (
      <Card size="small" style={{ marginBottom: 16 }}>
        <Space>
          <Avatar icon={<UserOutlined />} />
          <div>
            <Text strong>{organizationName}</Text>
            <br />
            <Text type="secondary">暂无管理员</Text>
          </div>
        </Space>
      </Card>
    );
  }

  return (
    <Card size="small" style={{ marginBottom: 16 }}>
      <Space>
        <Avatar icon={<CrownOutlined />} style={{ backgroundColor: '#1677ff' }} />
        <div>
          <Space>
            <Text strong>{organizationName}</Text>
            <Tag color="blue" icon={<CrownOutlined />}>
              管理员
            </Tag>
          </Space>
          <br />
          <Text>{admin.nickname}</Text>
          <br />
          <Text type="secondary">{admin.email}</Text>
        </div>
      </Space>
    </Card>
  );
};

export default DepartmentAdminInfo; 