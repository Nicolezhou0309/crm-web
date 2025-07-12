// =====================================
// Supabase数据管理后台连接测试
// 目标：连接Supabase进行积分分配系统数据测试
// =====================================

import { createClient } from '@supabase/supabase-js'

// Supabase配置
const supabaseUrl = 'https://wteqgprgiylmxzszcnws.supabase.co'
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Ind0ZXFncHJnaXlsbXh6c3pjbndzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTExNzc5ODEsImV4cCI6MjA2Njc1Mzk4MX0.VpS4zrfPjA8e'

// 创建Supabase客户端
const supabase = createClient(supabaseUrl, supabaseAnonKey)

// =====================================
// 1. 基础连接测试
// =====================================

async function testConnection() {
    console.log('🔗 测试Supabase连接...')
    
    try {
        // 测试基础连接
        const { data, error } = await supabase.from('users_profile').select('count').limit(1)
        
        if (error) {
            console.error('❌ 连接失败:', error)
            return false
        }
        
        console.log('✅ Supabase连接成功')
        return true
    } catch (error) {
        console.error('❌ 连接异常:', error)
        return false
    }
}

// =====================================
// 2. 积分分配系统组件检查
// =====================================

async function checkSystemComponents() {
    console.log('\n🔍 检查积分分配系统组件...')
    
    const checks = []
    
    // 检查积分分配枚举
    try {
        const { data: enumData, error: enumError } = await supabase.rpc('get_enum_values', { enum_name: 'allocation_method' })
        if (enumError) {
            checks.push({ name: '积分分配枚举', status: '❌', error: enumError.message })
        } else {
            const hasPoints = enumData && enumData.includes('points')
            checks.push({ 
                name: '积分分配枚举', 
                status: hasPoints ? '✅' : '❌', 
                details: hasPoints ? 'points枚举存在' : 'points枚举不存在'
            })
        }
    } catch (error) {
        checks.push({ name: '积分分配枚举', status: '❌', error: error.message })
    }
    
    // 检查积分成本表
    try {
        const { data: costData, error: costError } = await supabase.from('lead_points_cost').select('count').limit(1)
        checks.push({ 
            name: '积分成本表', 
            status: costError ? '❌' : '✅', 
            details: costError ? costError.message : '表存在'
        })
    } catch (error) {
        checks.push({ name: '积分成本表', status: '❌', error: error.message })
    }
    
    // 检查分配日志积分字段
    try {
        const { data: logData, error: logError } = await supabase.from('simple_allocation_logs').select('points_cost').limit(1)
        checks.push({ 
            name: '分配日志积分字段', 
            status: logError ? '❌' : '✅', 
            details: logError ? logError.message : '字段存在'
        })
    } catch (error) {
        checks.push({ name: '分配日志积分字段', status: '❌', error: error.message })
    }
    
    // 输出检查结果
    checks.forEach(check => {
        console.log(`${check.status} ${check.name}: ${check.details || check.error}`)
    })
    
    return checks
}

// =====================================
// 3. 测试用户管理
// =====================================

async function manageTestUsers() {
    console.log('\n👥 管理测试用户...')
    
    // 创建测试用户
    const testUsers = [
        { id: 1001, name: '测试用户A', email: 'test_a@example.com', phone: '13800138001' },
        { id: 1002, name: '测试用户B', email: 'test_b@example.com', phone: '13800138002' },
        { id: 1003, name: '测试用户C', email: 'test_c@example.com', phone: '13800138003' }
    ]
    
    for (const user of testUsers) {
        try {
            // 检查用户是否存在
            const { data: existingUser } = await supabase
                .from('users_profile')
                .select('id')
                .eq('id', user.id)
                .single()
            
            if (!existingUser) {
                // 创建用户
                const { error: insertError } = await supabase
                    .from('users_profile')
                    .insert({
                        id: user.id,
                        name: user.name,
                        email: user.email,
                        phone: user.phone,
                        status: 'active',
                        organization_id: 1,
                        created_at: new Date().toISOString(),
                        updated_at: new Date().toISOString()
                    })
                
                if (insertError) {
                    console.log(`❌ 创建用户${user.name}失败:`, insertError.message)
                } else {
                    console.log(`✅ 创建用户${user.name}成功`)
                }
            } else {
                console.log(`ℹ️ 用户${user.name}已存在`)
            }
        } catch (error) {
            console.log(`❌ 处理用户${user.name}时出错:`, error.message)
        }
    }
    
    // 创建积分钱包
    const walletData = [
        { user_id: 1001, total_points: 100 },
        { user_id: 1002, total_points: 50 },
        { user_id: 1003, total_points: 200 }
    ]
    
    for (const wallet of walletData) {
        try {
            // 检查钱包是否存在
            const { data: existingWallet } = await supabase
                .from('user_points_wallet')
                .select('user_id')
                .eq('user_id', wallet.user_id)
                .single()
            
            if (!existingWallet) {
                // 创建钱包
                const { error: walletError } = await supabase
                    .from('user_points_wallet')
                    .insert({
                        user_id: wallet.user_id,
                        total_points: wallet.total_points,
                        created_at: new Date().toISOString(),
                        updated_at: new Date().toISOString()
                    })
                
                if (walletError) {
                    console.log(`❌ 创建钱包失败:`, walletError.message)
                } else {
                    console.log(`✅ 创建用户${wallet.user_id}钱包成功，积分: ${wallet.total_points}`)
                }
            } else {
                console.log(`ℹ️ 用户${wallet.user_id}钱包已存在`)
            }
        } catch (error) {
            console.log(`❌ 处理钱包时出错:`, error.message)
        }
    }
}

