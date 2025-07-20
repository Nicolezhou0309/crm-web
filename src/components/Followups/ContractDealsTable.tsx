import React from 'react';
import { Table, Button, DatePicker, Select, Input, Tag } from 'antd';
import type { Deal } from './followupTypes';
import dayjs from 'dayjs';

interface Props {
  dealsList: Deal[];
  dealsLoading: boolean;
  onAdd: () => void;
  onEdit: (record: Deal) => void;
  onDelete: (record: Deal) => void;
  isReadOnly?: boolean;
  currentRecord: any;
  communityEnum: any[];
  setDealsList: React.Dispatch<React.SetStateAction<Deal[]>>;
}

export const ContractDealsTable: React.FC<Props> = ({
  dealsList, dealsLoading, onAdd, onEdit, onDelete, isReadOnly = false, communityEnum, setDealsList
}) => (
  <div style={{ width: '100%', minWidth: 0, display: 'flex', flexDirection: 'column', flex: 1 }}>
    <div
      style={{
        background: 'transparent',
        borderRadius: 0,
        padding: '8px 0',
        minHeight: 'auto',
        marginBottom: '8px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        borderBottom: 'none',
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
    <div style={{ flex: 1, minHeight: 0, width: '100%' }}>
      <Table
        dataSource={dealsList}
        loading={dealsLoading}
        size="small"
        pagination={false}
        scroll={{ y: 'calc(100vh - 400px)', x: 600 }}
        columns={[
          {
            title: '签约日期',
            dataIndex: 'contractdate',
            key: 'contractdate',
            width: 100,
            render: (text, record) => {
              if (!isReadOnly && record.isEditing) {
                return (
                  <DatePicker
                    size="small"
                    value={text ? dayjs(text) : undefined}
                    format="YYYY-MM-DD"
                    onChange={(date) => {
                      const newDate = date ? date.format('YYYY-MM-DD') : '';
                      setDealsList((prev: any[]) => prev.map((item: any) =>
                        item.id === record.id
                          ? { ...item, contractdate: newDate }
                          : item
                      ));
                    }}
                    style={{ width: '100%' }}
                  />
                );
              }
              return text ? dayjs(text).format('YYYY-MM-DD') : '-';
            }
          },
          {
            title: '签约社区',
            dataIndex: 'community',
            key: 'community',
            width: 120,
            render: (text, record) => {
              if (!isReadOnly && record.isEditing) {
                return (
                  <Select
                    size="small"
                    value={text}
                    options={communityEnum}
                    placeholder="选择社区"
                    style={{ width: '100%' }}
                    onChange={(value) => {
                      setDealsList((prev: any[]) => prev.map((item: any) =>
                        item.id === record.id
                          ? { ...item, community: value }
                          : item
                      ));
                    }}
                  />
                );
              }
              return text ? <Tag color="blue">{text}</Tag> : '-';
            }
          },
          {
            title: '签约操作编号',
            dataIndex: 'contractnumber',
            key: 'contractnumber',
            width: 140,
            render: (text, record) => {
              if (!isReadOnly && record.isEditing) {
                return (
                  <Input
                    size="small"
                    value={text}
                    placeholder="输入操作编号"
                    onChange={(e) => {
                      setDealsList((prev: any[]) => prev.map((item: any) =>
                        item.id === record.id
                          ? { ...item, contractnumber: e.target.value }
                          : item
                      ));
                    }}
                  />
                );
              }
              return text ? <span style={{ fontWeight: 600, color: '#1890ff' }}>{text}</span> : '-';
            }
          },
          {
            title: '签约房间号',
            dataIndex: 'roomnumber',
            key: 'roomnumber',
            width: 120,
            render: (text, record) => {
              if (!isReadOnly && record.isEditing) {
                return (
                  <Input
                    size="small"
                    value={text}
                    placeholder="输入房间号"
                    onChange={(e) => {
                      setDealsList((prev: any[]) => prev.map((item: any) =>
                        item.id === record.id
                          ? { ...item, roomnumber: e.target.value }
                          : item
                      ));
                    }}
                  />
                );
              }
              return text || '-';
            }
          },
          {
            title: '操作',
            key: 'action',
            width: 100,
            fixed: 'right',
            render: (_, record) => {
              if (isReadOnly) return null;
              if (record.isEditing) {
                return (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <Button
                      type="primary"
                      size="small"
                      onClick={async () => onEdit(record)}
                      style={{ width: '100%', fontSize: 12, height: 24 }}
                    >
                      确认提交
                    </Button>
                    <Button
                      size="small"
                      onClick={() => onDelete(record)}
                      style={{ width: '100%', fontSize: 12, height: 24 }}
                    >
                      取消
                    </Button>
                  </div>
                );
              }
              return (
                <Button
                  size="small"
                  onClick={() => onEdit(record)}
                  style={{ width: '100%', fontSize: 12, height: 24 }}
                >
                  编辑
                </Button>
              );
            }
          }
        ]}
        rowKey="id"
        style={{ backgroundColor: 'transparent', width: '100%', minWidth: 0 }}
        locale={{
          emptyText: dealsLoading ? '加载中...' : '暂无签约记录，点击"新增"按钮添加'
        }}
      />
    </div>
  </div>
); 