import React from 'react';
import { Card, Typography, Button, Space, Alert } from 'antd';
import { useNavigate, useLocation } from 'react-router-dom';

const { Title, Paragraph, Text } = Typography;

const SimpleTest: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();

  return (
    <div style={{ padding: '24px' }}>
      <Card>
        <Title level={2}>🧪 简单路由测试</Title>
        
        <Alert
          message="路由状态检查"
          description={`当前路径: ${location.pathname}`}
          type="info"
          showIcon
          style={{ marginBottom: '16px' }}
        />
        
        <Space direction="vertical" size="large" style={{ width: '100%' }}>
          <div>
            <Title level={4}>✅ 基本功能</Title>
            <Paragraph>
              如果您能看到这个页面，说明：
              <br/>• 路由配置正确 ✅
              <br/>• 组件导入成功 ✅
              <br/>• 页面渲染正常 ✅
            </Paragraph>
          </div>
          
          <div>
            <Title level={4}>🔗 导航测试</Title>
            <Space wrap>
              <Button type="primary" onClick={() => navigate('/followups')}>
                原跟进页面
              </Button>
              <Button onClick={() => navigate('/followups')}>
                新跟进页面
              </Button>
              <Button onClick={() => navigate('/')}>
                首页
              </Button>
              <Button onClick={() => navigate('/followups-test')}>
                详细测试页
              </Button>
            </Space>
          </div>
          
          <div>
            <Title level={4}>📋 问题排查</Title>
            <Paragraph>
              如果导航菜单无法跳转，可能的原因：
              <br/>• <Text code>keyPathMap</Text> 配置问题
              <br/>• 菜单项 <Text code>key</Text> 值不匹配
              <br/>• 路由组件导入失败
              <br/>• 浏览器缓存问题
            </Paragraph>
          </div>
          
          <div>
            <Title level={4}>🔧 解决方案</Title>
            <Paragraph>
              1. 刷新浏览器页面
              <br/>2. 清除浏览器缓存
              <br/>3. 检查控制台错误
              <br/>4. 验证组件文件存在
            </Paragraph>
          </div>
        </Space>
      </Card>
    </div>
  );
};

export default SimpleTest;
