// 加载消息集合
export const loadingMessages = [
  {
    message: "别催啦，已经在拼命加载了！💨",
    subtitle: "正在为您准备最棒的用户体验..."
  },
  {
    message: "正在召唤数据精灵...✨",
    subtitle: "请耐心等待，魔法正在生效"
  },
  {
    message: "服务器正在疯狂运转中...⚡",
    subtitle: "我们的工程师正在后台拼命工作"
  },
  {
    message: "正在为您打开魔法之门...🚪",
    subtitle: "穿越数据宇宙需要一点时间"
  },
  {
    message: "正在收集用户信息...📊",
    subtitle: "每一份数据都很重要，请稍候"
  },
  {
    message: "正在连接云端服务器...☁️",
    subtitle: "网络信号正在穿越大气层"
  },
  {
    message: "正在为您定制专属体验...🎨",
    subtitle: "个性化设置需要一点时间"
  },
  {
    message: "正在检查您的权限...🔐",
    subtitle: "安全验证正在进行中"
  },
  {
    message: "正在加载您的个人资料...👤",
    subtitle: "个人信息正在从云端下载"
  },
  {
    message: "正在初始化系统...🔧",
    subtitle: "系统组件正在启动中"
  }
];

// 获取随机加载消息
export const getRandomLoadingMessage = () => {
  const randomIndex = Math.floor(Math.random() * loadingMessages.length);
  return loadingMessages[randomIndex];
};

// 根据加载类型获取特定消息
export const getLoadingMessageByType = (type: 'auth' | 'data' | 'profile' | 'system') => {
  const typeMessages = {
    auth: {
      message: "正在验证您的身份...🔐",
      subtitle: "请稍候，我们正在检查您的登录状态..."
    },
    data: {
      message: "正在加载数据...📊",
      subtitle: "从服务器获取最新信息中..."
    },
    profile: {
      message: "正在加载您的个人资料...👤",
      subtitle: "个人信息正在从云端下载..."
    },
    system: {
      message: "正在初始化系统...🔧",
      subtitle: "系统组件正在启动中..."
    }
  };
  
  return typeMessages[type] || getRandomLoadingMessage();
}; 