import React, { useState, useEffect } from 'react';
import { fetchBannersByPageType } from '../api/bannersApi';

const LiveStreamBanner: React.FC = () => {
  const [banners, setBanners] = useState<any[]>([]);
  const [bannerIndex, setBannerIndex] = useState(0);

  // 加载banner数据
  useEffect(() => {
    const loadBanners = async () => {
      try {
        const data = await fetchBannersByPageType('live_stream_registration');
        setBanners(data);
      } catch (error) {
        console.error('加载banner失败:', error);
      }
    };
    loadBanners();
  }, []);

  // Banner自动轮播
  useEffect(() => {
    if (banners.length > 1) {
      const timer = setTimeout(() => {
        setBannerIndex((prev) => (prev + 1) % banners.length);
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [bannerIndex, banners.length]);

  // Banner点击处理
  const handleBannerClick = (banner: any) => {
    if (!banner.jump_type || banner.jump_type === 'none') return;
    if (banner.jump_type === 'url' && banner.jump_target) {
      window.open(banner.jump_target, '_blank');
    } else if (banner.jump_type === 'route' && banner.jump_target) {
      // 这里可以添加路由跳转逻辑
    } else if (banner.jump_type === 'iframe' && banner.jump_target) {
      // 这里可以添加iframe弹窗逻辑
    }
  };

  // 渲染Banner组件
  const renderBanner = () => {
    if (banners.length === 0) return null;

    const currentBanner = banners[bannerIndex];
    
    return (
      <div style={{
        width: '100%',
        aspectRatio: '9.6/1', // 1920x200的比例
        position: 'relative',
        background: '#364d79',
        borderRadius: 10,
        overflow: 'hidden',
        boxShadow: '0 4px 16px rgba(52,107,255,0.08)',
        marginBottom: 16,
      }}>
        <img
          src={currentBanner.image_url}
          alt={currentBanner.title}
          style={{
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            borderRadius: 10,
            background: '#222',
            cursor: currentBanner.jump_type && currentBanner.jump_type !== 'none' ? 'pointer' : 'default',
            display: 'block',
          }}
          onClick={() => handleBannerClick(currentBanner)}
        />
        {/* 指示器 */}
        {banners.length > 1 && (
          <div style={{
            position: 'absolute',
            left: 0,
            right: 0,
            bottom: 8, // 调整指示器位置，适应更小的banner高度
            width: '100%',
            textAlign: 'center',
            zIndex: 10,
            display: 'flex',
            justifyContent: 'center',
            gap: 12,
          }}>
            {banners.map((_, idx) => (
              <span
                key={idx}
                onClick={() => setBannerIndex(idx)}
                style={{
                  display: 'inline-block',
                  width: 24, // 调整指示器大小
                  height: 4,
                  borderRadius: 2,
                  background: idx === bannerIndex ? '#fff' : 'rgba(255,255,255,0.3)',
                  cursor: 'pointer',
                  transition: 'background 0.3s',
                }}
              />
            ))}
          </div>
        )}
      </div>
    );
  };

  return renderBanner();
};

export default LiveStreamBanner; 