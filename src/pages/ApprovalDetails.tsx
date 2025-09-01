import React, { useEffect, useState, useMemo } from 'react';
import { Tabs, Table, Tag,Button, message, Modal, Drawer, Steps, Input } from 'antd';
import { supabase } from '../supaClient';
import LeadDetailDrawer from '../components/LeadDetailDrawer';
import { useSearchParams } from 'react-router-dom';
import { useUser } from '../context/UserContext';
import { toBeijingDateTimeStr } from '../utils/timeUtils';

function formatToBeijingTime(isoString?: string) {
  if (!isoString) return '-';
  return toBeijingDateTimeStr(isoString);
}

const ApprovalDetails: React.FC = () => {
  const { user, profile } = useUser();
  const [pendingList, setPendingList] = useState<any[]>([]);
  const [approvedList, setApprovedList] = useState<any[]>([]);
  const [initiatedList, setInitiatedList] = useState<any[]>([]);
  const [allList, setAllList] = useState<any[]>([]);
  const [profileId, setProfileId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [userMap, setUserMap] = useState<Map<number, string>>(new Map());
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  const [drawerRecord, setDrawerRecord] = useState<any>(null);
  const [leadDrawerVisible, setLeadDrawerVisible] = useState(false);
  const [leadDrawerId, setLeadDrawerId] = useState<string | null>(null);

  // 智能展示 config 字段，图片支持点击放大预览
  function isImageUrl(url: string) {
    return /^https?:\/\/.+\.(jpg|jpeg|png|gif|webp|bmp)$/i.test(url);
  }

  const [previewVisible, setPreviewVisible] = React.useState(false);
  const [previewImages, setPreviewImages] = React.useState<string[]>([]);
  const [previewIndex, setPreviewIndex] = React.useState(0);

  function openImagePreview(urls: string[], idx: number) {
    setPreviewImages(urls);
    setPreviewIndex(idx);
    setPreviewVisible(true);
  }

  function renderConfig(cfg: any) {
    if (!cfg) return '-';
    if (typeof cfg === 'string') {
      try { cfg = JSON.parse(cfg); } catch { return cfg; }
    }
    // 流程节点配置
    if (cfg.steps && Array.isArray(cfg.steps)) {
      return (
        <div style={{ maxWidth: 400 }}>
          {cfg.steps.map((step: any, idx: number) => (
            <div key={idx} style={{
              background: '#f6f6f6',
              borderRadius: 4,
              padding: '4px 8px',
              marginBottom: 4,
              fontSize: 13,
              lineHeight: 1.6
            }}>
              <b>节点{idx + 1}：</b>
              类型: {step.type}
              {step.permission && <>，权限: {step.permission}</>}
              {step.mode && <>，模式: {step.mode === 'any' ? '任一同意' : step.mode === 'all' ? '全部同意' : step.mode}</>}
              {step.default_approver_id && step.default_approver_id.length > 0 && <>，审批人: {Array.isArray(step.default_approver_id) ? step.default_approver_id.join(',') : step.default_approver_id}</>}
              {step.notifiers && step.notifiers.length > 0 && <>，知会: {Array.isArray(step.notifiers) ? step.notifiers.join(',') : step.notifiers}</>}
            </div>
          ))}
        </div>
      );
    }
    // 普通对象，展示所有key/value
    if (typeof cfg === 'object') {
      return (
        <div style={{ maxWidth: 400 }}>
          {Object.entries(cfg).map(([key, value]) => {
            // 收集所有图片链接
            let imageUrls: string[] = [];
            if (Array.isArray(value)) {
              imageUrls = value.filter(v => typeof v === 'string' && isImageUrl(v));
            }
            return (
              <div key={key} style={{
                background: '#f6f6f6',
                borderRadius: 4,
                padding: '4px 8px',
                marginBottom: 4,
                fontSize: 13,
                lineHeight: 1.6
              }}>
                <b>{key}：</b>
                {Array.isArray(value)
                  ? value.map((v, i) =>
                      typeof v === 'string' && v.startsWith('http')
                        ? isImageUrl(v)
                          ? <img
                              key={i}
                              src={v}
                              alt={`evidence-${i}`}
                              style={{ maxWidth: 80, maxHeight: 60, margin: 4, borderRadius: 4, border: '1px solid #eee', cursor: 'pointer' }}
                              onClick={() => openImagePreview(imageUrls, imageUrls.indexOf(v))}
                            />
                          : <div key={i}><a href={v} target="_blank" rel="noopener noreferrer">{v}</a></div>
                        : <div key={i}>{String(v)}</div>
                    )
                  : String(value)}
              </div>
            );
          })}
        </div>
      );
    }
    return String(cfg);
  }

  // 状态中文化标签
  function renderStatusTag(status: string) {
    let color = 'default';
    let text = status;
    if (status === 'pending') {
      color = 'blue'; text = '待审批';
    } else if (status === 'approved') {
      color = 'green'; text = '已同意';
    } else if (status === 'rejected') {
      color = 'red'; text = '已拒绝';
    } else {
      color = 'default'; text = status;
    }
    return <Tag color={color}>{text}</Tag>;
  }

  const { Step } = Steps;
  const { TextArea } = Input;

  // 审批操作（同意/拒绝）
  const onApproveStep = async (stepId: any, action: 'approved' | 'rejected', comment?: string) => {
    try {
      const updateData: any = {
        status: action,
        action_time: new Date().toISOString(),
      };
      if (comment !== undefined) updateData.comment = comment;
      const { error } = await supabase
        .from('approval_steps')
        .update(updateData)
        .eq('id', stepId);
      if (error) {
        message.error('审批操作失败: ' + error.message);
      } else {
        message.success(`已${action === 'approved' ? '同意' : '拒绝'}该节点`);
        // 触发数据重新获取
        setRefreshTrigger(prev => prev + 1);
      }
    } catch (e: any) {
      message.error('审批操作异常: ' + (e.message || e));
    }
  };

  // 完整 columns（审批步骤类）+ 未审批操作列+批注列
  const [pendingListState, setPendingListState] = useState<any[]>([]);
  useEffect(() => { setPendingListState(pendingList); }, [pendingList]);

  const handleCommentBlur = async (stepId: any, value: string, oldValue: string) => {
    if (value === oldValue) return;
    // 乐观更新本地
    setPendingListState(list => list.map(item => item.step_id === stepId ? { ...item, comment: value } : item));
    const { error } = await supabase
      .from('approval_steps')
      .update({ comment: value })
      .eq('id', stepId);
    if (error) {
      message.error('批注保存失败: ' + error.message);
      // 回滚本地
      setPendingListState(list => list.map(item => item.step_id === stepId ? { ...item, comment: oldValue } : item));
    } else {
      message.success('批注已保存');
    }
  };

  const columns = [
    { title: '业务类型', dataIndex: 'name', key: 'name', sorter: true, filters: [], },
    { title: '状态', dataIndex: 'status', key: 'status', render: renderStatusTag, sorter: true, filters: [
      { text: '待审批', value: 'pending' },
      { text: '已同意', value: 'approved' },
      { text: '已拒绝', value: 'rejected' },
    ] },
    { title: '发起人昵称', dataIndex: 'initiator_nickname', key: 'initiator_nickname', sorter: true, filters: [], },
    { title: '发起时间', dataIndex: 'created_at', key: 'created_at', render: (t: string) => formatToBeijingTime(t), sorter: true },
    // 修改“完成时间”为“等待时长”
    { 
      title: '等待时长', 
      dataIndex: 'created_at', 
      key: 'wait_duration', 
      render: (created_at: string) => {
        if (!created_at) return '-';
        const now = new Date();
        const start = new Date(created_at);
        const diffMs = now.getTime() - start.getTime();
        const diffMin = Math.floor(diffMs / 60000);
        if (diffMin >= 1440) {
          const days = Math.floor(diffMin / 1440);
          return days + '天';
        } else {
          return diffMin + '分钟';
        }
      },
      sorter: true,
    },
    { title: '操作编号', dataIndex: 'target_id', key: 'target_id', sorter: true, filters: [], },
    { title: '流程配置', dataIndex: 'config', key: 'config', render: renderConfig, sorter: true, filters: [], },
    {
      title: '批注',
      dataIndex: 'comment',
      key: 'comment',
      render: (text: string, record: any) => {
        return (
          <Input.TextArea
            defaultValue={text}
            rows={2}
            style={{ resize: 'none' }}
            placeholder="请输入批注"
            onBlur={e => handleCommentBlur(record.id, e.target.value, text)}
          />
        );
      },
    },
    {
      title: '操作',
      key: 'action',
      fixed: 'right' as const,
      render: (_: unknown, record: any) => (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
          <Button size="small" type="primary" style={{ width: 60 }} onClick={() => onApproveStep(record.id, 'approved', record.comment)}>同意</Button>
          <Button size="small" danger style={{ width: 60 }} onClick={() => onApproveStep(record.id, 'rejected')}>拒绝</Button>
          <Button size="small" style={{ width: 60 }} onClick={() => onViewLeadAndFlowDetail(record)}>详情</Button>
        </div>
      ),
    },
  ];
  // 优化“查看详情”按钮，动态拉取审批步骤


  // 联动抽屉：线索详情+审批详情
  const onViewLeadAndFlowDetail = async (record: any) => {
    setLeadDrawerId(record.target_id);
    // 动态拉取审批步骤
    const { data: steps } = await supabase
      .from('approval_steps')
      .select('*')
      .eq('instance_id', record.id);
    setDrawerRecord({ ...record, approval_steps: steps || [] });
    setLeadDrawerVisible(true);
  };

  // 优化实例视图columns，操作列调用 onViewDetail，并增加“详情”按钮
  const instanceColumns = [
    { title: '业务类型', dataIndex: 'name', key: 'name', sorter: true, filters: [], },
    { title: '操作编号', dataIndex: 'target_id', key: 'target_id', sorter: true, filters: [], },
    { title: '当前状态', dataIndex: 'status', key: 'status', render: (status: string) => renderStatusTag(status), sorter: true, filters: [
      { text: '待审批', value: 'pending' },
      { text: '已同意', value: 'approved' },
      { text: '已拒绝', value: 'rejected' },
    ] },
    // 去除“当前步骤”列
    // 新增“审批时长”列，位于发起时间前
    {
      title: '审批时长',
      key: 'duration',
      sorter: true,
      render: (_: unknown, record: any) => {
        const start = record.created_at ? new Date(record.created_at) : null;
        const end = record.action_time ? new Date(record.action_time) : null;
        if (!start || !end) return '-';
        const diffMs = end.getTime() - start.getTime();
        const diffMin = Math.floor(diffMs / 60000);
        if (diffMin >= 1440) {
          const days = Math.floor(diffMin / 1440);
          return days + '天';
        } else {
          return diffMin + '分钟';
        }
      }
    },
    { title: '发起时间', dataIndex: 'created_at', key: 'created_at', render: (t: string) => formatToBeijingTime(t), sorter: true },
    { title: '完成时间', dataIndex: 'action_time', key: 'action_time', render: (t: string, record: any) => record.status === 'pending' ? '-' : formatToBeijingTime(t), sorter: true },
    { title: '发起人昵称', dataIndex: 'initiator_nickname', key: 'initiator_nickname', sorter: true, filters: [], },
    {
      title: '操作',
      key: 'action',
      fixed: 'right' as const,
      render: (_: unknown, record: any) => (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
          <Button size="small"style={{ width: 60 }} onClick={() => onViewLeadAndFlowDetail(record)}>详情</Button>
        </div>
      ),
    },
  ];

  // 审批流详情抽屉内容，Steps 展示，统一增加comment列
  function renderFlowDetail(record: any) {
    if (!record) return null;
    const steps = record.approval_steps || [];
    return (
      <div style={{ padding: 12 }}>
        <h3>审批流进度</h3>
        <div style={{ marginBottom: 8 }}>
          <b>业务类型：</b>{record.name} <b>操作编号：</b>{record.target_id}
        </div>
        <div style={{ marginBottom: 8 }}>
          <b>当前状态：</b>{renderStatusTag(record.status)} <b>当前步骤：</b>{typeof record.current_step === 'number' && steps.length ? `第${record.current_step + 1}步/共${steps.length}步` : '-'}
        </div>
        <Steps direction="vertical" current={record.current_step}>
          {steps.map((step: any, idx: number) => (
            <Step
              key={step.id}
              title={`节点${idx + 1} 审批人: ${userMap.get(Number(step.approver_id)) || step.approver_id}`}
              status={step.status === 'approved' ? 'finish' : step.status === 'rejected' ? 'error' : 'process'}
              description={
                <div>
                  <div>状态: {renderStatusTag(step.status)}</div>
                  <div>
                    批注: {
                      (step.status === 'pending' && step.approver_id === profileId) ? (
                        <TextArea
                          defaultValue={step.comment}
                          rows={2}
                          style={{ resize: 'none' }}
                          placeholder="请输入批注"
                          onBlur={e => handleCommentBlur(step.id, e.target.value, step.comment)}
                        />
                      ) : (
                        <span style={{ whiteSpace: 'pre-wrap' }}>{step.comment || '-'}</span>
                      )
                    }
                  </div>
                  <div>时间: {formatToBeijingTime(step.action_time) || '-'}</div>
                </div>
              }
            />
          ))}
        </Steps>
      </div>
    );
  }

  useEffect(() => {
    async function fetchProfileIdAndData() {
      setLoading(true);
      try {
        if (!user || !profile) return;
        setProfileId(profile.id);

        // 查所有用户，建立id->nickname映射
        const { data: allUsers } = await supabase
          .from('users_profile')
          .select('id, nickname');
        const userMapTmp = new Map<number, string>();
        (allUsers || []).forEach(u => userMapTmp.set(Number(u.id), u.nickname));
        setUserMap(userMapTmp);

        // 先查所有审批流模板，建立id→name映射
        const { data: flowTemplates } = await supabase
          .from('approval_flows')
          .select('id, name');
        const flowNameMap = new Map();
        (flowTemplates || []).forEach(f => flowNameMap.set(f.id, f.name));

        // join approval_instances
        const joinStr = 'id, comment, step_index, approver_id, status, action_time, approval_instances!inner(id, flow_id, target_id, created_by, created_at, config, users_profile:created_by(nickname))';

        // 1. 未审批
        const { data: pendingSteps } = await supabase
          .from('approval_steps')
          .select('*, approval_instances!inner(flow_id, target_id, created_by, created_at, config, users_profile:created_by(nickname))')
          .eq('approver_id', profile.id)
          .eq('status', 'pending');
        const pendingList = (pendingSteps || []).map((step: any) => ({
          ...step,
          ...step.approval_instances,
          initiator_nickname: step.approval_instances?.users_profile?.nickname,
          name: flowNameMap.get(step.approval_instances?.flow_id) || '',
          action_time: step.action_time,
          id: step.id, // approval_steps.id
        }));
        setPendingList(pendingList);

        // 2. 已审批
        const { data: approvedSteps } = await supabase
          .from('approval_steps')
          .select(joinStr)
          .eq('approver_id', profile.id)
          .in('status', ['approved', 'rejected']);
        const approvedList = (approvedSteps || [])
          .map((step: any) => ({
            ...step.approval_instances,
            status: step.status,
            initiator_nickname: step.approval_instances.users_profile?.nickname,
            config: step.approval_instances.config,
            name: flowNameMap.get(step.approval_instances.flow_id) || '',
            action_time: step.action_time,
            comment: step.comment // 补充批注字段
          }));
        setApprovedList(approvedList);

        // 3. 已发起
        const { data: initiated } = await supabase
          .from('approval_instances')
          .select('*, approval_steps(id, step_index, approver_id), users_profile:created_by(nickname)')
          .eq('created_by', profile.id);
        const initiatedList = (initiated || []).map(item => ({
          ...item,
          name: flowNameMap.get(item.flow_id) || '',
          config: typeof item.config === 'string' ? ( (() => { try { return JSON.parse(item.config); } catch { return {}; } })() ) : item.config,
          action_time: item.updated_at,
          approval_steps: item.approval_steps || [],
          initiator_nickname: item.users_profile?.nickname || '未知用户',
        }));
        setInitiatedList(initiatedList);

        // 4. 全部（合并去重，统一操作编号字段）
        const allMap = new Map();
        [...pendingList, ...approvedList, ...initiatedList].forEach((item: any) => {
          // 确保每个item都有统一的target_id字段
          const normalizedItem = {
            ...item,
            target_id: item.target_id || item.id || '', // 统一使用target_id作为操作编号
            operation_id: item.target_id || item.id || '', // 添加operation_id别名
          };
          allMap.set(item.id, normalizedItem);
        });
        const allListData = Array.from(allMap.values()); 
        setAllList(allListData);
      } finally {
        setLoading(false);
      }
    }
    fetchProfileIdAndData();
  }, [refreshTrigger, user, profile]);

  // 处理URL参数变化
  const [searchParams, setSearchParams] = useSearchParams();
  const activeTab = searchParams.get('tab') || 'pending';
  const filterTargetId = searchParams.get('filter_target_id');

  // 统一操作编号筛选逻辑
  const filteredAllList = useMemo(() => {
    if (filterTargetId) {
      
      
      const filtered = allList.filter(item => {
        // 统一使用target_id作为操作编号
        const operationId = item.target_id || item.operation_id || item.id;
        
        if (!operationId) {
          
          return false;
        }
        
        // 精确匹配
        if (operationId === filterTargetId) {
          
          return true;
        }
        
        // 包含匹配（不区分大小写）
        if (operationId.toLowerCase().includes(filterTargetId.toLowerCase())) {
          
          return true;
        }
        
        
        return false;
      });
      
      return filtered;
    }
    return allList;
  }, [allList, filterTargetId]);


  // 表格单元格多行换行样式
  if (typeof window !== 'undefined') {
    const style = document.createElement('style');
    style.innerHTML = `.ant-table-cell { white-space: normal !important; vertical-align: middle; }`;
    document.head.appendChild(style);
  }

  // 已审批 columns：批注只读，操作只保留详情
  const approvedColumns = [
    { title: '业务类型', dataIndex: 'name', key: 'name', sorter: true, filters: [], },
    { title: '状态', dataIndex: 'status', key: 'status', render: renderStatusTag, sorter: true, filters: [
      { text: '待审批', value: 'pending' },
      { text: '已同意', value: 'approved' },
      { text: '已拒绝', value: 'rejected' },
    ] },
    { title: '发起人昵称', dataIndex: 'initiator_nickname', key: 'initiator_nickname', sorter: true, filters: [], },
    { title: '发起时间', dataIndex: 'created_at', key: 'created_at', render: (t: string) => formatToBeijingTime(t), sorter: true },
    { title: '完成时间', dataIndex: 'action_time', key: 'action_time', render: (t: string) => formatToBeijingTime(t), sorter: true },
    { title: '操作编号', dataIndex: 'target_id', key: 'target_id', sorter: true, filters: [], },
    { title: '流程配置', dataIndex: 'config', key: 'config', render: renderConfig, sorter: true, filters: [], },
    {
      title: '批注',
      dataIndex: 'comment',
      key: 'comment',
      render: (text: string) => <span style={{ whiteSpace: 'pre-wrap' }}>{text || '-'}</span>,
    },
    {
      title: '操作',
      key: 'action',
      fixed: 'right' as const,
      render: (_: unknown, record: any) => (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
          <Button size="small" style={{ width: 60 }} onClick={() => onViewLeadAndFlowDetail(record)}>详情</Button>
        </div>
      ),
    },
  ];

  return (
    <div style={{ padding: 24 }}>
      <h2>审批明细</h2>
      <Tabs
        activeKey={activeTab}
        onChange={(key) => {
          const newSearchParams = new URLSearchParams(searchParams);
          newSearchParams.set('tab', key);
          setSearchParams(newSearchParams);
        }}
        items={[
          {
            key: 'pending',
            label: '未审批',
            children: <Table rowKey="id" columns={columns} dataSource={pendingListState} loading={loading} pagination={false} scroll={{ x: 'max-content' }} />, // 未审批用原columns
          },
          {
            key: 'approved',
            label: '已审批',
            children: <Table rowKey="id" columns={approvedColumns} dataSource={approvedList} loading={loading} pagination={false} scroll={{ x: 'max-content' }} />, // 已审批用只读columns
          },
          {
            key: 'initiated',
            label: '已发起',
            children: <Table rowKey="id" columns={instanceColumns} dataSource={initiatedList} loading={loading} pagination={false} scroll={{ x: 'max-content' }} />,
          },
          {
            key: 'all',
            label: '全部',
            children: <Table
              rowKey="id"
              columns={instanceColumns}
              dataSource={filteredAllList}
              loading={loading}
              pagination={false}
              scroll={{ x: 'max-content' }}
              onChange={(_pagination, _filters, _sorter) => {
                // 这里可以根据filters和sorter做本地排序和筛选，或触发后端请求
              }}
            />,
          },
        ]}
      />
      <Modal
        open={previewVisible}
        onCancel={() => setPreviewVisible(false)}
        footer={null}
        width={undefined}
        styles={{ 
          body: {
            textAlign: 'center',
            padding: 0,
            background: '#fff',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            minHeight: '60vh'
          }
        }}
      >
        {previewImages.length > 0 && (
          <div style={{ width: '100%' }}>
            <img
              src={previewImages[previewIndex]}
              alt="预览"
              style={{
                width: '100%',
                maxWidth: '80vw',
                maxHeight: '80vh',
                borderRadius: 12,
                margin: 'auto',
                display: 'block',
                objectFit: 'contain',
                background: '#fff'
              }}
            />
            {previewImages.length > 1 && (
              <div style={{ position: 'absolute', top: '50%', left: 0, right: 0, display: 'flex', justifyContent: 'space-between', pointerEvents: 'none' }}>
                <Button
                  style={{ pointerEvents: 'auto', opacity: previewIndex === 0 ? 0.3 : 1 }}
                  disabled={previewIndex === 0}
                  onClick={() => setPreviewIndex(previewIndex - 1)}
                >
                  上一张
                </Button>
                <Button
                  style={{ pointerEvents: 'auto', opacity: previewIndex === previewImages.length - 1 ? 0.3 : 1 }}
                  disabled={previewIndex === previewImages.length - 1}
                  onClick={() => setPreviewIndex(previewIndex + 1)}
                >
                  下一张
                </Button>
              </div>
            )}
          </div>
        )}
      </Modal>
      <Drawer
        open={leadDrawerVisible}
        onClose={() => setLeadDrawerVisible(false)}
        title="线索与审批详情"
        width={900}
        destroyOnHidden
      >
        <Tabs defaultActiveKey="flow" size="large">
          <Tabs.TabPane tab="审批流详情" key="flow">
            {drawerRecord ? renderFlowDetail(drawerRecord) : <div style={{ color: '#999', textAlign: 'center', marginTop: 48 }}>无审批流数据</div>}
          </Tabs.TabPane>
          <Tabs.TabPane tab="线索详情" key="lead">
            {leadDrawerId && <LeadDetailDrawer leadid={leadDrawerId} />}
          </Tabs.TabPane>
        </Tabs>
      </Drawer>
    </div>
  );
};

export default ApprovalDetails; 