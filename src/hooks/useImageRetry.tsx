import React, { useState, useEffect, useCallback, useRef } from 'react';
import { withRetry, type RetryOptions } from '../utils/retryUtils';

export interface ImageRetryOptions extends RetryOptions {
  // 图片特定的重试选项
  fallbackSrc?: string; // 备用图片URL
  showRetryButton?: boolean; // 是否显示重试按钮
  retryButtonText?: string; // 重试按钮文本
  onRetryClick?: () => void; // 手动重试回调
  onLoadSuccess?: (src: string) => void; // 加载成功回调
  onLoadError?: (error: any) => void; // 加载失败回调
}

export interface ImageRetryState {
  src: string | null;
  isLoading: boolean;
  hasError: boolean;
  retryCount: number;
  isRetrying: boolean;
}

// 图片加载重试Hook
export const useImageRetry = (
  initialSrc: string | null,
  options: ImageRetryOptions = {}
) => {
  const {
    maxRetries = 3,
    delay = 1000,
    backoff = 'exponential',
    fallbackSrc,
    showRetryButton = true,
    retryButtonText = '重试',
    onRetryClick,
    onLoadSuccess,
    onLoadError,
    shouldRetry = defaultImageRetryCondition
  } = options;

  const [state, setState] = useState<ImageRetryState>({
    src: initialSrc,
    isLoading: !!initialSrc,
    hasError: false,
    retryCount: 0,
    isRetrying: false
  });

  const retryTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const imageRef = useRef<HTMLImageElement | null>(null);
  const startLoadingRef = useRef<((src: string) => Promise<void>) | undefined>(undefined);
  const resetRef = useRef<(() => void) | undefined>(undefined);

  // 默认的图片重试条件
  function defaultImageRetryCondition(error: any): boolean {
    // 图片加载失败的错误类型
    const imageErrorPatterns = [
      'Failed to load',
      'Load failed',
      'Network error',
      'Timeout',
      'Connection refused',
      'net::ERR_',
      '404',
      '403',
      '500',
      '502',
      '503',
      '504',
      '图片加载失败',  // 添加中文错误信息
      '图片加载超时'   // 添加中文超时信息
    ];

    const errorMessage = error?.message || error?.toString?.() || '';
    const shouldRetry = imageErrorPatterns.some(pattern => 
      errorMessage.includes(pattern)
    );

    console.log('🔍 检查重试条件:', {
      errorMessage,
      shouldRetry,
      patterns: imageErrorPatterns,
      hook: 'useImageRetry'
    });

    return shouldRetry;
  }

  // 图片加载函数
  const loadImage = useCallback(async (src: string): Promise<string> => {
    return new Promise((resolve, reject) => {
      const img = new Image();
      
      // 设置超时
      const timeout = setTimeout(() => {
        reject(new Error(`图片加载超时: ${src}`));
      }, 10000); // 10秒超时
      
      img.onload = () => {
        clearTimeout(timeout);
        resolve(src);
      };
      
      img.onerror = (error) => {
        clearTimeout(timeout);
        reject(new Error(`图片加载失败: ${src}`));
      };
      
      img.src = src;
    });
  }, []);

  // 带重试的图片加载
  const loadImageWithRetry = useCallback(async (src: string) => {
    try {
      const result = await withRetry(
        () => loadImage(src),
        {
          maxRetries,
          delay,
          backoff,
          shouldRetry: defaultImageRetryCondition, // 使用默认重试条件
          onRetry: (attempt, error) => {
            console.warn(`🔄 图片加载失败，第${attempt}次重试:`, {
              src,
              error: error.message,
              attempt,
              maxRetries,
              timestamp: new Date().toISOString(),
              hook: 'useImageRetry'
            });
            
            setState(prev => ({
              ...prev,
              retryCount: attempt,
              isRetrying: true
            }));
          }
        }
      );
      
      return result;
    } catch (error) {
      console.error('❌ 图片加载最终失败:', {
        src,
        error: error instanceof Error ? error.message : error,
        retryCount: state.retryCount,
        timestamp: new Date().toISOString(),
        hook: 'useImageRetry'
      });
      throw error;
    }
  }, [loadImage, maxRetries, delay, backoff, state.retryCount]);

  // 开始加载图片
  const startLoading = useCallback(async (src: string) => {
    if (!src) {
      console.log('🚫 图片源为空，跳过加载');
      return;
    }

    console.log('🚀 开始加载图片:', {
      src,
      timestamp: new Date().toISOString(),
      hook: 'useImageRetry'
    });

    setState(prev => ({
      ...prev,
      src,
      isLoading: true,
      hasError: false,
      retryCount: 0,
      isRetrying: false
    }));

    try {
      const loadedSrc = await loadImageWithRetry(src);
      
      console.log('✅ 图片加载成功:', {
        originalSrc: src,
        loadedSrc,
        timestamp: new Date().toISOString(),
        hook: 'useImageRetry'
      });
      
      setState(prev => ({
        ...prev,
        src: loadedSrc,
        isLoading: false,
        hasError: false,
        isRetrying: false
      }));
      
      onLoadSuccess?.(loadedSrc);
    } catch (error) {
      console.error('❌ 图片加载最终失败:', {
        src,
        error: error instanceof Error ? error.message : error,
        retryCount: state.retryCount,
        timestamp: new Date().toISOString(),
        hook: 'useImageRetry'
      });
      
      setState(prev => ({
        ...prev,
        isLoading: false,
        hasError: true,
        isRetrying: false
      }));
      
      onLoadError?.(error);
    }
  }, [loadImageWithRetry, onLoadSuccess, onLoadError, state.retryCount]);

  // 手动重试
  const retry = useCallback(() => {
    if (state.src && state.hasError) {
      console.log('🔄 手动重试图片:', {
        src: state.src,
        previousRetryCount: state.retryCount,
        timestamp: new Date().toISOString(),
        hook: 'useImageRetry'
      });
      onRetryClick?.();
      startLoading(state.src);
    } else {
      console.log('⚠️ 无法重试图片:', {
        src: state.src,
        hasError: state.hasError,
        reason: !state.src ? 'src为空' : !state.hasError ? '没有错误' : '未知原因',
        timestamp: new Date().toISOString(),
        hook: 'useImageRetry'
      });
    }
  }, [state.src, state.hasError, state.retryCount, onRetryClick, startLoading]);

  // 重置状态
  const reset = useCallback(() => {
    console.log('🔄 重置图片状态:', {
      previousSrc: state.src,
      timestamp: new Date().toISOString(),
      hook: 'useImageRetry'
    });
    setState({
      src: null,
      isLoading: false,
      hasError: false,
      retryCount: 0,
      isRetrying: false
    });
  }, [state.src]);

  // 更新 ref
  startLoadingRef.current = startLoading;
  resetRef.current = reset;

  // 设置新的图片源
  const setSrc = useCallback((newSrc: string | null) => {
    if (newSrc !== state.src) {
      console.log('🔄 设置新的图片源:', {
        previousSrc: state.src,
        newSrc,
        action: newSrc ? '开始加载' : '重置状态',
        timestamp: new Date().toISOString(),
        hook: 'useImageRetry'
      });
      
      if (newSrc) {
        startLoadingRef.current?.(newSrc);
      } else {
        resetRef.current?.();
      }
    } else {
      console.log('ℹ️ 图片源未变化，跳过设置:', {
        src: newSrc,
        timestamp: new Date().toISOString(),
        hook: 'useImageRetry'
      });
    }
  }, [state.src]); // 移除函数依赖，避免循环

  // 初始加载
  useEffect(() => {
    if (initialSrc) {
      console.log('🎯 初始加载图片:', {
        initialSrc,
        timestamp: new Date().toISOString(),
        hook: 'useImageRetry'
      });
      startLoadingRef.current?.(initialSrc);
    } else {
      console.log('ℹ️ 初始图片源为空，跳过加载:', {
        timestamp: new Date().toISOString(),
        hook: 'useImageRetry'
      });
    }
  }, [initialSrc]); // 移除 startLoading 依赖，避免循环

  // 清理定时器
  useEffect(() => {
    return () => {
      if (retryTimeoutRef.current) {
        clearTimeout(retryTimeoutRef.current);
      }
    };
  }, []);

  return {
    ...state,
    retry,
    reset,
    setSrc,
    // 计算属性
    canRetry: state.hasError && state.retryCount < maxRetries,
    showFallback: state.hasError && !!fallbackSrc,
    fallbackSrc
  };
};

