import { supabase } from '../supaClient';

export interface Deal {
  id: string;
  leadid: string;
  invalid: boolean | null;
  contract_records: string | null; // 关联的合同记录ID
  
  // 从 contract_records 表关联的字段（Supabase 关联查询返回的字段名）
  contract_records_data?: {
    id: string;
    external_community_name: string;
    business_number: string;
    room_number: string;
    operation_date: string;
    customer_channel: string | null;
    lease_type: string | null;
    official_price: number | null;
    contract_period: number | null;
    deposit: number | null;
    start_time: string | null;
    end_time: string | null;
    sales_name: string | null;
    contract_type: string | null;
    contract_type_detail: string | null;
    reservation_time: string | null;
    reservation_number: string | null;
    customer_name: string | null;
    phone: string | null;
    previous_contract: string | null;
    room_type: string | null;
  };
}

export interface DealFilters {
  id?: string[];
  leadid?: string[];
  invalid?: boolean[];
  
  // contract_records 表字段筛选
  external_community_name?: string[];
  business_number?: string[];
  room_number?: string[];
  operation_date_start?: string;
  operation_date_end?: string;
  customer_channel?: string[];
  lease_type?: string[];
  official_price_min?: number;
  official_price_max?: number;
  contract_period_min?: number;
  contract_period_max?: number;
  deposit_min?: number;
  deposit_max?: number;
  start_time_start?: string;
  start_time_end?: string;
  end_time_start?: string;
  end_time_end?: string;
  sales_name?: string[];
  contract_type?: string[];
  contract_type_detail?: string[];
  reservation_time_start?: string;
  reservation_time_end?: string;
  reservation_number?: string[];
  customer_name?: string[];
  phone?: string[];
  previous_contract?: string[];
  room_type?: string[];
  
  // 通用筛选
  created_at_start?: string;
  created_at_end?: string;
  orderBy?: string;
  ascending?: boolean;
  limit?: number;
  offset?: number;
}

// 获取成交记录列表（支持多字段筛选）
export async function getDeals(filters: DealFilters = {}) {
  // 先使用简单查询，然后手动获取关联数据
  let query = supabase
    .from('deals')
    .select('*');

  // 应用基本筛选条件
  if (filters.id && filters.id.length > 0) {
    query = query.in('id', filters.id);
  }
  
  if (filters.leadid && filters.leadid.length > 0) {
    query = query.in('leadid', filters.leadid);
  }
  
  if (filters.invalid !== undefined) {
    query = query.eq('invalid', filters.invalid);
  }

  // 通用筛选 - 暂时注释掉不存在的字段筛选
  // if (filters.created_at_start) {
  //   query = query.gte('created_at', filters.created_at_start);
  // }
  
  // if (filters.created_at_end) {
  //   query = query.lte('created_at', filters.created_at_end);
  // }

  // 排序 - 使用存在的字段
  const orderBy = filters.orderBy || 'id';
  const ascending = filters.ascending || false;
  query = query.order(orderBy, { ascending });

  // 分页
  if (filters.limit) {
    query = query.limit(filters.limit);
  }
  
  if (filters.offset) {
    query = query.range(filters.offset, filters.offset + (filters.limit || 10) - 1);
  }

  const { data, error } = await query;
  
  if (error) {
    console.error('❌ [getDeals] 查询失败:', {
      error: error,
      code: error.code,
      message: error.message,
      details: error.details,
      hint: error.hint,
      filters: filters
    });
    throw error;
  }
  
  console.log('✅ [getDeals] 查询成功:', data);
  if (data && data.length > 0) {
    console.log('🔍 [getDeals] 第一条记录结构:', data[0]);
    console.log('🔍 [getDeals] 第一条记录的 contract_records 字段:', data[0].contract_records);
  }
  
  // 手动获取关联的 contract_records 数据
  if (data && data.length > 0) {
    const contractRecordIds = data
      .filter(deal => deal.contract_records)
      .map(deal => deal.contract_records);
    
    if (contractRecordIds.length > 0) {
      console.log('🔍 [getDeals] 获取关联的 contract_records 数据，ID列表:', contractRecordIds);
      
      const { data: contractRecordsData, error: contractError } = await supabase
        .from('contract_records')
        .select('*')
        .in('id', contractRecordIds);
      
      if (contractError) {
        console.error('❌ [getDeals] 获取 contract_records 失败:', contractError);
      } else {
        console.log('✅ [getDeals] 获取 contract_records 成功:', contractRecordsData);
        
        // 合并数据
        const mergedData = data.map(deal => {
          const contractRecord = contractRecordsData?.find(cr => cr.id === deal.contract_records);
          return {
            ...deal,
            contract_records_data: contractRecord || null
          };
        });
        
        console.log('✅ [getDeals] 合并后的数据:', mergedData);
        return mergedData;
      }
    }
  }
  
  return data || [];
}

