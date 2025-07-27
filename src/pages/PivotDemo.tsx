import React from 'react';
import { Card, Typography, Space, Button } from 'antd';
import { ArrowLeftOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';

const { Title, Paragraph, Text } = Typography;

const PivotDemo: React.FC = () => {
  const navigate = useNavigate();

  return (
    <div className="page-card">
      <div className="page-header">
        <Space>
          <Button 
            icon={<ArrowLeftOutlined />} 
            onClick={() => navigate('/data-analysis')}
          >
            返回数据分析
          </Button>
        </Space>
        <Title level={4} style={{ margin: 0, fontWeight: 700, color: '#222' }}>
          透视表演示
        </Title>
      </div>

      <Card title="Excel风格透视表功能" style={{ marginBottom: 16 }}>
        <div style={{ padding: '20px 0' }}>
          <Title level={5}>🎯 主要功能</Title>
          <ul style={{ fontSize: '16px', lineHeight: '2' }}>
            <li><Text strong>拖拽式配置：</Text>从左侧字段面板拖拽字段到右侧配置区域</li>
            <li><Text strong>四个配置区域：</Text>行维度、列维度、值字段、筛选条件</li>
            <li><Text strong>实时预览：</Text>配置完成后可立即执行透视表计算</li>
            <li><Text strong>配置保存：</Text>可保存常用配置供后续使用</li>
            <li><Text strong>数据导出：</Text>支持Excel和CSV格式导出</li>
          </ul>
        </div>

        <div style={{ padding: '20px 0' }}>
          <Title level={5}>📋 使用步骤</Title>
          <ol style={{ fontSize: '16px', lineHeight: '2' }}>
            <li>点击"加载数据"按钮获取基础数据</li>
            <li>从左侧"可用字段"面板拖拽字段到右侧配置区域</li>
            <li>配置行维度、列维度和值字段</li>
            <li>点击"执行透视表"按钮生成结果</li>
            <li>可选择保存配置或导出数据</li>
          </ol>
        </div>

        <div style={{ padding: '20px 0' }}>
          <Title level={5}>🎨 界面特色</Title>
          <ul style={{ fontSize: '16px', lineHeight: '2' }}>
            <li><Text strong>Excel风格布局：</Text>与Excel透视表布局保持一致</li>
            <li><Text strong>拖拽交互：</Text>直观的拖拽操作，支持视觉反馈</li>
            <li><Text strong>响应式设计：</Text>适配不同屏幕尺寸</li>
            <li><Text strong>美观界面：</Text>现代化的UI设计，良好的用户体验</li>
          </ul>
        </div>

        <div style={{ padding: '20px 0' }}>
          <Title level={5}>💡 使用技巧</Title>
          <ul style={{ fontSize: '16px', lineHeight: '2' }}>
            <li>维度字段适合作为行/列维度，度量字段适合作为值字段</li>
            <li>可以配置多个行维度和列维度来创建复杂的透视表</li>
            <li>值字段支持多种聚合方式：求和、计数、平均值、最大值、最小值</li>
            <li>保存的配置可以在"保存的配置"标签页中查看和管理</li>
          </ul>
        </div>

        <div style={{ textAlign: 'center', marginTop: '30px' }}>
          <Button 
            type="primary" 
            size="large"
            onClick={() => navigate('/data-analysis')}
          >
            开始使用透视表
          </Button>
        </div>
      </Card>
    </div>
  );
};

export default PivotDemo; 