import React, { useState, useEffect } from 'react';
import { Modal, Table, Button, Input, Select, DatePicker, Tag, Space, message } from 'antd';
import { SearchOutlined, CheckOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import { supabase } from '../../supaClient';
import { useEnumData } from '../../pages/Followups/hooks/useEnumData';

interface ContractRecord {
  id: string;
  external_community_name: string;
  business_number: string;
  room_number: string;
  operation_date: string;
  customer_channel?: string;
  lease_type?: string;
  official_price?: number;
  contract_period?: number;
  deposit?: number;
  start_time?: string;
  end_time?: string;
  sales_name?: string;
  contract_type_detail?: string;
  reservation_time?: string;
  reservation_number?: string;
  customer_name?: string;
  phone?: string;
  previous_contract?: string;
  room_type?: string;
}

interface ContractSelectionModalProps {
  open: boolean;
  onClose: () => void;
  onSelect: (contractRecords: ContractRecord[]) => void;
  leadid: string;
}

export const ContractSelectionModal: React.FC<ContractSelectionModalProps> = ({
  open,
  onClose,
  onSelect,
  leadid
}) => {
  const [contractRecords, setContractRecords] = useState<ContractRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedRowKeys, setSelectedRowKeys] = useState<string[]>([]);
  const [filters, setFilters] = useState({
    community: '',
    business_number: '',
    room_number: ''
  });

  // 使用统一的枚举管理工具
  const { communityEnum, getEnumOptions } = useEnumData();


  // 获取签约记录列表
  const fetchContractRecords = async () => {
    setLoading(true);
    try {
      // 检查必填条件：社区名称 + (房间号 或 操作编号)
      const trimmedCommunity = filters.community?.trim();
      const trimmedBusinessNumber = filters.business_number?.trim();
      const trimmedRoomNumber = filters.room_number?.trim();
      
      if (!trimmedCommunity) {
        setContractRecords([]);
        setLoading(false);
        return;
      }
      
      if (!trimmedBusinessNumber && !trimmedRoomNumber) {
        setContractRecords([]);
        setLoading(false);
        return;
      }

      let query = supabase
        .from('contract_records')
        .select('*')
        .order('operation_date', { ascending: false })
        .limit(100);

      // 必须条件：社区名称
      query = query.ilike('external_community_name', `%${trimmedCommunity}%`);
      
      // 时间条件：搜索最近7天的记录
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
      query = query.gte('operation_date', sevenDaysAgo.toISOString());

      // 可选条件：业务编号或房间号（至少一个）
      if (trimmedBusinessNumber && trimmedRoomNumber) {
        // 两个都有：使用 OR 条件
        query = query.or(`business_number.ilike.%${trimmedBusinessNumber}%,room_number.ilike.%${trimmedRoomNumber}%`);
      } else if (trimmedBusinessNumber) {
        // 只有业务编号
        query = query.ilike('business_number', `%${trimmedBusinessNumber}%`);
      } else if (trimmedRoomNumber) {
        // 只有房间号
        query = query.ilike('room_number', `%${trimmedRoomNumber}%`);
      }


      const { data, error } = await query;
      
      if (error) {
        console.error('获取签约记录失败:', error);
        message.error('获取签约记录失败');
        return;
      }

      setContractRecords(data || []);
    } catch (error) {
      console.error('获取签约记录异常:', error);
      message.error('获取签约记录异常');
    } finally {
      setLoading(false);
    }
  };

  // 组件打开时清空数据和选择
  useEffect(() => {
    if (open) {
      setContractRecords([]);
      setSelectedRowKeys([]);
      setFilters({
        community: '',
        business_number: '',
        room_number: ''
      });
    }
  }, [open]);

  // 移除自动搜索，改为手动搜索
  // useEffect(() => {
  //   if (open) {
  //     fetchContractRecords();
  //   }
  // }, [filters]);

  const handleSelect = () => {
    if (selectedRowKeys.length === 0) {
      message.warning('请选择至少一条签约记录');
      return;
    }

    const selectedRecords = contractRecords.filter(record => selectedRowKeys.includes(record.id));
    if (selectedRecords.length > 0) {
      onSelect(selectedRecords);
      onClose();
    }
  };

  const handleFilterChange = (field: string, value: string) => {
    setFilters(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const clearFilters = () => {
    setFilters({
      community: '',
      business_number: '',
      room_number: ''
    });
    setContractRecords([]);
  };

  // 手动搜索函数
  const handleSearch = () => {
    fetchContractRecords();
  };

  const columns = [
    {
      title: '签约日期',
      dataIndex: 'operation_date',
      key: 'operation_date',
      width: 100,
      render: (text: string) => text ? dayjs(text).format('YYYY-MM-DD') : '-'
    },
    {
      title: '社区名称',
      dataIndex: 'external_community_name',
      key: 'external_community_name',
      width: 150,
      ellipsis: true,
      render: (text: string) => text ? <Tag color="blue">{text}</Tag> : '-'
    },
    {
      title: '签约类型',
      dataIndex: 'contract_type_detail',
      key: 'contract_type_detail',
      width: 120,
      render: (text: string) => text || '-'
    },
    {
      title: '业务编号',
      dataIndex: 'business_number',
      key: 'business_number',
      width: 150,
      ellipsis: false,
      render: (text: string) => text ? <span style={{ fontWeight: 600, color: '#1890ff' }}>{text}</span> : '-'
    },
    {
      title: '房间号',
      dataIndex: 'room_number',
      key: 'room_number',
      width: 100,
      render: (text: string) => text || '-'
    },
    {
      title: '销售姓名',
      dataIndex: 'sales_name',
      key: 'sales_name',
      width: 100,
      render: (text: string) => text || '-'
    },
    {
      title: '租期',
      dataIndex: 'contract_period',
      key: 'contract_period',
      width: 80,
      render: (period: number) => period ? `${period}个月` : '-'
    },
    {
      title: '押金',
      dataIndex: 'deposit',
      key: 'deposit',
      width: 100,
      render: (deposit: number) => deposit ? `¥${deposit.toLocaleString()}` : '-'
    },
    {
      title: '官方价格',
      dataIndex: 'official_price',
      key: 'official_price',
      width: 100,
      render: (price: number) => price ? `¥${price.toLocaleString()}` : '-'
    }
  ];

  return (
    <Modal
      title="选择签约记录"
      open={open}
      onCancel={onClose}
      width={1200}
      footer={[
        <Button key="cancel" onClick={onClose}>
          取消
        </Button>,
        <Button 
          key="select" 
          type="primary" 
          onClick={handleSelect}
          disabled={selectedRowKeys.length === 0}
        >
          确认 {selectedRowKeys.length > 0 && `(${selectedRowKeys.length}条)`}
        </Button>
      ]}
    >
      {/* 筛选条件 */}
      <div style={{ marginBottom: 16, padding: 16, background: '#f5f5f5', borderRadius: 6 }}>
        <Space wrap>
          <span style={{ color: '#ff4d4f' }}>*</span>
          <Select
            placeholder="社区名称"
            value={filters.community}
            onChange={(value) => handleFilterChange('community', value)}
            style={{ width: 150 }}
            showSearch
            allowClear
            filterOption={(input, option) =>
              (option?.label ?? '').toLowerCase().includes(input.toLowerCase())
            }
            options={communityEnum}
          />
          <Input
            placeholder="业务编号"
            value={filters.business_number}
            onChange={(e) => handleFilterChange('business_number', e.target.value)}
            style={{ width: 180 }}
            onPressEnter={handleSearch}
          />
          <Input
            placeholder="房间号"
            value={filters.room_number}
            onChange={(e) => handleFilterChange('room_number', e.target.value)}
            style={{ width: 120 }}
            onPressEnter={handleSearch}
          />
          <Button type="primary" onClick={handleSearch} icon={<SearchOutlined />}>
            搜索
          </Button>
          <Button onClick={clearFilters}>
            清空筛选
          </Button>
        </Space>
        <div style={{ marginTop: 8, fontSize: 12, color: '#999' }}>
          搜索最近7天的签约记录
        </div>
      </div>

      {/* 签约记录表格 */}
      <Table
        dataSource={contractRecords}
        columns={columns}
        loading={loading}
        rowKey="id"
        size="small"
        scroll={{ x: 1200, y: 400 }}
        rowSelection={{
          type: 'checkbox',
          selectedRowKeys,
          onChange: (keys) => setSelectedRowKeys(keys as string[]),
          hideSelectAll: false,
          columnWidth: 50,
        }}
        onRow={(record) => ({
          onClick: (e) => {
            // 如果点击的是复选框，不处理（让默认行为处理）
            if (e.target instanceof HTMLElement && e.target.closest('.ant-checkbox-wrapper')) {
              return;
            }
            
            // 点击行其他位置切换选中状态
            const isSelected = selectedRowKeys.includes(record.id);
            if (isSelected) {
              setSelectedRowKeys(selectedRowKeys.filter(key => key !== record.id));
            } else {
              setSelectedRowKeys([...selectedRowKeys, record.id]);
            }
          },
          style: {
            cursor: 'pointer',
            backgroundColor: selectedRowKeys.includes(record.id) ? '#e6f7ff' : 'transparent'
          }
        })}
        pagination={{
          pageSize: 20,
          showSizeChanger: true,
          showQuickJumper: true,
          showTotal: (total) => `共 ${total} 条记录`
        }}
        locale={{
          emptyText: loading ? '加载中...' : 
            contractRecords.length === 0 && !loading
              ? '请填写筛选条件并点击搜索按钮' 
              : '未找到符合条件的签约记录'
        }}
      />
    </Modal>
  );
};
