import React, { useState } from 'react';
import { Layout, Button, Card, Avatar, Tag, Divider, Spin, Empty } from 'antd';
import { 
  EditOutlined, 
  PhoneOutlined, 
  UserOutlined,
  EnvironmentOutlined,
  CalendarOutlined,
  CheckCircleOutlined,
  WalletOutlined
} from '@ant-design/icons';
import './mobile.css';

const { Content } = Layout;

const MobileFollowupsSimple: React.FC = () => {
  const [loading, setLoading] = useState(false);
  
  // 模拟数据
  const mockData = [
    {
      id: 1,
      customername: '张三',
      phone: '13800138000',
      followupstage: '初步接触',
      customerprofile: 'A级',
      scheduledcommunity: '玉湖花园',
      source: '线上推广',
      followupdate: '2024-12-20',
      followupresult: '有意向',
      expectedmoveindate: '2025-06-01',
      worklocation: '朝阳区',
      userbudget: '500-800万',
      remark: '客户对三居室比较感兴趣，需要进一步了解户型详情。'
    },
    {
      id: 2,
      customername: '李四',
      phone: '13900139000',
      followupstage: '需求了解',
      customerprofile: 'B级',
      scheduledcommunity: '玉湖花园',
      source: '老客户推荐',
      followupdate: '2024-12-19',
      followupresult: '待跟进',
      expectedmoveindate: '2025-08-01',
      worklocation: '海淀区',
      userbudget: '300-500万',
      remark: '客户预算有限，主要考虑两居室，需要推荐性价比高的房源。'
    }
  ];

  // 获取跟进阶段标签颜色
  const getStageTagColor = (stage: string) => {
    const stageColors: { [key: string]: string } = {
      '新客户': 'blue',
      '初步接触': 'cyan',
      '需求了解': 'geekblue',
      '方案制定': 'purple',
      '商务谈判': 'orange',
      '合同签署': 'green',
      '成交': 'success',
      '流失': 'red',
      '暂停': 'default'
    };
    return stageColors[stage] || 'default';
  };

  // 获取客户等级标签颜色
  const getProfileTagColor = (profile: string) => {
    const profileColors: { [key: string]: string } = {
      'A级': 'red',
      'B级': 'orange',
      'C级': 'blue',
      'D级': 'default'
    };
    return profileColors[profile] || 'default';
  };

  // 渲染客户卡片
  const renderCustomerCard = (record: any) => {
    const stage = record.followupstage || '未知';
    const profile = record.customerprofile || '未知';
    const community = record.scheduledcommunity || '未指定';
    const source = record.source || '未知';
    const followupresult = record.followupresult || '未设置';
    const expectedmoveindate = record.expectedmoveindate || '未设置';
    const worklocation = record.worklocation || '未设置';
    const userbudget = record.userbudget || '未设置';
    const remark = record.remark || '';
    
    return (
      <Card
        key={record.id}
        className="mobile-customer-card"
        hoverable
        actions={[
          <Button 
            type="primary" 
            icon={<EditOutlined />}
            size="small"
          >
            编辑
          </Button>
        ]}
      >
        <div className="card-header">
          <div className="customer-info">
            <Avatar 
              size={48} 
              icon={<UserOutlined />} 
              className="customer-avatar"
            />
            <div className="customer-details">
              <h3 className="customer-name">{record.customername || '未命名客户'}</h3>
              <p className="customer-phone">
                <PhoneOutlined /> {record.phone || '无电话'}
              </p>
            </div>
          </div>
          <div className="customer-tags">
            <Tag color={getStageTagColor(stage)}>{stage}</Tag>
            <Tag color={getProfileTagColor(profile)}>{profile}</Tag>
          </div>
        </div>
        
        <Divider style={{ margin: '12px 0' }} />
        
        <div className="card-content">
          {/* 双栏布局：左侧 */}
          <div className="info-columns">
            <div className="info-column left-column">
              <div className="info-row">
                <EnvironmentOutlined className="info-icon" />
                <span className="info-label">意向社区:</span>
                <span className="info-value">{community}</span>
              </div>
              
              <div className="info-row">
                <CalendarOutlined className="info-icon" />
                <span className="info-label">跟进时间:</span>
                <span className="info-value">
                  {record.followupdate ? new Date(record.followupdate).toLocaleDateString() : '未设置'}
                </span>
              </div>
              
              <div className="info-row">
                <UserOutlined className="info-icon" />
                <span className="info-label">来源:</span>
                <span className="info-value">{source}</span>
              </div>
            </div>
            
            {/* 双栏布局：右侧 */}
            <div className="info-column right-column">
              <div className="info-row">
                <CheckCircleOutlined className="info-icon" />
                <span className="info-label">跟进结果:</span>
                <span className="info-value">{followupresult}</span>
              </div>
              
              <div className="info-row">
                <CalendarOutlined className="info-icon" />
                <span className="info-label">预计入住:</span>
                <span className="info-value">
                  {expectedmoveindate ? new Date(expectedmoveindate).toLocaleDateString() : '未设置'}
                </span>
              </div>
              
              <div className="info-row">
                <EnvironmentOutlined className="info-icon" />
                <span className="info-label">工作地点:</span>
                <span className="info-value">{worklocation}</span>
              </div>
            </div>
          </div>
          
          {/* 预算信息行 */}
          <div className="budget-row">
            <WalletOutlined className="info-icon" />
            <span className="info-label">预算:</span>
            <span className="info-value budget-value">{userbudget}</span>
          </div>
          
          {/* 销售备注 - 最下方单行展示 */}
          {remark && (
            <div className="remark-section">
              <Divider style={{ margin: '8px 0' }} />
              <div className="remark-row">
                <span className="remark-label">销售备注:</span>
                <span className="remark-text">{remark}</span>
              </div>
            </div>
          )}
        </div>
      </Card>
    );
  };

  return (
    <div className="mobile-followups">
      <Layout>
        <Content className="mobile-content">
          {/* 顶部操作栏 */}
          <div className="mobile-header">
            <div className="header-title">
              <h2>客户跟进</h2>
              <span className="record-count">共 {mockData.length} 条记录</span>
            </div>
            
            <div className="header-actions">
              <Button
                size="small"
                onClick={() => setLoading(!loading)}
              >
                {loading ? '停止' : '开始'}加载
              </Button>
            </div>
          </div>

          {/* 客户卡片列表 */}
          <div className="cards-container">
            {loading ? (
              <div className="loading-container">
                <Spin size="large" />
                <p>加载中...</p>
              </div>
            ) : mockData.length === 0 ? (
              <Empty
                description="暂无数据"
                image={Empty.PRESENTED_IMAGE_SIMPLE}
              />
            ) : (
              <div className="cards-grid">
                {mockData.map(renderCustomerCard)}
              </div>
            )}
          </div>
        </Content>
      </Layout>
    </div>
  );
};

export default MobileFollowupsSimple;
