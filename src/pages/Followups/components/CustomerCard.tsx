import React, { useRef, useEffect, useState, useCallback } from 'react';
import { Rate } from 'antd';
import { 
  PhoneOutlined, 
  WechatOutlined, 
  CheckCircleOutlined, 
  EnvironmentOutlined, 
  CalendarOutlined, 
  DollarOutlined,
  FileTextOutlined
} from '@ant-design/icons';
import { CardContextMenu } from './CardContextMenu';
import { SwipeMenu } from './SwipeMenu';
import './CustomerCard.css';

interface CustomerCardProps {
  record: any;
  onEdit: (record: any) => void;
  onRegister?: (itemId: string, element: HTMLElement) => void;
  onUnregister?: (itemId: string) => void;
  onRollback?: (record: any) => void;
}

export const CustomerCard: React.FC<CustomerCardProps> = React.memo(({ 
  record, 
  onEdit, 
  onRegister, 
  onUnregister,
  onRollback
}) => {
  const cardRef = useRef<HTMLDivElement>(null);
  const [contextMenuVisible, setContextMenuVisible] = useState(false);
  const [contextMenuPosition, setContextMenuPosition] = useState({ x: 0, y: 0 });
  const longPressTimerRef = useRef<NodeJS.Timeout | null>(null);
  const touchStartTimeRef = useRef<number>(0);
  const longPressTriggeredRef = useRef<boolean>(false);
  
  // 右滑相关状态
  const [swiped, setSwiped] = useState(false);
  const [swipeMenuClosing, setSwipeMenuClosing] = useState(false);
  const touchStartXRef = useRef<number>(0);
  const touchStartYRef = useRef<number>(0);
  const isDraggingRef = useRef<boolean>(false);
  const stage = record.followupstage || '未知';
  const majorcategory = record.majorcategory;
  const expectedmoveindate = record.expectedmoveindate;
  const moveintime = record.moveintime;
  const worklocation = record.worklocation;
  const userbudget = record.userbudget;
  const followupresult = record.followupresult || '';
  const wechat = record.wechat || '';

  // 检查是否有任何信息显示
  const hasAnyInfo = majorcategory && majorcategory !== '未设置' ||
                    worklocation && worklocation !== '未设置' ||
                    expectedmoveindate && expectedmoveindate !== '未设置' ||
                    moveintime && moveintime !== '未设置' ||
                    userbudget && userbudget !== '未设置' ||
                    followupresult;

  // 瀑布流布局注册和注销
  useEffect(() => {
    if (cardRef.current && onRegister) {
      onRegister(record.leadid || record.id, cardRef.current);
    }

    return () => {
      if (onUnregister) {
        onUnregister(record.leadid || record.id);
      }
    };
  }, [record.leadid, record.id, onRegister, onUnregister]);

  // 监听滚动事件，当滚动时关闭右滑菜单
  useEffect(() => {
    if (!swiped) return; // 只有在右滑菜单显示时才监听滚动

    let scrollTimeout: NodeJS.Timeout;
    let scrollTouchStartX: number | null = null;
    let scrollTouchStartY: number | null = null;
    
    const handleScroll = () => {
      // 防抖处理，避免频繁触发
      clearTimeout(scrollTimeout);
      scrollTimeout = setTimeout(() => {
        setSwipeMenuClosing(true);
        // 延迟关闭，等待动画完成
        setTimeout(() => {
          setSwiped(false);
          setSwipeMenuClosing(false);
        }, 300);
      }, 100);
    };

    // 监听整个页面的滚动事件
    window.addEventListener('scroll', handleScroll, { passive: true });
    
    // 监听触摸开始，记录坐标
    const handleTouchStart = (e: TouchEvent) => {
      if (e.touches[0]) {
        scrollTouchStartX = e.touches[0].clientX;
        scrollTouchStartY = e.touches[0].clientY;
      }
    };
    
    // 监听触摸移动事件，只在垂直滚动时关闭菜单
    const handleTouchMove = (e: TouchEvent) => {
      if (!e.touches[0] || scrollTouchStartY === null || scrollTouchStartX === null) return;
      
      const currentX = e.touches[0].clientX;
      const currentY = e.touches[0].clientY;
      const deltaY = Math.abs(currentY - scrollTouchStartY);
      const deltaX = Math.abs(currentX - scrollTouchStartX);
      
      // 只有当垂直移动距离大于水平移动距离，且垂直移动超过阈值时，才关闭菜单
      if (deltaY > deltaX && deltaY > 10) {
        // 防抖处理，避免频繁触发
        clearTimeout(scrollTimeout);
        scrollTimeout = setTimeout(() => {
          setSwipeMenuClosing(true);
          // 延迟关闭，等待动画完成
          setTimeout(() => {
            setSwiped(false);
            setSwipeMenuClosing(false);
          }, 300);
        }, 50); // 减少防抖延迟，更快响应
      }
    };
    
    document.addEventListener('touchstart', handleTouchStart, { passive: true });
    document.addEventListener('touchmove', handleTouchMove, { passive: true });

    return () => {
      window.removeEventListener('scroll', handleScroll);
      document.removeEventListener('touchstart', handleTouchStart);
      document.removeEventListener('touchmove', handleTouchMove);
      clearTimeout(scrollTimeout);
    };
  }, [swiped]);

  // 触摸事件处理 - 集成长按和右滑功能
  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    const touch = e.touches[0];
    
    // 记录触摸开始位置和时间
    touchStartXRef.current = touch.clientX;
    touchStartYRef.current = touch.clientY;
    touchStartTimeRef.current = Date.now();
    longPressTriggeredRef.current = false;
    isDraggingRef.current = false;
    
    // 设置长按定时器
    longPressTimerRef.current = setTimeout(() => {
      // 只有在没有拖拽的情况下才触发长按
      if (!isDraggingRef.current) {
        const rect = cardRef.current?.getBoundingClientRect();
        if (rect) {
          setContextMenuPosition({
            x: touch.clientX,
            y: touch.clientY
          });
          setContextMenuVisible(true);
          longPressTriggeredRef.current = true;
        }
      }
    }, 500);
  }, []);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    // 如果长按菜单已经显示，不要处理滑动
    if (contextMenuVisible) {
      return;
    }
    
    const touch = e.touches[0];
    const deltaX = touch.clientX - touchStartXRef.current;
    const deltaY = touch.clientY - touchStartYRef.current;
    
    // 计算移动距离
    const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);
    
    // 如果移动距离超过阈值，标记为拖拽并清除长按定时器
    if (distance > 10) {
      isDraggingRef.current = true;
      if (longPressTimerRef.current) {
        clearTimeout(longPressTimerRef.current);
        longPressTimerRef.current = null;
      }
      
      // 检查是否为水平滑动
      if (Math.abs(deltaX) > Math.abs(deltaY)) {
        if (deltaX < -20) {
          // 右滑（向左滑动）- 显示覆盖菜单
          if (!swiped) {
            setSwiped(true);
          }
        } else if (deltaX > 20) {
                  // 左滑（向右滑动） - 关闭右滑菜单
        if (swiped) {
          setSwipeMenuClosing(true);
          // 延迟关闭，等待动画完成
          setTimeout(() => {
            setSwiped(false);
            setSwipeMenuClosing(false);
          }, 300);
        }
        }
      }
      // 检查是否为垂直滑动 - 无论是否显示右滑菜单都要检测
      else if (Math.abs(deltaY) > Math.abs(deltaX) && Math.abs(deltaY) > 10) {
        // 上下滑动 - 关闭右滑菜单（降低阈值，滑动开始时就退出）
        if (swiped) {
          setSwipeMenuClosing(true);
          // 延迟关闭，等待动画完成
          setTimeout(() => {
            setSwiped(false);
            setSwipeMenuClosing(false);
          }, 300);
        }
      }
    }
  }, [contextMenuVisible, swiped]);

  const handleTouchEnd = useCallback(() => {
    // 清除长按定时器
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
    
    // 重置拖拽状态
    isDraggingRef.current = false;
  }, []);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (e.button === 2) { // 右键
      e.preventDefault();
      setContextMenuPosition({
        x: e.clientX,
        y: e.clientY
      });
      setContextMenuVisible(true);
    }
  }, []);

  const handleContextMenu = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setContextMenuPosition({
      x: e.clientX,
      y: e.clientY
    });
    setContextMenuVisible(true);
  }, []);

  const closeContextMenu = useCallback(() => {
    // 延迟关闭菜单，避免与复制操作冲突
    setTimeout(() => {
      setContextMenuVisible(false);
    }, 100);
  }, []);

  const handleRollback = useCallback((record: any) => {
    if (onRollback) {
      onRollback(record);
    }
    closeContextMenu();
  }, [onRollback, closeContextMenu]);

  // 处理右滑菜单回退
  const handleSwipeRollback = useCallback(() => {
    if (onRollback) {
      onRollback(record);
    }
    setSwipeMenuClosing(true);
    // 延迟关闭，等待动画完成
    setTimeout(() => {
      setSwiped(false);
      setSwipeMenuClosing(false);
    }, 300);
  }, [onRollback, record]);

  // 处理右滑菜单关闭
  const handleSwipeMenuClose = useCallback(() => {
    setSwipeMenuClosing(true);
    // 延迟关闭，等待动画完成
    setTimeout(() => {
      setSwiped(false);
      setSwipeMenuClosing(false);
    }, 300);
  }, []);

  // 点击卡片其他区域关闭右滑菜单
  const handleCardClick = useCallback((e: React.MouseEvent) => {
    // 如果正在显示右滑菜单，点击卡片内容区域关闭菜单
    if (swiped) {
      setSwipeMenuClosing(true);
      // 延迟关闭，等待动画完成
      setTimeout(() => {
        setSwiped(false);
        setSwipeMenuClosing(false);
      }, 300);
      e.preventDefault();
      e.stopPropagation();
      return;
    }
    
    // 如果刚刚发生了长按，不触发点击事件
    if (longPressTriggeredRef.current) {
      e.preventDefault();
      e.stopPropagation();
      longPressTriggeredRef.current = false;
      return;
    }
    
    // 正常的编辑点击
    onEdit(record);
  }, [swiped, onEdit, record]);


  // 获取跟进阶段头部样式类名
  const getStageHeaderClass = (stage: string) => {
    const stageClassMap: Record<string, string> = {
      '待接收': 'stage-pending',
      '确认需求': 'stage-confirm',
      '邀约到店': 'stage-invite',
      '已到店': 'stage-visited',
      '赢单': 'stage-win',
      '丢单': 'stage-lose'
    };
    return stageClassMap[stage] || '';
  };

  // 数据脱敏工具函数
  const maskPhone = (phone: string): string => {
    if (!phone || phone.length < 7) return phone;
    return phone.substring(0, 4) + '****' + phone.substring(phone.length - 3);
  };

  const maskWechat = (wechat: string): string => {
    if (!wechat || wechat.length < 4) return wechat;
    return wechat.substring(0, 2) + '****' + wechat.substring(wechat.length - 2);
  };

  // 跟进意向评分转换函数
  const getRatingValue = (rating: string): number => {
    switch (rating) {
      case 'A': return 3;
      case 'B+': return 2;
      case 'B': return 1;
      case 'C': return 0;
      default: return 0;
    }
  };

  return (
    <div className="customer-card-container">
      <div
        ref={cardRef}
        className={`customer-card ${swiped ? 'swiped' : ''}`}
        onClick={handleCardClick}
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
        onTouchMove={handleTouchMove}
        onTouchCancel={handleTouchEnd}
        onMouseDown={handleMouseDown}
        onContextMenu={handleContextMenu}
      >
      <div className={`card-header ${getStageHeaderClass(stage)}`}>
        <div className="customer-details">
          {/* 线索编号和阶段标签行 */}
          <div className="lead-header-row">
            <div className="lead-id">{record.leadid || '未知编号'}</div>
            <div className="stage-tag">{stage}</div>
          </div>
          {/* 跟进意向和联系信息行 */}
          <div className="rating-contact-row">
            {/* 联系信息 - 左对齐 */}
            <div className="contact-info">
              <div className="contact-column">
                <span className="customer-phone" style={{ fontSize: '12px' }}>
                  <PhoneOutlined className="contact-icon" />
                  {record.phone ? maskPhone(record.phone) : '无电话'}
                </span>
                {wechat && (
                  <span className="customer-wechat" style={{ fontSize: '12px' }}>
                    <WechatOutlined className="contact-icon" />
                    {maskWechat(wechat)}
                  </span>
                )}
              </div>
            </div>
            {/* 跟进意向 - 右对齐，使用Rate组件 */}
            {record.userrating && (
              <div className="rating-info">
                <Rate 
                  disabled 
                  value={getRatingValue(record.userrating)} 
                  count={3}
                  style={{ color: '#faad14', fontSize: '14px' }}
                  className="compact-rating"
                />
              </div>
            )}
          </div>
        </div>
      </div>
      
      <div className={`card-content ${!hasAnyInfo ? 'empty-content' : ''}`}>
        <div className="info-columns">
          {/* 专业类别 */}
          {majorcategory && majorcategory !== '未设置' && (
            <div className="info-row">
              <span className="info-label">
                <CheckCircleOutlined className="info-icon" />
              </span>
              <span className="info-value">{majorcategory}</span>
            </div>
          )}
          
          {/* 工作地点 */}
          {worklocation && worklocation !== '未设置' && (
            <div className="info-row">
              <span className="info-label">
                <EnvironmentOutlined className="info-icon" />
              </span>
              <span className="info-value">{worklocation}</span>
            </div>
          )}
          
          {/* 预期入住日期 */}
          {expectedmoveindate && expectedmoveindate !== '未设置' && (
            <div className="info-row">
              <span className="info-label">
                <CalendarOutlined className="info-icon" />
              </span>
              <span className="info-value">
                {(() => {
                  try {
                    const date = new Date(expectedmoveindate);
                    return isNaN(date.getTime()) ? null : date.toLocaleDateString();
                  } catch {
                    return null;
                  }
                })()}
              </span>
            </div>
          )}
          
          {/* 入住时间 */}
          {moveintime && moveintime !== '未设置' && (
            <div className="info-row">
              <span className="info-label">
                <CalendarOutlined className="info-icon" />
              </span>
              <span className="info-value">
                {(() => {
                  try {
                    const date = new Date(moveintime);
                    return isNaN(date.getTime()) ? null : date.toLocaleDateString();
                } catch {
                    return null;
                  }
                })()}
              </span>
            </div>
          )}
          
          {/* 用户预算 */}
          {userbudget && userbudget !== '未设置' && (
            <div className="info-row">
              <span className="info-label">
                <DollarOutlined className="info-icon" />
              </span>
              <span className="info-value">{userbudget}</span>
            </div>
          )}
          
          {/* 销售备注 */}
          {followupresult && (
            <div className="info-row remark-row">
              <span className="info-label">
                <FileTextOutlined className="info-icon" />
              </span>
              <span className="info-value remark-value">{followupresult}</span>
            </div>
          )}
        </div>
      </div>
      
      {/* 长按菜单 */}
      <CardContextMenu
        visible={contextMenuVisible}
        x={contextMenuPosition.x}
        y={contextMenuPosition.y}
        record={record}
        onClose={closeContextMenu}
        onRollback={handleRollback}
      />
      </div>
      
      {/* 右滑菜单 */}
      <SwipeMenu
        visible={swiped}
        closing={swipeMenuClosing}
        onRollback={handleSwipeRollback}
        onClose={handleSwipeMenuClose}
      />
    </div>
  );
}, (prevProps, nextProps) => {
  // 自定义比较函数，只有当记录真正变化时才重渲染
  return prevProps.record.id === nextProps.record.id &&
         prevProps.record.customername === nextProps.record.customername &&
         prevProps.record.phone === nextProps.record.phone &&
         prevProps.record.followupstage === nextProps.record.followupstage &&
         prevProps.record.majorcategory === nextProps.record.majorcategory &&
         prevProps.record.followupresult === nextProps.record.followupresult;
});

CustomerCard.displayName = 'CustomerCard';
