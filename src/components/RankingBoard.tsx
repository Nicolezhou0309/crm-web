import React, { useState } from 'react';
import { Tabs, Button, Avatar, Tag } from 'antd';

const rankingTabs = [
  {
    key: 'creator',
    label: '劳模榜',
    data: [
      { id: 1, name: '梁伟', avatar: 'https://api.dicebear.com/7.x/miniavs/svg?seed=1', value: 215, followed: false },
      { id: 2, name: '任菲菲', avatar: 'https://api.dicebear.com/7.x/miniavs/svg?seed=2', value: 164, followed: false },
      { id: 3, name: '李士军', avatar: 'https://api.dicebear.com/7.x/miniavs/svg?seed=3', value: 166, followed: false },
      { id: 4, name: '唐攀', avatar: 'https://api.dicebear.com/7.x/miniavs/svg?seed=4', value: 150, followed: false },
      { id: 5, name: '康萍', avatar: 'https://api.dicebear.com/7.x/miniavs/svg?seed=5', value: 153, followed: false },
      { id: 6, name: '周轩元', avatar: 'https://api.dicebear.com/7.x/miniavs/svg?seed=6', value: 144, followed: false },
      { id: 7, name: '罗兰兰', avatar: 'https://api.dicebear.com/7.x/miniavs/svg?seed=7', value: 140, followed: false },
      { id: 8, name: '张桃', avatar: 'https://api.dicebear.com/7.x/miniavs/svg?seed=8', value: 139, followed: false },
    ],
  },
  {
    key: 'popular',
    label: '人气榜',
    data: [
      { id: 1, name: '人气王', avatar: 'https://api.dicebear.com/7.x/miniavs/svg?seed=9', value: 999, followed: false },
      { id: 2, name: '小红', avatar: 'https://api.dicebear.com/7.x/miniavs/svg?seed=10', value: 888, followed: false },
      { id: 3, name: '小蓝', avatar: 'https://api.dicebear.com/7.x/miniavs/svg?seed=11', value: 777, followed: false },
    ],
  },
  {
    key: 'new',
    label: '新人榜',
    data: [
      { id: 1, name: '新手1号', avatar: 'https://api.dicebear.com/7.x/miniavs/svg?seed=12', value: 10, followed: false },
      { id: 2, name: '新手2号', avatar: 'https://api.dicebear.com/7.x/miniavs/svg?seed=13', value: 8, followed: false },
      { id: 3, name: '新手3号', avatar: 'https://api.dicebear.com/7.x/miniavs/svg?seed=14', value: 7, followed: false },
    ],
  },
];

const gradientBg = 'linear-gradient(135deg, #ffe0e9 0%, #fff6e0 100%)';

