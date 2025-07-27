import React, { useState } from 'react';
import { Tabs, Card, Typography, Space, Button } from 'antd';
import { BarChartOutlined, TableOutlined } from '@ant-design/icons';
import PivotTableExample from '../components/PivotTableExample';
import AdvancedPivotTable from '../components/AdvancedPivotTable';

const { Title, Paragraph } = Typography;
const { TabPane } = Tabs;

const PivotTableDemo: React.FC = () => {
  const [activeTab, setActiveTab] = useState('basic');

  return (
    <div className="page-card">
      <div className="page-header">
        <Title level={4} style={{ margin: 0, fontWeight: 700, color: '#222' }}>
          数据透视表示例
        </Title>
        <Space>
          <Button 
            type="primary" 
            icon={<TableOutlined />}
            onClick={() => window.open('http://localhost:5177', '_blank')}
          >
            返回主页
          </Button>
        </Space>
      </div>

      <Card style={{ marginBottom: 16 }}>
        <Paragraph>
          本页面展示了多种数据透视表解决方案，您可以选择适合的方案进行集成。
        </Paragraph>
        <Paragraph>
          <strong>推荐方案：</strong> React-Pivot - 轻量级、易集成、功能完整
        </Paragraph>
      </Card>

      <Tabs activeKey={activeTab} onChange={setActiveTab}>
        <TabPane 
          tab={
            <span>
              <TableOutlined />
              基础透视表
            </span>
          } 
          key="basic"
        >
          <Card title="基础透视表示例" style={{ marginBottom: 16 }}>
            <Paragraph>
              这是一个基础的透视表示例，展示了如何使用 React-Pivot 库创建简单的数据透视表。
            </Paragraph>
            <PivotTableExample />
          </Card>
        </TabPane>

        <TabPane 
          tab={
            <span>
              <BarChartOutlined />
              高级透视表
            </span>
          } 
          key="advanced"
        >
          <Card title="高级透视表示例" style={{ marginBottom: 16 }}>
            <Paragraph>
              这是一个高级透视表示例，包含完整的配置面板，支持动态调整行维度、列维度、聚合函数等。
            </Paragraph>
            <AdvancedPivotTable />
          </Card>
        </TabPane>
      </Tabs>

      <Card title="使用说明" style={{ marginTop: 16 }}>
        <Paragraph>
          <strong>功能特点：</strong>
        </Paragraph>
        <ul>
          <li>支持多种聚合函数：计数、求和、平均值、最大值、最小值</li>
          <li>支持多种渲染方式：表格、热力图、条形图</li>
          <li>动态配置行维度和列维度</li>
          <li>支持数据导出（CSV、JSON）</li>
          <li>与现有 Ant Design 组件完美集成</li>
        </ul>

        <Paragraph>
          <strong>集成步骤：</strong>
        </Paragraph>
        <ol>
          <li>安装依赖：<code>npm install react-pivot</code></li>
          <li>导入组件：<code>import Pivot from 'react-pivot'</code></li>
          <li>准备数据：确保数据格式统一</li>
          <li>配置透视表：设置行维度、列维度、聚合函数</li>
          <li>渲染组件：在页面中使用 Pivot 组件</li>
        </ol>

        <Paragraph>
          <strong>注意事项：</strong>
        </Paragraph>
        <ul>
          <li>确保数据中没有空值，建议预处理数据</li>
          <li>大数据量时考虑分页或虚拟化</li>
          <li>测试不同浏览器的兼容性</li>
          <li>根据实际需求选择合适的聚合函数</li>
        </ul>
      </Card>
    </div>
  );
};

export default PivotTableDemo; 