// =====================================
// 4. 测试积分成本计算
// =====================================

async function testPointsCostCalculation() {
    console.log('\n💰 测试积分成本计算...')
    
    const testCases = [
        {
            name: '基础成本测试',
            source: '抖音',
            leadtype: '意向客户',
            campaignname: null,
            unitname: null,
            remark: null
        },
        {
            name: '动态调整测试',
            source: '微信',
            leadtype: '准客户',
            campaignname: '学区房广告',
            unitname: '学区单元',
            remark: '学区房[COMMUNITY:浦江公园社区]'
        },
        {
            name: '高价值线索测试',
            source: '抖音',
            leadtype: '意向客户',
            campaignname: '高端别墅广告',
            unitname: '别墅单元',
            remark: '高端别墅[COMMUNITY:浦江公园社区]'
        }
    ]
    
    for (const testCase of testCases) {
        try {
            const { data, error } = await supabase.rpc('calculate_lead_points_cost', {
                p_source: testCase.source,
                p_leadtype: testCase.leadtype,
                p_campaignname: testCase.campaignname,
                p_unitname: testCase.unitname,
                p_remark: testCase.remark
            })
            
            if (error) {
                console.log(`❌ ${testCase.name}失败:`, error.message)
            } else {
                console.log(`✅ ${testCase.name}:`, data)
            }
        } catch (error) {
            console.log(`❌ ${testCase.name}异常:`, error.message)
        }
    }
}

// =====================================
// 5. 测试积分分配逻辑
// =====================================

async function testPointsAllocation() {
    console.log('\n🎯 测试积分分配逻辑...')
    
    try {
        // 测试积分分配
        const { data, error } = await supabase.rpc('allocate_from_users', {
            user_list: [1001, 1002, 1003],
            method: 'points',
            p_required_points: 50
        })
        
        if (error) {
            console.log('❌ 积分分配测试失败:', error.message)
        } else {
            console.log('✅ 积分分配测试成功，选中用户ID:', data)
        }
    } catch (error) {
        console.log('❌ 积分分配测试异常:', error.message)
    }
}

// =====================================
// 6. 创建测试线索
// =====================================

async function createTestLeads() {
    console.log('\n📝 创建测试线索...')
    
    const testLeads = [
        {
            name: '高价值线索',
            source: '抖音',
            leadtype: '意向客户',
            campaignname: '高端别墅广告',
            unitname: '别墅单元',
            remark: '高端别墅[COMMUNITY:浦江公园社区]',
            phone: '13900139001',
            wechat: 'test_high_001'
        },
        {
            name: '普通线索',
            source: '微信',
            leadtype: '准客户',
            campaignname: '普通广告',
            unitname: '普通单元',
            remark: '普通线索[COMMUNITY:浦江公园社区]',
            phone: '13900139002',
            wechat: 'test_normal_002'
        },
        {
            name: '低价值线索',
            source: '百度',
            leadtype: '潜在客户',
            campaignname: '基础广告',
            unitname: '基础单元',
            remark: '基础线索[COMMUNITY:浦江公园社区]',
            phone: '13900139003',
            wechat: 'test_low_003'
        }
    ]
    
    for (const lead of testLeads) {
        try {
            const leadid = `JS_TEST_${lead.name}_${Date.now()}`
            
            const { error } = await supabase
                .from('leads')
                .insert({
                    leadid: leadid,
                    source: lead.source,
                    leadtype: lead.leadtype,
                    campaignname: lead.campaignname,
                    unitname: lead.unitname,
                    remark: lead.remark,
                    phone: lead.phone,
                    wechat: lead.wechat,
                    created_at: new Date().toISOString(),
                    updated_at: new Date().toISOString()
                })
            
            if (error) {
                console.log(`❌ 创建${lead.name}失败:`, error.message)
            } else {
                console.log(`✅ 创建${lead.name}成功，ID: ${leadid}`)
            }
        } catch (error) {
            console.log(`❌ 创建${lead.name}异常:`, error.message)
        }
    }
}

