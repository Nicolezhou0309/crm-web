import React, { useState, useEffect, useMemo } from 'react';
import {
  Card,
  Table,
  Button,
  Space,
  Select,
  DatePicker,
  Input,
  Row,
  Col,
  Typography,
  message,
  Tabs,
  Tag,
  Modal,
  Form,
  Alert
} from 'antd';
import {
  BarChartOutlined,
  TableOutlined,
  FilterOutlined,
  SaveOutlined,
  EyeOutlined,
  EditOutlined,
  DeleteOutlined,
  CopyOutlined,
  DownloadOutlined
} from '@ant-design/icons';
import { supabase } from '../supaClient';
import dayjs from 'dayjs';
import timezone from 'dayjs/plugin/timezone';
import utc from 'dayjs/plugin/utc';

// 扩展dayjs支持时区
dayjs.extend(utc);
dayjs.extend(timezone);

// 时间字段列表
const TIME_FIELDS = [
  'created_at', 'updata_at', 'moveintime', 'followup_scheduletime',
  'arrivaltime', 'showing_moveintime', 'showing_scheduletime', 
  'showing_created_at', 'showing_updated_at', 'contractdate',
  'deal_created_at', 'deal_updated_at'
];

// 统一时间处理函数
const formatTimeField = (value: any): string => {
  if (!value || value === '0' || value === '空值') {
    return String(value);
  }
  
  try {
    return dayjs(value).tz('Asia/Shanghai').format('YYYY-MM-DD');
  } catch (e) {
    return String(value);
  }
};

// 格式化日期范围显示
const formatDateRange = (startDate: string, endDate: string): string => {
  try {
    const start = dayjs(startDate).format('MM-DD');
    const end = dayjs(endDate).format('MM-DD');
    return `${start} ~ ${end}`;
  } catch (e) {
    return `${startDate} ~ ${endDate}`;
  }
};

import './compact-table.css';
import './DataAnalysis.css';

// 添加透视表样式
const pivotTableStyles = `
  .pivot-table .ant-table-summary {
    background-color: #fafafa;
  }
  
  .multi-level-headers table {
    width: 100%;
    border-collapse: collapse;
    border: 1px solid #d9d9d9;
    margin-bottom: 16px;
  }
  
  .multi-level-headers th {
    border: 1px solid #d9d9d9;
    padding: 8px 12px;
    background-color: #fafafa;
    font-weight: bold;
    text-align: center;
    font-size: 12px;
    vertical-align: middle;
  }
  
  .multi-level-headers th:first-child {
    border-left: 1px solid #d9d9d9;
  }
  
  .multi-level-headers th:last-child {
    border-right: 1px solid #d9d9d9;
  }
  
  .pivot-table .ant-table-thead > tr > th {
    background-color: #fafafa;
    font-weight: bold;
    text-align: center;
    font-size: 12px;
  }
  
  .pivot-table .ant-table-tbody > tr > td {
    text-align: center;
    font-size: 12px;
  }
  
  .pivot-table .ant-table-tbody > tr:last-child > td {
    background-color: #f0f8ff;
    font-weight: bold;
  }
  
  /* 透视表行字段列样式 */
  .pivot-table .ant-table-thead > tr > th.ant-table-cell-fix-left {
    background-color: #f0f8ff;
    font-weight: bold;
    border-right: 2px solid #d9d9d9;
  }
  
  .pivot-table .ant-table-tbody > tr > td.ant-table-cell-fix-left {
    background-color: #fafafa;
    border-right: 2px solid #d9d9d9;
  }
  
  /* 透视表值字段列样式 */
  .pivot-table .ant-table-thead > tr > th:not(.ant-table-cell-fix-left) {
    background-color: #f5f5f5;
    text-align: center;
  }
  
  .pivot-table .ant-table-tbody > tr > td:not(.ant-table-cell-fix-left) {
    text-align: center;
  }
  

`;

const { Title, Text } = Typography;
const { Option } = Select;
const { RangePicker } = DatePicker;

interface DataAnalysisProps {}

interface PivotConfig {
  id?: string;
  name: string;
  description?: string;
  rowFields: string[];
  columnFields: string[];
  valueFields: {
    field: string;
    aggregation: 'sum' | 'count' | 'count_distinct' | 'avg' | 'max' | 'min';
    format?: string;
  }[];
  filters: FilterCondition[];
  sortBy: SortConfig[];
  created_at?: string;
  updated_at?: string;
}

interface SavedPivotConfig {
  id: string;
  name: string;
  description?: string;
  config: PivotConfig;
  data_source: string;
  created_by: string;
  created_at: string;
  updated_at: string;
}

interface FilterCondition {
  field: string;
  operator: 'equals' | 'not_equals' | 'contains' | 'not_contains' | 'greater_than' | 'less_than' | 'between' | 'date_between' | 'is_null' | 'is_not_null';
  value: any;
  value2?: any;
  dateRange?: [string, string]; // 用于日期范围选择器
}

interface SortConfig {
  field: string;
  direction: 'asc' | 'desc';
}

interface PivotResult {
  headers: string[];
  headerRows?: string[][]; // 新增：多行表头
  rows: any[];
  totals: any;
  summary: {
    totalRows: number;
    totalColumns: number;
    totalValue: number;
  };
}

interface FieldItem {
  name: string;
  label: string;
  type: 'dimension' | 'measure'; // 保留类型用于显示，但不限制拖拽
  table: string;
  aggregation?: string;
  dataType?: 'string' | 'number' | 'date' | 'person';
}

