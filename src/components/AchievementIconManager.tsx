import React, { useState, useEffect } from 'react';
import { supabase } from '../supaClient';
import { Card, Button, Input, Select, message, Space, Divider, Typography, Upload, Image } from 'antd';
import { ReloadOutlined, SaveOutlined, EyeOutlined, UploadOutlined } from '@ant-design/icons';
import ImgCrop from 'antd-img-crop';
import imageCompression from 'browser-image-compression';

const { Title, Text } = Typography;
const { Option } = Select;

interface Achievement {
  id: string;
  code: string;
  name: string;
  description: string;
  icon: string;
  icon_type: string;
  icon_url?: string;
  color: string;
  category: string;
  is_active: boolean;
}

interface Badge {
  id: string;
  name: string;
  description: string;
  icon: string;
  icon_type: string;
  icon_url?: string;
  color: string;
  rarity: string;
  is_active: boolean;
}

interface AvatarFrame {
  id: string;
  name: string;
  description: string;
  frame_type: string;
  frame_data: any;
  rarity: string;
  is_active: boolean;
}

interface IconManagerProps {
  onIconUpdate?: () => void;
}

export const AchievementIconManager: React.FC<IconManagerProps> = ({ onIconUpdate }) => {
  const [achievements, setAchievements] = useState<Achievement[]>([]);
  const [badges, setBadges] = useState<Badge[]>([]);
  const [avatarFrames, setAvatarFrames] = useState<AvatarFrame[]>([]);
  const [loading, setLoading] = useState(false);
  const [updating, setUpdating] = useState<string | null>(null);
  const [previewVisible, setPreviewVisible] = useState(false);

  // 常用图标推荐
  const iconSuggestions: {
    achievements: Record<string, string[]>;
    badges: Record<string, string[]>;
  } = {
    achievements: {
      'first_followup': ['📋', '📝', '📄'],
      'followup_master': ['📊', '📈', '📉'],
      'first_deal': ['💎', '🏆', '⭐'],
      'deal_master': ['🏆', '👑', '💎'],
      'conversion_master': ['📈', '📊', '🎯'],
      'points_collector': ['💰', '💎', '🏅'],
      'team_helper': ['🤝', '👥', '👨‍👩‍👧‍👦'],
      'daily_checkin': ['📅', '📆', '🗓️']
    },
    badges: {
      '新手销售': ['🎖️', '🏅', '⭐'],
      '成交达人': ['💎', '🏆', '👑'],
      '转化大师': ['🏆', '👑', '💎'],
      '团队领袖': ['👑', '🏆', '⭐'],
      '连续签到': ['📅', '📆', '🗓️']
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      // 获取成就列表
      const { data: achievementsData, error: achievementsError } = await supabase
        .from('achievements')
        .select('*')
        .eq('is_active', true)
        .order('sort_order');

      if (achievementsError) throw achievementsError;

      // 获取勋章列表
      const { data: badgesData, error: badgesError } = await supabase
        .from('badges')
        .select('*')
        .eq('is_active', true)
        .order('sort_order');

      if (badgesError) throw badgesError;

      // 获取头像框列表
      const { data: framesData, error: framesError } = await supabase
        .from('avatar_frames')
        .select('*')
        .eq('is_active', true)
        .order('sort_order');

      if (framesError) throw framesError;

      setAchievements(achievementsData || []);
      setBadges(badgesData || []);
      setAvatarFrames(framesData || []);
    } catch (error) {
      console.error('加载图标数据失败:', error);
      message.error('加载数据失败');
    } finally {
      setLoading(false);
    }
  };

  const updateAchievementIcon = async (achievementId: string, newIcon: string, newIconType: string = 'emoji', newIconUrl?: string, newColor?: string) => {
    setUpdating(achievementId);
    try {
      const updateData: any = { 
        icon: newIcon, 
        icon_type: newIconType,
        updated_at: new Date().toISOString()
      };

      if (newIconUrl) {
        updateData.icon_url = newIconUrl;
      }

      if (newColor) {
        updateData.color = newColor;
      }

      const { error } = await supabase
        .from('achievements')
        .update(updateData)
        .eq('id', achievementId);

      if (error) throw error;
      
      message.success('成就图标更新成功');
      await loadData();
      onIconUpdate?.();
    } catch (error) {
      console.error('更新成就图标失败:', error);
      message.error('更新失败');
    } finally {
      setUpdating(null);
    }
  };

  const updateBadgeIcon = async (badgeId: string, newIcon: string, newIconType: string = 'emoji', newIconUrl?: string, newColor?: string) => {
    setUpdating(badgeId);
    try {
      const updateData: any = { 
        icon: newIcon, 
        icon_type: newIconType,
        updated_at: new Date().toISOString()
      };

      if (newIconUrl) {
        updateData.icon_url = newIconUrl;
      }

      if (newColor) {
        updateData.color = newColor;
      }

      const { error } = await supabase
        .from('badges')
        .update(updateData)
        .eq('id', badgeId);

      if (error) throw error;
      
      message.success('勋章图标更新成功');
      await loadData();
      onIconUpdate?.();
    } catch (error) {
      console.error('更新勋章图标失败:', error);
      message.error('更新失败');
    } finally {
      setUpdating(null);
    }
  };

  const updateAvatarFrame = async (frameId: string, frameData: any) => {
    setUpdating(frameId);
    try {
      const { error } = await supabase
        .from('avatar_frames')
        .update({ 
          frame_data: frameData,
          updated_at: new Date().toISOString()
        })
        .eq('id', frameId);

      if (error) throw error;
      
      message.success('头像框样式更新成功');
      await loadData();
      onIconUpdate?.();
    } catch (error) {
      console.error('更新头像框失败:', error);
      message.error('更新失败');
    } finally {
      setUpdating(null);
    }
  };

  const handleImageUpload = async (file: File, type: 'achievement' | 'badge', id: string) => {
    try {
      // 这里应该上传到您的文件存储服务（如Supabase Storage）
      // 示例：上传到Supabase Storage
      const fileExt = file.name.split('.').pop();
      const fileName = `${type}-${id}-${Date.now()}.${fileExt}`;
      const filePath = `achievement-icons/${fileName}`;

      const { error } = await supabase.storage
        .from('achievement-icons')
        .upload(filePath, file);

      if (error) throw error;

      // 获取公共URL
      const { data: { publicUrl } } = supabase.storage
        .from('achievement-icons')
        .getPublicUrl(filePath);

      // 更新数据库
      if (type === 'achievement') {
        await updateAchievementIcon(id, fileName, 'png', publicUrl);
      } else {
        await updateBadgeIcon(id, fileName, 'png', publicUrl);
      }

      message.success('图片上传成功');
    } catch (error) {
      console.error('图片上传失败:', error);
      message.error('图片上传失败');
    }
  };

  const renderIcon = (item: Achievement | Badge) => {
    if (item.icon_type === 'png' || item.icon_type === 'jpg' || item.icon_type === 'webp') {
      return (
        <Image
          src={item.icon_url || `/images/achievements/${item.icon}`}
          alt={item.name}
          width={32}
          height={32}
          style={{ objectFit: 'contain' }}
          preview={{
            visible: previewVisible,
            src: item.icon_url || `/images/achievements/${item.icon}`,
            title: item.name,
            onVisibleChange: (visible) => setPreviewVisible(visible)
          }}
        />
      );
    }
    
    return (
      <span className="current-icon" style={{ color: item.color }}>
        {item.icon}
      </span>
    );
  };

  const batchUpdateIcons = async () => {
    setUpdating('batch');
    try {
      // 批量更新成就图标
      const iconMapping = {
        'first_followup': '📋',
        'followup_master': '📊',
        'first_deal': '💎',
        'deal_master': '🏆',
        'conversion_master': '📈',
        'points_collector': '💰',
        'team_helper': '🤝',
        'daily_checkin': '📅'
      };

      for (const [code, icon] of Object.entries(iconMapping)) {
        const achievement = achievements.find(a => a.code === code);
        if (achievement) {
          await updateAchievementIcon(achievement.id, icon, 'emoji');
        }
      }

      message.success('批量更新完成');
    } catch (error) {
      console.error('批量更新失败:', error);
      message.error('批量更新失败');
    } finally {
      setUpdating(null);
    }
  };

  if (loading) {
    return (
      <Card>
        <div style={{ textAlign: 'center', padding: '20px' }}>
          <Text>加载中...</Text>
        </div>
      </Card>
    );
  }

  return (
    <div className="achievement-icon-manager">
      <Card 
        title={
          <Space>
            <EyeOutlined />
            <span>成就系统图标管理</span>
          </Space>
        }
        extra={
          <Space>
            <Button 
              icon={<ReloadOutlined />} 
              onClick={loadData}
              loading={loading}
            >
              刷新
            </Button>
            <Button 
              type="primary" 
              icon={<SaveOutlined />}
              onClick={batchUpdateIcons}
              loading={updating === 'batch'}
            >
              批量更新
            </Button>
          </Space>
        }
      >
        {/* 成就图标管理 */}
        <div className="section">
          <Title level={4}>🎯 成就图标</Title>
          <div className="icon-grid">
            {achievements.map(achievement => (
              <Card 
                key={achievement.id} 
                size="small" 
                style={{ marginBottom: '10px' }}
              >
                <div className="icon-item">
                  <div className="icon-display">
                    {renderIcon(achievement)}
                    <Text strong>{achievement.name}</Text>
                    <Text type="secondary" style={{ fontSize: '12px' }}>
                      {achievement.code} ({achievement.icon_type})
                    </Text>
                  </div>
                  
                  <div className="icon-controls">
                    <Input
                      placeholder="新图标 (emoji或文件名)"
                      defaultValue={achievement.icon}
                      onPressEnter={(e) => {
                        const target = e.target as HTMLInputElement;
                        updateAchievementIcon(achievement.id, target.value, achievement.icon_type);
                      }}
                      style={{ marginBottom: '5px' }}
                    />
                    
                    <Select
                      placeholder="图标类型"
                      defaultValue={achievement.icon_type}
                      style={{ width: '100%', marginBottom: '5px' }}
                      onChange={(iconType) => updateAchievementIcon(achievement.id, achievement.icon, iconType)}
                    >
                      <Option value="emoji">Emoji</Option>
                      <Option value="png">PNG图片</Option>
                      <Option value="svg">SVG图标</Option>
                      <Option value="jpg">JPG图片</Option>
                      <Option value="webp">WebP图片</Option>
                    </Select>

                    <Select
                      placeholder="选择颜色"
                      defaultValue={achievement.color}
                      style={{ width: '100%', marginBottom: '5px' }}
                      onChange={(color) => updateAchievementIcon(achievement.id, achievement.icon, achievement.icon_type, undefined, color)}
                    >
                      <Option value="#52c41a">绿色</Option>
                      <Option value="#1890ff">蓝色</Option>
                      <Option value="#fa8c16">橙色</Option>
                      <Option value="#722ed1">紫色</Option>
                      <Option value="#eb2f96">粉色</Option>
                      <Option value="#f5222d">红色</Option>
                    </Select>

                    {/* 图片上传 */}
                    {achievement.icon_type !== 'emoji' && (
                      <ImgCrop
                        cropShape="round"
                        aspect={1}
                        quality={1}
                        showGrid={false}
                        showReset
                        modalTitle="裁剪图标"
                      >
                        <Upload
                          accept="image/*"
                          showUploadList={false}
                          beforeUpload={async (file) => {
                            const options = {
                              maxSizeMB: 0.2,
                              maxWidthOrHeight: 128,
                              useWebWorker: true,
                            };
                            try {
                              const compressedFile = await imageCompression(file, options);
                              await handleImageUpload(compressedFile, 'achievement', achievement.id);
                              return false;
                            } catch (e) {
                              console.error('图片压缩失败:', e);
                              message.error('图片压缩失败');
                              return false;
                            }
                          }}
                        >
                          <Button 
                            icon={<UploadOutlined />} 
                            size="small"
                            style={{ width: '100%', marginBottom: '5px' }}
                          >
                            上传图片
                          </Button>
                        </Upload>
                      </ImgCrop>
                    )}

                    {/* 图标建议 */}
                    {achievement.icon_type === 'emoji' && iconSuggestions.achievements[achievement.code] && (
                      <div className="icon-suggestions">
                        <Text type="secondary" style={{ fontSize: '12px' }}>建议:</Text>
                        <Space>
                          {iconSuggestions.achievements[achievement.code].map((icon, index) => (
                            <Button
                              key={index}
                              size="small"
                              onClick={() => updateAchievementIcon(achievement.id, icon, 'emoji')}
                              loading={updating === achievement.id}
                            >
                              {icon}
                            </Button>
                          ))}
                        </Space>
                      </div>
                    )}
                  </div>
                </div>
              </Card>
            ))}
          </div>
        </div>

        <Divider />

        {/* 勋章图标管理 */}
        <div className="section">
          <Title level={4}>🏅 勋章图标</Title>
          <div className="icon-grid">
            {badges.map(badge => (
              <Card 
                key={badge.id} 
                size="small" 
                style={{ marginBottom: '10px' }}
              >
                <div className="icon-item">
                  <div className="icon-display">
                    {renderIcon(badge)}
                    <Text strong>{badge.name}</Text>
                    <Text type="secondary" style={{ fontSize: '12px' }}>
                      {badge.rarity} ({badge.icon_type})
                    </Text>
                  </div>
                  
                  <div className="icon-controls">
                    <Input
                      placeholder="新图标 (emoji或文件名)"
                      defaultValue={badge.icon}
                      onPressEnter={(e) => {
                        const target = e.target as HTMLInputElement;
                        updateBadgeIcon(badge.id, target.value, badge.icon_type);
                      }}
                      style={{ marginBottom: '5px' }}
                    />
                    
                    <Select
                      placeholder="图标类型"
                      defaultValue={badge.icon_type}
                      style={{ width: '100%', marginBottom: '5px' }}
                      onChange={(iconType) => updateBadgeIcon(badge.id, badge.icon, iconType)}
                    >
                      <Option value="emoji">Emoji</Option>
                      <Option value="png">PNG图片</Option>
                      <Option value="svg">SVG图标</Option>
                      <Option value="jpg">JPG图片</Option>
                      <Option value="webp">WebP图片</Option>
                    </Select>

                    <Select
                      placeholder="选择颜色"
                      defaultValue={badge.color}
                      style={{ width: '100%', marginBottom: '5px' }}
                      onChange={(color) => updateBadgeIcon(badge.id, badge.icon, badge.icon_type, undefined, color)}
                    >
                      <Option value="#52c41a">绿色</Option>
                      <Option value="#1890ff">蓝色</Option>
                      <Option value="#fa8c16">橙色</Option>
                      <Option value="#722ed1">紫色</Option>
                      <Option value="#eb2f96">粉色</Option>
                      <Option value="#f5222d">红色</Option>
                    </Select>

                    {/* 图片上传 */}
                    {badge.icon_type !== 'emoji' && (
                      <ImgCrop
                        cropShape="round"
                        aspect={1}
                        quality={1}
                        showGrid={false}
                        showReset
                        modalTitle="裁剪图标"
                      >
                        <Upload
                          accept="image/*"
                          showUploadList={false}
                          beforeUpload={async (file) => {
                            const options = {
                              maxSizeMB: 0.2,
                              maxWidthOrHeight: 128,
                              useWebWorker: true,
                            };
                            try {
                              const compressedFile = await imageCompression(file, options);
                              await handleImageUpload(compressedFile, 'badge', badge.id);
                              return false;
                            } catch (e) {
                              console.error('图片压缩失败:', e);
                              message.error('图片压缩失败');
                              return false;
                            }
                          }}
                        >
                          <Button 
                            icon={<UploadOutlined />} 
                            size="small"
                            style={{ width: '100%', marginBottom: '5px' }}
                          >
                            上传图片
                          </Button>
                        </Upload>
                      </ImgCrop>
                    )}

                    {/* 图标建议 */}
                    {badge.icon_type === 'emoji' && iconSuggestions.badges[badge.name] && (
                      <div className="icon-suggestions">
                        <Text type="secondary" style={{ fontSize: '12px' }}>建议:</Text>
                        <Space>
                          {iconSuggestions.badges[badge.name].map((icon, index) => (
                            <Button
                              key={index}
                              size="small"
                              onClick={() => updateBadgeIcon(badge.id, icon, 'emoji')}
                              loading={updating === badge.id}
                            >
                              {icon}
                            </Button>
                          ))}
                        </Space>
                      </div>
                    )}
                  </div>
                </div>
              </Card>
            ))}
          </div>
        </div>

        <Divider />

        {/* 头像框管理 */}
        <div className="section">
          <Title level={4}>🖼️ 头像框样式</Title>
          <div className="icon-grid">
            {avatarFrames.map(frame => (
              <Card 
                key={frame.id} 
                size="small" 
                style={{ marginBottom: '10px' }}
              >
                <div className="icon-item">
                  <div className="icon-display">
                    <div 
                      className="frame-preview"
                      style={{
                        width: '40px',
                        height: '40px',
                        borderRadius: '50%',
                        border: '2px solid #d9d9d9',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: '20px',
                        ...frame.frame_data
                      }}
                    >
                      👤
                    </div>
                    <Text strong>{frame.name}</Text>
                    <Text type="secondary" style={{ fontSize: '12px' }}>
                      {frame.rarity}
                    </Text>
                  </div>
                  
                  <div className="icon-controls">
                    <Button
                      size="small"
                      onClick={() => {
                        const newFrameData = {
                          border: '3px solid #ff6b35',
                          borderRadius: '50%',
                          boxShadow: '0 0 15px #ff6b35',
                          background: 'linear-gradient(45deg, #ff6b35, #f7931e)'
                        };
                        updateAvatarFrame(frame.id, newFrameData);
                      }}
                      loading={updating === frame.id}
                    >
                      更新样式
                    </Button>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        </div>
      </Card>

      <style>{`
        .achievement-icon-manager {
          margin: 20px 0;
        }
        
        .section {
          margin-bottom: 20px;
        }
        
        .icon-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
          gap: 10px;
        }
        
        .icon-item {
          display: flex;
          align-items: flex-start;
          gap: 15px;
        }
        
        .icon-display {
          display: flex;
          flex-direction: column;
          align-items: center;
          min-width: 80px;
        }
        
        .current-icon {
          font-size: 32px;
          margin-bottom: 5px;
        }
        
        .icon-controls {
          flex: 1;
        }
        
        .icon-suggestions {
          margin-top: 5px;
        }
        
        .frame-preview {
          margin-bottom: 5px;
        }
      `}</style>
    </div>
  );
}; 