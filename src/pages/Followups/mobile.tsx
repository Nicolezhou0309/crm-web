import React, { useState, useEffect, useCallback } from 'react';
import { Layout, message, Form, Select, Drawer, DatePicker, Spin } from 'antd';
import { FollowupStageDrawer } from './components/FollowupStageDrawer';
import MobileHeader from './components/MobileHeader';
import { CustomerCard } from './components/CustomerCard';
import WaterfallPage from './WaterfallPage';
import { useFollowupsData } from './hooks/useFollowupsData';
import { useFilterManager } from './hooks/useFilterManager';
import { useEnumData } from './hooks/useEnumData';
import { useFrequencyControl } from './hooks/useFrequencyControl';
import { useAutoSave } from './hooks/useAutoSave';
import { useInfiniteScroll } from './hooks/useInfiniteScroll';
import { getServiceManager } from '../../components/Followups/services/ServiceManager';
import { useUser } from '../../context/UserContext';




const { Content } = Layout;
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

  // 使用自定义Hooks
  const followupsData = useFollowupsData();
  const filterManager = useFilterManager();
  const enumData = useEnumData();
  const frequencyControl = useFrequencyControl();
  
  // 无限滚动逻辑
  const handleLoadMore = useCallback(async () => {
    if (followupsData?.hasMore && !followupsData?.loadingMore) {
      console.log('触发加载更多');
      await followupsData.loadMore();
    }
  }, [followupsData?.hasMore, followupsData?.loadingMore, followupsData?.loadMore]);

  // 智能瀑布流分配逻辑
  const distributeCardsToColumns = useCallback((data: any[]) => {
    if (!data || data.length === 0) return { leftColumn: [], rightColumn: [] };
    
    const leftColumn: any[] = [];
    const rightColumn: any[] = [];
    
    data.forEach((record, index) => {
      // 如果左列卡片数量少于等于右列，添加到左列
      if (leftColumn.length <= rightColumn.length) {
        leftColumn.push(record);
      } else {
        // 否则添加到右列
        rightColumn.push(record);
      }
    });
    
    return { leftColumn, rightColumn };
  }, []);



  const { sentinelRef } = useInfiniteScroll({
    onLoadMore: handleLoadMore,
    hasMore: followupsData?.hasMore || false,
    loading: followupsData?.loadingMore || false,
    rootMargin: '200px' // 增加rootMargin，提前触发加载
  });
  
  // 抽屉状态
  const [stageDrawerOpen, setStageDrawerOpen] = useState(false);
  const [currentEditRecord, setCurrentEditRecord] = useState<any>(null);
  
  // 筛选面板状态
  const [filterDrawerOpen, setFilterDrawerOpen] = useState(false);
  
  // 视图模式状态
  const [viewMode, setViewMode] = useState<'list' | 'waterfall'>('list');
  
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
      console.error('⚠️ [MobileFollowups] 关键词搜索错误:', error);
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
      console.error('⚠️ [MobileFollowups] 关键词清除错误:', error);
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
      
      filterManager?.setFilters?.(rpcFilters);
      followupsData?.refreshData?.(rpcFilters);
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

  // 处理视图模式切换
  const handleViewModeChange = useCallback((mode: 'list' | 'waterfall') => {
    setViewMode(mode);
  }, []);

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
            className="w-full"
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
    <div className="min-h-screen flex flex-col p-0 m-0">
      <Layout className="p-0 m-0">
        <Content className="p-0 m-0 flex-1 flex flex-col !p-0 !m-0">
          {/* 头部组件 */}
          <MobileHeader
            keywordSearch={filterManager?.keywordSearch}
            onKeywordChange={handleKeywordChange}
            onKeywordSearch={handleKeywordSearch}
            onKeywordClear={handleKeywordClear}
            onFilterClick={() => setFilterDrawerOpen(true)}
            viewMode={viewMode}
            onViewModeChange={handleViewModeChange}
          />

          {/* 主要内容区域 */}
          {viewMode === 'list' ? (
            /* 客户卡片列表容器 - 使用Flexbox列容器实现瀑布流 */
            <div className="flex flex-col w-full">
              {/* 双列容器 */}
              <div className="flex flex-row w-full gap-4 items-start justify-center">
                {/* 左列容器 */}
                <div className="flex flex-col w-[calc(50%-8px)]" id="column-1">
                  {distributeCardsToColumns(followupsData?.data || []).leftColumn.map((record: any) => (
                    <div key={record.id} className="mb-4">
                      <CustomerCard
                        record={record}
                        onEdit={handleCardEdit}
                      />
                    </div>
                  ))}
                </div>
                
                {/* 右列容器 */}
                <div className="flex flex-col w-[calc(50%-8px)]" id="column-2">
                  {distributeCardsToColumns(followupsData?.data || []).rightColumn.map((record: any) => (
                    <div key={record.id} className="mb-4">
                      <CustomerCard
                        record={record}
                        onEdit={handleCardEdit}
                      />
                    </div>
                  ))}
                </div>
              </div>
              
              {/* 空状态 - 移到列外部 */}
              {(!followupsData?.data || followupsData.data.length === 0) && !followupsData?.loading && (
                <div className="flex flex-col items-center justify-center h-50 text-center text-gray-500 text-sm p-0 m-0">
                  <p className="p-0 m-0">暂无跟进记录</p>
                </div>
              )}
              
              {/* 无限滚动哨兵元素 - 移到列外部 */}
              {followupsData?.data && followupsData.data.length > 0 && (
                <div 
                  ref={sentinelRef} 
                  className="w-full h-5 opacity-0 pointer-events-none"
                />
              )}
              
              {/* 加载更多状态 - 移到列外部 */}
              {followupsData?.loadingMore && (
                <div className="flex items-center justify-center p-0 m-0 text-gray-500 text-sm bg-gray-50 rounded-lg shadow-sm w-full text-center">
                  <Spin size="small" />
                  <span className="p-0 m-0">加载更多...</span>
                </div>
              )}
              
              {/* 无更多记录提示 */}
              {followupsData?.data && followupsData.data.length > 0 && !followupsData?.hasMore && !followupsData?.loadingMore && (
                <div className="flex flex-col items-center justify-center h-50 text-center text-gray-500 text-sm p-0 m-0">
                  <p className="p-0 m-0">— 已显示全部记录 —</p>
                </div>
              )}
            </div>
          ) : (
            /* 瀑布流视图 */
            <div className="flex-1 overflow-hidden bg-gray-50">
              <WaterfallPage 
                className="mobile-waterfall"
                onBack={() => handleViewModeChange('list')}
              />
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

export default MobileFollowups;
