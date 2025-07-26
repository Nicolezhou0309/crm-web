import React, { useEffect, useState } from 'react';
import { Table, Tag, Space, Image, Input, Select } from 'antd';
import { supabase } from '../supaClient';


const { Option } = Select;

const RollbackList: React.FC = () => {
  const [rollbackList, setRollbackList] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [status, setStatus] = useState<'all' | 'approved' | 'rejected' | 'processing' | 'pending'>('all');
  const [searchLeadId, setSearchLeadId] = useState('');
  const pageSize = 10;

  useEffect(() => {
    async function fetchRollbackList() {
      setLoading(true);
      let query = supabase
        .from('approval_instances')
        .select('id, target_id, status, created_at, config, type')
        .in('type', ['lead_rollback', 'showing_rollback']);
      if (status !== 'all') query = query.eq('status', status);
      if (searchLeadId) query = query.ilike('target_id', `%${searchLeadId}%`);
      // 获取总数
      let countQuery = supabase
        .from('approval_instances')
        .select('id', { count: 'exact', head: true })
        .in('type', ['lead_rollback', 'showing_rollback']);
      if (status !== 'all') countQuery = countQuery.eq('status', status);
      if (searchLeadId) countQuery = countQuery.ilike('target_id', `%${searchLeadId}%`);
      const { count } = await countQuery;
      setTotal(count || 0);
      // 获取当前页数据
      const from = (page - 1) * pageSize;
      const to = from + pageSize - 1;
      const { data, error } = await query
        .order('created_at', { ascending: false })
        .range(from, to);
      if (!error) setRollbackList(data || []);
      setLoading(false);
    }
    fetchRollbackList();
  }, [page, status, searchLeadId]);

  // 状态筛选选项
  const statusOptions = [
    { value: 'all', label: '全部' },
    { value: 'approved', label: '已通过' },
    { value: 'rejected', label: '未通过' },
    { value: 'processing', label: '审批中' },
    { value: 'pending', label: '待审批' },
  ];

  return (
    <div className="rollback-list-card" style={{ background: '#fff', borderRadius: 8, marginBottom: -20 }}>
      <div style={{ display: 'flex', gap: 16, padding: '16px 16px 0 16px', alignItems: 'center' }}>
        <Input
          placeholder="搜索线索编号"
          allowClear
          value={searchLeadId}
          onChange={e => { setSearchLeadId(e.target.value); setPage(1); }}
          style={{ width: 180 }}
        />
        <Select
          value={status}
          onChange={val => { setStatus(val); setPage(1); }}
          style={{ width: 120 }}
        >
          {statusOptions.map(opt => (
            <Option key={opt.value} value={opt.value}>{opt.label}</Option>
          ))}
        </Select>
      </div>
      <Table
        dataSource={rollbackList}
        loading={loading}
        rowKey="id"
        size="small"
        pagination={{
          current: page,
          pageSize,
          total,
          showSizeChanger: false,
          onChange: (p) => setPage(p),
          showTotal: (t) => `共 ${t} 条`
        }}
        columns={[
          { title: '线索编号', dataIndex: 'target_id', key: 'target_id', width: 120 },
          { title: '回退类型', dataIndex: 'type', key: 'type', width: 100, render: (type: string) => {
            const typeMap: { [key: string]: string } = {
              'lead_rollback': '线索回退',
              'showing_rollback': '带看回退'
            };
            return typeMap[type] || type;
          }},
          { title: '回退理由', dataIndex: ['config', 'reason'], key: 'reason', width: 180, render: (_, record) => record.config?.reason || '-' },
          { title: '证据', key: 'evidence', width: 160, render: (_, record) => (
            <Space>
              {(record.config?.evidence || []).map((url: string) => (
                <Image key={url} src={url} width={40} height={40} style={{ objectFit: 'cover', borderRadius: 2 }} />
              ))}
            </Space>
          )},
          { title: '状态', dataIndex: 'status', key: 'status', width: 80, render: (status) => {
            let color = 'orange', text = '审批中';
            if (status === 'approved') { color = 'green'; text = '已通过'; }
            else if (status === 'rejected') { color = 'red'; text = '已拒绝'; }
            else if (status === 'processing') { color = 'orange'; text = '审批中'; }
            else if (status === 'pending') { color = 'orange'; text = '待审批'; }
            else { text = status; }
            return <Tag color={color}>{text}</Tag>;
          }},
          { title: '发起时间', dataIndex: 'created_at', key: 'created_at', width: 160, render: (t) => t && new Date(t).toLocaleString() },
        ]}
        scroll={{ x: 700, y: 400 }}
        style={{ padding: 16, marginBottom: 0 }}
      />
    </div>
  );
};

export default RollbackList; 