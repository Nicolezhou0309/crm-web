import { useState, useEffect, useCallback } from 'react';
import { fetchEnumValues, fetchMetroStations, supabase } from '../../../supaClient';
import type { EnumOption } from '../types';

export const useEnumData = () => {
  // 枚举数据状态
  const [communityEnum, setCommunityEnum] = useState<EnumOption[]>([]);
  const [followupstageEnum, setFollowupstageEnum] = useState<EnumOption[]>([]);
  const [customerprofileEnum, setCustomerprofileEnum] = useState<EnumOption[]>([]);
  const [sourceEnum, setSourceEnum] = useState<EnumOption[]>([]);
  const [userratingEnum, setUserratingEnum] = useState<EnumOption[]>([]);
  
  // 动态筛选选项
  const [leadtypeFilters, setLeadtypeFilters] = useState<EnumOption[]>([]);
  const [remarkFilters, setRemarkFilters] = useState<EnumOption[]>([]);
  const [worklocationFilters, setWorklocationFilters] = useState<EnumOption[]>([]);
  const [userbudgetFilters, setUserbudgetFilters] = useState<EnumOption[]>([]);
  const [followupresultFilters, setFollowupresultFilters] = useState<EnumOption[]>([]);
  const [majorcategoryFilters, setMajorcategoryFilters] = useState<EnumOption[]>([]);
  const [scheduledcommunityFilters, setScheduledcommunityFilters] = useState<EnumOption[]>([]);
  
  // 分组字段选项
  const [groupFieldOptions] = useState([
    { label: '跟进阶段', value: 'followupstage' },
    { label: '约访管家', value: 'interviewsales_user_id' },
    { label: '创建日期', value: 'created_at' },
    { label: '社区', value: 'scheduledcommunity' },
    { label: '渠道', value: 'source' },
  ]);
  
  // 主要分类选项
  const [majorCategoryOptions, setMajorCategoryOptions] = useState<EnumOption[]>([]);
  
  // 地铁站选项 - 改为状态变量并添加加载逻辑
  const [metroStationOptions, setMetroStationOptions] = useState<any[]>([]);



  // 加载主分类选项
  const loadMajorCategoryOptions = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('Selection')
        .select('selection')
        .eq('id', 1)
        .single();
      
      if (!error && data && data.selection) {
        setMajorCategoryOptions(data.selection);
      } else {
        console.warn('⚠️ [警告] 加载主分类选项失败，使用默认选项');
        // 设置默认选项作为回退
        const defaultOptions = [
          {
            value: '跟进结果',
            label: '跟进结果',
            children: [
              { value: '有意向', label: '有意向' },
              { value: '需考虑', label: '需考虑' },
              { value: '暂无意向', label: '暂无意向' }
            ]
          },
          {
            value: '成交状态',
            label: '成交状态',
            children: [
              { value: '已成交', label: '已成交' },
              { value: '已流失', label: '已流失' }
            ]
          }
        ];
        setMajorCategoryOptions(defaultOptions);
      }
    } catch (error) {
      console.error('❌ [错误] 加载主分类选项失败:', error);
      // 设置默认选项作为回退
      const defaultOptions = [
        {
          value: '跟进结果',
          label: '跟进结果',
          children: [
            { value: '有意向', label: '有意向' },
            { value: '需考虑', label: '需考虑' },
            { value: '暂无意向', label: '暂无意向' }
          ]
        },
        {
          value: '成交状态',
          label: '成交状态',
          children: [
            { value: '已成交', label: '已成交' },
            { value: '已流失', label: '已流失' }
          ]
        }
      ];
      setMajorCategoryOptions(defaultOptions);
    }
  }, []);



  // 加载地铁站数据
  const loadMetroStationOptions = useCallback(async () => {
    try {
      const metroData = await fetchMetroStations();
      
      // 按线路分组
      const lineGroups = metroData.reduce((acc, station) => {
        const line = station.line || '其他';
        if (!acc[line]) {
          acc[line] = [];
        }
        acc[line].push(station);
        return acc;
      }, {} as Record<string, typeof metroData>);

      // 构建Cascader选项结构，按线路数字顺序排列
      const options = Object.entries(lineGroups)
        .sort(([lineA], [lineB]) => {
          // 提取数字进行排序
          const getLineNumber = (line: string) => {
            const match = line.match(/^(\d+)号线$/);
            return match ? parseInt(match[1]) : 999999;
          };
          return getLineNumber(lineA) - getLineNumber(lineB);
        })
        .map(([line, stations]) => ({
          value: line,
          label: line,
          children: stations.map(station => ({
            value: station.name,
            label: station.name
          }))
        }));

      setMetroStationOptions(options);
      
      // 同时更新工作地点筛选选项
      const worklocationOptions = metroData.map(station => ({
        value: station.name,
        label: station.name
      }));
      setWorklocationFilters(worklocationOptions);
      

    } catch (error) {
      console.error('❌ [错误] 加载地铁站数据失败:', error);
      // 设置空数组作为回退
      setMetroStationOptions([]);
      setWorklocationFilters([]);
    }
  }, []);

  // 加载枚举数据（带缓存）
  const loadEnumWithCache = useCallback(async (enumName: string, setter: (data: EnumOption[]) => void) => {
    const cacheKey = `enum_${enumName}`;
    const cacheTimestamp = localStorage.getItem(`${cacheKey}_timestamp`);
    
    // 缓存15分钟有效，减少重复加载
    if (cacheTimestamp && Date.now() - parseInt(cacheTimestamp) < 15 * 60 * 1000) {
      const cached = localStorage.getItem(cacheKey);
      if (cached) {
        try {
          const cachedData = JSON.parse(cached);
          setter(cachedData);
          return;
        } catch (parseError) {
          // 缓存解析失败，清除损坏的缓存
          localStorage.removeItem(cacheKey);
          localStorage.removeItem(`${cacheKey}_timestamp`);
        }
      }
    }
    
    try {
      const arr = await fetchEnumValues(enumName);
      const enumData = arr.map(v => ({ value: v, label: v }));
      setter(enumData);
      
      // 更新缓存
      try {
        localStorage.setItem(cacheKey, JSON.stringify(enumData));
        localStorage.setItem(`${cacheKey}_timestamp`, Date.now().toString());
      } catch (storageError) {
        console.warn(`⚠️ [缓存] 无法保存${enumName}枚举到localStorage:`, storageError);
      }
      
    } catch (error) {
      console.error(`❌ [错误] 加载${enumName}枚举失败:`, error);
      // 尝试使用过期缓存作为回退
      const cached = localStorage.getItem(cacheKey);
      if (cached) {
        try {
          const cachedData = JSON.parse(cached);
          setter(cachedData);
        } catch (fallbackError) {
          console.error(`❌ [回退] 使用过期缓存也失败:`, fallbackError);
        }
      }
    }
  }, []);



  // 加载动态筛选器选项
  const loadDynamicFilterOptions = useCallback(async () => {
    try {
      
      // 并行加载所有动态筛选器选项
      const [followupresultData, majorcategoryData, leadtypeData, remarkData, userbudgetData] = await Promise.allSettled([
        // 跟进结果筛选器
        supabase.rpc('get_filter_options', {
          p_field_name: 'followupresult',
          p_filters: {}
        }).then(({ data, error }: { data: any, error: any }) => {
          if (error) throw error;
          return data || [];
        }),
        // 主分类筛选器
        supabase.rpc('get_filter_options', {
          p_field_name: 'majorcategory',
          p_filters: {}
        }).then(({ data, error }: { data: any, error: any }) => {
          if (error) throw error;
          return data || [];
        }),
        // 线索类型筛选器
        supabase.rpc('get_filter_options', {
          p_field_name: 'leadtype',
          p_filters: {}
        }).then(({ data, error }: { data: any, error: any }) => {
          if (error) throw error;
          return data || [];
        }),
        // 备注筛选器 - 使用leads表查询（remark字段在leads表中，不在followups表中）
        supabase
          .from('leads')
          .select('remark')
          .not('remark', 'is', null)
          .neq('remark', '')
          .limit(100)
          .then(({ data, error }) => {
            if (error) throw error;
            // 去重并格式化，过滤掉空字符串和null值
            const uniqueValues = [...new Set(data?.map(item => item.remark).filter(remark => remark && remark.trim() !== ''))];
            return uniqueValues.slice(0, 50).map(value => ({ value, label: value })); // 限制50个选项
          }),
        // 用户预算筛选器
        supabase.rpc('get_filter_options', {
          p_field_name: 'userbudget',
          p_filters: {}
        }).then(({ data, error }: { data: any, error: any }) => {
          if (error) throw error;
          return data || [];
        })
      ]);

      // 设置跟进结果筛选器
      if (followupresultData.status === 'fulfilled') {
        const data = followupresultData.value;
        
        if (Array.isArray(data) && data.length > 0) {
          const options = data.map((item: any) => ({
            value: item.value || item.text || item,
            label: item.label || item.text || item.value || item
          }));
          setFollowupresultFilters(options);
        } else {
          setFollowupresultFilters([]);
        }
      } else {
        // 静默处理，不显示错误日志
        setFollowupresultFilters([]);
      }

      // 设置主分类筛选器
      if (majorcategoryData.status === 'fulfilled') {
        const data = majorcategoryData.value;
        
        if (Array.isArray(data) && data.length > 0) {
          const options = data.map((item: any) => ({
            value: item.value || item.text || item,
            label: item.label || item.text || item.value || item
          }));
          setMajorcategoryFilters(options);
        } else {
          setMajorcategoryFilters([]);
        }
      } else {
        // 静默处理，不显示错误日志
        setMajorcategoryFilters([]);
      }

      // 设置线索类型筛选器
      if (leadtypeData.status === 'fulfilled') {
        const data = leadtypeData.value;
        
        if (Array.isArray(data) && data.length > 0) {
          const options = data.map((item: any) => ({
            value: item.value || item.text || item,
            label: item.label || item.text || item.value || item
          }));
          setLeadtypeFilters(options);
        } else {
          setLeadtypeFilters([]);
        }
      } else {
        // 静默处理，不显示错误日志
        setLeadtypeFilters([]);
      }

      // 设置备注筛选器
      if (remarkData.status === 'fulfilled') {
        const data = remarkData.value;
        
        if (Array.isArray(data) && data.length > 0) {
          const options = data.map((item: any) => ({
            value: item.value || item.text || item,
            label: item.label || item.text || item.value || item
          }));
          setRemarkFilters(options);
        } else {
          setRemarkFilters([]);
        }
      } else {
        // 静默处理，不显示错误日志
        setRemarkFilters([]);
      }

      // 设置用户预算筛选器
      if (userbudgetData.status === 'fulfilled') {
        const data = userbudgetData.value;
        
        if (Array.isArray(data) && data.length > 0) {
          const options = data.map((item: any) => ({
            value: item.value || item.text || item,
            label: item.label || item.text || item.value || item
          }));
          setUserbudgetFilters(options);
        } else {
          setUserbudgetFilters([]);
        }
      } else {
        // 静默处理，不显示错误日志
        setUserbudgetFilters([]);
      }

      // 设置预约社区筛选器（使用社区枚举）
      // 注意：这里直接使用当前的 communityEnum 值，避免循环依赖
      if (communityEnum.length > 0) {
        setScheduledcommunityFilters(communityEnum);
      }

    } catch (error) {
      // 静默处理错误，不显示错误日志
      
      // 设置空数组作为回退
      setFollowupresultFilters([]);
      setMajorcategoryFilters([]);
      setLeadtypeFilters([]);
      setRemarkFilters([]);
      setUserbudgetFilters([]);
    }
  }, []); // 移除 communityEnum 依赖，避免循环依赖

  // 初始化所有枚举数据
  const initializeEnums = useCallback(async () => {
    // 并行加载所有枚举和地铁站数据，添加错误处理
    Promise.allSettled([
      loadEnumWithCache('community', setCommunityEnum),
      loadEnumWithCache('followupstage', setFollowupstageEnum),
      loadEnumWithCache('customerprofile', setCustomerprofileEnum),
      loadEnumWithCache('source', setSourceEnum),
      loadEnumWithCache('userrating', setUserratingEnum),
      loadMetroStationOptions(), // 添加地铁站数据加载
      loadMajorCategoryOptions() // 添加主分类选项加载
    ]).then(() => {
      // 静默处理加载结果，不显示错误日志
      // 即使部分枚举加载失败，也不影响用户体验
    });
  }, [loadEnumWithCache, loadMetroStationOptions, loadMajorCategoryOptions]);

  // 初始化时自动加载枚举数据
  useEffect(() => {
    initializeEnums();
  }, [initializeEnums]);

  // 在基础枚举数据加载完成后，加载动态筛选器选项
  useEffect(() => {
    // 只有当基础枚举数据都加载完成后，才加载动态筛选器
    if (communityEnum.length > 0 && followupstageEnum.length > 0 && customerprofileEnum.length > 0 && 
        sourceEnum.length > 0 && userratingEnum.length > 0 && metroStationOptions.length > 0) {
      loadDynamicFilterOptions();
    }
  }, [communityEnum, followupstageEnum, customerprofileEnum, sourceEnum, userratingEnum, metroStationOptions, loadDynamicFilterOptions]);

  // 刷新单个枚举
  const refreshEnum = useCallback(async (enumName: string) => {
    const setterMap: Record<string, (data: EnumOption[]) => void> = {
      community: setCommunityEnum,
      followupstage: setFollowupstageEnum,
      customerprofile: setCustomerprofileEnum,
      source: setSourceEnum,
      userrating: setUserratingEnum
    };
    
    const setter = setterMap[enumName];
    if (setter) {
      // 清除缓存并重新加载
      const cacheKey = `enum_${enumName}`;
      localStorage.removeItem(cacheKey);
      localStorage.removeItem(`${cacheKey}_timestamp`);
      
      await loadEnumWithCache(enumName, setter);
    }
  }, [loadEnumWithCache]);

  // 刷新所有枚举
  const refreshAllEnums = useCallback(async () => {
    await initializeEnums();
  }, [initializeEnums]);

  // 获取枚举选项（用于Select组件）
  const getEnumOptions = useCallback((enumName: string): EnumOption[] => {
    const enumMap: Record<string, EnumOption[]> = {
      community: communityEnum,
      followupstage: followupstageEnum,
      customerprofile: customerprofileEnum,
      source: sourceEnum,
      userrating: userratingEnum
    };
    
    return enumMap[enumName] || [];
  }, [communityEnum, followupstageEnum, customerprofileEnum, sourceEnum, userratingEnum]);

  // 根据值获取枚举标签
  const getEnumLabel = useCallback((enumName: string, value: string): string => {
    const options = getEnumOptions(enumName);
    const option = options.find(opt => opt.value === value);
    return option?.label || value;
  }, [getEnumOptions]);

  // 检查枚举是否已加载
  const isEnumLoaded = useCallback((enumName: string): boolean => {
    const options = getEnumOptions(enumName);
    return options.length > 0;
  }, [getEnumOptions]);

  // 获取所有枚举的加载状态
  const getEnumsLoadingStatus = useCallback(() => {
    return {
      community: isEnumLoaded('community'),
      followupstage: isEnumLoaded('followupstage'),
      customerprofile: isEnumLoaded('customerprofile'),
      source: isEnumLoaded('source'),
      userrating: isEnumLoaded('userrating'),
      metrostations: metroStationOptions.length > 0
    };
  }, [isEnumLoaded, metroStationOptions]);

  // 辅助函数：根据二级value找到完整路径（用于Cascader）
  const findCascaderPath = useCallback((options: any[], value: string): string[] => {
    for (const opt of options) {
      if (opt.children) {
        const child = opt.children.find((c: any) => c.value === value);
        if (child) {
          return [opt.value, child.value];
        }
      }
    }
    return [];
  }, []);

  return {
    // 枚举数据
    communityEnum,
    followupstageEnum,
    customerprofileEnum,
    sourceEnum,
    userratingEnum,
    groupFieldOptions,
    majorCategoryOptions,
    metroStationOptions,
    

    
    // 动态筛选选项
    leadtypeFilters,
    remarkFilters,
    worklocationFilters,
    userbudgetFilters,
    followupresultFilters,
    majorcategoryFilters,
    scheduledcommunityFilters,
    
    // 方法
    loadEnumWithCache,
    loadMetroStationOptions,
    loadMajorCategoryOptions,
    refreshEnum,
    refreshAllEnums,
    getEnumOptions,
    getEnumLabel,
    isEnumLoaded,
    getEnumsLoadingStatus,
    findCascaderPath,
    

    
    // 设置器
    setCommunityEnum,
    setFollowupstageEnum,
    setCustomerprofileEnum,
    setSourceEnum,
    setUserratingEnum,
    setLeadtypeFilters,
    setRemarkFilters,
    setWorklocationFilters,
    setUserbudgetFilters,
    setFollowupresultFilters,
    setMajorcategoryFilters,
    setScheduledcommunityFilters,
    setMetroStationOptions
  };
};
