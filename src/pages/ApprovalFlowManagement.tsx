import React, { useState } from 'react';
import { Table, Button, Modal, Form, Input, Steps, Tag, message, Select, TreeSelect, Card, Row, Col, Statistic } from 'antd';
import { supabase } from '../supaClient'
import { PlusOutlined, DeleteOutlined, ClockCircleOutlined, CheckCircleOutlined, FileTextOutlined } from '@ant-design/icons';
import { getApprovalInstances, getApprovalStatistics, type ApprovalInstancesParams } from '../api/approvalApi';
import { useUser } from '../context/UserContext';

// 格式化北京时间
function formatToBeijingTime(isoString?: string) {
  if (!isoString) return '-';
  const date = new Date(isoString);
  const bjDate = new Date(date.getTime() + 8 * 60 * 60 * 1000);
  return bjDate.toISOString().replace('T', ' ').substring(0, 19);
}

// 审批流模板类型
interface ApprovalFlowTemplate {
  id: string;
  name: string;
  type: string;
  config: any;
}

// 审批实例类型
interface ApprovalInstance {
  id: string;
  flow_id: string;
  target_table: string;
  target_id: string;
  status: string;
  current_step: number;
  created_by: number;
  created_at: string;
  flow_name?: string;
  flow_type?: string;
  creator_nickname?: string;
  latest_action_time?: string | null;
  approval_duration_minutes?: number | null;
  pending_steps_count?: number;
  total_steps_count?: number;
}

// 审批节点类型
interface ApprovalStep {
  id: string;
  instance_id: string;
  step_index: number;
  approver_id: number;
  status: string;
  comment?: string;
  action_time?: string;
  node_config?: any;
}

const { Step } = Steps;

