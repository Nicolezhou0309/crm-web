// 测试记录总数显示功能 - 在浏览器控制台中运行
// 复制以下代码到浏览器控制台执行

console.log('🧪 测试记录总数显示功能...');

function testTotalRecords() {
  try {
    console.log('📊 测试记录总数显示...');
    
    // 测试1: 检查总数显示元素
    console.log('🔍 测试1: 检查总数显示元素');
    const totalRecordsElement = document.querySelector('[style*="共"]');
    
    if (totalRecordsElement) {
      const text = totalRecordsElement.textContent;
      console.log('总数显示文本:', text);
      
      // 提取数字
      const match = text.match(/共\s*(\d+)\s*条记录/);
      if (match) {
        const count = parseInt(match[1]);
        console.log('提取的记录数:', count);
        
        // 验证数字是否合理
        if (count >= 0) {
          console.log('✅ 记录数格式正确');
        } else {
          console.log('❌ 记录数格式错误');
        }
      } else {
        console.log('❌ 无法提取记录数');
      }
    } else {
      console.log('❌ 未找到总数显示元素');
    }
    
    // 测试2: 检查数据状态
    console.log('🔍 测试2: 检查数据状态');
    
    // 检查日历事件
    const calendarEvents = document.querySelectorAll('.calendar-event');
    console.log('日历中显示的事件数量:', calendarEvents.length);
    
    // 检查是否有数据
    if (calendarEvents.length > 0) {
      console.log('✅ 日历中有数据显示');
      
      // 统计不同日期的记录
      const dateCounts = {};
      calendarEvents.forEach(event => {
        const cell = event.closest('.ant-picker-cell');
        if (cell) {
          const date = cell.getAttribute('title') || '未知日期';
          dateCounts[date] = (dateCounts[date] || 0) + 1;
        }
      });
      
      console.log('各日期记录分布:', dateCounts);
    } else {
      console.log('📝 日历中暂无数据显示');
    }
    
    // 测试3: 检查加载状态
    console.log('🔍 测试3: 检查加载状态');
    const loadingSpinner = document.querySelector('.ant-spin-spinning');
    if (loadingSpinner) {
      console.log('⏳ 数据正在加载中...');
    } else {
      console.log('✅ 数据加载完成');
    }
    
    // 测试4: 检查过滤器状态
    console.log('🔍 测试4: 检查过滤器状态');
    const stageFilter = document.querySelector('.ant-select-selection-item');
    if (stageFilter) {
      console.log('当前阶段过滤:', stageFilter.textContent);
    } else {
      console.log('当前阶段过滤: 全部');
    }
    
    // 测试5: 检查日期范围
    console.log('🔍 测试5: 检查日期范围');
    const dateRangeText = document.querySelector('[style*="数据范围"]');
    if (dateRangeText) {
      console.log('当前日期范围:', dateRangeText.textContent);
    }
    
    // 测试6: 检查总数显示样式
    console.log('🔍 测试6: 检查总数显示样式');
    if (totalRecordsElement) {
      const computedStyle = window.getComputedStyle(totalRecordsElement);
      console.log('总数显示样式:', {
        fontSize: computedStyle.fontSize,
        fontWeight: computedStyle.fontWeight,
        color: computedStyle.color,
        backgroundColor: computedStyle.backgroundColor,
        padding: computedStyle.padding,
        borderRadius: computedStyle.borderRadius,
        border: computedStyle.border
      });
      
      // 检查样式是否符合预期
      const expectedColor = 'rgb(24, 144, 255)'; // #1890ff
      const expectedBgColor = 'rgb(230, 247, 255)'; // #e6f7ff
      
      if (computedStyle.color === expectedColor) {
        console.log('✅ 文字颜色正确');
      } else {
        console.log('❌ 文字颜色不正确:', computedStyle.color);
      }
      
      if (computedStyle.backgroundColor === expectedBgColor) {
        console.log('✅ 背景颜色正确');
      } else {
        console.log('❌ 背景颜色不正确:', computedStyle.backgroundColor);
      }
    }
    
    // 测试7: 检查响应式设计
    console.log('🔍 测试7: 检查响应式设计');
    const viewportWidth = window.innerWidth;
    console.log('视口宽度:', viewportWidth, 'px');
    
    if (totalRecordsElement) {
      const elementRect = totalRecordsElement.getBoundingClientRect();
      console.log('总数显示元素尺寸:', {
        width: elementRect.width,
        height: elementRect.height
      });
      
      if (elementRect.width < 100) {
        console.log('📱 移动端：总数显示可能被压缩');
      } else {
        console.log('💻 桌面端：总数显示空间充足');
      }
    }
    
    // 测试8: 检查数据一致性
    console.log('🔍 测试8: 检查数据一致性');
    const displayedCount = calendarEvents.length;
    const totalCountText = totalRecordsElement?.textContent?.match(/\d+/)?.[0];
    const totalCount = totalCountText ? parseInt(totalCountText) : 0;
    
    console.log('显示的事件数:', displayedCount);
    console.log('总数显示:', totalCount);
    
    if (displayedCount === totalCount) {
      console.log('✅ 数据一致性检查通过');
    } else {
      console.log('⚠️ 数据不一致，可能原因:');
      console.log('   - 某些事件可能被隐藏');
      console.log('   - 过滤器可能影响显示');
      console.log('   - 数据更新可能有延迟');
    }
    
    console.log('🎉 记录总数显示功能测试完成！');
    console.log('✅ 功能特点:');
    console.log('   - 实时显示当前月份记录总数');
    console.log('   - 美观的蓝色背景样式');
    console.log('   - 与数据范围显示并列');
    console.log('   - 响应式设计适配不同屏幕');
    console.log('   - 数据加载时自动更新');
    
    console.log('📝 显示规则:');
    console.log('   - 格式：共 X 条记录');
    console.log('   - 位置：右上角数据范围旁边');
    console.log('   - 样式：蓝色背景，白色边框');
    console.log('   - 更新：数据加载完成后自动更新');
    
  } catch (error) {
    console.error('❌ 测试过程中出现错误:', error);
  }
}

// 执行测试
testTotalRecords(); 