// =====================================
// 7. 查看测试结果
// =====================================

async function viewTestResults() {
    console.log('\n📊 查看测试结果...')
    
    // 查看分配日志
    try {
        const { data: allocationLogs, error: logError } = await supabase
            .from('simple_allocation_logs')
            .select('*')
            .like('leadid', 'JS_TEST_%')
            .order('created_at', { ascending: false })
        
        if (logError) {
            console.log('❌ 获取分配日志失败:', logError.message)
        } else {
            console.log('📋 分配日志:', allocationLogs)
        }
    } catch (error) {
        console.log('❌ 获取分配日志异常:', error.message)
    }
    
    // 查看积分交易
    try {
        const { data: transactions, error: transError } = await supabase
            .from('user_points_transactions')
            .select('*')
            .like('description', '%JS_TEST_%')
            .order('created_at', { ascending: false })
        
        if (transError) {
            console.log('❌ 获取积分交易失败:', transError.message)
        } else {
            console.log('💰 积分交易:', transactions)
        }
    } catch (error) {
        console.log('❌ 获取积分交易异常:', error.message)
    }
    
    // 查看followups
    try {
        const { data: followups, error: followError } = await supabase
            .from('followups')
            .select('*')
            .like('leadid', 'JS_TEST_%')
            .order('created_at', { ascending: false })
        
        if (followError) {
            console.log('❌ 获取followups失败:', followError.message)
        } else {
            console.log('📞 Followups:', followups)
        }
    } catch (error) {
        console.log('❌ 获取followups异常:', error.message)
    }
}

// =====================================
// 8. 清理测试数据
// =====================================

async function cleanupTestData() {
    console.log('\n🧹 清理测试数据...')
    
    try {
        // 清理测试线索
        const { error: leadsError } = await supabase
            .from('leads')
            .delete()
            .like('leadid', 'JS_TEST_%')
        
        if (leadsError) {
            console.log('❌ 清理测试线索失败:', leadsError.message)
        } else {
            console.log('✅ 清理测试线索成功')
        }
        
        // 清理测试分配日志
        const { error: logsError } = await supabase
            .from('simple_allocation_logs')
            .delete()
            .like('leadid', 'JS_TEST_%')
        
        if (logsError) {
            console.log('❌ 清理测试分配日志失败:', logsError.message)
        } else {
            console.log('✅ 清理测试分配日志成功')
        }
        
        // 清理测试积分交易
        const { error: transError } = await supabase
            .from('user_points_transactions')
            .delete()
            .like('description', '%JS_TEST_%')
        
        if (transError) {
            console.log('❌ 清理测试积分交易失败:', transError.message)
        } else {
            console.log('✅ 清理测试积分交易成功')
        }
        
    } catch (error) {
        console.log('❌ 清理测试数据异常:', error.message)
    }
}

// =====================================
// 9. 主测试函数
// =====================================

async function runAllTests() {
    console.log('🚀 开始积分分配系统测试...\n')
    
    // 1. 测试连接
    const connected = await testConnection()
    if (!connected) {
        console.log('❌ 无法连接到Supabase，测试终止')
        return
    }
    
    // 2. 检查系统组件
    await checkSystemComponents()
    
    // 3. 管理测试用户
    await manageTestUsers()
    
    // 4. 测试积分成本计算
    await testPointsCostCalculation()
    
    // 5. 测试积分分配逻辑
    await testPointsAllocation()
    
    // 6. 创建测试线索
    await createTestLeads()
    
    // 等待一段时间让触发器处理
    console.log('\n⏳ 等待触发器处理...')
    await new Promise(resolve => setTimeout(resolve, 3000))
    
    // 7. 查看测试结果
    await viewTestResults()
    
    console.log('\n✅ 所有测试完成！')
}

// =====================================
// 10. 导出函数
// =====================================

export {
    testConnection,
    checkSystemComponents,
    manageTestUsers,
    testPointsCostCalculation,
    testPointsAllocation,
    createTestLeads,
    viewTestResults,
    cleanupTestData,
    runAllTests
}

// =====================================
// 11. 如果直接运行此文件
// =====================================

if (typeof window !== 'undefined') {
    // 浏览器环境
    window.runAllTests = runAllTests
    window.cleanupTestData = cleanupTestData
    console.log('📝 测试函数已加载到全局作用域')
    console.log('💡 使用方法: runAllTests() 或 cleanupTestData()')
} else {
    // Node.js环境
    runAllTests().catch(console.error)
} 