import React, { useEffect, useState } from 'react';
import { Table, Button, Modal, Form, Input, Switch, InputNumber, Upload, message, Image, Select, Tabs } from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined, UploadOutlined } from '@ant-design/icons';
import { fetchBanners, fetchBannersByPageType, createBanner, updateBanner, deleteBanner } from '../api/bannersApi';
import { supabase } from '../supaClient';
// 已迁移到ImageUpload组件，不再需要直接导入
import { toBeijingTime } from '../utils/timeUtils';
import ImageUpload from '../components/ImageUpload';

interface Banner {
  id?: number;
  title: string;
  description?: string;
  image_url: string;
  sort_order: number;
  is_active: boolean;
  page_type?: string;
  jump_type?: string;
  jump_target?: string;
}

// 3x精度压缩功能已迁移到ImageUpload组件中

const BannerManagement: React.FC = () => {
  const [banners, setBanners] = useState<Banner[]>([]);
  const [loading, setLoading] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [editingBanner, setEditingBanner] = useState<Banner | null>(null);
  const [form] = Form.useForm();
  const [uploading, setUploading] = useState(false);
  const [imageUrl, setImageUrl] = useState('');
  const [formReady, setFormReady] = useState(false);
  const [activeTab, setActiveTab] = useState('home');

  const pageTypeOptions = [
    { key: 'home', label: '首页轮播图', description: '首页顶部轮播图展示' },
    { key: 'live_stream_registration', label: '直播报名页', description: '直播报名页面顶部banner' },
    { key: 'other', label: '其他页面', description: '其他页面的banner' }
  ];

  const loadBanners = async (pageType?: string) => {
    setLoading(true);
    try {
      const data = pageType 
        ? await fetchBannersByPageType(pageType)
        : await fetchBanners();
      setBanners(data);
    } catch (e) {
      message.error('获取轮播图失败');
    }
    setLoading(false);
  };

  useEffect(() => {
    loadBanners(activeTab);
  }, [activeTab]);

  const handleAdd = () => {
    setEditingBanner(null);
    setImageUrl('');
    setModalVisible(true);
    setFormReady(false);
  };

  const handleEdit = (record: Banner) => {
    setEditingBanner(record);
    setImageUrl(record.image_url);
    setModalVisible(true);
    setFormReady(false);
  };

  // Modal 渲染后再 setFieldsValue，确保编辑/新建都能正确填充
  useEffect(() => {
    if (modalVisible && !formReady) {
      if (editingBanner) {
        form.setFieldsValue({
          title: editingBanner.title || '',
          description: editingBanner.description || '',
          sort_order: editingBanner.sort_order ?? 0,
          is_active: editingBanner.is_active ?? true,
          page_type: editingBanner.page_type || activeTab,
          jump_type: editingBanner.jump_type || 'none',
          jump_target: editingBanner.jump_target || ''
        });
      } else {
        form.setFieldsValue({
          title: '',
          description: '',
          sort_order: 0,
          is_active: true,
          page_type: activeTab,
          jump_type: 'none',
          jump_target: ''
        });
      }
      setFormReady(true);
    }
  }, [modalVisible, editingBanner, form, formReady, activeTab]);

  // Modal 关闭时重置 imageUrl 和表单
  const handleModalCancel = () => {
    setModalVisible(false);
    setImageUrl('');
    form.resetFields();
  };

  const initialFormValues = {
    title: '',
    description: '',
    sort_order: 0,
    is_active: true,
    page_type: activeTab,
    jump_type: 'none',
    jump_target: ''
  };

  // useEffect 只做 imageUrl 的同步，不再 setFieldsValue
  React.useEffect(() => {
    if (modalVisible && !editingBanner) {
      form.setFieldsValue(initialFormValues);
    }
  }, [modalVisible, editingBanner, form]);

  const handleDelete = async (id: number) => {
    await deleteBanner(id);
    message.success('删除成功');
    loadBanners(activeTab);
  };

  const handleOk = async () => {
    try {
      const values = await form.validateFields();
      if (!imageUrl) {
        message.error('请上传图片');
        return;
      }
      const data = { ...values, image_url: imageUrl };
      if (editingBanner) {
        await updateBanner(editingBanner.id!, data);
        message.success('编辑成功');
      } else {
        await createBanner(data);
        message.success('新建成功');
      }
      setModalVisible(false);
      setImageUrl('');
      form.resetFields();
      loadBanners(activeTab);
    } catch (err) { 
      // 校验失败，不做处理，antd 会自动高亮错误项
    }
  };

  // 横幅上传成功处理
  const handleBannerUploadSuccess = (url: string) => {
    setImageUrl(url);
    message.success('上传成功');
  };

  const handleBannerUploadError = (error: string) => {
    message.error('上传失败: ' + error);
  };

  const columns = [
    { title: '图片', dataIndex: 'image_url', render: (url: string, _record: Banner) => <Image src={url} width={120} /> },
    { title: '标题', dataIndex: 'title', render: (text: string, _record: Banner) => text },
    { title: '页面类型', dataIndex: 'page_type', render: (text: string, _record: Banner) => { 
      const option = pageTypeOptions.find(opt => opt.key === text);
      return option ? option.label : text;
    }},
    { title: '排序', dataIndex: 'sort_order', render: (text: number, _record: Banner) => text },
    { title: '状态', dataIndex: 'is_active', render: (v: boolean, _record: Banner) => v ? '上架' : '下架' },
    { title: '点击后动作', dataIndex: 'jump_type', render: (v: string, record: Banner) => v === 'none' || !v ? '无' : `${v}：${record.jump_target || ''}` },
    { title: '操作', render: (_: any, record: Banner) => (
      <>
        <Button icon={<EditOutlined />} size="small" onClick={() => handleEdit(record)} style={{ marginRight: 8 }}>编辑</Button>
        <Button icon={<DeleteOutlined />} size="small" danger onClick={() => handleDelete(record.id!)}>删除</Button>
      </>
    ) },
  ];

  return (
    <div style={{ padding: 24 }}>
      <Tabs
        activeKey={activeTab}
        onChange={setActiveTab}
        items={pageTypeOptions.map(option => ({
          key: option.key,
          label: (
            <div>
              <div style={{ fontWeight: '600' }}>{option.label}</div>
              <div style={{ fontSize: '12px', color: '#999' }}>{option.description}</div>
            </div>
          ),
          children: (
            <div>
              <Button type="primary" icon={<PlusOutlined />} onClick={handleAdd} style={{ marginBottom: 16 }}>
                新建{option.label}
              </Button>
              <Table rowKey="id" columns={columns} dataSource={banners} loading={loading} />
            </div>
          )
        }))}
      />
      <Modal
        title={editingBanner ? '编辑轮播图' : '新建轮播图'}
        open={modalVisible}
        onOk={handleOk}
        onCancel={handleModalCancel}
        destroyOnHidden
      >
        <Form form={form} layout="vertical">
          <Form.Item label="标题" name="title" rules={[{ required: true, message: '请输入标题' }]}> 
            <Input autoComplete="off" />
          </Form.Item>
          <Form.Item label="描述" name="description">
            <Input.TextArea />
          </Form.Item>
          <Form.Item label="页面类型" name="page_type" rules={[{ required: true, message: '请选择页面类型' }]}> 
            <Select> 
              {pageTypeOptions.map(option => (
                <Select.Option key={option.key} value={option.key}>
                  {option.label}
                </Select.Option>
              ))}
            </Select> 
          </Form.Item>
          <Form.Item label="排序（越大越靠前）" name="sort_order" rules={[{ required: true, message: '请输入排序' }]}> 
            <InputNumber min={0} style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item label="是否上架" name="is_active" valuePropName="checked">
            <Switch />
          </Form.Item>
          <Form.Item label="点击后动作类型" name="jump_type" rules={[{ required: true, message: '请选择类型' }]}> 
            <Select> 
              <Select.Option value="none">无</Select.Option> 
              <Select.Option value="url">外链</Select.Option> 
              <Select.Option value="route">站内路由</Select.Option> 
              <Select.Option value="iframe">iframe</Select.Option> 
            </Select> 
          </Form.Item>
          <Form.Item label="目标地址" name="jump_target">
            <Input placeholder="如 https://example.com 或 /internal/page" />
          </Form.Item>
          {/* 图片上传项不加 name，只做展示和上传按钮 */}
          <Form.Item label={`图片（${activeTab === 'live_stream_registration' ? '3x精度5760x600' : '3x精度5760x1500'}，支持裁剪）`}>
            <ImageUpload
              bucket="banners"
              filePath={`banner/${toBeijingTime(new Date()).valueOf()}.jpg`}
              onUploadSuccess={handleBannerUploadSuccess}
              onUploadError={handleBannerUploadError}
              enableCrop={true}
              cropShape="rect"
              cropAspect={activeTab === 'live_stream_registration' ? 9.6 : 3.84}
              cropQuality={1}
              cropTitle={`裁剪图片为${activeTab === 'live_stream_registration' ? '5760x600' : '5760x1500'}比例`}
              showCropGrid={true}
              compressionOptions={{
                maxSizeMB: 1,          // 中等压缩：1MB
                maxWidthOrHeight: activeTab === 'live_stream_registration' ? 3840 : 3840, // 中等压缩：2x精度
                useWebWorker: true
              }}
              accept="image/*"
              buttonText="上传图片"
              buttonIcon={<UploadOutlined />}
              previewWidth={240}
              previewHeight={activeTab === 'live_stream_registration' ? 25 : 63}
              currentImageUrl={imageUrl || undefined}
              loading={uploading}
            />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default BannerManagement; 