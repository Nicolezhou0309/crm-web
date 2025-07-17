import React, { useEffect, useState, useMemo } from 'react';
import { 
  Table, 
  Spin, 
  Typography, 
  Button, 
  Space, 
  Tag, 
  Input, 
  Modal, 
  Form, 
  message,
  Select,
  DatePicker,
  Tooltip,
  Checkbox,
  Row,
  Col
} from 'antd';
import { 
  PlusOutlined, 
  ReloadOutlined
} from '@ant-design/icons';
import { supabase, fetchEnumValues, generateLeadId } from '../supaClient';
import dayjs from 'dayjs';
import { formatCommunityRemark } from '../utils/validationUtils';
import LeadDetailDrawer from '../components/LeadDetailDrawer';
import './compact-table.css';

const { Title } = Typography;
const { Search } = Input;
const { TextArea } = Input;
const { RangePicker } = DatePicker;

interface Lead {
  id: string;
  leadid: string;
  phone: string;
  wechat: string;
  source: string;
  leadstatus: string;
  leadtype?: string;
  area?: string;
  location?: string;
  budget?: string;
  campaignname?: string;
  unitname?: string;
  creativename?: string;
  remark?: string;
  interviewsales?: string;
  created_at: string;
}

const LeadsList: React.FC = () => {
  const [data, setData] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(false);
  const [phoneSearch, setPhoneSearch] = useState('');
  const [wechatSearch, setWechatSearch] = useState('');
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [form] = Form.useForm();
  const [, setDateRange] = useState<[string, string] | null>(null);
  const [sourceEnum, setSourceEnum] = useState<{ label: string; value: string }[]>([]);
  const [tableFilters, setTableFilters] = useState<any>({});
  const [continueAdd, setContinueAdd] = useState(false);
  const [leadTypeOptions, setLeadTypeOptions] = useState<{ label: string; value: string }[]>([]);
  const [communityOptions, setCommunityOptions] = useState<{ value: string; label: string }[]>([]);
  const [submitting, setSubmitting] = useState(false);
  
  // 线索详情抽屉状态
  const [detailDrawerVisible, setDetailDrawerVisible] = useState(false);
  const [selectedLeadId, setSelectedLeadId] = useState<string>('');


  useEffect(() => {
    fetchLeads();
    // 获取渠道枚举
    fetchEnumValues('source').then(arr => {
      setSourceEnum(arr.map(v => ({ value: v, label: v })));
    });
    // 获取社区枚举
    supabase.rpc('get_enum_values', { enum_name: 'community' }).then(({ data, error }) => {
      if (!error && Array.isArray(data)) {
        setCommunityOptions(
          data
            .filter((v: unknown): v is string => typeof v === 'string' && !!v)
            .map((v: string) => ({
              value: v,
              label: v
            }))
        );
      }
    });
  }, []);

  // 收集所有历史leadtype
  useEffect(() => {
    const types = Array.from(new Set(data.map(item => item.leadtype).filter((t): t is string => typeof t === 'string' && !!t)));
    setLeadTypeOptions(types.map(t => ({ value: t, label: t })));
  }, [data]);

  const fetchLeads = async (filters: Record<string, unknown> = {}) => {
    setLoading(true);
    try {
      const params = Object.fromEntries(
        Object.entries(filters).filter(([key]) => allowedParams.includes(key))
      );
      const { data, error } = await supabase.rpc('filter_leads', params);
      if (error) {
        message.error('获取线索失败: ' + error.message);
      } else {
        setData(data || []);
      }
    } catch (error) {
      message.error('获取线索失败');
    } finally {
      setLoading(false);
    }
  };

  const handleAdd = async (values: any) => {
    // 防重复提交
    if (submitting) {
      console.log('正在提交中，忽略重复请求');
      return;
    }
    
    console.log('=== 开始提交线索 ===');
    console.log('提交时间:', new Date().toISOString());
    console.log('表单数据:', values);
    
    setSubmitting(true);
    try {
      // 验证至少填写了手机号或微信号
      if (!values.phone && !values.wechat) {
        message.error('请至少填写手机号或微信号');
        return;
      }
      
      // 1. 生成并发安全的leadid
      console.log('开始生成leadid...');
      const leadid = await generateLeadId();
      console.log('生成的leadid:', leadid);
      
      // 2. 使用工具函数格式化社区信息
      const { community, remark, ...newLead } = values;
      const newRemark = formatCommunityRemark(community, remark);
      
      const leadToInsert = {
        ...newLead,
        leadid,
        remark: newRemark,
        created_at: new Date().toISOString(),
      };
      
      console.log('准备插入的数据:', leadToInsert);
      console.log('community值:', values.community);
      console.log('community值类型:', typeof values.community);

      console.log('开始插入数据库...');
      const { data, error } = await supabase
        .from('leads')
        .insert([leadToInsert])
        .select();
      
      if (error) {
        console.error('数据库插入失败:', error);
        message.error('添加线索失败: ' + error.message);
      } else {
        console.log('数据库插入成功:', data);
        // 判断返回的leadstatus
        const inserted = data && data[0];
        if (inserted && inserted.leadstatus === '重复') {
          message.warning('该线索为重复线索，已标记为"重复"');
        } else {
          message.success('添加线索成功！');
        }
        if (continueAdd) {
          form.resetFields();
        } else {
          setIsModalVisible(false);
          form.resetFields();
        }
        setContinueAdd(false); // 重置
        fetchLeads();
      }
    } catch (error) {
      console.error('添加线索失败:', error);
      message.error(`添加线索失败: ${(error as Error).message}`);
    } finally {
      setSubmitting(false);
    }
  };

  const getStatusColor = (status: string) => {
    const statusMap: { [key: string]: string } = {
      '新建': 'blue',
      '跟进中': 'orange',
      '已到店': 'green',
      '赢单': 'success',
      '输单': 'red',
      '重复': 'purple',
    };
    return statusMap[status] || 'default';
  };

  // 动态生成表头筛选项（唯一且无空值）
  const getFilters = (key: keyof Lead) => {
    const arr = Array.from(new Set(data.map(item => item[key]))).filter((val): val is string => typeof val === 'string' && !!val && val !== '');
    
    // 脱敏工具函数
    const maskPhone = (phone: string): string => {
      if (!phone || phone.length < 7) return phone;
      return phone.substring(0, 4) + '****' + phone.substring(phone.length - 3);
    };
    
    const maskWechat = (wechat: string): string => {
      if (!wechat || wechat.length < 4) return wechat;
      return wechat.substring(0, 2) + '****' + wechat.substring(wechat.length - 2);
    };
    
    return arr.map(val => {
      let displayText = val;
      if (key === 'phone') {
        displayText = maskPhone(val);
      } else if (key === 'wechat') {
        displayText = maskWechat(val);
      }
      return { 
        text: displayText, 
        value: val,
        // 为手机号和微信号添加搜索文本，包含原始值和脱敏值
        searchText: (key === 'phone' || key === 'wechat') ? 
          `${val} ${displayText}` : undefined // 搜索时同时匹配原始值和显示值
      };
    });
  };

  const columns = [
    {
      title: '线索编号',
      dataIndex: 'leadid',
      key: 'leadid',
      width: 120,
      filters: getFilters('leadid'),
      filterSearch: true,
      filterMultiple: false,
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
      title: '手机号',
      dataIndex: 'phone',
      key: 'phone',
      width: 120,
      filterDropdown: ({ setSelectedKeys, selectedKeys, confirm, clearFilters }: any) => {
        const phoneFilters = getFilters('phone');
        const filteredPhoneFilters = useMemo(() =>
          phoneFilters.filter(filter => {
            if (!phoneSearch) return true;
            const val = String(filter.value || '').toLowerCase();
            const text = String(filter.text || '').toLowerCase();
            return val.includes(phoneSearch.toLowerCase()) || text.includes(phoneSearch.toLowerCase());
          }), [phoneFilters, phoneSearch]);
        return (
          <div style={{ padding: 8 }}>
            <Input.Search
              placeholder="在筛选项中搜索"
              value={phoneSearch}
              onChange={e => setPhoneSearch(e.target.value)}
              style={{ marginBottom: 8 }}
            />
            <div style={{ maxHeight: 200, overflowY: 'auto' }}>
              {filteredPhoneFilters.map((filter, index) => (
                <div
                  key={index}
                  style={{
                    padding: '4px 8px',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    backgroundColor: selectedKeys.includes(filter.value) ? '#e6f7ff' : undefined
                  }}
                  onClick={() => {
                    const newKeys = selectedKeys.includes(filter.value)
                      ? selectedKeys.filter((key: any) => key !== filter.value)
                      : [...selectedKeys, filter.value];
                    setSelectedKeys(newKeys);
                  }}
                >
                  <Checkbox
                    checked={selectedKeys.includes(filter.value)}
                    style={{ marginRight: 8 }}
                    tabIndex={-1}
                    onChange={() => {}}
                  />
                  <span>{filter.text}</span>
                </div>
              ))}
            </div>
            <div style={{ textAlign: 'right' }}>
              <Button type="primary" size="small" onClick={() => confirm()} style={{ marginRight: 8 }}>
                筛选
              </Button>
              <Button size="small" onClick={() => { clearFilters && clearFilters(); confirm && confirm(); }}>
                重置
              </Button>
            </div>
          </div>
        );
      },
      filterMultiple: false,
      render: (text: string) => {
        if (!text) return <span style={{ color: '#bbb' }}>-</span>;
        
        // 手机号脱敏：前4位 + **** + 后3位
        const maskPhone = (phone: string): string => {
          if (!phone || phone.length < 7) return phone;
          return phone.substring(0, 4) + '****' + phone.substring(phone.length - 3);
        };
        
        return (
          <Tooltip title={text}>
            <span style={{ fontWeight: 600, color: '#1677ff' }}>{maskPhone(text)}</span>
          </Tooltip>
        );
      },
    },
    {
      title: '微信',
      dataIndex: 'wechat',
      key: 'wechat',
      width: 120,
      filterDropdown: ({ setSelectedKeys, selectedKeys, confirm, clearFilters }: any) => {
        const wechatFilters = getFilters('wechat');
        const filteredWechatFilters = useMemo(() =>
          wechatFilters.filter(filter => {
            if (!wechatSearch) return true;
            const val = String(filter.value || '').toLowerCase();
            const text = String(filter.text || '').toLowerCase();
            return val.includes(wechatSearch.toLowerCase()) || text.includes(wechatSearch.toLowerCase());
          }), [wechatFilters, wechatSearch]);
        return (
          <div style={{ padding: 8 }}>
            <Input.Search
              placeholder="在筛选项中搜索"
              value={wechatSearch}
              onChange={e => setWechatSearch(e.target.value)}
              style={{ marginBottom: 8 }}
            />
            <div style={{ maxHeight: 200, overflowY: 'auto' }}>
              {filteredWechatFilters.map((filter, index) => (
                <div
                  key={index}
                  style={{
                    padding: '4px 8px',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    backgroundColor: selectedKeys.includes(filter.value) ? '#e6f7ff' : undefined
                  }}
                  onClick={() => {
                    const newKeys = selectedKeys.includes(filter.value)
                      ? selectedKeys.filter((key: any) => key !== filter.value)
                      : [...selectedKeys, filter.value];
                    setSelectedKeys(newKeys);
                  }}
                >
                  <Checkbox
                    checked={selectedKeys.includes(filter.value)}
                    style={{ marginRight: 8 }}
                    tabIndex={-1}
                    onChange={() => {}}
                  />
                  <span>{filter.text}</span>
                </div>
              ))}
            </div>
            <div style={{ textAlign: 'right' }}>
              <Button type="primary" size="small" onClick={() => confirm()} style={{ marginRight: 8 }}>
                筛选
              </Button>
              <Button size="small" onClick={() => { clearFilters && clearFilters(); confirm && confirm(); }}>
                重置
              </Button>
            </div>
          </div>
        );
      },
      filterMultiple: false,
      render: (text: string) => {
        if (!text) return <span style={{ color: '#bbb' }}>-</span>;
        
        // 微信号脱敏：前2位 + ** + 后2位
        const maskWechat = (wechat: string): string => {
          if (!wechat || wechat.length < 4) return wechat;
          return wechat.substring(0, 2) + '****' + wechat.substring(wechat.length - 2);
        };
        
        return (
          <Tooltip title={text}>
            <span style={{ fontWeight: 600, color: '#1677ff' }}>{maskWechat(text)}</span>
          </Tooltip>
        );
      },
    },
    {
      title: '渠道',
      dataIndex: 'source',
      key: 'source',
      width: 100,
      filters: getFilters('source'),
      render: (text: string) => {
        const item = sourceEnum.find(i => i.value === text);
        return <Tag color="blue">{item?.label || text}</Tag>;
      },
    },
    {
      title: '线索类型',
      dataIndex: 'leadtype',
      key: 'leadtype',
      width: 100,
      filters: getFilters('leadtype'),
      render: (text: string) => text ? <Tag color="green">{text}</Tag> : '-',
    },
    {
      title: '预算',
      dataIndex: 'budget',
      key: 'budget',
      width: 100,
      filters: getFilters('budget'),
      render: (text: string) => text ? <Tag color="orange">{text}</Tag> : '-',
    },
    {
      title: '区域',
      dataIndex: 'area',
      key: 'area',
      width: 120,
      filters: getFilters('area'),
      render: (text: string) => text || '-',
    },
    {
      title: '状态',
      dataIndex: 'leadstatus',
      key: 'leadstatus',
      width: 100,
      filters: getFilters('leadstatus'),
      render: (text: string) => (
        <Tag color={getStatusColor(text)}>{text}</Tag>
      ),
    },
    {
      title: '备注',
      dataIndex: 'remark',
      key: 'remark',
      width: 150,
      filters: getFilters('remark'),
      filterSearch: true,
      render: (text: string) => text || '-',
    },
    {
      title: '分配管家',
      dataIndex: 'interviewsales',
      key: 'interviewsales',
      width: 120,
      filters: getFilters('interviewsales'),
      render: (text: string) => (
        <span style={{ color: text ? '#1677ff' : '#999' }}>
          {text || '未分配'}
        </span>
      ),
    },
    {
      title: '创建时间',
      dataIndex: 'created_at',
      key: 'created_at',
      width: 180,
      sorter: (a: Lead, b: Lead) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
      filterDropdown: ({ setSelectedKeys, selectedKeys, confirm, clearFilters }: any) => {
        let rangeValue: any = undefined;
        if (Array.isArray(selectedKeys[0]) && selectedKeys[0].length === 2) {
          const [start, end] = selectedKeys[0];
          rangeValue = [start ? dayjs(start) : null, end ? dayjs(end) : null];
        }
        return (
          <div style={{ padding: 8 }}>
            <RangePicker
              showTime
              style={{ width: 240 }}
              value={rangeValue}
              onChange={(dates, dateStrings) => {
                if (dates && dateStrings[0] && dateStrings[1]) {
                  setSelectedKeys([[dateStrings[0], dateStrings[1]]]);
                } else {
                  setSelectedKeys([]);
                }
              }}
            />
            <div style={{ marginTop: 8, textAlign: 'right' }}>
              <Button
                type="primary"
                size="small"
                style={{ marginRight: 8 }}
                onClick={() => confirm()}
              >
                筛选
              </Button>
              <Button
                size="small"
                onClick={() => {
                  clearFilters && clearFilters();
                  setDateRange(null);
                }}
              >
                重置
              </Button>
            </div>
          </div>
        );
      },
      filterDropdownProps: {
        onOpenChange: (visible: boolean) => {
          if (!visible) return;
        },
      },
      onFilter: (value: any, record: any) => {
        if (!value || !Array.isArray(value) || value.length !== 2) return true;
        const [start, end] = value;
        const time = new Date(record.created_at).getTime();
        return time >= new Date(start).getTime() && time <= new Date(end).getTime();
      },
      render: (text: string) => new Date(text).toLocaleString('zh-CN'),
    },
  ];

  // 1. allowedParams：和SQL参数一一对应
  const allowedParams = [
    'p_leadid', 'p_created_at_start', 'p_created_at_end', 'p_updata_at_start', 'p_updata_at_end',
    'p_phone', 'p_wechat', 'p_qq', 'p_location', 'p_budget', 'p_remark', 'p_source',
    'p_douyinid', 'p_douyin_accountname', 'p_staffname', 'p_redbookid', 'p_area', 'p_notelink',
    'p_campaignid', 'p_campaignname', 'p_unitid', 'p_unitname', 'p_creativedid', 'p_creativename',
    'p_leadtype', 'p_traffictype', 'p_interactiontype', 'p_douyinleadid', 'p_leadstatus', 'p_keyword'
  ];

  // 2. filterKeyMap：表格字段到参数名映射
  const filterKeyMap: Record<string, string> = {
    leadid: 'p_leadid',
    created_at: 'created_at', // 区间特殊处理
    updata_at: 'updata_at',   // 区间特殊处理
    phone: 'p_phone',
    wechat: 'p_wechat',
    qq: 'p_qq',
    location: 'p_location',
    budget: 'p_budget',
    remark: 'p_remark',
    source: 'p_source',
    douyinid: 'p_douyinid',
    douyin_accountname: 'p_douyin_accountname',
    staffname: 'p_staffname',
    redbookid: 'p_redbookid',
    area: 'p_area',
    notelink: 'p_notelink',
    campaignid: 'p_campaignid',
    campaignname: 'p_campaignname',
    unitid: 'p_unitid',
    unitname: 'p_unitname',
    creativedid: 'p_creativedid',
    creativename: 'p_creativename',
    leadtype: 'p_leadtype',
    traffictype: 'p_traffictype',
    interactiontype: 'p_interactiontype',
    douyinleadid: 'p_douyinleadid',
    leadstatus: 'p_leadstatus',
  };

  // 3. handleTableChange：所有字段都能筛选
  const handleTableChange = (_pagination: any, filters: any) => {
    const params: any = { ...tableFilters };
    Object.keys(filters).forEach(key => {
      // created_at 区间
      if (key === 'created_at') {
        if (filters.created_at && Array.isArray(filters.created_at) && filters.created_at.length === 2) {
          params.p_created_at_start = dayjs(filters.created_at[0]).tz('Asia/Shanghai').startOf('day').toISOString();
          params.p_created_at_end = dayjs(filters.created_at[1]).tz('Asia/Shanghai').endOf('day').toISOString();
        } else {
          params.p_created_at_start = null;
          params.p_created_at_end = null;
        }
        return;
      }
      // updata_at 区间
      if (key === 'updata_at') {
        if (filters.updata_at && Array.isArray(filters.updata_at) && filters.updata_at.length === 2) {
          params.p_updata_at_start = dayjs(filters.updata_at[0]).tz('Asia/Shanghai').startOf('day').toISOString();
          params.p_updata_at_end = dayjs(filters.updata_at[1]).tz('Asia/Shanghai').endOf('day').toISOString();
        } else {
          params.p_updata_at_start = null;
          params.p_updata_at_end = null;
        }
        return;
      }
      // 其它字段
      const paramKey = filterKeyMap[key];
      if (!paramKey) return;
      if (filters[key] && filters[key].length > 0) {
        params[paramKey] = filters[key][0];
      } else {
        params[paramKey] = null;
      }
    });
    setTableFilters(params);
    fetchLeads(params);
  };

  // 4. 搜索框全局搜索
  const handleGlobalSearch = (value: string) => {
    const params = { ...tableFilters, p_keyword: value || null };
    setTableFilters(params);
    fetchLeads(params);
  };

  return (
    <div className="page-card">
      <div className="page-header">
        <Title level={4} style={{ margin: 0, fontWeight: 700, color: '#222' }}>
          线索列表
        </Title>
        <Space>
          <Search
            placeholder="搜索手机号、微信号或线索编号"
            allowClear
            onSearch={handleGlobalSearch}
            className="page-search"
          />
          <Button icon={<ReloadOutlined />} onClick={() => fetchLeads()} className="page-btn">
            刷新
          </Button>
          <Button type="primary" icon={<PlusOutlined />} onClick={() => setIsModalVisible(true)} className="page-btn">
            新建线索
          </Button>
        </Space>
      </div>
      <div className="page-table-wrap">
        <Spin spinning={loading}>
          <Table
            rowKey="id"
            columns={columns}
            dataSource={data}
            pagination={{
              pageSize: 10,
              showSizeChanger: true,
              showQuickJumper: true,
              showTotal: (total, range) =>
                `第 ${range[0]}-${range[1]} 条，共 ${total} 条`,
            }}
            bordered={false}
            className="page-table compact-table"
            rowClassName={() => 'compact-table-row'}
            scroll={{ x: 1400, y: 520 }}
            onChange={handleTableChange}
          />
        </Spin>
      </div>
      {/* 新建线索弹窗 */}
      <Modal
        title="新建线索"
        open={isModalVisible}
        onCancel={() => {
          setIsModalVisible(false);
          form.resetFields();
        }}
        footer={null}
        width={800}
        className="page-modal"
      >
        <Form
          form={form}
          layout="vertical"
          onFinish={handleAdd}
        >
          <div style={{ 
            marginBottom: 16, 
            padding: 12, 
            backgroundColor: '#f6ffed', 
            border: '1px solid #b7eb8f', 
            borderRadius: 6 
          }}>
            <div style={{ color: '#52c41a', fontWeight: 500, marginBottom: 4 }}>
              💡 线索分配提示
            </div>
            <div style={{ fontSize: 12, color: '#666', lineHeight: 1.5 }}>
              系统会根据渠道、线索类型、区域等信息自动分配销售管家。
              填写越详细，分配越精准。
            </div>
          </div>
          
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                name="phone"
                label="手机号"
                rules={[
                  {
                    validator: (_, value) => {
                      const wechat = form.getFieldValue('wechat');
                      if (!value && !wechat) {
                        return Promise.reject(new Error('请至少填写手机号或微信号'));
                      }
                      return Promise.resolve();
                    }
                  }
                ]}
              >
                <Input placeholder="请输入手机号（可选）" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                name="wechat"
                label="微信号"
                rules={[
                  {
                    validator: (_, value) => {
                      const phone = form.getFieldValue('phone');
                      if (!value && !phone) {
                        return Promise.reject(new Error('请至少填写手机号或微信号'));
                      }
                      return Promise.resolve();
                    }
                  }
                ]}
              >
                <Input placeholder="请输入微信号（可选）" />
              </Form.Item>
            </Col>
          </Row>
          
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                name="source"
                label="渠道"
                rules={[{ required: true, message: '请选择渠道' }]}
              >
                <Select placeholder="请选择渠道" options={sourceEnum} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                name="community"
                label="社区"
                rules={[{ required: true, message: '请选择社区' }]}
              >
                <Select placeholder="请选择社区" options={communityOptions} />
              </Form.Item>
            </Col>
          </Row>
          
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                name="budget"
                label="预算"
              >
                <Select placeholder="请选择预算范围" allowClear>
                  <Select.Option value="2000以下">2000以下</Select.Option>
                  <Select.Option value="2000～2500">2000～2500</Select.Option>
                  <Select.Option value="2500～3000">2500～3000</Select.Option>
                  <Select.Option value="3000～4000">3000～4000</Select.Option>
                  <Select.Option value="4000以上">4000以上</Select.Option>
                </Select>
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                name="leadtype"
                label="线索类型"
              >
                <Select
                  mode="tags"
                  placeholder="请选择或输入线索类型"
                  allowClear
                  options={leadTypeOptions.length > 0 ? leadTypeOptions : [
                  ]}
                />
              </Form.Item>
            </Col>
          </Row>
          

          
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                name="campaignname"
                label="广告计划"
              >
                <Input placeholder="请输入广告计划名称（可选）" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                name="unitname"
                label="广告单元"
              >
                <Input placeholder="请输入广告单元名称（可选）" />
              </Form.Item>
            </Col>
          </Row>
          
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                name="creativename"
                label="创意名称"
              >
                <Input placeholder="请输入创意名称（可选）" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                name="remark"
                label="备注"
              >
                <TextArea 
                  rows={3} 
                  placeholder="请输入备注信息（可选）"
                  maxLength={500}
                  showCount
                  style={{ marginBottom: 16 }}
                />
              </Form.Item>
            </Col>
          </Row>
          
          <Form.Item style={{ marginBottom: 0, textAlign: 'right' }}>
            <Space>
              <Button onClick={() => {
                setIsModalVisible(false);
                form.resetFields();
              }} disabled={submitting}>
                取消
              </Button>
              <Button
                onClick={() => {
                  setContinueAdd(true);
                  form.submit();
                }}
                disabled={submitting}
              >
                继续新建
              </Button>
              <Button type="primary" htmlType="submit" loading={submitting}>
                确定
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>
      
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

export default LeadsList; 