import React, { useEffect, useState } from 'react';
import { Table, Spin, Typography, Button, Space, Tag, Input, DatePicker, message } from 'antd';
import { ReloadOutlined, SearchOutlined } from '@ant-design/icons';
import { supabase, fetchEnumValues } from '../supaClient';
import dayjs from 'dayjs';

const { Title } = Typography;
const { RangePicker } = DatePicker;

// 声明Deal类型，补充必要字段
interface Deal {
  id: string;
  [key: string]: any;
}

const DealsList: React.FC = () => {
  const [data, setData] = useState<Deal[]>([]);
  const [loading, setLoading] = useState(false);
  const [tableFilters, setTableFilters] = useState<any>({});
  const [communityEnum, setCommunityEnum] = useState<{ value: string; text: string }[]>([]);
  const [sourceEnum, setSourceEnum] = useState<{ value: string; text: string }[]>([]);

  useEffect(() => {
    fetchDeals();
    // 获取社区和来源枚举
    fetchEnumValues('community').then(arr => setCommunityEnum(arr.map(v => ({ value: v, text: v }))));
    fetchEnumValues('source').then(arr => setSourceEnum(arr.map(v => ({ value: v, text: v }))));
  }, []);

  const fetchDeals = async (filters: Record<string, unknown> = {}) => {
    setLoading(true);
    try {
      // 只保留后端定义的参数
      const allowedParams = [
        'p_id', 'p_leadid', 'p_contractdate_start', 'p_contractdate_end',
        'p_interviewsales', 'p_showingsales', 'p_community', 'p_contractnumber',
        'p_roomnumber', 'p_created_at_start', 'p_created_at_end', 'p_source'
      ];
      const params = Object.fromEntries(
        Object.entries(filters).filter(([key]) => allowedParams.includes(key))
      );
      const { data, error } = await supabase.rpc('filter_deals', params);
      if (error) {
        message.error('获取成交记录失败: ' + error.message);
      } else {
        setData(data || []);
      }
    } catch (error) {
      message.error('获取成交记录失败');
    } finally {
      setLoading(false);
    }
  };

  // 动态生成表头筛选项
  const getFilters = (key: keyof Deal) => {
    const arr = Array.from(new Set(data.map(item => item[key]))).filter((val): val is string => typeof val === 'string' && !!val && val !== '');
    return arr.map(val => ({ text: val, value: val }));
  };

  const columns = [
    { title: '合同编号', dataIndex: 'contractnumber', key: 'contractnumber', filters: getFilters('contractnumber'), filterMultiple: true, filterSearch: true },
    { title: '线索编号', dataIndex: 'leadid', key: 'leadid', filters: getFilters('leadid'), filterMultiple: true, filterSearch: true },
    { title: '合同日期', dataIndex: 'contractdate', key: 'contractdate',
      filterDropdown: ({ setSelectedKeys, selectedKeys, confirm, clearFilters }: any) => {
        let rangeValue: any = undefined;
        if (Array.isArray(selectedKeys) && selectedKeys.length === 2) {
          rangeValue = [selectedKeys[0] ? dayjs(selectedKeys[0]) : null, selectedKeys[1] ? dayjs(selectedKeys[1]) : null];
        }
        return (
          <div style={{ padding: 8 }}>
            <RangePicker
              style={{ width: 240 }}
              value={rangeValue}
              onChange={(dates, dateStrings) => {
                if (dates && dateStrings[0] && dateStrings[1]) {
                  setSelectedKeys([dateStrings[0], dateStrings[1]]);
                } else {
                  setSelectedKeys([]);
                }
              }}
            />
            <div style={{ marginTop: 8, textAlign: 'right' }}>
              <Button type="primary" size="small" style={{ marginRight: 8 }} onClick={() => confirm()}>筛选</Button>
              <Button size="small" onClick={() => { clearFilters && clearFilters(); }}>重置</Button>
            </div>
          </div>
        );
      },
      onFilter: (value: any, record: any) => {
        if (!value || !Array.isArray(value) || value.length !== 2) return true;
        const [start, end] = value;
        const time = new Date(record.contractdate).getTime();
        return time >= new Date(start).getTime() && time <= new Date(end).getTime();
      },
      render: (text: string) => text ? dayjs(text).format('YYYY-MM-DD') : '-',
    },
    { title: '销售面谈', dataIndex: 'interviewsales', key: 'interviewsales', filters: getFilters('interviewsales'), filterMultiple: true, filterSearch: true },
    { title: '销售展示', dataIndex: 'showingsales', key: 'showingsales', filters: getFilters('showingsales'), filterMultiple: true, filterSearch: true },
    { title: '社区', dataIndex: 'community', key: 'community', filters: communityEnum, filterMultiple: true, render: (text: string) => <Tag color="blue">{text}</Tag> },
    { title: '房间编号', dataIndex: 'roomnumber', key: 'roomnumber', filters: getFilters('roomnumber'), filterMultiple: true, filterSearch: true },
    { title: '来源', dataIndex: 'source', key: 'source', filters: sourceEnum, filterMultiple: true, render: (text: string) => <Tag color="purple">{text}</Tag> },
    { title: '创建时间', dataIndex: 'created_at', key: 'created_at',
      filterDropdown: ({ setSelectedKeys, selectedKeys, confirm, clearFilters }: any) => {
        let rangeValue: any = undefined;
        if (Array.isArray(selectedKeys) && selectedKeys.length === 2) {
          rangeValue = [selectedKeys[0] ? dayjs(selectedKeys[0]) : null, selectedKeys[1] ? dayjs(selectedKeys[1]) : null];
        }
        return (
          <div style={{ padding: 8 }}>
            <RangePicker
              style={{ width: 240 }}
              value={rangeValue}
              onChange={(dates, dateStrings) => {
                if (dates && dateStrings[0] && dateStrings[1]) {
                  setSelectedKeys([dateStrings[0], dateStrings[1]]);
                } else {
                  setSelectedKeys([]);
                }
              }}
            />
            <div style={{ marginTop: 8, textAlign: 'right' }}>
              <Button type="primary" size="small" style={{ marginRight: 8 }} onClick={() => confirm()}>筛选</Button>
              <Button size="small" onClick={() => { clearFilters && clearFilters(); }}>重置</Button>
            </div>
          </div>
        );
      },
      render: (text: string) => text ? dayjs(text).format('YYYY-MM-DD HH:mm') : '-',
    },
  ];

  // 筛选事件
  const handleTableChange = (_pagination: any, filters: any) => {
    const params: any = { ...tableFilters };
    // 合同日期区间特殊处理
    if (filters.contractdate && Array.isArray(filters.contractdate) && filters.contractdate.length === 2) {
      params.p_contractdate_start = filters.contractdate[0];
      params.p_contractdate_end = filters.contractdate[1];
    } else {
      params.p_contractdate_start = null;
      params.p_contractdate_end = null;
    }
    // 创建时间区间特殊处理
    if (filters.created_at && Array.isArray(filters.created_at) && filters.created_at.length === 2) {
      params.p_created_at_start = dayjs(filters.created_at[0]).tz('Asia/Shanghai').startOf('day').toISOString();
      params.p_created_at_end = dayjs(filters.created_at[1]).tz('Asia/Shanghai').endOf('day').toISOString();
    } else {
      params.p_created_at_start = null;
      params.p_created_at_end = null;
    }
    // 其它字段直接映射
    const filterMap: Record<string, string> = {
      leadid: 'p_leadid',
      interviewsales: 'p_interviewsales',
      showingsales: 'p_showingsales',
      community: 'p_community',
      contractnumber: 'p_contractnumber',
      roomnumber: 'p_roomnumber',
      source: 'p_source',
    };
    Object.keys(filterMap).forEach(key => {
      if (filters[key] && filters[key].length > 0) {
        params[filterMap[key]] = filters[key];
      } else {
        params[filterMap[key]] = null;
      }
    });
    setTableFilters(params);
    fetchDeals(params);
  };

  return (
    <div className="page-card">
      <div className="page-header">
        <Title level={4} style={{ margin: 0, fontWeight: 700, color: '#222' }}>
          成交记录
        </Title>
        <Space>
          <Input
            placeholder="搜索合同编号、线索编号、社区等"
            allowClear
            prefix={<SearchOutlined />}
            style={{ width: 240 }}
            onPressEnter={e => fetchDeals({ ...tableFilters, p_keyword: (e.target as HTMLInputElement).value })}
          />
          <Button icon={<ReloadOutlined />} onClick={() => fetchDeals()} className="page-btn">
            刷新
          </Button>
        </Space>
      </div>
      <div className="page-table-wrap">
        <Spin spinning={loading}>
          <Table
            rowKey="id"
            columns={columns}
            dataSource={data}
            pagination={{ pageSize: 10, showSizeChanger: true, showQuickJumper: true, showTotal: (total, range) => `第 ${range[0]}-${range[1]} 条，共 ${total} 条` }}
            bordered={false}
            className="page-table"
            scroll={{ x: 1200, y: 520 }}
            onChange={handleTableChange}
          />
        </Spin>
      </div>
    </div>
  );
};

export default DealsList; 