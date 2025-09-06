import { chromium } from 'playwright';

async function testEditSync() {
  console.log('🚀 开始测试编辑状态同步...');
  
  const browser = await chromium.launch({ 
    headless: false,
    slowMo: 500 
  });
  
  const page = await browser.newPage();
  
  // 监听控制台日志
  const relevantLogs = [];
  page.on('console', (msg) => {
    const logMessage = `[${msg.type().toUpperCase()}] ${msg.text()}`;
    
    // 过滤关键日志
    if (msg.text().includes('LiveStream') || 
        msg.text().includes('Realtime') || 
        msg.text().includes('编辑') ||
        msg.text().includes('editing') ||
        msg.text().includes('acquireEditLock') ||
        msg.text().includes('状态') ||
        msg.text().includes('锁定')) {
      relevantLogs.push(logMessage);
      console.log(`🔍 [关键日志] ${logMessage}`);
    }
  });
  
  try {
    console.log('📱 导航到页面...');
    await page.goto('http://localhost:5177');
    await page.waitForLoadState('networkidle');
    
    // 登录
    console.log('🔐 登录...');
    const loginButton = page.locator('button').filter({ hasText: '登录' });
    if (await loginButton.isVisible()) {
      const usernameInput = page.locator('input[type="email"], input[placeholder*="邮箱"]').first();
      const passwordInput = page.locator('input[type="password"]').first();
      
      await usernameInput.fill('537093913@qq.com');
      await passwordInput.fill('Xin199539');
      await loginButton.click();
      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(3000);
    }
    
    console.log('✅ 登录完成');
    
    // 等待实时连接建立
    console.log('⏳ 等待实时连接建立...');
    const realtimeStatus = page.locator('[data-testid="realtime-status"]');
    await realtimeStatus.waitFor({ state: 'visible', timeout: 10000 });
    
    const statusText = await realtimeStatus.textContent();
    console.log('✅ 实时连接状态:', statusText);
    
    // 查找可编辑的卡片
    console.log('🔍 查找可编辑卡片...');
    const cards = page.locator('[data-testid="schedule-card"]');
    const cardCount = await cards.count();
    console.log(`📊 找到 ${cardCount} 个卡片`);
    
    // 找到第一个"立即报名"的卡片
    const availableCard = cards.filter({ hasText: '立即报名' }).first();
    if (await availableCard.isVisible()) {
      console.log('✅ 找到可编辑卡片');
      
      // 获取卡片信息
      const cardText = await availableCard.textContent();
      console.log('📋 卡片内容:', cardText);
      
      // 点击卡片开始编辑
      console.log('🖱️ 点击卡片开始编辑...');
      await availableCard.click();
      
      // 等待弹窗出现
      console.log('⏳ 等待编辑弹窗...');
      const modal = page.locator('.ant-modal');
      await modal.waitFor({ state: 'visible', timeout: 5000 });
      console.log('✅ 编辑弹窗已打开');
      
      // 检查卡片状态是否变为"报名中"
      console.log('🔍 检查卡片状态变化...');
      await page.waitForTimeout(1000);
      
      const updatedCardText = await availableCard.textContent();
      console.log('📋 更新后卡片内容:', updatedCardText);
      
      // 检查是否包含编辑状态指示器
      const hasEditingIndicator = updatedCardText?.includes('报名中') || 
                                 updatedCardText?.includes('编辑中') ||
                                 updatedCardText?.includes('editing');
      
      console.log('🔍 编辑状态指示器:', hasEditingIndicator);
      
      // 检查控制台日志中的编辑锁定信息
      const lockLogs = relevantLogs.filter(log => 
        log.includes('acquireEditLock') || 
        log.includes('编辑锁定') ||
        log.includes('editing')
      );
      
      console.log('📋 编辑锁定相关日志:');
      lockLogs.forEach(log => console.log(`  ${log}`));
      
      // 关闭弹窗
      console.log('🖱️ 关闭编辑弹窗...');
      const cancelButton = page.locator('button').filter({ hasText: '取消' });
      await cancelButton.click();
      
      // 等待状态恢复
      console.log('⏳ 等待状态恢复...');
      await page.waitForTimeout(2000);
      
      const finalCardText = await availableCard.textContent();
      console.log('📋 最终卡片内容:', finalCardText);
      
      // 检查是否恢复到原始状态
      const isRestored = finalCardText?.includes('立即报名');
      console.log('✅ 状态已恢复:', isRestored);
      
      // 输出所有相关日志
      console.log('\n📋 所有相关日志:');
      relevantLogs.forEach((log, index) => {
        console.log(`  ${index + 1}. ${log}`);
      });
      
      // 分析结果
      console.log('\n📊 测试结果分析:');
      console.log(`  - 编辑状态指示器: ${hasEditingIndicator ? '✅ 正常' : '❌ 异常'}`);
      console.log(`  - 状态恢复: ${isRestored ? '✅ 正常' : '❌ 异常'}`);
      console.log(`  - 编辑锁定日志: ${lockLogs.length > 0 ? '✅ 有日志' : '❌ 无日志'}`);
      
      if (hasEditingIndicator && isRestored && lockLogs.length > 0) {
        console.log('🎉 编辑状态同步测试通过！');
      } else {
        console.log('❌ 编辑状态同步测试失败！');
      }
      
    } else {
      console.log('❌ 未找到可编辑卡片');
    }
    
  } catch (error) {
    console.error('❌ 测试失败:', error);
  } finally {
    await browser.close();
  }
}

testEditSync();
