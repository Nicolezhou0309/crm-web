import React, { useState, useEffect, useRef } from 'react';
import { 
  Card, Tabs, Button, Image, Modal, message, Space, 
  Alert, Typography, Row, Col, Select, Input, Table, Tag,
  Spin, Tooltip, Avatar, Form,
  Slider} from 'antd';
import { 
  TrophyOutlined, UploadOutlined, EyeOutlined, DeleteOutlined,
  GiftOutlined, ReloadOutlined,
  EditOutlined, PlusOutlined, SaveOutlined} from '@ant-design/icons';
import { supabase } from '../supaClient';
import { AchievementTriggers } from '../utils/achievementTriggers';
import imageCompression from 'browser-image-compression';
import Cropper from 'react-easy-crop';
import { Modal as AntdModal } from 'antd';
import { useUser } from '../context/UserContext';
import { toBeijingDateTimeStr } from '../utils/timeUtils';

const { Title, Text } = Typography;
const { Option } = Select;
const { TextArea } = Input;

interface AvatarFrame {
  id: string;
  name: string;
  description?: string;
  frame_type: string;
  frame_data: any;
  rarity: string;
  icon_url?: string;
  is_active: boolean;
  sort_order: number;
  code?: string;
  created_at: string;
}

interface User {
  id: number;
  nickname: string;
  email: string;
  avatar_url?: string;
}

interface GrantRecord {
  id: string;
  user_id: number;
  achievement_id: string;
  old_progress: number;
  new_progress: number;
  progress_change: number;
  trigger_source: string;
  trigger_data: any;
  created_at: string;
  user_name: string;
  frame_name: string;
}

interface FrameEditData {
  scale: number;
  rotate: number;
  x: number;
  y: number;
  opacity: number;
}

// 裁剪图片为PNG，保留透明通道
function getCroppedImg(imageSrc: string, crop: any): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const image = new window.Image();
    image.crossOrigin = 'anonymous';
    image.onload = () => {
      const canvas = document.createElement('canvas');
      const EXPORT_SIZE = 450; // 5x 高清导出
      canvas.width = EXPORT_SIZE;
      canvas.height = EXPORT_SIZE;
      const ctx = canvas.getContext('2d');
      if (!ctx) return reject('canvas context is null');
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(
        image,
        crop.x,
        crop.y,
        crop.width,
        crop.height,
        0,
        0,
        canvas.width,
        canvas.height
      );
      canvas.toBlob((blob) => {
        if (blob) resolve(blob);
        else reject('裁剪导出失败');
      }, 'image/png');
    };
    image.onerror = reject;
    image.src = imageSrc;
  });
}

// AvatarFrameCropper 组件内：
const CROP_BOX_SIZE = 360; // 裁剪弹窗显示区，放大一倍
const FRAME_CROP_PX = 300; // 固定画框高亮区尺寸，放大一倍
const AVATAR_PLACEHOLDER_PX = 150; // 头像占位符尺寸，2:1，放大一倍
// 自定义头像框裁剪弹窗组件
const AvatarFrameCropper: React.FC<{
  open: boolean;
  image: string | undefined;
  onClose: () => void;
  onCropComplete: (croppedBlob: Blob) => void;
}> = ({ open, image, onClose, onCropComplete }) => {
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  const handleOk = async () => {
    if (!image || !croppedAreaPixels) return;
    setLoading(true);
    try {
      const blob = await getCroppedImg(image, croppedAreaPixels);
      onCropComplete(blob);
    } catch (e) {
      // 可加错误提示
    } finally {
      setLoading(false);
    }
  };

  return (
    <AntdModal
      open={open}
      onCancel={onClose}
      title="裁剪头像框"
      width={CROP_BOX_SIZE + 80}
      footer={null}
      destroyOnHidden
    >
      <div
        style={{
          position: 'relative',
          width: CROP_BOX_SIZE,
          height: CROP_BOX_SIZE,
          margin: '0 auto',
        }}
      >
        {/* 高亮画框 */}
        <div style={{
          position: 'absolute',
          left: (CROP_BOX_SIZE - FRAME_CROP_PX) / 2,
          top: (CROP_BOX_SIZE - FRAME_CROP_PX) / 2,
          width: FRAME_CROP_PX,
          height: FRAME_CROP_PX,
          border: '2px solid #1890ff',
          borderRadius: '16px',
          boxSizing: 'border-box',
          zIndex: 4,
          pointerEvents: 'none',
        }} />
        {/* 头像占位符 */}
        <div style={{
          position: 'absolute',
          left: (CROP_BOX_SIZE - AVATAR_PLACEHOLDER_PX) / 2,
          top: (CROP_BOX_SIZE - AVATAR_PLACEHOLDER_PX) / 2,
          width: AVATAR_PLACEHOLDER_PX,
          height: AVATAR_PLACEHOLDER_PX,
          borderRadius: '50%',
          background: '#e0e0e0',
          boxShadow: '0 0 0 2px #fff',
          zIndex: 2,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          pointerEvents: 'none',
        }}>
          <svg
            width={AVATAR_PLACEHOLDER_PX * 0.64}
            height={AVATAR_PLACEHOLDER_PX * 0.64}
            viewBox="0 0 80 80"
            fill="none"
            style={{ opacity: 0.5 }}
          >
            <circle cx="40" cy="40" r="40" fill="none" />
            <ellipse cx="40" cy="34" rx="16" ry="16" fill="#bdbdbd" />
            <ellipse cx="40" cy="62" rx="24" ry="14" fill="#bdbdbd" />
          </svg>
        </div>
        {/* Cropper组件，头像框图片，包裹头像 */}
        <div style={{
          position: 'absolute',
          left: 0,
          top: 0,
          width: CROP_BOX_SIZE,
          height: CROP_BOX_SIZE,
          zIndex: 3,
        }}>
          <Cropper
            image={image}
            crop={crop}
            zoom={zoom}
            aspect={1}
            cropShape="rect"
            showGrid={false}
            restrictPosition={false}
            cropSize={{ width: FRAME_CROP_PX, height: FRAME_CROP_PX }}
            onCropChange={setCrop}
            onZoomChange={setZoom}
            onCropComplete={(_, croppedPixels) => setCroppedAreaPixels(croppedPixels)}
          />
        </div>
      </div>
      <div style={{ marginTop: 24, display: 'flex', alignItems: 'center' }}>
        <span style={{ minWidth: 48 }}>缩放：</span>
        <Slider
          min={0.5}
          max={5}
          step={0.01}
          value={zoom}
          onChange={setZoom}
          style={{ flex: 1, marginLeft: 8 }}
        />
      </div>
      <div style={{ marginTop: 24, textAlign: 'right' }}>
        <Button onClick={onClose} style={{ marginRight: 8 }}>取消</Button>
        <Button type="primary" loading={loading} onClick={handleOk}>确定</Button>
      </div>
    </AntdModal>
  );
};

