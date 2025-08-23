import { useState, useCallback, useRef, useEffect } from 'react';

interface UseInfiniteScrollProps {
  onLoadMore: () => Promise<void>;
  hasMore: boolean;
  loading: boolean;
  rootMargin?: string; // Intersection Observer 的 rootMargin
}

/**
 * 无限滚动加载 Hook
 * 实现自动检测滚动位置并加载下一页数据
 */
export const useInfiniteScroll = ({
  onLoadMore,
  hasMore,
  loading,
  rootMargin = '0px'
}: UseInfiniteScrollProps) => {
  const [isIntersecting, setIsIntersecting] = useState(false);
  const observerRef = useRef<IntersectionObserver | null>(null);
  const sentinelRef = useRef<HTMLDivElement>(null);

  // 创建 Intersection Observer
  const createObserver = useCallback(() => {
    if (typeof IntersectionObserver === 'undefined') {
      return null;
    }

    return new IntersectionObserver(
      (entries) => {
        const [entry] = entries;
        setIsIntersecting(entry.isIntersecting);
        
        // 当哨兵元素进入视口且有更多数据且不在加载中时，触发加载
        if (entry.isIntersecting && hasMore && !loading) {
          onLoadMore();
        }
      },
      {
        root: null, // 使用视口作为根
        rootMargin,
        threshold: 0.1
      }
    );
  }, [onLoadMore, rootMargin]); // 移除hasMore和loading依赖

  // 设置观察者
  useEffect(() => {
    if (sentinelRef.current) {
      observerRef.current = createObserver();
      
      if (observerRef.current) {
        observerRef.current.observe(sentinelRef.current);
      }
    }

    return () => {
      if (observerRef.current) {
        observerRef.current.disconnect();
      }
    };
  }, [createObserver]);

  // 手动触发加载更多（用于测试或其他需要）
  const triggerLoadMore = useCallback(() => {
    if (hasMore && !loading) {
      onLoadMore();
    }
  }, [onLoadMore, hasMore, loading]);

  return {
    sentinelRef,
    isIntersecting,
    triggerLoadMore
  };
};
