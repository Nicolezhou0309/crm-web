import React, { useCallback, useMemo } from 'react';
import { Avatar } from 'antd';
import { UserOutlined } from '@ant-design/icons';
import { ImageRetryComponent, type ImageRetryOptions } from '../hooks/useImageRetry';

export interface AvatarWithRetryProps {
  src: string | null;
  size?: number;
  shape?: 'circle' | 'square';
  style?: React.CSSProperties;
  className?: string;
  alt?: string;
  retryOptions?: ImageRetryOptions;
  showDefaultAvatar?: boolean;
  onLoad?: () => void;
  onError?: () => void;
}

const AvatarWithRetry: React.FC<AvatarWithRetryProps> = ({
  src,
  size = 80,
  shape = 'circle',
  style,
  className,
  alt = '用户头像',
  retryOptions = {},
  showDefaultAvatar = true,
  onLoad,
  onError
}) => {
  // 使用 useCallback 稳定化回调函数
  const handleLoadSuccess = useCallback((loadedSrc: string) => {
    console.log('✅ 头像加载成功:', {
      src: loadedSrc,
      size,
      shape,
      timestamp: new Date().toISOString(),
      component: 'AvatarWithRetry'
    });
    retryOptions.onLoadSuccess?.(loadedSrc);
  }, [retryOptions.onLoadSuccess, size, shape]);

  const handleLoadError = useCallback((error: any) => {
    console.error('❌ 头像加载失败:', {
      error: error.message || error,
      src,
      size,
      shape,
      timestamp: new Date().toISOString(),
      component: 'AvatarWithRetry'
    });
    retryOptions.onLoadError?.(error);
  }, [retryOptions.onLoadError, src, size, shape]);

  const handleLoad = useCallback(() => {
    console.log('🖼️ 头像图片加载完成:', {
      src,
      size,
      shape,
      timestamp: new Date().toISOString(),
      component: 'AvatarWithRetry'
    });
    onLoad?.();
  }, [onLoad, src, size, shape]);

  const handleError = useCallback(() => {
    console.log('⚠️ 头像图片加载失败:', {
      src,
      size,
      shape,
      timestamp: new Date().toISOString(),
      component: 'AvatarWithRetry'
    });
    onError?.();
  }, [onError, src, size, shape]);

  // 使用 useMemo 稳定化重试配置
  const defaultRetryOptions: ImageRetryOptions = useMemo(() => ({
    maxRetries: 3,
    delay: 1000,
    backoff: 'exponential',
    showRetryButton: true,
    retryButtonText: '重试',
    onLoadSuccess: handleLoadSuccess,
    onLoadError: handleLoadError,
    ...retryOptions
  }), [retryOptions, handleLoadSuccess, handleLoadError]);

  // 如果没有头像URL且不显示默认头像，返回null
  if (!src && !showDefaultAvatar) {
    return null;
  }

  // 如果没有头像URL，显示默认头像
  if (!src) {
    return (
      <Avatar
        size={size}
        shape={shape}
        style={style}
        className={className}
        icon={<UserOutlined />}
      />
    );
  }

  return (
    <ImageRetryComponent
      src={src}
      alt={alt}
      width={size}
      height={size}
      options={defaultRetryOptions}
      onLoad={handleLoad}
      onError={handleError}
      style={{
        borderRadius: shape === 'circle' ? '50%' : '4px',
        ...style
      }}
      className={className}
    >
      {({ src: currentSrc, isLoading, hasError, retryCount, isRetrying, retry, canRetry }: {
        src: string | null;
        isLoading: boolean;
        hasError: boolean;
        retryCount: number;
        isRetrying: boolean;
        retry: () => void;
        canRetry: boolean;
      }) => (
        <div style={{ position: 'relative', width: size, height: size }}>
          {/* 加载状态 */}
          {isLoading && (
            <div
              style={{
                width: size,
                height: size,
                borderRadius: shape === 'circle' ? '50%' : '4px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: '#f0f0f0',
                border: '2px solid #e0e0e0',
                ...style
              }}
            >
              <div style={{ textAlign: 'center' }}>
                <div
                  style={{
                    width: '20px',
                    height: '20px',
                    border: '2px solid #1890ff',
                    borderTop: '2px solid transparent',
                    borderRadius: '50%',
                    animation: 'spin 1s linear infinite',
                    margin: '0 auto 8px'
                  }}
                />
                <div style={{ fontSize: '12px', color: '#666' }}>
                  {isRetrying ? `重试中 (${retryCount})` : '加载中...'}
                </div>
              </div>
            </div>
          )}

          {/* 错误状态 */}
          {hasError && (
            <div
              style={{
                width: size,
                height: size,
                borderRadius: shape === 'circle' ? '50%' : '4px',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: '#fff2f0',
                border: '2px dashed #ff4d4f',
                ...style
              }}
            >
              <UserOutlined style={{ fontSize: size * 0.4, color: '#ff4d4f', marginBottom: '4px' }} />
              <div style={{ fontSize: '10px', color: '#ff4d4f', textAlign: 'center' }}>
                加载失败
              </div>
              {canRetry && (
                <button
                  onClick={retry}
                  style={{
                    marginTop: '4px',
                    padding: '2px 8px',
                    backgroundColor: '#1890ff',
                    color: 'white',
                    border: 'none',
                    borderRadius: '2px',
                    cursor: 'pointer',
                    fontSize: '10px'
                  }}
                >
                  重试
                </button>
              )}
            </div>
          )}

          {/* 成功加载的图片 */}
          {currentSrc && !isLoading && !hasError && (
            <img
              src={currentSrc}
              alt={alt}
              style={{
                width: size,
                height: size,
                borderRadius: shape === 'circle' ? '50%' : '4px',
                objectFit: 'cover',
                ...style
              }}
            />
          )}
        </div>
      )}
    </ImageRetryComponent>
  );
};

export default AvatarWithRetry;
