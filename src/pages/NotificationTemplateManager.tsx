import React, { useEffect, useState } from 'react';
import { Table, Button, Modal, Form, Input, message, Popconfirm, Space, Tag, Switch } from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined } from '@ant-design/icons';
import { supabase } from '../supaClient';

const NotificationTemplateManager: React.FC = () => {
  const [templates, setTemplates] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [form] = Form.useForm();

  // 查询模板
  const fetchTemplates = async () => {
    setLoading(true);
    console.log('[TEMPLATE][fetchTemplates] 开始获取模板...');
    const { data, error } = await supabase
      .from('notification_templates')
      .select('*')
      .order('created_at', { ascending: false });
    setLoading(false);
    if (error) {
      console.error('[TEMPLATE][fetchTemplates] 获取模板失败:', error);
      message.error('获取模板失败');
    } else {
      console.log('[TEMPLATE][fetchTemplates] 获取模板成功:', data);
      setTemplates(data || []);
    }
  };

  useEffect(() => {
    console.log('[TEMPLATE][useEffect] 组件挂载，拉取模板列表');
    fetchTemplates();
  }, []);

  // 新增/编辑模板
  const handleOk = async () => {
    try {
      console.log('[TEMPLATE][handleOk] 开始校验表单...');
      const values = await form.validateFields();
      console.log('[TEMPLATE][handleOk] 表单校验通过，values:', values);
      if (editing) {
        console.log('[TEMPLATE][handleOk] 编辑模式，id:', editing.id);
        // 编辑
        const { error } = await supabase
          .from('notification_templates')
          .update(values)
          .eq('id', editing.id);
        if (error) {
          console.error('[TEMPLATE][handleOk] 更新失败:', error);
          throw error;
        }
        message.success('模板更新成功');
      } else {
        console.log('[TEMPLATE][handleOk] 新增模式，values:', values);
        // 新增
        const { error } = await supabase
          .from('notification_templates')
          .insert([values]);
        if (error) {
          console.error('[TEMPLATE][handleOk] 新增失败:', error);
          throw error;
        }
        message.success('模板创建成功');
      }
      setModalOpen(false);
      setEditing(null);
      form.resetFields();
      fetchTemplates();
    } catch (e: any) {
      console.error('[TEMPLATE][handleOk] 操作失败:', e);
      message.error(e.message || '操作失败');
    }
  };

  // 删除模板
  const handleDelete = async (id: number) => {
    console.log('[TEMPLATE][handleDelete] 删除模板，id:', id);
    const { error } = await supabase
      .from('notification_templates')
      .delete()
      .eq('id', id);
    if (error) {
      console.error('[TEMPLATE][handleDelete] 删除失败:', error);
      message.error('删除失败');
    } else {
      message.success('删除成功');
      fetchTemplates();
    }
  };

  // 打开编辑/新增弹窗
  const openModal = (record?: any) => {
    console.log('[TEMPLATE][openModal] 打开弹窗，record:', record);
    setEditing(record || null);
    setModalOpen(true);
    if (record) {
      form.setFieldsValue(record);
    } else {
      form.resetFields();
      form.setFieldsValue({ is_active: true });
    }
  };

  const columns = [
    { title: '类型(type)', dataIndex: 'type', key: 'type', render: (t: string) => <Tag color="blue">{t}</Tag> },
    { title: '标题(title)', dataIndex: 'title', key: 'title' },
    { title: '内容(content)', dataIndex: 'content', key: 'content', ellipsis: true },
    { title: '启用', dataIndex: 'is_active', key: 'is_active', render: (v: boolean) => v ? <Tag color="green">启用</Tag> : <Tag>停用</Tag> },
    {
      title: '操作',
      key: 'action',
      render: (_: any, record: any) => (
        <Space>
          <Button icon={<EditOutlined />} onClick={() => openModal(record)} />
          <Popconfirm title="确定删除？" onConfirm={() => handleDelete(record.id)}>
            <Button icon={<DeleteOutlined />} danger />
          </Popconfirm>
        </Space>
      )
    }
  ];

  return (
    <div style={{ padding: 24 }}>
      <h2>通知模板管理</h2>
      <Button type="primary" icon={<PlusOutlined />} style={{ marginBottom: 16 }} onClick={() => openModal()}>
        新增模板
      </Button>
      <Table
        columns={columns}
        dataSource={templates}
        rowKey="id"
        loading={loading}
        bordered
        pagination={{ pageSize: 10 }}
      />
      <Modal
        title={editing ? '编辑模板' : '新增模板'}
        open={modalOpen}
        onOk={handleOk}
        onCancel={() => { setModalOpen(false); setEditing(null); }}
        destroyOnClose
      >
        {/* 修正表单结构，确保每个 Form.Item 只有一个直接子元素 */}
        <Form form={form} layout="vertical">
          <Form.Item name="type" label="类型(type)" rules={[{ required: true, message: '请输入类型' }]}> 
            <Input placeholder="如 welcome, first_login, reset_success" />
          </Form.Item>
          <Form.Item name="title" label="标题(title)" rules={[{ required: true, message: '请输入标题' }]}> 
            <Input />
          </Form.Item>
          <Form.Item name="content" label="内容(content)" rules={[{ required: true, message: '请输入内容' }]}> 
            <Input.TextArea rows={4} placeholder="支持 {{name}} 等变量" />
          </Form.Item>
          <Form.Item name="is_active" label="启用" valuePropName="checked" initialValue={true}> 
            <Switch />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default NotificationTemplateManager; 