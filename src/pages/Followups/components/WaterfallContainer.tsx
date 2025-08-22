import React, { useRef, useEffect, useState, useCallback } from 'react';
import { WaterfallCard } from './WaterfallCard';
import './WaterfallContainer.css';

interface WaterfallContainerProps {
  data: any[];
  onCardEdit: (record: any) => void;
  loading?: boolean;
  columnCount?: number;
  gap?: number;
  className?: string;
}

/**
 * 响应式网格布局容器组件
 * 实现简单的双列布局
 */
export const WaterfallContainer: React.FC<WaterfallContainerProps> = ({
  data = [],
  onCardEdit,
  loading = false,
  columnCount = 2,
  gap = 16,
  className = ''
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [containerWidth, setContainerWidth] = useState(0);

  // 处理容器尺寸变化
  const updateContainerWidth = useCallback(() => {
    if (containerRef.current) {
      const width = containerRef.current.offsetWidth;
      setContainerWidth(width);
    }
  }, []);

  // 计算列宽度
  const columnWidth = containerWidth > 0 
    ? Math.floor((containerWidth - gap * (columnCount - 1)) / columnCount)
    : 0;



  // 监听窗口大小变化
  useEffect(() => {
    updateContainerWidth();
    
    const handleResize = () => {
      updateContainerWidth();
    };
    
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [updateContainerWidth]);



  // 渲染加载骨架屏
  const renderSkeletonItems = () => {
    return Array.from({ length: 6 }, (_, index) => (
      <div
        key={`skeleton-${index}`}
        className="skeleton-card"
        style={{
          width: columnWidth > 0 ? columnWidth : '100%',
          height: 200 + Math.random() * 100 // 随机高度
        }}
      >
        <div className="skeleton-cover" />
        <div className="skeleton-content">
          <div className="skeleton-line" style={{ width: '80%' }} />
          <div className="skeleton-line" style={{ width: '60%' }} />
          <div className="skeleton-line" style={{ width: '90%' }} />
        </div>
      </div>
    ));
  };

  // 渲染空状态
  const renderEmptyState = () => (
    <div className="waterfall-empty-state">
      <div className="empty-icon">📱</div>
      <div className="empty-title">暂无数据</div>
      <div className="empty-description">当前没有可显示的跟进记录</div>
    </div>
  );

  return (
    <div
      ref={containerRef}
      className={`waterfall-container ${className} ${loading ? 'loading' : ''}`}
      style={{ 
        display: 'grid',
        gridTemplateColumns: `repeat(${columnCount}, 1fr)`,
        gap: `${gap}px`,
        padding: `${gap}px`
      }}
    >
      {/* 调试信息（开发环境） */}
      {process.env.NODE_ENV === 'development' && (
        <div className="debug-info" style={{ gridColumn: '1 / -1' }}>
          <details>
            <summary>网格布局调试信息</summary>
            <pre>
              {JSON.stringify({
                columnCount,
                gap,
                containerWidth,
                columnWidth,
                itemsCount: data.length
              }, null, 2)}
            </pre>
          </details>
        </div>
      )}

      {/* 加载状态 */}
      {loading && renderSkeletonItems()}

      {/* 正常数据渲染 */}
      {!loading && data.length > 0 && data.map((item) => (
        <WaterfallCard
          key={item.id}
          record={item}
          onEdit={onCardEdit}
          style={{ width: '100%' }}
        />
      ))}

      {/* 空状态 */}
      {!loading && data.length === 0 && (
        <div style={{ gridColumn: '1 / -1' }}>
          {renderEmptyState()}
        </div>
      )}

      {/* 网格背景线（仅开发环境显示） */}
      {process.env.NODE_ENV === 'development' && containerWidth > 0 && (
        <div className="waterfall-grid-lines" style={{ gridColumn: '1 / -1' }}>
          {Array.from({ length: columnCount }, (_, index) => {
            const left = index * (columnWidth + gap);
            
            return (
              <div
                key={`grid-${index}`}
                className="grid-line"
                style={{
                  left,
                  width: columnWidth,
                  height: '100%'
                }}
              />
            );
          })}
        </div>
      )}
    </div>
  );
};

export default WaterfallContainer;
