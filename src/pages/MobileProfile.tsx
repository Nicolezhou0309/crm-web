import React, { useState, useEffect } from 'react';
import { 
  NavBar, 
  Card, 
  Avatar, 
  Button, 
  List, 
  Tag, 
  Divider, 
  Toast, 
  Dialog,
  Popup,
  Form,
  Input,
  ImageViewer,
  Space,
  Grid,

} from 'antd-mobile';
import { 
  UserOutline, 
  KeyOutline, 
  ClockCircleOutline,
  LeftOutline,
  CloseOutline
} from 'antd-mobile-icons';
import { useNavigate } from 'react-router-dom';
import { useRolePermissions } from '../hooks/useRolePermissions';
import { useAchievements } from '../hooks/useAchievements';
import { useUser } from '../context/UserContext';
import { useAuth } from '../hooks/useAuth';
import { tokenManager } from '../utils/tokenManager';
import { supabase } from '../supaClient';
// 已迁移到ImageUpload组件，不再需要直接导入
import LoadingScreen from '../components/LoadingScreen';
import ImageUpload from '../components/ImageUpload';
import './MobileProfile.css';
import { toBeijingTime, toBeijingDateTimeStr } from '../utils/timeUtils';

const MobileProfile: React.FC = () => {
  const navigate = useNavigate();
  const [form] = Form.useForm();
  const [emailForm] = Form.useForm();
  const [email, setEmail] = useState('');
  const [department] = useState<string>('');
  const [_avatarUploading, setAvatarUploading] = useState(false);
  const [avatarModal, setAvatarModal] = useState(false);
  const [avatarTs, setAvatarTs] = useState<number>(Date.now());
  // 移除重复状态，使用UserContext统一管理
  const [showEmailForm, setShowEmailForm] = useState(false);
  const [showPasswordForm, setShowPasswordForm] = useState(false);
  
  // 使用UserContext获取用户信息
  const { user, avatarUrl, avatarLoading, refreshAvatar } = useUser();
  const { logout: authLogout } = useAuth();

  // 使用角色权限Hook
  const { 
    userRoles, 
    userPermissions, 
    // loading, 
    isSuperAdmin, 
    isSystemAdmin,
    getPermissionsByCategory,
    getExpiringRoles
  } = useRolePermissions();

  const { avatarFrames, getEquippedAvatarFrame, equipAvatarFrame } = useAchievements();
  const equippedFrame = getEquippedAvatarFrame() || null;

  // 移除重复的fetchAll函数，现在使用UserContext统一管理头像
  // 头像信息现在由UserContext统一提供，无需重复请求

  // 新增：user变化时自动同步email
  useEffect(() => {
    if (user?.email) {
      setEmail(user.email);
    }
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

  // 头像上传处理 - 使用新的ImageUpload组件
  const handleAvatarUploadSuccess = async (url: string) => {
    if (!user) {
      Toast.show('用户信息获取失败');
      return;
    }

    try {
      setAvatarUploading(true);

      // 1. 立即更新本地缓存 - 优先显示新头像
      setAvatarTs(Date.now());
      
      // 2. 获取旧头像URL
      const { data: profile } = await supabase
        .from('users_profile')
        .select('avatar_url')
        .eq('user_id', user.id)
        .single();
      const oldAvatarUrl = profile?.avatar_url;

      // 3. 更新profile表
      const { error: updateError } = await supabase
        .from('users_profile')
        .update({ avatar_url: url })
        .eq('user_id', user.id);
      
      if (updateError) {
        Toast.show('头像保存失败');
        return;
      }

      // 4. 立即强制刷新UserContext中的头像缓存 - 确保全局状态同步
      await refreshAvatar(true);
      
      // 5. 通知其他组件刷新
      localStorage.setItem('avatar_refresh_token', Date.now().toString());
      window.dispatchEvent(new Event('avatar_refresh_token'));

      // 6. 删除旧头像（支持OSS和Supabase Storage）- 异步处理，不阻塞UI
      if (oldAvatarUrl) {
        // 使用setTimeout确保UI更新优先
        setTimeout(async () => {
          try {
            // 检查是否为OSS文件
            if (oldAvatarUrl.includes('vlinker-crm.oss-cn-shanghai.aliyuncs.com')) {
              // OSS文件删除
              const { deleteImage } = await import('../utils/ossUploadUtils');
              // 提取文件路径，移除域名和查询参数
              const url = new URL(oldAvatarUrl);
              const oldFilePath = url.pathname.substring(1); // 移除开头的 '/'
              console.log('🗑️ 准备删除OSS文件:', oldFilePath);
              const result = await deleteImage(oldFilePath);
              if (!result.success) {
                console.error('删除OSS旧头像失败:', result.error);
              } else {
                console.log('✅ OSS旧头像删除成功');
              }
            } else if (oldAvatarUrl.includes('/avatars/')) {
              // Supabase Storage文件删除
              const urlParts = oldAvatarUrl.split('/');
              const oldFilePath = urlParts[urlParts.length - 1];
              if (oldFilePath) {
                const { error } = await supabase.storage.from('avatars').remove([oldFilePath]);
                if (error) {
                  console.error('删除Supabase旧头像失败:', error);
                } else {
                  console.log('✅ Supabase旧头像删除成功');
                }
              }
            } else {
              console.warn('无法识别旧头像存储类型:', oldAvatarUrl);
            }
          } catch (deleteError) {
            console.error('删除旧头像异常:', deleteError);
          }
        }, 100);
      }
      
      Toast.show('头像上传成功');
    } catch (error) {
      console.error('头像保存失败:', error);
      Toast.show('头像保存失败');
    } finally {
      setAvatarUploading(false);
    }
  };

  const handleAvatarUploadError = (error: string) => {
    console.error('头像上传失败:', error);
    Toast.show('头像上传失败');
    setAvatarUploading(false);
  };

  // 切换装备头像框
  const handleEquipFrame = async (frameId: string | null) => {
    try {
      await equipAvatarFrame(frameId ?? '');
      Toast.show(frameId ? '头像框已装备' : '已恢复默认头像框');
      await refreshAvatar();
      localStorage.setItem('avatar_refresh_token', Date.now().toString());
      window.dispatchEvent(new Event('avatar_refresh_token'));
    } catch (e) {
      Toast.show('头像框装备失败');
    }
  };

  // 修改邮箱
  const handleChangeEmail = async (values: any) => {
    const { email: newEmail } = values;
    // 唯一性校验
    const { data: exist } = await supabase
      .from('users_profile')
      .select('user_id')
      .eq('email', newEmail)
      .limit(1);
    if (exist && exist.length > 0) {
      Toast.show('该邮箱已被注册');
      return;
    }
    const { error } = await tokenManager.updateUser({ email: newEmail });
    if (error) {
      Toast.show(error instanceof Error ? error.message : '邮箱更新失败');
    } else {
      // 同步 users_profile.email
      if (user) {
        await supabase.from('users_profile').update({ email: newEmail }).eq('user_id', user.id);
      }
      Toast.show('邮箱修改成功，请前往新邮箱查收验证邮件');
      setEmail(newEmail);
      setShowEmailForm(false);
    }
  };

  // 修改密码
  const handleChangePassword = async (values: any) => {
    const { oldPassword, password } = values;
    const { error: loginError } = await tokenManager.signInWithPassword(email, oldPassword);
    if (loginError) {
      Toast.show('旧密码错误，请重新输入');
      return;
    }
    const { error } = await tokenManager.updateUser({ password });
    if (error) {
      Toast.show(error instanceof Error ? error.message : '密码更新失败');
    } else {
      Toast.show('密码修改成功，请重新登录');
      await authLogout(navigate);
    }
  };

  // 退出登录确认
  const handleLogout = () => {
    Dialog.confirm({
      content: '确定要退出登录吗？',
      onConfirm: () => {
        authLogout(navigate);
      },
    });
  };

  if (avatarLoading || !user) {
    return <LoadingScreen type="profile" />;
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* 顶部导航栏 */}
      <NavBar 
        onBack={() => navigate(-1)}
        backArrow={<LeftOutline />}
        className="bg-white border-b border-gray-200"
      >
        个人中心
      </NavBar>

      <div className="px-4 pb-20">
        {/* 头像信息卡片 */}
        <Card className="mb-4 bg-white rounded-lg shadow-sm">
          <div className="flex items-center gap-4">
            <div className="relative">
              <Avatar
                src={avatarUrl || ''}
                className="w-16 h-16"
                onClick={() => setAvatarModal(true)}
                fallback={<UserOutline />}
              />
              {equippedFrame && (
                <div className="absolute -top-1 -left-1 -right-1 -bottom-1 rounded-full border-2 border-blue-500 pointer-events-none" />
              )}
            </div>
            <div className="flex-1">
              <div className="text-lg font-bold mb-1 text-gray-900">
                {user.email || '用户'}
              </div>
              <div className="text-sm text-gray-600">
                {department || '部门信息'}
              </div>
            </div>
            <Button
              size="small"
              fill="outline"
              onClick={() => setAvatarModal(true)}
              className="text-blue-600 border-blue-600"
            >
              更换头像
            </Button>
          </div>
        </Card>

        {/* 头像框系统 */}
        <Card title="我的头像框" className="mb-4 bg-white rounded-lg shadow-sm">
          <Grid columns={3} gap={8}>
            {/* 默认头像框 */}
            <div
              className={`rounded-xl p-3 flex flex-col items-center cursor-pointer transition-all duration-200 ${
                !equippedFrame 
                  ? 'bg-gradient-to-br from-blue-500 to-purple-600 border-2 border-blue-500' 
                  : 'bg-gray-100 border border-gray-300'
              }`}
              onClick={() => handleEquipFrame(null)}
            >
              <div className="w-10 h-10 rounded-full bg-white flex items-center justify-center mb-2 text-base text-gray-500">
                无
              </div>
              <div className={`text-center font-semibold text-xs ${
                !equippedFrame ? 'text-white' : 'text-gray-600'
              }`}>
                默认
              </div>
            </div>
            
            {/* 其他头像框 */}
            {avatarFrames.map(frame => {
              const getFrameStyle = (rarity: string, isEquipped: boolean) => {
                if (isEquipped) {
                  switch (rarity) {
                    case 'legendary':
                      return 'bg-gradient-to-br from-purple-500 to-indigo-600 border-2 border-purple-600';
                    case 'epic':
                      return 'bg-gradient-to-br from-pink-500 to-red-500 border-2 border-pink-600';
                    case 'rare':
                      return 'bg-gradient-to-br from-blue-500 to-cyan-500 border-2 border-blue-600';
                    default:
                      return 'bg-gradient-to-br from-gray-500 to-gray-600 border-2 border-gray-600';
                  }
                } else {
                  return 'bg-gray-100 border border-gray-300';
                }
              };
              
              return (
                <div
                  key={frame.frame_id}
                  className={`rounded-xl p-3 flex flex-col items-center cursor-pointer transition-all duration-200 ${getFrameStyle(frame.rarity, frame.is_equipped)}`}
                  onClick={() => handleEquipFrame(frame.frame_id)}
                >
                  <img
                    src={frame.icon_url}
                    alt={frame.name}
                    className="w-10 h-10 rounded-full mb-2"
                  />
                  <div className={`text-center font-semibold text-xs ${
                    frame.is_equipped ? 'text-white' : 'text-gray-600'
                  }`}>
                    {frame.name}
                  </div>
                </div>
              );
            })}
          </Grid>
        </Card>

        {/* 基本信息 */}
        <Card title="基本信息" className="mb-4 bg-white rounded-lg shadow-sm">
          <List className="bg-transparent">
            <List.Item
              extra={
                <Button
                  size="small"
                  fill="outline"
                  onClick={() => setShowEmailForm(true)}
                  className="text-blue-600 border-blue-600"
                >
                  修改
                </Button>
              }
              className="border-b border-gray-100"
            >
              <div>
                <div className="text-sm text-gray-600 mb-1">邮箱</div>
                <div className="text-gray-900">{email}</div>
              </div>
            </List.Item>
            <List.Item className="border-b border-gray-100">
              <div>
                <div className="text-sm text-gray-600 mb-1">部门</div>
                <div className="text-gray-900">{department || '暂无部门信息'}</div>
              </div>
            </List.Item>
            <List.Item
              extra={
                <Button
                  size="small"
                  fill="outline"
                  onClick={() => setShowPasswordForm(true)}
                  className="text-blue-600 border-blue-600"
                >
                  修改
                </Button>
              }
            >
              <div>
                <div className="text-sm text-gray-600 mb-1">密码</div>
                <div className="text-gray-900">••••••••</div>
              </div>
            </List.Item>
          </List>
        </Card>

        {/* 角色权限 */}
        <Card title="角色权限" className="mb-4 bg-white rounded-lg shadow-sm">
          {/* 管理员标识 */}
          {(isSuperAdmin || isSystemAdmin) && (
            <div className="mb-4">
              <Tag color="red" fill="outline" className="text-red-600 border-red-600">
                {isSuperAdmin ? '超级管理员' : '系统管理员'}
              </Tag>
              <div className="text-xs text-gray-600 mt-1">
                拥有系统最高权限
              </div>
            </div>
          )}

          {/* 用户角色 */}
          <div className="mb-6">
            <div className="text-base font-bold mb-2 text-gray-900">
              <UserOutline className="mr-2" />
              我的角色
            </div>
            <Space wrap>
              {userRoles.map((role) => (
                <Tag 
                  key={role.role_id}
                  color={role.is_active ? 'primary' : 'default'}
                  fill="outline"
                  className={role.is_active ? 'text-blue-600 border-blue-600' : 'text-gray-500 border-gray-400'}
                >
                  {role.role_display_name}
                  {role.expires_at && (
                    <span className="ml-1 text-xs">
                      (到期: {toBeijingDateTimeStr(role.expires_at)})
                    </span>
                  )}
                </Tag>
              ))}
              {userRoles.length === 0 && (
                <div className="text-gray-500 text-sm">暂无角色</div>
              )}
            </Space>
            
            {/* 即将过期的角色提醒 */}
            {expiringRoles.length > 0 && (
              <div className="mt-3">
                <Tag color="warning" fill="outline" className="text-orange-600 border-orange-600">
                  <ClockCircleOutline className="mr-1" />
                  即将过期的角色 ({expiringRoles.length})
                </Tag>
                <List className="mt-2 bg-transparent">
                  {expiringRoles.map((role) => (
                    <List.Item key={role.role_id} className="border-b border-gray-100">
                      <div className="text-sm text-gray-900">{role.role_display_name}</div>
                      <div className="text-xs text-gray-600">
                        到期时间: {toBeijingDateTimeStr(role.expires_at!)}
                      </div>
                    </List.Item>
                  ))}
                </List>
              </div>
            )}
          </div>

          <Divider />

          {/* 权限列表 */}
          <div>
            <div style={{ fontSize: '16px', fontWeight: 'bold', marginBottom: '8px' }}>
              <KeyOutline style={{ marginRight: '8px' }} />
              我的权限
            </div>
            {Object.keys(permissionsByCategory).length > 0 ? (
              Object.entries(permissionsByCategory).map(([category, permissions]) => (
                <div key={category} style={{ marginBottom: '12px' }}>
                  <div style={{ fontSize: '14px', fontWeight: 'bold', marginBottom: '6px' }}>
                    {category === 'leads' ? '线索管理' :
                     category === 'followups' ? '跟进管理' :
                     category === 'deals' ? '成交管理' :
                     category === 'dashboard' ? '仪表盘' :
                     category === 'departments' ? '部门管理' :
                     category === 'system' ? '系统管理' :
                     category}
                  </div>
                  <Space wrap>
                    {permissions.map((permission) => (
                      <Tag key={permission.permission_name} color="success" fill="outline">
                        {permission.permission_display_name}
                      </Tag>
                    ))}
                  </Space>
                </div>
              ))
            ) : (
              <div style={{ color: '#999', fontSize: '14px' }}>暂无权限</div>
            )}
          </div>

          <Divider />
          <div style={{ textAlign: 'center', color: '#999', fontSize: '12px' }}>
            总计: {userRoles.length} 个角色, {userPermissions.length} 个权限
          </div>
        </Card>

        {/* 退出登录 */}
        <Card style={{ marginBottom: '16px' }}>
          <Button
            block
            color="danger"
            fill="outline"
            onClick={handleLogout}
            style={{ height: '44px' }}
          >
            <CloseOutline style={{ marginRight: '8px' }} />
            退出登录
          </Button>
        </Card>
      </div>

      {/* 头像上传弹窗 */}
      <Popup
        visible={avatarModal}
        onMaskClick={() => setAvatarModal(false)}
        position="bottom"
        bodyStyle={{ height: '300px' }}
      >
        <div style={{ padding: '16px' }}>
          <div style={{ fontSize: '16px', fontWeight: 'bold', marginBottom: '16px', textAlign: 'center' }}>
            更换头像
          </div>
          <ImageUpload
            bucket="avatars"
            filePath={`user_${user?.id}_${Date.now()}.jpg`}
            onUploadSuccess={(url) => {
              handleAvatarUploadSuccess(url);
              setAvatarModal(false);
            }}
            onUploadError={handleAvatarUploadError}
            enableCrop={true}
            cropShape="round"
            cropAspect={1}
            cropQuality={1}
            cropTitle="裁剪头像"
            showCropGrid={false}
            showCropReset={true}
            compressionOptions={{
              maxSizeMB: 1,
              maxWidthOrHeight: 1024,
              useWebWorker: true
            }}
            accept="image/png,image/jpeg,image/jpg"
            buttonText="选择头像"
            previewWidth={120}
            previewHeight={120}
            currentImageUrl={avatarUrl || undefined}
            loading={_avatarUploading}
          />
          <div style={{ marginTop: '16px', textAlign: 'center' }}>
            <Button
              block
              onClick={() => setAvatarModal(false)}
            >
              取消
            </Button>
          </div>
        </div>
      </Popup>

      {/* 修改邮箱弹窗 */}
      <Popup
        visible={showEmailForm}
        onMaskClick={() => setShowEmailForm(false)}
        position="bottom"
        bodyStyle={{ height: '300px' }}
      >
        <div style={{ padding: '16px' }}>
          <div style={{ fontSize: '16px', fontWeight: 'bold', marginBottom: '16px', textAlign: 'center' }}>
            修改邮箱
          </div>
          <Form
            form={emailForm}
            onFinish={handleChangeEmail}
            layout="vertical"
          >
            <Form.Item
              name="email"
              label="新邮箱"
              rules={[{ required: true, type: 'email', message: '请输入有效邮箱' }]}
            >
              <Input placeholder="请输入新邮箱" />
            </Form.Item>
            <Form.Item>
              <Button block type="submit" color="primary">
                确认修改
              </Button>
            </Form.Item>
          </Form>
        </div>
      </Popup>

      {/* 修改密码弹窗 */}
      <Popup
        visible={showPasswordForm}
        onMaskClick={() => setShowPasswordForm(false)}
        position="bottom"
        bodyStyle={{ height: '400px' }}
      >
        <div style={{ padding: '16px' }}>
          <div style={{ fontSize: '16px', fontWeight: 'bold', marginBottom: '16px', textAlign: 'center' }}>
            修改密码
          </div>
          <Form
            form={form}
            onFinish={handleChangePassword}
            layout="vertical"
          >
            <Form.Item
              name="oldPassword"
              label="旧密码"
              rules={[{ required: true, message: '请输入旧密码' }]}
            >
              <Input type="password" placeholder="请输入旧密码" />
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
              <Input type="password" placeholder="请输入新密码" />
            </Form.Item>
            <Form.Item>
              <Button block type="submit" color="primary">
                确认修改
              </Button>
            </Form.Item>
          </Form>
        </div>
      </Popup>

      {/* 头像预览 */}
      {avatarUrl && (
        <ImageViewer
          image={avatarUrl}
          visible={false}
        />
      )}
    </div>
  );
};

export default MobileProfile;
