import React, { useRef, useEffect } from 'react';
import { 
  PhoneOutlined, 
  WechatOutlined, 
  CheckCircleOutlined, 
  EnvironmentOutlined, 
  CalendarOutlined, 
  DollarOutlined,
  FileTextOutlined
} from '@ant-design/icons';
import './CustomerCard.css';

interface CustomerCardProps {
  record: any;
  onEdit: (record: any) => void;
  onRegister?: (itemId: string, element: HTMLElement) => void;
  onUnregister?: (itemId: string) => void;
}

export const CustomerCard: React.FC<CustomerCardProps> = React.memo(({ 
  record, 
  onEdit, 
  onRegister, 
  onUnregister 
}) => {
  const cardRef = useRef<HTMLDivElement>(null);
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

  // 调试信息
  console.log('CustomerCard debug:', {
    leadid: record.leadid,
    hasAnyInfo,
    majorcategory: majorcategory || 'null',
    worklocation: worklocation || 'null',
    expectedmoveindate: expectedmoveindate || 'null',
    moveintime: moveintime || 'null',
    userbudget: userbudget || 'null',
    followupresult: followupresult || 'null'
  });

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

  return (
    <div
      ref={cardRef}
      className="customer-card"
      onClick={() => onEdit(record)}
    >
      <div className={`card-header ${getStageHeaderClass(stage)}`}>
        <div className="customer-details">
          {/* 线索编号和阶段标签行 */}
          <div className="lead-header-row">
            <div className="lead-id">{record.leadid || '未知编号'}</div>
            <div className="stage-tag">{stage}</div>
          </div>
          {/* 移除客户姓名显示，跟进数据中不包含用户姓名 */}
          <div className="contact-info">
            <div className="contact-row">
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
