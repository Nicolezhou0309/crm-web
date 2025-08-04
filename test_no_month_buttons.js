// 测试移除上个月/本月/下个月按钮后的功能 - 在浏览器控制台中运行
// 复制以下代码到浏览器控制台执行

console.log('🧪 测试移除月份导航按钮后的功能...');

function testNoMonthButtons() {
  try {
    console.log('📊 测试当前日历导航功能...');
    
    // 测试1: 检查日历组件是否存在
    console.log('🔍 测试1: 检查日历组件');
    const calendarElement = document.querySelector('.ant-picker-calendar');
    if (calendarElement) {
      console.log('✅ 日历组件存在');
    } else {
      console.log('❌ 日历组件不存在');
      return;
    }
    
    // 测试2: 检查是否还有自定义的月份导航按钮
    console.log('🔍 测试2: 检查自定义月份导航按钮');
    const customButtons = document.querySelectorAll('.calendar-header .ant-btn');
    if (customButtons.length === 0) {
      console.log('✅ 已移除自定义月份导航按钮');
    } else {
      console.log('❌ 仍存在自定义月份导航按钮:', customButtons.length, '个');
    }
    
    // 测试3: 检查Ant Design默认的日历导航
    console.log('🔍 测试3: 检查Ant Design默认日历导航');
    const defaultNavButtons = document.querySelectorAll('.ant-picker-calendar-header .ant-picker-calendar-header-left .ant-btn');
    if (defaultNavButtons.length > 0) {
      console.log('✅ Ant Design默认导航按钮存在:', defaultNavButtons.length, '个');
      defaultNavButtons.forEach((btn, index) => {
        console.log(`  按钮${index + 1}:`, btn.textContent?.trim());
      });
    } else {
      console.log('❌ 未找到Ant Design默认导航按钮');
    }
    
    // 测试4: 检查过滤器区域
    console.log('🔍 测试4: 检查过滤器区域');
    const filterElements = document.querySelectorAll('.calendar-filters .filter-item');
    console.log('过滤器项目数量:', filterElements.length);
    
    filterElements.forEach((element, index) => {
      const label = element.querySelector('.filter-label');
      console.log(`  过滤器${index + 1}:`, label?.textContent?.trim());
    });
    
    // 测试5: 检查重置按钮
    console.log('🔍 测试5: 检查重置按钮');
    const resetButton = document.querySelector('.calendar-filters .ant-btn-primary');
    if (resetButton) {
      console.log('✅ 重置按钮存在:', resetButton.textContent?.trim());
    } else {
      console.log('❌ 重置按钮不存在');
    }
    
    // 测试6: 检查当前月份显示
    console.log('🔍 测试6: 检查当前月份显示');
    const monthDisplay = document.querySelector('.followups-calendar-view .ant-card-head-title');
    if (monthDisplay) {
      console.log('✅ 月份显示区域存在:', monthDisplay.textContent?.trim());
    } else {
      console.log('❌ 月份显示区域不存在');
    }
    
    // 测试7: 检查数据范围显示
    console.log('🔍 测试7: 检查数据范围显示');
    const rangeDisplay = document.querySelector('.followups-calendar-view div[style*="margin-bottom"]');
    if (rangeDisplay) {
      console.log('✅ 数据范围显示存在:', rangeDisplay.textContent?.trim());
    } else {
      console.log('❌ 数据范围显示不存在');
    }
    
    console.log('🎉 移除月份导航按钮功能测试完成！');
    console.log('✅ 当前保留的功能:');
    console.log('   - Ant Design默认日历导航');
    console.log('   - 日期范围过滤器');
    console.log('   - 跟进阶段过滤器');
    console.log('   - 重置为当月按钮');
    console.log('   - 月份信息显示');
    console.log('   - 数据范围显示');
    console.log('❌ 已移除的功能:');
    console.log('   - 自定义上个月按钮');
    console.log('   - 自定义本月按钮');
    console.log('   - 自定义下个月按钮');
    console.log('   - 自定义日历头部样式');
    
  } catch (error) {
    console.error('❌ 测试过程中出现错误:', error);
  }
}

// 执行测试
testNoMonthButtons(); 