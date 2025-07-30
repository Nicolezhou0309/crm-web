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
  Modal,
  Form,
  Input,
  DatePicker,
  Select
} from 'antd';
import { 
  ReloadOutlined, 
  PlusOutlined,
  EditOutlined
} from '@ant-design/icons';
import LeadDetailDrawer from '../components/LeadDetailDrawer';
import { 
  getDeals, 
  getDealsCount, 
  getDealsCommunityOptions, 
  getDealsContractNumberOptions,
  getDealsRoomNumberOptions,
  getDealsSourceOptions,
  updateDeal,
  type Deal,
  type DealFilters
} from '../api/dealsApi';
import { getUsersProfile, type UserProfile } from '../api/usersApi';
import dayjs from 'dayjs';
import './compact-table.css';
import type { FilterDropdownProps } from 'antd/es/table/interface';

const { Title } = Typography;
const { Option } = Select;
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

  // 编辑状态
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [editingDeal, setEditingDeal] = useState<Deal | null>(null);
  const [editForm] = Form.useForm();
  const [editLoading, setEditLoading] = useState(false);

  // 选项数据
  const [communityOptions, setCommunityOptions] = useState<{ value: string; label: string }[]>([]);
  const [contractNumberOptions, setContractNumberOptions] = useState<{ value: string; label: string }[]>([]);
  const [roomNumberOptions, setRoomNumberOptions] = useState<{ value: string; label: string }[]>([]);
  const [userOptions, setUserOptions] = useState<{ value: number; label: string }[]>([]);
  const [sourceOptions, setSourceOptions] = useState<{ value: string; label: string }[]>([]);

  useEffect(() => {
    fetchOptions();
    fetchData();
  }, [currentPage, pageSize, filters, sortedInfo, filteredInfo]);

  const fetchOptions = async () => {
    try {
      // 获取社区选项
      const communities = await getDealsCommunityOptions();
      setCommunityOptions((communities as string[]).map(c => ({ value: c, label: c })));

      // 获取渠道选项
      const sources = await getDealsSourceOptions();
      setSourceOptions((sources as string[]).map(s => ({ value: s, label: s })));

      // 获取合同编号选项
      const contractNumbers = await getDealsContractNumberOptions();
      setContractNumberOptions((contractNumbers as string[]).map(c => ({ value: c, label: c })));

      // 获取房间编号选项
      const roomNumbers = await getDealsRoomNumberOptions();
      setRoomNumberOptions((roomNumbers as string[]).map(r => ({ value: r, label: r })));

      // 获取用户选项
      const users = await getUsersProfile();
      setUserOptions(users.map((user: UserProfile) => ({ value: user.id, label: user.nickname })));
    } catch (error) {
      console.error('获取选项失败:', error);
    }
  };

  const fetchData = async () => {
    setLoading(true);
    try {
      const offset = (currentPage - 1) * pageSize;
      
      // 合并筛选条件
      const combinedFilters = {
        ...filters,
        limit: pageSize,
        offset,
        orderBy: sortedInfo.columnKey || 'created_at',
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
    if (filters.contractdate && filters.contractdate.length > 0 && Array.isArray(filters.contractdate[0])) {
      const [start, end] = filters.contractdate[0];
      if (start) newFilters.contractdate_start = start;
      if (end) newFilters.contractdate_end = end;
    }
    if (filters.contractnumber && filters.contractnumber.length > 0) {
      newFilters.contractnumber = filters.contractnumber;
    }
    if (filters.community && filters.community.length > 0) {
      newFilters.community = filters.community;
    }
    if (filters.roomnumber && filters.roomnumber.length > 0) {
      newFilters.roomnumber = filters.roomnumber;
    }
    if (filters.interviewsales && filters.interviewsales.length > 0) {
      newFilters.interviewsales = filters.interviewsales;
    }
    if (filters.channel && filters.channel.length > 0) {
      newFilters.channel = filters.channel;
    }

    // handleTableChange 处理字符串模糊搜索
    if (filters.leadid && typeof filters.leadid[0] === 'string') {
      newFilters.leadid = [filters.leadid[0]];
    }
    if (filters.interviewsales && typeof filters.interviewsales[0] === 'string') {
      newFilters.interviewsales = [filters.interviewsales[0]];
    }
    if (filters.contractnumber && typeof filters.contractnumber[0] === 'string') {
      newFilters.contractnumber = [filters.contractnumber[0]];
    }
    if (filters.roomnumber && typeof filters.roomnumber[0] === 'string') {
      newFilters.roomnumber = [filters.roomnumber[0]];
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
      title: '合同日期',
      dataIndex: 'contractdate',
      key: 'contractdate',
      width: 100,
      sorter: true,
      sortOrder: sortedInfo.columnKey === 'contractdate' && sortedInfo.order,
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
                  clearFilters && clearFilters();
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
      filteredValue: filteredInfo.contractdate || null,
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
                  clearFilters && clearFilters();
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
      title: '约访管家',
      dataIndex: 'interviewsales',
      key: 'interviewsales',
      width: 100,
      sorter: true,
      sortOrder: sortedInfo.columnKey === 'interviewsales' && sortedInfo.order,
      filters: userOptions.map(option => ({ text: option.label, value: option.label })),
      filteredValue: filteredInfo.interviewsales || null,
      filterSearch: true,
      render: (text: string) => text || '-',
    },
    {
      title: '渠道',
      dataIndex: 'channel',
      key: 'channel',
      width: 80,
      sorter: true,
      sortOrder: sortedInfo.columnKey === 'channel' && sortedInfo.order,
      filters: sourceOptions.map(option => ({ text: option.label, value: option.value })),
      filteredValue: filteredInfo.channel || null,
      render: (text: string) => text ? <Tag color="green" style={{ margin: 0 }}>{text}</Tag> : '-',
    },
    {
      title: '社区',
      dataIndex: 'community',
      key: 'community',
      width: 120,
      sorter: true,
      sortOrder: sortedInfo.columnKey === 'community' && sortedInfo.order,
      filters: communityOptions.map(option => ({ text: option.label, value: option.value })),
      filteredValue: filteredInfo.community || null,
      render: (text: string) => text ? <Tag color="blue" style={{ margin: 0 }}>{text}</Tag> : '-',
    },
    {
      title: '操作编号',
      dataIndex: 'contractnumber',
      key: 'contractnumber',
      width: 120,
      sorter: true,
      sortOrder: sortedInfo.columnKey === 'contractnumber' && sortedInfo.order,
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
              <Button onClick={() => { clearFilters && clearFilters(); confirm(); }} size="small" style={{ width: 60 }}>重置</Button>
            </Space>
          </div>
        );
      },
      filteredValue: filteredInfo.contractnumber || null,
      render: (text: string) => text || '-',
    },
    {
      title: '房间号',
      dataIndex: 'roomnumber',
      key: 'roomnumber',
      width: 100,
      sorter: true,
      sortOrder: sortedInfo.columnKey === 'roomnumber' && sortedInfo.order,
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
              <Button onClick={() => { clearFilters && clearFilters(); confirm(); }} size="small" style={{ width: 60 }}>重置</Button>
            </Space>
          </div>
        );
      },
      filteredValue: filteredInfo.roomnumber || null,
      render: (text: string) => text || '-',
    },
    {
      title: '操作',
      key: 'action',
      fixed: 'right' as const,
      width: 80,
      render: (_: string, record: Deal) => (
        <Button 
          type="link" 
          size="small" 
          icon={<EditOutlined />}
          onClick={() => {
            setEditingDeal(record);
            editForm.setFieldsValue({
              contractdate: record.contractdate ? dayjs(record.contractdate) : null,
              leadid: record.leadid,
              interviewsales_user_id: record.interviewsales_user_id,
              channel: record.channel,
              community: record.community,
              contractnumber: record.contractnumber,
              roomnumber: record.roomnumber,
            });
            setEditModalVisible(true);
          }}
          style={{ 
            padding: '4px 8px', 
            fontSize: '12px',
            height: '24px',
            lineHeight: '1'
          }}
        >
          编辑
        </Button>
      ),
    },
  ];

  return (
    <div className="page-card">
      <div className="page-header">
        <Title level={4} style={{ margin: 0, fontWeight: 700, color: '#222' }}>
          成交记录管理
        </Title>
        <Space>
          <Button 
            type="primary" 
            icon={<PlusOutlined />} 
            onClick={() => {
              // TODO: 实现新增成交记录功能
              message.info('新增功能开发中...');
            }}
            className="page-btn"
          >
            新增成交记录
          </Button>
          <Button 
            icon={<ReloadOutlined />} 
            onClick={fetchData}
            className="page-btn"
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

      {/* 编辑成交记录模态框 */}
              <Modal
          title="编辑成交记录"
          open={editModalVisible}
          onCancel={() => setEditModalVisible(false)}
                 onOk={async () => {
           try {
             setEditLoading(true);
             const values = await editForm.validateFields();
             
             // 处理日期格式，移除channel和interviewsales_user_id字段（不在deals表中）
             const { channel, interviewsales_user_id, ...updateData } = values;
             const submitData = {
               ...updateData,
               contractdate: values.contractdate ? values.contractdate.format('YYYY-MM-DD') : null,
             };
             
             await updateDeal(editingDeal!.id, submitData);
             message.success('成交记录更新成功');
             setEditModalVisible(false);
             fetchData(); // 刷新列表
           } catch (error) {
             message.error('更新成交记录失败: ' + (error as Error).message);
           } finally {
             setEditLoading(false);
           }
         }}
        confirmLoading={editLoading}
        destroyOnHidden
      >
        <Form
          form={editForm}
          layout="vertical"
        >
          <Form.Item
            name="contractdate"
            label="合同日期"
            rules={[{ required: true, message: '请选择合同日期' }]}
          >
            <DatePicker style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item
            name="leadid"
            label="线索编号"
            rules={[{ required: true, message: '请输入线索编号' }]}
          >
            <Input disabled />
          </Form.Item>
                     {/* 约访管家字段在followups表中，不可直接编辑 */}
           <Form.Item
             name="interviewsales_user_id"
             label="约访管家"
           >
             <Select 
               placeholder="约访管家在followups表中管理"
               disabled
             >
               {userOptions.map(option => (
                 <Option key={option.value} value={option.value}>
                   {option.label}
                 </Option>
               ))}
             </Select>
           </Form.Item>
                     {/* 渠道字段从leads表获取，不可编辑 */}
           <Form.Item
             name="channel"
             label="渠道"
           >
             <Input disabled />
           </Form.Item>
                     <Form.Item
             name="community"
             label="社区"
             rules={[{ required: true, message: '请选择社区' }]}
           >
             <Select 
               placeholder="请选择社区"
               showSearch
               filterOption={(input, option) =>
                 (option?.children as unknown as string)?.toLowerCase().includes(input.toLowerCase())
               }
               optionFilterProp="children"
             >
               {communityOptions.map(option => (
                 <Option key={option.value} value={option.value}>
                   {option.label}
                 </Option>
               ))}
             </Select>
           </Form.Item>
                     <Form.Item
             name="contractnumber"
             label="操作编号"
             rules={[{ required: true, message: '请输入操作编号' }]}
           >
             <Input placeholder="请输入操作编号" />
           </Form.Item>
                     <Form.Item
             name="roomnumber"
             label="房间号"
             rules={[{ required: true, message: '请输入房间号' }]}
           >
             <Input placeholder="请输入房间号" />
           </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default DealsList; 