import React, { useEffect, useState } from 'react';
import { Table, Tag, Space, Image } from 'antd';
import { supabase } from '../supaClient';


const RollbackList: React.FC = () => {
  const [rollbackList, setRollbackList] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    async function fetchRollbackList() {
      setLoading(true);
      const { data, error } = await supabase
        .from('approval_instances')
        .select('id, target_id, status, created_at, config')
        .eq('type', 'lead_rollback')
        .order('created_at', { ascending: false })
        .limit(20);
      if (!error) setRollbackList(data || []);
      setLoading(false);
    }
    fetchRollbackList();
  }, []);

  return (
    <div className="rollback-list-card" style={{ marginBottom: 24, background: '#fff', borderRadius: 8, padding: 16 }}>
      <Table
        dataSource={rollbackList}
        loading={loading}
        rowKey="id"
        size="small"
        pagination={false}
        columns={[
          { title: '线索编号', dataIndex: 'target_id', key: 'target_id', width: 120 },
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
        scroll={{ x: 700 }}
      />
    </div>
  );
};

export default RollbackList; 