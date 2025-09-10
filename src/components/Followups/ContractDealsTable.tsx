import React, { useState, useEffect } from 'react';
import { Table, Button, DatePicker, Select, Input, Tag, message } from 'antd';
import type { Deal } from './followupTypes';
import dayjs from 'dayjs';
import { supabase } from '../../supaClient';
import { toBeijingDateStr } from '../../utils/timeUtils';

// 添加样式来隐藏测量行
const tableStyles = `
  .contract-deals-table .ant-table-measure-row {
    display: none ;
  }
  
  .contract-deals-table .ant-table-tbody > tr.ant-table-measure-row {
    display: none ;
  }
  
  .contract-deals-table .ant-table-tbody > tr.ant-table-measure-row > td {
    display: none ;
  }
`;

interface Props {
  dealsList: Deal[];
  dealsLoading: boolean;
  onAdd: () => void;
  onEdit?: (record: Deal) => void;
  onDelete?: (record: Deal) => void;
  isReadOnly?: boolean;
  currentRecord: any;
  communityEnum: any[];
  setDealsList?: React.Dispatch<React.SetStateAction<Deal[]>>;
  // 新增：是否显示编辑功能
  showEditActions?: boolean;
  // 新增：重新关联成交记录的回调
  onReassociate?: (record: Deal) => void;
}

