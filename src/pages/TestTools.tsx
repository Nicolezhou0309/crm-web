import React from 'react';
import { Card, Typography, Space, Button, Divider, Row, Col } from 'antd';
import { 
  BugOutlined, 
  ExperimentOutlined, 
  DatabaseOutlined, 
  ToolOutlined,
  LinkOutlined 
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';

const { Title, Text } = Typography;

const TestTools: React.FC = () => {
  const navigate = useNavigate();

  const testTools = [
    {
      key: 'database-test',
      title: '数据库测试',
      description: '测试Supabase数据库连接和基本操作',
      icon: <DatabaseOutlined />,
      path: '/test',
      color: '#1890ff'
    },
    {
      key: 'loading-demo',
      title: '加载演示',
      description: '展示各种加载效果和动画',
      icon: <ExperimentOutlined />,
      path: '/loading-demo',
      color: '#52c41a'
    },
    {
      key: 'cache-debug',
      title: '缓存调试',
      description: '调试用户缓存和会话状态',
      icon: <BugOutlined />,
      path: '/cache-debug',
      color: '#fa8c16'
    }
  ];

  return (
    <div style={{ padding: 24 }}>
      <div style={{ marginBottom: 24 }}>
        <Title level={2}>
          <ToolOutlined style={{ marginRight: 8 }} />
          测试工具集
        </Title>
        <Text type="secondary">
          用于开发和调试的各种工具和测试页面
        </Text>
      </div>

      <Row gutter={[24, 24]}>
        {testTools.map(tool => (
          <Col xs={24} sm={12} lg={8} key={tool.key}>
            <Card
              hoverable
              style={{ height: '100%' }}
              onClick={() => navigate(tool.path)}
            >
              <div style={{ 
                display: 'flex', 
                alignItems: 'center', 
                marginBottom: 16 
              }}>
                <div style={{
                  width: 48,
                  height: 48,
                  borderRadius: 8,
                  backgroundColor: tool.color,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  marginRight: 16
                }}>
                  <span style={{ fontSize: 24, color: '#fff' }}>
                    {tool.icon}
                  </span>
                </div>
                <div>
                  <Title level={4} style={{ margin: 0 }}>
                    {tool.title}
                  </Title>
                  <Text type="secondary">
                    {tool.description}
                  </Text>
                </div>
              </div>
              
              <Button 
                type="primary" 
                icon={<LinkOutlined />}
                onClick={(e) => {
                  e.stopPropagation();
                  navigate(tool.path);
                }}
              >
                打开工具
              </Button>
            </Card>
          </Col>
        ))}
      </Row>

      <Divider />

      <Card title="工具说明">
        <Space direction="vertical" size="large" style={{ width: '100%' }}>
          <div>
            <Title level={5}>数据库测试</Title>
            <Text>
              用于测试Supabase数据库连接、查询和插入操作。可以验证数据库配置是否正确，
              以及测试基本的CRUD操作。
            </Text>
          </div>
          
          <div>
            <Title level={5}>加载演示</Title>
            <Text>
              展示各种加载效果和动画，包括随机消息轮换、类型化消息等。
              用于测试和演示加载界面的用户体验。
            </Text>
          </div>
          
          <div>
            <Title level={5}>缓存调试</Title>
            <Text>
              用于调试用户缓存和会话状态，包括查看缓存内容、会话时间、
              清除缓存等操作。仅用于开发环境。
            </Text>
          </div>
        </Space>
      </Card>
    </div>
  );
};

export default TestTools; 