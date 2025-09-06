import { test, expect, Page } from '@playwright/test';

// 测试配置
const TEST_CONFIG = {
  baseURL: 'http://localhost:5177',
  timeout: 30000,
  retries: 2
};

// 测试数据
const TEST_USER = {
  email: 'test@example.com',
  password: 'testpassword123'
};

// 辅助函数：等待页面加载完成
async function waitForPageLoad(page: Page) {
  await page.waitForLoadState('networkidle');
  await page.waitForSelector('[data-testid="live-stream-registration"]', { timeout: 10000 });
}

// 辅助函数：等待实时连接建立
async function waitForRealtimeConnection(page: Page) {
  await page.waitForSelector('[data-testid="realtime-status"]', { timeout: 10000 });
  
  // 等待连接状态显示为已连接
  const statusElement = page.locator('[data-testid="realtime-status"]');
  await expect(statusElement).toContainText('实时连接已建立');
}

// 辅助函数：获取卡片元素
async function getCardElement(page: Page, date: string, timeSlot: string) {
  const cardSelector = `[data-testid="schedule-card"][data-date="${date}"][data-time-slot="${timeSlot}"]`;
  return page.locator(cardSelector);
}

// 辅助函数：等待卡片状态更新
async function waitForCardStateUpdate(page: Page, date: string, timeSlot: string, expectedState: string) {
  const card = await getCardElement(page, date, timeSlot);
  
  // 等待卡片状态变化
  await page.waitForFunction(
    ({ date, timeSlot, expectedState }) => {
      const card = document.querySelector(`[data-testid="schedule-card"][data-date="${date}"][data-time-slot="${timeSlot}"]`);
      if (!card) return false;
      
      const stateText = card.textContent || '';
      return stateText.includes(expectedState);
    },
    { date, timeSlot, expectedState },
    { timeout: 10000 }
  );
}

// 辅助函数：监听控制台日志
async function captureConsoleLogs(page: Page, logType: string = 'log') {
  const logs: string[] = [];
  
  page.on('console', (msg) => {
    if (msg.type() === logType) {
      logs.push(`[${msg.type().toUpperCase()}] ${msg.text()}`);
    }
  });
  
  return logs;
}

