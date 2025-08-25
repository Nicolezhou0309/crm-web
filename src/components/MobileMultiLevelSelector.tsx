import React, { useState, useEffect } from 'react';
import { 
  Modal, 
  Steps, 
  Button, 
  List, 
  Input, 
  Empty, 
  Spin,
  message 
} from 'antd';
import { 
  SearchOutlined, 
  EnvironmentOutlined, 
  CheckCircleOutlined,
  ArrowLeftOutlined,
  CloseOutlined
} from '@ant-design/icons';
import './MobileMultiLevelSelector.css';

const { Search } = Input;

export interface MultiLevelOption {
  value: string;
  label: string;
  children?: MultiLevelOption[];
}

export interface MobileMultiLevelSelectorProps {
  visible: boolean;
  onClose: () => void;
  onConfirm: (selectedValues: string[]) => void;
  title?: string;
  options: MultiLevelOption[];
  type: 'worklocation' | 'followupresult';
  placeholder?: string;
  loading?: boolean;
}

const MobileMultiLevelSelector: React.FC<MobileMultiLevelSelectorProps> = ({
  visible,
  onClose,
  onConfirm,
  title = '请选择',
  options,
  type,
  placeholder = '搜索...',
  loading = false
}) => {
  const [currentStep, setCurrentStep] = useState(0);
  const [selectedLine, setSelectedLine] = useState<string>('');
  const [selectedStations, setSelectedStations] = useState<string[]>([]);
  const [searchText, setSearchText] = useState('');
  const [filteredOptions, setFilteredOptions] = useState<MultiLevelOption[]>([]);

  // 重置状态
  const resetState = () => {
    setCurrentStep(0);
    setSelectedLine('');
    setSelectedStations([]);
    setSearchText('');
    setFilteredOptions(options);
  };

  // 处理模态框关闭
  const handleClose = () => {
    resetState();
    onClose();
  };

  // 处理确认选择
  const handleConfirm = () => {
    let finalValues: string[] = [];
    
    if (type === 'worklocation') {
      // 工作地点：如果选择了线路，添加该线路下的所有站点
      if (selectedLine) {
        const line = options.find(line => line.value === selectedLine);
        if (line?.children) {
          finalValues = line.children.map(station => station.value);
        }
      }
      // 如果选择了具体站点，添加这些站点
      if (selectedStations.length > 0) {
        finalValues = [...new Set([...finalValues, ...selectedStations])];
      }
    } else {
      // 跟进结果：直接使用选中的值
      finalValues = selectedStations;
    }
    
    if (finalValues.length === 0) {
      message.warning('请至少选择一个选项');
      return;
    }
    
    onConfirm(finalValues);
    handleClose();
  };

  // 处理线路选择
  const handleLineSelect = (lineValue: string) => {
    setSelectedLine(lineValue);
    setCurrentStep(1);
    setSelectedStations([]);
  };

  // 处理站点选择
  const handleStationSelect = (stationValue: string) => {
    setSelectedStations(prev => {
      if (prev.includes(stationValue)) {
        return prev.filter(v => v !== stationValue);
      } else {
        return [...prev, stationValue];
      }
    });
  };

  // 处理返回上一步
  const handleBack = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
      if (currentStep === 1) {
        setSelectedLine('');
        setSelectedStations([]);
      }
    }
  };

  // 搜索功能
  const handleSearch = (value: string) => {
    setSearchText(value);
    if (!value.trim()) {
      setFilteredOptions(options);
      return;
    }
    
    const filtered = options.map(line => {
      const matchingStations = line.children?.filter(station =>
        station.label.toLowerCase().includes(value.toLowerCase()) ||
        line.label.toLowerCase().includes(value.toLowerCase())
      ) || [];
      
      if (matchingStations.length > 0) {
        return {
          ...line,
          children: matchingStations
        };
      }
      return null;
    }).filter(Boolean) as MultiLevelOption[];
    
    setFilteredOptions(filtered);
  };

  // 获取当前步骤的标题
  const getStepTitle = () => {
    if (type === 'worklocation') {
      return currentStep === 0 ? '选择地铁线路' : '选择具体站点';
    } else {
      return currentStep === 0 ? '选择跟进结果分类' : '选择具体结果';
    }
  };

  // 获取当前步骤的选项
  const getCurrentOptions = () => {
    if (currentStep === 0) {
      return filteredOptions;
    } else {
      const line = options.find(line => line.value === selectedLine);
      return line?.children || [];
    }
  };

  // 渲染选项列表
  const renderOptions = () => {
    const currentOptions = getCurrentOptions();
    
    if (currentOptions.length === 0) {
      return (
        <Empty 
          description="暂无数据" 
          image={Empty.PRESENTED_IMAGE_SIMPLE}
          style={{ margin: '40px 0' }}
        />
      );
    }

    if (currentStep === 0) {
      // 渲染线路选项
      return (
        <List
          dataSource={currentOptions}
          renderItem={(line) => (
            <List.Item
              className="selector-list-item"
              onClick={() => handleLineSelect(line.value)}
            >
              <div className="item-content">
                <EnvironmentOutlined className="item-icon" />
                <span className="item-label">{line.label}</span>
                <span className="item-count">
                  {line.children?.length || 0} 个站点
                </span>
              </div>
              <ArrowLeftOutlined className="item-arrow" />
            </List.Item>
          )}
        />
      );
    } else {
      // 渲染站点选项
      return (
        <List
          dataSource={currentOptions}
          renderItem={(station) => {
            const isSelected = selectedStations.includes(station.value);
            return (
              <List.Item
                className={`selector-list-item ${isSelected ? 'selected' : ''}`}
                onClick={() => handleStationSelect(station.value)}
              >
                <div className="item-content">
                  <CheckCircleOutlined 
                    className={`item-icon ${isSelected ? 'selected' : ''}`} 
                  />
                  <span className="item-label">{station.label}</span>
                </div>
                {isSelected && (
                  <CheckCircleOutlined className="check-icon" />
                )}
              </List.Item>
            );
          }}
        />
      );
    }
  };

  // 渲染步骤指示器
  const renderSteps = () => {
    if (type === 'worklocation') {
      const steps = [
        { title: '选择线路', description: selectedLine || '未选择' },
        { title: '选择站点', description: selectedStations.length > 0 ? `${selectedStations.length}个站点` : '未选择' }
      ];
      
      return (
        <Steps 
          current={currentStep} 
          size="small"
          style={{ marginBottom: 16, padding: '0 16px' }}
        >
          {steps.map((step, index) => (
            <Steps.Step 
              key={index}
              title={step.title}
              description={step.description}
            />
          ))}
        </Steps>
      );
    }
    return null;
  };

  // 渲染底部按钮
  const renderBottomButtons = () => {
    if (currentStep === 0) {
      return (
        <Button 
          type="primary" 
          block 
          disabled={!selectedLine}
          onClick={() => setCurrentStep(1)}
        >
          下一步
        </Button>
      );
    } else {
      return (
        <div className="bottom-buttons">
          <Button 
            block 
            onClick={handleBack}
            style={{ flex: 1, marginRight: 8 }}
          >
            返回
          </Button>
          <Button 
            type="primary" 
            block 
            onClick={handleConfirm}
            style={{ flex: 1, marginLeft: 8 }}
          >
            确认选择 ({selectedStations.length})
          </Button>
        </div>
      );
    }
  };

  useEffect(() => {
    if (visible) {
      setFilteredOptions(options);
    }
  }, [visible, options]);

  return (
    <Modal
      title={
        <div className="modal-header">
          <span>{title}</span>
          <CloseOutlined onClick={handleClose} className="close-icon" />
        </div>
      }
      open={visible}
      onCancel={handleClose}
      footer={null}
      width="100%"
      style={{ 
        top: 0, 
        margin: 0, 
        maxWidth: '100vw',
        height: '100vh'
      }}
      bodyStyle={{ 
        padding: 0, 
        height: 'calc(100vh - 55px)',
        display: 'flex',
        flexDirection: 'column'
      }}
      destroyOnClose
    >
      <div className="selector-container">
        {/* 步骤指示器 */}
        {renderSteps()}
        
        {/* 搜索框 */}
        <div className="search-container">
          <Search
            placeholder={placeholder}
            value={searchText}
            onChange={(e) => handleSearch(e.target.value)}
            onSearch={handleSearch}
            allowClear
            size="large"
          />
        </div>
        
        {/* 当前步骤标题 */}
        <div className="step-title">
          {getStepTitle()}
        </div>
        
        {/* 选项列表 */}
        <div className="options-container">
          {loading ? (
            <div className="loading-container">
              <Spin size="large" />
              <div style={{ marginTop: 16 }}>加载中...</div>
            </div>
          ) : (
            renderOptions()
          )}
        </div>
        
        {/* 底部按钮 */}
        <div className="bottom-container">
          {renderBottomButtons()}
        </div>
      </div>
    </Modal>
  );
};

export default MobileMultiLevelSelector;
