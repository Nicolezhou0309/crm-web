import { Card, Spin, Tag } from 'antd';
import { useEffect, useState } from 'react';
import { supabase } from '../supaClient';
import { getCurrentProfileId } from '../api/pointsApi';

const AllocationStatusCard = () => {
  const [groupStatusList, setGroupStatusList] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchStatus = async () => {
      setLoading(true);
      const profileId = await getCurrentProfileId();
      if (!profileId) {
        setGroupStatusList([]);
        setLoading(false);
        return;
      }
      const { data, error } = await supabase.rpc('get_user_allocation_status_multi', {
        p_user_id: profileId,
        p_source: '抖音',
        p_leadtype: '意向客户',
        p_community: '浦江公园社区'
      });
      if (Array.isArray(data)) {
        setGroupStatusList(data);
      } else {
        setGroupStatusList([]);
      }
      setLoading(false);
    };
    fetchStatus();
  }, []);

  return (
    <Card
      title={<span style={{ fontSize: 20, fontWeight: 700 }}>我的销售组</span>}
      style={{ maxWidth: 480, margin: '32px auto', borderRadius: 18, boxShadow: '0 4px 24px 0 rgba(0,0,0,0.08)' }}
      bodyStyle={{ padding: 24 }}
      headStyle={{ borderRadius: '18px 18px 0 0', background: '#f6ffed', borderBottom: '1px solid #e6f4ff' }}
    >
      {loading ? (
        <div style={{ textAlign: 'center', padding: 32 }}><Spin /></div>
      ) : groupStatusList.length === 0 ? (
        <div style={{ color: '#999', textAlign: 'center', padding: 24 }}>暂无分配组信息</div>
      ) : (
        groupStatusList.map((g, idx) => (
          <div key={idx} style={{ marginBottom: 20, padding: 16, borderRadius: 12, background: '#fafafa', boxShadow: '0 1px 4px 0 rgba(0,0,0,0.03)' }}>
            <div style={{ fontWeight: 700, fontSize: 18, marginBottom: 6, color: '#222' }}>{g.groupname || '无'}</div>
            <Tag
              color={g.can_allocate ? 'success' : 'error'}
              style={{ borderRadius: 8, fontSize: 13, padding: '2px 14px', marginBottom: 8 }}
            >
              {g.can_allocate ? '可发放' : '不可发放'}
            </Tag>
            {Array.isArray(g.reason) && !g.can_allocate && (
              <ul style={{ margin: '8px 0 0 0', paddingLeft: 18, color: '#f5222d', fontSize: 13, lineHeight: 1.7 }}>
                {g.reason.map((r: string, i: number) => (
                  <li key={i} style={{ color: '#f5222d', fontSize: 13, marginBottom: 2 }}>{r}</li>
                ))}
              </ul>
            )}
          </div>
        ))
      )}
    </Card>
  );
};

export default AllocationStatusCard; 