const DataAnalysis: React.FC<DataAnalysisProps> = () => {
  // 状态管理
  const [loading, setLoading] = useState(false);

  const [pivotConfigs, setPivotConfigs] = useState<SavedPivotConfig[]>([]);
  const [currentConfig, setCurrentConfig] = useState<PivotConfig | null>(null);
  const [pivotResult, setPivotResult] = useState<PivotResult | null>(null);
  const [activeTab, setActiveTab] = useState('pivot');
  
  // 拖拽状态
  const [draggedField, setDraggedField] = useState<FieldItem | null>(null);
  const [dragOverArea, setDragOverArea] = useState<string | null>(null);
  
  // 字段选项
  const [availableFields, setAvailableFields] = useState<FieldItem[]>([]);
  
  // 弹窗状态
  const [configModalVisible, setConfigModalVisible] = useState(false);
  const [editingConfig, setEditingConfig] = useState<PivotConfig | null>(null);
  const [configForm] = Form.useForm();
  
  // 读取配置弹窗状态
  const [loadConfigModalVisible, setLoadConfigModalVisible] = useState(false);
  const [selectedConfig, setSelectedConfig] = useState<SavedPivotConfig | null>(null);
  const [configSearchValue, setConfigSearchValue] = useState('');
  
  // 筛选条件配置状态
  const [filterModalVisible, setFilterModalVisible] = useState(false);
  const [editingFilter, setEditingFilter] = useState<FilterCondition | null>(null);
  const [filterForm] = Form.useForm();
  
  // 值字段配置状态
  const [valueFieldModalVisible, setValueFieldModalVisible] = useState(false);
  const [editingValueField, setEditingValueField] = useState<{field: string, aggregation: string} | null>(null);
  const [valueFieldForm] = Form.useForm();
  
  // 搜索状态
  const [searchValue, setSearchValue] = useState('');
  




  // 获取可用字段 - 支持联合分析函数的所有字段
  const getAvailableFields = (): FieldItem[] => {
    return [
      // Followups表字段（主表）
      { name: 'followup_id', label: '跟进记录ID', type: 'dimension', table: 'followups', dataType: 'string' },
      { name: 'leadid', label: '线索编号', type: 'dimension', table: 'followups', dataType: 'string' },
      { name: 'followupstage', label: '跟进阶段', type: 'dimension', table: 'followups' },
      { name: 'customerprofile', label: '客户画像', type: 'dimension', table: 'followups' },
      { name: 'worklocation', label: '工作地点', type: 'dimension', table: 'followups' },
      { name: 'userbudget', label: '用户预算', type: 'dimension', table: 'followups' },
      { name: 'moveintime', label: '跟进入住时间', type: 'dimension', table: 'followups', dataType: 'date' },
      { name: 'userrating', label: '来访意向', type: 'dimension', table: 'followups' },
      { name: 'majorcategory', label: '跟进结果', type: 'dimension', table: 'followups' },
      { name: 'followupresult', label: '跟进结果详情', type: 'dimension', table: 'followups' },
      { name: 'scheduledcommunity', label: '意向社区', type: 'dimension', table: 'followups' },
      { name: 'interviewsales_user_id', label: '约访销售ID', type: 'dimension', table: 'followups' },
      { name: 'interviewsales_user_name', label: '跟进约访销售', type: 'dimension', table: 'followups', dataType: 'person' },
      { name: 'followup_created_at', label: '跟进创建时间', type: 'dimension', table: 'followups', dataType: 'date' },
      
      // Leads表字段
      { name: 'phone', label: '线索手机号', type: 'dimension', table: 'leads', dataType: 'string' },
      { name: 'wechat', label: '线索微信号', type: 'dimension', table: 'leads', dataType: 'string' },
      { name: 'qq', label: 'QQ号', type: 'dimension', table: 'leads', dataType: 'string' },
      { name: 'location', label: '位置', type: 'dimension', table: 'leads', dataType: 'string' },
      { name: 'budget', label: '线索预算', type: 'dimension', table: 'leads', dataType: 'string' },
      { name: 'remark', label: '线索备注', type: 'dimension', table: 'leads', dataType: 'string' },
      { name: 'source', label: '线索渠道', type: 'dimension', table: 'leads', dataType: 'string' },
      { name: 'staffname', label: '员工姓名', type: 'dimension', table: 'leads', dataType: 'person' },
      { name: 'area', label: '线索来源区域', type: 'dimension', table: 'leads', dataType: 'string' },
      { name: 'leadtype', label: '线索类型', type: 'dimension', table: 'leads', dataType: 'string' },
      { name: 'leadstatus', label: '线索状态', type: 'dimension', table: 'leads', dataType: 'string' },
      { name: 'lead_created_at', label: '线索创建时间', type: 'dimension', table: 'leads', dataType: 'date' },
      
      // Showings表字段
      { name: 'showing_id', label: '看房记录ID', type: 'dimension', table: 'showings', dataType: 'string' },
      { name: 'showing_community', label: '看房社区', type: 'dimension', table: 'showings' },
      { name: 'viewresult', label: '看房结果', type: 'dimension', table: 'showings' },
      { name: 'arrivaltime', label: '到达时间', type: 'dimension', table: 'showings', dataType: 'date' },
      { name: 'showingsales_user_name', label: '分配带看销售', type: 'dimension', table: 'showings', dataType: 'person' },
      { name: 'trueshowingsales_nickname', label: '实际带看销售', type: 'dimension', table: 'showings', dataType: 'person' },
      { name: 'showing_budget', label: '看房预算', type: 'dimension', table: 'showings', dataType: 'number' },
      { name: 'showing_moveintime', label: '看房入住时间', type: 'dimension', table: 'showings', dataType: 'date' },
      { name: 'showing_remark', label: '看房备注', type: 'dimension', table: 'showings' },
      { name: 'renttime', label: '租期', type: 'dimension', table: 'showings', dataType: 'string' },
      { name: 'showing_scheduletime', label: '看房预约时间', type: 'dimension', table: 'showings', dataType: 'date' },
      { name: 'showing_created_at', label: '看房创建时间', type: 'dimension', table: 'showings', dataType: 'date' },
      
      // Deals表字段
      { name: 'deal_id', label: '成交记录ID', type: 'dimension', table: 'deals', dataType: 'string' },
      { name: 'contractdate', label: '签约日期', type: 'dimension', table: 'deals', dataType: 'date' },
      { name: 'deal_community', label: '成交社区', type: 'dimension', table: 'deals' },
      { name: 'contractnumber', label: '合同编号', type: 'dimension', table: 'deals' },
      { name: 'roomnumber', label: '房间号', type: 'dimension', table: 'deals' },
      { name: 'deal_created_at', label: '成交创建时间', type: 'dimension', table: 'deals', dataType: 'date' },
    ];
  };

  // 检查是否为人员名称字段
  const isPersonField = (fieldName: string): boolean => {
    const personFields = ['interviewsales_user_name', 'showingsales_user_name', 'trueshowingsales_nickname', 'staffname'];
    return personFields.includes(fieldName);
  };

  // 初始化字段
  useEffect(() => {
    const fields = getAvailableFields();
    setAvailableFields(fields);
  }, []);



  // 获取拼接数据
  // 执行透视表计算
  const executePivot = async (config: PivotConfig) => {
    setLoading(true);
    try {
      // 检查是否有多层级列字段
      const hasMultiLevelHeaders = config.columnFields && config.columnFields.length > 1;
      
      // 根据函数类型构建不同的请求参数
      let requestParams;
      if (hasMultiLevelHeaders) {
        // 多层级透视表函数参数
        requestParams = {
          p_data_source: 'joined_data',
          p_row_fields: config.rowFields,
          p_column_fields: config.columnFields,
          p_value_fields: config.valueFields,
          p_filters: config.filters,
          p_show_totals: true
        };
      } else {
        // 单层级透视表函数参数
        requestParams = {
          p_data_source: 'joined_data',
          p_row_fields: config.rowFields,
          p_column_fields: config.columnFields,
          p_value_fields: config.valueFields,
          p_filters: config.filters
        };
      }
      
      
      
      // 统一使用多层级透视表函数
      const functionName = 'execute_multi_level_pivot_analysis';
      
      // 使用后端函数执行透视表分析
      const { data: pivotData, error } = await supabase.rpc(functionName, requestParams);

      if (error) {
        message.error('透视表计算失败: ' + error.message);
        return;
      }

      if (pivotData) {
        
                    if (pivotData.sql) {
            }
        
        if (pivotData.error) {
          message.error('透视表计算失败: ' + pivotData.error);
          return;
        }
        
        if (pivotData.result) {
          
          // 统一使用多层级透视表结果解析
          const result = parseMultiLevelPivotResult(pivotData, config);
          
                 setPivotResult(result);
                 
                 message.success('透视表计算完成');
        } else {
          console.warn('⚠️ 透视表数据为空');
          message.error('透视表计算失败: 无效的返回数据');
        }
      } else {
        console.warn('⚠️ 透视表响应为空');
        message.error('透视表计算失败: 无效的返回数据');
      }
    } catch (error) {
      console.error('❌ 透视表计算异常:', error);
      message.error('透视表计算失败');
    } finally {
      setLoading(false);
    }
  };

  // 解析多层级透视表结果
  const parseMultiLevelPivotResult = (pivotData: any, config: PivotConfig): PivotResult => {
    
    if (!pivotData || !pivotData.result) {
      console.warn('⚠️ 多层级透视表结果无效');
      return {
        headers: [],
        rows: [],
        totals: {},
        summary: { totalRows: 0, totalColumns: 0, totalValue: 0 }
      };
    }

    const backendResult = pivotData.result;
    
    if (backendResult.length === 0) {
      console.warn('⚠️ 多层级透视表结果为空数组');
      return {
        headers: [],
        rows: [],
        totals: {},
        summary: { totalRows: 0, totalColumns: 0, totalValue: 0 }
      };
    }

    
    // 检查是否有列维度配置
    const hasColumnDimension = config && config.columnFields && config.columnFields.length > 0;
    const hasMultiLevelHeaders = config && config.columnFields && config.columnFields.length > 1;
    
    if (hasMultiLevelHeaders) {
      // 构建多层级透视表格式
      return buildMultiLevelPivotTable(backendResult, config);
    } else if (hasColumnDimension) {
      // 构建单层级透视表格式
      return buildSingleLevelPivotTable(backendResult, config);
    } else {
      // 使用简单的列表格式
      return buildSimpleTableFormat(backendResult);
    }
  };



  // 构建简单表格格式
  const buildSimpleTableFormat = (backendResult: any[]): PivotResult => {
    const allFields = Object.keys(backendResult[0]);
    const headers = allFields;
    
    
    const rows = backendResult.map((row: any, index: number) => ({
      key: index.toString(),
      ...row
    }));

    const summary = {
      totalRows: rows.length,
      totalColumns: headers.length,
      totalValue: rows.length > 0 ? rows.length : 0
    };

    const totals: any = {};
    if (rows.length > 0) {
      headers.forEach(header => {
        const values = rows.map(row => row[header]).filter(val => val !== null && val !== undefined);
        if (values.length > 0) {
          const numericValues = values.filter(val => !isNaN(Number(val)));
          if (numericValues.length > 0) {
            const sum = numericValues.reduce((sum, val) => sum + Number(val), 0);
            totals[header] = sum;
          } else {
            totals[header] = values.length;
          }
        }
      });
    }

    return { headers, rows, totals, summary };
  };



  // 构建单层级透视表（原有逻辑）
  const buildSingleLevelPivotTable = (backendResult: any[], config: PivotConfig): PivotResult => {
    const rowFields = config.rowFields || [];
    const columnFields = config.columnFields || [];
    const valueFields = config.valueFields || [];
    
    // 获取所有唯一的列维度值
    const columnValues = new Set<string>();
    backendResult.forEach(row => {
      columnFields.forEach(field => {
        if (row[field] !== null && row[field] !== undefined) {
          let value = row[field];
          
          // 处理时间字段，统一为北京时间日期格式
          if (TIME_FIELDS.includes(field)) {
            value = formatTimeField(value);
          } else {
            value = String(value);
          }
          
          columnValues.add(value);
        }
      });
    });
    
    const uniqueColumnValues = Array.from(columnValues).sort();
    
    // 构建表头
    const headers = [...rowFields, ...uniqueColumnValues, '总计'];
    
    // 按行维度分组
    const groupedData = new Map<string, any>();
    
    backendResult.forEach(row => {
      const rowKey = rowFields.map(field => {
        let value = row[field] || '';
        
        // 处理时间字段，统一为北京时间日期格式
        if (TIME_FIELDS.includes(field)) {
          value = formatTimeField(value);
        } else {
          value = String(value);
        }
        
        return value;
      }).join('|');
    
      if (!groupedData.has(rowKey)) {
        groupedData.set(rowKey, {
          key: rowKey,
          ...rowFields.reduce((acc, field) => {
            let value = row[field];
            
            // 处理时间字段，统一为北京时间日期格式
            if (TIME_FIELDS.includes(field)) {
              value = formatTimeField(value);
            }
            
            acc[field] = value;
            return acc;
          }, {} as any)
        });
      }
      
      const groupRow = groupedData.get(rowKey);
      
      // 为每个列维度值设置值
      columnFields.forEach(colField => {
        let colValue = row[colField] || '';
        
        // 处理时间字段，统一为北京时间日期格式
        if (TIME_FIELDS.includes(colField)) {
          colValue = formatTimeField(colValue);
        } else {
          colValue = String(colValue);
        }
        
        valueFields.forEach(valueField => {
          const valueKey = `${valueField.field}_${valueField.aggregation}`;
          if (!groupRow[colValue]) {
            groupRow[colValue] = 0;
          }
          groupRow[colValue] += Number(row[valueKey] || 0);
        });
      });
    });
    
    // 转换为数组并计算总计
    const rows = Array.from(groupedData.values()).map((row, index) => {
      const newRow = { ...row, key: `row-${index}` };
      
      // 计算行总计
      let rowTotal = 0;
      uniqueColumnValues.forEach(colValue => {
        rowTotal += Number(newRow[colValue] || 0);
      });
      newRow['总计'] = rowTotal;
      
      return newRow;
    });
    
    // 计算列总计
    const totals: any = {};
    rowFields.forEach(field => {
      totals[field] = '总计';
    });
    
    uniqueColumnValues.forEach(colValue => {
      let colTotal = 0;
      rows.forEach(row => {
        colTotal += Number(row[colValue] || 0);
      });
      totals[colValue] = colTotal;
    });
    
    // 计算总计
    let grandTotal = 0;
    rows.forEach(row => {
      grandTotal += Number(row['总计'] || 0);
    });
    totals['总计'] = grandTotal;
    
    const summary = {
      totalRows: rows.length,
      totalColumns: headers.length,
      totalValue: grandTotal
    };
    
    return { headers, rows, totals, summary };
  };

  // 构建多层级透视表（多行表头）
  const buildMultiLevelPivotTable = (backendResult: any[], config: PivotConfig): PivotResult => {
    const rowFields = config.rowFields || [];
    const columnFields = config.columnFields || [];
    const valueFields = config.valueFields || [];
    // 检查是否有足够的列字段
    if (columnFields.length < 2) {
      console.warn('⚠️ 多层级透视表需要至少2个列字段');
      return buildSimpleTableFormat(backendResult);
    }
    
    // 构建多层级列结构
    const columnStructure = new Map<string, Map<string, Set<string>>>();
    
    backendResult.forEach(row => {
      const level1Value = formatFieldValue(row[columnFields[0]]);
      const level2Value = formatFieldValue(row[columnFields[1]]);
      
      if (!columnStructure.has(level1Value)) {
        columnStructure.set(level1Value, new Map());
      }
      
      const level1Map = columnStructure.get(level1Value)!;
      if (!level1Map.has(level2Value)) {
        level1Map.set(level2Value, new Set());
      }
      
      level1Map.get(level2Value)!.add(level2Value);
    });
    
    // 构建多行表头
    const headerRows: string[][] = [];
    const uniqueLevel1Values = Array.from(columnStructure.keys()).sort();
    const uniqueLevel2Values = new Set<string>();
    
    // 第一行表头：第一层级
    const firstRow = [...rowFields];
    uniqueLevel1Values.forEach(level1Value => {
      const level2Count = columnStructure.get(level1Value)!.size;
      // 合并单元格，跨度为第二层级的数量
      for (let i = 0; i < level2Count; i++) {
        firstRow.push(level1Value);
      }
    });
    firstRow.push('总计');
    headerRows.push(firstRow);
    
    // 第二行表头：第二层级
    const secondRow = rowFields.map(() => ''); // 行字段部分留空
    uniqueLevel1Values.forEach(level1Value => {
      const level2Map = columnStructure.get(level1Value)!;
      const level2Values = Array.from(level2Map.keys()).sort();
      level2Values.forEach(level2Value => {
        secondRow.push(level2Value);
        uniqueLevel2Values.add(level2Value);
      });
    });
    secondRow.push(''); // 总计列留空
    headerRows.push(secondRow);
    
    // 构建数据行
    const groupedData = new Map<string, any>();
    
    backendResult.forEach(row => {
      const rowKey = rowFields.map(field => formatFieldValue(row[field])).join('|');
      const level1Value = formatFieldValue(row[columnFields[0]]);
      const level2Value = formatFieldValue(row[columnFields[1]]);
      
      if (!groupedData.has(rowKey)) {
        groupedData.set(rowKey, {
          key: rowKey,
          ...rowFields.reduce((acc, field) => {
            acc[field] = formatFieldValue(row[field]);
            return acc;
          }, {} as any)
        });
      }
      
      const groupRow = groupedData.get(rowKey);
      const columnKey = `${level1Value}_${level2Value}`;
      
      valueFields.forEach(valueField => {
        const valueKey = `${valueField.field}_${valueField.aggregation}`;
        if (!groupRow[columnKey]) {
          groupRow[columnKey] = 0;
        }
        groupRow[columnKey] += Number(row[valueKey] || 0);
      });
    });
    
    // 转换为数组并计算总计
    const rows = Array.from(groupedData.values()).map((row, index) => {
      const newRow = { ...row, key: `row-${index}` };
      
      // 计算行总计
      let rowTotal = 0;
      uniqueLevel1Values.forEach(level1Value => {
        const level2Map = columnStructure.get(level1Value)!;
        const level2Values = Array.from(level2Map.keys()).sort();
        level2Values.forEach(level2Value => {
          const columnKey = `${level1Value}_${level2Value}`;
          rowTotal += Number(newRow[columnKey] || 0);
        });
      });
      newRow['总计'] = rowTotal;
      
      return newRow;
    });
    
    // 计算列总计
    const totals: any = {};
    rowFields.forEach(field => {
      totals[field] = '总计';
    });
    
    uniqueLevel1Values.forEach(level1Value => {
      const level2Map = columnStructure.get(level1Value)!;
      const level2Values = Array.from(level2Map.keys()).sort();
      level2Values.forEach(level2Value => {
        const columnKey = `${level1Value}_${level2Value}`;
        let colTotal = 0;
        rows.forEach(row => {
          colTotal += Number(row[columnKey] || 0);
        });
        totals[columnKey] = colTotal;
      });
    });
    
    // 计算总计
    let grandTotal = 0;
    rows.forEach(row => {
      grandTotal += Number(row['总计'] || 0);
    });
    totals['总计'] = grandTotal;
    
    const summary = {
      totalRows: rows.length,
      totalColumns: headerRows[0].length,
      totalValue: grandTotal
    };
    
    
    return { 
      headers: headerRows[0], // 保持兼容性，使用第一行作为headers
      headerRows, // 新增：多行表头
      rows, 
      totals, 
      summary 
    };
  };

  // 格式化字段值的辅助函数
  const formatFieldValue = (value: any): string => {
    if (value === null || value === undefined) {
      return '';
    }
    
    // 处理时间字段，统一为北京时间日期格式
    if (typeof value === 'string' && value.includes('-')) {
      return formatTimeField(value);
    }
    
    return String(value);
  };

  // 拖拽处理函数
  const handleDragStart = (e: React.DragEvent, field: FieldItem) => {
    setDraggedField(field);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e: React.DragEvent, area: string) => {
    e.preventDefault();
    setDragOverArea(area);
  };

  const handleDragLeave = () => {
    setDragOverArea(null);
  };

  const handleDragEnd = () => {
    setDraggedField(null);
    setDragOverArea(null);
  };

  const handleDrop = (e: React.DragEvent, targetArea: string) => {
    e.preventDefault();
    if (!draggedField) return;

    let newConfig: PivotConfig;
    
    if (!currentConfig) {
      newConfig = {
        name: '新建透视表',
        rowFields: [],
        columnFields: [],
        valueFields: [],
        filters: [],
        sortBy: []
      };
    } else {
      newConfig = { ...currentConfig };
    }

    switch (targetArea) {
      case 'rows':
        if (!newConfig.rowFields.includes(draggedField.name)) {
          newConfig.rowFields.push(draggedField.name);
        }
        break;
      case 'columns':
        if (!newConfig.columnFields.includes(draggedField.name)) {
          newConfig.columnFields.push(draggedField.name);
        }
        break;
      case 'values':
        if (!newConfig.valueFields.some(vf => vf.field === draggedField.name)) {
          newConfig.valueFields.push({
            field: draggedField.name,
            aggregation: 'count' // 默认使用计数，用户可以在弹窗中修改
          });
        }
        break;
      case 'filters':
        // 添加筛选条件
        if (!newConfig.filters.some(f => f.field === draggedField.name)) {
          newConfig.filters.push({
            field: draggedField.name,
            operator: isPersonField(draggedField.name) ? 'contains' : 'equals',
            value: ''
          });
        }
        break;
    }

    setCurrentConfig(newConfig);
    setDraggedField(null);
    setDragOverArea(null);
  };

  // 移除字段
    const removeField = (area: string, fieldName: string) => {
    if (!currentConfig) return;
    
    const newConfig = { ...currentConfig };
    
    switch (area) {
      case 'rows':
        newConfig.rowFields = newConfig.rowFields.filter(f => f !== fieldName);
        break;
      case 'columns':
        newConfig.columnFields = newConfig.columnFields.filter(f => f !== fieldName);
        break;
      case 'values':
        newConfig.valueFields = newConfig.valueFields.filter(vf => vf.field !== fieldName);
        break;
      case 'filters':
        newConfig.filters = newConfig.filters.filter(f => f.field !== fieldName);
        break;
    }
    
    setCurrentConfig(newConfig);
  };

  // 处理配置字段的拖拽
  const handleConfigFieldDrop = (dragData: any, targetArea: string, targetIndex: number) => {
    if (!currentConfig) return;
    
    const { sourceArea, index: sourceIndex } = dragData;
    const newConfig = { ...currentConfig };
    
    // 如果是在同一个区域内拖拽，只调整顺序
    if (sourceArea === targetArea) {
      const sourceArray = getFieldArray(newConfig, sourceArea);
      const [movedField] = sourceArray.splice(sourceIndex, 1);
      sourceArray.splice(targetIndex, 0, movedField);
      setFieldArray(newConfig, sourceArea, sourceArray);
    } else {
      // 如果是跨区域拖拽，需要移动字段
      const sourceArray = getFieldArray(newConfig, sourceArea);
      const targetArray = getFieldArray(newConfig, targetArea);
      
      // 从源区域移除
      const [movedField] = sourceArray.splice(sourceIndex, 1);
      setFieldArray(newConfig, sourceArea, sourceArray);
      
      // 添加到目标区域
      targetArray.splice(targetIndex, 0, movedField);
      setFieldArray(newConfig, targetArea, targetArray);
    }
    
    setCurrentConfig(newConfig);
  };

  // 获取字段数组的辅助函数
  const getFieldArray = (config: PivotConfig, area: string) => {
    switch (area) {
      case 'rows':
        return config.rowFields;
      case 'columns':
        return config.columnFields;
      case 'values':
        return config.valueFields.map(vf => vf.field);
      case 'filters':
        return config.filters.map(f => f.field);
      default:
        return [];
    }
  };

  // 设置字段数组的辅助函数
  const setFieldArray = (config: PivotConfig, area: string, fields: string[]) => {
    switch (area) {
      case 'rows':
        config.rowFields = fields;
        break;
      case 'columns':
        config.columnFields = fields;
        break;
      case 'values':
        // 保持原有的valueFields结构
        const valueFields = fields.map(field => {
          const existing = config.valueFields.find(vf => vf.field === field);
          return existing || { field, aggregation: 'sum' as const };
        });
        config.valueFields = valueFields;
        break;
      case 'filters':
        // 保持原有的filters结构
        const filters = fields.map(field => {
          const existing = config.filters.find(f => f.field === field);
          return existing || { field, operator: 'equals' as const, value: '' };
        });
        config.filters = filters;
        break;
    }
  };

  // 保存透视表配置
  const savePivotConfig = async (config: PivotConfig) => {
    try {
      const { data, error } = await supabase
        .from('bi_pivot_configs')
        .insert([{
          name: config.name,
          description: config.description,
          config: config,
          data_source: 'joined_data',
          created_by: (await supabase.auth.getUser()).data.user?.id
        }])
        .select();

      if (error) {
        if (error.code === '42P01') {
          message.warning('BI透视表配置表不存在，无法保存配置。请先创建表。');
          return null;
        } else {
          throw error;
        }
      }

      message.success('配置保存成功');
      loadPivotConfigs();
      return data?.[0]?.id;
    } catch (error) {
      console.error('保存配置失败:', error);
      message.error('保存配置失败');
    }
  };

  // 加载透视表配置
  const loadPivotConfigs = async () => {
    try {
      const { data, error } = await supabase
        .from('bi_pivot_configs')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) {
        if (error.code === '42P01') {
          // 表不存在，显示提示信息
          message.info('BI透视表配置表不存在，请先创建表。当前可以正常使用透视表功能，但无法保存配置。');
          setPivotConfigs([]);
        } else {
          throw error;
        }
        return;
      }

      setPivotConfigs(data || []);
    } catch (error) {
      console.error('加载配置失败:', error);
      message.error('加载配置失败');
    }
  };

  // 删除透视表配置
  const deletePivotConfig = async (configId: string) => {
    try {
      const { error } = await supabase
        .from('bi_pivot_configs')
        .delete()
        .eq('id', configId);

      if (error) {
        if (error.code === '42P01') {
          message.warning('BI透视表配置表不存在，无法删除配置。');
          return;
        } else {
          throw error;
        }
      }

      message.success('配置删除成功');
      loadPivotConfigs();
    } catch (error) {
      console.error('删除配置失败:', error);
      message.error('删除配置失败');
    }
  };

  // 读取透视表配置
  const loadPivotConfig = (config: SavedPivotConfig) => {
    setCurrentConfig(config.config);
    setLoadConfigModalVisible(false);
    setSelectedConfig(null);
    message.success(`已加载配置: ${config.name}`);
  };



  // 初始化
  useEffect(() => {
    loadPivotConfigs();
    
    // 添加全局拖拽结束事件监听器
    const handleGlobalDragEnd = () => {
      setDraggedField(null);
      setDragOverArea(null);
    };
    
    document.addEventListener('dragend', handleGlobalDragEnd);
    
    return () => {
      document.removeEventListener('dragend', handleGlobalDragEnd);
    };
  }, []);

  // 透视表列定义
  const pivotColumns = useMemo(() => {
    if (!pivotResult || !pivotResult.headers) return [];

    return pivotResult.headers.map((header) => ({
      title: header,
      dataIndex: header,
      key: header,
      width: currentConfig?.rowFields?.includes(header) ? 150 : 120, // 行字段列宽一些
      fixed: currentConfig?.rowFields?.includes(header) ? ('left' as const) : undefined, // 行字段固定在左侧
      render: (value: any, record: any) => {
        // 检查是否为时间字段
        const isTimeField = TIME_FIELDS.some(field => header.includes(field));
        
        if (isTimeField && value && value !== '0' && value !== '空值') {
          return formatTimeField(value);
        }
        
        // 总计行特殊处理
        if (record.key === 'totals') {
          return typeof value === 'number' ? value.toLocaleString() : value;
        }
        
        // 行字段特殊处理
        if (currentConfig?.rowFields?.includes(header)) {
          return (
            <span style={{ fontWeight: 'bold', color: '#1890ff' }}>
              {typeof value === 'number' ? value.toLocaleString() : value}
            </span>
          );
        }
        
        // 列维度值特殊处理（透视表格式）
        if (currentConfig && currentConfig.columnFields && currentConfig.columnFields.length > 0) {
          const isColumnValue = !currentConfig.rowFields.includes(header) && header !== '总计';
          if (isColumnValue) {
            return typeof value === 'number' ? value.toLocaleString() : value;
          }
        }
        
        // 值字段特殊处理
        if (currentConfig?.valueFields?.some(vf => vf.field === header)) {
          return (
            <span style={{ fontWeight: 'bold', color: '#52c41a' }}>
              {typeof value === 'number' ? value.toLocaleString() : value}
            </span>
          );
        }
        
        return typeof value === 'number' ? value.toLocaleString() : value;
      }
    }));
  }, [pivotResult, currentConfig]);

    // 多行表头渲染组件
  const renderMultiLevelHeaders = () => {
    if (!pivotResult?.headerRows || pivotResult.headerRows.length <= 1) {
      return null;
    }

    return (
      <div className="multi-level-headers">
        <table>
          <thead>
            {pivotResult.headerRows.map((headerRow, rowIndex) => (
              <tr key={rowIndex}>
                {headerRow.map((cell, cellIndex) => {
                  // 计算单元格的colspan和rowspan
                  let colspan = 1;
                  let rowspan = 1;
                  
                  // 如果是行字段列，需要跨行
                  if (cellIndex < (currentConfig?.rowFields?.length || 0)) {
                    rowspan = pivotResult.headerRows?.length || 1;
                  }
                  
                  // 如果是第一行且是多层级列字段，计算合并
                  if (rowIndex === 0 && cellIndex >= (currentConfig?.rowFields?.length || 0)) {
                    const columnFields = currentConfig?.columnFields || [];
                    if (columnFields.length > 1) {
                      // 简化处理：根据列字段数量计算合并
                      const totalDataColumns = headerRow.length - (currentConfig?.rowFields?.length || 0) - 1; // 减去行字段和总计列
                      const level1Count = columnFields.length > 0 ? 2 : 1; // 假设有2个层级
                      
                      if (level1Count > 0) {
                        colspan = Math.ceil(totalDataColumns / level1Count);
                      }
                    }
                  }
                  
                  return (
                    <th 
                      key={cellIndex}
                      colSpan={colspan}
                      rowSpan={rowspan}
                    >
                      {cell}
                    </th>
                  );
                })}
              </tr>
            ))}
          </thead>
        </table>
      </div>
    );
  };

  // 透视表数据源
  const pivotDataSource = useMemo(() => {
    if (!pivotResult) return [];

    const dataSource = pivotResult.rows.map((row, index) => ({
      key: `row-${index}`,
      ...row
    }));

    // 添加总计行
    if (pivotResult.totals && Object.keys(pivotResult.totals).length > 0) {
      dataSource.push({
        key: 'totals',
        ...pivotResult.totals
      });
    }

    return dataSource;
  }, [pivotResult]);

  // 透视表滚动配置
  const pivotTableScroll = useMemo(() => {
    if (!pivotResult || !currentConfig) return { x: 'max-content' };
    
    const rowFieldsCount = currentConfig.rowFields?.length || 0;
    
    // 如果有行字段，设置固定列
    if (rowFieldsCount > 0) {
      return {
        x: 'max-content',
        y: 400
      };
    }
    
    return { x: 'max-content' };
  }, [pivotResult, currentConfig]);

  // 渲染拖拽区域
  const renderDropZone = (area: string, title: string, fields: string[], icon: React.ReactNode) => {
    const isDragOver = dragOverArea === area;
    
    return (
      <div
        className={`drop-zone ${isDragOver ? 'drag-over' : ''}`}
        onDragOver={(e) => {
          e.preventDefault();
          handleDragOver(e, area);
        }}
        onDragLeave={handleDragLeave}
        onDrop={(e) => {
          e.preventDefault();
          try {
            const dragData = JSON.parse(e.dataTransfer.getData('text/plain'));
            if (dragData.type === 'config-field') {
              // 如果是配置字段拖拽，添加到区域末尾
              handleConfigFieldDrop(dragData, area, fields.length);
            } else {
              // 如果是可用字段拖拽，使用原有的handleDrop
              handleDrop(e, area);
            }
          } catch (error) {
            // 如果不是JSON数据，使用原有的handleDrop
            handleDrop(e, area);
          }
        }}
        style={{
          border: '1px solid #e8e8e8',
          borderRadius: '4px',
          padding: '8px 12px',
          minHeight: '60px',
          backgroundColor: isDragOver ? '#f0f8ff' : '#fafafa',
          transition: 'all 0.2s ease',
          marginBottom: '8px'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', marginBottom: '6px', fontSize: '12px' }}>
          {icon}
          <Text strong style={{ marginLeft: '6px', fontSize: '12px' }}>{title}</Text>
        </div>
        
        {fields.length > 0 ? (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
            {fields.map((field, index) => {
              const fieldInfo = availableFields.find(f => f.name === field);
              const filter = currentConfig?.filters?.find(f => f.field === field);
              const valueField = currentConfig?.valueFields?.find(vf => vf.field === field);
              
              return (
                <Tag
                  key={field}
                  closable
                  onClose={() => removeField(area, field)}
                  className="field-tag"
                  draggable
                  onDragStart={(e) => {
                    e.dataTransfer.setData('text/plain', JSON.stringify({
                      type: 'config-field',
                      sourceArea: area,
                      field: field,
                      index: index
                    }));
                  }}
                  onDragOver={(e) => {
                    e.preventDefault();
                    e.currentTarget.style.opacity = '0.5';
                  }}
                  onDragLeave={(e) => {
                    e.currentTarget.style.opacity = '1';
                  }}
                  onDrop={(e) => {
                    e.preventDefault();
                    e.currentTarget.style.opacity = '1';
                    
                    try {
                      const dragData = JSON.parse(e.dataTransfer.getData('text/plain'));
                      if (dragData.type === 'config-field') {
                        handleConfigFieldDrop(dragData, area, index);
                      }
                    } catch (error) {
                      console.error('拖拽数据处理错误:', error);
                    }
                  }}
                  style={{ 
                    cursor: 'grab',
                    backgroundColor: (area === 'filters' && (filter?.value || filter?.operator === 'date_between' || filter?.operator === 'is_null' || filter?.operator === 'is_not_null' || filter?.operator === 'contains' || filter?.operator === 'not_contains')) || (area === 'values' && valueField?.aggregation) ? '#f0f8ff' : '#fafafa',
                    border: '1px solid #e8e8e8',
                    borderRadius: '4px',
                    padding: '4px 8px',
                    fontSize: '11px',
                    margin: '2px 0',
                    transition: 'all 0.2s ease'
                  }}
                  onClick={
                    area === 'filters' ? () => {
                      // 如果是日期范围筛选，需要设置dateRange
                      let editingFilterData = filter || { field: field, operator: 'equals', value: '' };
                      if (filter?.operator === 'date_between' && filter.value && filter.value2) {
                        editingFilterData.dateRange = [filter.value, filter.value2];
                      }
                      // 确保操作符有默认值
                      if (!editingFilterData.operator) {
                        editingFilterData.operator = 'equals';
                      }
                      setEditingFilter(editingFilterData);
                      setFilterModalVisible(true);
                    } : 
                    area === 'values' ? () => {
                      setEditingValueField(valueField || { field: field, aggregation: 'sum' });
                      setValueFieldModalVisible(true);
                    } : undefined
                  }
                >
                  {fieldInfo?.label || field}
                  {area === 'filters' && (filter?.value || filter?.operator === 'date_between' || filter?.operator === 'is_null' || filter?.operator === 'is_not_null' || filter?.operator === 'contains' || filter?.operator === 'not_contains') && (
                    <span style={{ marginLeft: 4, fontSize: '10px', color: '#666' }}>
                      ({filter.operator === 'date_between' ? '日期范围' : 
                        filter.operator === 'equals' ? '等于' :
                        filter.operator === 'not_equals' ? '不等于' :
                        filter.operator === 'contains' ? '包含' :
                        filter.operator === 'not_contains' ? '不包含' :
                        filter.operator === 'greater_than' ? '大于' :
                        filter.operator === 'less_than' ? '小于' :
                        filter.operator === 'between' ? '介于' :
                        filter.operator === 'is_null' ? '为空' :
                        filter.operator === 'is_not_null' ? '不为空' :
                        filter.operator}: {
                        filter.operator === 'date_between' ? 
                          formatDateRange(filter.value, filter.value2) : 
                        filter.operator === 'between' ? 
                          `${filter.value} ~ ${filter.value2}` : 
                        filter.operator === 'is_null' || filter.operator === 'is_not_null' ?
                          '' : 
                        filter.operator === 'contains' || filter.operator === 'not_contains' ?
                          (filter.value && filter.value.length > 20 ? 
                            `${filter.value.substring(0, 20)}...` : 
                            filter.value) :
                          filter.value
                      })
                    </span>
                  )}
                  {area === 'values' && valueField?.aggregation && (
                    <span style={{ marginLeft: 4, fontSize: '10px', color: '#666' }}>
                      ({valueField.aggregation === 'sum' ? '求和' :
                        valueField.aggregation === 'count' ? '计数' :
                        valueField.aggregation === 'count_distinct' ? '去重计数' :
                        valueField.aggregation === 'avg' ? '平均值' :
                        valueField.aggregation === 'max' ? '最大值' :
                        valueField.aggregation === 'min' ? '最小值' :
                        valueField.aggregation})
                    </span>
                  )}
                </Tag>
              );
            })}
          </div>
        ) : (
          <Text type="secondary" style={{ fontSize: '12px' }}>
            {area === 'rows' ? '拖拽字段到行维度区域' :
             area === 'columns' ? '拖拽字段到列维度区域' :
             area === 'values' ? '拖拽字段到值字段区域（支持所有聚合方式）' :
             '拖拽字段到此区域'}
          </Text>
        )}
      </div>
    );
  };

  // 复制透视表数据到剪贴板（Excel兼容格式）
  const copyPivotData = () => {
    if (!pivotResult) {
      message.warning('没有可复制的数据');
      return;
    }

    try {
      // 构建制表符分隔的数据（Excel兼容格式）
      let tsvContent = '';
      
      // 如果有多行表头，先添加表头
      if (pivotResult.headerRows && pivotResult.headerRows.length > 1) {
        pivotResult.headerRows.forEach(headerRow => {
          tsvContent += headerRow.map(cell => cell || '').join('\t') + '\n';
        });
      } else {
        // 单行表头
        tsvContent += pivotResult.headers.map(header => header || '').join('\t') + '\n';
      }
      
      // 添加数据行
      pivotResult.rows.forEach(row => {
        const rowData = pivotResult.headers.map(header => {
          const value = row[header];
          // 处理空值和特殊字符
          if (value === null || value === undefined) {
            return '';
          }
          const stringValue = String(value);
          // 移除换行符，保留制表符分隔
          return stringValue.replace(/\n/g, ' ').replace(/\r/g, '');
        });
        tsvContent += rowData.join('\t') + '\n';
      });
      
      // 添加总计行
      if (pivotResult.totals && Object.keys(pivotResult.totals).length > 0) {
        const totalsData = pivotResult.headers.map(header => {
          const value = pivotResult.totals[header];
          if (value === null || value === undefined) {
            return '';
          }
          const stringValue = String(value);
          return stringValue.replace(/\n/g, ' ').replace(/\r/g, '');
        });
        tsvContent += totalsData.join('\t') + '\n';
      }
      
      // 复制到剪贴板
      navigator.clipboard.writeText(tsvContent).then(() => {
        message.success('数据已复制到剪贴板，可直接粘贴到Excel');
      }).catch(() => {
        // 如果剪贴板API不可用，使用传统方法
        const textArea = document.createElement('textarea');
        textArea.value = tsvContent;
        document.body.appendChild(textArea);
        textArea.select();
        document.execCommand('copy');
        document.body.removeChild(textArea);
        message.success('数据已复制到剪贴板，可直接粘贴到Excel');
      });
    } catch (error) {
      console.error('复制数据失败:', error);
      message.error('复制数据失败');
    }
  };

  // 下载透视表数据为CSV文件
  const downloadPivotData = () => {
    if (!pivotResult) {
      message.warning('没有可下载的数据');
      return;
    }

    try {
      // 构建CSV格式的数据
      let csvContent = '';
      
      // 如果有多行表头，先添加表头
      if (pivotResult.headerRows && pivotResult.headerRows.length > 1) {
        pivotResult.headerRows.forEach(headerRow => {
          csvContent += headerRow.map(cell => `"${cell}"`).join(',') + '\n';
        });
      } else {
        // 单行表头
        csvContent += pivotResult.headers.map(header => `"${header}"`).join(',') + '\n';
      }
      
      // 添加数据行
      pivotResult.rows.forEach(row => {
        const rowData = pivotResult.headers.map(header => {
          const value = row[header];
          // 处理包含逗号、引号或换行符的值
          if (value === null || value === undefined) {
            return '""';
          }
          const stringValue = String(value);
          if (stringValue.includes(',') || stringValue.includes('"') || stringValue.includes('\n')) {
            return `"${stringValue.replace(/"/g, '""')}"`;
          }
          return `"${stringValue}"`;
        });
        csvContent += rowData.join(',') + '\n';
      });
      
      // 添加总计行
      if (pivotResult.totals && Object.keys(pivotResult.totals).length > 0) {
        const totalsData = pivotResult.headers.map(header => {
          const value = pivotResult.totals[header];
          if (value === null || value === undefined) {
            return '""';
          }
          const stringValue = String(value);
          if (stringValue.includes(',') || stringValue.includes('"') || stringValue.includes('\n')) {
            return `"${stringValue.replace(/"/g, '""')}"`;
          }
          return `"${stringValue}"`;
        });
        csvContent += totalsData.join(',') + '\n';
      }
      
      // 创建下载链接
      const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      const url = URL.createObjectURL(blob);
      
      // 生成文件名
      const timestamp = dayjs().format('YYYY-MM-DD_HH-mm-ss');
      const configName = currentConfig?.name || 'pivot_data';
      const fileName = `${configName}_${timestamp}.csv`;
      
      link.setAttribute('href', url);
      link.setAttribute('download', fileName);
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      message.success('数据已下载为CSV文件');
    } catch (error) {
      console.error('下载数据失败:', error);
      message.error('下载数据失败');
    }
  };

  return (
    <div className="page-card">
      <style>{pivotTableStyles}</style>
      {/* 拖拽提示 */}
      {draggedField && (
        <div className="drag-hint show">
          拖拽 "{draggedField.label}" 到目标区域
        </div>
      )}
      <div className="page-header">
        <Title level={4} style={{ marginLeft: -10, marginTop: 10, fontWeight: 700, color: '#222' }}>
          数据分析
        </Title>
      </div>
      
      {/* 数据说明提示 */}
      <Alert
        description="每个线索只显示最新的看房和成交记录。如果数据与预期不符，可能是因为线索有多个记录只显示最新一条，或某些记录被标记为无效。"
        type="info"
        showIcon
        style={{ marginBottom: 8, padding: '6px 12px' }}
        message={null}
      />

      {/* 主要内容区域 */}
      <Tabs 
        activeKey={activeTab} 
        onChange={setActiveTab}
        items={[
          {
            key: 'pivot',
            label: '透视表',
            children: (
              <Row gutter={16}>
                {/* 左侧透视表结果展示 (5/3) */}
                <Col span={15}>
                                                          <Card 
                        title="透视表结果" 
                        className="result-panel"
                        styles={{
                          header: { 
                            background: 'transparent', 
                            borderBottom: '1px solid #e8e8e8',
                            padding: '8px 12px'
                          },
                          body: { padding: '8px 12px' }
                        }}
                      >
                    {pivotResult ? (
                      <div>
                        {/* 渲染多行表头 */}
                        {renderMultiLevelHeaders()}
                        
                        {/* 透视表操作按钮 */}
                        <div style={{ marginBottom: 16, display: 'flex', gap: 8 }}>
                          <Button 
                            size="small"
                            icon={<CopyOutlined />}
                            onClick={copyPivotData}
                            disabled={!pivotResult}
                            title="复制数据到剪贴板，可直接粘贴到Excel"
                          >
                            复制数据
                          </Button>
                          <Button 
                            size="small"
                            icon={<DownloadOutlined />}
                            onClick={downloadPivotData}
                            disabled={!pivotResult}
                            title="下载数据为CSV文件"
                          >
                            下载CSV
                          </Button>
                        </div>
                        
                        {/* 渲染数据表格 */}
                        <Table
                          columns={pivotColumns}
                          dataSource={pivotDataSource}
                          pagination={false}
                          size="small"
                          bordered
                          className="pivot-table"
                          scroll={pivotTableScroll}
                          showHeader={!pivotResult.headerRows || pivotResult.headerRows.length <= 1}

                          summary={() => (
                            <Table.Summary.Row>
                              <Table.Summary.Cell index={0} colSpan={pivotColumns.length}>
                                <div>
                                  总计: {pivotResult?.summary?.totalRows || 0} 行数据
                                </div>
                              </Table.Summary.Cell>
                            </Table.Summary.Row>
                          )}
                        />
                        
                        
                      </div>
                    ) : (
                      <div className="empty-state">
                        <TableOutlined />
                        <div>
                          <Text type="secondary">请先配置并执行透视表</Text>
                        </div>
                      </div>
                    )}
                  </Card>
                </Col>
                
                {/* 右侧面板 - 可用字段和透视表配置并列 */}
                <Col span={9}>
                  <Row gutter={16}>
                    {/* 可用字段面板 (5/1) */}
                    <Col span={12}>
                      <Card 
                        title="可用字段" 
                        size="small" 
                        className="field-panel"
                        styles={{
                          header: { 
                            background: 'transparent', 
                            borderBottom: '1px solid #e8e8e8',
                            padding: '8px 12px'
                          },
                          body: { padding: '8px 12px' }
                        }}
                      >
                        {/* 搜索框 */}
                        <div style={{ marginBottom: 8 }}>
                          <Input.Search
                            placeholder="搜索字段..."
                            size="small"
                            allowClear
                            style={{ fontSize: '11px' }}
                            value={searchValue}
                            onChange={(e) => {
                              setSearchValue(e.target.value);
                            }}
                          />
                        </div>
                        <Tabs size="small" type="card" tabBarGutter={2} tabBarStyle={{ marginBottom: 8, fontSize: '11px' }} hideAdd={true} moreIcon={null} tabBarExtraContent={null} destroyOnHidden={false} className="no-more-tabs" items={[
                          {
                            key: 'all',
                            label: '全部',
                            children: (
                              <div style={{ maxHeight: 400, overflowY: 'auto' }}>
                                {availableFields
                                  .filter(field => 
                                    searchValue === '' || 
                                    field.label.toLowerCase().includes(searchValue.toLowerCase()) ||
                                    field.name.toLowerCase().includes(searchValue.toLowerCase())
                                  )
                                  .map(field => (
                                    <div 
                                      key={field.name}
                                      draggable
                                      onDragStart={(e) => handleDragStart(e, field)}
                                      onDragEnd={handleDragEnd}
                                      className="draggable-field"
                                      style={{ 
                                        padding: '8px 12px', 
                                        border: '1px solid #e8e8e8', 
                                        margin: '3px 0',
                                        borderRadius: '4px',
                                        backgroundColor: '#fafafa',
                                        display: 'block',
                                        fontSize: '12px',
                                        cursor: 'grab',
                                        transition: 'all 0.2s ease',
                                        textAlign: 'left'
                                      }}
                                    >
                                      <div style={{ lineHeight: '1.4' }}>
                                        <div style={{ fontWeight: '600', color: '#333', marginBottom: '2px' }}>
                                          {field.label}
                                        </div>
                                        <div style={{ fontSize: '10px', color: '#666', marginBottom: '1px' }}>
                                          {field.name}
                                        </div>
                                        <div style={{ fontSize: '9px', color: '#999' }}>
                                          {field.table}
                                        </div>
                                      </div>
                                    </div>
                                  ))}
                              </div>
                            )
                          },
                                                    {
                            key: 'leads',
                            label: '线索',
                            children: (
                              <div style={{ maxHeight: 400, overflowY: 'auto' }}>
                                {availableFields
                                  .filter(field => field.table === 'leads')
                                  .filter(field => 
                                    searchValue === '' || 
                                    field.label.toLowerCase().includes(searchValue.toLowerCase()) ||
                                    field.name.toLowerCase().includes(searchValue.toLowerCase())
                                  )
                                  .map(field => (
                                    <div 
                                      key={field.name}
                                      draggable
                                      onDragStart={(e) => handleDragStart(e, field)}
                                      onDragEnd={handleDragEnd}
                                      className="draggable-field"
                                      style={{ 
                                        padding: '8px 12px', 
                                        border: '1px solid #e8e8e8', 
                                        margin: '3px 0',
                                        borderRadius: '4px',
                                        backgroundColor: '#fafafa',
                                        display: 'block',
                                        fontSize: '12px',
                                        cursor: 'grab',
                                        transition: 'all 0.2s ease',
                                        textAlign: 'left'
                                      }}
                                    >
                                      <div style={{ lineHeight: '1.4' }}>
                                        <div style={{ fontWeight: '600', color: '#333', marginBottom: '2px' }}>
                                          {field.label}
                                        </div>
                                        <div style={{ fontSize: '10px', color: '#666' }}>
                                          {field.name}
                                        </div>
                                      </div>
                                    </div>
                                  ))}
                              </div>
                            )
                          },
                          {
                            key: 'followups',
                            label: '跟进',
                            children: (
                              <div style={{ maxHeight: 400, overflowY: 'auto' }}>
                                {availableFields
                                  .filter(field => field.table === 'followups')
                                  .filter(field => 
                                    searchValue === '' || 
                                    field.label.toLowerCase().includes(searchValue.toLowerCase()) ||
                                    field.name.toLowerCase().includes(searchValue.toLowerCase())
                                  )
                                  .map(field => (
                                  <div 
                                    key={field.name}
                                    draggable
                                    onDragStart={(e) => handleDragStart(e, field)}
                                    onDragEnd={handleDragEnd}
                                    className="draggable-field"
                                    style={{ 
                                      padding: '8px 12px', 
                                      border: '1px solid #e8e8e8', 
                                      margin: '3px 0',
                                      borderRadius: '4px',
                                      backgroundColor: '#fafafa',
                                      display: 'block',
                                      fontSize: '12px',
                                      cursor: 'grab',
                                      transition: 'all 0.2s ease',
                                      textAlign: 'left'
                                    }}
                                  >
                                    <div style={{ lineHeight: '1.4' }}>
                                      <div style={{ fontWeight: '600', color: '#333', marginBottom: '2px' }}>
                                        {field.label}
                                      </div>
                                      <div style={{ fontSize: '10px', color: '#666' }}>
                                        {field.name}
                                      </div>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            )
                          },
                          {
                            key: 'showings',
                            label: '看房',
                            children: (
                              <div style={{ maxHeight: 400, overflowY: 'auto' }}>
                                {availableFields
                                  .filter(field => field.table === 'showings')
                                  .filter(field => 
                                    searchValue === '' || 
                                    field.label.toLowerCase().includes(searchValue.toLowerCase()) ||
                                    field.name.toLowerCase().includes(searchValue.toLowerCase())
                                  )
                                  .map(field => (
                                  <div 
                                    key={field.name}
                                    draggable
                                    onDragStart={(e) => handleDragStart(e, field)}
                                    onDragEnd={handleDragEnd}
                                    className="draggable-field"
                                    style={{ 
                                      padding: '8px 12px', 
                                      border: '1px solid #e8e8e8', 
                                      margin: '3px 0',
                                      borderRadius: '4px',
                                      backgroundColor: '#fafafa',
                                      display: 'block',
                                      fontSize: '12px',
                                      cursor: 'grab',
                                      transition: 'all 0.2s ease',
                                      textAlign: 'left'
                                    }}
                                  >
                                    <div style={{ lineHeight: '1.4' }}>
                                      <div style={{ fontWeight: '600', color: '#333', marginBottom: '2px' }}>
                                        {field.label}
                                      </div>
                                      <div style={{ fontSize: '10px', color: '#666' }}>
                                        {field.name}
                                      </div>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            )
                          },
                          {
                            key: 'deals',
                            label: '成交',
                            children: (
                              <div style={{ maxHeight: 400, overflowY: 'auto' }}>
                                {availableFields
                                  .filter(field => field.table === 'deals')
                                  .filter(field => 
                                    searchValue === '' || 
                                    field.label.toLowerCase().includes(searchValue.toLowerCase()) ||
                                    field.name.toLowerCase().includes(searchValue.toLowerCase())
                                  )
                                  .map(field => (
                                  <div 
                                    key={field.name}
                                    draggable
                                    onDragStart={(e) => handleDragStart(e, field)}
                                    onDragEnd={handleDragEnd}
                                    className="draggable-field"
                                    style={{ 
                                      padding: '8px 12px', 
                                      border: '1px solid #e8e8e8', 
                                      margin: '3px 0',
                                      borderRadius: '4px',
                                      backgroundColor: '#fafafa',
                                      display: 'block',
                                      fontSize: '12px',
                                      cursor: 'grab',
                                      transition: 'all 0.2s ease',
                                      textAlign: 'left'
                                    }}
                                  >
                                    <div style={{ lineHeight: '1.4' }}>
                                      <div style={{ fontWeight: '600', color: '#333', marginBottom: '2px' }}>
                                        {field.label}
                                      </div>
                                      <div style={{ fontSize: '10px', color: '#666' }}>
                                        {field.name}
                                      </div>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            )
                          }
                        ]} />
                      </Card>
                    </Col>
                    
                                          {/* 透视表配置面板 (5/1) */}
                      <Col span={12}>
                        <Card 
                          title="透视表配置" 
                          size="small" 
                          className="config-panel"
                          styles={{
                            header: { 
                              background: 'transparent', 
                              borderBottom: '1px solid #e8e8e8',
                              padding: '8px 12px'
                            },
                            body: { padding: '8px 0px' }
                          }}
                        >
                                            {renderDropZone('rows', '行维度', currentConfig?.rowFields || [], <TableOutlined />)}
                    {renderDropZone('columns', '列维度', currentConfig?.columnFields || [], <TableOutlined />)}
                    {renderDropZone('values', '值字段', currentConfig?.valueFields.map(vf => vf.field) || [], <BarChartOutlined />)}
                    {renderDropZone('filters', '筛选条件', currentConfig?.filters.map(f => f.field) || [], <FilterOutlined />)}
                        
                        <div style={{ marginTop: 12 }}>
                          <div className="action-buttons" style={{ 
                            display: 'grid', 
                            gridTemplateColumns: '1fr 1fr', 
                            gap: '6px'
                          }}>
                            <Button 
                              type="primary" 
                              onClick={() => currentConfig && executePivot(currentConfig)}
                              disabled={!currentConfig}
                              size="small"
                              style={{ 
                                fontSize: '12px',
                                height: '30px',
                                borderRadius: '4px'
                              }}
                              title={
                                !currentConfig ? '请先拖拽字段到配置区域' : 
                                '点击执行透视表分析'
                              }
                            >
                              执行透视表
                            </Button>
                            <Button 
                              onClick={() => setCurrentConfig(null)}
                              size="small"
                              style={{ 
                                fontSize: '12px',
                                height: '30px',
                                borderRadius: '4px'
                              }}
                            >
                              清空配置
                            </Button>
                            <Button 
                              onClick={() => {
                                if (currentConfig) {
                                  setEditingConfig(null);
                                  setConfigModalVisible(true);
                                }
                              }}
                              size="small"
                              style={{ 
                                fontSize: '12px',
                                height: '30px',
                                borderRadius: '4px'
                              }}
                            >
                              保存配置
                            </Button>
                            <Button 
                              onClick={() => setLoadConfigModalVisible(true)}
                              size="small"
                              style={{ 
                                fontSize: '12px',
                                height: '30px',
                                borderRadius: '4px'
                              }}
                            >
                              读取配置
                            </Button>
                          </div>
                        </div>
                      </Card>
                    </Col>
                  </Row>
                </Col>
              </Row>
            )
          },
          {
            key: 'saved',
            label: '保存的配置',
            children: (
              <Card>
                <Table
                  dataSource={pivotConfigs}
                  columns={[
                    {
                      title: '配置名称',
                      dataIndex: 'name',
                      key: 'name',
                    },
                    {
                      title: '描述',
                      dataIndex: 'description',
                      key: 'description',
                    },
                    {
                      title: '行维度',
                      dataIndex: 'config',
                      key: 'row_fields',
                      render: (_, record) => {
                        const config = record.config as any;
                        return config?.rowFields?.join(', ') || '-';
                      }
                    },
                    {
                      title: '列维度',
                      dataIndex: 'config',
                      key: 'column_fields',
                      render: (_, record) => {
                        const config = record.config as any;
                        return config?.columnFields?.join(', ') || '-';
                      }
                    },
                    {
                      title: '值字段',
                      dataIndex: 'config',
                      key: 'value_fields',
                      render: (_, record) => {
                        const config = record.config as any;
                        return config?.valueFields?.map((vf: any) => `${vf.field}(${vf.aggregation})`).join(', ') || '-';
                      }
                    },
                    {
                      title: '创建时间',
                      dataIndex: 'created_at',
                      key: 'created_at',
                      render: (date) => dayjs(date).format('YYYY-MM-DD HH:mm')
                    },
                    {
                      title: '操作',
                      key: 'actions',
                      render: (_, record) => (
                        <Space>
                          <Button 
                            size="small" 
                            icon={<EyeOutlined />}
                            onClick={() => {
                              if (record.config) {
                                setCurrentConfig(record.config);
                                setActiveTab('pivot');
                              }
                            }}
                          >
                            使用
                          </Button>
                          <Button 
                            size="small" 
                            icon={<EditOutlined />}
                            onClick={() => {
                              setEditingConfig(record.config);
                              setConfigModalVisible(true);
                            }}
                          >
                            编辑
                          </Button>
                          <Button 
                            size="small" 
                            danger 
                            icon={<DeleteOutlined />}
                            onClick={() => deletePivotConfig(record.id || '')}
                          >
                            删除
                          </Button>
                        </Space>
                      )
                    }
                  ]}
                  rowKey="id"
                  pagination={{ pageSize: 10 }}
                />
              </Card>
            )
          }
        ]}
      />

      {/* 配置保存弹窗 */}
      <Modal
        title={editingConfig ? '编辑透视表配置' : '保存透视表配置'}
        open={configModalVisible}
        onCancel={() => setConfigModalVisible(false)}
        footer={null}
      >
        <Form
          form={configForm}
          layout="vertical"
          initialValues={editingConfig || {}}
          onFinish={async (values) => {
            if (currentConfig) {
              const configToSave = {
                ...currentConfig,
                ...values
              };
              await savePivotConfig(configToSave);
              setConfigModalVisible(false);
              setEditingConfig(null);
              configForm.resetFields();
            }
          }}
        >
          <Form.Item
            name="name"
            label="配置名称"
            rules={[{ required: true, message: '请输入配置名称' }]}
          >
            <Input placeholder="请输入配置名称" />
          </Form.Item>
          
          <Form.Item
            name="description"
            label="配置描述"
          >
            <Input.TextArea placeholder="请输入配置描述" />
          </Form.Item>
          
          <Form.Item>
            <Space>
              <Button type="primary" htmlType="submit">
                保存
              </Button>
              <Button onClick={() => setConfigModalVisible(false)}>
                取消
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>

      {/* 读取配置弹窗 */}
      <Modal
        title="读取透视表配置"
        open={loadConfigModalVisible}
        onCancel={() => setLoadConfigModalVisible(false)}
        footer={null}
        width={600}
        className="load-config-modal"
      >
        <div style={{ maxHeight: 500, overflowY: 'auto' }}>
          {pivotConfigs.length > 0 ? (
            <div>
              {/* 搜索框 */}
              <div style={{ marginBottom: 16 }}>
                <Input.Search
                  placeholder="搜索配置名称、描述或字段..."
                  allowClear
                  value={configSearchValue}
                  onChange={(e) => setConfigSearchValue(e.target.value)}
                  style={{ width: '100%' }}
                />
              </div>
              
              <div style={{ display: 'grid', gap: '8px' }}>
                {(() => {
                  const filteredConfigs = pivotConfigs.filter(config => {
                    if (!configSearchValue) return true;
                    const searchLower = configSearchValue.toLowerCase();
                    return (
                      config.name.toLowerCase().includes(searchLower) ||
                      (config.description && config.description.toLowerCase().includes(searchLower)) ||
                      config.config.rowFields?.some(field => field.toLowerCase().includes(searchLower)) ||
                      config.config.columnFields?.some(field => field.toLowerCase().includes(searchLower)) ||
                      config.config.valueFields?.some(vf => vf.field.toLowerCase().includes(searchLower))
                    );
                  });
                  
                  if (filteredConfigs.length === 0) {
                    return (
                      <div style={{ textAlign: 'center', padding: '20px' }}>
                        <div style={{ color: '#666', marginBottom: '8px' }}>
                          {configSearchValue ? '未找到匹配的配置' : '暂无保存的配置'}
                        </div>
                        <div style={{ fontSize: '12px', color: '#999' }}>
                          {configSearchValue ? '请尝试其他搜索关键词' : '请先保存一些透视表配置'}
                        </div>
                      </div>
                    );
                  }
                  
                  return filteredConfigs.map((config) => (
                    <Card
                      key={config.id}
                      size="small"
                      onClick={() => loadPivotConfig(config)}
                      className={`config-card ${selectedConfig?.id === config.id ? 'selected' : ''}`}
                      style={{ 
                        cursor: 'pointer',
                        padding: '8px 12px'
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ 
                            fontWeight: 'bold', 
                            fontSize: '13px', 
                            marginBottom: '4px',
                            color: '#333',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap'
                          }}>
                            {config.name}
                          </div>
                          <div style={{ 
                            fontSize: '11px', 
                            color: '#666',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap'
                          }}>
                            {config.description || '无描述'}
                          </div>
                        </div>
                        <div style={{ 
                          display: 'flex', 
                          gap: '6px', 
                          marginLeft: '8px',
                          flexShrink: 0
                        }}>
                          <Button
                            size="small"
                            icon={<EyeOutlined />}
                            onClick={(e) => {
                              e.stopPropagation();
                              loadPivotConfig(config);
                            }}
                            style={{ 
                              fontSize: '11px',
                              height: '28px',
                              padding: '0 8px'
                            }}
                          >
                            加载
                          </Button>
                          <Button
                            size="small"
                            icon={<EditOutlined />}
                            onClick={(e) => {
                              e.stopPropagation();
                              setEditingConfig(config.config);
                              setConfigModalVisible(true);
                              setLoadConfigModalVisible(false);
                            }}
                            style={{ 
                              fontSize: '11px',
                              height: '28px',
                              padding: '0 8px'
                            }}
                          >
                            编辑
                          </Button>
                          <Button
                            size="small"
                            danger
                            icon={<DeleteOutlined />}
                            onClick={(e) => {
                              e.stopPropagation();
                              deletePivotConfig(config.id || '');
                            }}
                            style={{ 
                              fontSize: '11px',
                              height: '28px',
                              padding: '0 8px'
                            }}
                          >
                            删除
                          </Button>
                        </div>
                      </div>
                    </Card>
                  ));
                })()}
              </div>
            </div>
          ) : (
            <div style={{ textAlign: 'center', padding: '40px 20px' }}>
              <TableOutlined style={{ fontSize: '48px', color: '#d9d9d9', marginBottom: '16px' }} />
              <div style={{ color: '#666' }}>
                暂无保存的配置
              </div>
              <div style={{ fontSize: '12px', color: '#999', marginTop: '8px' }}>
                请先保存一些透视表配置
              </div>
            </div>
          )}
        </div>
      </Modal>

      {/* 值字段配置弹窗 */}
      <Modal
        title="配置值字段聚合"
        open={valueFieldModalVisible}
        onCancel={() => setValueFieldModalVisible(false)}
        footer={null}
      >
        <Form
          form={valueFieldForm}
          layout="vertical"
          initialValues={editingValueField || {}}
          onFinish={(values) => {
            if (currentConfig && editingValueField) {
              const newConfig = { ...currentConfig };
              const existingValueFieldIndex = newConfig.valueFields.findIndex(vf => vf.field === editingValueField.field);
              
              if (existingValueFieldIndex >= 0) {
                newConfig.valueFields[existingValueFieldIndex] = { 
                  ...newConfig.valueFields[existingValueFieldIndex], 
                  ...values 
                };
              } else {
                newConfig.valueFields.push({ 
                  field: editingValueField.field, 
                  aggregation: values.aggregation as any 
                });
              }
              
              setCurrentConfig(newConfig);
              setValueFieldModalVisible(false);
              setEditingValueField(null);
              valueFieldForm.resetFields();
            }
          }}
        >
          <Form.Item
            name="aggregation"
            label="聚合方式"
            rules={[{ required: true, message: '请选择聚合方式' }]}
          >
            <Select placeholder="选择聚合方式">
              <Option value="sum">求和 (Sum)</Option>
              <Option value="count">计数 (Count)</Option>
              <Option value="count_distinct">去重计数 (Count Distinct)</Option>
              <Option value="avg">平均值 (Average)</Option>
              <Option value="max">最大值 (Max)</Option>
              <Option value="min">最小值 (Min)</Option>
            </Select>
          </Form.Item>
          
          <Form.Item
            name="format"
            label="显示格式"
          >
            <Select placeholder="选择显示格式（可选）">
              <Option value="number">数字</Option>
              <Option value="percentage">百分比</Option>
              <Option value="currency">货币</Option>
              <Option value="decimal">小数</Option>
            </Select>
          </Form.Item>
          
          <Form.Item>
            <Space>
              <Button type="primary" htmlType="submit">
                确定
              </Button>
              <Button onClick={() => setValueFieldModalVisible(false)}>
                取消
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>

      {/* 筛选条件配置弹窗 */}
      <Modal
        title={
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <FilterOutlined />
            <span>配置筛选条件</span>
            {editingFilter && (
              <Tag color="blue" style={{ marginLeft: 'auto' }}>
                {availableFields.find(f => f.name === editingFilter.field)?.label || editingFilter.field}
              </Tag>
            )}
          </div>
        }
        open={filterModalVisible}
        onCancel={() => setFilterModalVisible(false)}
        footer={null}
        width={500}
        destroyOnHidden
      >
        <Form
          form={filterForm}
          layout="vertical"
          initialValues={{
            ...editingFilter,
            // 如果是日期范围筛选，确保dateRange字段正确设置
            dateRange: editingFilter?.operator === 'date_between' && editingFilter?.value && editingFilter?.value2 ? 
              [editingFilter.value, editingFilter.value2] : undefined,
            // 确保操作符有默认值，人员名称字段默认使用 contains
            operator: editingFilter?.operator || (editingFilter && isPersonField(editingFilter.field) ? 'contains' : 'equals')
          }}
          onFinish={(values) => {
            if (currentConfig && editingFilter) {
              const newConfig = { ...currentConfig };
              const existingFilterIndex = newConfig.filters.findIndex(f => f.field === editingFilter.field);
              
              // 处理日期范围选择器的值
              let processedValues = { ...values };
              if (values.operator === 'date_between' && values.dateRange) {
                processedValues.value = values.dateRange[0];
                processedValues.value2 = values.dateRange[1];
                delete processedValues.dateRange;
              }
              
              // 构建新的筛选条件
              const newFilter = {
                field: editingFilter.field,
                operator: processedValues.operator,
                value: processedValues.value,
                value2: processedValues.value2
              };
              
              if (existingFilterIndex >= 0) {
                newConfig.filters[existingFilterIndex] = newFilter;
              } else {
                newConfig.filters.push(newFilter);
              }
              
              setCurrentConfig(newConfig);
              setFilterModalVisible(false);
              setEditingFilter(null);
              filterForm.resetFields();
            }
          }}
        >
          {/* 字段信息显示 */}
          {editingFilter && (
            <Alert
              message={`正在配置字段：${availableFields.find(f => f.name === editingFilter.field)?.label || editingFilter.field}`}
              type="info"
              showIcon
              style={{ marginBottom: 16 }}
            />
          )}

          {/* 操作符选择 */}
          <Form.Item
            name="operator"
            label="筛选操作符"
            rules={[{ required: true, message: '请选择筛选操作符' }]}
          >
            <Select 
              placeholder="选择筛选操作符"
              size="large"
              onChange={(value) => {
                // 当操作符改变时，根据新操作符清空相关字段
                if (value === 'date_between') {
                  // 如果切换到日期范围，清空普通输入框和第二个值
                  filterForm.setFieldsValue({
                    value: undefined,
                    value2: undefined
                  });
                } else if (value === 'between') {
                  // 如果切换到介于，清空日期范围
                  filterForm.setFieldsValue({
                    dateRange: undefined
                  });
                } else if (value === 'is_null' || value === 'is_not_null') {
                  // 如果切换到为空/不为空，清空所有输入框
                  filterForm.setFieldsValue({
                    value: undefined,
                    value2: undefined,
                    dateRange: undefined
                  });
                } else {
                  // 其他操作符，清空第二个值和日期范围
                  filterForm.setFieldsValue({
                    value2: undefined,
                    dateRange: undefined
                  });
                }
              }}
            >
              <Option value="equals">等于</Option>
              <Option value="not_equals">不等于</Option>
              <Option value="contains">包含</Option>
              <Option value="not_contains">不包含</Option>
              <Option value="greater_than">大于</Option>
              <Option value="less_than">小于</Option>
              <Option value="between">介于</Option>
              <Option value="date_between">日期范围</Option>
              <Option value="is_null">为空</Option>
              <Option value="is_not_null">不为空</Option>
            </Select>
          </Form.Item>
          
          {/* 动态输入区域 */}
          <Form.Item dependencies={['operator']} noStyle>
            {({ getFieldValue }) => {
              const operator = getFieldValue('operator');
              const isPerson = editingFilter && isPersonField(editingFilter.field);
              
              // 日期范围选择器
              if (operator === 'date_between') {
                return (
                  <Form.Item
                    name="dateRange"
                    label="日期范围"
                    rules={[{ required: true, message: '请选择日期范围' }]}
                  >
                    <RangePicker
                      style={{ width: '100%' }}
                      placeholder={['开始日期', '结束日期']}
                      format="YYYY-MM-DD"
                      allowClear
                      size="large"
                    />
                  </Form.Item>
                );
              }
              
              // 介于操作的两个输入框
              if (operator === 'between') {
                return (
                  <Row gutter={16}>
                    <Col span={12}>
                      <Form.Item
                        name="value"
                        label="最小值"
                        rules={[{ required: true, message: '请输入最小值' }]}
                      >
                        <Input placeholder="请输入最小值" size="large" />
                      </Form.Item>
                    </Col>
                    <Col span={12}>
                      <Form.Item
                        name="value2"
                        label="最大值"
                        rules={[{ required: true, message: '请输入最大值' }]}
                      >
                        <Input placeholder="请输入最大值" size="large" />
                      </Form.Item>
                    </Col>
                  </Row>
                );
              }
              
              // 为空/不为空操作 - 显示提示信息
              if (operator === 'is_null' || operator === 'is_not_null') {
                return (
                  <Alert
                    message={operator === 'is_null' ? '将筛选出空值记录' : '将筛选出非空值记录'}
                    type="success"
                    showIcon
                    style={{ marginBottom: 16 }}
                  />
                );
              }
              
              // 包含/不包含操作符 - 支持多值输入
              if (operator === 'contains' || operator === 'not_contains') {
                return (
                  <Form.Item
                    name="value"
                    label="筛选值"
                    rules={[{ required: true, message: '请输入筛选值' }]}
                    extra={
                      isPerson 
                        ? "支持多个人员名称，用逗号分隔。例如：张三,李四" 
                        : "支持多个值，用逗号分隔。例如：值1,值2,值3"
                    }
                  >
                    <Input.TextArea 
                      placeholder={
                        isPerson 
                          ? "请输入人员名称，多个名称用逗号分隔" 
                          : "请输入筛选值，多个值用逗号分隔"
                      }
                      size="large"
                      style={{ width: '100%' }}
                      rows={3}
                      showCount
                      maxLength={500}
                    />
                  </Form.Item>
                );
              }
              
              // 其他操作符的单个输入框
              if (operator && operator !== 'date_between' && operator !== 'between' && operator !== 'is_null' && operator !== 'is_not_null' && operator !== 'contains' && operator !== 'not_contains') {
                return (
                  <Form.Item
                    name="value"
                    label="筛选值"
                    rules={[{ required: true, message: '请输入筛选值' }]}
                  >
                    <Input 
                      placeholder={
                        isPerson 
                          ? "请输入人员名称" 
                          : "请输入筛选值"
                      }
                      size="large"
                      style={{ width: '100%' }}
                    />
                  </Form.Item>
                );
              }
              
              // 默认状态 - 提示选择操作符
              return (
                <Alert
                  message="请先选择筛选操作符"
                  type="info"
                  showIcon
                  style={{ marginBottom: 16 }}
                />
              );
            }}
          </Form.Item>
          
          {/* 操作按钮 */}
          <Form.Item style={{ marginTop: 24, marginBottom: 0 }}>
            <Row gutter={16}>
              <Col span={12}>
                <Button 
                  type="primary" 
                  htmlType="submit" 
                  size="large"
                  style={{ width: '100%' }}
                >
                  确定
                </Button>
              </Col>
              <Col span={12}>
                <Button 
                  onClick={() => setFilterModalVisible(false)} 
                  size="large"
                  style={{ width: '100%' }}
                >
                  取消
                </Button>
              </Col>
            </Row>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default DataAnalysis; 