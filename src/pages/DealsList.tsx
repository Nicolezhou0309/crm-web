import React, { useEffect, useState } from 'react';
import { 
  Table, 
  Typography, 
  Button, 
  Space, 
  Tag, 
  Input, 
  DatePicker, 
  message,
  Select,
  Row,
  Col,
  Card,
  Tooltip,
  Form
} from 'antd';
import { 
  ReloadOutlined, 
  SearchOutlined,
  PlusOutlined,
  FilterOutlined
} from '@ant-design/icons';
import LeadDetailDrawer from '../components/LeadDetailDrawer';
import { 
  getDeals, 
  getDealsCount, 
  getDealsCommunityOptions, 
  getDealsSourceOptions,
  getDealsContractNumberOptions,
  getDealsRoomNumberOptions,
  type Deal,
  type DealFilters
} from '../api/dealsApi';
import dayjs from 'dayjs';

const { Title } = Typography;
const { RangePicker } = DatePicker;

const DealsList: React.FC = () => {
  const [data, setData] = useState<Deal[]>([]);
  const [loading, setLoading] = useState(false);
  const [total, setTotal] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [filters, setFilters] = useState<DealFilters>({});
  const [showFilters, setShowFilters] = useState(false);
  
  // 线索详情抽屉状态
  const [detailDrawerVisible, setDetailDrawerVisible] = useState(false);
  const [selectedLeadId, setSelectedLeadId] = useState('');

  // 选项数据
  const [communityOptions, setCommunityOptions] = useState<{ value: string; label: string }[]>([]);
  const [sourceOptions, setSourceOptions] = useState<{ value: string; label: string }[]>([]);
  const [contractNumberOptions, setContractNumberOptions] = useState<{ value: string; label: string }[]>([]);
  const [roomNumberOptions, setRoomNumberOptions] = useState<{ value: string; label: string }[]>([]);

  useEffect(() => {
    fetchOptions();
    fetchData();
  }, [currentPage, pageSize, filters]);

  const fetchOptions = async () => {
    try {
      // 获取社区选项
      const communities = await getDealsCommunityOptions();
      setCommunityOptions((communities as string[]).map(c => ({ value: c, label: c })));

      // 获取来源选项
      const sources = await getDealsSourceOptions();
      setSourceOptions((sources as string[]).map(s => ({ value: s, label: s })));

      // 获取合同编号选项
      const contractNumbers = await getDealsContractNumberOptions();
      setContractNumberOptions((contractNumbers as string[]).map(c => ({ value: c, label: c })));

      // 获取房间编号选项
      const roomNumbers = await getDealsRoomNumberOptions();
      setRoomNumberOptions((roomNumbers as string[]).map(r => ({ value: r, label: r })));
    } catch (error) {
      console.error('获取选项失败:', error);
    }
  };

  const fetchData = async () => {
    setLoading(true);
    try {
      const offset = (currentPage - 1) * pageSize;
      const [deals, count] = await Promise.all([
        getDeals({ ...filters, limit: pageSize, offset }),
        getDealsCount(filters)
      ]);
      setData(deals || []);
      setTotal(count);
    } catch (error) {
      message.error('获取成交记录失败: ' + (error as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const handleFilter = (values: any) => {
    const newFilters: DealFilters = {};
    
    // 处理时间范围
    if (values.contractdate_range?.length === 2) {
      newFilters.contractdate_start = values.contractdate_range[0].format('YYYY-MM-DD');
      newFilters.contractdate_end = values.contractdate_range[1].format('YYYY-MM-DD');
    }
    if (values.created_at_range?.length === 2) {
      newFilters.created_at_start = values.created_at_range[0].startOf('day').toISOString();
      newFilters.created_at_end = values.created_at_range[1].endOf('day').toISOString();
    }

    // 处理其他筛选条件
    Object.keys(values).forEach(key => {
      if (values[key] !== undefined && values[key] !== null && values[key] !== '') {
        if (!key.includes('_range')) {
          newFilters[key as keyof DealFilters] = values[key];
        }
      }
    });

    setFilters(newFilters);
    setCurrentPage(1);
  };

  const columns = [
    {
      title: '合同编号',
      dataIndex: 'contractnumber',
      key: 'contractnumber',
      width: 150,
      render: (text: string) => text || '-',
    },
    {
      title: '线索编号',
      dataIndex: 'leadid',
      key: 'leadid',
      width: 120,
      render: (text: string) => (
        <Tooltip title="点击查看线索详情">
          <Button 
            type="link" 
            size="small" 
            onClick={() => {
              setSelectedLeadId(text);
              setDetailDrawerVisible(true);
            }}
          >
            {text}
          </Button>
        </Tooltip>
      ),
    },
    {
      title: '客户手机号',
      dataIndex: 'lead_phone',
      key: 'lead_phone',
      width: 130,
      render: (text: string) => text || '-',
    },
    {
      title: '客户微信',
      dataIndex: 'lead_wechat',
      key: 'lead_wechat',
      width: 130,
      render: (text: string) => text || '-',
    },
    {
      title: '合同日期',
      dataIndex: 'contractdate',
      key: 'contractdate',
      width: 120,
      render: (text: string) => text ? dayjs(text).format('YYYY-MM-DD') : '-',
    },
    {
      title: '社区',
      dataIndex: 'community',
      key: 'community',
      width: 120,
      render: (text: string) => text ? <Tag color="blue">{text}</Tag> : '-',
    },
    {
      title: '房间编号',
      dataIndex: 'roomnumber',
      key: 'roomnumber',
      width: 120,
      render: (text: string) => text || '-',
    },
    {
      title: '来源',
      dataIndex: 'lead_source',
      key: 'lead_source',
      width: 120,
      render: (text: string) => text ? <Tag color="purple">{text}</Tag> : '-',
    },
    {
      title: '创建时间',
      dataIndex: 'created_at',
      key: 'created_at',
      width: 150,
      render: (text: string) => dayjs(text).format('YYYY-MM-DD HH:mm'),
    },
  ];

  const filterForm = (
    <Card 
      title="筛选条件" 
      size="small" 
      style={{ marginBottom: 16 }}
      extra={
        <Button 
          type="link" 
          size="small" 
          onClick={() => setShowFilters(!showFilters)}
        >
          {showFilters ? '收起' : '展开'}
        </Button>
      }
    >
      {showFilters && (
        <Form layout="vertical" onFinish={handleFilter}>
          <Row gutter={16}>
            <Col span={6}>
              <Form.Item label="合同编号" name="contractnumber">
                <Select placeholder="请选择合同编号" allowClear mode="multiple">
                  {contractNumberOptions.map(option => (
                    <Select.Option key={option.value} value={option.value}>
                      {option.label}
                    </Select.Option>
                  ))}
                </Select>
              </Form.Item>
            </Col>
            <Col span={6}>
              <Form.Item label="线索编号" name="leadid">
                <Input placeholder="请输入线索编号" />
              </Form.Item>
            </Col>
            <Col span={6}>
              <Form.Item label="社区" name="community">
                <Select placeholder="请选择社区" allowClear mode="multiple">
                  {communityOptions.map(option => (
                    <Select.Option key={option.value} value={option.value}>
                      {option.label}
                    </Select.Option>
                  ))}
                </Select>
              </Form.Item>
            </Col>
            <Col span={6}>
              <Form.Item label="房间编号" name="roomnumber">
                <Select placeholder="请选择房间编号" allowClear mode="multiple">
                  {roomNumberOptions.map(option => (
                    <Select.Option key={option.value} value={option.value}>
                      {option.label}
                    </Select.Option>
                  ))}
                </Select>
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={16}>
            <Col span={8}>
              <Form.Item label="合同日期范围" name="contractdate_range">
                <RangePicker 
                  placeholder={['开始日期', '结束日期']}
                  style={{ width: '100%' }}
                />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item label="创建时间范围" name="created_at_range">
                <RangePicker 
                  showTime 
                  placeholder={['开始时间', '结束时间']}
                  style={{ width: '100%' }}
                />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item label="来源" name="source">
                <Select placeholder="请选择来源" allowClear mode="multiple">
                  {sourceOptions.map(option => (
                    <Select.Option key={option.value} value={option.value}>
                      {option.label}
                    </Select.Option>
                  ))}
                </Select>
              </Form.Item>
            </Col>
          </Row>
          <Row>
            <Col span={24}>
              <Space>
                <Button type="primary" htmlType="submit" icon={<SearchOutlined />}>
                  筛选
                </Button>
                <Button onClick={() => { setFilters({}); setCurrentPage(1); }}>
                  重置
                </Button>
              </Space>
            </Col>
          </Row>
        </Form>
      )}
    </Card>
  );

  return (
    <div style={{ padding: '24px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <Title level={3}>成交记录管理</Title>
        <Space>
          <Button 
            icon={<FilterOutlined />} 
            onClick={() => setShowFilters(!showFilters)}
          >
            筛选
          </Button>
          <Button 
            type="primary" 
            icon={<PlusOutlined />} 
            onClick={() => {
              // TODO: 实现新增成交记录功能
              message.info('新增功能开发中...');
            }}
          >
            新增成交记录
          </Button>
          <Button 
            icon={<ReloadOutlined />} 
            onClick={fetchData}
          >
            刷新
          </Button>
        </Space>
      </div>

      {filterForm}

      <Table
        columns={columns}
        dataSource={data}
        rowKey="id"
        loading={loading}
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
        scroll={{ x: 1200 }}
      />
      
      {/* 线索详情抽屉 */}
      <LeadDetailDrawer
        visible={detailDrawerVisible}
        leadid={selectedLeadId}
        onClose={() => {
          setDetailDrawerVisible(false);
          setSelectedLeadId('');
        }}
      />
    </div>
  );
};

export default DealsList; 