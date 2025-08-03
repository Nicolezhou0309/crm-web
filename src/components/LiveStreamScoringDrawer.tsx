import React, { useState, useEffect } from 'react';
import { Drawer, Form, Select, Input, Button, Tag, Divider, Avatar, Space, message } from 'antd';
import { StarOutlined, UserOutlined, CalendarOutlined, ClockCircleOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import type { LiveStreamScheduleWithScoring, ScoringData, ScoringDimension, ScoringOption } from '../types/scoring';
import './LiveStreamScoringDrawer.css';

const { TextArea } = Input;
const { Option } = Select;

interface LiveStreamScoringDrawerProps {
  visible: boolean;
  schedule: LiveStreamScheduleWithScoring | null;
  onClose: () => void;
}

// 模拟评分维度数据
const mockScoringDimensions: ScoringDimension[] = [
  {
    id: 1,
    dimension_name: '开播准备',
    dimension_code: 'preparation',
    selection_name: 'live_stream_preparation_options',
    description: '直播开始前的准备工作评分',
    weight: 1.0,
    sort_order: 1,
    is_active: true,
    options: [
      { code: 'no_delay', text: '开播即出镜开始讲解', score: 10.0 },
      { code: 'adjust_within_1min', text: '开播后适当调整，1分钟内开始讲解', score: 5.5 },
      { code: 'chat_over_1min', text: '开播后闲聊，1分钟内未开始讲解', score: 3.0 }
    ]
  },
  {
    id: 2,
    dimension_name: '直播状态',
    dimension_code: 'live_status',
    selection_name: 'live_stream_status_options',
    description: '直播过程中的状态表现评分',
    weight: 1.0,
    sort_order: 2,
    is_active: true,
    options: [
      { code: 'energetic', text: '进入直播间口播欢迎，状态饱满', score: 10.0 },
      { code: 'normal', text: '状态平淡无明显优点', score: 5.5 },
      { code: 'lazy', text: '态度懒散，说话无精打采', score: 0.0 }
    ]
  },
  {
    id: 3,
    dimension_name: '讲解话术',
    dimension_code: 'presentation',
    selection_name: 'live_stream_presentation_options',
    description: '直播讲解的话术质量评分',
    weight: 1.0,
    sort_order: 3,
    is_active: true,
    options: [
      { code: 'attractive', text: '话术流畅严谨有吸引力，讲解认真全面', score: 10.0 },
      { code: 'complete_but_rough', text: '每10分钟介绍一遍房间，介绍完整但不够严谨', score: 5.5 },
      { code: 'cold_field', text: '只读评论不介绍房间，冷场或聊天超过5分钟', score: 3.0 }
    ]
  },
  {
    id: 4,
    dimension_name: '出勤情况',
    dimension_code: 'attendance',
    selection_name: 'live_stream_attendance_options',
    description: '直播出勤和时长评分',
    weight: 1.0,
    sort_order: 4,
    is_active: true,
    options: [
      { code: 'on_time_full', text: '准时开播并播满120分钟，中途未离开', score: 9.0 },
      { code: 'delay_under_10min', text: '因上场拖延迟到，未满120分钟或中途缺席10分钟以内', score: 5.5 },
      { code: 'late_over_10min', text: '无故迟到或直播时长未满120分钟或中途缺席超过10分钟', score: 0.0 }
    ]
  },
  {
    id: 5,
    dimension_name: '运镜技巧',
    dimension_code: 'camera_skills',
    selection_name: 'live_stream_camera_options',
    description: '直播镜头运用技巧评分',
    weight: 1.0,
    sort_order: 5,
    is_active: true,
    options: [
      { code: 'beautiful', text: '构图美观横平竖直，人物居中运镜丝滑', score: 10.0 },
      { code: 'slightly_tilted', text: '构图略微倾斜，运镜轻微摇晃', score: 5.5 },
      { code: 'poor_angle', text: '人物长时间不在镜头，画面角度刁钻，运镜摇晃严重', score: 3.0 }
    ]
  }
];

// 模拟用户数据
const mockUsers = {
  123: { id: 123, name: '张三', avatar: null },
  456: { id: 456, name: '李四', avatar: null },
  789: { id: 789, name: '王五', avatar: null }
};

// 模拟评分数据
const mockScoringData: ScoringData = {
  scoring_version: '1.0',
  evaluator_id: 123,
  evaluation_date: '2024-01-15',
  dimensions: {
    preparation: {
      selected_option: 'no_delay',
      score: 10.0,
      notes: '开播即出镜开始讲解，没有拖延'
    },
    live_status: {
      selected_option: 'energetic',
      score: 10.0,
      notes: '进入直播间观众口播欢迎，状态饱满'
    },
    presentation: {
      selected_option: 'attractive',
      score: 10.0,
      notes: '话术流畅严谨有吸引力，讲解认真全面'
    },
    attendance: {
      selected_option: 'on_time_full',
      score: 9.0,
      notes: '准时开播并播满120分钟，中途未离开'
    },
    camera_skills: {
      selected_option: 'beautiful',
      score: 10.0,
      notes: '构图美观横平竖直，人物居中运镜丝滑，镜头0.5倍'
    }
  },
  calculation: {
    total_score: 49.0,
    average_score: 9.8,
    weighted_average: 9.8
  },
  metadata: {
    created_at: '2024-01-15T10:30:00Z',
    updated_at: '2024-01-15T10:30:00Z',
    evaluation_notes: '整体表现优秀，各项指标都达到标准，特别是开播准备和直播状态表现突出。'
  }
};

const LiveStreamScoringDrawer: React.FC<LiveStreamScoringDrawerProps> = ({
  visible,
  schedule,
  onClose
}) => {
  const [scoringData, setScoringData] = useState<ScoringData | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (schedule && visible) {
      // 模拟加载评分数据
      if (schedule.scoring_status === 'scored' || schedule.scoring_status === 'approved') {
        setScoringData(mockScoringData);
      } else {
        setScoringData(null);
      }
      setIsEditing(false);
    }
  }, [schedule, visible]);

  const handleDimensionChange = (dimensionCode: string, optionCode: string) => {
    const dimension = mockScoringDimensions.find(d => d.dimension_code === dimensionCode);
    const option = dimension?.options.find((o: ScoringOption) => o.code === optionCode);
    
    if (!dimension || !option) return;

    const newData: ScoringData = {
      scoring_version: '1.0',
      evaluator_id: 123, // 模拟当前用户ID
      evaluation_date: dayjs().format('YYYY-MM-DD'),
      dimensions: {
        ...scoringData?.dimensions,
        [dimensionCode]: {
          selected_option: optionCode,
          score: option.score,
          notes: option.text
        }
      },
      calculation: calculateScores({
        ...scoringData?.dimensions,
        [dimensionCode]: {
          selected_option: optionCode,
          score: option.score,
          notes: option.text
        }
      }, mockScoringDimensions),
      metadata: {
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }
    };

    setScoringData(newData);
  };

  const calculateScores = (dimensionsData: any, dims: ScoringDimension[]) => {
    const scores = Object.entries(dimensionsData).map(([code, data]: [string, any]) => {
      const dimension = dims.find(d => d.dimension_code === code);
      return {
        score: data.score,
        weight: dimension?.weight || 1.0
      };
    });

    const totalScore = scores.reduce((sum, item) => sum + item.score, 0);
    const averageScore = scores.length > 0 ? totalScore / scores.length : 0;
    const weightedSum = scores.reduce((sum, item) => sum + (item.score * item.weight), 0);
    const totalWeight = scores.reduce((sum, item) => sum + item.weight, 0);
    const weightedAverage = totalWeight > 0 ? weightedSum / totalWeight : 0;

    return {
      total_score: totalScore,
      average_score: averageScore,
      weighted_average: weightedAverage
    };
  };

  const handleSave = async () => {
    setLoading(true);
    try {
      // 模拟保存评分数据
      await new Promise(resolve => setTimeout(resolve, 1000));
      message.success('评分保存成功');
      setIsEditing(false);
    } catch (error) {
      message.error('评分保存失败');
    } finally {
      setLoading(false);
    }
  };

  // 根据分数计算标签
  const getScoreTag = (scoringData: ScoringData | null) => {
    if (!scoringData) return null;
    
    const averageScore = scoringData.calculation.average_score;
    const attendanceScore = scoringData.dimensions.attendance?.score || 0;
    const statusScore = scoringData.dimensions.live_status?.score || 0;
    
    // IFS(OR([场次评分]<5,[出勤分数]=0,[状态分数]=0),"还需努力",AND([场次评分]>=5,[场次评分]<8),"符合预期",[场次评分]>=8,"表现卓越")
    if (averageScore < 5 || attendanceScore === 0 || statusScore === 0) {
      return { text: '还需努力', color: 'red' };
    } else if (averageScore >= 5 && averageScore < 8) {
      return { text: '符合预期', color: 'orange' };
    } else if (averageScore >= 8) {
      return { text: '表现卓越', color: 'green' };
    }
    
    return null;
  };

  const handleSubmit = async () => {
    setLoading(true);
    try {
      // 模拟提交评分
      await new Promise(resolve => setTimeout(resolve, 1000));
      message.success('评分提交成功');
      setIsEditing(false);
    } catch (error) {
      message.error('评分提交失败');
    } finally {
      setLoading(false);
    }
  };

  const renderScoringForm = () => (
    <div className="scoring-form">
      <div className="dimensions-list">
        {mockScoringDimensions.map(dimension => (
          <div key={dimension.dimension_code} className="dimension-row">
            <div className="dimension-label">
              {dimension.dimension_name}
            </div>
            <div className="dimension-select">
              <Select
                value={scoringData?.dimensions[dimension.dimension_code]?.selected_option}
                onChange={(value) => handleDimensionChange(dimension.dimension_code, value)}
                placeholder={`请选择${dimension.dimension_name}选项`}
                disabled={!isEditing}
                size="small"
                style={{ width: '100%' }}
              >
                {dimension.options.map((option: ScoringOption) => (
                  <Option key={option.code} value={option.code}>
                    {option.text}
                  </Option>
                ))}
              </Select>
            </div>
          </div>
        ))}
      </div>

      {scoringData?.metadata.evaluation_notes && !isEditing && (
        <div className="evaluation-notes-display">
          <div className="notes-label">评分备注</div>
          <div className="notes-content">
            {scoringData.metadata.evaluation_notes}
          </div>
        </div>
      )}

      {isEditing && (
        <div className="dimension-row evaluation-row">
          <div className="dimension-label">
            评分备注
          </div>
          <div className="dimension-select">
            <TextArea 
              rows={3}
              placeholder="请输入评分备注..."
              value={scoringData?.metadata.evaluation_notes || ''}
              onChange={(e) => {
                if (scoringData) {
                  setScoringData({
                    ...scoringData,
                    metadata: {
                      ...scoringData.metadata,
                      evaluation_notes: e.target.value
                  }
                  });
                }
              }}
              style={{ width: '100%' }}
            />
          </div>
        </div>
      )}

      {scoringData && (
        <div className="scoring-result">
          <div className="result-label">评分结果</div>
          <div className="result-score">
            <span className="score-number">{scoringData.calculation.average_score.toFixed(1)}</span>
            <span className="score-unit">分</span>
          </div>
        </div>
      )}
    </div>
  );



  const renderScheduleInfo = () => (
    <div className="schedule-info">
      <div className="info-row">
        <div className="info-item">
          <CalendarOutlined className="info-icon" />
          <span className="info-text">日期：{schedule?.date}</span>
        </div>
        <div className="info-item">
          <ClockCircleOutlined className="info-icon" />
          <span className="info-text">时段：{schedule?.timeSlotId}</span>
        </div>
      </div>
      <div className="info-row">
        <div className="info-item">
          <UserOutlined className="info-icon" />
          <span className="info-text">
            参与人：{schedule?.participantIds?.map((id: number) => mockUsers[id as keyof typeof mockUsers]?.name).filter(Boolean).join('、') || '无'}
          </span>
        </div>
        {schedule?.scoring_status === 'scored' || schedule?.scoring_status === 'approved' ? (
          <div className="status-item">
            <Tag color={getScoreTag(scoringData)?.color} className="status-tag">
              {getScoreTag(scoringData)?.text}
            </Tag>
          </div>
        ) : (
          <div className="status-item">
            <Tag color="default" className="status-tag">
              未评分
            </Tag>
          </div>
        )}
      </div>
    </div>
  );

  const renderActions = () => {
    if (!scoringData) {
      return (
        <Button type="primary" onClick={() => setIsEditing(true)}>
          开始评分
        </Button>
      );
    }

    if (schedule?.scoring_status === 'approved') {
      return (
        <Button onClick={() => setIsEditing(true)}>
          编辑评分
        </Button>
      );
    }

    if (isEditing) {
      return (
        <Space>
          <Button onClick={() => setIsEditing(false)}>
            取消
          </Button>
          <Button type="primary" loading={loading} onClick={handleSave}>
            保存评分
          </Button>
          <Button type="primary" loading={loading} onClick={handleSubmit}>
            提交评分
          </Button>
        </Space>
      );
    }

    return (
      <Button type="primary" onClick={() => setIsEditing(true)}>
        编辑评分
      </Button>
    );
  };

  return (
    <Drawer
      title={
        <Space>
          <StarOutlined />
          <span>直播评分</span>
        </Space>
      }
      placement="right"
      width={500}
      open={visible}
      onClose={onClose}
      extra={renderActions()}
    >
      {schedule && (
        <div style={{ padding: '0 16px' }}>
          {renderScheduleInfo()}
          
          {scoringData ? (
            <>
              {renderScoringForm()}
            </>
          ) : (
            <div className="empty-scoring">
              <StarOutlined className="empty-icon" />
              <div className="empty-text">暂无评分数据</div>
            </div>
          )}
        </div>
      )}
    </Drawer>
  );
};

export default LiveStreamScoringDrawer; 