const RankingBoard: React.FC = () => {
  const [activeTab, setActiveTab] = useState('creator');
  const [followed, setFollowed] = useState<{ [key: string]: boolean }>({});

  const handleFollow = (id: number) => {
    setFollowed(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const currentTab = rankingTabs.find(tab => tab.key === activeTab) || rankingTabs[0];
  const data = currentTab.data;

  const myInfo = {
    id: 999,
    name: '本人昵称',
    avatar: 'https://api.dicebear.com/7.x/miniavs/svg?seed=me',
    value: 120,
    rank: null as number | null, // null表示未上榜
  };
  // 查找本人在当前榜单的排名
  const myRankIdx = data.findIndex(item => item.id === myInfo.id);
  if (myRankIdx !== -1) {
    myInfo.rank = myRankIdx + 1;
    myInfo.value = data[myRankIdx].value;
  }

  return (
    <div style={{
      background: gradientBg,
      borderRadius: 18,
      boxShadow: '0 4px 16px rgba(255,107,53,0.08)',
      padding: '20px',
      width: '100%',
      height: '100%',
      position: 'relative',
      fontSize: 13, // 全局缩小字号
      display: 'flex',
      flexDirection: 'column',
      overflow: 'hidden',
    }}>
      {/* 标题和装饰 */}
      <div style={{ display: 'flex', alignItems: 'center', marginBottom: 8, fontSize: 16 }}>
        <span style={{ fontSize: 16, fontWeight: 700, color: '#d97b2b', marginRight: 8, whiteSpace: 'nowrap' }}>管家排行榜</span>
        <span style={{ fontSize: 20, marginLeft: 2 }}>👑</span>
        <span style={{ marginLeft: 'auto', fontSize: 11, color: '#999', whiteSpace: 'nowrap' }}>更新日期：2024-06-24</span>
      </div>
      {/* Tabs */}
      <Tabs
        activeKey={activeTab}
        onChange={setActiveTab}
        items={rankingTabs.map(tab => ({ key: tab.key, label: tab.label }))}
        style={{ marginBottom: 0 }}
        tabBarStyle={{ fontWeight: 600, fontSize: 13 }}
      />
      {/* 榜单内容 */}
      <div style={{ flex: 1, overflowY: 'auto', paddingTop: 20, minHeight: 0 }}>
        {/* 中间TOP1，左TOP2，右TOP3 */}
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
          {/* TOP2 左边 */}
          {data[1] && (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flex: 1, margin: '0 6px 0 0', position: 'relative' }}>
              <div style={{
                width: 50,
                height: 50,
                borderRadius: '50%',
                border: '2px solid #c0c0c0',
                background: '#fff',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                marginBottom: 2,
              }}>
                <Avatar src={data[1].avatar} size={40} />
                <span style={{
                  position: 'absolute',
                  top: -14,
                  left: '50%',
                  transform: 'translateX(-50%)',
                  fontSize: 11,
                  fontWeight: 700,
                  color: '#fff',
                  background: '#c0c0c0',
                  borderRadius: 8,
                  padding: '1px 7px',
                  boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
                  zIndex: 2,
                }}>TOP.2</span>
              </div>
              <span style={{ fontWeight: 600, fontSize: 13, marginBottom: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{data[1].name}</span>
              <span style={{ fontSize: 11, color: '#d97b2b', fontWeight: 500, whiteSpace: 'nowrap' }}>成交{data[1].value}套</span>
            </div>
          )}
          {/* TOP1 中间 */}
          {data[0] && (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flex: 1, margin: 0, position: 'relative' }}>
              <div style={{
                width: 60,
                height: 60,
                borderRadius: '50%',
                border: '2px solid #ffd700',
                background: '#fff',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                boxShadow: '0 2px 8px #ffd70033',
                marginBottom: 2,
              }}>
                <Avatar src={data[0].avatar} size={48} />
                <span style={{
                  position: 'absolute',
                  top: -14,
                  left: '50%',
                  transform: 'translateX(-50%)',
                  fontSize: 11,
                  fontWeight: 700,
                  color: '#fff',
                  background: '#ffd700',
                  borderRadius: 8,
                  padding: '1px 7px',
                  boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
                  zIndex: 2,
                }}>TOP.1</span>
              </div>
              <span style={{ fontWeight: 600, fontSize: 13, marginBottom: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{data[0].name}</span>
              <span style={{ fontSize: 11, color: '#d97b2b', fontWeight: 500, whiteSpace: 'nowrap' }}>成交{data[0].value}套</span>
            </div>
          )}
          {/* TOP3 右边 */}
          {data[2] && (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flex: 1, margin: '0 0 0 6px', position: 'relative' }}>
              <div style={{
                width: 50,
                height: 50,
                borderRadius: '50%',
                border: '2px solid #cd7f32',
                background: '#fff',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                marginBottom: 2,
              }}>
                <Avatar src={data[2].avatar} size={40} />
                <span style={{
                  position: 'absolute',
                  top: -14,
                  left: '50%',
                  transform: 'translateX(-50%)',
                  fontSize: 11,
                  fontWeight: 700,
                  color: '#fff',
                  background: '#cd7f32',
                  borderRadius: 8,
                  padding: '1px 7px',
                  boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
                  zIndex: 2,
                }}>TOP.3</span>
              </div>
              <span style={{ fontWeight: 600, fontSize: 13, marginBottom: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{data[2].name}</span>
              <span style={{ fontSize: 11, color: '#d97b2b', fontWeight: 500, whiteSpace: 'nowrap' }}>成交{data[2].value}套</span>
            </div>
          )}
        </div>
        {/* 其余名次普通渲染 */}
        <div>
          {data.slice(3).map((item, idx) => (
            <div key={item.id} style={{
              display: 'flex', alignItems: 'center', padding: '6px 0', borderBottom: '1px solid #f7e6d6', fontSize: 13,
            }}>
              <span style={{ width: 20, textAlign: 'center', fontWeight: 700, color: '#d97b2b', fontSize: 13 }}>{idx + 4}</span>
              <Avatar src={item.avatar} size={28} style={{ margin: '0 8px' }} />
              <span style={{ flex: 1, fontWeight: 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{item.name}</span>
              <span style={{ color: '#d97b2b', fontSize: 11, marginRight: 6, whiteSpace: 'nowrap' }}>成交{item.value}套</span>
              <Button
                size="small"
                type={followed[item.id] ? 'default' : 'primary'}
                style={{ borderRadius: 16, minWidth: 44, fontSize: 12, height: 22 }}
                onClick={() => handleFollow(item.id)}
              >{followed[item.id] ? '已关注' : '关注'}</Button>
            </div>
          ))}
        </div>
      </div>
      {/* 本人排位展示区 */}
      <div style={{
        marginTop: 10,
        background: '#fff9f2',
        borderRadius: 10,
        padding: '7px 10px',
        display: 'flex',
        alignItems: 'center',
        minHeight: 36,
        boxShadow: '0 2px 8px rgba(255,107,53,0.04)',
        fontSize: 13,
      }}>
        <Avatar src={myInfo.avatar} size={22} style={{ marginRight: 8 }} />
        <span style={{ fontWeight: 500, fontSize: 13, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{myInfo.name}</span>
        {myInfo.rank ? (
          <>
            <span style={{ marginLeft: 10, color: '#d97b2b', fontWeight: 600 }}>第{myInfo.rank}名</span>
            <span style={{ marginLeft: 8, color: '#d97b2b', fontSize: 11 }}>成交{myInfo.value}套</span>
          </>
        ) : (
          <span style={{ marginLeft: 10, color: '#bbb', fontWeight: 500 }}>未上榜</span>
        )}
      </div>
    </div>
  );
};

export default RankingBoard; 