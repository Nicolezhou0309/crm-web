import React, { useState, useEffect, useCallback } from 'react';
import { Layout, message, Form, Select, Drawer, DatePicker, Button, Space, Spin } from 'antd';
import { ArrowLeftOutlined, FilterOutlined, ReloadOutlined } from '@ant-design/icons';
import { FollowupStageDrawer } from './components/FollowupStageDrawer';
import MobileHeader from './components/MobileHeader';
import WaterfallContainer from './components/WaterfallContainer';
import { useFollowupsData } from './hooks/useFollowupsData';
import { useFilterManager } from './hooks/useFilterManager';
import { useEnumData } from './hooks/useEnumData';
import { useFrequencyControl } from './hooks/useFrequencyControl';
import { useAutoSave } from './hooks/useAutoSave';
import { useInfiniteScroll } from './hooks/useInfiniteScroll';
import { getServiceManager } from '../../components/Followups/services/ServiceManager';
import { useUser } from '../../context/UserContext';
import './WaterfallPage.css';

const { Content, Header } = Layout;
const { RangePicker } = DatePicker;

interface WaterfallPageProps {
  className?: string;
  onBack?: () => void;
}

/**
 * 小红书风格瀑布流跟进页面
 * 基于现有的mobile组件，采用双列瀑布流布局
 */
