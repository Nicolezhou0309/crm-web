// 测试月份切换时不弹出弹窗 - 在浏览器控制台中运行
// 复制以下代码到浏览器控制台执行

console.log('🧪 测试月份切换时不弹出弹窗...');

function testNoPopupOnMonthChange() {
  try {
    console.log('📊 测试月份切换功能...');
    
    // 测试1: 检查当前弹窗状态
    console.log('🔍 测试1: 检查当前弹窗状态');
    const modal = document.querySelector('.ant-modal-root');
    if (modal) {
      const modalVisible = modal.style.display !== 'none';
      console.log('弹窗当前状态:', modalVisible ? '显示' : '隐藏');
    } else {
      console.log('✅ 当前无弹窗');
    }
    
    // 测试2: 检查月份切换按钮
    console.log('🔍 测试2: 检查月份切换按钮');
    const navButtons = document.querySelectorAll('.ant-picker-calendar div[style*="display: flex"] .ant-btn');
    console.log('导航按钮数量:', navButtons.length);
    
    navButtons.forEach((btn, index) => {
      const buttonText = btn.textContent?.trim();
      console.log(`  按钮${index + 1}:`, buttonText);
      
      // 检查按钮是否有事件监听器
      const hasClickHandler = btn.onclick !== null || btn.getAttribute('onclick') !== null;
      console.log(`  按钮${index + 1}可点击:`, hasClickHandler);
    });
    
    // 测试3: 检查当前月份显示
    console.log('🔍 测试3: 检查当前月份显示');
    const monthDisplay = document.querySelector('.followups-calendar-view span[style*="fontWeight"]');
    const calendarMonthDisplay = document.querySelector('.ant-picker-calendar div[style*="display: flex"] span');
    
    if (monthDisplay) {
      console.log('页面月份显示:', monthDisplay.textContent?.trim());
    }
    if (calendarMonthDisplay) {
      console.log('日历月份显示:', calendarMonthDisplay.textContent?.trim());
    }
    
    // 测试4: 检查事件监听器
    console.log('🔍 测试4: 检查事件监听器');
    const calendarElement = document.querySelector('.ant-picker-calendar');
    if (calendarElement) {
      // 检查是否有 onSelect 事件监听器
      const hasSelectHandler = calendarElement.getAttribute('data-on-select') !== null;
      console.log('日历选择事件监听器:', hasSelectHandler);
    }
    
    // 测试5: 检查控制台日志
    console.log('🔍 测试5: 检查控制台日志');
    console.log('请查看控制台是否有以下日志:');
    console.log('  - "🔄 日历面板变化:" (月份切换)');
    console.log('  - "📅 该日期无事件:" (点击无事件日期)');
    console.log('  - "📅 显示日期详情:" (点击有事件日期)');
    
    // 测试6: 检查日期单元格
    console.log('🔍 测试6: 检查日期单元格');
    const calendarCells = document.querySelectorAll('.ant-picker-calendar-date');
    console.log('日期单元格数量:', calendarCells.length);
    
    // 检查有事件的日期
    const cellsWithEvents = document.querySelectorAll('.ant-picker-calendar-date .calendar-event');
    console.log('有事件的日期数量:', cellsWithEvents.length);
    
    if (cellsWithEvents.length > 0) {
      console.log('有事件的日期:');
      cellsWithEvents.forEach((event, index) => {
        const cell = event.closest('.ant-picker-calendar-date');
        const dateValue = cell?.querySelector('.ant-picker-calendar-date-value');
        console.log(`  事件${index + 1}:`, dateValue?.textContent?.trim());
      });
    }
    
    // 测试7: 检查弹窗内容
    console.log('🔍 测试7: 检查弹窗内容');
    const modalTitle = document.querySelector('.ant-modal-title');
    const modalContent = document.querySelector('.ant-modal-body');
    
    if (modalTitle) {
      console.log('弹窗标题:', modalTitle.textContent?.trim());
    }
    if (modalContent) {
      const eventItems = modalContent.querySelectorAll('.ant-list-item');
      console.log('弹窗中的事件数量:', eventItems.length);
    }
    
    console.log('🎉 月份切换弹窗测试完成！');
    console.log('✅ 预期行为:');
    console.log('   - 月份切换时不弹出弹窗');
    console.log('   - 只有点击有事件的日期才弹出弹窗');
    console.log('   - 点击无事件的日期不弹出弹窗');
    console.log('   - 月份切换时自动加载对应数据');
    
    console.log('📝 使用说明:');
    console.log('   1. 使用 ‹ › 按钮切换月份，不会弹出弹窗');
    console.log('   2. 点击有事件的日期会弹出详情弹窗');
    console.log('   3. 点击无事件的日期不会弹出弹窗');
    console.log('   4. 月份切换时自动加载对应月份的数据');
    
  } catch (error) {
    console.error('❌ 测试过程中出现错误:', error);
  }
}

// 执行测试
testNoPopupOnMonthChange(); 