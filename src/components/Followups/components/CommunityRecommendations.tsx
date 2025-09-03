import React, { useState, useEffect, useMemo } from 'react';
import { Tag, Spin, Button, Space, Typography } from 'antd';
import type { CommunityRecommendation } from '../../../services/CommunityRecommendationService';
import CommunityRecommendationService from '../../../services/CommunityRecommendationService';
import type { FollowupRecord } from '../../../pages/Followups/types';

const { Text } = Typography;

interface CommunityRecommendationsProps {
  worklocation: string;
  userbudget: number;
  customerprofile: string;
  record: FollowupRecord;
  compact?: boolean; // 新增：紧凑模式，用于可展开行
}

const CommunityRecommendations: React.FC<CommunityRecommendationsProps> = ({
  worklocation,
  userbudget,
  customerprofile,
  record,
  compact = false
}) => {
  const [recommendations, setRecommendations] = useState<CommunityRecommendation[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const recommendationService = CommunityRecommendationService.getInstance();

  // 从extended_data中获取通勤时间数据（与基础数据同步返回）
  const commuteTimes = useMemo(() => {
    if (record?.extended_data?.commute_times) {
      return record.extended_data.commute_times;
    }
    return null;
  }, [record?.extended_data?.commute_times]);

  // 检查是否有有效的通勤时间数据
  const hasCommuteTimes = useMemo(() => {
    return commuteTimes && 
           typeof commuteTimes === 'object' && 
           Object.keys(commuteTimes).length > 0;
  }, [commuteTimes]);

  useEffect(() => {
    // 只有在有通勤时间数据或用户预算时才加载推荐
    if (hasCommuteTimes || userbudget > 0) {
      loadRecommendations();
    }
  }, [worklocation, userbudget, customerprofile, hasCommuteTimes]);

  const loadRecommendations = async () => {
    setLoading(true);
    setError(null);
    
    try {
      // 直接使用extended_data中的通勤时间数据计算推荐
      // 如果没有通勤时间数据，传入空对象，服务会使用默认值0
      const data = await recommendationService.getRecommendationsWithCommuteTimes({
        worklocation,
        userbudget,
        customerprofile,
        followupId: Number(record.id),
        commuteTimes: commuteTimes || {}
      });
      
      setRecommendations(data);
    } catch (err) {
      setError('获取推荐失败');
      console.error('加载推荐失败:', err);
    } finally {
      setLoading(false);
    }
  };



  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: compact ? '12px' : '20px' }}>
        <Spin size={compact ? 'small' : 'large'} />
        <div style={{ marginTop: '8px', fontSize: compact ? '12px' : '14px' }}>
          正在计算推荐...
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ textAlign: 'center', padding: compact ? '12px' : '20px', color: '#ff4d4f' }}>
        <div style={{ fontSize: compact ? '12px' : '14px' }}>{error}</div>
        <Button size="small" onClick={loadRecommendations} style={{ marginTop: '8px' }}>
          重试
        </Button>
      </div>
    );
  }

  // 如果没有通勤时间数据和用户预算，显示提示信息
  if (!hasCommuteTimes && userbudget <= 0) {
    return (
      <div style={{ textAlign: 'center', padding: compact ? '12px' : '20px', color: '#999' }}>
        <span style={{ fontSize: compact ? '14px' : '16px', marginRight: '4px' }}>ℹ️</span>
        <span style={{ fontSize: compact ? '12px' : '14px' }}>
          请设置用户预算或计算通勤时间以获取社区推荐
        </span>
      </div>
    );
  }

  if (recommendations.length === 0) {
    return (
      <div style={{ textAlign: 'center', padding: compact ? '12px' : '20px', color: '#999' }}>
        <div style={{ fontSize: compact ? '12px' : '14px' }}>暂无推荐社区</div>
        <Button size="small" onClick={loadRecommendations} style={{ marginTop: '8px' }}>
          重新计算
        </Button>
      </div>
    );
  }

  // 所有推荐社区都直接展示
  const allRecommendations = recommendations;

  return (
    <div className="community-recommendations" style={{ margin: 0, padding: 0 }}>


      {/* 所有推荐社区 - 直接展示，无折叠 */}
      {allRecommendations.map((rec, index) => (
        <div
          key={rec.community}
          style={{
            padding: compact ? '8px 12px' : '12px 16px',
            borderBottom: '1px solid #f0f0f0',
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            marginBottom: index === allRecommendations.length - 1 ? '0' : '0'
          }}
        >
          {/* 分数进度条 */}
          <div style={{ 
            width: '135px', 
            height: '8px', 
            background: '#f0f0f0', 
            borderRadius: '4px',
            overflow: 'hidden',
            flexShrink: 0
          }}>
            <div style={{
              width: `${rec.score}%`,
              height: '100%',
              background: rec.color,
              borderRadius: '4px',
              transition: 'width 0.3s ease'
            }} />
          </div>

          {/* 推荐分 */}
          <div style={{ 
            minWidth: '50px', 
            fontSize: '13px', 
            fontWeight: 'bold', 
            color: rec.color,
            textAlign: 'center',
            flexShrink: 0
          }}>
            {rec.score}分
          </div>

          {/* 推荐tag */}
          <Tag 
            color={rec.color} 
            style={{ 
              fontSize: '12px',
              fontWeight: 'bold',
              flexShrink: 0,
              minWidth: '70px',
              textAlign: 'center',
              padding: '4px 8px',
              border: 'none',
              boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
            }}
          >
            {rec.recommendation}
          </Tag>

          {/* 社区名称 */}
          <Text strong style={{ 
            fontSize: '13px', 
            color: '#333',
            width: '120px',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            flexShrink: 0
          }}>
            {rec.community}
          </Text>

          {/* 评分明细 */}
          <div style={{ 
            fontSize: '12px', 
            color: '#666',
            flexShrink: 0,
            minWidth: '200px',
            textAlign: 'left'
          }}>
            <Space split={<span style={{ color: '#d9d9d9', margin: '0 4px' }}>|</span>}>
              <span>通勤: {rec.commuteTime >= 0 ? `${rec.commuteTime}分钟` : '未计算'}</span>
              <span>预算: {rec.budgetScore}分</span>
              <span>历史: {rec.historicalScore}分</span>
            </Space>
          </div>
        </div>
      ))}


    </div>
  );
};

export default CommunityRecommendations;
