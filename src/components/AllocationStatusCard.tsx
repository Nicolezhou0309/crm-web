import { Card, Spin, Tag, Tooltip } from 'antd';
import { useEffect, useState } from 'react';
import { supabase } from '../supaClient';
import { getCurrentProfileId } from '../api/pointsApi';
import { CheckCircleFilled, ExclamationCircleFilled, InfoCircleFilled } from '@ant-design/icons';

const statusIcon = (g: any) => {
  if (g.can_allocate) {
    return <CheckCircleFilled style={{ color: '#36cfc9', fontSize: 18 }} />;
  } else if (Array.isArray(g.reason) && g.reason.length > 0) {
    return <ExclamationCircleFilled style={{ color: '#faad14', fontSize: 18 }} />;
  } else {
    return <ExclamationCircleFilled style={{ color: '#ff4d4f', fontSize: 18 }} />;
  }
};

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

  // 判断是否有异常分组
  const hasError = groupStatusList.some(g => !g.can_allocate);

  return (
    <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column' }}>
      <div style={{ fontSize: 16, fontWeight: 700, color: '#222', marginBottom: 8, textAlign: 'left', flex: '0 0 auto', background: '#fff', zIndex: 2, display: 'flex', alignItems: 'center', gap: 8 }}>
        <span>我的销售组</span>
        {groupStatusList.length > 0 && (
          hasError
            ? <span style={{ background: '#ffeded', color: '#ff4d4f', borderRadius: 8, fontSize: 12, padding: '2px 10px', fontWeight: 500, marginLeft: 0 }}>异常</span>
            : <span style={{ background: '#e6fffb', color: '#36cfc9', borderRadius: 8, fontSize: 12, padding: '2px 10px', fontWeight: 500, marginLeft: 0 }}>正常</span>
        )}
      </div>
      <div style={{ flex: 1, overflowY: 'auto' }}>
        {loading ? (
          <div style={{ textAlign: 'center', padding: 16 }}><Spin /></div>
        ) : groupStatusList.length === 0 ? (
          <div style={{ color: '#999', textAlign: 'center', padding: 12 }}>暂无分配组信息</div>
        ) : (
          groupStatusList.map((g, idx) => {
            const reasonText = (!g.can_allocate && Array.isArray(g.reason) && g.reason.length > 0)
              ? g.reason.join('；') : '';
            return (
              <div key={idx} style={{
                display: 'flex', alignItems: 'center',
                background: '#f6faff',
                borderRadius: 16,
                padding: '10px 16px',
                boxShadow: '0 1px 4px 0 rgba(0,0,0,0.03)',
                fontSize: 15,
                fontWeight: 500,
                minHeight: 38,
                marginBottom: 10,
              }}>
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                  <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', textAlign: 'left', display: 'inline-block' }}>
                    {g.groupname || '无'}
                  </span>
                  {reasonText && (
                    <div style={{ color: '#ff4d4f', fontSize: 12, marginTop: 2, textAlign: 'left', wordBreak: 'break-all' }}>
                      {reasonText}
                    </div>
                  )}
                </div>
                <span style={{ display: 'flex', alignItems: 'center', marginLeft: 12 }}>
                  {statusIcon(g)}
                </span>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};

export default AllocationStatusCard; 