export const ContractDealsTable: React.FC<Props> = ({
  dealsList, dealsLoading, onAdd, onEdit, onDelete, isReadOnly = false, communityEnum, setDealsList, showEditActions = true, onReassociate, currentRecord
}) => {
  const [contractRecordsData, setContractRecordsData] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  // 获取contract_records的详细数据
  const fetchContractRecordsData = async () => {
    if (!dealsList || dealsList.length === 0) {
      setContractRecordsData([]);
      return;
    }

    setLoading(true);
    try {
      // 获取所有有效的contract_records ID
      const contractRecordIds = dealsList
        .filter(deal => deal.contract_records)
        .map(deal => deal.contract_records);

      if (contractRecordIds.length === 0) {
        setContractRecordsData([]);
        return;
      }

      // 从contract_records表获取详细数据
      const { data, error } = await supabase
        .from('contract_records')
        .select('*')
        .in('id', contractRecordIds);

      if (error) {
        console.error('获取签约记录详情失败:', error);
        message.error('获取签约记录详情失败');
        return;
      }

      // 将contract_records数据与deals数据合并，只处理有有效contract_records的记录
      const mergedData = dealsList
        .filter(deal => deal.contract_records) // 只处理有contract_records的记录
        .map(deal => {
          const contractRecord = data?.find(cr => cr.id === deal.contract_records);
          return {
            ...deal,
            // 从contract_records获取的字段
            operation_date: contractRecord?.operation_date,
            external_community_name: contractRecord?.external_community_name,
            business_number: contractRecord?.business_number,
            room_number: contractRecord?.room_number,
            contract_period: contractRecord?.contract_period,
            deposit: contractRecord?.deposit,
            contract_type_detail: contractRecord?.contract_type_detail,
            sales_name: contractRecord?.sales_name,
            contract_type: contractRecord?.contract_type,
            official_price: contractRecord?.official_price,
          };
        });

      setContractRecordsData(mergedData);
    } catch (error) {
      console.error('获取签约记录详情异常:', error);
      message.error('获取签约记录详情异常');
    } finally {
      setLoading(false);
    }
  };

  // 当dealsList变化时重新获取数据
  useEffect(() => {
    fetchContractRecordsData();
  }, [dealsList]);

  return (
  <div style={{ 
    width: '100%', 
    height: '100%',
    display: 'flex', 
    flexDirection: 'column'
  }}>
    {/* 添加样式来隐藏测量行 */}
    <style dangerouslySetInnerHTML={{ __html: tableStyles }} />
    
    <div
      style={{
        background: 'transparent',
        borderRadius: 0,
        padding: '8px 0',
        marginBottom: '8px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        borderBottom: 'none',
        flexShrink: 0, // 不收缩
      }}
    >
      <div style={{ fontWeight: 500, fontSize: 14, color: '#666', display: 'flex', alignItems: 'center' }}>
        <span style={{ marginRight: 8 }}>📊 签约记录</span>
        <span style={{ fontSize: 14, color: '#999', fontWeight: 400 }}>(共 {dealsList.length} 条记录)</span>
      </div>
      {!isReadOnly && (
        <Button
          type="primary"
          size="small"
          style={{ height: 28, borderRadius: 4, fontWeight: 500, marginRight: 0, fontSize: 14 }}
          onClick={onAdd}
        >
          新增
        </Button>
      )}
    </div>
    <div style={{ 
      flex: 1,
      overflow: 'auto', // 允许滚动
      minHeight: 0 // 允许flex子项收缩
    }}>
      <Table
          dataSource={contractRecordsData}
          loading={dealsLoading || loading}
          size="small"
          pagination={false}
          scroll={{ 
            x: 'max-content' // 只保留水平滚动
          }}
          style={{ 
            backgroundColor: 'transparent', 
            width: '100%'
          }}
        tableLayout="fixed" // 添加固定表格布局
        columns={[
          {
            title: '签约日期',
            dataIndex: 'operation_date',
            key: 'operation_date',
            width: 100,
            ellipsis: true, // 添加省略号处理
            render: (text) => {
              return text ? dayjs(text).format('YYYY-MM-DD') : '-';
            }
          },
          {
            title: '签约社区',
            dataIndex: 'external_community_name',
            key: 'external_community_name',
            width: 120,
            ellipsis: true, // 添加省略号处理
            render: (text) => {
              return text ? <Tag color="blue">{text}</Tag> : '-';
            }
          },
          {
            title: '签约类型',
            dataIndex: 'contract_type_detail',
            key: 'contract_type_detail',
            width: 120,
            render: (text) => {
              return text || '-';
            }
          },
          {
            title: '签约操作编号',
            dataIndex: 'business_number',
            key: 'business_number',
            width: 140,
            ellipsis: true, // 添加省略号处理
            render: (text) => {
              return text ? <span style={{ fontWeight: 600, color: '#1890ff' }}>{text}</span> : '-';
            }
          },
          {
            title: '签约房间号',
            dataIndex: 'room_number',
            key: 'room_number',
            width: 120,
            ellipsis: true, // 添加省略号处理
            render: (text) => {
              return text || '-';
            }
          },
          {
            title: '销售姓名',
            dataIndex: 'sales_name',
            key: 'sales_name',
            width: 100,
            render: (text) => {
              return text || '-';
            }
          },
          {
            title: '租期',
            dataIndex: 'contract_period',
            key: 'contract_period',
            width: 80,
            render: (period) => {
              return period ? `${period}个月` : '-';
            }
          },
          {
            title: '官方价格',
            dataIndex: 'official_price',
            key: 'official_price',
            width: 100,
            render: (price) => {
              return price ? `¥${price.toLocaleString()}` : '-';
            }
          },
          {
            title: '押金',
            dataIndex: 'deposit',
            key: 'deposit',
            width: 100,
            render: (deposit) => {
              return deposit ? `¥${deposit.toLocaleString()}` : '-';
            }
          },
          {
            title: '操作',
            key: 'action',
            width: 80, // 调整宽度以容纳按钮
            fixed: 'right',
            ellipsis: false, // 操作列不需要省略号
            render: (_, record) => {
              if (isReadOnly || !showEditActions) return null;
              
              return (
                <div style={{ 
                  display: 'flex', 
                  flexDirection: 'column', 
                  gap: '6px',
                  alignItems: 'stretch'
                }}>
                  <Button
                    size="small"
                    onClick={() => onEdit?.(record)}
                    style={{ 
                      width: '100%', 
                      fontSize: 12, 
                      height: 28,
                      borderRadius: 4,
                      borderColor: '#1890ff',
                      color: '#1890ff',
                      backgroundColor: 'transparent',
                      fontWeight: 500,
                      transition: 'all 0.2s ease'
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.backgroundColor = '#e6f7ff';
                      e.currentTarget.style.borderColor = '#40a9ff';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.backgroundColor = 'transparent';
                      e.currentTarget.style.borderColor = '#1890ff';
                    }}
                  >
                    编辑
                  </Button>
                </div>
              );
            }
          }
        ]}
        rowKey="id"
        locale={{
          emptyText: dealsLoading ? '加载中...' : '暂无签约记录，\n点击"新增"按钮添加'
        }}
      />
    </div>
  </div>
  );
};