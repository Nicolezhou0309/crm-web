import React, { useEffect, useState } from 'react';
import { 
  Table, 
  Typography, 
  Button, 
  Space, 
  Tag, 
  message,
  Tooltip,
  Drawer,
  DatePicker,
  Input
} from 'antd';
import { 
  ReloadOutlined
} from '@ant-design/icons';
import LeadDetailDrawer from '../components/LeadDetailDrawer';
import { 
  getDeals, 
  getDealsCount, 
  testDealsTableAccess,
  type Deal,
  type DealFilters
} from '../api/dealsApi';
import dayjs from 'dayjs';
import './leads-common.css';
import type { FilterDropdownProps } from 'antd/es/table/interface';
import { toBeijingDateStr } from '../utils/timeUtils';


const { Title } = Typography;
const { RangePicker } = DatePicker;

const DealsList: React.FC = () => {
  const [data, setData] = useState<Deal[]>([]);
  const [loading, setLoading] = useState(false);
  const [total, setTotal] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [filters, setFilters] = useState<DealFilters>({});
  const [sortedInfo, setSortedInfo] = useState<any>({});
  const [filteredInfo, setFilteredInfo] = useState<any>({});
  
  // 线索详情抽屉状态
  const [detailDrawerVisible, setDetailDrawerVisible] = useState(false);
  const [selectedLeadId, setSelectedLeadId] = useState('');




  useEffect(() => {
    // 先测试表访问
    testDealsTableAccess().then(result => {
      console.log('🔍 [DealsList] 表访问测试结果:', result);
    });
    
    fetchData();
  }, [currentPage, pageSize, filters, sortedInfo, filteredInfo]);




  const fetchData = async () => {
    setLoading(true);
    try {
      const offset = (currentPage - 1) * pageSize;
      
      // 合并筛选条件
      const combinedFilters = {
        ...filters,
        limit: pageSize,
        offset,
        orderBy: sortedInfo.columnKey || 'id',
        ascending: sortedInfo.order === 'ascend' || false
      };
      
      
      // 为计数函数创建不包含分页参数的筛选条件
      const countFilters = { ...filters };
      
      const [deals, count] = await Promise.all([
        getDeals(combinedFilters),
        getDealsCount(countFilters)
      ]);
      
      setData(deals || []);
      setTotal(count);
    } catch (error) {
      message.error('获取成交记录失败: ' + (error as Error).message);
    } finally {
      setLoading(false);
    }
  };

  // handleTableChange 处理筛选、排序和分页
  const handleTableChange = (pagination: any, filters: any, sorter: any) => {
    setSortedInfo(sorter);
    setFilteredInfo(filters);

    // 处理分页变化
    if (pagination && pagination.current !== currentPage) {
      setCurrentPage(pagination.current);
    }
    if (pagination && pagination.pageSize !== pageSize) {
      setPageSize(pagination.pageSize);
      setCurrentPage(1); // 改变页面大小时重置到第一页
    }

    // 将表头筛选值转换为后端API格式
    const newFilters: DealFilters = {};

    // 处理各个字段的筛选
    if (filters.operation_date && filters.operation_date.length > 0 && Array.isArray(filters.operation_date[0])) {
      const [start, end] = filters.operation_date[0];
      if (start) newFilters.operation_date_start = start;
      if (end) newFilters.operation_date_end = end;
    }
    if (filters.business_number && filters.business_number.length > 0) {
      newFilters.business_number = filters.business_number;
    }
    if (filters.external_community_name && filters.external_community_name.length > 0) {
      newFilters.external_community_name = filters.external_community_name;
    }
    if (filters.room_number && filters.room_number.length > 0) {
      newFilters.room_number = filters.room_number;
    }
    if (filters.sales_name && filters.sales_name.length > 0) {
      newFilters.sales_name = filters.sales_name;
    }
    if (filters.customer_channel && filters.customer_channel.length > 0) {
      newFilters.customer_channel = filters.customer_channel;
    }
    if (filters.customer_name && filters.customer_name.length > 0) {
      newFilters.customer_name = filters.customer_name;
    }
    if (filters.phone && filters.phone.length > 0) {
      newFilters.phone = filters.phone;
    }
    if (filters.contract_type && filters.contract_type.length > 0) {
      newFilters.contract_type = filters.contract_type;
    }
    if (filters.lease_type && filters.lease_type.length > 0) {
      newFilters.lease_type = filters.lease_type;
    }

    // handleTableChange 处理字符串模糊搜索
    if (filters.leadid && typeof filters.leadid[0] === 'string') {
      newFilters.leadid = [filters.leadid[0]];
    }
    if (filters.sales_name && typeof filters.sales_name[0] === 'string') {
      newFilters.sales_name = [filters.sales_name[0]];
    }
    if (filters.business_number && typeof filters.business_number[0] === 'string') {
      newFilters.business_number = [filters.business_number[0]];
    }
    if (filters.room_number && typeof filters.room_number[0] === 'string') {
      newFilters.room_number = [filters.room_number[0]];
    }
    if (filters.customer_name && typeof filters.customer_name[0] === 'string') {
      newFilters.customer_name = [filters.customer_name[0]];
    }
    if (filters.phone && typeof filters.phone[0] === 'string') {
      newFilters.phone = [filters.phone[0]];
    }

    // 只有在筛选条件真正改变时才重置页码
    const hasFilterChanges = Object.keys(newFilters).length > 0;
    if (hasFilterChanges) {
      setCurrentPage(1);
    }
    
    setFilters(newFilters);
  };



  const columns = [
    {
      title: '签约日期',
      dataIndex: ['contract_records_data', 'operation_date'],
      key: 'operation_date',
      width: 120,
      sorter: true,
      sortOrder: sortedInfo.columnKey === 'operation_date' && sortedInfo.order,
      filterDropdown: (props: FilterDropdownProps) => {
        const { setSelectedKeys, selectedKeys, confirm, clearFilters } = props;
        let rangeValue: [any, any] | undefined = undefined;
        if (selectedKeys && selectedKeys[0] && Array.isArray(selectedKeys[0])) {
          rangeValue = [selectedKeys[0][0] ? dayjs(selectedKeys[0][0]) : null, selectedKeys[0][1] ? dayjs(selectedKeys[0][1]) : null];
        }
        return (
          <div style={{ padding: 8 }}>
            <RangePicker
              value={rangeValue}
              onChange={dates => {
                if (dates && dates.length === 2 && dates[0] && dates[1]) {
                  setSelectedKeys([([dates[0].format('YYYY-MM-DD'), dates[1].format('YYYY-MM-DD')] as any)]);
                } else {
                  setSelectedKeys([]);
                }
              }}
              style={{ marginBottom: 8, display: 'block' }}
              allowClear
            />
            <Space>
              <Button
                type="primary"
                size="small"
                onClick={() => confirm()}
                style={{ width: 60 }}
              >
                筛选
              </Button>
              <Button
                onClick={() => {
                  if (clearFilters) clearFilters();
                  confirm();
                }}
                size="small"
                style={{ width: 60 }}
              >
                重置
              </Button>
            </Space>
          </div>
        );
      },
      filteredValue: filteredInfo.operation_date || null,
      render: (text: string) => text ? dayjs(text).format('YYYY-MM-DD') : '-',
    },
    {
      title: '线索编号',
      dataIndex: 'leadid',
      key: 'leadid',
      width: 120,
      sorter: true,
      sortOrder: sortedInfo.columnKey === 'leadid' && sortedInfo.order,
      filterDropdown: (props: FilterDropdownProps) => {
        const { setSelectedKeys, selectedKeys, confirm, clearFilters } = props;
        return (
          <div style={{ padding: 8 }}>
            <Input
              placeholder="输入线索编号"
              value={selectedKeys[0] || ''}
              onChange={e => setSelectedKeys(e.target.value ? [e.target.value] : [])}
              onPressEnter={() => confirm()}
              style={{ width: 188, marginBottom: 8, display: 'block' }}
            />
            <Space>
              <Button
                type="primary"
                size="small"
                onClick={() => confirm()}
                style={{ width: 60 }}
              >
                筛选
              </Button>
              <Button
                onClick={() => {
                  if (clearFilters) clearFilters();
                  confirm();
                }}
                size="small"
                style={{ width: 60 }}
              >
                重置
              </Button>
            </Space>
          </div>
        );
      },
      filteredValue: filteredInfo.leadid || null,
      render: (text: string) => (
        <Tooltip title="点击查看线索详情">
          <Button 
            type="link" 
            size="small" 
            onClick={() => {
              setSelectedLeadId(text);
              setDetailDrawerVisible(true);
            }}
            style={{ padding: 0, height: 'auto' }}
          >
            {text}
          </Button>
        </Tooltip>
      ),
    },
    {
      title: '签约社区',
      dataIndex: ['contract_records_data', 'external_community_name'],
      key: 'external_community_name',
      width: 120,
      sorter: true,
      sortOrder: sortedInfo.columnKey === 'external_community_name' && sortedInfo.order,
      filteredValue: filteredInfo.external_community_name || null,
      render: (text: string) => text ? <Tag color="blue" style={{ margin: 0 }}>{text}</Tag> : '-',
    },
    {
      title: '签约类型',
      dataIndex: ['contract_records_data', 'contract_type_detail'],
      key: 'contract_type_detail',
      width: 120,
      sorter: true,
      sortOrder: sortedInfo.columnKey === 'contract_type_detail' && sortedInfo.order,
      render: (text: string) => text || '-',
    },
    {
      title: '签约操作编号',
      dataIndex: ['contract_records_data', 'business_number'],
      key: 'business_number',
      width: 140,
      sorter: true,
      sortOrder: sortedInfo.columnKey === 'business_number' && sortedInfo.order,
      filterDropdown: (props: FilterDropdownProps) => {
        const { setSelectedKeys, selectedKeys, confirm, clearFilters } = props;
        return (
          <div style={{ padding: 8 }}>
            <Input
              placeholder="输入操作编号"
              value={selectedKeys[0] || ''}
              onChange={e => setSelectedKeys(e.target.value ? [e.target.value] : [])}
              onPressEnter={() => confirm()}
              style={{ width: 140, marginBottom: 8, display: 'block' }}
            />
            <Space>
              <Button type="primary" size="small" onClick={() => confirm()} style={{ width: 60 }}>筛选</Button>
              <Button onClick={() => { if (clearFilters) clearFilters(); confirm(); }} size="small" style={{ width: 60 }}>重置</Button>
            </Space>
          </div>
        );
      },
      filteredValue: filteredInfo.business_number || null,
      render: (text: string) => text ? <span style={{ fontWeight: 600, color: '#1890ff' }}>{text}</span> : '-',
    },
    {
      title: '签约房间号',
      dataIndex: ['contract_records_data', 'room_number'],
      key: 'room_number',
      width: 120,
      sorter: true,
      sortOrder: sortedInfo.columnKey === 'room_number' && sortedInfo.order,
      filterDropdown: (props: FilterDropdownProps) => {
        const { setSelectedKeys, selectedKeys, confirm, clearFilters } = props;
        return (
          <div style={{ padding: 8 }}>
            <Input
              placeholder="输入房间号"
              value={selectedKeys[0] || ''}
              onChange={e => setSelectedKeys(e.target.value ? [e.target.value] : [])}
              onPressEnter={() => confirm()}
              style={{ width: 120, marginBottom: 8, display: 'block' }}
            />
            <Space>
              <Button type="primary" size="small" onClick={() => confirm()} style={{ width: 60 }}>筛选</Button>
              <Button onClick={() => { if (clearFilters) clearFilters(); confirm(); }} size="small" style={{ width: 60 }}>重置</Button>
            </Space>
          </div>
        );
      },
      filteredValue: filteredInfo.room_number || null,
      render: (text: string) => text || '-',
    },
    {
      title: '销售姓名',
      dataIndex: ['contract_records_data', 'sales_name'],
      key: 'sales_name',
      width: 100,
      sorter: true,
      sortOrder: sortedInfo.columnKey === 'sales_name' && sortedInfo.order,
      filteredValue: filteredInfo.sales_name || null,
      filterSearch: true,
      render: (text: string) => text || '-',
    },
    {
      title: '租期',
      dataIndex: ['contract_records_data', 'contract_period'],
      key: 'contract_period',
      width: 80,
      sorter: true,
      sortOrder: sortedInfo.columnKey === 'contract_period' && sortedInfo.order,
      render: (period: number) => period ? `${period}个月` : '-',
    },
    {
      title: '官方价格',
      dataIndex: ['contract_records_data', 'official_price'],
      key: 'official_price',
      width: 100,
      sorter: true,
      sortOrder: sortedInfo.columnKey === 'official_price' && sortedInfo.order,
      render: (price: number) => price ? `¥${price.toLocaleString()}` : '-',
    },
    {
      title: '押金',
      dataIndex: ['contract_records_data', 'deposit'],
      key: 'deposit',
      width: 100,
      sorter: true,
      sortOrder: sortedInfo.columnKey === 'deposit' && sortedInfo.order,
      render: (deposit: number) => deposit ? `¥${deposit.toLocaleString()}` : '-',
    },
    {
      title: '是否无效',
      dataIndex: 'invalid',
      key: 'invalid',
      width: 80,
      sorter: true,
      sortOrder: sortedInfo.columnKey === 'invalid' && sortedInfo.order,
      render: (text: boolean) => text ? <Tag color="red">无效</Tag> : <Tag color="green">有效</Tag>,
    },
  ];

  return (
    <div className="page-card">
      <div className="flex justify-between items-center mb-6">
        <Title level={4} className="m-0 font-bold text-gray-800">
          成交记录
        </Title>
        <Space>
          <Button 
            icon={<ReloadOutlined />} 
            onClick={fetchData}
            className="rounded-md font-medium"
          >
            刷新
          </Button>

        </Space>
      </div>
      <div className="page-table-wrap">
        <Table
          columns={columns}
          dataSource={data}
          rowKey="id"
          loading={loading}
          onChange={handleTableChange}
          pagination={{
            current: currentPage,
            pageSize: pageSize,
            total: total,
            showSizeChanger: true,
            showQuickJumper: true,
            showTotal: (total, range) => `第 ${range[0]}-${range[1]} 条，共 ${total} 条`,
            onChange: (page, size) => {
              setCurrentPage(page);
              setPageSize(size);
            },
          }}
          size="small"
          bordered={false}
          className="page-table compact-table"
          rowClassName={() => 'compact-table-row'}
          scroll={{ x: 'max-content', y: 600 }}
          sticky
          tableLayout="fixed"
        />
      </div>
      
      {/* 线索详情抽屉 */}
      <Drawer
        open={detailDrawerVisible}
        onClose={() => {
          setDetailDrawerVisible(false);
          setSelectedLeadId('');
        }}
        title="线索详情"
        width={800}
        destroyOnHidden
        placement="right"
      >
        {selectedLeadId && <LeadDetailDrawer leadid={selectedLeadId} />}
      </Drawer>


    </div>
  );
};

export default DealsList; 