const ApprovalFlowManagement: React.FC = () => {
  const { user, profile } = useUser();
  const [form] = Form.useForm();
  // 模板管理
  const [templates, setTemplates] = useState<ApprovalFlowTemplate[]>([]); // 审批流模板列表
  const [templateModalVisible, setTemplateModalVisible] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<ApprovalFlowTemplate | null>(null);

  // 审批实例
  const [instances, setInstances] = useState<ApprovalInstance[]>([]); // 审批实例列表
  const [selectedInstance, setSelectedInstance] = useState<ApprovalInstance | null>(null);
  const [steps, setSteps] = useState<ApprovalStep[]>([]); // 当前审批实例的节点
  const [stepModalVisible, setStepModalVisible] = useState(false);
  const [loading, setLoading] = useState(false);
  const [pagination, setPagination] = useState({
    current: 1,
    pageSize: 10,
    total: 0,
    showSizeChanger: true,
    showQuickJumper: true,
    showTotal: (total: number, range: [number, number]) => `第 ${range[0]}-${range[1]} 条，共 ${total} 条`,
  });

  // 统计数据
  const [statistics, setStatistics] = useState<{
    total_instances: number;
    pending_instances: number;
    approved_instances: number;
    rejected_instances: number;
    avg_approval_duration_minutes: number | null;
  } | null>(null);


  // 可视化流程设计器用到的本地 state
  const [flowSteps, setFlowSteps] = useState<any[]>([]); // 当前流程节点
  const [orgTreeData, setOrgTreeData] = useState<any[]>([]); // 部门-成员树

  // 拉取审批流模板
  async function fetchTemplates() {
    const { data, error } = await supabase.from('approval_flows').select('*');
    if (error) {
      message.error('获取审批流模板失败');
      return;
    }
    setTemplates(data || []);
  }

  // 拉取审批实例（后端排序）
  async function fetchInstances(page = 1, pageSize = 10, filters?: any, sorter?: any) {
    setLoading(true);
    try {
      const params: ApprovalInstancesParams = {
        page,
        pageSize,
        sortField: sorter?.field || 'created_at',
        sortOrder: sorter?.order === 'ascend' ? 'ASC' : 'DESC',
        statusFilter: filters?.status,
        targetIdFilter: filters?.target_id,
        flowNameFilter: filters?.flow_name,
        creatorNameFilter: filters?.creator_name,
        dateFrom: filters?.date_from,
        dateTo: filters?.date_to
      };

      const { data, total, error } = await getApprovalInstances(params);

      if (error) {
        message.error(`获取审批实例失败: ${error}`);
        return;
      }

      setInstances(data || []);
      setPagination(prev => ({
        ...prev,
        current: page,
        total: total || 0,
      }));
    } finally {
      setLoading(false);
    }
  }

  // 拉取统计数据
  async function fetchStatistics() {
    try {
      const { data, error } = await getApprovalStatistics();
      if (error) {
        return;
      }
      setStatistics(data);
    } catch (e) {
    }
  }

  // 拉取审批节点
  async function fetchSteps(instanceId: string) {
    const { data, error } = await supabase.from('approval_steps').select('*').eq('instance_id', instanceId);
    if (error) {
      message.error('获取审批节点失败');
      return;
    }
    setSteps(data || []);
  }

  // 拉取组织和成员，组装树形数据和成员列表
  async function fetchOrgTreeData() {
    try {
      const { data: orgs } = await supabase.from('organizations').select('id, name, parent_id');
      const { data: users } = await supabase.from('users_profile').select('id, nickname, organization_id').eq('status', 'active');
      // 递归组装部门树
      const buildTree = (parentId: string | null): any[] => {
        return (orgs || [])
          .filter(dep => dep.parent_id === parentId)
          .map(dep => {
            const deptUsers = (users || []).filter(u => u.organization_id === dep.id);
            const subDepts = buildTree(dep.id);
            return {
              title: `${dep.name} (${deptUsers.length}人)`,
              value: `dept_${dep.id}`,
              key: `dept_${dep.id}`,
              children: [
                ...deptUsers.map(u => ({
                  title: u.nickname,
                  value: String(u.id),
                  key: String(u.id),
                  isLeaf: true
                })),
                ...subDepts
              ]
            };
          });
      };
      // 未分配部门成员
      const ungrouped = (users || [])
        .filter(u => !u.organization_id)
        .map(u => ({
          title: u.nickname,
          value: String(u.id),
          key: String(u.id),
          isLeaf: true
        }));
      const tree = buildTree(null);
      if (ungrouped.length > 0) {
        tree.push({
          title: `未分配部门 (${ungrouped.length}人)`,
          value: 'dept_none',
          key: 'dept_none',
          children: ungrouped
        });
      }
      setOrgTreeData(tree);
    } catch (e: any) {
      message.error('加载组织成员树失败');
    }
  }

  // 页面加载时自动拉取数据
  React.useEffect(() => {
    fetchTemplates();
    fetchInstances(1, pagination.pageSize);
    fetchOrgTreeData();
    fetchStatistics();
  }, []);

  // 编辑/新建模板时，初始化流程节点
  React.useEffect(() => {
    if (templateModalVisible) {
      if (editingTemplate && editingTemplate.config && Array.isArray(editingTemplate.config.steps)) {
        setFlowSteps(editingTemplate.config.steps);
      } else {
        setFlowSteps([]);
      }
    }
  }, [templateModalVisible, editingTemplate]);

  // 弹窗打开时同步赋值
  React.useEffect(() => {
    if (templateModalVisible) {
      form.resetFields();
      if (editingTemplate) {
        form.setFieldsValue({
          name: editingTemplate.name,
          type: editingTemplate.type,
          config: editingTemplate.config || {},
        });
      } else {
        form.setFieldsValue({ name: '', type: '', config: {} });
      }
      // 日志：弹窗打开时表单值
    }
  }, [templateModalVisible, editingTemplate, form]);

  // 添加节点（只支持审批节点）
  function addStep() {
    setFlowSteps([...flowSteps, { type: 'approval', permission: '', mode: 'any', default_approver_id: [] }]);
  }
  // 删除节点
  function removeStep(idx: number) {
    setFlowSteps(flowSteps.filter((_, i) => i !== idx));
  }
  // 更新节点
  function updateStep(idx: number, key: string, value: any) {
    setFlowSteps(flowSteps.map((step, i) => i === idx ? { ...step, [key]: value } : step));
  }

  // 在流程设计区，默认审批人ID字段仅用 TreeSelect，移除人员列表弹窗
  // 移除 renderUserList、userListVisible、userSearch、allUsers 相关代码

  // 模板表格列
  const templateColumns = [
    { title: '名称', dataIndex: 'name' },
    { title: '类型', dataIndex: 'type' },
    {
      title: '操作',
      render: (_: any, record: ApprovalFlowTemplate) => (
        <>
          <Button size="small" onClick={() => onEditTemplate(record)}>编辑</Button>
          <Button size="small" danger style={{ marginLeft: 8 }} onClick={() => onDeleteTemplate(record.id)}>删除</Button>
        </>
      ),
    },
  ];

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

    // 审批实例表格列（后端排序）
  const instanceColumns = [
    { 
      title: '业务类型', 
      dataIndex: 'flow_name', 
      key: 'flow_name',
      sorter: true,
    },
    { 
      title: '操作编号', 
      dataIndex: 'target_id', 
      key: 'target_id',
      sorter: true,
    },
    { 
      title: '当前状态', 
      dataIndex: 'status', 
      key: 'status', 
      render: (status: string) => renderStatusTag(status),
      sorter: true,
    },
    {
      title: '审批时长',
      dataIndex: 'approval_duration_minutes',
      key: 'approval_duration_minutes',
      sorter: true,
      render: (duration: number | null) => {
        if (!duration) return '-';
        if (duration >= 1440) {
          const days = Math.floor(duration / 1440);
          return days + '天';
        } else {
          return Math.floor(duration) + '分钟';
        }
      }
    },
    { 
      title: '发起时间', 
      dataIndex: 'created_at', 
      key: 'created_at', 
      render: (t: string) => formatToBeijingTime(t),
      sorter: true,
    },
    { 
      title: '完成时间', 
      dataIndex: 'latest_action_time', 
      key: 'latest_action_time',
      sorter: true,
      render: (time: string | null, record: any) => {
        return record.status === 'pending' ? '-' : formatToBeijingTime(time || undefined);
      }
    },
    { 
      title: '发起人', 
      dataIndex: 'creator_nickname', 
      key: 'creator_nickname', 
      sorter: true,
    },
    {
      title: '操作',
      key: 'action',
      render: (_: unknown, record: any) => (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
          <Button size="small" style={{ width: 60 }} onClick={() => onViewInstance(record)}>详情</Button>
        </div>
      ),
    },
  ];

  // 编辑模板
  function onEditTemplate(template: ApprovalFlowTemplate) {
    setEditingTemplate(template);
    setTemplateModalVisible(true);
  }
  // 删除模板
  async function onDeleteTemplate(id: string) {
    Modal.confirm({
      title: '确认删除该审批流模板？',
      onOk: async () => {
        const { error } = await supabase.from('approval_flows').delete().eq('id', id);
        if (!error) message.success('已删除');
        fetchTemplates();
      },
    });
  }
  // 新建模板
  function onCreateTemplate() {
    setEditingTemplate(null);
    setTemplateModalVisible(true);
  }
  // 保存模板时，将流程节点同步到 config 字段
  async function onSaveTemplate(values: any) {
    const config = { steps: flowSteps };
    if (editingTemplate) {
      const { error } = await supabase.from('approval_flows').update({ ...values, config }).eq('id', editingTemplate.id);
      if (!error) message.success('保存成功');
    } else {
      const { error } = await supabase.from('approval_flows').insert([{ ...values, config }]);
      if (!error) message.success('新建成功');
    }
    setTemplateModalVisible(false);
    fetchTemplates();
  }

  // 查看审批实例详情
  async function onViewInstance(instance: ApprovalInstance) {
    setSelectedInstance(instance);
    await fetchSteps(instance.id);
    setStepModalVisible(true);
  }

  // onApproveStep函数修复
  async function onApproveStep(step: ApprovalStep, action: 'approved' | 'rejected') {
    try {
      // 使用UserContext中的用户信息
      if (!user || !profile) {
        message.error('用户信息获取失败');
        return;
      }
      
      // 检查审批步骤状态
      if (step.status !== 'pending') {
        message.error('该步骤已处理，无法重复审批');
        return;
      }
      // 检查是否为审批人
      if (profile.id !== step.approver_id) {
        message.error('您不是该步骤的审批人');
        return;
      }
      // 准备更新数据
      const updateData = {
        status: action,
        action_time: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };
      // 执行更新
      const { error } = await supabase
        .from('approval_steps')
        .update(updateData)
        .eq('id', step.id);
      if (error) {
        message.error(`审批操作失败: ${error.message}`);
        return;
      }
      
      message.success(`已${action === 'approved' ? '同意' : '拒绝'}该节点`);
      // 重新获取步骤数据
      await fetchSteps(step.instance_id);
      // 检查是否所有步骤都已完成
      // const allCompleted = allSteps?.every((s: any) => s.status === 'approved' || s.status === 'rejected');
    } catch (e: any) {
      message.error(`审批操作异常: ${e.message || e}`);
    }
  }

  return (
    <div style={{ padding: 24 }}>
      <h2>审批流模板管理</h2>
      <Button type="primary" onClick={onCreateTemplate} style={{ marginBottom: 16 }}>新建审批流模板</Button>
      <Table rowKey="id" columns={templateColumns} dataSource={templates} pagination={false} style={{ marginBottom: 32 }} />

      <h2>审批实例管理</h2>
      <Row gutter={16} style={{ marginBottom: 16 }}>
        <Col span={6}>
          <Card bordered={false}>
            <Statistic
              title="总审批实例"
              value={statistics?.total_instances || 0}
              prefix={<FileTextOutlined />}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card bordered={false}>
            <Statistic
              title="待审批实例"
              value={statistics?.pending_instances || 0}
              prefix={<ClockCircleOutlined />}
              valueStyle={{ color: '#1890ff' }}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card bordered={false}>
            <Statistic
              title="已完成审批"
              value={(statistics?.approved_instances || 0) + (statistics?.rejected_instances || 0)}
              prefix={<CheckCircleOutlined />}
              valueStyle={{ color: '#52c41a' }}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card bordered={false}>
            <Statistic
              title="平均审批时长"
              value={statistics?.avg_approval_duration_minutes ? (statistics.avg_approval_duration_minutes / 60).toFixed(1) : 0}
              suffix="小时"
              prefix={<ClockCircleOutlined />}
              valueStyle={{ color: '#722ed1' }}
            />
          </Card>
        </Col>
      </Row>
      <Table 
        rowKey="id" 
        columns={instanceColumns} 
        dataSource={instances} 
        loading={loading}
        pagination={pagination}
        onChange={(paginationInfo, filtersInfo, sorterInfo) => {
          const { current, pageSize } = paginationInfo;
          const newSorter: any = Array.isArray(sorterInfo) ? sorterInfo[0] : sorterInfo;
          if (current && pageSize) {
            fetchInstances(current, pageSize, filtersInfo, newSorter);
          }
        }}
      />

      {/* 模板编辑弹窗 */}
      <Modal
        title={editingTemplate ? '编辑审批流模板' : '新建审批流模板'}
        open={templateModalVisible}
        onCancel={() => setTemplateModalVisible(false)}
        footer={null}
        destroyOnClose
      >
        <Form
          form={form}
          onFinish={onSaveTemplate}
          layout="vertical"
        >
          <Form.Item label="名称" name="name" rules={[{ required: true, message: '请输入名称' }]}
            validateStatus={form.getFieldValue('name') ? undefined : 'error'}
            help={!form.getFieldValue('name') ? '请输入名称' : undefined}
          >
          </Form.Item>
          <Form.Item label="类型" name="type" rules={[{ required: true, message: '请输入类型' }]}
            validateStatus={form.getFieldValue('type') ? undefined : 'error'}
            help={!form.getFieldValue('type') ? '请输入类型' : undefined}
          >
          </Form.Item>

          {/* 可视化流程设计区 */}
          <div style={{ marginBottom: 16, background: '#fafafa', padding: 12, borderRadius: 8 }}>
            <b>流程设计</b>
            {flowSteps.map((step, idx) => (
              <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8, background: '#fff', padding: 8, borderRadius: 4 }}>
                <Select
                  value={step.type}
                  style={{ width: 100 }}
                  onChange={v => updateStep(idx, 'type', v)}
                  options={[
                    { label: '审批', value: 'approval' }
                  ]}
                />
                <Input placeholder="权限/角色标识" value={step.permission} style={{ width: 120 }} onChange={e => updateStep(idx, 'permission', e.target.value)} />
                <Select
                  value={step.mode}
                  style={{ width: 100 }}
                  onChange={v => updateStep(idx, 'mode', v)}
                  options={[
                    { label: '任一同意', value: 'any' },
                    { label: '全部同意', value: 'all' },
                  ]}
                />
                <TreeSelect
                  style={{ width: 220 }}
                  value={step.default_approver_id || []}
                  treeData={orgTreeData}
                  placeholder="选择默认审批人"
                  allowClear
                  treeDefaultExpandAll
                  showSearch
                  multiple
                  treeCheckable
                  filterTreeNode={(input, node) => (node.title as string).toLowerCase().includes(input.toLowerCase())}
                  onChange={v => updateStep(idx, 'default_approver_id', Array.isArray(v) ? v : [v])}
                  maxTagCount="responsive"
                />
                <Button icon={<DeleteOutlined />} danger size="small" onClick={() => removeStep(idx)} />
              </div>
            ))}
            <Button icon={<PlusOutlined />} type="dashed" onClick={addStep} style={{ width: '100%' }}>添加节点</Button>
          </div>

          {/* 高级：JSON编辑入口 */}
          <div style={{ marginBottom: 16 }}>
            <div style={{ fontWeight: 500, marginBottom: 4 }}>配置(JSON)</div>
            <Input.TextArea rows={4} value={JSON.stringify({ steps: flowSteps }, null, 2)} readOnly />
          </div>

          <Form.Item>
            <Button type="primary" htmlType="submit">保存</Button>
          </Form.Item>
        </Form>
      </Modal>

      {/* 审批实例详情弹窗 */}
      <Modal
        title="审批进度"
        open={stepModalVisible}
        onCancel={() => setStepModalVisible(false)}
        footer={null}
        width={600}
        destroyOnClose
      >
        {selectedInstance && (
          <div>
            <div style={{ marginBottom: 16 }}>
              <b>业务类型：</b>{selectedInstance.target_table} <b>业务ID：</b>{selectedInstance.target_id} <b>状态：</b><Tag>{selectedInstance.status}</Tag>
            </div>
            <Steps direction="vertical" current={selectedInstance.current_step}>
              {steps.map((step, idx) => (
                <Step
                  key={step.id}
                  title={`节点${idx + 1} 审批人ID: ${step.approver_id}`}
                  status={step.status === 'approved' ? 'finish' : step.status === 'rejected' ? 'error' : 'process'}
                  description={
                    <div>
                      <div>状态: <Tag>{step.status}</Tag></div>
                      <div>意见: {step.comment || '-'}</div>
                      <div>时间: {step.action_time || '-'}</div>
                      {step.status === 'pending' && (
                        <>
                          <Button type="primary" size="small" onClick={() => onApproveStep(step, 'approved')}>同意</Button>
                          <Button danger size="small" style={{ marginLeft: 8 }} onClick={() => onApproveStep(step, 'rejected')}>拒绝</Button>
                        </>
                      )}
                    </div>
                  }
                />
              ))}
            </Steps>
          </div>
        )}
      </Modal>
    </div>
  );
};

export default ApprovalFlowManagement; 