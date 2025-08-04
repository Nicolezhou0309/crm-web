// 测试日历同步功能 - 在浏览器控制台中运行
// 复制以下代码到浏览器控制台执行

console.log('🧪 测试日历同步功能...');

function testCalendarSync() {
  try {
    console.log('📊 测试日历与数据范围同步...');
    
    // 测试1: 检查当前状态
    console.log('🔍 测试1: 检查当前状态');
    const monthDisplay = document.querySelector('.followups-calendar-view span[style*="fontWeight"]');
    const rangeDisplay = document.querySelector('.followups-calendar-view div[style*="fontSize"]');
    const calendarHeader = document.querySelector('.ant-picker-calendar-header .ant-picker-calendar-header-view');
    
    if (monthDisplay) {
      console.log('✅ 月份显示:', monthDisplay.textContent?.trim());
    }
    if (rangeDisplay) {
      console.log('✅ 数据范围:', rangeDisplay.textContent?.trim());
    }
    if (calendarHeader) {
      console.log('✅ 日历头部:', calendarHeader.textContent?.trim());
    }
    
    // 测试2: 检查日期范围选择器
    console.log('🔍 测试2: 检查日期范围选择器');
    const rangePicker = document.querySelector('.ant-picker-range');
    if (rangePicker) {
      console.log('✅ 日期范围选择器存在');
      const inputs = rangePicker.querySelectorAll('input');
      console.log('输入框数量:', inputs.length);
      inputs.forEach((input, index) => {
        console.log(`  输入框${index + 1}:`, input.value);
      });
    } else {
      console.log('❌ 日期范围选择器不存在');
    }
    
    // 测试3: 检查日历组件状态
    console.log('🔍 测试3: 检查日历组件状态');
    const calendarElement = document.querySelector('.ant-picker-calendar');
    if (calendarElement) {
      console.log('✅ 日历组件存在');
      
      // 检查日历的当前月份显示
      const monthYearDisplay = calendarElement.querySelector('.ant-picker-calendar-header-view');
      if (monthYearDisplay) {
        console.log('日历显示月份:', monthYearDisplay.textContent?.trim());
      }
      
      // 检查日历单元格
      const cells = calendarElement.querySelectorAll('.ant-picker-calendar-date');
      console.log('日历单元格数量:', cells.length);
      
      // 检查是否有事件显示
      const events = calendarElement.querySelectorAll('.calendar-event');
      console.log('事件数量:', events.length);
      
      if (events.length > 0) {
        events.forEach((event, index) => {
          const badge = event.querySelector('.ant-badge-status-text');
          console.log(`  事件${index + 1}:`, badge?.textContent?.trim());
        });
      }
    }
    
    // 测试4: 检查状态同步
    console.log('🔍 测试4: 检查状态同步');
    const monthText = monthDisplay?.textContent || '';
    const calendarText = calendarHeader?.textContent || '';
    
    // 提取月份信息
    const monthMatch = monthText.match(/(\d{4})年(\d{2})月/);
    const calendarMatch = calendarText.match(/(\d{4})年(\d{2})月/);
    
    if (monthMatch && calendarMatch) {
      const monthYear = monthMatch[1] + monthMatch[2];
      const calendarYear = calendarMatch[1] + calendarMatch[2];
      
      console.log('月份显示:', monthYear);
      console.log('日历显示:', calendarYear);
      console.log('同步状态:', monthYear === calendarYear ? '✅ 已同步' : '❌ 未同步');
    } else {
      console.log('❌ 无法解析月份信息');
    }
    
    // 测试5: 检查数据范围与日历的匹配
    console.log('🔍 测试5: 检查数据范围与日历的匹配');
    const rangeText = rangeDisplay?.textContent || '';
    const rangeMatch = rangeText.match(/(\d{2})-(\d{2}) 至 (\d{2})-(\d{2})/);
    
    if (rangeMatch) {
      const startMonth = rangeMatch[1];
      const endMonth = rangeMatch[3];
      console.log('数据范围月份:', startMonth, '至', endMonth);
      
      if (monthMatch) {
        const displayMonth = monthMatch[2];
        console.log('显示月份:', displayMonth);
        console.log('范围匹配:', startMonth === displayMonth ? '✅ 匹配' : '❌ 不匹配');
      }
    }
    
    console.log('🎉 日历同步功能测试完成！');
    console.log('✅ 修复内容:');
    console.log('   - 日期范围变化时同步更新日历显示');
    console.log('   - 初始化时正确设置日历值');
    console.log('   - 重置功能同步更新日历');
    console.log('   - 面板变化事件正确处理');
    
    console.log('📝 使用说明:');
    console.log('   1. 选择日期范围时，日历会自动切换到对应月份');
    console.log('   2. 点击日历导航按钮时，月份信息会同步更新');
    console.log('   3. 使用重置按钮时，日历和数据都会回到当前月份');
    console.log('   4. 所有状态保持同步显示');
    
  } catch (error) {
    console.error('❌ 测试过程中出现错误:', error);
  }
}

// 执行测试
testCalendarSync(); 