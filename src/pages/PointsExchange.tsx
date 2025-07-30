import { useEffect, useState, useRef, useMemo } from 'react';
import { getExchangeGoods, exchangeGoodsItem, filterPointsTransactions } from '../api/pointsApi';
import { useUser } from '../context/UserContext';
import { Button, Typography, Tag, message, Alert, Spin, Table, Modal } from 'antd';
import { LoadingOutlined, UserOutlined, TrophyFilled, GiftFilled, StarFilled, ExclamationCircleOutlined, WalletOutlined } from '@ant-design/icons';
import type { ColumnsType, TableProps } from 'antd/es/table';
import { AchievementSystem } from '../components/AchievementSystem';
import Lottie from 'lottie-react';
import './PointsExchange.css';
import { supabase } from '../supaClient';

const { Text } = Typography;

interface Transaction {
  id: number;
  points_change: number;
  balance_after: number;
  transaction_type: string;
  source_type: string;
  description: string;
  created_at: string;
}

interface ExchangeGoods {
  id: string;
  name: string;
  description: string;
  category: string;
  points_cost: number;
  icon: string;
  icon_type: string;
  icon_url: string;
  color: string;
  is_active: boolean;
  is_featured: boolean;
  sort_order: number;
  exchange_limit: number | null;
  daily_limit: number | null;
  can_exchange: boolean;
  remaining_daily_limit: number | null;
}

