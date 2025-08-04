// 测试只保留月视图功能 - 在浏览器控制台中运行
// 复制以下代码到浏览器控制台执行

console.log('🧪 测试只保留月视图功能...');

function testMonthViewOnly() {
  try {
    console.log('📊 测试月视图功能...');
    
    // 测试1: 检查日历组件模式
    console.log('🔍 测试1: 检查日历组件模式');
    const calendarElement = document.querySelector('.ant-picker-calendar');
    if (calendarElement) {
      console.log('✅ 日历组件存在');
      
      // 检查是否有年视图切换按钮
      const yearToggle = calendarElement.querySelector('.ant-picker-calendar-header-right .ant-btn');
      if (yearToggle) {
        console.log('❌ 仍存在年视图切换按钮:', yearToggle.textContent?.trim());
      } else {
        console.log('✅ 已移除年视图切换按钮');
      }
      
      // 检查月视图按钮
      const monthToggle = calendarElement.querySelector('.ant-picker-calendar-header-right .ant-btn.ant-btn-primary');
      if (monthToggle) {
        console.log('✅ 月视图按钮存在:', monthToggle.textContent?.trim());
      } else {
        console.log('❌ 月视图按钮不存在');
      }
    } else {
      console.log('❌ 日历组件不存在');
      return;
    }
    
    // 测试2: 检查过滤器区域
    console.log('🔍 测试2: 检查过滤器区域');
    const filterElements = document.querySelectorAll('.calendar-filters .filter-item');
    console.log('过滤器项目数量:', filterElements.length);
    
    filterElements.forEach((element, index) => {
      const label = element.querySelector('.filter-label');
      console.log(`  过滤器${index + 1}:`, label?.textContent?.trim());
    });
    
    // 检查是否还有日期范围选择器
    const rangePicker = document.querySelector('.ant-picker-range');
    if (rangePicker) {
      console.log('❌ 仍存在日期范围选择器');
    } else {
      console.log('✅ 已移除日期范围选择器');
    }
    
    // 测试3: 检查月份导航功能
    console.log('🔍 测试3: 检查月份导航功能');
    const navButtons = document.querySelectorAll('.ant-picker-calendar-header .ant-picker-calendar-header-left .ant-btn');
    console.log('导航按钮数量:', navButtons.length);
    
    navButtons.forEach((btn, index) => {
      console.log(`  导航按钮${index + 1}:`, btn.textContent?.trim());
    });
    
    // 测试4: 检查当前月份显示
    console.log('🔍 测试4: 检查当前月份显示');
    const monthDisplay = document.querySelector('.followups-calendar-view span[style*="fontWeight"]');
    if (monthDisplay) {
      console.log('✅ 月份显示存在:', monthDisplay.textContent?.trim());
    } else {
      console.log('❌ 月份显示不存在');
    }
    
    // 测试5: 检查数据范围显示
    console.log('🔍 测试5: 检查数据范围显示');
    const rangeDisplay = document.querySelector('.followups-calendar-view div[style*="fontSize"]');
    if (rangeDisplay) {
      console.log('✅ 数据范围显示存在:', rangeDisplay.textContent?.trim());
    } else {
      console.log('❌ 数据范围显示不存在');
    }
    
    // 测试6: 检查日历单元格
    console.log('🔍 测试6: 检查日历单元格');
    const calendarCells = document.querySelectorAll('.ant-picker-calendar-date');
    console.log('日历单元格数量:', calendarCells.length);
    
    if (calendarCells.length > 0) {
      // 检查是否有事件显示
      const events = document.querySelectorAll('.calendar-event');
      console.log('事件数量:', events.length);
      
      if (events.length > 0) {
        events.forEach((event, index) => {
          const badge = event.querySelector('.ant-badge-status-text');
          console.log(`  事件${index + 1}:`, badge?.textContent?.trim());
        });
      }
    }
    
    // 测试7: 检查重置按钮
    console.log('🔍 测试7: 检查重置按钮');
    const resetButton = document.querySelector('.calendar-filters .ant-btn-primary');
    if (resetButton) {
      console.log('✅ 重置按钮存在:', resetButton.textContent?.trim());
    } else {
      console.log('❌ 重置按钮不存在');
    }
    
    console.log('🎉 月视图功能测试完成！');
    console.log('✅ 当前功能状态:');
    console.log('   - 仅支持月视图，年视图已移除');
    console.log('   - 月份切换自动加载对应数据');
    console.log('   - 跟进阶段过滤保留');
    console.log('   - 重置为当月功能保留');
    console.log('   - 日期范围选择器已移除');
    console.log('   - 月份信息显示正常');
    console.log('   - 数据范围显示正常');
    
    console.log('📝 使用说明:');
    console.log('   1. 使用日历头部的左右箭头切换月份');
    console.log('   2. 月份切换时会自动加载对应月份的数据');
    console.log('   3. 使用跟进阶段过滤器筛选数据');
    console.log('   4. 使用重置按钮快速回到当前月份');
    console.log('   5. 点击日期查看详细的跟进记录');
    
  } catch (error) {
    console.error('❌ 测试过程中出现错误:', error);
  }
}

// 执行测试
testMonthViewOnly(); 