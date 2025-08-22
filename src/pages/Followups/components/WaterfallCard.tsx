import React, { useRef, useEffect, useState, useCallback } from 'react';
import { 
  PhoneOutlined, 
  WechatOutlined, 
  CheckCircleOutlined, 
  EnvironmentOutlined, 
  CalendarOutlined, 
  DollarOutlined,
  FileTextOutlined,
  HeartOutlined,
  CommentOutlined,
  ShareAltOutlined
} from '@ant-design/icons';
import './WaterfallCard.css';

interface WaterfallCardProps {
  record: any;
  onEdit: (record: any) => void;
  onHeightChange?: (height: number) => void;
  style?: React.CSSProperties;
}

/**
 * 小红书风格瀑布流卡片组件
 * 基于现有CustomerCard，增加动态高度和小红书风格元素
 */
export const WaterfallCard: React.FC<WaterfallCardProps> = React.memo(({ 
  record, 
  onEdit, 
  onHeightChange,
  style = {}
}) => {
  const cardRef = useRef<HTMLDivElement>(null);
  const [isLoaded, setIsLoaded] = useState(false);
  const [imageLoaded, setImageLoaded] = useState(false);

  const stage = record.followupstage || '未知';
  const profile = record.customerprofile || '未知';
  const community = record.scheduledcommunity || '未指定';
  const source = record.source || '未知';
  const majorcategory = record.majorcategory;
  const expectedmoveindate = record.expectedmoveindate;
  const moveintime = record.moveintime;
  const worklocation = record.worklocation;
  const userbudget = record.userbudget;
  const followupresult = record.followupresult || '';
  const wechat = record.wechat || '';

  // 模拟小红书样式的封面图片
  const generateCoverImage = (leadid: string) => {
    const colors = [
      'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
      'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)',
      'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)',
      'linear-gradient(135deg, #43e97b 0%, #38f9d7 100%)',
      'linear-gradient(135deg, #fa709a 0%, #fee140 100%)',
      'linear-gradient(135deg, #a8edea 0%, #fed6e3 100%)',
      'linear-gradient(135deg, #ffecd2 0%, #fcb69f 100%)',
      'linear-gradient(135deg, #a18cd1 0%, #fbc2eb 100%)',
    ];
    const index = parseInt(leadid?.slice(-1) || '0') % colors.length;
    return colors[index];
  };

  // 计算卡片高度
  const calculateCardHeight = useCallback(() => {
    if (!cardRef.current) return;
    
    const height = cardRef.current.offsetHeight;
    if (height > 0 && onHeightChange) {
      onHeightChange(height);
    }
  }, [onHeightChange]);

  // 组件挂载后计算高度
  useEffect(() => {
    const timer = setTimeout(() => {
      calculateCardHeight();
      setIsLoaded(true);
    }, 100);
    
    return () => clearTimeout(timer);
  }, [calculateCardHeight]);

  // 内容变化时重新计算高度
  useEffect(() => {
    if (isLoaded) {
      calculateCardHeight();
    }
  }, [calculateCardHeight, isLoaded, followupresult, majorcategory]);

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

  // 生成随机的互动数据（模拟小红书的点赞、评论等）
  const generateInteractionData = (leadid: string) => {
    const id = parseInt(leadid?.slice(-2) || '0');
    return {
      likes: Math.floor(Math.random() * 100) + id,
      comments: Math.floor(Math.random() * 20) + Math.floor(id / 3),
      shares: Math.floor(Math.random() * 10) + Math.floor(id / 5)
    };
  };

  const interactions = generateInteractionData(record.leadid);

  return (
    <div
      ref={cardRef}
      className={`waterfall-card ${isLoaded ? 'loaded' : 'loading'}`}
      style={style}
      onClick={() => onEdit(record)}
    >
      {/* 小红书风格的封面区域 */}
      <div className="card-cover">
        <div 
          className="cover-gradient"
          style={{ background: generateCoverImage(record.leadid) }}
        >
          <div className="cover-content">
            <div className="lead-id-badge">
              {record.leadid || '未知编号'}
            </div>
            <div className="stage-badge">
              <span className={`stage-indicator ${getStageHeaderClass(stage)}`}>
                {stage}
              </span>
            </div>
          </div>
        </div>
        
        {/* 小红书风格的标签 */}
        {majorcategory && majorcategory !== '未设置' && (
          <div className="category-tag">
            <CheckCircleOutlined />
            <span>{majorcategory}</span>
          </div>
        )}
      </div>

      {/* 卡片主体内容 */}
      <div className="card-body">
        {/* 联系信息 */}
        <div className="contact-section">
          <div className="contact-row">
            <span className="customer-phone">
              <PhoneOutlined className="contact-icon" />
              {record.phone ? maskPhone(record.phone) : '无电话'}
            </span>
            {wechat && (
              <span className="customer-wechat">
                <WechatOutlined className="contact-icon" />
                {maskWechat(wechat)}
              </span>
            )}
          </div>
        </div>

        {/* 详细信息网格 */}
        <div className="info-grid">
          {worklocation && worklocation !== '未设置' && (
            <div className="info-item">
              <EnvironmentOutlined className="info-icon" />
              <span className="info-text">{worklocation}</span>
            </div>
          )}
          
          {expectedmoveindate && expectedmoveindate !== '未设置' && (
            <div className="info-item">
              <CalendarOutlined className="info-icon" />
              <span className="info-text">
                {(() => {
                  try {
                    const date = new Date(expectedmoveindate);
                    return isNaN(date.getTime()) ? '日期无效' : date.toLocaleDateString();
                  } catch {
                    return '日期无效';
                  }
                })()}
              </span>
            </div>
          )}
          
          {moveintime && moveintime !== '未设置' && (
            <div className="info-item">
              <CalendarOutlined className="info-icon" />
              <span className="info-text">
                {(() => {
                  try {
                    const date = new Date(moveintime);
                    return isNaN(date.getTime()) ? '日期无效' : date.toLocaleDateString();
                  } catch {
                    return '日期无效';
                  }
                })()}
              </span>
            </div>
          )}
          
          {userbudget && userbudget !== '未设置' && (
            <div className="info-item">
              <DollarOutlined className="info-icon" />
              <span className="info-text">{userbudget}</span>
            </div>
          )}
        </div>

        {/* 销售备注 */}
        {followupresult && (
          <div className="remark-section">
            <div className="remark-header">
              <FileTextOutlined className="remark-icon" />
              <span>跟进记录</span>
            </div>
            <div className="remark-content">
              {followupresult}
            </div>
          </div>
        )}

        {/* 小红书风格的互动栏 */}
        <div className="interaction-bar">
          <div className="interaction-item">
            <HeartOutlined className="interaction-icon" />
            <span className="interaction-count">{interactions.likes}</span>
          </div>
          <div className="interaction-item">
            <CommentOutlined className="interaction-icon" />
            <span className="interaction-count">{interactions.comments}</span>
          </div>
          <div className="interaction-item">
            <ShareAltOutlined className="interaction-icon" />
            <span className="interaction-count">{interactions.shares}</span>
          </div>
        </div>
      </div>
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

WaterfallCard.displayName = 'WaterfallCard';
