// 企业微信OAuth认证API - 符合JustAuth最佳实践
// 所有敏感操作都在后端处理，前端只负责用户交互

interface WecomAuthResponse {
  success: boolean;
  data?: {
    authUrl?: string;
    userInfo?: any;
    redirectUrl?: string;
  };
  error?: string;
}

interface WecomCallbackRequest {
  code: string;
  state: string;
}

interface WecomCallbackResponse {
  success: boolean;
  data?: {
    userInfo: any;
    redirectUrl: string;
  };
  error?: string;
}

// 1. 获取企业微信授权URL - 后端生成
export const getWecomAuthUrl = async (): Promise<WecomAuthResponse> => {
  try {
    const apiBaseUrl = import.meta.env.VITE_API_BASE_URL || '';
    const response = await fetch(`${apiBaseUrl}/auth/wecom/url`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    return data;
  } catch (error) {
    console.error('获取企业微信授权URL失败:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : '获取授权URL失败'
    };
  }
};

// 2. 处理企业微信回调 - 后端处理所有OAuth逻辑
export const handleWecomCallback = async (request: WecomCallbackRequest): Promise<WecomCallbackResponse> => {
  try {
    const apiBaseUrl = import.meta.env.VITE_API_BASE_URL || '';
    const response = await fetch(`${apiBaseUrl}/auth/wecom/callback`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(request),
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    return data;
  } catch (error) {
    console.error('处理企业微信回调失败:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : '处理回调失败'
    };
  }
};

// 3. 检查企业微信登录状态 - 用于轮询
export const checkWecomLoginStatus = async (state: string): Promise<WecomAuthResponse> => {
  try {
    const apiBaseUrl = import.meta.env.VITE_API_BASE_URL || '';
    const response = await fetch(`${apiBaseUrl}/auth/wecom/status?state=${encodeURIComponent(state)}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    return data;
  } catch (error) {
    console.error('检查企业微信登录状态失败:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : '检查登录状态失败'
    };
  }
};

// 4. 获取企业微信二维码 - 后端生成
export const getWecomQRCode = async (): Promise<WecomAuthResponse> => {
  try {
    const apiBaseUrl = import.meta.env.VITE_API_BASE_URL || '';
    const response = await fetch(`${apiBaseUrl}/auth/wecom/qrcode`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    return data;
  } catch (error) {
    console.error('获取企业微信二维码失败:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : '获取二维码失败'
    };
  }
};

// 导出类型
export type { WecomAuthResponse, WecomCallbackRequest, WecomCallbackResponse };
