import { useEffect, useState } from 'react';
import { getAllUserPointsWallets, submitPointsAdjustApproval } from '../api/pointsApi';
import { Table, Spin, Alert, Select, Modal, Form, Input, InputNumber, message, Button } from 'antd';
import { supabase } from '../supaClient';
import { useAuth } from '../hooks/useAuth';

interface UserProfile {
  id: number;
  nickname: string;
  email?: string;
  organization_id?: string;
  admin?: number; // Added for admin user ID
}

interface Organization {
  id: string;
  name: string;
  parent_id?: string | null;
  admin?: number; // Added for admin user ID
}

interface UserPointsWallet {
  id: number;
  user_id: number;
  total_points: number;
  total_earned_points: number;
  total_consumed_points: number;
  created_at: string;
  updated_at: string;
}

export default function PointsSummary() {
  const [wallets, setWallets] = useState<UserPointsWallet[]>([]);
  const [profiles, setProfiles] = useState<UserProfile[]>([]);
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedDept1, setSelectedDept1] = useState<string | undefined>();
  const [selectedDept2, setSelectedDept2] = useState<string | undefined>();
  const [selectedDept3, setSelectedDept3] = useState<string | undefined>();
  const [adjustModalOpen, setAdjustModalOpen] = useState(false);
  const [adjustForm] = Form.useForm();
  const [adjustLoading, setAdjustLoading] = useState(false);
  const { user } = useAuth();
  const [profileId, setProfileId] = useState<number | null>(null);

  useEffect(() => {
    async function fetchProfileId() {
      if (!user) return;
      const { data: { user: authUser } } = await supabase.auth.getUser();
      if (!authUser) return;
      const { data, error } = await supabase
        .from('users_profile')
        .select('id')
        .eq('user_id', authUser.id)
        .single();
      if (!error && data?.id) setProfileId(data.id);
    }
    fetchProfileId();
  }, [user]);

  // 积分调整提交
  const handleAdjust = async (values: { user_id: number; points: number; remark?: string }) => {
    setAdjustLoading(true);
    try {
      if (!profileId) throw new Error('无法获取当前操作人');
      await submitPointsAdjustApproval({ ...values, created_by: profileId });
      message.success('已提交审批，待通过后自动发放');
      setAdjustModalOpen(false);
      adjustForm.resetFields();
    } catch (err: any) {
      message.error('积分调整申请失败：' + (err.message || '未知错误'));
    } finally {
      setAdjustLoading(false);
    }
  };

  useEffect(() => {
    async function fetchData() {
      setLoading(true);
      try {
        // 获取所有用户钱包
        const walletsData = await getAllUserPointsWallets();
        setWallets(walletsData || []);
        // 获取所有用户信息（带 organization_id）
        const { data: profilesData, error: profilesError } = await supabase
          .from('users_profile')
          .select('id, nickname, email, organization_id');
        if (profilesError) throw profilesError;
        setProfiles(profilesData || []);
        // 获取所有部门
        const { data: orgsData, error: orgsError } = await supabase
          .from('organizations')
          .select('id, name, parent_id, admin');
        if (orgsError) throw orgsError;
        setOrganizations(orgsData || []);
      } catch (err: any) {
        setError(err.message || '加载失败');
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, []);

  // 三级部门选项（依赖二级部门选择）
  const dept3Options = organizations.filter(o => o.parent_id === selectedDept2).map(o => ({ label: o.name, value: o.id }));

  // 组织部门树与映射
  const orgMap = Object.fromEntries(organizations.map(o => [o.id, o]));
  function getDeptChain(orgId?: string): { dept1?: Organization; dept2?: Organization; dept3?: Organization } {
    if (!orgId) return {};
    const org = orgMap[orgId];
    if (!org) return {};
    if (!org.parent_id) return { dept1: org };
    const parent = orgMap[org.parent_id];
    if (parent && !parent.parent_id) return { dept1: parent, dept2: org };
    if (parent && parent.parent_id) {
      const grand = orgMap[parent.parent_id];
      if (grand) return { dept1: grand, dept2: parent, dept3: org };
      return { dept1: parent, dept2: org };
    }
    return { dept1: org };
  }

  // 一级部门选项
  const dept1Options = organizations.filter(o => !o.parent_id).map(o => ({ label: o.name, value: o.id }));
  // 二级部门选项（依赖一级部门选择）
  const dept2Options = organizations.filter(o => o.parent_id === selectedDept1).map(o => ({ label: o.name, value: o.id }));

  // 筛选后的用户ID集合
  const filteredProfileIds = profiles.filter(p => {
    const chain = getDeptChain(p.organization_id);
    if (selectedDept1 && chain.dept1?.id !== selectedDept1) return false;
    if (selectedDept2 && chain.dept2?.id !== selectedDept2) return false;
    if (selectedDept3 && chain.dept3?.id !== selectedDept3) return false;
    return true;
  }).map(p => p.id);

  // 负责人名称
  function getAdminName(org: Organization | undefined): string {
    if (!org || !org.admin) return '-';
    // 查找负责人用户
    const adminProfile = profiles.find(p => p.organization_id === org.id && p.id === org.admin);
    return adminProfile?.nickname || '-';
  }

  // 工具函数：将UTC时间转为北京时间字符串
  function formatToBeijingTime(isoString?: string) {
    if (!isoString) return '-';
    const date = new Date(isoString);
    // 北京时间 = UTC+8
    const beijingDate = new Date(date.getTime() + 8 * 60 * 60 * 1000);
    const y = beijingDate.getFullYear();
    const m = String(beijingDate.getMonth() + 1).padStart(2, '0');
    const d = String(beijingDate.getDate()).padStart(2, '0');
    const h = String(beijingDate.getHours()).padStart(2, '0');
    const min = String(beijingDate.getMinutes()).padStart(2, '0');
    const s = String(beijingDate.getSeconds()).padStart(2, '0');
    return `${y}-${m}-${d} ${h}:${min}:${s}`;
  }

  const dataSource = wallets
    .filter(w => filteredProfileIds.includes(w.user_id))
    .map(w => {
      const profile = profiles.find(p => p.id === w.user_id);
      const chain = getDeptChain(profile?.organization_id);
      return {
        key: w.id,
        user_id: w.user_id,
        nickname: profile?.nickname || '-',
        dept1: chain.dept1?.name || '-',
        dept2: chain.dept2?.name || '-',
        dept3: chain.dept3 ? chain.dept3.name : '-',
        total_points: w.total_points,
        total_earned_points: w.total_earned_points,
        total_consumed_points: w.total_consumed_points,
        updated_at: formatToBeijingTime(w.updated_at),
      };
    });

  // 生成唯一筛选项
  type DataSourceItem = {
    key: number;
    user_id: number;
    nickname: string;
    dept1: string;
    dept2: string;
    dept3: string;
    total_points: number;
    total_earned_points: number;
    total_consumed_points: number;
    updated_at: string;
  };
  function getColumnFilters<K extends keyof DataSourceItem>(dataIndex: K) {
    const values = Array.from(new Set(dataSource.map(item => item[dataIndex]))).filter(v => v && v !== '-');
    return values.map(v => ({ text: v as string, value: v }));
  }

  const columns = [
    { title: '用户ID', dataIndex: 'user_id', key: 'user_id', sorter: (a: DataSourceItem, b: DataSourceItem) => a.user_id - b.user_id },
    { title: '昵称', dataIndex: 'nickname', key: 'nickname', sorter: (a: DataSourceItem, b: DataSourceItem) => a.nickname.localeCompare(b.nickname), filters: getColumnFilters('nickname'), onFilter: (value: string | number | boolean | bigint, record: DataSourceItem) => (typeof value === 'string' || typeof value === 'number' || typeof value === 'bigint') ? record.nickname === value : false },
    { title: '一级部门', dataIndex: 'dept1', key: 'dept1', sorter: (a: DataSourceItem, b: DataSourceItem) => a.dept1.localeCompare(b.dept1), filters: getColumnFilters('dept1'), onFilter: (value: string | number | boolean | bigint, record: DataSourceItem) => (typeof value === 'string' || typeof value === 'number' || typeof value === 'bigint') ? record.dept1 === value : false },
    { title: '二级部门', dataIndex: 'dept2', key: 'dept2', sorter: (a: DataSourceItem, b: DataSourceItem) => a.dept2.localeCompare(b.dept2), filters: getColumnFilters('dept2'), onFilter: (value: string | number | boolean | bigint, record: DataSourceItem) => (typeof value === 'string' || typeof value === 'number' || typeof value === 'bigint') ? record.dept2 === value : false },
    { title: '三级部门', dataIndex: 'dept3', key: 'dept3', sorter: (a: DataSourceItem, b: DataSourceItem) => a.dept3.localeCompare(b.dept3), filters: getColumnFilters('dept3'), onFilter: (value: string | number | boolean | bigint, record: DataSourceItem) => (typeof value === 'string' || typeof value === 'number' || typeof value === 'bigint') ? record.dept3 === value : false },
    { title: '剩余积分', dataIndex: 'total_points', key: 'total_points', sorter: (a: DataSourceItem, b: DataSourceItem) => a.total_points - b.total_points },
    { title: '累计获得', dataIndex: 'total_earned_points', key: 'total_earned_points', sorter: (a: DataSourceItem, b: DataSourceItem) => a.total_earned_points - b.total_earned_points },
    { title: '累计消耗', dataIndex: 'total_consumed_points', key: 'total_consumed_points', sorter: (a: DataSourceItem, b: DataSourceItem) => a.total_consumed_points - b.total_consumed_points },
    { title: '更新时间', dataIndex: 'updated_at', key: 'updated_at', sorter: (a: DataSourceItem, b: DataSourceItem) => a.updated_at.localeCompare(b.updated_at) },
  ];

  if (loading) return <Spin tip="加载中..." style={{ marginTop: 40 }} />;
  if (error) return <Alert type="error" message={error} style={{ marginTop: 40 }} />;

  return (
    <div className="page-card">
      <div className="page-header" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
        <span style={{ fontSize: 20, fontWeight: 700, color: '#222' }}>积分汇总</span>
        <div style={{ display: 'flex', gap: 16 }}>
          <Select
            allowClear
            style={{ width: 180 }}
            placeholder="选择一级部门"
            options={dept1Options}
            value={selectedDept1}
            onChange={v => {
              setSelectedDept1(v);
              setSelectedDept2(undefined);
              setSelectedDept3(undefined);
            }}
          />
          <Select
            allowClear
            style={{ width: 180 }}
            placeholder="选择二级部门"
            options={dept2Options}
            value={selectedDept2}
            onChange={v => {
              setSelectedDept2(v);
              setSelectedDept3(undefined);
            }}
            disabled={!selectedDept1}
          />
          <Select
            allowClear
            style={{ width: 180 }}
            placeholder="选择三级部门"
            options={dept3Options}
            value={selectedDept3}
            onChange={setSelectedDept3}
            disabled={!selectedDept2}
          />
          <Button
            type="primary"
            onClick={() => setAdjustModalOpen(true)}
          >
            积分调整
          </Button>
        </div>
      </div>
      <div className="page-table-wrap">
        <Table
          dataSource={dataSource}
          columns={columns}
          pagination={{ pageSize: 20 }}
          bordered
        />
      </div>
      <Modal
        title="积分调整"
        open={adjustModalOpen}
        onCancel={() => setAdjustModalOpen(false)}
        footer={null}
      >
        <Form
          form={adjustForm}
          layout="vertical"
          onFinish={handleAdjust}
        >
          <Form.Item name="user_id" label="人员" rules={[{ required: true, message: '请选择人员' }]}> 
            <Select
              showSearch
              placeholder="输入姓名或ID搜索"
              optionFilterProp="label"
              filterOption={(input, option) =>
                (option?.label as string)?.toLowerCase().includes(input.toLowerCase()) ||
                String(option?.value).includes(input)
              }
            >
              {profiles.map(p => (
                <Select.Option key={p.id} value={p.id} label={`${p.nickname || '-'}（ID:${p.id}）`}>
                  {p.nickname || '-'}（ID:{p.id}）
                </Select.Option>
              ))}
            </Select>
          </Form.Item>
          <Form.Item name="points" label="积分" rules={[{ required: true, message: '请输入积分' }]}> 
            <InputNumber min={-999999} max={999999} style={{ width: '100%' }} placeholder="可正可负" />
          </Form.Item>
          <Form.Item name="remark" label="备注"> 
            <Input.TextArea rows={3} maxLength={200} showCount placeholder="请输入备注（可选）" />
          </Form.Item>
          <Form.Item style={{ textAlign: 'right', marginBottom: 0 }}>
            <Button onClick={() => setAdjustModalOpen(false)} style={{ marginRight: 12 }} disabled={adjustLoading}>取消</Button>
            <Button type="primary" htmlType="submit" loading={adjustLoading}>确定</Button>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
} 