import React, { useState, useEffect } from 'react';
import { Drawer, Select, Input, Button, Tag, Space, message } from 'antd';
import { StarOutlined, UserOutlined, CalendarOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import { 
  getScoringDimensions, 
  getScoringOptions, 
  getLiveStreamScheduleScoring,
  saveScoringData,
  updateScoringStatus,
  type ScoringDimension,
  type ScoringOption,
  type ScoringData,
  type LiveStreamScheduleWithScoring
} from '../api/scoringApi';
import { useUser } from '../context/UserContext';
import type { LiveStreamSchedule } from '../types/liveStream';
import './LiveStreamScoringDrawer.css';
import { toBeijingDateStr } from '../utils/timeUtils';

const { TextArea } = Input;
const { Option } = Select;

interface LiveStreamScoringDrawerProps {
  visible: boolean;
  schedule: LiveStreamSchedule | null;
  onClose: () => void;
  onRefresh?: () => void;
}

const LiveStreamScoringDrawer: React.FC<LiveStreamScoringDrawerProps> = ({
  visible,
  schedule,
  onClose,
  onRefresh
}) => {
  const [scoringData, setScoringData] = useState<ScoringData | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [loading, setLoading] = useState(false);
  const [dimensions, setDimensions] = useState<ScoringDimension[]>([]);
  const [options, setOptions] = useState<ScoringOption[]>([]);
  const [evaluationNotes, setEvaluationNotes] = useState('');
  const [scheduleWithScoring, setScheduleWithScoring] = useState<LiveStreamScheduleWithScoring | null>(null);
  const { profile } = useUser();

  // 加载评分维度和选项
  useEffect(() => {
    const loadScoringConfig = async () => {
      try {
        const [dimensionsData, optionsData] = await Promise.all([
          getScoringDimensions(),
          getScoringOptions()
        ]);
        setDimensions(dimensionsData);
        setOptions(optionsData);
      } catch (error) {
        console.error('加载评分配置失败:', error);
        message.error('加载评分配置失败');
      }
    };

    if (visible) {
      loadScoringConfig();
    }
  }, [visible]);

  // 加载评分数据
  useEffect(() => {
    const loadScoringData = async () => {
      if (!schedule || !visible) return;

      console.log('加载评分数据 - 日程:', schedule);
      console.log('加载评分数据 - 日程ID:', schedule.id);

      try {
        setLoading(true);
        const scheduleData = await getLiveStreamScheduleScoring(parseInt(schedule.id));
        
        console.log('获取到的评分数据:', scheduleData);
        
        if (scheduleData) {
          setScheduleWithScoring(scheduleData);
          if (scheduleData.scoring_data) {
            // 如果scoring_data是字符串，需要解析为对象
            let parsedScoringData;
            try {
              parsedScoringData = typeof scheduleData.scoring_data === 'string' 
                ? JSON.parse(scheduleData.scoring_data) 
                : scheduleData.scoring_data;
              setScoringData(parsedScoringData);
              setEvaluationNotes(parsedScoringData.metadata?.evaluation_notes || '');
            } catch (error) {
              console.error('解析评分数据失败:', error);
              setScoringData(null);
              setEvaluationNotes('');
            }
          } else {
            setScoringData(null);
            setEvaluationNotes('');
          }
        } else {
          // 如果没有找到评分数据，创建基础数据结构
          const baseScheduleData = {
            id: parseInt(schedule.id),
            date: schedule.date,
            time_slot_id: schedule.timeSlotId,
            created_by: schedule.createdBy || 0,
            average_score: null,
            scoring_status: null,
            scored_by: null,
            scored_at: null,
            scoring_data: null
          };
          console.log('创建基础数据结构:', baseScheduleData);
          setScheduleWithScoring(baseScheduleData);
          setScoringData(null);
          setEvaluationNotes('');
        }
        setIsEditing(false);
      } catch (error) {
        console.error('加载评分数据失败:', error);
        message.error('加载评分数据失败');
      } finally {
        setLoading(false);
      }
    };

    loadScoringData();
  }, [schedule, visible]);

  // 获取维度选项
  const getDimensionOptions = (dimensionCode: string): ScoringOption[] => {
    return options.filter(option => option.dimension_code === dimensionCode);
  };

  // 创建初始评分数据
  const createInitialScoringData = (): ScoringData => {
    return {
      scoring_version: '1.0',
      evaluator_id: profile?.id || 0,
      evaluation_date: toBeijingDateStr(dayjs()),
      dimensions: {},
      calculation: {
        total_score: 0,
        average_score: 0,
        weighted_average: 0
      },
      metadata: {
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        evaluation_notes: ''
      }
    };
  };

  // 处理维度选择变化
  const handleDimensionChange = (dimensionCode: string, optionCode: string) => {
    console.log('处理维度选择变化:', { dimensionCode, optionCode });
    
    const dimension = dimensions.find(d => d.dimension_code === dimensionCode);
    const option = options.find(o => o.option_code === optionCode && o.dimension_code === dimensionCode);
    
    if (!dimension || !option) {
      console.error('未找到维度或选项:', { dimensionCode, optionCode, dimension, option });
      return;
    }

    const currentData = scoringData || createInitialScoringData();
    
    // 确保dimensions对象存在
    const currentDimensions = currentData.dimensions || {};
    
    // 验证维度代码是否有效
    if (!dimensionCode || typeof dimensionCode !== 'string') {
      console.error('无效的维度代码:', dimensionCode);
      return;
    }
    
    const newData: ScoringData = {
      ...currentData,
      evaluator_id: profile?.id || 0,
      dimensions: {
        ...currentDimensions,
        [dimensionCode]: {
          selected_option: optionCode,
          score: option.score,
          notes: option.option_text
        }
      },
      calculation: calculateScores({
        ...currentDimensions,
        [dimensionCode]: {
          selected_option: optionCode,
          score: option.score,
          notes: option.option_text
        }
      }, dimensions),
      metadata: {
        ...currentData.metadata,
        updated_at: new Date().toISOString(),
        evaluation_notes: evaluationNotes
      }
    };

    console.log('维度选择变化 - 新数据:', JSON.stringify(newData, null, 2));
    setScoringData(newData);
  };

  // 计算评分
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

  // 开始评分
  const handleStartScoring = () => {
    console.log('开始评分 - 用户ID:', profile?.id);
    console.log('开始评分 - 日程ID:', schedule?.id);
    const initialData = createInitialScoringData();
    console.log('初始评分数据:', initialData);
    setScoringData(initialData);
    setIsEditing(true);
  };

  // 保存评分
  const handleSave = async () => {
    if (!schedule || !scoringData || !profile?.id) return;

    setLoading(true);
    try {
      // 更新评分数据中的备注
      const updatedScoringData = {
        ...scoringData,
        metadata: {
          ...scoringData.metadata,
          evaluation_notes: evaluationNotes,
          updated_at: new Date().toISOString()
        }
      };

      console.log('准备保存的评分数据:', JSON.stringify(updatedScoringData, null, 2));

      await saveScoringData(parseInt(schedule.id), updatedScoringData, profile.id);
      await updateScoringStatus(parseInt(schedule.id), 'scored');
      
      message.success('评分保存成功');
      setIsEditing(false);
      onRefresh?.();
    } catch (error) {
      console.error('保存评分失败:', error);
      message.error('评分保存失败');
    } finally {
      setLoading(false);
    }
  };

  // 提交评分
  const handleSubmit = async () => {
    if (!schedule || !scoringData || !profile?.id) return;

    setLoading(true);
    try {
      // 更新评分数据中的备注
      const updatedScoringData = {
        ...scoringData,
        metadata: {
          ...scoringData.metadata,
          evaluation_notes: evaluationNotes,
          updated_at: new Date().toISOString()
        }
      };

      console.log('准备提交的评分数据:', JSON.stringify(updatedScoringData, null, 2));

      await saveScoringData(parseInt(schedule.id), updatedScoringData, profile.id);
      await updateScoringStatus(parseInt(schedule.id), 'approved');
      
      message.success('评分提交成功');
      setIsEditing(false);
      onRefresh?.();
    } catch (error) {
      console.error('提交评分失败:', error);
      message.error('评分提交失败');
    } finally {
      setLoading(false);
    }
  };

  // 根据分数计算标签
  const getScoreTag = (scoringData: ScoringData | null) => {
    if (!scoringData) return null;
    
    const score = scoringData.calculation.weighted_average;
    if (score >= 8.0) return <Tag color="green">优秀</Tag>;
    if (score >= 6.0) return <Tag color="blue">良好</Tag>;
    if (score >= 4.0) return <Tag color="orange">一般</Tag>;
    return <Tag color="red">需改进</Tag>;
  };

  // 渲染评分表单
  const renderScoringForm = () => (
    <div className="scoring-form">
      <div className="dimensions-list">
        {dimensions.map(dimension => (
          <div key={dimension.dimension_code} className="dimension-row">
            <div className="dimension-label">
              {dimension.dimension_name}
              <span className="dimension-weight">(权重: {dimension.weight})</span>
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
                {getDimensionOptions(dimension.dimension_code).map((option) => (
                  <Option key={option.option_code} value={option.option_code}>
                    {option.option_text} ({option.score}分)
                  </Option>
                ))}
              </Select>
            </div>
          </div>
        ))}
      </div>

      {isEditing && (
        <div className="dimension-row evaluation-row">
          <div className="dimension-label">评分备注</div>
          <div className="dimension-select">
            <TextArea
              value={evaluationNotes}
              onChange={(e) => setEvaluationNotes(e.target.value)}
              placeholder="请输入评分备注..."
              rows={3}
            />
          </div>
        </div>
      )}

      {scoringData?.metadata.evaluation_notes && !isEditing && (
        <div className="evaluation-notes-display">
          <div className="notes-label">评分备注</div>
          <div className="notes-content">
            {scoringData.metadata.evaluation_notes}
          </div>
        </div>
      )}
    </div>
  );

  // 渲染日程信息
  const renderScheduleInfo = () => (
    <div className="schedule-info">
      <div className="info-row" style={{ justifyContent: 'flex-start' }}>
        <CalendarOutlined style={{ marginRight: '8px' }} />
        <span>{dayjs(schedule?.date).format('YYYY-MM-DD')} {schedule?.timeSlotId === 'morning-10-12' ? '10-12点' : 
          schedule?.timeSlotId === 'afternoon-14-16' ? '14-16点' :
          schedule?.timeSlotId === 'afternoon-16-18' ? '16-18点' :
          schedule?.timeSlotId === 'evening-19-21' ? '19-21点' :
          schedule?.timeSlotId === 'evening-21-23' ? '21-23点' : schedule?.timeSlotId}</span>
      </div>
      {schedule?.managers && schedule.managers.length > 0 && (
        <div className="info-row" style={{ justifyContent: 'flex-start' }}>
          <UserOutlined style={{ marginRight: '8px' }} />
          <span>参与人: {schedule.managers.map((manager: any) => manager.name).join(' / ')}</span>
        </div>
      )}
    </div>
  );

  // 渲染操作按钮
  const renderActions = () => {
    if (!scoringData) {
      return (
        <Button type="primary" onClick={handleStartScoring}>
          开始评分
        </Button>
      );
    }

    if (scheduleWithScoring?.scoring_status === 'approved') {
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
        <div style={{ padding: '0 16px', height: '100%', display: 'flex', flexDirection: 'column' }}>
          {renderScheduleInfo()}
          
          <div style={{ flex: 1, overflow: 'auto' }}>
            {loading ? (
              <div className="loading-scoring">
                <div className="loading-text">加载中...</div>
              </div>
            ) : scoringData ? (
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

          {/* 底部备注和总分区域 */}
          {scoringData && (
            <div style={{ 
              borderTop: '1px solid #f0f0f0', 
              paddingTop: '16px', 
              marginTop: '16px',
              padding: '16px'
            }}>
              {/* 总分显示 */}
              {scoringData.calculation && (
                <div>
                  <div style={{ 
                    display: 'flex', 
                    justifyContent: 'space-between', 
                    alignItems: 'center'
                  }}>
                    <div style={{ 
                      fontWeight: 'bold', 
                      color: '#333',
                      fontSize: '16px'
                    }}>
                      综合评分
                    </div>
                    <div style={{ 
                      display: 'flex', 
                      alignItems: 'center',
                      gap: '8px'
                    }}>
                      <span style={{ 
                        fontSize: '18px', 
                        fontWeight: 'bold',
                        color: '#1890ff'
                      }}>
                        {scoringData.calculation.weighted_average?.toFixed(1) || '0.0'}
                      </span>
                      <span style={{ color: '#666', fontSize: '14px' }}>分</span>
                      {getScoreTag(scoringData)}
                    </div>
                  </div>
                  {scheduleWithScoring?.evaluator_name && (
                    <div style={{ 
                      marginTop: '4px',
                      fontSize: '12px',
                      color: '#999',
                      textAlign: 'left'
                    }}>
                      评分人: {scheduleWithScoring.evaluator_name}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </Drawer>
  );
};

export default LiveStreamScoringDrawer; 