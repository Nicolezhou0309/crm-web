import { Form, Input, Button, message, Card, Tag, Divider, List, Typography, Space, Badge, Upload, Avatar, Modal, Tooltip } from 'antd';
import LoadingScreen from '../components/LoadingScreen';
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useRolePermissions } from '../hooks/useRolePermissions';
import { useAchievements } from '../hooks/useAchievements';
import { 
  UserOutlined, 
  KeyOutlined, 
  SafetyCertificateOutlined,
  ClockCircleOutlined,
  CheckCircleOutlined,
  ExclamationCircleOutlined,
  UploadOutlined} from '@ant-design/icons';
import ImgCrop from 'antd-img-crop';
import imageCompression from 'browser-image-compression';
import { useUser } from '../context/UserContext';
import { useAuth } from '../hooks/useAuth';
import { tokenManager } from '../utils/tokenManager';
import { supabase } from '../supaClient';
import { toBeijingTime, toBeijingDateTimeStr } from '../utils/timeUtils';

const { Title, Text } = Typography;

const Profile = () => {
  const navigate = useNavigate();
  const [form] = Form.useForm();
  const [emailForm] = Form.useForm();
  const [email, setEmail] = useState('');
  const [department] = useState<string>('');
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [avatarUploading, setAvatarUploading] = useState(false);
  const [avatarModal, setAvatarModal] = useState(false);
  const [avatarTs, setAvatarTs] = useState<number>(Date.now());
  const [loadingProfile, setLoadingProfile] = useState(true);
  
  // 使用UserContext获取用户信息
  const { user } = useUser();
  const { logout: authLogout } = useAuth();

  // 新增：user变化时自动同步email
  useEffect(() => {
    if (user?.email) {
      setEmail(user.email);
    }
  }, [user]);

  // 使用角色权限Hook
  const { 
    userRoles, 
    userPermissions, 
    loading, 
    isSuperAdmin, 
    isSystemAdmin,

    getPermissionsByCategory,
    getExpiringRoles
  } = useRolePermissions();

  const { avatarFrames, getEquippedAvatarFrame, equipAvatarFrame } = useAchievements();
  const equippedFrame = getEquippedAvatarFrame();

  // 1. fetchAll 提到组件作用域外部，且只查 avatar_url 字段
  const fetchAll = async () => {
    setLoadingProfile(true);
    if (!user) {
      setLoadingProfile(false);
      return;
    }
    const { data: profileData } = await supabase
      .from('users_profile')
      .select('avatar_url, updated_at')
      .eq('user_id', user.id)
      .single();
    setAvatarUrl(profileData?.avatar_url || null);
    setAvatarTs(profileData?.updated_at ? toBeijingTime(profileData.updated_at).valueOf() : Date.now());
    setLoadingProfile(false);
  };

  // 并行获取用户信息、部门、头像
  useEffect(() => {
    if (user) {
      fetchAll();
    }
    // 移除 nameForm 依赖
  }, [user]);

  // 监听email变化，同步到邮箱表单
  useEffect(() => {
    if (email) {
      emailForm.setFieldsValue({ email });
    }
  }, [email, emailForm]);

  // 获取即将过期的角色
  const expiringRoles = getExpiringRoles(7);

  // 获取权限按分类分组
  const permissionsByCategory = getPermissionsByCategory();

  // 头像上传处理
  const handleAvatarUpload = async (info: any) => {
    if (!user) {
      message.error('用户信息获取失败');
      return;
    }
    
    if (info.file.status === 'uploading') {
      setAvatarUploading(true);
      return;
    }
    if (info.file.status === 'done') {
      const file = info.file.originFileObj;
      const fileExt = file.name.split('.').pop();
      const filePath = `user_${user.id}_${Date.now()}.${fileExt}`;

      // 1. 获取旧头像URL
      const { data: profile } = await supabase
        .from('users_profile')
        .select('avatar_url')
        .eq('user_id', user.id)
        .single();
      const oldAvatarUrl = profile?.avatar_url;

      // 2. 上传新头像
      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(filePath, file, { upsert: true });
      if (uploadError) {
        message.error('头像上传失败');
        setAvatarUploading(false);
        return;
      }
      // 3. 获取新头像URL
      const { data } = supabase.storage.from('avatars').getPublicUrl(filePath);
      const publicUrl = data?.publicUrl;
      // 4. 更新profile表
      const { error: updateError } = await supabase
        .from('users_profile')
        .update({ avatar_url: publicUrl })
        .eq('user_id', user.id);
      if (updateError) {
        message.error('头像保存失败');
        setAvatarUploading(false);
        return;
      }
      // 5. 删除旧头像（如果有且是 avatars bucket 下的文件）
      if (oldAvatarUrl && oldAvatarUrl.includes('/avatars/')) {
        const urlParts = oldAvatarUrl.split('/');
        const oldFilePath = urlParts[urlParts.length - 1];
        if (oldFilePath) {
          const { error } = await supabase.storage.from('avatars').remove([oldFilePath]);
          if (error) {
            console.error('删除旧头像失败:', error);
          }
        } else {
          console.warn('无法解析旧头像路径');
        }
      }
      await fetchAll(); // 上传后刷新头像
      setAvatarUploading(false);
      message.success('头像上传成功');
      localStorage.setItem('avatar_refresh_token', Date.now().toString());
      window.dispatchEvent(new Event('avatar_refresh_token'));
      // 移除refreshUser调用，避免不必要的全局状态更新
    }
  };

  // 切换装备头像框
  const handleEquipFrame = async (frameId: string | null) => {
    try {
      await equipAvatarFrame(frameId ?? ''); // 取消装备时传空字符串
      message.success(frameId ? '头像框已装备' : '已恢复默认头像框');
      await fetchAll(); // 立即刷新本地
      localStorage.setItem('avatar_refresh_token', Date.now().toString());
      window.dispatchEvent(new Event('avatar_refresh_token'));
    } catch (e) {
      message.error('头像框装备失败');
    }
  };

  // 移除 handleChangeName 函数

  // 修改邮箱，增加唯一性校验
  const handleChangeEmail = async (values: any) => {
    const { email: newEmail } = values;
    // 唯一性校验
    const { data: exist } = await supabase
      .from('users_profile')
      .select('user_id')
      .eq('email', newEmail)
      .limit(1);
    if (exist && exist.length > 0) {
      message.error('该邮箱已被注册');
      return;
    }
    const { error } = await tokenManager.updateUser({ email: newEmail });
    if (error) {
      message.error(error instanceof Error ? error.message : '邮箱更新失败');
    } else {
      // 同步 users_profile.email
      if (user) {
        await supabase.from('users_profile').update({ email: newEmail }).eq('user_id', user.id);
      }
      message.success('邮箱修改成功，请前往新邮箱查收验证邮件');
      setEmail(newEmail);
    }
  };

  // 修改密码
  const handleChangePassword = async (values: any) => {
    const { oldPassword, password } = values;
    const { error: loginError } = await tokenManager.signInWithPassword(email, oldPassword);
    if (loginError) {
      message.error('旧密码错误，请重新输入');
      return;
    }
    const { error } = await tokenManager.updateUser({ password });
    if (error) {
      message.error(error instanceof Error ? error.message : '密码更新失败');
    } else {
      message.success('密码修改成功，请重新登录');
      await authLogout(navigate);
    }
  };

  return (
    <div style={{ maxWidth: 800, margin: '40px auto', padding: '0 20px' }}>
      {/* 头像+头像框预览+上传 */}
      <Card title="我的头像" style={{ marginBottom: 24 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 32 }}>
          <div style={{ width: 80, height: 80, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Avatar
              size={80}
              src={(!loadingProfile && avatarUrl) ? `${avatarUrl}?t=${avatarTs}` : undefined}
              style={{
                backgroundColor: '#1890ff',
                border: '2px solid #fff',
                objectFit: 'cover',
              }}
              icon={<UserOutlined />}
              onClick={async () => {
                if (supabase && user) {
                  const { data: profileData } = await supabase
                    .from('users_profile')
                    .select('avatar_url')
                    .eq('user_id', user.id)
                    .single();
                  if (profileData?.avatar_url) {
                    setAvatarUrl(profileData.avatar_url);
                  }
                }
                setAvatarModal(true);
              }}
            />
          </div>
          <div>
            <ImgCrop
              cropShape="round"
              aspect={1}
              quality={1}
              showGrid={false}
              showReset
              modalTitle="裁剪头像"
            >
              <Upload
                showUploadList={false}
                accept="image/png,image/jpeg,image/jpg"
                disabled={avatarUploading}
                beforeUpload={async (file) => {
                  const options = {
                    maxSizeMB: 1,
                    maxWidthOrHeight: 1024,
                    useWebWorker: true,
                  };
                  try {
                    const compressedFile = await imageCompression(file, options);
                    await handleAvatarUpload({ file: { status: 'done', originFileObj: compressedFile } });
                    return false;
                  } catch (e) {
                    const errMsg = (e && typeof e === 'object' && 'message' in e) ? (e as Error).message : String(e); 
                    message.error('图片压缩失败: ' + errMsg);
                    return false;
                  }
                }}
              >
                <Button icon={<UploadOutlined />} loading={avatarUploading}>
                  更换头像
                </Button>
              </Upload>
            </ImgCrop>
          </div>
        </div>
        {/* 大图预览 */}
        <Modal open={avatarModal} onCancel={() => setAvatarModal(false)} footer={null}>
          <img src={avatarUrl ? `${avatarUrl}?t=${avatarTs}` : ''} alt="头像预览" style={{ width: '100%' }} />
        </Modal>
      </Card>

      {/* 头像框系统 */}
      <Card title="我的头像框" style={{ marginBottom: 24 }}>
        {loadingProfile || !user ? (
          <LoadingScreen type="profile" />
        ) : (
          <div>
          <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap' }}>
            {/* 默认头像框卡片 */}
            <Tooltip title="默认头像框">
              <div
                style={{
                  borderRadius: 18,
                  background: 'linear-gradient(180deg, #f5f5f5 0%, #fff 100%)',
                  minWidth: 110,
                  minHeight: 140,
                  padding: '18px 8px 18px 8px',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  overflow: 'hidden',
                  boxShadow: !equippedFrame
                    ? '0 0 16px 2px #bfbfbf'
                    : '0 2px 8px rgba(0,0,0,0.08)',
                  margin: '8px 0',
                  cursor: 'pointer',
                  transition: 'transform 0.18s, box-shadow 0.18s',
                  transform: !equippedFrame ? 'scale(1.06)' : undefined,
                }}
                onClick={async () => {
                  await handleEquipFrame(null);
                }}
                onMouseEnter={e => e.currentTarget.style.transform = 'scale(1.08)'}
                onMouseLeave={e => e.currentTarget.style.transform = !equippedFrame ? 'scale(1.06)' : 'scale(1)'}
              >
                {/* 默认大字背景 */}
                <div style={{
                  position: 'absolute',
                  top: 2,
                  left: '50%',
                  transform: 'translateX(-50%)',
                  fontSize: 44,
                  fontWeight: 900,
                  color: '#bfbfbf',
                  opacity: 0.10,
                  pointerEvents: 'none',
                  userSelect: 'none',
                  letterSpacing: 2,
                  zIndex: 1,
                  whiteSpace: 'nowrap'
                }}>默认</div>
                <div style={{ width: 56, height: 56, borderRadius: '50%', background: '#f0f0f0', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, color: '#bbb', marginBottom: 10, zIndex: 2 }}>
                  无
                </div>
                <div style={{ textAlign: 'center', fontWeight: 600, fontSize: 15, marginBottom: 2, zIndex: 2 }}>默认</div>
              </div>
            </Tooltip>
            {/* 其余头像框卡片 */}
            {avatarFrames.length === 0}
            {avatarFrames.map(frame => {
              // 稀有度色系与大字
              let bg = '#fff';
              let bigText = '普通';
              let bigTextColor = '#bfbfbf';
              if (frame.rarity === 'legendary') {
                bg = 'linear-gradient(180deg, #ede7f6 0%, #fff 100%)';
                bigText = '传说';
                bigTextColor = '#722ed1';
              } else if (frame.rarity === 'epic') {
                bg = 'linear-gradient(180deg, #fff7e6 0%, #fff 100%)';
                bigText = '史诗';
                bigTextColor = '#fa8c16';
              } else if (frame.rarity === 'rare') {
                bg = 'linear-gradient(180deg, #e6f7ff 0%, #fff 100%)';
                bigText = '稀有';
                bigTextColor = '#1890ff';
              }
              return (
                <Tooltip 
                  title={
                    <div>
                      <div style={{ fontWeight: 'bold', marginBottom: 4 }}>{frame.name}</div>
                      {frame.description && (
                        <div style={{ fontSize: 12, color: '#ccc', marginBottom: 4 }}>
                          {frame.description}
                        </div>
                      )}
                      <div style={{ fontSize: 11, color: '#999' }}>
                        稀有度: {bigText}
                      </div>
                    </div>
                  } 
                  key={frame.frame_id}
                >
                  <div
                    style={{
                      position: 'relative',
                      borderRadius: 18,
                      background: bg,
                      minWidth: 110,
                      minHeight: 140,
                      padding: '18px 8px 18px 8px',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      overflow: 'hidden',
                      boxShadow: frame.is_equipped
                        ? `0 0 16px 2px ${bigTextColor}`
                        : '0 2px 8px rgba(0,0,0,0.08)',
                      margin: '8px 0',
                      cursor: 'pointer',
                      transition: 'transform 0.18s, box-shadow 0.18s',
                      transform: frame.is_equipped ? 'scale(1.06)' : undefined,
                    }}
                    onClick={() => handleEquipFrame(frame.frame_id)}
                    onMouseEnter={e => e.currentTarget.style.transform = 'scale(1.08)'}
                    onMouseLeave={e => e.currentTarget.style.transform = frame.is_equipped ? 'scale(1.06)' : 'scale(1)'}
                  >
                    {/* 稀有度大字背景（顶部居中） */}
                    <div style={{
                      position: 'absolute',
                      top: 2,
                      left: '50%',
                      transform: 'translateX(-50%)',
                      fontSize: 44,
                      fontWeight: 900,
                      color: bigTextColor,
                      opacity: 0.10,
                      pointerEvents: 'none',
                      userSelect: 'none',
                      letterSpacing: 2,
                      zIndex: 1,
                      whiteSpace: 'nowrap'
                    }}>{bigText}</div>
                    {/* 主内容区 */}
                    <img
                      src={frame.icon_url}
                      alt={frame.name}
                      style={{ width: 56, height: 56, borderRadius: '50%', boxShadow: '0 0 0 1px #fff', marginBottom: 10, zIndex: 2 }}
                    />
                    <div style={{ textAlign: 'center', fontWeight: 600, fontSize: 15, marginBottom: 2, zIndex: 2 }}>{frame.name}</div>
                    {/* 描述浮现 */}
                    {frame.description && (
                      <div style={{ textAlign: 'center', fontSize: 11, color: '#888', minHeight: 16, maxWidth: 80, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', zIndex: 2 }}>
                        {frame.description}
                      </div>
                    )}
                  </div>
                </Tooltip>
              );
            })}
          </div>
          </div>
        )}
      </Card>

      {/* 基本信息卡片 */}
      <Card title="基本信息" style={{ marginBottom: 24 }}>
        {/* 名称表单已移除 */}
        {/* <div style={{ marginBottom: 40, display: 'none' }} /> */}
        <div style={{ marginBottom: 40 }}>
          <Form form={emailForm} onFinish={handleChangeEmail} layout="vertical">
            <Form.Item
              name="email"
              label="邮箱"
              rules={[{ required: true, type: 'email', message: '请输入有效邮箱' }]}
            >
              <Input />
            </Form.Item>
            <Form.Item label="部门">
              <Input value={department} disabled />
            </Form.Item>
            <Button type="primary" htmlType="submit" block>
              修改邮箱
            </Button>
          </Form>
        </div>
        <div>
          <Form form={form} onFinish={handleChangePassword} layout="vertical">
            <Form.Item
              name="oldPassword"
              label="旧密码"
              rules={[{ required: true, message: '请输入旧密码' }]}
            >
              <Input.Password />
            </Form.Item>
            <Form.Item
              name="password"
              label="新密码"
              rules={[
                { required: true, message: '请输入密码' },
                { min: 6, message: '密码至少6位' },
                { 
                  pattern: /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).+$/, 
                  message: '密码必须包含大小写字母和数字' 
                }
              ]}
            >
              <Input.Password />
            </Form.Item>
            <Button type="primary" htmlType="submit" block>
              修改密码
            </Button>
          </Form>
        </div>
      </Card>

      {/* 角色权限卡片 */}
      <Card 
        title={
          <Space>
            <SafetyCertificateOutlined />
            角色权限
            {loading && <Badge status="processing" text="加载中..." />}
          </Space>
        }
        style={{ marginBottom: 24 }}
      >
        {/* 管理员标识 */}
        {(isSuperAdmin || isSystemAdmin) && (
          <div style={{ marginBottom: 16 }}>
            <Tag color="red" icon={<KeyOutlined />}>
              {isSuperAdmin ? '超级管理员' : '系统管理员'}
            </Tag>
            <Text type="secondary">拥有系统最高权限</Text>
          </div>
        )}

        {/* 用户角色 */}
        <div style={{ marginBottom: 24 }}>
          <Title level={5}>
            <UserOutlined /> 我的角色
          </Title>
          <Space wrap>
            {userRoles.map((role) => (
              <Tag 
                key={role.role_id}
                color={role.is_active ? 'blue' : 'default'}
                icon={role.is_active ? <CheckCircleOutlined /> : <ExclamationCircleOutlined />}
              >
                {role.role_display_name}
                {role.expires_at && (
                  <Text type="secondary" style={{ marginLeft: 8 }}>
                    (到期: {toBeijingDateTimeStr(role.expires_at)})
                  </Text>
                )}
              </Tag>
            ))}
            {userRoles.length === 0 && (
              <Text type="secondary">暂无角色</Text>
            )}
          </Space>
          
          {/* 即将过期的角色提醒 */}
          {expiringRoles.length > 0 && (
            <div style={{ marginTop: 12 }}>
              <Tag color="orange" icon={<ClockCircleOutlined />}>
                即将过期的角色 ({expiringRoles.length})
              </Tag>
              <List
                size="small"
                dataSource={expiringRoles}
                renderItem={(role) => (
                  <List.Item>
                    <Text>{role.role_display_name}</Text>
                    <Text type="secondary">
                      到期时间: {toBeijingDateTimeStr(role.expires_at!)}
                    </Text>
                  </List.Item>
                )}
              />
            </div>
          )}
        </div>

        <Divider />

        {/* 权限列表 */}
        <div>
          <Title level={5}>
            <KeyOutlined /> 我的权限
          </Title>
          {Object.keys(permissionsByCategory).length > 0 ? (
            Object.entries(permissionsByCategory).map(([category, permissions]) => (
              <div key={category} style={{ marginBottom: 16 }}>
                <Text strong style={{ display: 'block', marginBottom: 8 }}>
                  {category === 'leads' ? '线索管理' :
                   category === 'followups' ? '跟进管理' :
                   category === 'deals' ? '成交管理' :
                   category === 'dashboard' ? '仪表盘' :
                   category === 'departments' ? '部门管理' :
                   category === 'system' ? '系统管理' :
                   category}
                </Text>
                <Space wrap>
                  {permissions.map((permission) => (
                    <Tag key={permission.permission_name} color="green">
                      {permission.permission_display_name}
                    </Tag>
                  ))}
                </Space>
              </div>
            ))
          ) : (
            <Text type="secondary">暂无权限</Text>
          )}
        </div>

        {/* 权限统计 */}
        <Divider />
        <div>
          <Text type="secondary">
            总计: {userRoles.length} 个角色, {userPermissions.length} 个权限
          </Text>
        </div>
      </Card>
    </div>
  );
};

export default Profile;
