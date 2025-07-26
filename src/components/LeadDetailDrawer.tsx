import React, { useState, useEffect } from 'react';
import {
  Descriptions,
  Tag,
  Typography,
  Spin,
  Tabs,
  Card,
  Space,
  Button,
  message
} from 'antd';
import {
  UserOutlined,
  PhoneOutlined,
  WechatOutlined,
  EnvironmentOutlined,
  CalendarOutlined,
  EyeOutlined,
  CheckCircleOutlined,
  CopyOutlined
} from '@ant-design/icons';
import { supabase } from '../supaClient';
import dayjs from 'dayjs';
import './LeadDetailDrawer.css';

const { Text, Paragraph } = Typography;
const { TabPane } = Tabs;



interface LeadData {
  // leads表字段
  id: string;
  leadid: string;
  created_at: string;
  updata_at: string;
  phone: string;
  wechat: string;
  qq: string;
  location: string;
  budget: string;
  remark: string;
  source: string;
  douyinid: string;
  douyin_accountname: string;
  staffname: string;
  redbookid: string;
  area: string;
  notelink: string;
  campaignid: string;
  campaignname: string;
  unitid: string;
  unitname: string;
  creativedid: string;
  creativename: string;
  leadtype: string;
  traffictype: string;
  interactiontype: string;
  douyinleadid: string;
  leadstatus: string;
  
  // followups表字段
  followup_id?: string;
  followup_leadtype?: string;
  followupstage?: string;
  customerprofile?: string;
  worklocation?: string;
  userbudget?: string;
  moveintime?: string;
  userrating?: string;
  majorcategory?: string;
  followupresult?: string;
  scheduletime?: string;
  scheduledcommunity?: string;
  followup_created_at?: string;
  followup_updated_at?: string;
  interviewsales_user_id?: number;
  interviewsales_user_name?: string;
  
  // showings表字段
  showing_id?: string;
  showing_scheduletime?: string;
  showing_community?: string;
  arrivaltime?: string;
  showingsales?: number;
  showingsales_name?: string;
  trueshowingsales?: number;
  trueshowingsales_name?: string;
  viewresult?: string;
  showing_budget?: number;
  showing_moveintime?: string;
  showing_remark?: string;
  renttime?: number;
  showing_created_at?: string;
  showing_updated_at?: string;
  
  // deals表字段
  deal_id?: string;
  contractdate?: string;
  deal_community?: string;
  contractnumber?: string;
  roomnumber?: string;
  deal_created_at?: string;
  deal_updated_at?: string;
  // 新增：所有带看和成交记录
  showingsList?: any[];
  dealsList?: any[];
}

