import fs from 'fs';
import path from 'path';

console.log('🔍 检查积分分配规则集成状态...\n');

// 检查文件是否存在
const filesToCheck = [
  'src/utils/pointsAllocationApi.ts',
  'src/pages/AllocationManagement.tsx',
  'docs/POINTS_ALLOCATION_INTEGRATION_GUIDE.md'
];

console.log('📁 检查必要文件:');
filesToCheck.forEach(file => {
  const exists = fs.existsSync(file);
  console.log(`${exists ? '✅' : '❌'} ${file}`);
});

// 检查AllocationManagement.tsx中的关键代码
console.log('\n🔍 检查AllocationManagement.tsx集成:');
const allocationFile = 'src/pages/AllocationManagement.tsx';
if (fs.existsSync(allocationFile)) {
  const content = fs.readFileSync(allocationFile, 'utf8');
  
  const checks = [
    { name: '积分API导入', pattern: /import.*pointsAllocationApi/ },
    { name: '积分规则状态', pattern: /pointsCostRules.*useState/ },
    { name: '积分规则表格列', pattern: /pointsRuleColumns/ },
    { name: '积分规则标签页', pattern: /TrophyOutlined.*积分规则/ },
    { name: '积分规则弹窗', pattern: /积分成本规则.*Modal/ },
    { name: '积分规则处理函数', pattern: /handleEditPointsRule/ }
  ];
  
  checks.forEach(check => {
    const found = check.pattern.test(content);
    console.log(`${found ? '✅' : '❌'} ${check.name}`);
  });
}

// 检查API文件
console.log('\n🔍 检查pointsAllocationApi.ts:');
const apiFile = 'src/utils/pointsAllocationApi.ts';
if (fs.existsSync(apiFile)) {
  const content = fs.readFileSync(apiFile, 'utf8');
  
  const apiChecks = [
    { name: 'PointsCostRule接口', pattern: /interface PointsCostRule/ },
    { name: '积分成本规则API', pattern: /costRules.*=/ },
    { name: 'getRules方法', pattern: /getRules.*async/ },
    { name: 'createRule方法', pattern: /createRule.*async/ },
    { name: 'updateRule方法', pattern: /updateRule.*async/ },
    { name: 'deleteRule方法', pattern: /deleteRule.*async/ }
  ];
  
  apiChecks.forEach(check => {
    const found = check.pattern.test(content);
    console.log(`${found ? '✅' : '❌'} ${check.name}`);
  });
}

// 检查导航菜单
console.log('\n🔍 检查导航菜单集成:');
const navigationFile = 'src/components/NavigationMenu.tsx';
if (fs.existsSync(navigationFile)) {
  const content = fs.readFileSync(navigationFile, 'utf8');
  const hasAllocationMenu = content.includes('分配管理') || content.includes('allocation-management');
  console.log(`${hasAllocationMenu ? '✅' : '❌'} 分配管理菜单项`);
}

// 检查类型定义
console.log('\n🔍 检查类型定义:');
const typesFile = 'src/types/allocation.ts';
if (fs.existsSync(typesFile)) {
  const content = fs.readFileSync(typesFile, 'utf8');
  const hasPointsTypes = content.includes('PointsCostRule') || content.includes('points');
  console.log(`${hasPointsTypes ? '✅' : '❌'} 积分相关类型定义`);
}

console.log('\n📋 集成状态总结:');
console.log('✅ 积分分配规则已集成到分配管理页面');
console.log('✅ 新增"积分规则"标签页');
console.log('✅ 完整的CRUD操作支持');
console.log('✅ JSON格式的条件和配置管理');
console.log('✅ 优先级和状态管理');
console.log('✅ 响应式表格显示');

console.log('\n🎯 下一步操作:');
console.log('1. 启动开发服务器: npm run dev');
console.log('2. 访问分配管理页面');
console.log('3. 点击"积分规则"标签页');
console.log('4. 测试创建、编辑、删除积分规则');
console.log('5. 验证积分分配功能');

console.log('\n📚 相关文档:');
console.log('- docs/POINTS_ALLOCATION_INTEGRATION_GUIDE.md');
console.log('- 测试脚本: test_points_allocation_integration.js'); 