// 企业微信API配置
const WECOM_CONFIG = {
  corpId: import.meta.env.VITE_WECOM_CORP_ID,
  agentId: import.meta.env.VITE_WECOM_AGENT_ID,
  secret: import.meta.env.VITE_WECOM_SECRET,
};

// 获取企业微信访问令牌
export const getWecomAccessToken = async (): Promise<{ access_token: string; expires_in: number }> => {
  try {
    const response = await fetch(`https://qyapi.weixin.qq.com/cgi-bin/gettoken?corpid=${WECOM_CONFIG.corpId}&corpsecret=${WECOM_CONFIG.secret}`);
    const data = await response.json();
    
    if (data.errcode !== 0) {
      throw new Error(`获取访问令牌失败: ${data.errmsg}`);
    }
    
    return {
      access_token: data.access_token,
      expires_in: data.expires_in
    };
  } catch (error) {
    console.error('获取企业微信访问令牌失败:', error);
    throw error;
  }
};

// 通过code获取用户信息
export const getWecomUserInfo = async (code: string): Promise<{
  UserId: string;
  name: string;
  mobile: string;
  email: string;
  department: string;
  position: string;
  corpId: string;
}> => {
  try {
    // 1. 获取访问令牌
    const { access_token } = await getWecomAccessToken();
    
    // 2. 通过code获取用户ID
    const userResponse = await fetch(`https://qyapi.weixin.qq.com/cgi-bin/user/getuserinfo?access_token=${access_token}&code=${code}`);
    const userData = await userResponse.json();
    
    if (userData.errcode !== 0) {
      throw new Error(`获取用户信息失败: ${userData.errmsg}`);
    }
    
    // 3. 获取用户详细信息
    const detailResponse = await fetch(`https://qyapi.weixin.qq.com/cgi-bin/user/get?access_token=${access_token}&userid=${userData.UserId}`);
    const detailData = await detailResponse.json();
    
    if (detailData.errcode !== 0) {
      throw new Error(`获取用户详细信息失败: ${detailData.errmsg}`);
    }
    
    return {
      UserId: detailData.userid,
      name: detailData.name,
      mobile: detailData.mobile,
      email: detailData.email || `${detailData.userid}@wecom.local`,
      department: detailData.department?.join(',') || '',
      position: detailData.position || '',
      corpId: WECOM_CONFIG.corpId
    };
  } catch (error) {
    console.error('获取企业微信用户信息失败:', error);
    throw error;
  }
};

// 企业微信认证服务
export const authenticateWithWecom = async (code: string, state: string) => {
  try {
    const userInfo = await getWecomUserInfo(code);
    
    return {
      success: true,
      data: {
        userInfo,
        state,
        redirectUrl: `https://lead-service.vld.com.cn/success?user_id=${userInfo.UserId}&name=${userInfo.name}&department=${userInfo.department}&state=${state}`
      }
    };
  } catch (error) {
    console.error('企业微信认证失败:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : '企业微信认证失败'
    };
  }
};