// 头像框上传/更换图片按钮组件（编辑弹窗专用）
const AvatarFrameUploadButton: React.FC<{
  editingFrame: AvatarFrame | null;
  uploading: string | null;
  setUploading: (v: string | null) => void;
  cropperVisible: boolean;
  setCropperVisible: (v: boolean) => void;
  cropperImage: string | undefined;
  setCropperImage: (v: string | undefined) => void;
  handleCropComplete: (croppedBlob: Blob) => void;
  renderFramePreview: () => React.ReactNode;
  setPendingFrameId?: (id: string) => void;
}> = ({
  editingFrame,
  uploading,
  cropperVisible,
  setCropperVisible,
  cropperImage,
  setCropperImage,
  handleCropComplete,
  renderFramePreview,
  setPendingFrameId
}) => (
  <>
    <input
      type="file"
      accept="image/png,image/webp,image/jpeg,image/jpg"
      style={{ display: 'none' }}
      id={editingFrame?.id === 'add' ? 'avatar-frame-add-upload-input' : 'avatar-frame-upload-input'}
      onChange={e => {
        if (!editingFrame) return;
        const file = e.target.files?.[0];
        if (!file) return;
        if (editingFrame.id !== 'add' && setPendingFrameId) {
          setPendingFrameId(editingFrame.id);
        }
        const reader = new FileReader();
        reader.onload = (ev) => {
          setCropperImage(ev.target?.result as string);
          setCropperVisible(true);
        };
        reader.readAsDataURL(file);
      }}
      disabled={!editingFrame}
    />
    <Button
      icon={<UploadOutlined />}
      size="small"
      loading={uploading === editingFrame?.id}
      style={{ marginBottom: 8 }}
      onClick={() => {
        if (editingFrame) {
          const input = document.getElementById(
            editingFrame.id === 'add' ? 'avatar-frame-add-upload-input' : 'avatar-frame-upload-input'
          ) as HTMLInputElement;
          if (input) input.click();
        }
      }}
      disabled={!editingFrame}
    >
      {editingFrame?.icon_url ? '更换图片' : '上传图片'}
    </Button>
    {/* 裁剪弹窗 */}
    <AvatarFrameCropper
      open={cropperVisible}
      image={cropperImage}
      onClose={() => setCropperVisible(false)}
      onCropComplete={(blob) => {
        handleCropComplete(blob);
      }}
    />
    {/* 预览区 */}
    {renderFramePreview()}
  </>
);