const LeadDetailDrawer: React.FC<{ leadid: string }> = ({ leadid }) => {
  const [loading, setLoading] = useState(false);
  const [leadData, setLeadData] = useState<LeadData | null>(null);

  // 获取线索详情数据
  const fetchLeadDetail = async () => {
    if (!leadid) return;
    setLoading(true);
    try {
      // 并发获取所有数据
      const [
        { data: leadsData, error: leadsError },
        { data: followupData },
        { data: showingsList },
        { data: dealsList }
      ] = await Promise.all([
        supabase.rpc('filter_leads', { p_leadid: leadid }),
        supabase.from('followups').select(`*, interviewsales_user:users_profile!followups_interviewsales_user_id_fkey(nickname)`).eq('leadid', leadid).single(),
        supabase.from('showings').select(`*, showingsales_user:users_profile!showings_showingsales_fkey(nickname), trueshowingsales_user:users_profile!showings_trueshowingsales_fkey(nickname)`).eq('leadid', leadid).order('created_at', { ascending: false }),
        supabase.from('deals').select('*').eq('leadid', leadid).order('created_at', { ascending: false })
      ]);

      if (leadsError) {
        message.error('获取线索详情失败: ' + leadsError.message);
        return;
      }

      if (leadsData && leadsData.length > 0) {
        const leadInfo = leadsData[0];
        // 获取最新带看信息
        const showingData = showingsList && showingsList.length > 0 ? showingsList[0] : null;
        // 获取最新成交信息
        const dealData = dealsList && dealsList.length > 0 ? dealsList[0] : null;

        // 合并数据
        const combinedData: LeadData = {
          ...leadInfo,
          // 跟进信息
          followup_id: followupData?.id,
          followup_leadtype: followupData?.leadtype,
          followupstage: followupData?.followupstage,
          customerprofile: followupData?.customerprofile,
          worklocation: followupData?.worklocation,
          userbudget: followupData?.userbudget,
          moveintime: followupData?.moveintime,
          userrating: followupData?.userrating,
          majorcategory: followupData?.majorcategory,
          followupresult: followupData?.followupresult,
          scheduletime: followupData?.scheduletime,
          scheduledcommunity: followupData?.scheduledcommunity,
          followup_created_at: followupData?.created_at,
          followup_updated_at: followupData?.updated_at,
          interviewsales_user_id: followupData?.interviewsales_user_id,
          interviewsales_user_name: followupData?.interviewsales_user?.nickname,
          // 最新带看信息
          showing_id: showingData?.id,
          showing_scheduletime: showingData?.scheduletime,
          showing_community: showingData?.community,
          arrivaltime: showingData?.arrivaltime,
          showingsales: showingData?.showingsales,
          showingsales_name: showingData?.showingsales_user?.nickname,
          trueshowingsales: showingData?.trueshowingsales,
          trueshowingsales_name: showingData?.trueshowingsales_user?.nickname,
          viewresult: showingData?.viewresult,
          showing_budget: showingData?.budget,
          showing_moveintime: showingData?.moveintime,
          showing_remark: showingData?.remark,
          renttime: showingData?.renttime,
          showing_created_at: showingData?.created_at,
          showing_updated_at: showingData?.updated_at,
          // 最新成交信息
          deal_id: dealData?.id,
          contractdate: dealData?.contractdate,
          deal_community: dealData?.community,
          contractnumber: dealData?.contractnumber,
          roomnumber: dealData?.roomnumber,
          deal_created_at: dealData?.created_at,
          deal_updated_at: dealData?.updated_at,
          // 所有带看和成交记录
          showingsList: showingsList || [],
          dealsList: dealsList || [],
        };
        setLeadData(combinedData);
      } else {
        message.warning('未找到该线索信息');
      }
    } catch (error) {
      message.error('获取线索详情失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (leadid) {
      fetchLeadDetail();
    }
  }, [leadid]);

  // 复制文本到剪贴板
  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text).then(() => {
      message.success(`${label}已复制到剪贴板`);
    }).catch(() => {
      message.error('复制失败');
    });
  };

  // 手机号脱敏
  const maskPhone = (phone: string) => {
    if (!phone) return '-';
    return phone.replace(/(\d{3})\d{4}(\d{4})/, '$1****$2');
  };

  // 微信号脱敏
  const maskWechat = (wechat: string) => {
    if (!wechat) return '-';
    if (wechat.length < 4) return wechat;
    return wechat.substring(0, 2) + '****' + wechat.substring(wechat.length - 2);
  };

  // 获取状态颜色
  const getStatusColor = (status: string) => {
    const colorMap: Record<string, string> = {
      '新建': 'green',
      '重复': 'orange',
      '待接收': 'blue',
      '确认需求': 'cyan',
      '邀约到店': 'purple',
      '已到店': 'magenta',
      '赢单': 'success',
      '丢单': 'error'
    };
    return colorMap[status] || 'default';
  };

  // 获取来源颜色
  const getSourceColor = (source: string) => {
    const colorMap: Record<string, string> = {
      '抖音': 'red',
      '小红书': 'pink',
      '微信': 'green',
      '电话': 'blue',
      '其他': 'default'
    };
    return colorMap[source] || 'default';
  };

  return (
    <Spin spinning={loading}>
      {leadData && (
        <Tabs defaultActiveKey="basic" size="large">
          {/* 基本信息 */}
          <TabPane 
            tab={
              <span>
                <UserOutlined />
                基本信息
              </span>
            } 
            key="basic"
          >
            <div>
              <Card title="线索基础信息" size="small">
                <Descriptions column={2} bordered size="small">
                  <Descriptions.Item label="线索编号" span={2}>
                    <Space>
                      <Text code>{leadData.leadid}</Text>
                      <Button 
                        type="link" 
                        size="small" 
                        icon={<CopyOutlined />}
                        onClick={() => copyToClipboard(leadData.leadid, '线索编号')}
                      >
                        复制
                      </Button>
                    </Space>
                  </Descriptions.Item>
                  
                  <Descriptions.Item label="手机号">
                    <Space>
                      <PhoneOutlined />
                      <Text>{maskPhone(leadData.phone)}</Text>
                      {leadData.phone && (
                        <Button 
                          type="link" 
                          size="small" 
                          icon={<CopyOutlined />}
                          onClick={() => copyToClipboard(leadData.phone, '手机号')}
                        >
                          复制
                        </Button>
                      )}
                    </Space>
                  </Descriptions.Item>
                  
                  <Descriptions.Item label="微信号">
                    <Space>
                      <WechatOutlined />
                      <Text>{maskWechat(leadData.wechat)}</Text>
                      {leadData.wechat && (
                        <Button 
                          type="link" 
                          size="small" 
                          icon={<CopyOutlined />}
                          onClick={() => copyToClipboard(leadData.wechat, '微信号')}
                        >
                          复制
                        </Button>
                      )}
                    </Space>
                  </Descriptions.Item>
                  
                  <Descriptions.Item label="QQ">
                    <Text>{leadData.qq || '-'}</Text>
                  </Descriptions.Item>
                  
                  <Descriptions.Item label="位置">
                    <Space>
                      <EnvironmentOutlined />
                      <Text>{leadData.location || '-'}</Text>
                    </Space>
                  </Descriptions.Item>
                  
                  <Descriptions.Item label="预算">
                    <Tag color="orange">{leadData.budget || '-'}</Tag>
                  </Descriptions.Item>
                  
                  <Descriptions.Item label="区域">
                    <Text>{leadData.area || '-'}</Text>
                  </Descriptions.Item>
                  
                  <Descriptions.Item label="来源">
                    <Tag color={getSourceColor(leadData.source)}>
                      {leadData.source || '-'}
                    </Tag>
                  </Descriptions.Item>
                  
                  <Descriptions.Item label="线索类型">
                    <Tag color="green">{leadData.leadtype || '-'}</Tag>
                  </Descriptions.Item>
                  
                  <Descriptions.Item label="线索状态">
                    <Tag color={getStatusColor(leadData.leadstatus)}>
                      {leadData.leadstatus || '-'}
                    </Tag>
                  </Descriptions.Item>
                  
                  <Descriptions.Item label="流量类型">
                    <Text>{leadData.traffictype || '-'}</Text>
                  </Descriptions.Item>
                  
                  <Descriptions.Item label="互动类型">
                    <Text>{leadData.interactiontype || '-'}</Text>
                  </Descriptions.Item>
                  
                  <Descriptions.Item label="创建时间">
                    <Space>
                      <CalendarOutlined />
                      <Text>{dayjs(leadData.created_at).format('YYYY-MM-DD HH:mm:ss')}</Text>
                    </Space>
                  </Descriptions.Item>
                  
                  <Descriptions.Item label="更新时间">
                    <Space>
                      <CalendarOutlined />
                      <Text>{dayjs(leadData.updata_at).format('YYYY-MM-DD HH:mm:ss')}</Text>
                    </Space>
                  </Descriptions.Item>
                </Descriptions>
              </Card>

              <Card title="广告信息" size="small">
                <Descriptions column={2} bordered size="small">
                  <Descriptions.Item label="抖音ID">
                    <Text>{leadData.douyinid || '-'}</Text>
                  </Descriptions.Item>
                  
                  <Descriptions.Item label="抖音账号">
                    <Text>{leadData.douyin_accountname || '-'}</Text>
                  </Descriptions.Item>
                  
                  <Descriptions.Item label="小红书ID">
                    <Text>{leadData.redbookid || '-'}</Text>
                  </Descriptions.Item>
                  
                  <Descriptions.Item label="员工姓名">
                    <Text>{leadData.staffname || '-'}</Text>
                  </Descriptions.Item>
                  
                  <Descriptions.Item label="广告系列ID">
                    <Text code>{leadData.campaignid || '-'}</Text>
                  </Descriptions.Item>
                  
                  <Descriptions.Item label="广告系列名称">
                    <Text>{leadData.campaignname || '-'}</Text>
                  </Descriptions.Item>
                  
                  <Descriptions.Item label="广告单元ID">
                    <Text code>{leadData.unitid || '-'}</Text>
                  </Descriptions.Item>
                  
                  <Descriptions.Item label="广告单元名称">
                    <Text>{leadData.unitname || '-'}</Text>
                  </Descriptions.Item>
                  
                  <Descriptions.Item label="创意ID">
                    <Text code>{leadData.creativedid || '-'}</Text>
                  </Descriptions.Item>
                  
                  <Descriptions.Item label="创意名称">
                    <Text>{leadData.creativename || '-'}</Text>
                  </Descriptions.Item>
                  
                  <Descriptions.Item label="抖音线索ID">
                    <Text code>{leadData.douyinleadid || '-'}</Text>
                  </Descriptions.Item>
                  
                  <Descriptions.Item label="备注链接">
                    <Text>{leadData.notelink || '-'}</Text>
                  </Descriptions.Item>
                </Descriptions>
              </Card>

              <Card title="备注信息" size="small">
                <Paragraph>
                  {leadData.remark || '暂无备注信息'}
                </Paragraph>
              </Card>
            </div>
          </TabPane>

          {/* 跟进信息 */}
          <TabPane 
            tab={
              <span>
                <UserOutlined />
                跟进信息
              </span>
            } 
            key="followup"
          >
            <div>
              <Card title="跟进记录" size="small">
                <Descriptions column={2} bordered size="small">
                  <Descriptions.Item label="跟进阶段">
                    <Tag color={getStatusColor(leadData.followupstage || '')}>
                      {leadData.followupstage || '待接收'}
                    </Tag>
                  </Descriptions.Item>
                  
                  <Descriptions.Item label="客户画像">
                    <Text>{leadData.customerprofile || '-'}</Text>
                  </Descriptions.Item>
                  
                  <Descriptions.Item label="工作地点">
                    <Text>{leadData.worklocation || '-'}</Text>
                  </Descriptions.Item>
                  
                  <Descriptions.Item label="用户预算">
                    <Tag color="orange">{leadData.userbudget || '-'}</Tag>
                  </Descriptions.Item>
                  
                  <Descriptions.Item label="入住时间">
                    <Text>
                      {leadData.moveintime ? dayjs(leadData.moveintime).format('YYYY-MM-DD') : '-'}
                    </Text>
                  </Descriptions.Item>
                  
                  <Descriptions.Item label="用户评级">
                    <Text>{leadData.userrating || '-'}</Text>
                  </Descriptions.Item>
                  
                  <Descriptions.Item label="主要分类">
                    <Text>{leadData.majorcategory || '-'}</Text>
                  </Descriptions.Item>
                  
                  <Descriptions.Item label="预约时间">
                    <Text>
                      {leadData.scheduletime ? dayjs(leadData.scheduletime).format('YYYY-MM-DD HH:mm') : '-'}
                    </Text>
                  </Descriptions.Item>
                  
                  <Descriptions.Item label="预约社区">
                    <Tag color="blue">{leadData.scheduledcommunity || '-'}</Tag>
                  </Descriptions.Item>
                  
                  <Descriptions.Item label="面试销售">
                    <Text>{leadData.interviewsales_user_name || '-'}</Text>
                  </Descriptions.Item>
                  
                  <Descriptions.Item label="跟进结果">
                    <Text>{leadData.followupresult || '-'}</Text>
                  </Descriptions.Item>
                  
                  <Descriptions.Item label="跟进创建时间">
                    <Text>
                      {leadData.followup_created_at ? dayjs(leadData.followup_created_at).format('YYYY-MM-DD HH:mm:ss') : '-'}
                    </Text>
                  </Descriptions.Item>
                  
                  <Descriptions.Item label="跟进更新时间">
                    <Text>
                      {leadData.followup_updated_at ? dayjs(leadData.followup_updated_at).format('YYYY-MM-DD HH:mm:ss') : '-'}
                    </Text>
                  </Descriptions.Item>
                </Descriptions>
              </Card>
            </div>
          </TabPane>

          {/* 带看信息 */}
          <TabPane 
            tab={
              <span>
                <EyeOutlined />
                带看信息
              </span>
            } 
            key="showing"
          >
            <div>
              {/* 卡片列表展示所有带看记录 */}
              {leadData?.showingsList && Array.isArray(leadData.showingsList) && leadData.showingsList.length > 0 ? (
                <div>
                  {(leadData.showingsList as any[]).map((showing, idx) => (
                    <Card key={showing.id} title={`带看记录 #${leadData.showingsList!.length - idx}`} size="small">
                      <Descriptions column={2} bordered size="small">
                        <Descriptions.Item label="预约时间">
                          <Text>{showing.scheduletime ? dayjs(showing.scheduletime).format('YYYY-MM-DD HH:mm') : '-'}</Text>
                        </Descriptions.Item>
                        <Descriptions.Item label="社区">
                          <Tag color="blue">{showing.community || '-'}</Tag>
                        </Descriptions.Item>
                        <Descriptions.Item label="到达时间">
                          <Text>{showing.arrivaltime ? dayjs(showing.arrivaltime).format('YYYY-MM-DD HH:mm') : '-'}</Text>
                        </Descriptions.Item>
                        <Descriptions.Item label="带看销售">
                          <Text>{showing.showingsales_user?.nickname || '-'}</Text>
                        </Descriptions.Item>
                        <Descriptions.Item label="真实带看销售">
                          <Text>{showing.trueshowingsales_user?.nickname || '-'}</Text>
                        </Descriptions.Item>
                        <Descriptions.Item label="看房结果">
                          <Text>{showing.viewresult || '-'}</Text>
                        </Descriptions.Item>
                        <Descriptions.Item label="预算">
                          <Tag color="orange">{showing.budget ? `¥${showing.budget}` : '-'}</Tag>
                        </Descriptions.Item>
                        <Descriptions.Item label="入住时间">
                          <Text>{showing.moveintime ? dayjs(showing.moveintime).format('YYYY-MM-DD') : '-'}</Text>
                        </Descriptions.Item>
                        <Descriptions.Item label="租期">
                          <Text>{showing.renttime ? `${showing.renttime}个月` : '-'}</Text>
                        </Descriptions.Item>
                        <Descriptions.Item label="备注">
                          <Text>{showing.remark || '-'}</Text>
                        </Descriptions.Item>
                        <Descriptions.Item label="创建时间">
                          <Text>{showing.created_at ? dayjs(showing.created_at).format('YYYY-MM-DD HH:mm:ss') : '-'}</Text>
                        </Descriptions.Item>
                        <Descriptions.Item label="更新时间">
                          <Text>{showing.updated_at ? dayjs(showing.updated_at).format('YYYY-MM-DD HH:mm:ss') : '-'}</Text>
                        </Descriptions.Item>
                        {showing.phone && (
                          <Descriptions.Item label="手机号">
                            <Text>{maskPhone(showing.phone)}</Text>
                          </Descriptions.Item>
                        )}
                        {showing.wechat && (
                          <Descriptions.Item label="微信号">
                            <Text>{maskWechat(showing.wechat)}</Text>
                          </Descriptions.Item>
                        )}
                      </Descriptions>
                    </Card>
                  ))}
                </div>
              ) : (
                <Card style={{ textAlign: 'center', color: '#999' }} size="small" bordered={false}>
                  暂无带看记录
                </Card>
              )}
            </div>
          </TabPane>

          {/* 成交信息 */}
          <TabPane 
            tab={
              <span>
                <CheckCircleOutlined/>
                成交信息
              </span>
            } 
            key="deal"
          >
            <div>
              {/* 卡片列表展示所有成交记录 */}
              {leadData?.dealsList && Array.isArray(leadData.dealsList) && leadData.dealsList.length > 0 ? (
                <div>
                  {(leadData.dealsList as any[]).map((deal, idx) => (
                    <Card key={deal.id} title={`成交记录 #${leadData.dealsList!.length - idx}`} size="small">
                      <Descriptions column={2} bordered size="small">
                        <Descriptions.Item label="合同日期">
                          <Text >{deal.contractdate ? dayjs(deal.contractdate).format('YYYY-MM-DD') : '-'}</Text>
                        </Descriptions.Item>
                        <Descriptions.Item label="社区">
                          <Tag color="green">{deal.community || '-'}</Tag>
                        </Descriptions.Item>
                        <Descriptions.Item label="合同编号">
                          <Text code>{deal.contractnumber || '-'}</Text>
                        </Descriptions.Item>
                        <Descriptions.Item label="房间编号">
                          <Text>{deal.roomnumber || '-'}</Text>
                        </Descriptions.Item>
                        <Descriptions.Item label="创建时间">
                          <Text>{deal.created_at ? dayjs(deal.created_at).format('YYYY-MM-DD HH:mm:ss') : '-'}</Text>
                        </Descriptions.Item>
                        <Descriptions.Item label="更新时间">
                          <Text>{deal.updated_at ? dayjs(deal.updated_at).format('YYYY-MM-DD HH:mm:ss') : '-'}</Text>
                        </Descriptions.Item>
                        {deal.phone && (
                          <Descriptions.Item label="手机号">
                            <Text>{maskPhone(deal.phone)}</Text>
                          </Descriptions.Item>
                        )}
                        {deal.wechat && (
                          <Descriptions.Item label="微信号">
                            <Text>{maskWechat(deal.wechat)}</Text>
                          </Descriptions.Item>
                        )}
                      </Descriptions>
                    </Card>
                  ))}
                </div>
              ) : (
                <Card style={{ textAlign: 'center', color: '#999' }} size="small" bordered={false} >
                  暂无成交记录
                </Card>
              )}
            </div>
          </TabPane>
        </Tabs>
      )}
    </Spin>
  );
};

export default LeadDetailDrawer; 