import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Layout, message, Button, Form, Select, Upload, Card, Avatar, Tag, Space, Drawer, Input, DatePicker, Divider, Spin, Empty } from 'antd';
import { 
  UploadOutlined, 
  EditOutlined, 
  PhoneOutlined, 
  MailOutlined, 
  EnvironmentOutlined,
  CalendarOutlined,
  UserOutlined,
  SearchOutlined,
  FilterOutlined,
  ReloadOutlined
} from '@ant-design/icons';
import { FollowupStageDrawer } from './components/FollowupStageDrawer';
import { useFollowupsData } from './hooks/useFollowupsData';
import { useFilterManager } from './hooks/useFilterManager';
import { useEnumData } from './hooks/useEnumData';
import { useFrequencyControl } from './hooks/useFrequencyControl';
import { useAutoSave } from './hooks/useAutoSave';
import { useOptimizedLocalData } from './hooks/useOptimizedLocalData';
import { getServiceManager } from '../../components/Followups/services/ServiceManager';
import { useUser } from '../../context/UserContext';
import { supabase } from '../../supaClient';
import './mobile.css';

const { Content } = Layout;
const { Search } = Input;
const { RangePicker } = DatePicker;

interface MobileFollowupsProps {
  className?: string;
}

const MobileFollowups: React.FC<MobileFollowupsProps> = ({ className }) => {
  const { profile } = useUser();
  
  // 初始化服务管理器
  useEffect(() => {
    const initServices = async () => {
      if (profile?.id) {
        const serviceManager = getServiceManager();
        await serviceManager.initialize(Number(profile.id));
        serviceManager.setUserId(Number(profile.id));
      }
    };
    initServices();
  }, [profile]);

  // 使用自定义Hooks - 添加错误处理
  const followupsData = useFollowupsData();
  const filterManager = useFilterManager();
  const enumData = useEnumData();
  const frequencyControl = useFrequencyControl();
  
  // 抽屉状态
  const [stageDrawerOpen, setStageDrawerOpen] = useState(false);
  const [currentEditRecord, setCurrentEditRecord] = useState<any>(null);
  
  // 筛选面板状态
  const [filterDrawerOpen, setFilterDrawerOpen] = useState(false);
  
  // 立即自动保存系统 - 添加错误处理
  const autoSave = useAutoSave({
    maxRetries: 3,
    retryDelay: 1000
  });

  // 优化的本地数据管理 - 添加错误处理
  const optimizedLocalData = useOptimizedLocalData(followupsData?.data || [], {
    enableOptimisticUpdates: true
  });

  // 确保传递给组件的数据是安全的
  const safeTableData = useMemo(() => {
    try {
      const data = optimizedLocalData?.data;
      if (Array.isArray(data)) {
        return data;
      }
      console.warn('⚠️ [MobileFollowups] 数据不是数组:', data);
      return [];
    } catch (error) {
      console.error('⚠️ [MobileFollowups] 数据处理错误:', error);
      return [];
    }
  }, [optimizedLocalData?.data]);

  // 处理关键词搜索
  const handleKeywordSearch = useCallback((value: string) => {
    try {
      filterManager?.setKeywordSearch(value);
      
      const currentFilters = filterManager?.getCurrentFiltersFn?.() || {};
      const filtersWithKeyword = value.trim() 
        ? { ...currentFilters, p_keyword: value.trim() }
        : { ...currentFilters };
      
      if (!value.trim()) {
        delete filtersWithKeyword.p_keyword;
      }
      
      followupsData?.refreshData?.(filtersWithKeyword);
    } catch (error) {
      console.error('⚠️ [MobileFollowups] 关键词搜索错误:', error);
      message.error('搜索失败，请重试');
    }
  }, [filterManager, followupsData]);

  // 处理筛选条件变更
  const handleFilterChange = useCallback((filters: any) => {
    try {
      filterManager?.updateFilters?.(filters);
      followupsData?.refreshData?.(filters);
      setFilterDrawerOpen(false);
    } catch (error) {
      console.error('⚠️ [MobileFollowups] 筛选条件变更错误:', error);
      message.error('筛选失败，请重试');
    }
  }, [filterManager, followupsData]);

  // 处理卡片点击编辑
  const handleCardEdit = useCallback((record: any) => {
    setCurrentEditRecord(record);
    setStageDrawerOpen(true);
  }, []);

  // 处理抽屉保存
  const handleStageDrawerSave = useCallback(async (updatedRecord: any) => {
    try {
      // 使用自动保存系统
      await autoSave.save(updatedRecord);
      message.success('保存成功');
      setStageDrawerOpen(false);
      followupsData.refreshData();
    } catch (error) {
      message.error('保存失败，请重试');
      console.error('保存失败:', error);
    }
  }, [autoSave, followupsData]);

  // 处理抽屉关闭
  const handleStageDrawerClose = useCallback(() => {
    setStageDrawerOpen(false);
    setCurrentEditRecord(null);
  }, []);

  // 刷新数据
  const handleRefresh = useCallback(() => {
    try {
      followupsData?.refreshData?.();
    } catch (error) {
      console.error('⚠️ [MobileFollowups] 刷新数据错误:', error);
      message.error('刷新失败，请重试');
    }
  }, [followupsData]);

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
            onClick={() => handleCardEdit(record)}
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

  // 渲染筛选面板
  const renderFilterPanel = () => (
    <Drawer
      title="筛选条件"
      placement="right"
      open={filterDrawerOpen}
      onClose={() => setFilterDrawerOpen(false)}
      width={300}
    >
      <Form layout="vertical">
        <Form.Item label="跟进阶段">
          <Select
            placeholder="选择跟进阶段"
            options={enumData.followupstageEnum?.map((item: any) => ({
              value: item.value,
              label: item.label
            }))}
            allowClear
            onChange={(value) => handleFilterChange({ followupstage: value })}
          />
        </Form.Item>
        
        <Form.Item label="意向社区">
          <Select
            placeholder="选择意向社区"
            options={enumData.communityEnum?.map((item: any) => ({
              value: item.value,
              label: item.label
            }))}
            allowClear
            onChange={(value) => handleFilterChange({ scheduledcommunity: value })}
          />
        </Form.Item>
        
        <Form.Item label="客户等级">
          <Select
            placeholder="选择客户等级"
            options={enumData.customerprofileEnum?.map((item: any) => ({
              value: item.value,
              label: item.label
            }))}
            allowClear
            onChange={(value) => handleFilterChange({ customerprofile: value })}
          />
        </Form.Item>
        
        <Form.Item label="来源">
          <Select
            placeholder="选择来源"
            options={enumData.sourceEnum?.map((item: any) => ({
              value: item.value,
              label: item.label
            }))}
            allowClear
            onChange={(value) => handleFilterChange({ source: value })}
          />
        </Form.Item>
        
        <Form.Item label="跟进时间范围">
          <RangePicker
            style={{ width: '100%' }}
            onChange={(dates) => {
              if (dates) {
                handleFilterChange({
                  followupdaterange: [
                    dates[0]?.toISOString(),
                    dates[1]?.toISOString()
                  ]
                });
              }
            }}
          />
        </Form.Item>
      </Form>
    </Drawer>
  );

  return (
    <div className={`mobile-followups ${className || ''}`}>
      <Layout>
        <Content className="mobile-content">
          {/* 顶部操作栏 */}
          <div className="mobile-header">
            <div className="header-title">
              <h2>客户跟进</h2>
              <span className="record-count">共 {safeTableData.length} 条记录</span>
            </div>
            
            <div className="header-actions">
              <Button
                icon={<FilterOutlined />}
                onClick={() => setFilterDrawerOpen(true)}
                size="small"
              >
                筛选
              </Button>
              <Button
                icon={<ReloadOutlined />}
                onClick={handleRefresh}
                loading={followupsData.loading}
                size="small"
              >
                刷新
              </Button>
            </div>
          </div>

          {/* 搜索栏 */}
          <div className="search-section">
            <Search
              placeholder="搜索客户姓名、电话、备注..."
              onSearch={handleKeywordSearch}
              enterButton={<SearchOutlined />}
              size="large"
              allowClear
            />
          </div>

          {/* 客户卡片列表 */}
          <div className="cards-container">
            {followupsData.loading ? (
              <div className="loading-container">
                <Spin size="large" />
                <p>加载中...</p>
              </div>
            ) : safeTableData.length === 0 ? (
              <Empty
                description="暂无数据"
                image={Empty.PRESENTED_IMAGE_SIMPLE}
              />
            ) : (
              <div className="cards-grid">
                {safeTableData.map(renderCustomerCard)}
              </div>
            )}
          </div>
        </Content>
      </Layout>

      {/* 筛选面板抽屉 */}
      {renderFilterPanel()}

      {/* 跟进阶段编辑抽屉 */}
      <FollowupStageDrawer
        open={stageDrawerOpen}
        onClose={handleStageDrawerClose}
        record={currentEditRecord}
        onSave={handleStageDrawerSave}
        isFieldDisabled={frequencyControl.isFieldDisabled}
        forceUpdate={followupsData.forceUpdate}
        communityEnum={enumData.communityEnum}
        followupstageEnum={enumData.followupstageEnum}
        customerprofileEnum={enumData.customerprofileEnum}
        userratingEnum={enumData.userratingEnum}
        majorCategoryOptions={enumData.majorCategoryOptions}
        metroStationOptions={enumData.metroStationOptions}
      />
    </div>
  );
};

export default MobileFollowups;
