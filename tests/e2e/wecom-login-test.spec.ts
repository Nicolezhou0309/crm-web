import { test, expect, Page } from '@playwright/test';

test.describe('企业微信登录测试', () => {
  test('测试企业微信登录功能', async ({ page }) => {
    // 监听控制台日志
    const consoleLogs: string[] = [];
    page.on('console', (msg) => {
      const logMessage = `[${msg.type().toUpperCase()}] ${msg.text()}`;
      consoleLogs.push(logMessage);
      console.log(`🔍 [控制台] ${logMessage}`);
    });

    // 监听网络请求
    page.on('request', (request) => {
      if (request.url().includes('wecom') || request.url().includes('auth') || request.url().includes('callback')) {
        console.log(`🌐 [请求] ${request.method()} ${request.url()}`);
      }
    });

    page.on('response', (response) => {
      if (response.url().includes('wecom') || response.url().includes('auth') || response.url().includes('callback')) {
        console.log(`📡 [响应] ${response.status()} ${response.url()}`);
      }
    });

    // 监听页面导航
    page.on('framenavigated', (frame) => {
      console.log(`🧭 [导航] 页面导航到: ${frame.url()}`);
    });

    console.log('🚀 开始测试企业微信登录功能...');
    
    // 导航到线上地址
    console.log('🌐 导航到线上地址: https://lead-service.vld.com.cn/');
    await page.goto('https://lead-service.vld.com.cn/');
    
    // 等待页面加载
    console.log('⏳ 等待页面加载...');
    await page.waitForLoadState('networkidle');
    
    // 检查页面标题
    const title = await page.title();
    console.log('📄 页面标题:', title);
    
    // 检查是否有登录页面
    console.log('🔍 查找登录相关元素...');
    
    // 查找企业微信登录按钮
    const wecomLoginButton = page.locator('button').filter({ hasText: /企业微信|微信|扫码/ });
    const wecomLoginButtonCount = await wecomLoginButton.count();
    console.log(`🔍 找到 ${wecomLoginButtonCount} 个企业微信登录相关按钮`);
    
    if (wecomLoginButtonCount > 0) {
      console.log('✅ 找到企业微信登录按钮');
      
      // 获取按钮文本
      const buttonText = await wecomLoginButton.first().textContent();
      console.log('📝 按钮文本:', buttonText);
      
      // 点击企业微信登录按钮
      console.log('🖱️ 点击企业微信登录按钮...');
      await wecomLoginButton.first().click();
      
      // 等待页面跳转或弹窗出现
      console.log('⏳ 等待企业微信授权页面...');
      
      try {
        // 等待页面跳转到企业微信授权页面
        await page.waitForURL('**/open.weixin.qq.com/**', { timeout: 10000 });
        console.log('✅ 成功跳转到企业微信授权页面');
        
        // 获取当前URL
        const currentUrl = page.url();
        console.log('🔗 当前URL:', currentUrl);
        
        // 检查URL参数
        const url = new URL(currentUrl);
        const params = Object.fromEntries(url.searchParams);
        console.log('📋 URL参数:', params);
        
        // 验证必要的参数
        expect(params.appid).toBeTruthy();
        expect(params.redirect_uri).toBeTruthy();
        expect(params.response_type).toBe('code');
        expect(params.scope).toBe('snsapi_privateinfo');
        expect(params.agentid).toBeTruthy();
        
        console.log('✅ 企业微信授权URL参数验证通过');
        
        // 检查回调URL是否正确
        const redirectUri = decodeURIComponent(params.redirect_uri);
        console.log('🔗 回调URL:', redirectUri);
        
        if (redirectUri.includes('lead-service.vld.com.cn/auth/wecom/callback')) {
          console.log('✅ 回调URL配置正确');
        } else {
          console.log('❌ 回调URL配置错误');
        }
        
      } catch (error) {
        console.log('❌ 未跳转到企业微信授权页面:', error);
        
        // 检查是否有错误信息
        const errorElements = page.locator('[class*="error"], [class*="Error"], .ant-message-error');
        const errorCount = await errorElements.count();
        
        if (errorCount > 0) {
          console.log(`🔍 找到 ${errorCount} 个错误元素`);
          for (let i = 0; i < errorCount; i++) {
            const errorText = await errorElements.nth(i).textContent();
            console.log(`❌ 错误信息 ${i + 1}:`, errorText);
          }
        }
        
        // 检查页面内容
        const pageContent = await page.textContent('body');
        console.log('📄 页面内容预览:', pageContent?.substring(0, 500));
      }
      
    } else {
      console.log('❌ 未找到企业微信登录按钮');
      
      // 查找其他可能的登录元素
      const loginElements = page.locator('button, a, [class*="login"], [class*="Login"]');
      const loginCount = await loginElements.count();
      console.log(`🔍 找到 ${loginCount} 个可能的登录元素`);
      
      for (let i = 0; i < Math.min(loginCount, 10); i++) {
        const element = loginElements.nth(i);
        const text = await element.textContent();
        const className = await element.getAttribute('class');
        console.log(`  ${i + 1}. 文本: "${text}", 类名: "${className}"`);
      }
    }
    
    // 检查环境变量（通过页面源码）
    console.log('🔍 检查页面源码中的环境变量...');
    const pageContent = await page.content();
    
    const wecomConfigMatch = pageContent.match(/VITE_WECOM_CORP_ID["\s]*[:=]["\s]*([^"'\s]+)/);
    const wecomAgentMatch = pageContent.match(/VITE_WECOM_AGENT_ID["\s]*[:=]["\s]*([^"'\s]+)/);
    const wecomRedirectMatch = pageContent.match(/VITE_WECOM_REDIRECT_URI["\s]*[:=]["\s]*([^"'\s]+)/);
    
    console.log('🔧 环境变量检查:');
    console.log('  VITE_WECOM_CORP_ID:', wecomConfigMatch ? wecomConfigMatch[1] : '未找到');
    console.log('  VITE_WECOM_AGENT_ID:', wecomAgentMatch ? wecomAgentMatch[1] : '未找到');
    console.log('  VITE_WECOM_REDIRECT_URI:', wecomRedirectMatch ? wecomRedirectMatch[1] : '未找到');
    
    // 输出所有控制台日志
    console.log('\n📋 所有控制台日志:');
    consoleLogs.forEach((log, index) => {
      console.log(`  ${index + 1}. ${log}`);
    });
    
    // 基本断言
    expect(wecomLoginButtonCount).toBeGreaterThan(0);
  });

  test('测试企业微信回调页面', async ({ page }) => {
    console.log('🚀 开始测试企业微信回调页面...');
    
    // 直接访问回调页面
    const callbackUrl = 'https://lead-service.vld.com.cn/auth/wecom/callback?code=test123&state=test123&appid=ww68a125fce698cb59';
    console.log('🌐 访问回调页面:', callbackUrl);
    
    await page.goto(callbackUrl);
    
    // 等待页面加载
    await page.waitForLoadState('networkidle');
    
    // 检查页面内容
    const pageContent = await page.textContent('body');
    console.log('📄 回调页面内容:', pageContent);
    
    // 检查是否有错误信息
    const errorElements = page.locator('[class*="error"], [class*="Error"], .ant-message-error');
    const errorCount = await errorElements.count();
    
    if (errorCount > 0) {
      console.log(`🔍 找到 ${errorCount} 个错误元素`);
      for (let i = 0; i < errorCount; i++) {
        const errorText = await errorElements.nth(i).textContent();
        console.log(`❌ 错误信息 ${i + 1}:`, errorText);
      }
    }
    
    // 检查是否重定向到登录页面
    const currentUrl = page.url();
    console.log('🔗 当前URL:', currentUrl);
    
    if (currentUrl.includes('/login')) {
      console.log('⚠️ 回调页面重定向到了登录页面');
    } else if (currentUrl.includes('/auth/wecom/callback')) {
      console.log('✅ 回调页面正常显示');
    } else {
      console.log('❓ 回调页面状态未知');
    }
  });
});