const WaterfallPage: React.FC<WaterfallPageProps> = ({ className, onBack }) => {
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

  // 使用自定义Hooks
  const followupsData = useFollowupsData();
  const filterManager = useFilterManager();
  const enumData = useEnumData();
  const frequencyControl = useFrequencyControl();
  
  // 无限滚动逻辑
  const handleLoadMore = useCallback(async () => {
    if (followupsData?.hasMore && !followupsData?.loadingMore) {
      await followupsData.loadMore();
    }
  }, [followupsData]);

  const { sentinelRef } = useInfiniteScroll({
    onLoadMore: handleLoadMore,
    hasMore: followupsData?.hasMore || false,
    loading: followupsData?.loadingMore || false,
    rootMargin: '0px'
  });
  
  // 抽屉状态
  const [stageDrawerOpen, setStageDrawerOpen] = useState(false);
  const [currentEditRecord, setCurrentEditRecord] = useState<any>(null);
  
  // 筛选面板状态
  const [filterDrawerOpen, setFilterDrawerOpen] = useState(false);
  const [currentFilters, setCurrentFilters] = useState<any>({});
  
  // 瀑布流配置
  const [waterfallConfig, setWaterfallConfig] = useState({
    columnCount: 2,
    gap: 16
  });
  
  // 自动保存系统
  const autoSave = useAutoSave({
    maxRetries: 3,
    retryDelay: 1000
  });

  // 处理关键词搜索
  const handleKeywordSearch = useCallback((value: string) => {
    try {
      filterManager?.setKeywordSearch?.(value);
      
      const currentFilters = filterManager?.getCurrentFiltersFn?.() || {};
      const filtersWithKeyword = value.trim() 
        ? { ...currentFilters, p_keyword: value.trim() }
        : { ...currentFilters };
      
      if (!value.trim()) {
        delete filtersWithKeyword.p_keyword;
      }
      
      followupsData?.refreshData?.(filtersWithKeyword);
    } catch (error) {
      console.error('⚠️ [WaterfallPage] 关键词搜索错误:', error);
      message.error('搜索失败，请重试');
    }
  }, [filterManager, followupsData]);

  // 处理关键词状态更新
  const handleKeywordChange = useCallback((value: string) => {
    filterManager?.setKeywordSearch?.(value);
  }, [filterManager]);

  // 处理关键词清除
  const handleKeywordClear = useCallback(() => {
    try {
      filterManager?.setKeywordSearch?.('');
      
      const currentFilters = filterManager?.getCurrentFiltersFn?.() || {};
      const filtersWithoutKeyword = { ...currentFilters };
      delete filtersWithoutKeyword.p_keyword;
      followupsData?.refreshData?.(filtersWithoutKeyword);
    } catch (error) {
      console.error('⚠️ [WaterfallPage] 关键词清除错误:', error);
      message.error('清除搜索失败，请重试');
    }
  }, [filterManager, followupsData]);

  // 处理筛选条件变更
  const handleFilterChange = useCallback((filters: any) => {
    try {
      const rpcFilters: any = {};
      Object.entries(filters).forEach(([key, value]) => {
        if (value !== null && value !== undefined && value !== '') {
          const rpcKey = `p_${key}`;
          rpcFilters[rpcKey] = Array.isArray(value) ? value : [value];
        }
      });
      
      setCurrentFilters(filters);
      filterManager?.setFilters?.(rpcFilters);
      followupsData?.refreshData?.(rpcFilters);
    } catch (error) {
      console.error('⚠️ [WaterfallPage] 筛选条件变更错误:', error);
      message.error('筛选失败，请重试');
    }
  }, [filterManager, followupsData]);

  // 清除所有筛选条件
  const handleClearFilters = useCallback(() => {
    setCurrentFilters({});
    filterManager?.setFilters?.({});
    filterManager?.setKeywordSearch?.('');
    followupsData?.refreshData?.({});
    setFilterDrawerOpen(false);
    message.success('已清除所有筛选条件');
  }, [filterManager, followupsData]);

  // 处理数据刷新
  const handleRefresh = useCallback(() => {
    followupsData?.refreshData?.();
    message.success('数据已刷新');
  }, [followupsData]);

  // 处理卡片点击编辑
  const handleCardEdit = useCallback((record: any) => {
    setCurrentEditRecord(record);
    setStageDrawerOpen(true);
  }, []);

  // 处理抽屉保存
  const handleStageDrawerSave = useCallback(async (updatedRecord: any) => {
    try {
      const fieldsToUpdate = Object.keys(updatedRecord).filter(key => 
        key !== 'id' && updatedRecord[key] !== undefined
      );
      
      let hasError = false;
      for (const field of fieldsToUpdate) {
        const result = await autoSave.saveField(
          updatedRecord.id, 
          field, 
          updatedRecord[field], 
          currentEditRecord?.[field]
        );
        if (!result.success) {
          hasError = true;
          console.error(`字段 ${field} 保存失败:`, result.error);
        }
      }
      
      if (hasError) {
        message.error('部分字段保存失败，请重试');
      } else {
        message.success('保存成功');
        setStageDrawerOpen(false);
        followupsData?.refreshData?.();
      }
    } catch (error) {
      message.error('保存失败，请重试');
      console.error('保存失败:', error);
    }
  }, [autoSave, followupsData, currentEditRecord]);

  // 处理抽屉关闭
  const handleStageDrawerClose = useCallback(() => {
    setStageDrawerOpen(false);
    setCurrentEditRecord(null);
  }, []);

  // 响应式调整列数
  useEffect(() => {
    const handleResize = () => {
      const width = window.innerWidth;
      let columnCount = 2;
      let gap = 16;
      
      if (width < 480) {
        columnCount = 1;
        gap = 12;
      } else if (width < 768) {
        columnCount = 2;
        gap = 12;
      } else if (width < 1200) {
        columnCount = 2;
        gap = 16;
      } else {
        columnCount = 3;
        gap = 20;
      }
      
      setWaterfallConfig({ columnCount, gap });
    };
    
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // 渲染筛选面板
  const renderFilterPanel = () => (
    <Drawer
      title={
        <div className="filter-drawer-header">
          <span>筛选条件</span>
          <Button type="link" size="small" onClick={handleClearFilters}>
            清除全部
          </Button>
        </div>
      }
      placement="right"
      open={filterDrawerOpen}
      onClose={() => setFilterDrawerOpen(false)}
      width={320}
      className="waterfall-filter-drawer"
    >
      <Form layout="vertical" className="filter-form">
        <Form.Item label="跟进阶段">
          <Select
            placeholder="选择跟进阶段"
            options={enumData.followupstageEnum?.map((item: any) => ({
              value: item.value,
              label: item.label
            }))}
            allowClear
            value={currentFilters.followupstage}
            onChange={(value) => handleFilterChange({ ...currentFilters, followupstage: value })}
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
            value={currentFilters.scheduledcommunity}
            onChange={(value) => handleFilterChange({ ...currentFilters, scheduledcommunity: value })}
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
            value={currentFilters.customerprofile}
            onChange={(value) => handleFilterChange({ ...currentFilters, customerprofile: value })}
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
            value={currentFilters.source}
            onChange={(value) => handleFilterChange({ ...currentFilters, source: value })}
          />
        </Form.Item>
        
        <Form.Item label="跟进时间范围">
          <RangePicker
            style={{ width: '100%' }}
            onChange={(dates) => {
              if (dates) {
                handleFilterChange({
                  ...currentFilters,
                  followupdaterange: [
                    dates[0]?.toISOString(),
                    dates[1]?.toISOString()
                  ]
                });
              } else {
                const newFilters = { ...currentFilters };
                delete newFilters.followupdaterange;
                handleFilterChange(newFilters);
              }
            }}
          />
        </Form.Item>
      </Form>
    </Drawer>
  );

  // 渲染头部工具栏
  const renderToolbar = () => (
    <div className="waterfall-toolbar">
      <div className="toolbar-left">
        {onBack && (
          <Button
            type="text"
            icon={<ArrowLeftOutlined />}
            onClick={onBack}
            className="back-button"
          >
            返回
          </Button>
        )}
        <div className="page-title">客户跟进 · 瀑布流</div>
      </div>
      
      <div className="toolbar-right">
        <Space>
          <Button
            type="text"
            icon={<ReloadOutlined />}
            onClick={handleRefresh}
            className="refresh-button"
          >
            刷新
          </Button>
          <Button
            type="text"
            icon={<FilterOutlined />}
            onClick={() => setFilterDrawerOpen(true)}
            className="filter-button"
          >
            筛选
          </Button>
        </Space>
      </div>
    </div>
  );

  return (
    <div className={`waterfall-page ${className || ''}`}>
      <Layout className="waterfall-layout">
        {/* 头部工具栏 */}
        <Header className="waterfall-header">
          {renderToolbar()}
        </Header>

        <Content className="waterfall-content">
          {/* 搜索头部 */}
          <div className="search-header">
            <MobileHeader
              keywordSearch={filterManager?.keywordSearch}
              onKeywordChange={handleKeywordChange}
              onKeywordSearch={handleKeywordSearch}
              onKeywordClear={handleKeywordClear}
              onFilterClick={() => setFilterDrawerOpen(true)}
              showBackButton={false}
            />
          </div>

          {/* 瀑布流容器 */}
          <WaterfallContainer
            data={followupsData?.data || []}
            onCardEdit={handleCardEdit}
            loading={followupsData?.loading}
            columnCount={waterfallConfig.columnCount}
            gap={waterfallConfig.gap}
            className="main-waterfall"
          />
          
          {/* 无限滚动哨兵元素 */}
          <div ref={sentinelRef} style={{ height: '20px', width: '100%' }} />
          
          {/* 加载更多状态 */}
          {followupsData?.loadingMore && (
            <div className="loading-more" style={{ textAlign: 'center', padding: '20px' }}>
              <Spin size="small" />
              <span style={{ marginLeft: '8px' }}>加载更多...</span>
            </div>
          )}
          

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
        forceUpdate={followupsData?.forceUpdate}
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

export default WaterfallPage;
