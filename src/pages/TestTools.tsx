import React, { useState } from 'react';
import { Card, Typography, Space, Button, Divider, Row, Col, Modal } from 'antd';
import { 
  ExperimentOutlined, 
  DatabaseOutlined, 
  ToolOutlined,
  LinkOutlined,
  TrophyOutlined
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import CelebrationAnimation from '../components/CelebrationAnimation';

const { Title, Text } = Typography;

const TestTools: React.FC = () => {
  const navigate = useNavigate();
  const [showConfigModal, setShowConfigModal] = useState(false);
  const [showCelebration, setShowCelebration] = useState(false);
  const [celebrationTitle, setCelebrationTitle] = useState('🎉 恭喜成交！');
  const [celebrationMessage, setCelebrationMessage] = useState('您已成功完成一笔交易，继续保持！');

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
    // 删除缓存调试卡片
    {
      key: 'celebration-test',
      title: '庆祝动画测试',
      description: '测试庆祝动画效果和置顶显示',
      icon: <TrophyOutlined />, 
      color: '#faad14',
      isLocal: true
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
              onClick={() => {
                if (tool.isLocal) {
                  // 本地工具，不进行导航
                  if (tool.key === 'celebration-test') {
                    setShowConfigModal(true);
                  }
                } else if (tool.path) {
                  navigate(tool.path);
                }
              }}
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
                  if (tool.isLocal) {
                    // 本地工具，不进行导航
                    if (tool.key === 'celebration-test') {
                      setShowConfigModal(true);
                    }
                  } else if (tool.path) {
                    navigate(tool.path);
                  }
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
            <Title level={5}>庆祝动画测试</Title>
            <Text>
              测试庆祝动画效果和置顶显示功能。可以自定义动画标题和消息，
              验证动画在不同界面层级下的显示效果，包括彩带、星星和烟花动画。
            </Text>
          </div>
        </Space>
      </Card>

      {/* 庆祝动画配置模态框 */}
      <Modal
        title="庆祝动画测试配置"
        open={showConfigModal}
        onCancel={() => setShowConfigModal(false)}
        footer={[
          <Button key="cancel" onClick={() => setShowConfigModal(false)}>
            取消
          </Button>,
          <Button 
            key="test" 
            type="primary" 
            onClick={() => {
              setShowConfigModal(false);
              // 延迟一点时间再触发动画，确保配置模态框关闭
              setTimeout(() => {
                setShowCelebration(true);
              }, 100);
            }}
          >
            测试动画
          </Button>
        ]}
        width={600}
      >
        <Space direction="vertical" size="large" style={{ width: '100%' }}>
          <div>
            <Title level={5}>自定义标题</Title>
            <input
              type="text"
              value={celebrationTitle}
              onChange={(e) => setCelebrationTitle(e.target.value)}
              style={{ width: '100%', padding: '8px', border: '1px solid #d9d9d9', borderRadius: '6px' }}
              placeholder="输入庆祝动画标题"
            />
          </div>
          
          <div>
            <Title level={5}>自定义消息</Title>
            <textarea
              value={celebrationMessage}
              onChange={(e) => setCelebrationMessage(e.target.value)}
              style={{ width: '100%', padding: '8px', border: '1px solid #d9d9d9', borderRadius: '6px', minHeight: '80px' }}
              placeholder="输入庆祝动画消息"
            />
          </div>
          
          <div>
            <Title level={5}>测试说明</Title>
            <Text>
              配置好标题和消息后，点击"测试动画"按钮将触发庆祝动画效果。
              动画将显示在最顶层，包含彩带效果、星星动画和烟花效果。
              动画持续3秒后自动关闭。
            </Text>
          </div>
        </Space>
      </Modal>

      {/* 庆祝动画组件 */}
      <CelebrationAnimation
        visible={showCelebration}
        onClose={() => {
          setShowCelebration(false);
          // 动画关闭后，可以选择是否重新打开配置模态框
          // 这里我们选择不自动重新打开，让用户主动点击
        }}
        title={celebrationTitle}
        message={celebrationMessage}
      />
    </div>
  );
};

export default TestTools; 