import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { RollbackOutlined } from '@ant-design/icons';
import './SwipeMenu.css';

interface SwipeMenuProps {
  visible: boolean;
  closing?: boolean;
  onRollback: (record?: any) => void;
  onClose: () => void;
}

export const SwipeMenu: React.FC<SwipeMenuProps> = ({ visible, closing: externalClosing, onRollback, onClose }) => {
  const [internalClosing, setInternalClosing] = useState(false);
  
  // 使用外部closing状态或内部closing状态
  const isClosing = externalClosing || internalClosing;
  
  // 安全的触摸事件处理
  const touchStartRef = useRef({ x: 0, y: 0 });
  
  // 当visible变为true时，重置closing状态
  useEffect(() => {
    if (visible) {
      setInternalClosing(false);
    }
  }, [visible]);

  // 带动画的关闭函数
  const safeOnClose = useMemo(() => {
    return () => {
      try {
        if (typeof onClose === 'function') {
          setInternalClosing(true);
          // 延迟执行实际关闭，等待动画完成
          setTimeout(() => {
            onClose();
            setInternalClosing(false);
          }, 300); // 与动画时长保持一致
        }
      } catch (error) {
        console.warn('SwipeMenu onClose error:', error);
        setInternalClosing(false);
      }
    };
  }, [onClose]);

  const safeOnRollback = useMemo(() => {
    return () => {
      try {
        if (typeof onRollback === 'function') {
          setInternalClosing(true);
          // 延迟执行回退操作，等待动画完成
          setTimeout(() => {
            onRollback();
            setInternalClosing(false);
          }, 300); // 与动画时长保持一致
        }
      } catch (error) {
        console.warn('SwipeMenu onRollback error:', error);
        setInternalClosing(false);
      }
    };
  }, [onRollback]);

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    if (e.touches?.[0]) {
      touchStartRef.current = {
        x: e.touches[0].clientX || 0,
        y: e.touches[0].clientY || 0
      };
    }
  }, []);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (!e.touches?.[0]) return;
    
    const deltaX = (e.touches[0].clientX || 0) - touchStartRef.current.x;
    const deltaY = (e.touches[0].clientY || 0) - touchStartRef.current.y;
    
    // 检测滑动退出
    if (Math.abs(deltaX) > 30) {
      if (deltaX > 0) {
        // 右滑退出（向右滑动）
        safeOnClose();
      } else if (deltaX < 0) {
        // 左滑退出（向左滑动）
        safeOnClose();
      }
    } else if (Math.abs(deltaY) > 10) {
      // 上下滑动退出（降低阈值，滑动开始时就退出）
      safeOnClose();
    }
  }, [safeOnClose]);

  // 简单的点击处理
  const handleRollbackClick = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    safeOnRollback();
  }, [safeOnRollback]);
  
  // 早期退出检查 - 在所有hooks之后
  if (!visible) return null;
  if (!onRollback || !onClose) {
    console.warn('SwipeMenu: Missing required props');
    return null;
  }

  return (
    <div 
      className={`swipe-menu ${isClosing ? 'swipe-menu-closing' : ''}`}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
    >
      <div className="swipe-menu-item rollback-item" onClick={handleRollbackClick}>
        <RollbackOutlined className="swipe-menu-icon" />
        <span className="swipe-menu-text">回退</span>
      </div>
    </div>
  );
};
