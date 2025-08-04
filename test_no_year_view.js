// 测试年视图是否已被完全移除 - 在浏览器控制台中运行
// 复制以下代码到浏览器控制台执行

console.log('🧪 测试年视图是否已被完全移除...');

function testNoYearView() {
  try {
    console.log('📊 测试年视图移除情况...');
    
    // 测试1: 检查日历头部
    console.log('🔍 测试1: 检查日历头部');
    const calendarElement = document.querySelector('.ant-picker-calendar');
    if (calendarElement) {
      console.log('✅ 日历组件存在');
      
      // 检查自定义头部
      const customHeader = calendarElement.querySelector('div[style*="display: flex"]');
      if (customHeader) {
        console.log('✅ 自定义头部存在');
        
        // 检查导航按钮
        const navButtons = customHeader.querySelectorAll('.ant-btn');
        console.log('导航按钮数量:', navButtons.length);
        
        navButtons.forEach((btn, index) => {
          console.log(`  按钮${index + 1}:`, btn.textContent?.trim());
        });
        
        // 检查月份显示
        const monthDisplay = customHeader.querySelector('span');
        if (monthDisplay) {
          console.log('月份显示:', monthDisplay.textContent?.trim());
        }
      } else {
        console.log('❌ 自定义头部不存在');
      }
      
      // 检查是否还有默认的视图切换按钮
      const defaultViewToggles = calendarElement.querySelectorAll('.ant-picker-calendar-header-right .ant-btn');
      if (defaultViewToggles.length > 0) {
        console.log('❌ 仍存在默认视图切换按钮:', defaultViewToggles.length, '个');
        defaultViewToggles.forEach((btn, index) => {
          console.log(`  切换按钮${index + 1}:`, btn.textContent?.trim());
        });
      } else {
        console.log('✅ 已移除默认视图切换按钮');
      }
    } else {
      console.log('❌ 日历组件不存在');
      return;
    }
    
    // 测试2: 检查日历模式
    console.log('🔍 测试2: 检查日历模式');
    const calendarMode = calendarElement?.getAttribute('data-mode') || 'month';
    console.log('日历模式:', calendarMode);
    
    // 测试3: 检查日历单元格类型
    console.log('🔍 测试3: 检查日历单元格类型');
    const calendarCells = document.querySelectorAll('.ant-picker-calendar-date');
    const calendarWeeks = document.querySelectorAll('.ant-picker-calendar-date-week');
    const calendarMonths = document.querySelectorAll('.ant-picker-calendar-date-month');
    
    console.log('日期单元格数量:', calendarCells.length);
    console.log('周单元格数量:', calendarWeeks.length);
    console.log('月单元格数量:', calendarMonths.length);
    
    if (calendarCells.length > 0 && calendarWeeks.length === 0 && calendarMonths.length === 0) {
      console.log('✅ 确认是月视图（只有日期单元格）');
    } else if (calendarMonths.length > 0) {
      console.log('❌ 检测到年视图（有月单元格）');
    } else if (calendarWeeks.length > 0) {
      console.log('❌ 检测到周视图（有周单元格）');
    }
    
    // 测试4: 检查事件监听器
    console.log('🔍 测试4: 检查事件监听器');
    const navButtons = document.querySelectorAll('.ant-picker-calendar div[style*="display: flex"] .ant-btn');
    navButtons.forEach((btn, index) => {
      const hasClickHandler = btn.onclick !== null || btn.getAttribute('onclick') !== null;
      console.log(`导航按钮${index + 1}可点击:`, hasClickHandler);
    });
    
    // 测试5: 检查控制台日志
    console.log('🔍 测试5: 检查控制台日志');
    console.log('请查看控制台是否有以下日志:');
    console.log('  - "🔄 日历面板变化:" (月视图变化)');
    console.log('  - "⚠️ 忽略非月视图变化:" (年视图被忽略)');
    
    // 测试6: 检查样式
    console.log('🔍 测试6: 检查样式');
    const calendarHeader = document.querySelector('.ant-picker-calendar-header');
    if (calendarHeader) {
      const computedStyle = window.getComputedStyle(calendarHeader);
      console.log('日历头部样式:', {
        display: computedStyle.display,
        justifyContent: computedStyle.justifyContent,
        alignItems: computedStyle.alignItems
      });
    }
    
    console.log('🎉 年视图移除测试完成！');
    console.log('✅ 预期结果:');
    console.log('   - 只有自定义的月视图导航按钮');
    console.log('   - 没有默认的视图切换按钮');
    console.log('   - 只有日期单元格，没有月单元格');
    console.log('   - 年视图变化被忽略');
    console.log('   - 月视图变化正常处理');
    
    console.log('📝 使用说明:');
    console.log('   1. 使用 ‹ › 按钮切换月份');
    console.log('   2. 月份切换时自动加载数据');
    console.log('   3. 年视图已被完全禁用');
    console.log('   4. 界面更加简洁直观');
    
  } catch (error) {
    console.error('❌ 测试过程中出现错误:', error);
  }
}

// 执行测试
testNoYearView(); 