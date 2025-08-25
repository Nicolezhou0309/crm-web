import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Layout, message, Form, Select, Drawer, DatePicker, Spin, Modal, Button, Upload } from 'antd';
import { UploadOutlined } from '@ant-design/icons';
import { MobileFollowupStageDrawer } from './components/MobileFollowupStageDrawer';
import MobileHeader from './components/MobileHeader';
import { CustomerCard } from './components/CustomerCard';
import { useFollowupsData } from './hooks/useFollowupsData';
import { useFilterManager } from './hooks/useFilterManager';
import { useEnumData } from './hooks/useEnumData';
import { useFrequencyControl } from './hooks/useFrequencyControl';
import { useInfiniteScroll } from './hooks/useInfiniteScroll';
import { getServiceManager } from '../../components/Followups/services/ServiceManager';
import { useUser } from '../../context/UserContext';
import { supabase } from '../../supaClient';
import imageCompression from 'browser-image-compression';
import type { FollowupRecord } from './types';




const { Content } = Layout;
const { RangePicker } = DatePicker;

interface MobileFollowupsProps {
  className?: string;
}

const MobileFollowups: React.FC<MobileFollowupsProps> = () => {
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

  // 获取回退理由选项
  useEffect(() => {
    const fetchRollbackReasonOptions = async () => {
      try {
        const { data, error } = await supabase
          .from('Selection')
          .select('selection')
          .eq('id', 3) // 假设回退理由的Selection.id是3
          .single();
        if (!error && data && data.selection) {
          setRollbackReasonOptions(data.selection.map((item: any) => ({ value: item.value, label: item.label })));
        }
      } catch (error) {
        console.error('获取回退理由选项失败:', error);
      }
    };
    fetchRollbackReasonOptions();
  }, []);

  // 使用自定义Hooks
  const followupsData = useFollowupsData();
  const filterManager = useFilterManager();
  const enumData = useEnumData();
  const frequencyControl = useFrequencyControl();
  
  // 图片压缩选项
  const imageCompressionOptions = useMemo(() => ({
    maxSizeMB: 0.5,
    maxWidthOrHeight: 1280,
    useWebWorker: true,
  }), []);
  
  // 无限滚动逻辑
  const handleLoadMore = useCallback(async () => {
    if (followupsData?.hasMore && !followupsData?.loadingMore) {
      await followupsData.loadMore();
    }
  }, [followupsData?.hasMore, followupsData?.loadingMore, followupsData?.loadMore]);

  // 智能瀑布流分配逻辑
  const distributeCardsToColumns = useCallback((data: any[]) => {
    if (!data || data.length === 0) return { leftColumn: [], rightColumn: [] };
    
    const leftColumn: any[] = [];
    const rightColumn: any[] = [];
    
    data.forEach((record) => {
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
  
  // 回退相关状态
  const [rollbackModalVisible, setRollbackModalVisible] = useState(false);
  const [rollbackRecord, setRollbackRecord] = useState<any>(null);
  const [rollbackReason, setRollbackReason] = useState<string | undefined>();
  const [rollbackEvidenceList, setRollbackEvidenceList] = useState<any[]>([]);
  const [rollbackUploading, setRollbackUploading] = useState(false);
  const [rollbackReasonOptions, setRollbackReasonOptions] = useState<any[]>([]);
  




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
  const handleStageDrawerSave = useCallback(async (updatedRecord: any, updatedFields: any) => {
    console.log('🔄 [handleStageDrawerSave] 被调用，参数:', updatedRecord, updatedFields);
    
    try {
      // 检查是否是关闭时的自动保存，如果是则只更新本地数据
      if (updatedFields._autoSaveOnClose) {
        console.log('🔍 [handleStageDrawerSave] 检测到关闭时自动保存，只更新本地数据');
        // 移除自动保存标记
        const { _autoSaveOnClose, ...cleanFields } = updatedFields;
        
        // 🆕 记录更新前的卡片数据状态
        const beforeUpdateRecord = followupsData?.data?.find(item => item.id === updatedRecord.id);
        console.log('🔍 [handleStageDrawerSave] 更新前的卡片数据:', {
          recordId: updatedRecord.id,
          beforeUpdate: beforeUpdateRecord,
          fieldsToUpdate: cleanFields
        });
        
        // 使用 updateLocalData 只更新当前卡片，不刷新整个列表
        Object.entries(cleanFields).forEach(([field, value]) => {
          // 🆕 修复：允许 0 和空字符串值，只排除 undefined 和 null
          if (value !== undefined && value !== null) {
            // 类型安全：确保 field 是 FollowupRecord 的有效字段
            if (field in updatedRecord) {
              followupsData?.updateLocalData?.(updatedRecord.id, field as keyof FollowupRecord, value);
            }
          }
        });
        
        // 🆕 记录更新后的卡片数据状态
        setTimeout(() => {
          // 🆕 修复：使用 updatedRecord 来验证，因为它包含了最新的数据
          const afterUpdateRecord = { ...beforeUpdateRecord, ...cleanFields };
          console.log('🔍 [handleStageDrawerSave] 更新后的卡片数据:', {
            recordId: updatedRecord.id,
            afterUpdate: afterUpdateRecord,
            dataLength: followupsData?.data?.length,
            // 🆕 特别记录预算字段的变化
            userbudgetChange: beforeUpdateRecord?.userbudget !== afterUpdateRecord?.userbudget ? {
              from: beforeUpdateRecord?.userbudget,
              to: afterUpdateRecord?.userbudget
            } : '无变化'
          });
          
          // 🆕 验证数据是否真的更新了
          if (afterUpdateRecord) {
            console.log('🔍 [handleStageDrawerSave] 数据更新验证:', {
              recordId: updatedRecord.id,
              userbudget: {
                before: beforeUpdateRecord?.userbudget,
                after: afterUpdateRecord?.userbudget,
                changed: beforeUpdateRecord?.userbudget !== afterUpdateRecord?.userbudget
              },
              moveintime: {
                before: beforeUpdateRecord?.moveintime,
                after: afterUpdateRecord?.moveintime,
                changed: beforeUpdateRecord?.moveintime !== afterUpdateRecord?.moveintime
              }
            });
          }
        }, 200); // 🆕 增加延迟时间，确保状态更新完成
        
        message.success('数据已自动保存');
      } else {
        // 手动保存时，刷新整个列表
        console.log('🔍 [handleStageDrawerSave] 手动保存，刷新整个列表');
        followupsData?.refreshData?.();
        message.success('保存成功');
      }
    } catch (error) {
      message.error('保存失败，请重试');
      console.error('保存失败:', error);
    }
  }, [followupsData]);

  // 处理线索回退 - 显示回退弹窗
  const handleLeadRollback = useCallback((record: any) => {
    setRollbackRecord(record);
    setRollbackModalVisible(true);
  }, []);

  // 处理抽屉关闭
  const handleStageDrawerClose = useCallback(() => {
    console.log('🚪 [handleStageDrawerClose] 被调用');
    setStageDrawerOpen(false);
    setCurrentEditRecord(null);
  }, []);

  // 处理回退证据上传前的预览
  const handleBeforeUpload = useCallback(async (file: File) => {
    setRollbackEvidenceList(list => [
      ...list,
      {
        file,
        preview: URL.createObjectURL(file),
        name: file.name,
      },
    ]);
    return false; // 阻止自动上传
  }, []);

  // 清理预览URL的函数
  const clearPreviewUrls = useCallback((evidenceList: any[]) => {
    evidenceList.forEach(item => {
      if (item.preview && item.preview.startsWith('blob:')) {
        URL.revokeObjectURL(item.preview);
      }
    });
  }, []);

  // 删除本地预览
  const handleRemoveEvidence = useCallback((file: any) => {
    setRollbackEvidenceList(list => {
      // 清理被删除项的预览URL
      const removedItem = list.find(item => item.name === file.name);
      if (removedItem?.preview && removedItem.preview.startsWith('blob:')) {
        URL.revokeObjectURL(removedItem.preview);
      }
      return list.filter(item => item.name !== file.name);
    });
  }, []);

  // 确认回退操作
  const handleRollbackConfirm = useCallback(async () => {
    if (!rollbackReason) {
      message.error('请选择回退理由');
      return;
    }
    if (rollbackEvidenceList.length === 0) {
      message.error('请上传回退证据');
      return;
    }
    setRollbackUploading(true);
    try {
      // 0. 检查同一线索是否已存在未完成的回退审批流实例
      const { data: existList, error: existError } = await supabase
        .from('approval_instances')
        .select('id, status')
        .eq('type', 'lead_rollback')
        .eq('target_id', rollbackRecord?.leadid)
        .in('status', ['pending', 'processing']);
      if (existError) {
        setRollbackUploading(false);
        message.error('回退检查失败，请重试');
        return;
      }
      if (existList && existList.length > 0) {
        setRollbackUploading(false);
        message.error('该线索已提交回退申请，请勿重复提交');
        return;
      }
      // 1. 上传所有图片，获取url
      const uploaded: any[] = [];
      for (const item of rollbackEvidenceList) {
        if (item.url) {
          uploaded.push(item.url);
          continue;
        }
        // 使用图片压缩优化上传
        const compressedFile = await imageCompression(item.file, imageCompressionOptions);
        const fileExt = compressedFile.name.split('.').pop();
        const fileName = `rollback-${Date.now()}-${Math.floor(Math.random()*10000)}.${fileExt}`;
        const filePath = `rollback/${fileName}`;
        const { error } = await supabase.storage.from('rollback').upload(filePath, compressedFile);
        if (error) throw error;
        const { data } = supabase.storage.from('rollback').getPublicUrl(filePath);
        uploaded.push(data.publicUrl);
      }
      // 2. 查找审批流模板id
      const { data: flowData, error: flowError } = await supabase
        .from('approval_flows')
        .select('id')
        .eq('type', 'lead_rollback')
        .maybeSingle();
      if (flowError || !flowData) {
        message.error('未找到回退审批流模板，请联系管理员配置');
        setRollbackUploading(false);
        return;
      }
      // 3. 插入审批流实例
      const { error: approvalError } = await supabase.from('approval_instances').insert({
        flow_id: flowData.id,
        type: 'lead_rollback',
        target_table: 'leads',
        target_id: rollbackRecord?.leadid,
        status: 'pending',
        created_by: profile?.id,
        config: {
          reason: rollbackReason,
          evidence: uploaded,
          leadid: rollbackRecord?.leadid,
        },
      });
      if (approvalError) throw approvalError;
      message.success('回退申请已提交，等待审批');
      setRollbackModalVisible(false);
      clearPreviewUrls(rollbackEvidenceList);
      setRollbackRecord(null);
      setRollbackReason(undefined);
      setRollbackEvidenceList([]);
      // 刷新数据
      followupsData?.refreshData?.();
    } catch (e: any) {
      message.error('回退提交失败: ' + (e.message || e.toString()));
    }
    setRollbackUploading(false);
  }, [rollbackReason, rollbackEvidenceList, rollbackRecord, profile, clearPreviewUrls, followupsData, imageCompressionOptions]);

  // 处理回退弹窗关闭
  const handleRollbackModalCancel = useCallback(() => {
    setRollbackModalVisible(false);
    // 关闭时清空所有相关状态
    clearPreviewUrls(rollbackEvidenceList);
    setRollbackRecord(null);
    setRollbackReason(undefined);
    setRollbackEvidenceList([]);
    setRollbackUploading(false);
  }, [rollbackEvidenceList, clearPreviewUrls]);

  // 缓存回退证据的文件列表映射
  const rollbackEvidenceFileList = useMemo(() => {
    return rollbackEvidenceList.map((item, idx) => ({
      uid: idx + '',
      name: item.name,
      status: 'done' as const,
      url: item.url || item.preview,
      thumbUrl: item.preview,
    }));
  }, [rollbackEvidenceList]);

  // 缓存 Upload 组件的禁用状态
  const isUploadDisabled = useMemo(() => {
    return rollbackEvidenceList.length >= 5 || rollbackUploading;
  }, [rollbackEvidenceList.length, rollbackUploading]);

  // 缓存 Upload 组件的显示状态
  const shouldShowUploadButton = useMemo(() => {
    return rollbackEvidenceList.length < 5 && !rollbackUploading;
  }, [rollbackEvidenceList.length, rollbackUploading]);

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
          />

          {/* 主要内容区域 */}
          {/* 客户卡片列表容器 - 使用Flexbox列容器实现瀑布流 */}
          <div className="flex flex-col w-full">
            {/* 双列容器 */}
            <div className="flex flex-row w-full gap-4 items-start justify-center">
              {/* 左列容器 */}
              <div className="flex flex-col w-[calc(50%-8px)]" id="column-1">
                {distributeCardsToColumns(followupsData?.data || []).leftColumn.map((record: any) => (
                  <div key={`${record.id}-${followupsData?.forceUpdate || 0}`} className="mb-4">
                    <CustomerCard
                      record={record}
                      onEdit={handleCardEdit}
                      onRollback={handleLeadRollback}
                    />
                  </div>
                ))}
              </div>
              
              {/* 右列容器 */}
              <div className="flex flex-col w-[calc(50%-8px)]" id="column-2">
                {distributeCardsToColumns(followupsData?.data || []).rightColumn.map((record: any) => (
                  <div key={`${record.id}-${followupsData?.forceUpdate || 0}`} className="mb-4">
                    <CustomerCard
                      record={record}
                      onEdit={handleCardEdit}
                      onRollback={handleLeadRollback}
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
        </Content>
      </Layout>

      {/* 筛选面板抽屉 */}
      {renderFilterPanel()}

      {/* 跟进阶段编辑抽屉 */}
      <MobileFollowupStageDrawer
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
        disableAutoSave={false}
      />

      {/* 回退弹窗 */}
      <Modal
        open={rollbackModalVisible}
        title="回退操作"
        onCancel={handleRollbackModalCancel}
        destroyOnClose
        centered
        width={340}
        footer={
          <div style={{ display: 'flex', gap: 12, padding: '0 4px' }}>
            <Button 
              size="large"
              style={{ 
                flex: 1, 
                height: '44px',
                fontSize: '16px',
                borderRadius: '8px'
              }}
              onClick={handleRollbackModalCancel}
            >
              取消
            </Button>
            <Button 
              type="primary" 
              size="large"
              style={{ 
                flex: 1, 
                height: '44px',
                fontSize: '16px',
                borderRadius: '8px'
              }}
              loading={rollbackUploading}
              onClick={handleRollbackConfirm}
            >
              确认回退
            </Button>
          </div>
        }
      >
        <Form layout="vertical">
          <Form.Item label="回退理由" required>
            <Select
              placeholder="请选择回退理由"
              options={rollbackReasonOptions}
              value={rollbackReason}
              onChange={setRollbackReason}
              allowClear
            />
          </Form.Item>
          <Form.Item label="回退证据（图片，最多5张）" required>
            <Upload
              listType="picture-card"
              fileList={rollbackEvidenceFileList}
              customRequest={() => {}}
              beforeUpload={handleBeforeUpload}
              onRemove={handleRemoveEvidence}
              showUploadList={{ showRemoveIcon: true }}
              multiple
              accept="image/*"
              disabled={isUploadDisabled}
            >
              {shouldShowUploadButton && (
                <div>
                  <UploadOutlined />
                  <div style={{ marginTop: 8 }}>上传</div>
                </div>
              )}
            </Upload>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default MobileFollowups;
