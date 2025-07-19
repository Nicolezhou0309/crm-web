import React, { useState } from 'react';
import { Button, Card, Space, Typography, Divider } from 'antd';
import LoadingScreen from '../components/LoadingScreen';

const { Title, Text } = Typography;

const LoadingDemo: React.FC = () => {
  const [showLoading, setShowLoading] = useState(false);
  const [loadingType, setLoadingType] = useState<'auth' | 'data' | 'profile' | 'system' | 'sales' | 'customer' | 'ai' | 'random'>('random');

  const handleShowLoading = (type: typeof loadingType) => {
    setLoadingType(type);
    setShowLoading(true);
    setTimeout(() => setShowLoading(false), 3000);
  };

  if (showLoading) {
    return <LoadingScreen type={loadingType} />;
  }

  return (
    <div style={{ padding: 24, maxWidth: 800, margin: '0 auto' }}>
      <Title level={2}>加载效果演示</Title>
      <Text type="secondary">点击下面的按钮查看不同的加载效果</Text>
      
      <Divider />
      
      <Space direction="vertical" size="large" style={{ width: '100%' }}>
        <Card title="随机加载消息" size="small" style={{ boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}>
          <Text>每次都会显示不同的有趣加载消息</Text>
          <br />
          <Button 
            type="primary" 
            onClick={() => handleShowLoading('random')}
            style={{ marginTop: 8 }}
          >
            显示随机加载
          </Button>
        </Card>

        <Card title="身份验证加载" size="small" style={{ boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}>
          <Text>用于登录验证时的加载效果</Text>
          <br />
          <Button 
            onClick={() => handleShowLoading('auth')}
            style={{ marginTop: 8 }}
          >
            显示身份验证加载
          </Button>
        </Card>

        <Card title="数据加载" size="small" style={{ boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}>
          <Text>用于加载数据时的效果</Text>
          <br />
          <Button 
            onClick={() => handleShowLoading('data')}
            style={{ marginTop: 8 }}
          >
            显示数据加载
          </Button>
        </Card>

        <Card title="个人资料加载" size="small" style={{ boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}>
          <Text>用于加载用户资料时的效果</Text>
          <br />
          <Button 
            onClick={() => handleShowLoading('profile')}
            style={{ marginTop: 8 }}
          >
            显示个人资料加载
          </Button>
        </Card>

        <Card title="系统初始化加载" size="small" style={{ boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}>
          <Text>用于系统启动时的效果</Text>
          <br />
          <Button 
            onClick={() => handleShowLoading('system')}
            style={{ marginTop: 8 }}
          >
            显示系统初始化加载
          </Button>
        </Card>

        <Card title="销售相关加载" size="small" style={{ boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}>
          <Text>用于销售场景的加载效果</Text>
          <br />
          <Button 
            onClick={() => handleShowLoading('sales')}
            style={{ marginTop: 8 }}
          >
            显示销售加载
          </Button>
        </Card>

        <Card title="客户分析加载" size="small" style={{ boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}>
          <Text>用于客户画像分析的加载效果</Text>
          <br />
          <Button 
            onClick={() => handleShowLoading('customer')}
            style={{ marginTop: 8 }}
          >
            显示客户分析加载
          </Button>
        </Card>

        <Card title="AI分析加载" size="small" style={{ boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}>
          <Text>用于AI智能分析的加载效果</Text>
          <br />
          <Button 
            onClick={() => handleShowLoading('ai')}
            style={{ marginTop: 8 }}
          >
            显示AI分析加载
          </Button>
        </Card>
      </Space>

      <Divider />

      <Card title="加载消息列表" size="small" style={{ boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}>
        <div style={{ fontSize: '14px', lineHeight: 1.6 }}>
          <Text strong>可用的加载消息：</Text>
          <ul style={{ marginTop: 8 }}>
            <li>别催啦，已经在拼命加载了！💨</li>
            <li>正在召唤数据精灵...✨</li>
            <li>服务器正在疯狂运转中...⚡</li>
            <li>正在为您打开魔法之门...🚪</li>
            <li>正在收集用户信息...📊</li>
            <li>正在连接云端服务器...☁️</li>
            <li>正在为您定制专属体验...🎨</li>
            <li>正在检查您的权限...🔐</li>
            <li>正在加载您的个人资料...👤</li>
            <li>正在初始化系统...🔧</li>
            <li><strong>新增管家销售主题：</strong></li>
            <li>正在为您加载客户画像…🖼️</li>
            <li>AI正在分析客户偏好…🤖</li>
            <li>系统正在优化您的沟通话术…💬</li>
            <li>正在计算客户成交概率…📈</li>
            <li>正在生成客户跟进策略…🗓️</li>
            <li>系统正在模拟客户反应…🎭</li>
            <li>您的下一个成交正在路上…🚀</li>
            <li>正在为您挖掘新的销售突破口…⛏️</li>
            <li>管家大神经验包加载中…🧠</li>
            <li>系统检测到您的业绩即将飙升…📊</li>
            <li>您的专属销售Buff已生效…🛡️</li>
            <li><strong>新增激励型销售文案：</strong></li>
            <li>您的第5单正在派送中…📦</li>
            <li>系统检测到超级客户正在靠近…🦸</li>
            <li>恭喜！您的努力值已满格…⚡</li>
            <li>正在为您连接财富信号…📡</li>
            <li>您的开单锦鲤正在游来…🐠</li>
            <li>幸运值充值完成…✨</li>
            <li>您的业绩火箭正在点火…🔥</li>
            <li>检测到您今日战斗力+200%…💥</li>
            <li>销售暴击技能加载中…🎯</li>
            <li>系统偷偷为您预留了VIP客户…🤫</li>
            <li>恭喜解锁【开单狂魔】成就…🏆</li>
            <li>您今天的笑容价值10万…😊</li>
            <li>磁场感应：客户即将说'Yes'…🧲</li>
            <li>您的'成交气场'已全开…🌈</li>
            <li>系统赠您一次'必开单'机会…🎰</li>
            <li>财神爷正在为您筛选客户…💰</li>
            <li>您的开单符已生效…🀄</li>
            <li>本月旺运指数：🌟🌟🌟🌟🌟</li>
          </ul>
        </div>
      </Card>
    </div>
  );
};

export default LoadingDemo; 