// 获取成交记录总数（用于分页）
export async function getDealsCount(filters: DealFilters = {}) {
  let query = supabase
    .from('deals')
    .select('*', { count: 'exact', head: true });

  const { count, error } = await query;
  
  if (error) {
    console.error('❌ [getDealsCount] 查询失败:', {
      error: error,
      code: error.code,
      message: error.message,
      details: error.details,
      hint: error.hint
    });
    throw error;
  }
  
  console.log('✅ [getDealsCount] 查询成功，总数:', count);
  return count || 0;
}

// 获取社区选项（从 contract_records 表）
export async function getDealsCommunityOptions() {
  const { data, error } = await supabase
    .from('contract_records')
    .select('external_community_name')
    .not('external_community_name', 'is', null)
    .order('external_community_name');
  
  if (error) throw error;
  
  // 去重并返回选项格式
  const uniqueCommunities = [...new Set(data.map(item => item.external_community_name))];
  return uniqueCommunities;
}

// 获取渠道选项（从 contract_records 表）
export async function getDealsSourceOptions() {
  const { data, error } = await supabase
    .from('contract_records')
    .select('customer_channel')
    .not('customer_channel', 'is', null)
    .order('customer_channel');
  
  if (error) throw error;
  
  // 去重并返回选项格式
  const uniqueChannels = [...new Set(data.map(item => item.customer_channel))];
  return uniqueChannels;
}

// 获取销售姓名选项
export async function getDealsSalesOptions() {
  const { data, error } = await supabase
    .from('contract_records')
    .select('sales_name')
    .not('sales_name', 'is', null)
    .order('sales_name');
  
  if (error) throw error;
  
  // 去重并返回选项格式
  const uniqueSales = [...new Set(data.map(item => item.sales_name))];
  return uniqueSales;
}

// 获取合同类型选项
export async function getDealsContractTypeOptions() {
  const { data, error } = await supabase
    .from('contract_records')
    .select('contract_type')
    .not('contract_type', 'is', null)
    .order('contract_type');
  
  if (error) throw error;
  
  // 去重并返回选项格式
  const uniqueTypes = [...new Set(data.map(item => item.contract_type))];
  return uniqueTypes;
}

// 获取租赁类型选项
export async function getDealsLeaseTypeOptions() {
  const { data, error } = await supabase
    .from('contract_records')
    .select('lease_type')
    .not('lease_type', 'is', null)
    .order('lease_type');
  
  if (error) throw error;
  
  // 去重并返回选项格式
  const uniqueTypes = [...new Set(data.map(item => item.lease_type))];
  return uniqueTypes;
}

// 获取业务编号选项
export async function getDealsBusinessNumberOptions() {
  const { data, error } = await supabase
    .from('contract_records')
    .select('business_number')
    .not('business_number', 'is', null)
    .order('business_number');
  
  if (error) throw error;
  
  // 去重并返回选项格式
  const uniqueNumbers = [...new Set(data.map(item => item.business_number))];
  return uniqueNumbers;
}

// 获取房间号选项
export async function getDealsRoomNumberOptions() {
  const { data, error } = await supabase
    .from('contract_records')
    .select('room_number')
    .not('room_number', 'is', null)
    .order('room_number');
  
  if (error) throw error;
  
  // 去重并返回选项格式
  const uniqueNumbers = [...new Set(data.map(item => item.room_number))];
  return uniqueNumbers;
}

// 创建成交记录
export async function createDeal(dealData: Partial<Deal>) {
  // 只允许创建基本的 deals 字段，contract_records 通过关联创建
  const { contract_records, ...basicDealData } = dealData;
  
  const { data, error } = await supabase
    .from('deals')
    .insert([basicDealData])
    .select();
  
  if (error) throw error;
  return data?.[0];
}

