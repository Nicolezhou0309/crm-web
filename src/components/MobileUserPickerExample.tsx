import React, { useState } from 'react';
import { Space, Card } from 'antd-mobile';
import MobileUserPicker from './MobileUserPicker';

const MobileUserPickerExample: React.FC = () => {
  const [singleValue, setSingleValue] = useState<string[]>([]);
  const [multipleValue, setMultipleValue] = useState<string[]>([]);

  return (
    <div style={{ padding: '16px' }}>
      <Space direction="vertical" block>
        <Card title="单选模式示例">
          <MobileUserPicker
            value={singleValue}
            onChange={setSingleValue}
            placeholder="请选择一个成员"
            buttonText="选择成员"
            title="选择成员"
            multiple={false}
          />
          <div style={{ marginTop: '8px', fontSize: '12px', color: '#666' }}>
            已选择：{singleValue.length > 0 ? singleValue.join(', ') : '无'}
          </div>
        </Card>

        <Card title="多选模式示例">
          <MobileUserPicker
            value={multipleValue}
            onChange={setMultipleValue}
            placeholder="请选择多个成员"
            buttonText="选择多个成员"
            title="选择多个成员"
            multiple={true}
          />
          <div style={{ marginTop: '8px', fontSize: '12px', color: '#666' }}>
            已选择：{multipleValue.length > 0 ? multipleValue.join(', ') : '无'}
          </div>
        </Card>

        <Card title="禁用状态示例">
          <MobileUserPicker
            value={[]}
            onChange={() => {}}
            placeholder="禁用状态"
            buttonText="禁用的选择器"
            title="禁用状态"
            disabled={true}
          />
        </Card>
      </Space>
    </div>
  );
};

export default MobileUserPickerExample;
