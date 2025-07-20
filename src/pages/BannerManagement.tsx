import React, { useEffect, useState } from 'react';
import { Table, Button, Modal, Form, Input, Switch, InputNumber, Upload, message, Image, Select } from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined, UploadOutlined } from '@ant-design/icons';
import { fetchBanners, createBanner, updateBanner, deleteBanner } from '../api/bannersApi';
import { supabase } from '../supaClient';
import ImgCrop from 'antd-img-crop';

interface Banner {
  id?: number;
  title: string;
  description?: string;
  image_url: string;
  sort_order: number;
  is_active: boolean;
  jump_type?: string;
  jump_target?: string;
}

// 压缩图片为2x精度（3840x1000）
async function compressImageTo2x(file: File): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const img = new window.Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = 3840;
      canvas.height = 1000;
      const ctx = canvas.getContext('2d');
      if (!ctx) return reject('canvas context error');
      // 填充白底
      ctx.fillStyle = '#fff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      // 计算目标区域
      let sx = 0, sy = 0, sw = img.width, sh = img.height;
      // 保证比例
      const targetRatio = 3.84;
      const imgRatio = img.width / img.height;
      if (imgRatio > targetRatio) {
        // 图片太宽，裁掉两边
        sw = img.height * targetRatio;
        sx = (img.width - sw) / 2;
      } else if (imgRatio < targetRatio) {
        // 图片太高，裁掉上下
        sh = img.width / targetRatio;
        sy = (img.height - sh) / 2;
      }
      ctx.drawImage(img, sx, sy, sw, sh, 0, 0, canvas.width, canvas.height);
      canvas.toBlob(blob => {
        if (blob) resolve(blob);
        else reject('canvas toBlob error');
      }, 'image/jpeg', 0.92);
    };
    img.onerror = reject;
    img.src = URL.createObjectURL(file);
  });
}

