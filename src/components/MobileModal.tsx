import React, { useEffect, useState, useRef, useCallback } from 'react';
import { Popup } from 'antd-mobile';
import { LeftOutline } from 'antd-mobile-icons';

interface MobileModalProps {
  visible: boolean;
  onClose: () => void;
  title: string | React.ReactNode;
  children: React.ReactNode;
  height?: string;
}

const MobileModal: React.FC<MobileModalProps> = ({
  visible,
  onClose,
  title,
  children,
  height = '80vh'
}) => {
  const modalRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const [touchStartX, setTouchStartX] = useState(0);
  const [touchStartY, setTouchStartY] = useState(0);
  const [touchStartTime, setTouchStartTime] = useState(0);
  const [translateX, setTranslateX] = useState(0);
  const [translateY, setTranslateY] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [isAtTop, setIsAtTop] = useState(false);

  // 阻止背景滚动
  useEffect(() => {
    if (visible) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [visible]);

  // 重置状态
  useEffect(() => {
    if (!visible) {
      setTranslateX(0);
      setTranslateY(0);
      setIsDragging(false);
      setIsAtTop(false);
    }
  }, [visible]);

  // 检查是否在顶部
  const checkIfAtTop = useCallback(() => {
    if (contentRef.current) {
      const scrollTop = contentRef.current.scrollTop;
      setIsAtTop(scrollTop <= 0);
    }
  }, []);

  // 处理触摸开始
  const handleTouchStart = useCallback((e: TouchEvent) => {
    const touch = e.touches[0];
    setTouchStartX(touch.clientX);
    setTouchStartY(touch.clientY);
    setTouchStartTime(Date.now());
    setIsDragging(true);
  }, []);

  // 处理触摸移动
  const handleTouchMove = useCallback((e: TouchEvent) => {
    if (!isDragging) return;
    
    const touch = e.touches[0];
    const deltaX = touch.clientX - touchStartX;
    const deltaY = touch.clientY - touchStartY;
    
    // 检查是否在顶部，如果在顶部则允许下滑关闭
    checkIfAtTop();
    
    if (isAtTop && deltaY > 0) {
      // 在顶部时，允许下滑关闭
      e.preventDefault();
      const maxTranslateY = window.innerHeight * 0.5;
      const newTranslateY = Math.min(deltaY, maxTranslateY);
      setTranslateY(newTranslateY);
    } else if (deltaX > 0) {
      // 不在顶部时，允许右滑关闭
      e.preventDefault();
      const maxTranslateX = window.innerWidth * 0.8;
      const newTranslateX = Math.min(deltaX, maxTranslateX);
      setTranslateX(newTranslateX);
    }
  }, [isDragging, touchStartX, touchStartY, isAtTop, checkIfAtTop]);

  // 处理触摸结束
  const handleTouchEnd = useCallback((_e: TouchEvent) => {
    if (!isDragging) return;
    
    const touchDuration = Date.now() - touchStartTime;
    const deltaX = Math.abs(translateX);
    const deltaY = Math.abs(translateY);
    
    // 判断是右滑关闭还是下滑关闭
    if (isAtTop && deltaY > 0) {
      // 下滑关闭判断
      const shouldClose = deltaY > 100 || (deltaY > 50 && touchDuration < 300);
      
      if (shouldClose) {
        // 快速关闭动画
        setTranslateY(window.innerHeight);
        setTimeout(() => {
          onClose();
          setTranslateY(0);
        }, 200);
      } else {
        // 回弹动画
        setTranslateY(0);
      }
    } else if (deltaX > 0) {
      // 右滑关闭判断
      const shouldClose = deltaX > 100 || (deltaX > 50 && touchDuration < 300);
      
      if (shouldClose) {
        // 快速关闭动画
        setTranslateX(window.innerWidth);
        setTimeout(() => {
          onClose();
          setTranslateX(0);
        }, 200);
      } else {
        // 回弹动画
        setTranslateX(0);
      }
    }
    
    setIsDragging(false);
  }, [isDragging, touchStartTime, translateX, translateY, isAtTop, onClose]);

  // 手动绑定触摸事件
  useEffect(() => {
    const modalElement = modalRef.current;
    if (!modalElement || !visible) return;

    // 使用非被动的触摸事件监听器
    modalElement.addEventListener('touchstart', handleTouchStart, { passive: false });
    modalElement.addEventListener('touchmove', handleTouchMove, { passive: false });
    modalElement.addEventListener('touchend', handleTouchEnd, { passive: false });

    return () => {
      modalElement.removeEventListener('touchstart', handleTouchStart);
      modalElement.removeEventListener('touchmove', handleTouchMove);
      modalElement.removeEventListener('touchend', handleTouchEnd);
    };
  }, [visible, handleTouchStart, handleTouchMove, handleTouchEnd]);

  return (
    <Popup
      visible={visible}
      onMaskClick={onClose}
      position="bottom"
      bodyStyle={{ 
        height,
        borderTopLeftRadius: '16px',
        borderTopRightRadius: '16px',
        transform: `translate(${translateX}px, ${translateY}px)`,
        transition: isDragging ? 'none' : 'transform 0.2s ease-out'
      }}
      maskStyle={{ backgroundColor: 'rgba(0, 0, 0, 0.5)' }}
    >
      <div 
        ref={modalRef}
        className="h-full flex flex-col"
        style={{
          touchAction: 'none', // 禁用浏览器的默认触摸行为
          userSelect: 'none', // 防止文本选择
          WebkitUserSelect: 'none', // Safari兼容
        }}
      >
        {/* 标题栏 */}
        <div className="relative flex items-center p-4 border-b border-gray-200 bg-white rounded-t-2xl">
          <button
            onClick={onClose}
            className="absolute left-4 p-2 rounded-full transition-colors bg-transparent border-none z-10"
          >
            <LeftOutline className="w-5 h-5" />
          </button>
          <div className="flex-1 flex justify-center">
            {typeof title === 'string' ? (
              <h3 className="text-lg font-semibold text-gray-800">{title}</h3>
            ) : (
              title
            )}
          </div>
        </div>
        
        {/* 内容区域 */}
        <div 
          ref={contentRef}
          className="flex-1 overflow-y-auto"
          onScroll={checkIfAtTop}
        >
          {children}
        </div>
      </div>
    </Popup>
  );
};

export default MobileModal;