export default function PointsExchange() {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [exchangeGoods, setExchangeGoods] = useState<ExchangeGoods[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [userPoints, setUserPoints] = useState<number>(0);
  const [profileId, setProfileId] = useState<number | null>(null);
  const [activeTab, setActiveTab] = useState('achievements');
  const [pointsAnimation, setPointsAnimation] = useState<any>(null);
  const [coinAnimation, setCoinAnimation] = useState<any>(null);
  const [isHovering, setIsHovering] = useState(false);
  const [exchanging, setExchanging] = useState<string | null>(null); // 添加兑换状态，记录正在兑换的商品ID
  const [confirmModal, setConfirmModal] = useState<{
    visible: boolean;
    goodsId: string;
    pointsRequired: number;
    description: string;
    goodsName: string;
  }>({
    visible: false,
    goodsId: '',
    pointsRequired: 0,
    description: '',
    goodsName: ''
  });


  const lottieRef = useRef<any>(null);
  const animationPlayedRef = useRef(false);
  const { profile } = useUser();

  useEffect(() => {
    if (profile?.id) {
      setProfileId(profile.id);
    }
  }, [profile]);

  useEffect(() => {
    if (profileId) {
      loadUserPoints(profileId);
      loadTransactions(profileId);
      loadExchangeGoods(profileId);
    }
  }, [profileId]);

  // 标签页切换时重置动画状态
  useEffect(() => {
    animationPlayedRef.current = false;
    setIsHovering(false);
    if (lottieRef.current) {
      lottieRef.current.goToAndStop(0, true);
    }
  }, [activeTab]);

  // 加载积分动画数据
  useEffect(() => {
    fetch('/points.json')
      .then(response => response.json())
      .then(data => setPointsAnimation(data))
      .catch(err => console.error('加载积分动画失败:', err));
  }, []);

  // 加载金币动画数据
  useEffect(() => {
    fetch('/coin.json')
      .then(response => response.json())
      .then(data => setCoinAnimation(data))
      .catch(err => console.error('加载金币动画失败:', err));
  }, []);

  const loadUserPoints = async (id: number) => {
    
    try {
      // 临时直接查询数据库，避免使用可能有问题的函数
      const { data, error } = await supabase
        .from('user_points_wallet')
        .select('total_points')
        .eq('user_id', id)
        .single();
      
      if (error) {
        console.error('直接查询积分失败:', error);
        throw error;
      }
      
      setUserPoints(data.total_points);
    } catch (err) {
      console.error('获取用户积分失败:', err);
      console.error('错误详情:', {
        message: err instanceof Error ? err.message : '未知错误',
        stack: err instanceof Error ? err.stack : undefined
      });
    }
    
  };

  const loadTransactions = async (id: number) => {
    try {
      setLoading(true);
      const data = await filterPointsTransactions(id, {
        orderBy: 'created_at',
        ascending: false,
        limit: 50
      });
      setTransactions(data);
    } catch (err) {
      console.error('加载积分明细失败:', err);
      console.error('错误详情:', {
        message: err instanceof Error ? err.message : '未知错误',
        stack: err instanceof Error ? err.stack : undefined
      });
      setError(err instanceof Error ? err.message : '加载积分明细失败');
    } finally {
      setLoading(false);
    }
  };

  const loadExchangeGoods = async (id: number) => {
    
    try {
      const data = await getExchangeGoods(undefined, id);
      setExchangeGoods(data);
    } catch (err) {
    }
  };

  const handleExchange = async (goodsId: string, pointsRequired: number, description: string, goodsName: string) => {
    // 防止重复点击
    if (exchanging) {
      return;
    }

    // 检查是否为带看直通卡，如果是则显示确认弹窗
    const isDirectCard = goodsName.includes('带看直通卡') || goodsName.includes('带看卡');
    
    if (isDirectCard) {
      setConfirmModal({
        visible: true,
        goodsId,
        pointsRequired,
        description,
        goodsName
      });
      return;
    }

    // 非带看卡直接执行兑换
    await executeExchange(goodsId, pointsRequired, description);
  };

  const executeExchange = async (goodsId: string, pointsRequired: number, description: string) => {
    try {
      setExchanging(goodsId); // 设置兑换状态

      if (!profileId) {
        console.error('兑换失败: profileId 为空');
        message.error('用户信息获取失败');
        return;
      }

      const result = await exchangeGoodsItem(profileId, goodsId, description);
      
      if (result.success) {
        // 显示兑换成功消息
        let successMessage = `兑换成功！消耗 ${result.points_used} 积分`;
        
        // 如果有奖励发放，添加奖励信息
        if (result.reward_issued) {
          let rewardText = '';
          switch (result.reward_type) {
            case 'direct':
              rewardText = '带看直通卡';
              break;
            case 'gift':
              rewardText = '礼品';
              break;
            case 'privilege':
              rewardText = '特权';
              break;
            case 'achievement':
              rewardText = '成就';
              break;
            default:
              rewardText = '奖励';
          }
          successMessage += `，已发放${rewardText}`;
        }
        
        message.success(successMessage);
        
        await loadUserPoints(profileId);
        await loadTransactions(profileId);
        await loadExchangeGoods(profileId);
      } else {
        console.error('兑换失败:', result.error);
        message.error(`兑换失败：${result.error}`);
      }
    } catch (err) {
      console.error('兑换过程中发生异常:', err);
      console.error('异常详情:', {
        message: err instanceof Error ? err.message : '未知错误',
        stack: err instanceof Error ? err.stack : undefined
      });
      message.error('兑换失败：' + (err instanceof Error ? err.message : '未知错误'));
    } finally {
      setExchanging(null); // 清除兑换状态
    }
  };

  const handleConfirmExchange = async () => {
    const { goodsId, pointsRequired, description } = confirmModal;
    setConfirmModal({ ...confirmModal, visible: false });
    await executeExchange(goodsId, pointsRequired, description);
  };

  const handleCancelExchange = () => {
    setConfirmModal({ ...confirmModal, visible: false });
  };



  // 表格列定义
  const columns: ColumnsType<Transaction> = useMemo(() => {
    // 从实际数据中动态生成筛选选项
    const uniqueTransactionTypes = [...new Set(transactions.map(t => t.transaction_type))];
    const uniqueSourceTypes = [...new Set(transactions.map(t => t.source_type))];
    
    const transactionTypeFilters = uniqueTransactionTypes.map(type => ({
      text: type === 'EARN' ? '获得积分' : type === 'EXCHANGE' ? '积分兑换' : type === 'DEDUCT' ? '积分扣除' : type,
      value: type
    }));
    
    const sourceTypeFilters = uniqueSourceTypes.map(sourceType => ({
      text: sourceType === 'FOLLOWUP' ? '跟进任务' :
            sourceType === 'DEAL' ? '成交订单' :
            sourceType === 'SIGNIN' ? '每日签到' :
            sourceType === 'EXCHANGE_LEAD' ? '兑换线索' :
            sourceType === 'ALLOCATION_LEAD' ? '线索分配' :
            sourceType === 'ROLLBACK_REFUND' ? '积分回退' :
            sourceType === 'MANUAL_ADJUST' ? '手动调整' :
            sourceType === 'POINTS_ADJUST' ? '积分调整' : sourceType,
      value: sourceType
    }));

    return [
      {
        title: '时间',
        dataIndex: 'created_at',
        key: 'created_at',
        sorter: (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
        defaultSortOrder: 'descend',
        render: (text) => (
          <div>
            <div className="exchange-time-date">
              {new Date(text).toLocaleDateString()}
            </div>
            <div className="exchange-time-time">
              {new Date(text).toLocaleTimeString()}
            </div>
          </div>
        ),
      },
      {
        title: '交易类型',
        dataIndex: 'transaction_type',
        key: 'transaction_type',
        filters: transactionTypeFilters,
        onFilter: (value, record) => record.transaction_type === value,
        render: (text) => {
          const color = text === 'EARN' ? 'green' : text === 'EXCHANGE' ? 'blue' : 'red';
          const label = text === 'EARN' ? '获得' : text === 'EXCHANGE' ? '兑换' : '扣分';
          return <Tag color={color} className="exchange-tag">{label}</Tag>;
        },
      },
      {
        title: '来源类型',
        dataIndex: 'source_type',
        key: 'source_type',
        filters: sourceTypeFilters,
        onFilter: (value, record) => record.source_type === value,
        render: (text) => {
          const label = text === 'FOLLOWUP' ? '跟进' :
                       text === 'DEAL' ? '成交' :
                       text === 'SIGNIN' ? '签到' :
                       text === 'EXCHANGE_LEAD' ? '兑换线索' :
                       text === 'ALLOCATION_LEAD' ? '线索分配' :
                       text === 'ROLLBACK_REFUND' ? '积分回退' :
                       text === 'MANUAL_ADJUST' ? '手动调整' :
                       text === 'POINTS_ADJUST' ? '积分调整' : text;
          return <Tag color="default" className="exchange-tag">{label}</Tag>;
        },
      },
      {
        title: '积分变动',
        dataIndex: 'points_change',
        key: 'points_change',
        sorter: (a, b) => a.points_change - b.points_change,
        render: (text) => (
          <Text type={text > 0 ? 'success' : 'danger'} strong className="exchange-points-text">
            {text > 0 ? '+' : ''}{text}
          </Text>
        ),
      },
      {
        title: '余额',
        dataIndex: 'balance_after',
        key: 'balance_after',
        sorter: (a, b) => a.balance_after - b.balance_after,
        render: (text) => <Text strong>{text}</Text>,
      },
      {
        title: '说明',
        dataIndex: 'description',
        key: 'description',
        ellipsis: true,
        render: (text) => (
          <Text type="secondary" ellipsis={{ tooltip: text }}>
            {text || '无'}
          </Text>
        ),
      },
    ];
  }, [transactions]);

  // 表格变化处理
  const handleTableChange: TableProps<Transaction>['onChange'] = (pagination, filters, sorter) => {
  };

  // 渲染积分兑换内容
  const renderPointsExchange = () => (
    <div className="exchange-wrapper">
      {/* 兑换选项 */}
      <div className="exchange-cards-container">
        {exchangeGoods.map((goods) => (
          <div key={goods.id} className="exchange-card-wrapper">
            <div className="exchange-card">
              <div className="exchange-icon lead">
                {goods.icon_type === 'emoji' ? (
                  <span style={{ fontSize: '24px' }}>{goods.icon}</span>
                ) : goods.icon_url ? (
                  <img src={goods.icon_url} alt={goods.name} style={{ width: '24px', height: '24px' }} />
                ) : (
                  <UserOutlined />
                )}
              </div>
              
              <div className={`price-tag ${goods.category.toLowerCase()} font-bitcount`}>
                {goods.points_cost}
                <img 
                  src="/coin2.svg" 
                  alt="coin" 
                  className="coin-icon"
                  style={{ width: 36, height: 36 }}
                />
              </div>
              <div className={`exchange-title ${goods.category.toLowerCase()}`}>
                {goods.name}
              </div>
              <div className="exchange-description">
                {goods.description}
              </div>
              
              {/* 显示每日限制信息 */}
              {goods.daily_limit && (
                <div style={{ 
                  fontSize: '11px', 
                  color: 'rgba(101, 67, 33, 0.5)', 
                  marginTop: '4px',
                  marginBottom: '8px'
                }}>
                  每日限制: {goods.remaining_daily_limit}/{goods.daily_limit}
                </div>
              )}
              
              <button
                className={`exchange-button ${!goods.can_exchange || userPoints < goods.points_cost || exchanging === goods.id ? 'disabled' : ''}`}
                disabled={!goods.can_exchange || userPoints < goods.points_cost || exchanging === goods.id}
                onClick={() => handleExchange(goods.id, goods.points_cost, `兑换${goods.name}`, goods.name)}
              >
                {exchanging === goods.id ? '兑换中...' :
                 !goods.can_exchange ? '已达限制' : 
                 userPoints >= goods.points_cost ? '立即兑换' : '积分不足'}
              </button>
            </div>
          </div>
        ))}
        
        {/* 如果商品数量不足3个，添加空白占位 */}
        {exchangeGoods.length < 3 && (
          <div className="exchange-card-wrapper empty-slot">
          </div>
        )}
      </div>
    </div>
  );

  // 渲染积分明细内容
  const renderTransactions = () => (
    <div className="exchange-records-container">
      
      {transactions.length > 0 ? (
        <Table
          className="exchange-records-table"
          dataSource={transactions}
          columns={columns}
          onChange={handleTableChange}
          pagination={{
            pageSize: 15,
            showSizeChanger: true,
            showQuickJumper: true,
            showTotal: (total, range) => `第 ${range[0]}-${range[1]} 条，共 ${total} 条`,
            size: 'small'
          }}
          size="small"
          rowKey="id"
        />
      ) : (
        <div className="empty-state-enhanced">
          <div className="empty-state-icon">
            <WalletOutlined />
          </div>
          <div className="empty-state-content">
            <h3 className="empty-state-title">暂无积分明细</h3>
            <p className="empty-state-description">
              您还没有积分变动记录，完成以下操作即可获得积分：
            </p>
            <div className="empty-state-tips">
              <div className="tip-item">
                <GiftFilled className="tip-icon" />
                <span>参与直播</span>
              </div>
              <div className="tip-item">
                <StarFilled className="tip-icon" />
                <span>完成新人勤奋度任务</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );

  if (loading) {
    return (
      <div className="loading-container">
        <Spin size="default" indicator={<LoadingOutlined className="loading-icon" spin />} />
      </div>
    );
  }

  if (error) {
    return (
      <Alert
        message="加载失败"
        description={error}
        type="error"
        showIcon
        action={
          <Button size="small" danger onClick={() => profileId && loadTransactions(profileId)}>
            重试
          </Button>
        }
        className="alert-margin"
      />
    );
  }

  return (
    <div className="points-exchange-container">

      
      {/* 顶部积分统计 */}
      <div className="points-summary-card">
        <div className="points-summary-content">
          <div className="points-info">
            <div className="points-value">
              {coinAnimation && (
                <Lottie 
                  animationData={coinAnimation} 
                  style={{ width: 50, height: 50, marginRight: 6, marginBottom: 12 }}
                  loop={true}
                  autoplay={true}
                />
              )}
              {userPoints}
            </div>
            <div className="points-label">剩余积分</div>
          </div>
          <div 
            className="points-icon-container"
            onMouseEnter={() => {
              if (!isHovering && !animationPlayedRef.current) {
                setIsHovering(true);
                animationPlayedRef.current = true;
                if (lottieRef.current) {
                  lottieRef.current.play();
                }
              }
            }}
            onMouseLeave={() => {
              setIsHovering(false);
              // 不立即停止，让动画自然完成
            }}
          >
            {pointsAnimation && (
              <Lottie 
                lottieRef={lottieRef}
                animationData={pointsAnimation} 
                className="points-animation"
                loop={false}
                autoplay={false}
                onComplete={() => {
                  // 动画完成后重置状态
                  animationPlayedRef.current = false;
                  if (lottieRef.current) {
                    lottieRef.current.goToAndStop(0, true);
                  }
                }}
                onLoad={() => {
                }}
              />
            )}
          </div>
        </div>
      </div>

      {/* 标签页内容 */}
      <div className="main-content-card">
        <div className="custom-tabs">
          <div className="tab-nav">
            <button 
              className={`tab-button ${activeTab === 'achievements' ? 'active' : ''}`}
              onClick={() => setActiveTab('achievements')}
            >
              <span className="tab-text">
                <TrophyFilled className="tab-icon achievement" />
                我的成就
              </span>
            </button>
            
            <button 
              className={`tab-button ${activeTab === 'exchange' ? 'active' : ''}`}
              onClick={() => setActiveTab('exchange')}
            >
              <span className="tab-text">
                <GiftFilled className="tab-icon exchange" />
                积分兑换
              </span>
            </button>
            
            <button 
              className={`tab-button ${activeTab === 'records' ? 'active' : ''}`}
              onClick={() => setActiveTab('records')}
            >
              <span className="tab-text">
                <StarFilled className="tab-icon records" />
                积分明细
              </span>
            </button>
          </div>
          
          <div className="tab-content">
            {activeTab === 'achievements' && (
              <div className="tab-pane active">
                <AchievementSystem showHeader={false} />
              </div>
            )}
            
            {activeTab === 'exchange' && (
              <div className="tab-pane active">
                {renderPointsExchange()}
              </div>
            )}
            
            {activeTab === 'records' && (
              <div className="tab-pane active">
                {renderTransactions()}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 带看直通卡确认弹窗 */}
      <Modal
        title={
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <ExclamationCircleOutlined style={{ color: '#faad14' }} />
            <span>确认兑换</span>
          </div>
        }
        open={confirmModal.visible}
        onCancel={handleCancelExchange}
        footer={null}
        width={480}
        className="confirm-modal-glass"
        styles={{
          mask: {
            backgroundColor: 'rgba(0, 0, 0, 0.1)',
            backdropFilter: 'blur(4px)',
            WebkitBackdropFilter: 'blur(4px)'
          }
        }}
      >
        <div style={{ padding: '16px 0' }}>
          <div style={{ fontSize: '16px', fontWeight: 500, marginBottom: '16px', color: '#262626' }}>
            是否使用 {confirmModal.pointsRequired} 积分兑换{confirmModal.goodsName}？
          </div>
          
          <div style={{ 
            backgroundColor: '#fff2f0', 
            border: '1px solid #ffccc7', 
            borderRadius: '6px', 
            padding: '12px 16px',
            marginBottom: '16px'
          }}>
            <div style={{ fontSize: '14px', color: '#ff4d4f', fontWeight: 500, marginBottom: '8px' }}>
              ⚠️ 重要提醒
            </div>
            <div style={{ fontSize: '13px', color: '#666', lineHeight: '1.5' }}>
              <div style={{ marginBottom: '6px' }}>• 带看佣金跳点为5%～15%</div>
              <div>• 带看直通卡发送至组长账户内</div>
            </div>
          </div>
          
          <div style={{ fontSize: '12px', color: '#999', lineHeight: '1.4' }}>
            兑换后将立即扣除相应积分，组长可在带看记录中查看自己的直通卡数量。
          </div>
          
          <div style={{ 
            display: 'flex', 
            justifyContent: 'flex-end', 
            gap: '12px', 
            marginTop: '24px'
          }}>
            <Button 
              onClick={handleCancelExchange}
              style={{ borderColor: '#d9d9d9' }}
            >
              取消
            </Button>
            <Button 
              type="primary"
              loading={exchanging === confirmModal.goodsId}
              onClick={handleConfirmExchange}
              style={{ backgroundColor: '#000000', borderColor: '#000000' }}
            >
              确认兑换
            </Button>
          </div>
        </div>
      </Modal>


    </div>
  );
} 