import React, { useState, useEffect } from 'react';
import { Card, Button, Space, Switch, Divider } from 'antd';
import MobileFollowups from './mobile';
import Followups from './index';

const MobileTest: React.FC = () => {
  const [isMobile, setIsMobile] = useState(false);
  const [screenWidth, setScreenWidth] = useState(window.innerWidth);

  // 监听窗口大小变化
  useEffect(() => {
    const handleResize = () => {
      setScreenWidth(window.innerWidth);
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  return (
    <div style={{ padding: '20px' }}>
      <h1>响应式Followups页面测试</h1>
      
      <Card title="响应式测试控制" style={{ marginBottom: '20px' }}>
        <Space direction="vertical" style={{ width: '100%' }}>
          <div>
            <strong>当前屏幕宽度:</strong> {screenWidth}px
            <br />
            <strong>当前模式:</strong> {isMobile ? '手机端' : '桌面端'}
            <br />
            <strong>断点:</strong> 768px
          </div>
          
          <Divider />
          
          <div>
            <strong>手动切换模式:</strong>
            <Switch 
              checked={isMobile} 
              onChange={setIsMobile}
              checkedChildren="手机端"
              unCheckedChildren="桌面端"
            />
          </div>
          
          <div style={{ fontSize: '12px', color: '#666' }}>
            💡 提示：调整浏览器窗口大小或使用开发者工具模拟不同设备来测试响应式效果
          </div>
        </Space>
      </Card>

      <Card title="功能说明" style={{ marginBottom: '20px' }}>
        <p>这是一个响应式Followups页面的测试页面，主要特性：</p>
        <ul>
          <li>✅ 自动检测屏幕尺寸，智能切换页面模式</li>
          <li>✅ 手机端：卡片式UI设计，适合触摸操作</li>
          <li>✅ 桌面端：保持原有的表格和分组功能</li>
          <li>✅ 取消手机端的分组统计、日历和回退功能</li>
          <li>✅ 响应式设计，适配不同屏幕尺寸</li>
        </ul>
      </Card>

      <Card title="组件测试" style={{ marginBottom: '20px' }}>
        <Space direction="vertical" style={{ width: '100%' }}>
          <p>下方是响应式Followups页面的实际渲染：</p>
          <div style={{ border: '1px solid #d9d9d9', borderRadius: '8px', overflow: 'hidden' }}>
            {isMobile ? <MobileFollowups /> : <Followups />}
          </div>
        </Space>
      </Card>

      <Card title="使用说明">
        <p><strong>测试方法：</strong></p>
        <ol>
          <li>调整浏览器窗口大小到768px以下，查看手机端效果</li>
          <li>调整浏览器窗口大小到768px以上，查看桌面端效果</li>
          <li>使用开发者工具的Device Toolbar模拟不同设备</li>
          <li>手动切换开关测试两种模式</li>
        </ol>
        
        <p><strong>手机端特性：</strong></p>
        <ul>
          <li>卡片式布局，触摸友好</li>
          <li>抽屉式编辑界面</li>
          <li>简化的筛选和搜索</li>
          <li>响应式设计，适配小屏幕</li>
        </ul>
        
        <p><strong>桌面端特性：</strong></p>
        <ul>
          <li>完整的表格功能</li>
          <li>分组统计面板</li>
          <li>日历视图</li>
          <li>回退列表功能</li>
        </ul>
      </Card>
    </div>
  );
};

export default MobileTest;
