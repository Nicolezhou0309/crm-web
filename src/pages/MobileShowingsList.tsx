import React, { useEffect, useState } from 'react';
import { 
  Button, 
  Toast, 
  Dialog,
  SearchBar,
  InfiniteScroll,
  Empty,
  Loading
} from 'antd-mobile';

import { useNavigate } from 'react-router-dom';




import { 
  type Showing,
  type ShowingFilters
} from '../api/showingsApi';

// 扩展Showing接口，添加缺失的字段
interface ExtendedShowing extends Showing {
  lead_phone?: string;
  lead_wechat?: string;
  interviewsales_nickname?: string;
  trueshowingsales_nickname?: string;
  interviewsales_user_id?: number | null; // 约访销售ID
  showingsales_nickname?: string; // 分配管家姓名
}

import { getUsersProfile, type UserProfile } from '../api/usersApi';
import MobileModal from '../components/MobileModal';
import { MobileInput, MobileSelect, MobileDateInput, MobileButton } from '../components/MobileForm';
import { Form, Selector, Input } from 'antd-mobile';
import { ShowingCard } from '../components/ShowingCard';

import ShowingsService from '../services/ShowingsService';


const MobileShowingsList: React.FC = () => {

  
  // 数据状态
  const [showings, setShowings] = useState<ExtendedShowing[]>([]);
  const [loading, setLoading] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [page, setPage] = useState(1);
  const [pageSize] = useState(20);
  
  // 筛选状态
  const [filters, setFilters] = useState<ShowingFilters>({});
  const [filterVisible, setFilterVisible] = useState(false);
  
  // 表单状态
  const [formVisible, setFormVisible] = useState(false);
  const [editVisible, setEditVisible] = useState(false);
  const [editingShowing, setEditingShowing] = useState<ExtendedShowing | null>(null);
  const [submitting, setSubmitting] = useState(false);
  
  // 选项数据
  const [communityOptions, setCommunityOptions] = useState<string[]>([]);
  const [viewResultOptions, setViewResultOptions] = useState<{ value: string; label: string }[]>([]);
  const [salesOptions, setSalesOptions] = useState<{ id: number; nickname: string }[]>([]);
  const [userOptions, setUserOptions] = useState<UserProfile[]>([]);
  
  // 表单数据
  const [formData, setFormData] = useState({
    leadid: '',
    scheduletime: '',
    community: '',
    showingsales: '',
    viewresult: '',
    budget: '',
    renttime: '',
    remark: ''
  });
  
  // 编辑表单数据
  const [editFormData, setEditFormData] = useState({
    leadid: '',
    scheduletime: '',
    community: '',
    arrivaltime: '',
    showingsales: '',
    trueshowingsales: '',
    viewresult: '',
    budget: '',
    moveintime: '',
    renttime: '',
    remark: '',
    // 添加约访管家字段
    interviewsales_user_id: '',
    interviewsales_nickname: ''
  });

  // 初始化数据
  useEffect(() => {
    fetchOptions();
    fetchData(true);
  }, []);

  // 获取选项数据
  const fetchOptions = async () => {
    try {
      const [communities, viewResults, sales, users] = await Promise.all([
        ShowingsService.getCommunityOptions(),
        ShowingsService.getViewResultOptions(),
        ShowingsService.getSalesOptions(),
        getUsersProfile()
      ]);
      
      setCommunityOptions(communities.map(c => c.value));
      console.log('🔄 移动端 viewResults 数据结构:', viewResults);
      setViewResultOptions(viewResults || []);
      setSalesOptions(sales.map(s => ({ id: s.value, nickname: s.label })));
      setUserOptions(users || []);
    } catch (error) {
      Toast.show({
        content: '获取选项数据失败',
        position: 'center',
      });
    }
  };

  // 获取带看记录数据
  const fetchData = async (reset = false) => {
    if (reset) {
      setPage(1);
      setShowings([]);
      setHasMore(true);
    }
    
    if (!hasMore && !reset) return;
    
    setLoading(true);
    try {
      const currentPage = reset ? 1 : page;
      const offset = (currentPage - 1) * pageSize;
      
      const [data, total] = await Promise.all([
        ShowingsService.getShowings({
          ...filters,
          limit: pageSize,
          offset,
          orderBy: 'created_at',
          ascending: false
        }),
        ShowingsService.getShowingsCount(filters)
      ]);
      
      if (reset) {
        setShowings(data || []);
      } else {
        setShowings(prev => [...prev, ...(data || [])]);
      }
      
      setHasMore((data?.length || 0) === pageSize);
      setPage(currentPage + 1);
    } catch (error) {
      Toast.show({
        content: '获取数据失败',
        position: 'center',
      });
    } finally {
      setLoading(false);
    }
  };

  // 处理筛选
  const handleFilter = (newFilters: ShowingFilters) => {
    setFilters(newFilters);
    setFilterVisible(false);
    fetchData(true);
  };

  // 重置筛选
  const resetFilters = () => {
    setFilters({});
    setFilterVisible(false);
    fetchData(true);
  };

  // 提交表单
  const handleSubmit = async (values: any) => {
    setSubmitting(true);
    try {
      // 清理不需要的字段
      const { interviewsales_user_id, interviewsales_nickname, ...cleanValues } = values;
      
      const submitData = {
        ...cleanValues,
        scheduletime: cleanValues.scheduletime || null,
        arrivaltime: cleanValues.arrivaltime || null,
        moveintime: cleanValues.moveintime || null,
        budget: cleanValues.budget ? Number(cleanValues.budget) : null,
        renttime: cleanValues.renttime ? Number(cleanValues.renttime) : null,
        showingsales: cleanValues.showingsales ? Number(cleanValues.showingsales) : null,
        trueshowingsales: cleanValues.trueshowingsales ? Number(cleanValues.trueshowingsales) : null,
      };
      
      console.log('🔄 移动端提交数据:', submitData);
      
      if (editingShowing) {
        console.log('🔄 移动端更新带看记录:', editingShowing.id);
        await ShowingsService.updateShowing(editingShowing.id, submitData);
        Toast.show({
          content: '更新成功',
          position: 'center',
        });
      } else {
        console.log('🔄 移动端创建带看记录');
        await ShowingsService.createShowing(submitData);
        Toast.show({
          content: '创建成功',
          position: 'center',
        });
      }
      
      setFormVisible(false);
      setEditVisible(false);
      setEditingShowing(null);
      // 重置表单数据
      setFormData({
        leadid: '',
        scheduletime: '',
        community: '',
        showingsales: '',
        viewresult: '',
        budget: '',
        renttime: '',
        remark: ''
      });
      setEditFormData({
        leadid: '',
        scheduletime: '',
        community: '',
        arrivaltime: '',
        showingsales: '',
        trueshowingsales: '',
        viewresult: '',
        budget: '',
        moveintime: '',
        renttime: '',
        remark: '',
        // 添加约访管家字段
        interviewsales_user_id: '',
        interviewsales_nickname: ''
      });
      fetchData(true);
    } catch (error) {
      Toast.show({
        content: '操作失败',
        position: 'center',
      });
    } finally {
      setSubmitting(false);
    }
  };

  // 删除带看记录
  const handleDelete = async (id: string) => {
    const result = await Dialog.confirm({
      content: '确定要删除这条带看记录吗？',
      confirmText: '删除',
      cancelText: '取消',
    });
    
    if (result) {
      try {
        await ShowingsService.deleteShowing(id);
        Toast.show({
          content: '删除成功',
          position: 'center',
        });
        fetchData(true);
      } catch (error) {
        Toast.show({
          content: '删除失败',
          position: 'center',
        });
      }
    }
  };

  // 编辑带看记录
  const handleEdit = (showing: ExtendedShowing) => {
    setEditingShowing(showing);
    // 设置编辑表单数据，完全复制电脑端逻辑
    setEditFormData({
      leadid: showing.leadid || '',
      scheduletime: showing.scheduletime || '',
      community: showing.community || '',
      arrivaltime: showing.arrivaltime || '',
      showingsales: showing.showingsales?.toString() || '',
      trueshowingsales: showing.trueshowingsales?.toString() || '',
      viewresult: showing.viewresult || '',
      budget: showing.budget?.toString() || '',
      moveintime: showing.moveintime || '',
      renttime: showing.renttime?.toString() || '',
      remark: showing.remark || '',
      // 约访管家字段，完全复制电脑端逻辑
      interviewsales_user_id: (showing as any).interviewsales_user_id?.toString() || '',
      interviewsales_nickname: showing.interviewsales_nickname || '',
    });
    setEditVisible(true);
  };

  // 渲染带看记录项 - 使用ShowingCard组件
  const renderShowingItem = (showing: ExtendedShowing) => {
    return (
      <ShowingCard
        key={showing.id}
        showing={showing}
        salesOptions={salesOptions}
        onEdit={handleEdit}
      />
    );
  };

  return (
    <div className="min-h-screen">
      {/* 搜索栏和筛选按钮行 */}
      <div style={{
        background: 'transparent',
        padding: '16px 20px',
        zIndex: 90
      }}>
        <div style={{
          display: 'flex',
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '12px',
          flexWrap: 'nowrap',
          width: '100%'
        }}>
          <div style={{
            flex: 1,
            minWidth: '120px',
            margin: 0,
            padding: 0
          }}>
            <SearchBar
              placeholder="搜索线索编号"
              onSearch={(value) => {
                if (value) {
                  setFilters({ ...filters, leadid: value });
                  fetchData(true);
                }
              }}
              onClear={() => {
                setFilters({ ...filters, leadid: undefined });
                fetchData(true);
              }}
              style={{
                '--background': '#ffffff',
                '--border-radius': '12px',
                '--height': '36px',
                '--padding-left': '12px'
              }}
            />
          </div>
          
          <div style={{
            flexShrink: 0,
            minWidth: '60px',
            margin: 0,
            padding: 0
          }}>
            <Button
              onClick={() => setFilterVisible(true)}
              size="small"
              fill="outline"
              color="default"
              style={{
                '--border-radius': '8px',
                '--border-color': '#d1d5db',
                '--height': '36px'
              } as React.CSSProperties & Record<string, string>}
            >
              筛选
            </Button>
          </div>
        </div>
      </div>

      {/* 带看记录列表 */}
      <div className="p-4 space-y-4">
        {showings.length > 0 ? (
          <>
            {showings.map(renderShowingItem)}
            <InfiniteScroll
              loadMore={() => fetchData()}
              hasMore={hasMore}
            />
          </>
        ) : !loading ? (
          <Empty
            description="暂无带看记录"
            image="https://gw.alipayobjects.com/zos/antfincdn/ZHrcdLPrvN/empty.svg"
            className="py-12"
          />
        ) : null}
        
        {loading && <Loading />}
      </div>

      {/* 新增表单弹窗 */}
      <MobileModal
        visible={formVisible}
        onClose={() => {
          setFormVisible(false);
          setFormData({
            leadid: '',
            scheduletime: '',
            community: '',
            showingsales: '',
            viewresult: '',
            budget: '',
            renttime: '',
            remark: ''
          });
        }}
        title="新增带看记录"
        height="80vh"
      >
        <Form layout="vertical" className="p-4">
          <MobileInput
            label="线索编号"
            value={formData.leadid}
            onChange={(value) => setFormData({ ...formData, leadid: value })}
            placeholder="请输入线索编号"
            required
          />
          
          <MobileDateInput
            label="预约时间"
            value={formData.scheduletime}
            onChange={(value) => setFormData({ ...formData, scheduletime: value })}
            type="datetime-local"
            required
          />
          
          <MobileSelect
            label="社区"
            value={formData.community}
            onChange={(value) => setFormData({ ...formData, community: value as string })}
            options={communityOptions.map(c => ({ label: c, value: c }))}
            required
          />
          
          <MobileSelect
            label="带看销售"
            value={formData.showingsales}
            onChange={(value) => setFormData({ ...formData, showingsales: value as string })}
            options={salesOptions.map(s => ({ label: s.nickname, value: s.id }))}
            required
          />
          
          <MobileSelect
            label="带看结果"
            value={formData.viewresult}
            onChange={(value) => setFormData({ ...formData, viewresult: value as string })}
            options={viewResultOptions.map(r => ({ label: r.label, value: r.value }))}
            required
          />
          
          <MobileInput
            label="预算"
            value={formData.budget}
            onChange={(value) => setFormData({ ...formData, budget: value })}
            placeholder="请输入预算金额"
            type="number"
            required
          />
          
          <MobileInput
            label="租期(月)"
            value={formData.renttime}
            onChange={(value) => setFormData({ ...formData, renttime: value })}
            placeholder="请输入租期月数"
            type="number"
            required
          />
          
          <MobileInput
            label="备注"
            value={formData.remark}
            onChange={(value) => setFormData({ ...formData, remark: value })}
            placeholder="请输入备注信息"
          />
          
          <div className="pt-4">
            <MobileButton
              onClick={() => handleSubmit(formData)}
              type="primary"
              size="large"
              loading={submitting}
              fullWidth
            >
              提交
            </MobileButton>
          </div>
        </Form>
      </MobileModal>

      {/* 编辑表单弹窗 */}
      <MobileModal
        visible={editVisible}
        onClose={() => {
          setEditVisible(false);
          setEditFormData({
            leadid: '',
            scheduletime: '',
            community: '',
            arrivaltime: '',
            showingsales: '',
            trueshowingsales: '',
            viewresult: '',
            budget: '',
            moveintime: '',
            renttime: '',
            remark: '',
            // 添加约访管家字段
            interviewsales_user_id: '',
            interviewsales_nickname: ''
          });
          setEditingShowing(null);
        }}
        title="编辑带看记录"
        height="90vh"
      >
        <div className="p-4 space-y-4" style={{ 
          maxHeight: 'calc(90vh - 120px)', 
          overflowY: 'auto',
          WebkitOverflowScrolling: 'touch'
        }}>
          <Form layout="vertical" className="space-y-4">
            {/* 只读字段 - 约访管家 */}
            <div className="adm-list-item">
              <div className="adm-list-item-content">
                <div className="adm-list-item-content-main">
                  <div className="adm-list-item-content-main-title">
                    约访管家
                    <span className="text-red-500 ml-1">*</span>
                  </div>
                  <div className="adm-list-item-content-main-content">
                    {editFormData.interviewsales_nickname || '未设置'}
                  </div>
                </div>
              </div>
            </div>
            
            {/* 可编辑字段 */}
            <MobileDateInput
              label="到达时间"
              value={editFormData.arrivaltime}
              onChange={(value) => setEditFormData({ ...editFormData, arrivaltime: value })}
              type="datetime-local"
              required
            />
            
            <MobileSelect
              label="实际带看管家"
              value={editFormData.trueshowingsales}
              onChange={(value) => setEditFormData({ ...editFormData, trueshowingsales: value as string })}
              options={salesOptions.map(s => ({ label: s.nickname, value: s.id }))}
              required
            />
            
            <MobileSelect
              label="看房结果"
              value={editFormData.viewresult}
              onChange={(value) => setEditFormData({ ...editFormData, viewresult: value as string })}
              options={viewResultOptions.map(r => ({ label: r.label, value: r.value }))}
              required
            />
            
            <MobileInput
              label="预算"
              value={editFormData.budget}
              onChange={(value) => setEditFormData({ ...editFormData, budget: value })}
              placeholder="请输入预算金额"
              type="number"
              required
            />
            
            <MobileInput
              label="租期(月)"
              value={editFormData.renttime}
              onChange={(value) => setEditFormData({ ...editFormData, renttime: value })}
              placeholder="请输入租期月数"
              type="number"
              required
            />
            
            <MobileDateInput
              label="入住时间"
              value={editFormData.moveintime}
              onChange={(value) => setEditFormData({ ...editFormData, moveintime: value })}
              type="date"
              required
            />
            
            <MobileInput
              label="备注"
              value={editFormData.remark}
              onChange={(value) => setEditFormData({ ...editFormData, remark: value })}
              placeholder="请输入备注信息"
              required
            />
            
            <div className="pt-4 pb-4">
              <MobileButton
                onClick={() => handleSubmit(editFormData)}
                type="primary"
                size="large"
                loading={submitting}
                fullWidth
              >
                更新
              </MobileButton>
            </div>
          </Form>
        </div>
      </MobileModal>

      {/* 筛选弹窗 */}
      <MobileModal
        visible={filterVisible}
        onClose={() => setFilterVisible(false)}
        title="筛选条件"
        height="60vh"
      >
        <div className="p-4 space-y-4">
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">社区</label>
              <Selector
                options={communityOptions.map(c => ({ label: c, value: c }))}
                value={filters.community || []}
                onChange={(value: string[]) => setFilters({ ...filters, community: value })}
                multiple
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">带看结果</label>
              <Selector
                options={viewResultOptions}
                value={filters.viewresult || []}
                onChange={(value: string[]) => setFilters({ ...filters, viewresult: value })}
                multiple
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">带看销售</label>
              <Selector
                options={salesOptions.map(s => ({ label: s.nickname, value: s.id }))}
                value={filters.showingsales || []}
                onChange={(value: number[]) => setFilters({ ...filters, showingsales: value })}
                multiple
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">预算范围</label>
              <div className="flex items-center gap-2">
                <Input
                  type="number"
                  placeholder="最低预算"
                  value={filters.budget_min?.toString() || ''}
                  onChange={(value: string) => setFilters({ ...filters, budget_min: Number(value) || undefined })}
                  className="flex-1"
                />
                <span className="text-gray-500">-</span>
                <Input
                  type="number"
                  placeholder="最高预算"
                  value={filters.budget_max?.toString() || ''}
                  onChange={(value: string) => setFilters({ ...filters, budget_max: Number(value) || undefined })}
                  className="flex-1"
                />
              </div>
            </div>
          </div>
          
          <div className="space-y-3 pt-4">
            <MobileButton
              onClick={() => handleFilter(filters)}
              type="primary"
              size="large"
              fullWidth
            >
              应用筛选
            </MobileButton>
            <MobileButton
              onClick={resetFilters}
              type="secondary"
              size="large"
              fullWidth
            >
              重置筛选
            </MobileButton>
          </div>
        </div>
      </MobileModal>
          </div>
  );
};

export default MobileShowingsList;