// 从签约记录创建成交记录
export async function createDealFromContract(contractRecord: any, leadid: string) {
  console.log('🔍 [createDealFromContract] 开始创建成交记录:', {
    contractRecord: contractRecord,
    leadid: leadid,
    contractRecordId: contractRecord?.id,
    contractRecordIdType: typeof contractRecord?.id
  });

  // 验证必要参数
  if (!contractRecord || !contractRecord.id) {
    throw new Error('contractRecord 或 contractRecord.id 为空');
  }

  if (!leadid) {
    throw new Error('leadid 为空');
  }

  // 确保 contractRecord.id 是字符串类型
  const contractRecordId = String(contractRecord.id);
  
  // 根据错误信息，触发器可能需要一些旧字段，让我们提供这些字段
  const dealData = {
    leadid: leadid,
    contract_records: contractRecordId,
    // 添加触发器可能需要的字段（设置为null或默认值）
    invalid: false
  };

  console.log('🔍 [createDealFromContract] 准备插入的数据（包含触发器字段）:', dealData);

  try {
    const { data, error } = await supabase
      .from('deals')
      .insert([dealData])
      .select();
    
    if (error) {
      console.error('❌ [createDealFromContract] 插入失败:', {
        error: error,
        code: error.code,
        message: error.message,
        details: error.details,
        hint: error.hint,
        dealData: dealData
      });
      
      // 如果仍然失败，尝试使用 RPC 函数插入
      console.log('🔄 [createDealFromContract] 尝试使用 RPC 函数插入...');
      
      try {
        const { data: rpcData, error: rpcError } = await supabase
          .rpc('create_deal_from_contract', {
            p_leadid: leadid,
            p_contract_records: contractRecordId
          });
        
        if (rpcError) {
          console.error('❌ [createDealFromContract] RPC 插入也失败:', rpcError);
          throw rpcError;
        }
        
        console.log('✅ [createDealFromContract] RPC 插入成功:', rpcData);
        return rpcData;
      } catch (rpcError) {
        console.error('❌ [createDealFromContract] RPC 插入异常:', rpcError);
        throw rpcError;
      }
    }

    console.log('✅ [createDealFromContract] 直接插入成功:', data);
    return data[0];

  } catch (error) {
    console.error('❌ [createDealFromContract] 创建成交记录异常:', error);
    throw error;
  }
}

// 更新成交记录
export async function updateDeal(id: string, dealData: Partial<Deal>) {
  // 只允许更新基本的 deals 字段，contract_records 通过关联更新
  const { contract_records, ...basicDealData } = dealData;
  
  const { data, error } = await supabase
    .from('deals')
    .update(basicDealData)
    .eq('id', id)
    .select();
  
  if (error) throw error;
  return data?.[0];
}

// 重新关联成交记录到签约记录
export async function reassociateDeal(dealId: string, contractRecordId: string) {
  console.log('🔍 [reassociateDeal] 开始重新关联:', {
    dealId: dealId,
    contractRecordId: contractRecordId,
    contractRecordIdType: typeof contractRecordId
  });

  // 验证参数
  if (!dealId) {
    throw new Error('dealId 不能为空');
  }

  if (!contractRecordId) {
    throw new Error('contractRecordId 不能为空');
  }

  // 确保 contractRecordId 是字符串类型
  const contractRecordIdStr = String(contractRecordId);

  try {
    // 先检查 deals 记录是否存在
    const { data: existingDeal, error: fetchError } = await supabase
      .from('deals')
      .select('id, leadid, contract_records')
      .eq('id', dealId)
      .single();

    if (fetchError) {
      console.error('❌ [reassociateDeal] 获取deals记录失败:', fetchError);
      throw new Error(`获取deals记录失败: ${fetchError.message}`);
    }

    console.log('✅ [reassociateDeal] 找到deals记录:', existingDeal);

    // 检查 contract_records 字段是否存在
    if (!('contract_records' in existingDeal)) {
      console.error('❌ [reassociateDeal] deals 表没有 contract_records 字段');
      throw new Error('deals 表没有 contract_records 字段');
    }

    console.log('🔍 [reassociateDeal] 准备更新 contract_records 字段:', {
      dealId: dealId,
      oldContractRecords: existingDeal.contract_records,
      newContractRecords: contractRecordIdStr
    });

    // 更新 contract_records 字段
    const { data, error } = await supabase
      .from('deals')
      .update({ contract_records: contractRecordIdStr })
      .eq('id', dealId)
      .select();

    if (error) {
      console.error('❌ [reassociateDeal] 更新失败:', {
        error: error,
        code: error.code,
        message: error.message,
        details: error.details,
        hint: error.hint,
        dealId: dealId,
        contractRecordId: contractRecordIdStr,
        existingDeal: existingDeal
      });
      throw error;
    }

    console.log('✅ [reassociateDeal] 重新关联成功:', data);
    return data?.[0];

  } catch (error) {
    console.error('❌ [reassociateDeal] 重新关联异常:', error);
    throw error;
  }
}

