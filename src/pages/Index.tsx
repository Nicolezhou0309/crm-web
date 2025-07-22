import React, { useState, useRef, useEffect } from 'react';
import { Row, Col, Modal, Spin, Card } from 'antd';
import AllocationStatusCard from '../components/AllocationStatusCard';
import { fetchBanners } from '../api/bannersApi';
import RankingBoard from '../components/RankingBoard';
import TodoCenter from '../components/TodoCenter';
import PerformanceDashboard from '../components/PerformanceDashboard';

const Index: React.FC = () => {
  const [carouselIndex, setCarouselIndex] = useState(0);
  const [banners, setBanners] = useState<any[]>([]);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  // iframeBanner为string|null，存iframe url
  const [iframeBanner, setIframeBanner] = useState<string | null>(null);
  // 全局开屏loading
  const [pageLoading, setPageLoading] = useState(true);
  const [enlargeModalOpen, setEnlargeModalOpen] = useState(false);

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

  // 生成30天的模拟数据
  const generate30DaysTrendData = () => {
    const arr = [];
    for (let i = 29; i >= 0; i--) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      const dateStr = date.toISOString().split('T')[0];
      arr.push({
        date: dateStr,
        leads: Math.floor(Math.random() * 10 + 10), // 10~19
        deals: Math.floor(Math.random() * 5 + 1),   // 1~5
      });
    }
    return arr;
  };
  const trendData30 = generate30DaysTrendData();


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
          <Spin size='large' />
          <div style={{ marginTop: 16, fontSize: 16, color: '#666' }}></div>
        </div>
      )}
      <div style={{ background: '#f5f6fa', width: '100%', minHeight: '100%' }}>
        {/* 三栏布局：左栏（banner+业绩进度）、中栏（销售组+待办事项）、右栏（排行榜） */}
        <Row gutter={24} style={{ height: '80vh', padding: '16px' }}>
          {/* 左栏：banner + 业绩进度 */}
          <Col span={12} style={{ height: '80vh', display: 'flex', flexDirection: 'column' }}>
            {/* banner */}
            <div style={{
              width: '100%',
              aspectRatio: '3.84/1',
              position: 'relative',
              background: '#364d79',
              borderRadius: 10,
              overflow: 'hidden',
              boxShadow: '0 4px 16px rgba(52,107,255,0.08)',
              marginBottom: 16,
              flex: 'none', // 高度固定不伸缩
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
                styles={{ body: { padding: 16, height: 600 } }}
                destroyOnHidden
                centered
              >
                {iframeBanner && (
                  <iframe
                    src={iframeBanner}
                    style={{ width: '100%', height: 600, border: 'none', borderRadius: 16 }}
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
                  gap: 16,
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
            {/* 业绩进度 */}
            <div style={{ flex: 1, minHeight: 0 }}>
              <PerformanceDashboard 
                trendData={trendData30}
                leads30Days={320}
                deals30Days={27}
                leadsChange={12.5}
                dealsChange={-5.2}
                currentDeals={27}
                targetDeals={50}
                onEnlarge={() => setEnlargeModalOpen(true)}
              />
            </div>
            <Modal
              open={enlargeModalOpen}
              onCancel={() => setEnlargeModalOpen(false)}
              width={1080}
              footer={null}
              centered
            >
              <PerformanceDashboard
                trendData={trendData30.slice(-14)}
                leads30Days={320}
                deals30Days={27}
                leadsChange={12.5}
                dealsChange={-5.2}
                currentDeals={27}
                targetDeals={50}
                showSlider={true}
                height={600}
                defaultRange={[7, 13]}
              />
            </Modal>
          </Col>

          {/* 中栏：销售组 + 待办事项 */}
          <Col span={6} style={{ height: '80vh', display: 'flex', flexDirection: 'column' }}>
            {/* 销售组 */}
            <div style={{ 
              width: '100%', 
              marginBottom: 16,
              flex: 'none',
              display: 'flex', 
              alignItems: 'stretch' 
            }}>
              <Card
                style={{
                  borderRadius: 18,
                  width: '100%',
                  aspectRatio: '3.84/2.08',
                  boxShadow: '0 4px 16px rgba(52,107,255,0.08)', // shadow统一
                  background: '#fff',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'flex-start',
                  padding: 0,
                }}
                styles={{ 
                  body: { padding: 16, flex: 1, overflowY: 'auto', minHeight: 0 },
                  header: { display: 'none' }
                }}
                variant="borderless"
              >
                <AllocationStatusCard />
              </Card>
            </div>
            {/* 待办事项 */}
            <div style={{ flex: 1, minHeight: 0 }}>
              <TodoCenter />
            </div>
          </Col>

          {/* 右栏：排行榜 */}
          <Col span={6} style={{ height: '80vh' }}>
            <RankingBoard />
          </Col>
        </Row>
      </div>
    </>
  );
};

export default Index; 