test.describe('直播报名实时状态同步测试', () => {
  let page: Page;
  let consoleLogs: string[] = [];

  test.beforeEach(async ({ browser }) => {
    // 创建新的页面实例
    page = await browser.newPage();
    
    // 监听控制台日志
    consoleLogs = [];
    page.on('console', (msg) => {
      const logMessage = `[${msg.type().toUpperCase()}] ${msg.text()}`;
      consoleLogs.push(logMessage);
      
      // 实时输出关键日志
      if (msg.text().includes('LiveStream') || msg.text().includes('Realtime') || msg.text().includes('编辑')) {
        console.log(`🔍 [测试日志] ${logMessage}`);
      }
    });

    // 监听网络请求
    page.on('request', (request) => {
      if (request.url().includes('live_stream_schedules') || request.url().includes('realtime')) {
        console.log(`🌐 [网络请求] ${request.method()} ${request.url()}`);
      }
    });

    page.on('response', (response) => {
      if (response.url().includes('live_stream_schedules') || response.url().includes('realtime')) {
        console.log(`📡 [网络响应] ${response.status()} ${response.url()}`);
      }
    });

    // 导航到页面
    await page.goto(TEST_CONFIG.baseURL);
    await waitForPageLoad(page);
  });

  test.afterEach(async () => {
    if (page) {
      await page.close();
    }
  });

  test('应该能够正确同步编辑状态', async () => {
    console.log('🚀 开始测试编辑状态同步...');

    // 1. 等待实时连接建立
    await waitForRealtimeConnection(page);
    console.log('✅ 实时连接已建立');

    // 2. 查找可编辑的卡片（available状态或空状态）
    const availableCard = page.locator('[data-testid="schedule-card"]').filter({ hasText: '立即报名' }).first();
    await expect(availableCard).toBeVisible({ timeout: 10000 });
    console.log('✅ 找到可编辑卡片');

    // 3. 点击卡片开始编辑
    await availableCard.click();
    console.log('✅ 点击卡片开始编辑');

    // 4. 等待编辑弹窗出现
    const modal = page.locator('.ant-modal').filter({ hasText: '立即报名' });
    await expect(modal).toBeVisible({ timeout: 5000 });
    console.log('✅ 编辑弹窗已打开');

    // 5. 检查卡片状态是否变为"报名中"
    const cardText = await availableCard.textContent();
    console.log('🔍 卡片当前状态:', cardText);
    
    // 等待状态更新
    await page.waitForTimeout(1000);
    
    // 6. 检查控制台日志中是否有相关状态更新
    const relevantLogs = consoleLogs.filter(log => 
      log.includes('编辑') || 
      log.includes('editing') || 
      log.includes('状态') ||
      log.includes('LiveStream') ||
      log.includes('Realtime')
    );
    
    console.log('📋 相关日志:');
    relevantLogs.forEach(log => console.log(`  ${log}`));

    // 7. 验证状态同步
    const updatedCardText = await availableCard.textContent();
    console.log('🔍 更新后卡片状态:', updatedCardText);
    
    // 检查是否包含编辑状态指示器
    const hasEditingIndicator = updatedCardText?.includes('报名中') || updatedCardText?.includes('编辑中');
    console.log('✅ 编辑状态指示器:', hasEditingIndicator);

    // 8. 关闭弹窗
    const cancelButton = page.locator('button').filter({ hasText: '取消' });
    await cancelButton.click();
    console.log('✅ 关闭编辑弹窗');

    // 9. 等待状态恢复
    await page.waitForTimeout(2000);
    
    // 10. 验证最终状态
    const finalCardText = await availableCard.textContent();
    console.log('🔍 最终卡片状态:', finalCardText);
    
    // 检查是否恢复到原始状态
    const isRestored = finalCardText?.includes('立即报名') || finalCardText?.includes('无法报名');
    console.log('✅ 状态已恢复:', isRestored);

    // 断言
    expect(hasEditingIndicator).toBeTruthy();
    expect(isRestored).toBeTruthy();
  });

  test('应该能够监听实时数据变化', async () => {
    console.log('🚀 开始测试实时数据监听...');

    // 1. 等待实时连接建立
    await waitForRealtimeConnection(page);
    console.log('✅ 实时连接已建立');

    // 2. 检查控制台日志中的订阅信息
    const subscriptionLogs = consoleLogs.filter(log => 
      log.includes('订阅') || 
      log.includes('subscription') ||
      log.includes('RealtimeManager')
    );
    
    console.log('📋 订阅相关日志:');
    subscriptionLogs.forEach(log => console.log(`  ${log}`));

    // 3. 检查是否有数据变化监听器
    const dataChangeLogs = consoleLogs.filter(log => 
      log.includes('数据变化') || 
      log.includes('onDataChange') ||
      log.includes('实时数据')
    );
    
    console.log('📋 数据变化监听日志:');
    dataChangeLogs.forEach(log => console.log(`  ${log}`));

    // 4. 验证至少有一些相关的日志输出
    expect(subscriptionLogs.length).toBeGreaterThan(0);
  });

  test('应该能够处理并发编辑冲突', async () => {
    console.log('🚀 开始测试并发编辑冲突处理...');

    // 1. 等待实时连接建立
    await waitForRealtimeConnection(page);
    console.log('✅ 实时连接已建立');

    // 2. 查找可编辑的卡片
    const availableCard = page.locator('[data-testid="schedule-card"]').filter({ hasText: '立即报名' }).first();
    await expect(availableCard).toBeVisible({ timeout: 10000 });
    console.log('✅ 找到可编辑卡片');

    // 3. 点击卡片开始编辑
    await availableCard.click();
    console.log('✅ 点击卡片开始编辑');

    // 4. 等待编辑弹窗出现
    const modal = page.locator('.ant-modal').filter({ hasText: '立即报名' });
    await expect(modal).toBeVisible({ timeout: 5000 });
    console.log('✅ 编辑弹窗已打开');

    // 5. 检查是否有编辑锁定相关的日志
    const lockLogs = consoleLogs.filter(log => 
      log.includes('锁定') || 
      log.includes('lock') ||
      log.includes('editing_by') ||
      log.includes('acquireEditLock')
    );
    
    console.log('📋 编辑锁定相关日志:');
    lockLogs.forEach(log => console.log(`  ${log}`));

    // 6. 关闭弹窗
    const cancelButton = page.locator('button').filter({ hasText: '取消' });
    await cancelButton.click();
    console.log('✅ 关闭编辑弹窗');

    // 7. 检查是否有释放锁定的日志
    const releaseLogs = consoleLogs.filter(log => 
      log.includes('释放') || 
      log.includes('release') ||
      log.includes('releaseEditLock')
    );
    
    console.log('📋 释放锁定相关日志:');
    releaseLogs.forEach(log => console.log(`  ${log}`));

    // 验证有相关的锁定/释放日志
    expect(lockLogs.length + releaseLogs.length).toBeGreaterThan(0);
  });

  test('应该能够显示详细的调试信息', async () => {
    console.log('🚀 开始测试调试信息显示...');

    // 1. 等待页面加载完成
    await waitForPageLoad(page);
    console.log('✅ 页面加载完成');

    // 2. 检查实时连接状态显示
    const realtimeStatus = page.locator('[data-testid="realtime-status"]');
    await expect(realtimeStatus).toBeVisible({ timeout: 10000 });
    
    const statusText = await realtimeStatus.textContent();
    console.log('🔍 实时连接状态:', statusText);

    // 3. 检查报名状态显示
    const registrationStatus = page.locator('[data-testid="registration-status"]');
    if (await registrationStatus.isVisible()) {
      const regStatusText = await registrationStatus.textContent();
      console.log('🔍 报名状态:', regStatusText);
    }

    // 4. 检查所有控制台日志
    console.log('📋 所有控制台日志:');
    consoleLogs.forEach((log, index) => {
      console.log(`  ${index + 1}. ${log}`);
    });

    // 5. 验证有足够的调试信息
    expect(consoleLogs.length).toBeGreaterThan(0);
    expect(statusText).toContain('实时连接');
  });
});
