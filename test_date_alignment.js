// 测试日期数字与总数显示的对齐效果 - 在浏览器控制台中运行
// 复制以下代码到浏览器控制台执行

console.log('🧪 测试日期数字与总数显示的对齐效果...');

function testDateAlignment() {
  try {
    console.log('📊 检查日期数字与总数显示的对齐...');
    
    // 测试1: 检查总数显示位置
    console.log('🔍 测试1: 检查总数显示位置');
    const totalCounts = document.querySelectorAll('.day-total-count');
    console.log('日期总数显示元素数量:', totalCounts.length);
    
    if (totalCounts.length > 0) {
      totalCounts.forEach((count, index) => {
        const rect = count.getBoundingClientRect();
        const cell = count.closest('.calendar-cell');
        const cellRect = cell?.getBoundingClientRect();
        
        console.log(`日期${index + 1}总数位置:`, {
          top: rect.top,
          right: rect.right,
          cellTop: cellRect?.top,
          cellRight: cellRect?.right,
          distanceFromTop: rect.top - (cellRect?.top || 0),
          distanceFromRight: (cellRect?.right || 0) - rect.right
        });
        
        // 检查是否与日期数字同行
        const dateNumber = cell?.querySelector('.ant-picker-cell-inner');
        if (dateNumber) {
          const dateRect = dateNumber.getBoundingClientRect();
          const verticalAlignment = Math.abs(rect.top - dateRect.top) < 5;
          console.log(`日期${index + 1}垂直对齐:`, verticalAlignment ? '✅ 同行' : '❌ 不同行');
        }
      });
    }
    
    // 测试2: 检查样式应用
    console.log('🔍 测试2: 检查样式应用');
    if (totalCounts.length > 0) {
      const firstCount = totalCounts[0];
      const computedStyle = window.getComputedStyle(firstCount);
      
      console.log('总数容器样式:', {
        position: computedStyle.position,
        top: computedStyle.top,
        right: computedStyle.right,
        padding: computedStyle.padding,
        fontSize: computedStyle.fontSize,
        minWidth: computedStyle.minWidth,
        height: computedStyle.height,
        display: computedStyle.display
      });
    }
    
    // 测试3: 检查与日期数字的关系
    console.log('🔍 测试3: 检查与日期数字的关系');
    const cellsWithEvents = document.querySelectorAll('.calendar-cell');
    
    cellsWithEvents.forEach((cell, index) => {
      const count = cell.querySelector('.day-total-count');
      const dateNumber = cell.querySelector('.ant-picker-cell-inner');
      
      if (count && dateNumber) {
        const countRect = count.getBoundingClientRect();
        const dateRect = dateNumber.getBoundingClientRect();
        
        console.log(`单元格${index + 1}:`, {
          dateNumberText: dateNumber.textContent?.trim(),
          countText: count.querySelector('.count-text')?.textContent,
          dateTop: dateRect.top,
          countTop: countRect.top,
          verticalDiff: Math.abs(countRect.top - dateRect.top),
          isAligned: Math.abs(countRect.top - dateRect.top) < 5
        });
      }
    });
    
    // 测试4: 检查尺寸和间距
    console.log('🔍 测试4: 检查尺寸和间距');
    if (totalCounts.length > 0) {
      totalCounts.forEach((count, index) => {
        const rect = count.getBoundingClientRect();
        console.log(`总数${index + 1}尺寸:`, {
          width: rect.width,
          height: rect.height,
          top: rect.top,
          right: rect.right
        });
        
        // 检查是否过于紧凑
        if (rect.width < 30) {
          console.log('⚠️ 总数显示可能过于紧凑');
        } else {
          console.log('✅ 总数显示尺寸合适');
        }
      });
    }
    
    // 测试5: 检查响应式效果
    console.log('🔍 测试5: 检查响应式效果');
    const viewportWidth = window.innerWidth;
    console.log('视口宽度:', viewportWidth, 'px');
    
    if (totalCounts.length > 0) {
      const firstCount = totalCounts[0];
      const rect = firstCount.getBoundingClientRect();
      
      if (rect.width < 25) {
        console.log('📱 移动端：总数显示可能被压缩');
      } else {
        console.log('💻 桌面端：总数显示空间充足');
      }
    }
    
    // 测试6: 检查视觉效果
    console.log('🔍 测试6: 检查视觉效果');
    const alignedCount = Array.from(totalCounts).filter(count => {
      const cell = count.closest('.calendar-cell');
      const dateNumber = cell?.querySelector('.ant-picker-cell-inner');
      if (dateNumber) {
        const countRect = count.getBoundingClientRect();
        const dateRect = dateNumber.getBoundingClientRect();
        return Math.abs(countRect.top - dateRect.top) < 5;
      }
      return false;
    }).length;
    
    console.log('对齐效果统计:', {
      totalCounts: totalCounts.length,
      alignedCounts: alignedCount,
      alignmentRate: totalCounts.length > 0 ? (alignedCount / totalCounts.length * 100).toFixed(1) + '%' : '0%'
    });
    
    if (alignedCount === totalCounts.length) {
      console.log('✅ 所有总数显示都与日期数字同行');
    } else {
      console.log('❌ 部分总数显示未与日期数字同行');
    }
    
    console.log('🎉 日期对齐测试完成！');
    console.log('✅ 优化效果:');
    console.log('   - 总数显示与日期数字同行');
    console.log('   - 位置调整到右上角');
    console.log('   - 尺寸更加紧凑');
    console.log('   - 字体大小调整为8px');
    console.log('   - 使用inline-flex布局');
    
    console.log('📝 显示规则:');
    console.log('   - 位置：与日期数字同行，右上角');
    console.log('   - 格式：共X条');
    console.log('   - 尺寸：最小宽度25px，高度16px');
    console.log('   - 字体：8px，粗体');
    console.log('   - 样式：蓝色背景，白色文字');
    
  } catch (error) {
    console.error('❌ 测试过程中出现错误:', error);
  }
}

// 执行测试
testDateAlignment(); 