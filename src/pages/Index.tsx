import React, { useState, useRef, useEffect } from 'react';
import { Row, Col, Statistic, Progress, Tabs, List, Tag, Button, Space, Modal, Spin, Card } from 'antd';
import { Line } from '@ant-design/charts';
import AllocationStatusCard from '../components/AllocationStatusCard';
import { fetchBanners } from '../api/bannersApi';
import RankingBoard from '../components/RankingBoard';
import TodoCenter from '../components/TodoCenter';

const { TabPane } = Tabs;

// 16:9比例容器样式
const carouselWrapperStyle: React.CSSProperties = {
  width: '100%',
  aspectRatio: '3.84/1',
  background: '#364d79',
  borderRadius: 10,
  overflow: 'hidden',
  position: 'relative',
};

const contentStyle: React.CSSProperties = {
  width: '100%',
  height: '100%',
  color: '#fff',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  fontSize: 40,
  fontWeight: 600,
  background: 'transparent',
};

// 模拟数据
const statsData = [
  { title: '今日线索量', value: 18, suffix: '条' },
  { title: '本月线索量', value: 320, suffix: '条' },
  { title: '本月成交量', value: 27, suffix: '单' },
  { title: '我的积分', value: 1280, suffix: '分', extra: '本月排名：第5名', change: '+30' },
];
const trendData = [
  { date: '2024-07-01', leads: 10, deals: 1 },
  { date: '2024-07-02', leads: 12, deals: 2 },
  { date: '2024-07-03', leads: 15, deals: 3 },
  { date: '2024-07-04', leads: 18, deals: 2 },
  { date: '2024-07-05', leads: 20, deals: 4 },
  { date: '2024-07-06', leads: 16, deals: 5 },
  { date: '2024-07-07', leads: 19, deals: 3 },
];
const rankTabs = [
  { key: 'leads', tab: '线索榜', list: [ { name: '张三', value: 56 }, { name: '李四', value: 48 }, { name: '王五', value: 44 } ] },
  { key: 'deals', tab: '成交榜', list: [ { name: '李四', value: 12 }, { name: '张三', value: 10 }, { name: '赵六', value: 8 } ] },
  { key: 'points', tab: '积分榜', list: [ { name: '王五', value: 1280 }, { name: '张三', value: 1200 }, { name: '李四', value: 1100 } ] },
];
const todoList = [
  { title: '跟进客户：王小明', desc: '今日需完成首次电话沟通', tag: '高优先级' },
  { title: '审核成交单', desc: '请审核李四提交的成交单', tag: '待审核' },
  { title: '未读公告', desc: '有2条新公告未读', tag: '提醒' },
];
const targetProgress = 27 / 50 * 100; // 假设目标50单
const helpList = [
  { q: '如何新建线索？', a: '点击首页右上角"新建线索"按钮，填写信息后提交即可。' },
  { q: '积分如何获取？', a: '完成跟进、成交、签到等任务可获得积分。' },
];

const carouselSlides = [1, 2, 3, 4];