export const HonorManagement: React.FC = () => {
  const { user } = useUser();
  const [avatarFrames, setAvatarFrames] = useState<AvatarFrame[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [grantRecords, setGrantRecords] = useState<GrantRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState<string | null>(null);
  const [previewVisible, setPreviewVisible] = useState(false);
  const [previewImage, setPreviewImage] = useState('');
  const [previewTitle, setPreviewTitle] = useState('');
  const [, setGrantModalVisible] = useState(false);
  const [selectedUsers, setSelectedUsers] = useState<number[]>([]);
  const [selectedFrames, setSelectedFrames] = useState<string[]>([]);
  const [grantNotes, setGrantNotes] = useState('');
  
  // 头像框编辑相关状态
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [editingFrame, setEditingFrame] = useState<AvatarFrame | null>(null);
  const [frameEditData, setFrameEditData] = useState<FrameEditData>({
    scale: 1,
    rotate: 0,
    x: 0,
    y: 0,
    opacity: 1
  });
  const [editForm] = Form.useForm();

  // 新增头像框相关状态
  const [addModalVisible, setAddModalVisible] = useState(false);
  const [addForm] = Form.useForm();
  const newFrameIdRef = useRef<string | null>(null);
  // 新增头像框图片上传与裁剪相关状态
  const [addFrameImageUrl, setAddFrameImageUrl] = useState<string | null>(null);
  const [addCropperVisible, setAddCropperVisible] = useState(false);
  const [addCropperImage, setAddCropperImage] = useState<string | undefined>(undefined);
  const [addUploading, setAddUploading] = useState(false);

  // 新增：头像框搜索相关状态
  const [frameSearchText, setFrameSearchText] = useState('');
  const [frameRarityFilter, setFrameRarityFilter] = useState<string>('all');

  // 新增头像框选择图片后弹出裁剪弹窗

  // 新增头像框裁剪完成后上传图片
  const handleAddCropComplete = async (croppedBlob: Blob) => {
    setAddUploading(true);
    try {
      // 上传到 Storage
      const file = new File([croppedBlob], `avatar-frame-add-${Date.now()}.png`, { type: 'image/png' });
      const fileName = `avatar-frame-add-${Date.now()}.png`;
      const filePath = `avatar-frames/${fileName}`;
      const { error } = await supabase.storage
        .from('achievement-icons')
        .upload(filePath, file);
      if (error) {
        console.error('[handleAddCropComplete] 上传出错', error);
      }
      if (error) throw error;
      const { data: { publicUrl } } = supabase.storage
        .from('achievement-icons')
        .getPublicUrl(filePath);
      setAddFrameImageUrl(publicUrl);
      message.success('图片上传成功');
    } catch (e) {
      console.error('[handleAddCropComplete] catch', e);
      message.error('图片上传失败');
    } finally {
      setAddUploading(false);
      setAddCropperVisible(false);
      setAddCropperImage(undefined);
    }
  };

  // 设计规范
  const designSpecs = {
    title: "头像框设计规范",
    specs: [
      "建议图像框尺寸：450x450px（正方形），头像和头像框画布比例为1:2尺寸",
      "文件格式：PNG（支持透明背景）"
    ]
  };

  // 新增：裁剪弹窗相关状态
  const [cropperVisible, setCropperVisible] = useState(false);
  const [cropperImage, setCropperImage] = useState<string | undefined>(undefined);
  const [pendingFrameId, setPendingFrameId] = useState<string | null>(null);

  // 选择图片后弹出裁剪弹窗

  // 裁剪完成后处理
  const handleCropComplete = async (croppedBlob: Blob) => {
    if (!pendingFrameId) {
      console.warn('[handleCropComplete] pendingFrameId is null, abort upload');
      return;
    }
    setUploading(pendingFrameId);
    try {
      // 保证输出为 PNG
      const file = new File([croppedBlob], `avatar-frame-${pendingFrameId}.png`, { type: 'image/png' });
      await handleFrameImageUpload(file, pendingFrameId);
    } catch (e) {
      message.error('图片上传失败');
    } finally {
      setUploading(null);
      setCropperVisible(false);
      setCropperImage(undefined);
      setPendingFrameId(null);
    }
  };

  // 过滤头像框列表
  const filteredAvatarFrames = avatarFrames.filter(frame => {
    const matchesSearch = frame.name.toLowerCase().includes(frameSearchText.toLowerCase()) ||
      (frame.description && frame.description.toLowerCase().includes(frameSearchText.toLowerCase()));
    const matchesRarity = frameRarityFilter === 'all' || frame.rarity === frameRarityFilter;
    return matchesSearch && matchesRarity;
  });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      // 加载头像框数据
      const { data: framesData, error: framesError } = await supabase
        .from('avatar_frames')
        .select('*')
        .eq('is_active', true)
        .order('sort_order');

      if (framesError) throw framesError;

      // 加载用户数据
      const { data: usersData, error: usersError } = await supabase
        .from('users_profile')
        .select('id, nickname, email, avatar_url')
        .eq('status', 'active')
        .order('nickname');

      if (usersError) throw usersError;

      // 加载发放记录 - 使用 achievement_progress_logs 表
      const { data: logsData, error: logsError } = await supabase
        .from('achievement_progress_logs')
        .select(`
          id, user_id, achievement_id, old_progress, new_progress, progress_change,
          trigger_source, trigger_data, created_at,
          users_profile!inner(nickname),
          achievements!inner(name)
        `)
        .eq('trigger_source', 'honor_grant')
        .order('created_at', { ascending: false })
        .limit(50);

      if (logsError) throw logsError;

      // 转换发放记录数据格式
      const formattedGrantRecords: GrantRecord[] = (logsData || []).map((record: any) => ({
        id: record.id,
        user_id: record.user_id,
        achievement_id: record.achievement_id,
        old_progress: record.old_progress,
        new_progress: record.new_progress,
        progress_change: record.progress_change,
        trigger_source: record.trigger_source,
        trigger_data: record.trigger_data,
        created_at: record.created_at,
        user_name: record.users_profile?.nickname || '未知用户',
        frame_name: record.achievements?.name || '未知头像框'
      }));

      setAvatarFrames(framesData || []);
      setUsers(usersData || []);
      setGrantRecords(formattedGrantRecords);
    } catch (error) {
      console.error('加载数据失败:', error);
      message.error('加载数据失败');
    } finally {
      setLoading(false);
    }
  };

  const handleFrameImageUpload = async (file: File, frameId: string) => {
    setUploading(frameId);
    try {
      // 先查找当前头像框的原图片URL
      const { data: frameData, error: frameError } = await supabase
        .from('avatar_frames')
        .select('icon_url')
        .eq('id', frameId)
        .single();
      if (frameError) throw frameError;
      const oldUrl = frameData?.icon_url;
      // 删除原图片（如有）
      if (oldUrl) {
        // 提取文件名
        const fileName = oldUrl.split('/').pop();
        if (fileName) {
          await supabase.storage
            .from('achievement-icons')
            .remove([`avatar-frames/${fileName}`]);
        }
      }
      // 打印原始文件类型
      // 压缩图片（不设置 fileType，保持原格式）
      const options = {
        maxSizeMB: 0.2,
        useWebWorker: true,
        fileType: 'image/png' // 保证透明通道
      };
      const compressedFile = await imageCompression(file, options);

      // 上传到 Supabase Storage
      const fileExt = compressedFile.name.split('.').pop() || 'png';
      const fileName = `avatar-frame-${frameId}-${Date.now()}.${fileExt}`;
      const filePath = `avatar-frames/${fileName}`;

      const { error } = await supabase.storage
        .from('achievement-icons')
        .upload(filePath, compressedFile);

      if (error) {
        console.error('[handleFrameImageUpload] 上传出错', error);
      }
      if (error) throw error;

      // 获取公共URL
      const { data: { publicUrl } } = supabase.storage
        .from('achievement-icons')
        .getPublicUrl(filePath);

      // 更新数据库
      const { error: updateError } = await supabase
        .from('avatar_frames')
        .update({ 
          icon_url: publicUrl,
          updated_at: toBeijingDateTimeStr(new Date())
        })
        .eq('id', frameId);

      if (updateError) throw updateError;

      message.success('头像框图片上传成功');
      await loadData();
    } catch (error) {
      console.error('头像框图片上传失败:', error);
      message.error('图片上传失败');
    } finally {
      setUploading(null);
    }
  };

  const deleteFrameImage = async (frameId: string, iconUrl: string) => {
    try {
      // 从 Storage 删除文件
      const fileName = iconUrl.split('/').pop();
      if (fileName) {
        const { error: storageError } = await supabase.storage
          .from('achievement-icons')
          .remove([`avatar-frames/${fileName}`]);

        if (storageError) console.warn('删除存储文件失败:', storageError);
      }

      // 更新数据库
      const { error: updateError } = await supabase
        .from('avatar_frames')
        .update({ 
          icon_url: null,
          updated_at: toBeijingDateTimeStr(new Date())
        })
        .eq('id', frameId);

      if (updateError) throw updateError;

      message.success('头像框图片删除成功');
      await loadData();
    } catch (error) {
      console.error('删除头像框图片失败:', error);
      message.error('删除失败');
    }
  };

  const openEditModal = (frame: AvatarFrame) => {
    setEditingFrame(frame);
    setFrameEditData({
      scale: frame.frame_data?.scale || 1,
      rotate: frame.frame_data?.rotate || 0,
      x: frame.frame_data?.x || 0,
      y: frame.frame_data?.y || 0,
      opacity: frame.frame_data?.opacity || 1
    });
    editForm.setFieldsValue({
      name: frame.name,
      description: frame.description,
      frame_type: frame.frame_type,
      rarity: frame.rarity,
      code: frame.code
    });
    setEditModalVisible(true);
  };

  const saveFrameEdit = async () => {
    try {
      const formData = await editForm.validateFields();
      
      if (!editingFrame) return;

      const updatedFrameData = {
        ...editingFrame.frame_data,
        ...frameEditData,
        ...formData
      };

      const { error } = await supabase
        .from('avatar_frames')
        .update({
          name: formData.name,
          description: formData.description,
          frame_type: formData.frame_type,
          rarity: formData.rarity,
          code: formData.code,
          frame_data: updatedFrameData,
          updated_at: toBeijingDateTimeStr(new Date())
        })
        .eq('id', editingFrame.id);

      if (error) throw error;

      message.success('头像框设置保存成功');
      setEditModalVisible(false);
      await loadData();
    } catch (error) {
      console.error('保存头像框设置失败:', error);
      message.error('保存失败');
    }
  };

  const grantFrames = async () => {
    if (selectedUsers.length === 0 || selectedFrames.length === 0) {
      message.warning('请选择用户和头像框');
      return;
    }

    try {
      const grantedBy = user?.id;

      // 批量发放头像框
      const grantPromises = selectedUsers.flatMap(userId =>
        selectedFrames.map(async frameId => {
          const { data, error, status, statusText } = await supabase
            .from('user_avatar_frames')
            .upsert({
              user_id: userId,
              frame_id: frameId,
              unlocked_at: toBeijingDateTimeStr(new Date())
            }, { onConflict: 'user_id,frame_id' });
          if (error) {
            console.error('[发放头像框] 插入失败:', {
              error,
              status,
              statusText,
              user_id: userId,
              frame_id: frameId
            });
          } else {
          }
          return { data, error };
        })
      );

      // 使用自定义触发器记录发放记录
      const logPromises = selectedUsers.flatMap(userId =>
        selectedFrames.map(async frameId => {
          const frame = avatarFrames.find(f => f.id === frameId);
          try {
            await AchievementTriggers.onHonorGranted(
              userId,
              frameId,
              frame?.name || '未知头像框',
              Number(grantedBy) || 0,
              grantNotes
            );
          } catch (err) {
            console.error('[发放头像框] 发放日志写入失败:', err);
          }
        })
      );

      await Promise.all([...grantPromises, ...logPromises]);

      message.success(`成功发放 ${selectedUsers.length * selectedFrames.length} 个头像框`);
      setGrantModalVisible(false);
      setSelectedUsers([]);
      setSelectedFrames([]);
      setGrantNotes('');
      await loadData();
    } catch (error) {
      console.error('发放头像框失败:', error);
      message.error('发放失败');
    }
  };

  // 新增头像框
  const handleAddFrame = async () => {
    try {
      const values = await addForm.validateFields();
      const frameData = {
        border: '2px solid #e0e0e0',
        borderRadius: '50%'
      };
      const { data, error } = await supabase
        .from('avatar_frames')
        .insert({
          name: values.name,
          description: values.description,
          frame_type: values.frame_type,
          rarity: values.rarity,
          code: values.code,
          frame_data: frameData,
          is_active: true,
          sort_order: 0,
          icon_url: addFrameImageUrl || null
        })
        .select('id')
        .single();
      if (error) throw error;
      message.success('新增头像框成功');
      setAddModalVisible(false);
      addForm.resetFields();
      setAddFrameImageUrl(null);
      newFrameIdRef.current = data.id;
      await loadData();
      // 自动进入编辑状态
      const newFrame = (await supabase
        .from('avatar_frames')
        .select('*')
        .eq('id', data.id)
        .single()).data;
      if (newFrame) openEditModal(newFrame);
    } catch (error) {
      console.error('新增头像框失败:', error);
      message.error('新增失败');
    }
  };

  const renderFrameCard = (frame: AvatarFrame) => {
    return (
      <Card
        key={frame.id}
        hoverable
        style={{ 
          marginBottom: 16,
          height: 300, // 固定卡片高度
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          overflow: 'hidden'
        }}
        styles={{
          body: {
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            padding: '16px',
            height: '100%'
          }
        }}
      >
        <div style={{ 
          textAlign: 'center',
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          height: '100%'
        }}>
          {/* 头像框图片区域 */}
          <div style={{ 
            marginBottom: 12,
            height: 120,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}>
            {frame.icon_url ? (
              <Image
                src={frame.icon_url}
                alt={frame.name}
                width={90}
                height={90}
                style={{ objectFit: 'contain' }}
                preview={false}
              />
            ) : (
              <div
                style={{
                  width: 90,
                  height: 90,
                  borderRadius: '50%',
                  border: '2px solid #d9d9d9',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '24px',
                  ...frame.frame_data
                }}
              >
                👤
              </div>
            )}
          </div>
          {/* 文字信息区域 */}
          <div style={{ 
            flex: 1, 
            display: 'flex', 
            flexDirection: 'column', 
            justifyContent: 'space-between',
            minHeight: 80,
            overflow: 'hidden'
          }}>
            <Title level={5} style={{ margin: '8px 0', fontSize: '14px', lineHeight: '1.4' }}>
              {frame.name}
            </Title>
            <Text type="secondary" style={{ 
              fontSize: '12px', 
              marginBottom: 8,
              lineHeight: '1.3',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              display: '-webkit-box',
              WebkitLineClamp: 2,
              WebkitBoxOrient: 'vertical',
              maxHeight: 36
            }}>
              {frame.description || '暂无描述'}
            </Text>
            <Tag color={getRarityColor(frame.rarity)} style={{ marginBottom: 8, alignSelf: 'center' }}>
              {getRarityText(frame.rarity)}
            </Tag>
          </div>
        </div>
        {/* 操作按钮区，固定在卡片底部 */}
        <div style={{
          display: 'flex',
          justifyContent: 'space-around',
          alignItems: 'center',
          borderTop: '1px solid #f0f0f0',
          paddingTop: 8,
          marginTop: 8
        }}>
          <Tooltip title="预览">
            <EyeOutlined onClick={() => {
              if (frame.icon_url) {
                setPreviewImage(frame.icon_url);
                setPreviewTitle(frame.name);
                setPreviewVisible(true);
              }
            }} style={{ fontSize: 16, color: '#888', cursor: 'pointer' }} />
          </Tooltip>
          <Tooltip title="编辑设置">
            <EditOutlined onClick={() => openEditModal(frame)} style={{ fontSize: 16, color: '#1890ff', cursor: 'pointer' }} />
          </Tooltip>
          <Tooltip title="删除图片">
            <DeleteOutlined 
              onClick={() => frame.icon_url && deleteFrameImage(frame.id, frame.icon_url)}
              style={{ fontSize: 16, color: '#ff4d4f', cursor: 'pointer' }}
            />
          </Tooltip>
        </div>
      </Card>
    );
  };

  // 优化头像框预览区的展示效果
  const renderFramePreview = () => {
    if (!editingFrame?.icon_url) return null;

    // 头像框包裹头像，尺寸与裁剪弹窗一致
    const previewBoxSize = 200;
    const avatarSize = 120;
    const frameSize = 180; // 头像框略大于头像

    return (
      <div style={{
        position: 'relative',
        width: previewBoxSize,
        height: previewBoxSize,
        margin: '0 auto',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}>
        {/* 头像底图（灰色圆+icon） */}
        <div style={{
          position: 'absolute',
          left: '50%',
          top: '50%',
          width: avatarSize,
          height: avatarSize,
          transform: 'translate(-50%, -50%)',
          borderRadius: '50%',
          background: '#e0e0e0',
          boxShadow: '0 0 0 2px #fff',
          zIndex: 1,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}>
          <svg
            width={avatarSize * 0.5}
            height={avatarSize * 0.5}
            viewBox="0 0 80 80"
            fill="none"
            style={{ opacity: 0.5 }}
          >
            <circle cx="40" cy="40" r="40" fill="none" />
            <ellipse cx="40" cy="34" rx="16" ry="16" fill="#bdbdbd" />
            <ellipse cx="40" cy="62" rx="24" ry="14" fill="#bdbdbd" />
          </svg>
        </div>
        {/* 头像框图片，包裹头像 */}
        <img
          src={editingFrame.icon_url}
          alt="frame"
          style={{
            position: 'absolute',
            left: '50%',
            top: '50%',
            width: frameSize,
            height: frameSize,
            transform: 'translate(-50%, -50%)',
            objectFit: 'contain',
            zIndex: 2,
            pointerEvents: 'none',
          }}
        />
      </div>
    );
  };

  const getRarityColor = (rarity: string): string => {
    const colorMap: Record<string, string> = {
      'common': '#52c41a',
      'rare': '#1890ff',
      'epic': '#fa8c16',
      'legendary': '#722ed1'
    };
    return colorMap[rarity] || '#666';
  };

  const getRarityText = (rarity: string): string => {
    const textMap: Record<string, string> = {
      'common': '普通',
      'rare': '稀有',
      'epic': '史诗',
      'legendary': '传说'
    };
    return textMap[rarity] || '未知';
  };

  const grantColumns = [
    {
      title: '用户',
      dataIndex: 'user_name',
      key: 'user_name',
    },
    {
      title: '头像框',
      dataIndex: 'frame_name',
      key: 'frame_name',
    },
    {
      title: '发放时间',
      dataIndex: 'created_at',
      key: 'created_at',
      render: (text: string) => toBeijingDateTimeStr(text),
    },
    {
      title: '发放说明',
      dataIndex: 'trigger_data',
      key: 'notes',
      render: (triggerData: any) => triggerData?.notes || '-',
    }
  ];

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: 40 }}>
        <Spin size="large" />
        <div style={{ marginTop: 16 }}>加载荣誉系统数据中...</div>
      </div>
    );
  }

  return (
    <div style={{ padding: '20px' }}>
      <Card 
        title={
          <Space>
            <TrophyOutlined />
            <span>荣誉系统管理</span>
          </Space>
        }
        extra={
          <Space>
            <Button 
              type="primary"
              icon={<PlusOutlined />}
              onClick={() => setAddModalVisible(true)}
            >
              新增头像框
            </Button>
            <Button 
              icon={<ReloadOutlined />} 
              onClick={loadData}
              loading={loading}
            >
              刷新
            </Button>
          </Space>
        }
      >
        <Tabs 
          defaultActiveKey="frames"
          items={[
            {
              key: 'frames',
              label: '头像框管理',
              children: (
                <>
                  <Alert
                    message={designSpecs.title}
                    description={
                      <ul style={{ margin: 0, paddingLeft: 20 }}>
                        {designSpecs.specs.map((spec, index) => (
                          <li key={index}>{spec}</li>
                        ))}
                      </ul>
                    }
                    type="info"
                    showIcon
                    style={{ marginBottom: 24 }}
                  />
                  
                  {/* 搜索框 */}
                  <div style={{ marginBottom: 16 }}>
                    <Input.Search
                      placeholder="搜索头像框名称或描述"
                      value={frameSearchText}
                      onChange={(e) => setFrameSearchText(e.target.value)}
                      style={{ width: 300 }}
                      allowClear
                    />
                  </div>
                  
                  {/* 稀有度筛选器 */}
                  <div style={{ marginBottom: 16 }}>
                    <Space>
                      <span>稀有度筛选：</span>
                      <Select
                        value={frameRarityFilter}
                        onChange={setFrameRarityFilter}
                        style={{ width: 120 }}
                        placeholder="选择稀有度"
                      >
                        <Option value="all">全部</Option>
                        <Option value="common">普通</Option>
                        <Option value="rare">稀有</Option>
                        <Option value="epic">史诗</Option>
                        <Option value="legendary">传说</Option>
                      </Select>
                    </Space>
                  </div>
                  
                  <Row gutter={16}>
                    {filteredAvatarFrames.map(frame => (
                      <Col key={frame.id} span={4.8}>
                        {renderFrameCard(frame)}
                      </Col>
                    ))}
                  </Row>
                  
                  {/* 无搜索结果提示 */}
                  {filteredAvatarFrames.length === 0 && frameSearchText && (
                    <div style={{ textAlign: 'center', padding: '40px 0', color: '#999' }}>
                      未找到匹配的头像框
                    </div>
                  )}
                </>
              )
            },
            {
              key: 'grants',
              label: '活动发放',
              children: (
                <Space direction="vertical" style={{ width: '100%' }}>
                  <Card title="批量发放头像框" size="small">
                    <Row gutter={16}>
                      <Col span={12}>
                        <Text strong>选择用户：</Text>
                        <Select
                          mode="multiple"
                          placeholder="选择要发放的用户"
                          style={{ width: '100%', marginTop: 8 }}
                          value={selectedUsers}
                          onChange={setSelectedUsers}
                          showSearch
                          filterOption={(input, option) =>
                            (option?.children as unknown as string)?.toLowerCase().includes(input.toLowerCase())
                          }
                        >
                          {users.map(user => (
                            <Option key={user.id} value={user.id}>
                              <Space>
                                <Avatar size="small" src={user.avatar_url} />
                                {user.nickname} ({user.email})
                              </Space>
                            </Option>
                          ))}
                        </Select>
                      </Col>
                      <Col span={12}>
                        <Text strong>选择头像框：</Text>
                        <Select
                          mode="multiple"
                          placeholder="选择要发放的头像框"
                          style={{ width: '100%', marginTop: 8 }}
                          value={selectedFrames}
                          onChange={setSelectedFrames}
                        >
                          {avatarFrames.map(frame => (
                            <Option key={frame.id} value={frame.id}>
                              <Space>
                                {frame.icon_url ? (
                                  <Image src={frame.icon_url} width={16} height={16} />
                                ) : (
                                  <div style={{ width: 16, height: 16, fontSize: 12 }}>👤</div>
                                )}
                                {frame.name}
                              </Space>
                            </Option>
                          ))}
                        </Select>
                      </Col>
                    </Row>
                    
                    <div style={{ marginTop: 16 }}>
                      <Text strong>发放说明：</Text>
                      <TextArea
                        placeholder="可选：添加发放说明"
                        value={grantNotes}
                        onChange={(e) => setGrantNotes(e.target.value)}
                        style={{ marginTop: 8 }}
                        rows={3}
                      />
                    </div>

                    <div style={{ marginTop: 16 }}>
                      <Button
                        type="primary"
                        icon={<GiftOutlined />}
                        onClick={grantFrames}
                        disabled={selectedUsers.length === 0 || selectedFrames.length === 0}
                      >
                        发放 {selectedUsers.length * selectedFrames.length} 个头像框
                      </Button>
                    </div>
                  </Card>

                  <Card title="发放记录" size="small">
                    <Table
                      dataSource={grantRecords}
                      columns={grantColumns}
                      rowKey="id"
                      pagination={{ pageSize: 10 }}
                      size="small"
                    />
                  </Card>
                </Space>
              )
            }
          ]}
        />
      </Card>

      {/* 新增头像框Modal */}
      <Modal
        title="新增头像框"
        open={addModalVisible}
        onCancel={() => setAddModalVisible(false)}
        onOk={handleAddFrame}
        okText="提交"
        cancelText="取消"
        destroyOnHidden
      >
        <Form form={addForm} layout="vertical">
          <Form.Item label="头像框名称" name="name" rules={[{ required: true, message: '请输入名称' }]}> 
            <Input placeholder="请输入头像框名称" />
          </Form.Item>
          <Form.Item label="描述" name="description">
            <Input placeholder="请输入描述（可选）" />
          </Form.Item>
          <Form.Item label="类型" name="frame_type" rules={[{ required: true, message: '请选择类型' }]}> 
            <Select placeholder="选择头像框类型">
              <Option value="border">边框</Option>
              <Option value="background">背景</Option>
              <Option value="overlay">覆盖</Option>
            </Select>
          </Form.Item>
          <Form.Item label="稀有度" name="rarity" rules={[{ required: true, message: '请选择稀有度' }]}> 
            <Select placeholder="选择稀有度">
              <Option value="common">普通</Option>
              <Option value="rare">稀有</Option>
              <Option value="epic">史诗</Option>
              <Option value="legendary">传说</Option>
            </Select>
          </Form.Item>
          <Form.Item label="代码" name="code">
            <Input placeholder="唯一代码（可选）" />
          </Form.Item>
          {/* 新增：图片上传与裁剪功能，复用AvatarFrameUploadButton */}
          <Form.Item label="头像框图片">
            <AvatarFrameUploadButton
              editingFrame={{
                id: 'add',
                name: '',
                frame_type: 'border',
                frame_data: {},
                rarity: 'common',
                is_active: true,
                sort_order: 0,
                created_at: '',
              }}
              uploading={addUploading ? 'add' : null}
              setUploading={v => setAddUploading(!!v)}
              cropperVisible={addCropperVisible}
              setCropperVisible={setAddCropperVisible}
              cropperImage={addCropperImage}
              setCropperImage={setAddCropperImage}
              handleCropComplete={(blob) => {
                handleAddCropComplete(blob);
              }}
              renderFramePreview={() =>
                addFrameImageUrl && (
                  <div style={{ marginTop: 8 }}>
                    <Image src={addFrameImageUrl} width={80} height={80} style={{ objectFit: 'contain' }} preview />
                  </div>
                )
              }
            />
          </Form.Item>
        </Form>
      </Modal>

      {/* 图片预览 */}
      <Modal
        open={previewVisible}
        title={previewTitle}
        footer={null}
        onCancel={() => setPreviewVisible(false)}
        destroyOnHidden
      >
        <img alt="preview" style={{ width: '100%' }} src={previewImage} />
      </Modal>

      {/* 头像框编辑Modal */}
      <Modal
        title="编辑头像框设置"
        open={editModalVisible}
        onCancel={() => setEditModalVisible(false)}
        width={800}
        footer={[
          <Button key="cancel" onClick={() => setEditModalVisible(false)}>
            取消
          </Button>,
          <Button key="save" type="primary" icon={<SaveOutlined />} onClick={saveFrameEdit}>
            保存
          </Button>
        ]}
        destroyOnHidden
      >
        <Row gutter={24}>
          <Col span={12}>
            <Form form={editForm} layout="vertical">
              <Form.Item label="头像框名称" name="name" rules={[{ required: true }]}>
                <Input placeholder="请输入头像框名称" />
              </Form.Item>
              
              <Form.Item label="描述" name="description">
                <TextArea placeholder="请输入头像框描述" rows={3} />
              </Form.Item>
              
              <Form.Item label="类型" name="frame_type" rules={[{ required: true }]}>
                <Select placeholder="选择头像框类型">
                  <Option value="border">边框</Option>
                  <Option value="background">背景</Option>
                  <Option value="overlay">覆盖</Option>
                </Select>
              </Form.Item>
              
              <Form.Item label="稀有度" name="rarity" rules={[{ required: true }]}>
                <Select placeholder="选择稀有度">
                  <Option value="common">普通</Option>
                  <Option value="rare">稀有</Option>
                  <Option value="epic">史诗</Option>
                  <Option value="legendary">传说</Option>
                </Select>
              </Form.Item>
              
              <Form.Item label="代码" name="code">
                <Input placeholder="请输入唯一代码（可选）" />
              </Form.Item>
            </Form>
          </Col>
          
          <Col span={12}>
            <div style={{ marginBottom: 16 }}>
              <Text strong>预览效果：</Text>
            </div>
            {/* 上传图片按钮和裁剪弹窗保留 */}
            <AvatarFrameUploadButton
              editingFrame={editingFrame}
              uploading={uploading}
              setUploading={setUploading}
              cropperVisible={cropperVisible}
              setCropperVisible={setCropperVisible}
              cropperImage={cropperImage}
              setCropperImage={setCropperImage}
              handleCropComplete={handleCropComplete}
              renderFramePreview={renderFramePreview}
              setPendingFrameId={setPendingFrameId}
            />
            {/* 移除图片参数配置区（缩放、旋转、透明度、X/Y偏移等Slider） */}
          </Col>
        </Row>
      </Modal>
    </div>
  );
}; 