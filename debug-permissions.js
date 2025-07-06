// 将此代码复制到浏览器控制台运行
console.log('🔍 开始检查用户权限和部门信息...');

// 检查用户资料
const { data: userProfile, error: profileError } = await supabase
  .from('users_profile')
  .select('*')
  .eq('user_id', 'fcaaac7e-0afb-4031-bdb7-638c950bd6e9')
  .single();

console.log('👤 用户资料:', { userProfile, profileError });

// 检查用户管理的部门
const { data: managedOrgs, error: orgsError } = await supabase
  .from('organizations')
  .select('*')
  .eq('admin', 'fcaaac7e-0afb-4031-bdb7-638c950bd6e9');

console.log('🏢 管理的部门:', { managedOrgs, orgsError });

// 检查所有部门
const { data: allOrgs, error: allOrgsError } = await supabase
  .from('organizations')
  .select('*');

console.log('🏢 所有部门:', { allOrgs, allOrgsError });

// 检查当前选择的部门（如果有的话）
console.log('🎯 当前选择的部门:', window.selectedDept || '未选择');
