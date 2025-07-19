// 测试地铁站数据获取功能
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.VITE_SUPABASE_URL || 'your_supabase_url'
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY || 'your_supabase_anon_key'

const supabase = createClient(supabaseUrl, supabaseAnonKey)

async function testMetroStations() {
  try {
    console.log('开始测试地铁站数据获取...')
    
    // 测试获取地铁站数据
    const { data, error } = await supabase.rpc('get_metrostations')
    
    if (error) {
      console.error('获取地铁站数据失败:', error)
      return
    }
    
    console.log('地铁站数据获取成功:')
    console.log('数据条数:', data.length)
    console.log('前5条数据:', data.slice(0, 5))
    
    // 按线路分组
    const lineGroups = data.reduce((acc, station) => {
      const line = station.line || '其他'
      if (!acc[line]) {
        acc[line] = []
      }
      acc[line].push(station)
      return acc
    }, {})
    
    console.log('按线路分组结果:')
    Object.entries(lineGroups).forEach(([line, stations]) => {
      console.log(`${line}: ${stations.length}个站点`)
    })
    
  } catch (error) {
    console.error('测试过程中出错:', error)
  }
}

// 运行测试
testMetroStations() 