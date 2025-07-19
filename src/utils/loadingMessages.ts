// 加载消息集合
export const loadingMessages = [
  // 原有消息
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
  },
  // 新增管家销售主题消息
  {
    message: "正在为您加载客户画像…🖼️",
    subtitle: "知己知彼，百战百胜"
  },
  {
    message: "AI正在分析客户偏好…🤖",
    subtitle: "让您的推荐更精准，成交更轻松"
  },
  {
    message: "系统正在优化您的沟通话术…💬",
    subtitle: "每一句话，都离成交更近一步"
  },
  {
    message: "正在计算客户成交概率…📈",
    subtitle: "科学决策，减少无效跟进"
  },
  {
    message: "正在生成客户跟进策略…🗓️",
    subtitle: "节奏对了，成交就对了"
  },
  {
    message: "系统正在模拟客户反应…🎭",
    subtitle: "提前预判，从容应对"
  },
  {
    message: "您的下一个成交正在路上…🚀",
    subtitle: "保持节奏，冠军就是您"
  },
  {
    message: "正在为您挖掘新的销售突破口…⛏️",
    subtitle: "换个思路，海阔天空"
  },
  {
    message: "管家大神经验包加载中…🧠",
    subtitle: "站在巨人的肩膀上开单"
  },
  {
    message: "系统检测到您的业绩即将飙升…📊",
    subtitle: "这把稳了，继续冲！"
  },
  {
    message: "您的专属销售Buff已生效…🛡️",
    subtitle: "今日幸运值+50%，快去见客户！"
  },
  // 新增激励型销售文案
  {
    message: "您的第5单正在派送中…📦",
    subtitle: "本月销冠已在向你招手！"
  },
  {
    message: "系统检测到超级客户正在靠近…🦸",
    subtitle: "这次开单，一定一拖三！"
  },
  {
    message: "恭喜！您的努力值已满格…⚡",
    subtitle: "今天必有好运降临！"
  },
  {
    message: "正在为您连接财富信号…📡",
    subtitle: "嘀——检测到高意向客户！"
  },
  {
    message: "您的开单锦鲤正在游来…🐠",
    subtitle: "转发这条锦鲤，今天必开单！"
  },
  {
    message: "幸运值充值完成…✨",
    subtitle: "今日宜签约、宜收款、宜破纪录！"
  },
  {
    message: "您的业绩火箭正在点火…🔥",
    subtitle: "3、2、1——冲榜倒计时！"
  },
  {
    message: "检测到您今日战斗力+200%…💥",
    subtitle: "现在去见客户，稳赢！"
  },
  {
    message: "销售暴击技能加载中…🎯",
    subtitle: "下一单，必是王炸！"
  },
  {
    message: "系统偷偷为您预留了VIP客户…🤫",
    subtitle: "别人抢不走，专属于你！"
  },
  {
    message: "恭喜解锁【开单狂魔】成就…🏆",
    subtitle: "再赢一单，奖励升级！"
  },
  {
    message: "您今天的笑容价值10万…😊",
    subtitle: "保持状态，客户马上签单！"
  },
  {
    message: "磁场感应：客户即将说'Yes'…🧲",
    subtitle: "自信点，你值得这一单！"
  },
  {
    message: "您的'成交气场'已全开…🌈",
    subtitle: "今天遇到的客户，都会被你打动！"
  },
  {
    message: "系统赠您一次'必开单'机会…🎰",
    subtitle: "试试发个朋友圈，马上有惊喜！"
  },
  {
    message: "财神爷正在为您筛选客户…💰",
    subtitle: "信我，今天必开大单！"
  },
  {
    message: "您的开单符已生效…🀄",
    subtitle: "天时地利人和，就差你行动！"
  },
  {
    message: "本月旺运指数：🌟🌟🌟🌟🌟",
    subtitle: "五颗星的日子，别浪费！"
  }
];

// 获取随机加载消息
export const getRandomLoadingMessage = () => {
  const randomIndex = Math.floor(Math.random() * loadingMessages.length);
  return loadingMessages[randomIndex];
};

// 根据加载类型获取特定消息
export const getLoadingMessageByType = (type: 'auth' | 'data' | 'profile' | 'system' | 'sales' | 'customer' | 'ai') => {
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
    },
    sales: {
      message: "您的下一个成交正在路上…🚀",
      subtitle: "保持节奏，冠军就是您"
    },
    customer: {
      message: "正在为您加载客户画像…🖼️",
      subtitle: "知己知彼，百战百胜"
    },
    ai: {
      message: "AI正在分析客户偏好…🤖",
      subtitle: "让您的推荐更精准，成交更轻松"
    }
  };
  
  return typeMessages[type] || getRandomLoadingMessage();
}; 