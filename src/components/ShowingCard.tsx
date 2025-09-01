import React from 'react';


import { PhoneOutlined, WechatOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import './ShowingCard.css';

// 脱敏函数
const maskPhone = (phone: string) => {
  if (!phone) return '-';
  return phone.replace(/(\d{3})\d{4}(\d{4})/, '$1****$2');
};

const maskWechat = (wechat: string) => {
  if (!wechat) return '-';
  if (wechat.length < 4) return wechat;
  return wechat.substring(0, 2) + '****' + wechat.substring(wechat.length - 2);
};

// 扩展Showing接口，添加缺失的字段
interface ExtendedShowing {
  id: string;
  leadid?: string;
  scheduletime?: string | null;
  community?: string | null;
  arrivaltime?: string | null;
  showingsales?: number | null;
  trueshowingsales?: number | null;
  viewresult?: string;
  budget?: number;
  moveintime?: string;
  renttime?: number;
  remark?: string;
  created_at?: string;
  updated_at?: string;
  lead_phone?: string;
  lead_wechat?: string;
  interviewsales_nickname?: string;
  trueshowingsales_nickname?: string;
}

interface ShowingCardProps {
  showing: ExtendedShowing;
  salesOptions: { id: number; nickname: string }[];
  onEdit: (showing: any) => void;
}

// 添加渐变色样式 - 参考followups手机端页面的柔和色系
const stageStyles: Record<string, string> = {
  'stage-win': 'linear-gradient(135deg, #f6ffed 0%, #b7eb8f 100%)', // 成交：柔和绿色渐变
  'stage-invite': 'linear-gradient(135deg, #fff7e6 0%, #ffd591 100%)', // 预订：柔和橙色渐变
  'stage-confirm': 'linear-gradient(135deg, #e6f7ff 0%, #bae7ff 100%)', // 有意向：柔和蓝色渐变
  'stage-pending': 'linear-gradient(135deg, #f9f0ff 0%, #efdbff 100%)', // 考虑中：柔和紫色渐变
  'stage-lose': 'linear-gradient(135deg, #fff2f0 0%, #ffccc7 100%)', // 流失：柔和红色渐变
  'stage-unfilled': 'linear-gradient(135deg, #e6f7ff 0%, #bae7ff 100%)' // 待填写：柔和蓝色渐变
};

export const ShowingCard: React.FC<ShowingCardProps> = React.memo(({ 
  showing, 
  salesOptions, 
  onEdit 
}) => {
  // const _getViewResultColor = (result: string) => {
  //   // 如果结果为空或不在有效值列表中，都返回待填写状态的颜色
  //   if (!result || result.trim() === '') return 'primary';
  //   
  //   switch (result) {
  //     case '直签': return 'success';
  //     case '预定': return 'warning';
  //     case '意向金': return 'primary';
  //     case '考虑中': return 'default';
  //     case '已流失': return 'danger';
  //     default: return 'primary'; // 待填写使用蓝色
  //   }
  // };

  // 获取带看结果对应的渐变色背景
  const getStageHeaderClass = (result: string | undefined) => {
    // 如果结果为空、空字符串、或者不在有效值列表中，都返回待填写状态
    if (!result || result.trim() === '') return 'stage-unfilled';
    
    const stageClassMap: Record<string, string> = {
      '直签': 'stage-win',           // 成交：柔和绿色渐变
      '预定': 'stage-invite',        // 预订：柔和橙色渐变
      '意向金': 'stage-confirm',     // 有意向：柔和蓝色渐变
      '考虑中': 'stage-pending',     // 考虑中：柔和紫色渐变
      '已流失': 'stage-lose'         // 流失：柔和红色渐变
    };
    
    // 如果结果不在有效值列表中，也返回待填写状态
    return stageClassMap[result] || 'stage-unfilled';
  };

  return (
    <div className="showing-card-container">
      <div
        className="showing-card"
        onClick={() => onEdit(showing)}
      >
              {/* 卡片头部 - 渐变色背景，展示线索编号/手机号/微信号/带看结果 */}
        <div className="card-header" style={{
          background: stageStyles[getStageHeaderClass(showing.viewresult)]
        }}>
          {/* 第一行：线索编号、创建时间和带看结果 */}
          <div className="lead-header-row">
            <div className="lead-id-section">
              <div className="lead-id">{showing.leadid}</div>
              <div className="create-time-inline">
                创建时间：{showing.created_at ? dayjs(showing.created_at).format('MM-DD HH:mm') : '未填写'}
              </div>
            </div>
            <div className="view-result-tag">
              {showing.viewresult || '待填写'}
            </div>
          </div>
          
          {/* 第二行：手机号和微信号 - 行布局，空数据不展示 */}
          <div className="contact-row">
            {showing.lead_phone && (
              <div className="contact-item">
                <PhoneOutlined className="contact-icon" />
                <span className="contact-text">
                  {maskPhone(showing.lead_phone)}
                </span>
              </div>
            )}
            {showing.lead_wechat && (
              <div className="contact-item">
                <WechatOutlined className="contact-icon" />
                <span className="contact-text">
                  {maskWechat(showing.lead_wechat)}
                </span>
              </div>
            )}
          </div>
        </div>
      
              {/* 卡片内容 - 双栏布局 */}
        <div className="card-content">
          <div className="info-columns">
            {/* 第一行：到达时间和社区 */}
            <div className="info-row">
              <span className="info-label">到达时间</span>
              <div className="info-value">
                {showing.arrivaltime ? (dayjs(showing.arrivaltime).isValid() ? dayjs(showing.arrivaltime).format('MM-DD HH:mm') : '时间格式错误') : '未填写'}
              </div>
            </div>
            
            <div className="info-row">
              <span className="info-label">社区</span>
              <div className="info-value">
                {showing.community || '未填写'}
              </div>
            </div>
            
            {/* 第二行：入住时间和约访管家 */}
            <div className="info-row">
              <span className="info-label">入住时间</span>
              <div className="info-value">
                {showing.moveintime ? (dayjs(showing.moveintime).isValid() ? dayjs(showing.moveintime).format('MM-DD') : '时间格式错误') : '未填写'}
              </div>
            </div>
            
            <div className="info-row">
              <span className="info-label">约访管家</span>
              <div className="info-value">
                {showing.interviewsales_nickname || '未填写'}
              </div>
            </div>
            
            {/* 第三行：分配管家和实际带看管家 */}
            <div className="info-row">
              <span className="info-label">分配管家</span>
              <div className="info-value">
                {salesOptions.find(s => s.id === showing.showingsales)?.nickname || '未填写'}
              </div>
            </div>
            
            <div className="info-row">
              <span className="info-label">实际带看管家</span>
              <div className="info-value">
                {showing.trueshowingsales_nickname || '未填写'}
              </div>
            </div>
            
            {/* 第四行：预算和租期 */}
            <div className="info-row">
              <span className="info-label">预算</span>
              <div className="info-value">
                ¥{showing.budget?.toLocaleString() || '未填写'}
              </div>
            </div>
            
            <div className="info-row">
              <span className="info-label">租期</span>
              <div className="info-value">
                {showing.renttime || '未填写'}个月
              </div>
            </div>
          </div>
          

          
          {/* 备注信息（如果有） */}
          {showing.remark && (
            <div className="remark-section">
              <div className="remark-content">
                {showing.remark}
              </div>
            </div>
          )}
        </div>
          </div>
    </div>
  );
}, (prevProps, nextProps) => {
  // 自定义比较函数，只有当记录真正变化时才重渲染
  return prevProps.showing.id === nextProps.showing.id &&
         prevProps.showing.leadid === nextProps.showing.leadid &&
         prevProps.showing.viewresult === nextProps.showing.viewresult &&
         prevProps.showing.scheduletime === nextProps.showing.scheduletime &&
         prevProps.showing.community === nextProps.showing.community &&
         prevProps.showing.budget === nextProps.showing.budget &&
         prevProps.showing.interviewsales_nickname === nextProps.showing.interviewsales_nickname;
});

ShowingCard.displayName = 'ShowingCard';