const BannerManagement: React.FC = () => {
  const [banners, setBanners] = useState<Banner[]>([]);
  const [loading, setLoading] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [editingBanner, setEditingBanner] = useState<Banner | null>(null);
  const [form] = Form.useForm();
  const [uploading, setUploading] = useState(false);
  const [imageUrl, setImageUrl] = useState('');
  const [formReady, setFormReady] = useState(false);

  const loadBanners = async () => {
    setLoading(true);
    try {
      const data = await fetchBanners();
      console.log('[loadBanners] fetchBanners data:', data);
      setBanners(data);
      setTimeout(() => {
        console.log('[loadBanners] setBanners后 banners:', data);
      }, 0);
    } catch (e) {
      message.error('获取轮播图失败');
    }
    setLoading(false);
  };

  useEffect(() => {
    loadBanners();
  }, []);

  const handleAdd = () => {
    console.log('[handleAdd] 新建，重置 editingBanner, imageUrl, modalVisible, formReady');
    setEditingBanner(null);
    setImageUrl('');
    setModalVisible(true);
    setFormReady(false);
  };

  const handleEdit = (record: Banner) => {
    console.log('[handleEdit] record:', record);
    setEditingBanner(record);
    setImageUrl(record.image_url);
    setModalVisible(true);
    setFormReady(false);
  };

  // Modal 渲染后再 setFieldsValue，确保编辑/新建都能正确填充
  useEffect(() => {
    console.log('[useEffect] modalVisible:', modalVisible, 'formReady:', formReady, 'editingBanner:', editingBanner);
    if (modalVisible && !formReady) {
      if (editingBanner) {
        console.log('[useEffect] setFieldsValue for editingBanner:', editingBanner);
        form.setFieldsValue({
          title: editingBanner.title || '',
          description: editingBanner.description || '',
          sort_order: editingBanner.sort_order ?? 0,
          is_active: editingBanner.is_active ?? true,
          jump_type: editingBanner.jump_type || 'none',
          jump_target: editingBanner.jump_target || ''
        });
        console.log('[useEffect] form.getFieldsValue after setFieldsValue(editingBanner):', form.getFieldsValue());
      } else {
        console.log('[useEffect] setFieldsValue for new');
        form.setFieldsValue({
          title: '',
          description: '',
          sort_order: 0,
          is_active: true,
          jump_type: 'none',
          jump_target: ''
        });
        console.log('[useEffect] form.getFieldsValue after setFieldsValue(new):', form.getFieldsValue());
      }
      setFormReady(true);
    }
  }, [modalVisible, editingBanner, form, formReady]);

  // Modal 关闭时重置 imageUrl 和表单
  const handleModalCancel = () => {
    console.log('[handleModalCancel] 关闭弹窗，重置 imageUrl 和表单');
    setModalVisible(false);
    setImageUrl('');
    form.resetFields();
  };

  const initialFormValues = {
    title: '',
    description: '',
    sort_order: 0,
    is_active: true,
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
    loadBanners();
  };

  const handleOk = async () => {
    try {
      const values = await form.validateFields();
      console.log('[handleOk] 表单校验通过，values:', values, 'imageUrl:', imageUrl);
      if (!imageUrl) {
        message.error('请上传图片');
        return;
      }
      const data = { ...values, image_url: imageUrl };
      if (editingBanner) {
        console.log('[handleOk] 编辑模式，updateBanner:', editingBanner.id, data);
        await updateBanner(editingBanner.id!, data);
        message.success('编辑成功');
      } else {
        console.log('[handleOk] 新建模式，createBanner:', data);
        await createBanner(data);
        message.success('新建成功');
      }
      setModalVisible(false);
      setImageUrl('');
      form.resetFields();
      loadBanners();
    } catch (err) {
      console.log('[handleOk] 校验失败:', err);
      // 校验失败，不做处理，antd 会自动高亮错误项
    }
  };

  // Supabase Storage 上传图片，先裁剪再压缩为2x精度
  const beforeUpload = async (file: File) => {
    setUploading(true);
    try {
      // 压缩为2x精度
      const blob = await compressImageTo2x(file);
      const fileExt = 'jpg';
      const filePath = `banner/${Date.now()}.${fileExt}`;
      const { error } = await supabase.storage.from('banners').upload(filePath, blob, { upsert: true, contentType: 'image/jpeg' });
      if (error) throw error;
      const { data: publicUrlData } = supabase.storage.from('banners').getPublicUrl(filePath);
      setImageUrl(publicUrlData.publicUrl);
      message.success('上传成功');
    } catch (e) {
      message.error('上传失败');
    }
    setUploading(false);
    return false;
  };

  const columns = [
    { title: '图片', dataIndex: 'image_url', render: (url: string, record: Banner) => { console.log('[Table render] 图片', record); return <Image src={url} width={120} />; } },
    { title: '标题', dataIndex: 'title', render: (text: string, record: Banner) => { console.log('[Table render] 标题', record); return text; } },
    { title: '排序', dataIndex: 'sort_order', render: (text: number, record: Banner) => { console.log('[Table render] 排序', record); return text; } },
    { title: '状态', dataIndex: 'is_active', render: (v: boolean, record: Banner) => { console.log('[Table render] 状态', record); return v ? '上架' : '下架'; } },
    { title: '点击后动作', dataIndex: 'jump_type', render: (v: string, record: Banner) => { console.log('[Table render] 点击后动作', record); return v === 'none' || !v ? '无' : `${v}：${record.jump_target || ''}`; } },
    { title: '操作', render: (_: any, record: Banner) => (
      <>
        <Button icon={<EditOutlined />} size="small" onClick={() => handleEdit(record)} style={{ marginRight: 8 }}>编辑</Button>
        <Button icon={<DeleteOutlined />} size="small" danger onClick={() => handleDelete(record.id!)}>删除</Button>
      </>
    ) },
  ];

  console.log('[Table] banners:', banners);
  console.log('[Table] columns:', columns);

  return (
    <div style={{ padding: 24 }}>
      <Button type="primary" icon={<PlusOutlined />} onClick={handleAdd} style={{ marginBottom: 16 }}>新建轮播图</Button>
      <Table rowKey="id" columns={columns} dataSource={banners} loading={loading} />
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
          <Form.Item label="图片（1920x500，建议裁剪）">
            <ImgCrop aspect={3.84} quality={1} modalTitle="裁剪图片为1920x500比例" showGrid>
              <Upload
                name="file"
                showUploadList={false}
                accept="image/*"
                beforeUpload={beforeUpload}
                disabled={uploading}
              >
                <Button icon={<UploadOutlined />} loading={uploading}>上传图片</Button>
              </Upload>
            </ImgCrop>
            {imageUrl && <Image src={imageUrl} width={240} style={{ marginTop: 8 }} />}
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default BannerManagement; 