// 删除成交记录
export async function deleteDeal(id: string) {
  const { error } = await supabase
    .from('deals')
    .delete()
    .eq('id', id);
  
  if (error) throw error;
}

// 测试 deals 表是否存在
export async function testDealsTable() {
  try {
    console.log('🔍 [testDealsTable] 开始测试 deals 表...');
    
    // 尝试查询表结构
    const { data, error } = await supabase
      .from('deals')
      .select('*')
      .limit(1);
    
    if (error) {
      console.error('❌ [testDealsTable] deals 表查询失败:', {
        code: error.code,
        message: error.message,
        details: error.details,
        hint: error.hint
      });
      return { exists: false, error: error };
    }
    
    console.log('✅ [testDealsTable] deals 表存在，数据:', data);
    
    // 检查是否有 contract_records 字段
    if (data && data.length > 0) {
      const sampleRecord = data[0];
      console.log('🔍 [testDealsTable] 表结构检查:', {
        hasContractRecords: 'contract_records' in sampleRecord,
        contractRecordsValue: sampleRecord.contract_records,
        contractRecordsType: typeof sampleRecord.contract_records,
        allFields: Object.keys(sampleRecord)
      });
    }
    
    return { exists: true, data: data };
  } catch (error) {
    console.error('❌ [testDealsTable] 测试异常:', error);
    return { exists: false, error: error };
  }
}

// 检查 deals 表的触发器
export async function checkDealsTriggers() {
  try {
    console.log('🔍 [checkDealsTriggers] 检查 deals 表触发器...');
    
    // 查询触发器信息
    const { data, error } = await supabase
      .rpc('get_table_triggers', { table_name: 'deals' });
    
    if (error) {
      console.error('❌ [checkDealsTriggers] 查询触发器失败:', error);
      return { triggers: [], error: error };
    }
    
    console.log('🔍 [checkDealsTriggers] 触发器信息:', data);
    return { triggers: data || [], error: null };
  } catch (error) {
    console.error('❌ [checkDealsTriggers] 检查触发器异常:', error);
    return { triggers: [], error: error };
  }
}

// 获取可用的线索编号选项（从跟进记录中获取）
export async function getAvailableLeadIds() {
  const { data, error } = await supabase
    .from('followups')
    .select('leadid')
    .not('leadid', 'is', null)
    .order('id', { ascending: false });
  
  if (error) throw error;
  
  // 去重并返回选项格式
  const uniqueLeadIds = [...new Set(data.map(item => item.leadid))];
  return uniqueLeadIds.map(leadid => ({ value: leadid, label: leadid }));
}

// 测试 deals 表是否存在和可访问
export async function testDealsTableAccess() {
  try {
    console.log('🔍 [testDealsTableAccess] 开始测试 deals 表访问...');
    
    // 尝试查询表结构
    const { data, error } = await supabase
      .from('deals')
      .select('*')
      .limit(5);
    
    if (error) {
      console.error('❌ [testDealsTableAccess] deals 表查询失败:', {
        code: error.code,
        message: error.message,
        details: error.details,
        hint: error.hint
      });
      return { exists: false, error: error };
    }
    
    console.log('✅ [testDealsTableAccess] deals 表存在，数据:', data);
    
    // 检查表结构
    if (data && data.length > 0) {
      const sampleRecord = data[0];
      console.log('🔍 [testDealsTableAccess] 表结构检查:', {
        allFields: Object.keys(sampleRecord),
        sampleData: sampleRecord
      });
      
      // 检查 contract_records 字段的值
      console.log('🔍 [testDealsTableAccess] contract_records 字段值:', data.map(d => d.contract_records));
    }
    
    return { exists: true, data: data };
  } catch (error) {
    console.error('❌ [testDealsTableAccess] 测试异常:', error);
    return { exists: false, error: error };
  }
}