// 图片重试组件
export interface ImageRetryComponentProps {
  src: string | null;
  alt: string;
  className?: string;
  style?: React.CSSProperties;
  width?: number | string;
  height?: number | string;
  options?: ImageRetryOptions;
  onLoad?: () => void;
  onError?: () => void;
  children?: (state: ImageRetryState & { retry: () => void; reset: () => void }) => React.ReactNode;
}

export const ImageRetryComponent: React.FC<ImageRetryComponentProps> = ({
  src,
  alt,
  className,
  style,
  width,
  height,
  options = {},
  onLoad,
  onError,
  children
}) => {
  const {
    src: currentSrc,
    isLoading,
    hasError,
    retryCount,
    isRetrying,
    retry,
    reset,
    canRetry,
    showFallback,
    fallbackSrc
  } = useImageRetry(src, {
    ...options,
    onLoadSuccess: (loadedSrc) => {
      options.onLoadSuccess?.(loadedSrc);
      onLoad?.();
    },
    onLoadError: (error) => {
      options.onLoadError?.(error);
      onError?.();
    }
  });

  // 如果提供了自定义渲染函数
  if (children) {
    return (
      <>
        {children({
          src: currentSrc,
          isLoading,
          hasError,
          retryCount,
          isRetrying,
          retry,
          reset
        })}
      </>
    );
  }

  // 默认渲染
  return (
    <div className={className} style={style}>
      {isLoading && (
        <div
          style={{
            width: width || '100%',
            height: height || '100%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: '#f0f0f0',
            borderRadius: '4px'
          }}
        >
          <div style={{ textAlign: 'center' }}>
            <div style={{ marginBottom: '8px' }}>
              {isRetrying ? '重试中...' : '加载中...'}
            </div>
            {isRetrying && retryCount > 0 && (
              <div style={{ fontSize: '12px', color: '#666' }}>
                第 {retryCount} 次重试
              </div>
            )}
          </div>
        </div>
      )}

      {hasError && !showFallback && (
        <div
          style={{
            width: width || '100%',
            height: height || '100%',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: '#fff2f0',
            border: '1px dashed #ff4d4f',
            borderRadius: '4px',
            padding: '16px'
          }}
        >
          <div style={{ marginBottom: '8px', color: '#ff4d4f' }}>
            图片加载失败
          </div>
          {canRetry && options.showRetryButton !== false && (
            <button
              onClick={retry}
              style={{
                padding: '4px 12px',
                backgroundColor: '#1890ff',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer',
                fontSize: '12px'
              }}
            >
              {options.retryButtonText || '重试'}
            </button>
          )}
        </div>
      )}

      {currentSrc && !isLoading && !hasError && (
        <img
          src={currentSrc}
          alt={alt}
          width={width}
          height={height}
          style={{
            width: width || '100%',
            height: height || '100%',
            objectFit: 'cover',
            ...style
          }}
        />
      )}

      {showFallback && fallbackSrc && (
        <img
          src={fallbackSrc}
          alt={`${alt} (备用)`}
          width={width}
          height={height}
          style={{
            width: width || '100%',
            height: height || '100%',
            objectFit: 'cover',
            opacity: 0.7,
            ...style
          }}
        />
      )}
    </div>
  );
};

export default useImageRetry;