const Index: React.FC = () => {
  const [activeRank, setActiveRank] = useState('leads');
  const [carouselIndex, setCarouselIndex] = useState(0);
  const [banners, setBanners] = useState<any[]>([]);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  // iframeBanner为string|null，存iframe url
  const [iframeBanner, setIframeBanner] = useState<string | null>(null);
  // 全局开屏loading
  const [pageLoading, setPageLoading] = useState(true);

  // 拉取 banners 数据
  useEffect(() => {
    setPageLoading(true);
    fetchBanners().then(data => {
      const arr = (data || []).filter((b: any) => b.is_active);
      setBanners(arr.sort((a: any, b: any) => (b.sort_order ?? 0) - (a.sort_order ?? 0)));
      setPageLoading(false);
    }).catch(() => {
      setPageLoading(false);
    });
  }, []);

  // 自动轮播
  useEffect(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    if (banners.length > 0) {
      timerRef.current = setTimeout(() => {
        setCarouselIndex(idx => (idx + 1) % banners.length);
      }, 3000);
    }
    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  }, [carouselIndex, banners.length]);

  const handleDotClick = (idx: number) => {
    setCarouselIndex(idx);
  };

  // 轮播点击跳转
  const handleBannerClick = (banner: any) => {
    if (!banner.jump_type || banner.jump_type === 'none') return;
    if (banner.jump_type === 'url' && banner.jump_target) {
      window.open(banner.jump_target, '_blank');
    } else if (banner.jump_type === 'route' && banner.jump_target) {
      window.location.href = banner.jump_target;
    } else if (banner.jump_type === 'iframe' && banner.jump_target) {
      setIframeBanner(banner.jump_target);
    }
  };

  // 趋势图配置
  const lineConfig = {
    data: [
      ...trendData.map(d => ({ date: d.date, value: d.leads, type: '线索量' })),
      ...trendData.map(d => ({ date: d.date, value: d.deals, type: '成交量' })),
    ],
    xField: 'date',
    yField: 'value',
    seriesField: 'type',
    height: 120,
    smooth: true,
    color: ['#1890ff', '#52c41a'],
    legend: { position: 'top' },
    point: { size: 3, shape: 'circle' },
    padding: [16, 8, 16, 8],
  };

  return (
    <>
      <style>{`
        .ant-carousel {
          display: block ;
          position: relative ;
        }
        .ant-carousel .slick-dots-bottom {
          position: absolute ;
          left: 0;
          right: 0;
          bottom: 16px ;
          top: auto ;
          width: 100%;
          text-align: center;
          margin: 0;
          z-index: 10;
        }
      `}</style>
      {pageLoading && (
        <div style={{
          position: 'fixed', left: 0, top: 0, width: '100vw', height: '100vh',
          background: 'rgba(255,255,255,0.8)', zIndex: 9999,
          display: 'flex', alignItems: 'center', justifyContent: 'center'
        }}>
          <Spin size='large' tip='数据加载中...' />
        </div>
      )}
      <div style={{ padding: 12, background: '#f5f6fa', width: '100%' }}>
        {/* 1拖2结构：左18栏两行（16+8），右6栏排行榜跨两行 */}
        <Row gutter={16} align="stretch" style={{ marginBottom: 16 }}>
          <Col span={18}>
            {/* 上半行：banner+销售组 */}
            <Row gutter={16} style={{ marginBottom: 16 }}>
              <Col span={16}>
                <div style={{
                  width: '100%',
                  aspectRatio: '3.84/1',
                  position: 'relative',
                  background: '#364d79',
                  borderRadius: 10,
                  overflow: 'hidden',
                  boxShadow: '0 4px 16px rgba(52,107,255,0.08)',
                }}>
                  {/* 轮播内容 */}
                  {banners.length > 0 && banners.map((banner, idx) => (
                    <div
                      key={banner.id}
                      style={{
                        position: 'absolute',
                        top: 0, left: 0, width: '100%', height: '100%',
                        opacity: idx === carouselIndex ? 1 : 0,
                        zIndex: idx === carouselIndex ? 2 : 1,
                        transition: 'opacity 0.5s',
                        pointerEvents: idx === carouselIndex ? 'auto' : 'none',
                      }}
                    >
                      <img
                        src={banner.image_url}
                        alt={banner.title}
                        style={{
                          width: '100%', height: '100%',
                          objectFit: 'cover',
                          borderRadius: 10,
                          background: '#222',
                          cursor: banner.jump_type && banner.jump_type !== 'none' ? 'pointer' : 'default',
                          display: 'block',
                        }}
                        onClick={() => handleBannerClick(banner)}
                      />
                    </div>
                  ))}
                  {/* 弹窗iframe */}
                  <Modal
                    open={!!iframeBanner}
                    onCancel={() => setIframeBanner(null)}
                    footer={null}
                    width={1000}
                    bodyStyle={{ padding: 0, height: 600 }}
                    destroyOnClose
                    centered
                  >
                    {iframeBanner && (
                      <iframe
                        src={iframeBanner}
                        style={{ width: '100%', height: 600, border: 'none', borderRadius: 8 }}
                        title='嵌入页面'
                      />
                    )}
                  </Modal>
                  {/* 自定义小圆点指示器 */}
                  <div
                    style={{
                      position: 'absolute',
                      left: 0,
                      right: 0,
                      bottom: 16,
                      width: '100%',
                      textAlign: 'center',
                      zIndex: 10,
                      display: 'flex',
                      justifyContent: 'center',
                      gap: 12,
                    }}
                  >
                    {banners.map((_, idx) => (
                      <span
                        key={idx}
                        onClick={() => handleDotClick(idx)}
                        style={{
                          display: 'inline-block',
                          width: 32,
                          height: 6,
                          borderRadius: 3,
                          background: idx === carouselIndex ? '#fff' : 'rgba(255,255,255,0.3)',
                          cursor: 'pointer',
                          transition: 'background 0.3s',
                        }}
                      />
                    ))}
                  </div>
                </div>
              </Col>
              <Col span={8}>
                <div style={{ width: '100%', aspectRatio: '3.84/2.05', display: 'flex', alignItems: 'stretch' }}>
                  <Card
                    style={{
                      borderRadius: 18,
                      width: '100%',
                      height: '100%',
                      boxShadow: '0 4px 16px rgba(255,107,53,0.08)',
                      background: '#fff',
                      display: 'flex',
                      flexDirection: 'column',
                      justifyContent: 'flex-start',
                      padding: 0,
                    }}
                    bodyStyle={{ padding: 20, flex: 1, overflowY: 'auto', minHeight: 0 }}
                    headStyle={{ display: 'none' }}
                    bordered={false}
                  >
                    <AllocationStatusCard />
                  </Card>
                </div>
              </Col>
            </Row>
            {/* 下半行：业绩进度图+待办事项 */}
            <Row gutter={16}>
              <Col span={16}>
                <div style={{ borderRadius: 10, minHeight: 180, background: '#fff', padding: 12, boxShadow: '0 1px 4px rgba(0,0,0,0.03)' }}>
                  <div style={{ fontSize: 15, fontWeight: 500, marginBottom: 8 }}>线索/成交趋势 & 业绩进度</div>
                  <Line {...lineConfig} />
                  <div style={{ marginTop: 8, display: 'flex', alignItems: 'center' }}>
                    <span style={{ fontSize: 13, marginRight: 8 }}>本月成交：27单</span>
                    <Progress percent={Math.round(targetProgress)} size="small" style={{ flex: 1 }} />
                    <span style={{ fontSize: 12, color: '#888', marginLeft: 8 }}>目标：50单</span>
                  </div>
                </div>
              </Col>
              <Col span={8}>
                <TodoCenter />
              </Col>
            </Row>
          </Col>
          {/* 右侧6栏：排行榜，跨两行 */}
          <Col span={6} style={{ display: 'flex', flexDirection: 'column', minHeight: 520 }}>
            <div style={{ flex: 1, minHeight: 520, height: '100%' }}>
              <RankingBoard />
            </div>
          </Col>
        </Row>
      </div>
    </>
  );
};

export default Index; 