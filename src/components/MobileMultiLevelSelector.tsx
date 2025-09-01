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
      // 🆕 优化：同时选择路线和站点时，以站点选择为准
      if (selectedStations.length > 0) {
        // 如果选择了具体站点，优先使用站点选择
        const stationNames = selectedStations.map(station => station.replace(/站$/, ''));
        finalValues = stationNames;
        
        console.log('🔍 [MobileMultiLevelSelector] 使用站点选择:', {
          selectedStations,
          finalValues,
          reason: '用户选择了具体站点，优先使用站点选择'
        });
      } else if (selectedLine) {
        // 🆕 优化：如果没有选择具体站点，但选择了线路，则选择该线路下的所有站点
        const line = options.find(line => line.value === selectedLine);
        if (line?.children) {
          // 🆕 修复：确保传递的是站点名称，不是带"站"字的完整名称
          finalValues = line.children.map(station => station.value.replace(/站$/, ''));
          
          console.log('🔍 [MobileMultiLevelSelector] 使用线路选择（所有站点）:', {
            selectedLine,
            finalValues,
            reason: '用户选择了线路但未选择具体站点，自动选择该线路下的所有站点'
          });
        }
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

  // 🆕 新增：处理直接选择站点（跳过线路选择）
  const handleDirectStationSelect = (stationValue: string) => {
    setSelectedStations(prev => {
      if (prev.includes(stationValue)) {
        return prev.filter(v => v !== stationValue);
      } else {
        return [...prev, stationValue];
      }
    });
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
    } else if (currentStep === 1) {
      const line = options.find(line => line.value === selectedLine);
      return line?.children || [];
    } else {
      // 🆕 新增：直接选择站点模式下，所有站点都作为选项
      return options.reduce((acc: MultiLevelOption[], line) => {
        if (line.children) {
          acc.push(...line.children);
        }
        return acc;
      }, []);
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
      // 🆕 优化：渲染线路选项，并添加"直接选择站点"选项
      return (
        <>
          {/* 直接选择站点选项 */}
          <List.Item
            className="selector-list-item direct-station-option"
            onClick={() => setCurrentStep(2)} // 直接跳转到站点选择步骤
            style={{ 
              borderBottom: '1px solid #f0f0f0',
              backgroundColor: '#fafafa'
            }}
          >
            <div className="item-content">
              <EnvironmentOutlined className="item-icon" style={{ color: '#1890ff' }} />
              <span className="item-label" style={{ color: '#1890ff', fontWeight: '500' }}>
                直接选择站点
              </span>
              <span className="item-count" style={{ color: '#666' }}>
                跳过线路选择
              </span>
            </div>
            <ArrowLeftOutlined className="item-arrow" />
          </List.Item>
          
          {/* 线路选项 */}
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
        </>
      );
    } else if (currentStep === 1) {
      // 渲染特定线路下的站点选项
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
    } else {
      // 🆕 新增：渲染所有站点选项（直接选择模式）
      return (
        <List
          dataSource={currentOptions}
          renderItem={(station) => {
            const isSelected = selectedStations.includes(station.value);
            return (
              <List.Item
                className={`selector-list-item ${isSelected ? 'selected' : ''}`}
                onClick={() => handleDirectStationSelect(station.value)}
              >
                <div className="item-content">
                  <CheckCircleOutlined 
                    className={`item-icon ${isSelected ? 'selected' : ''}`} 
                  />
                  <span className="item-label">{station.label}</span>
                  <span className="item-count" style={{ fontSize: '12px', color: '#666' }}>
                    {options.find(line => line.children?.some(s => s.value === station.value))?.label}
                  </span>
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
      let steps = [];
      
      if (currentStep === 0) {
        // 第一步：选择方式
        steps = [
          { title: '选择方式', description: '选择筛选方式' },
          { title: '选择线路', description: '未选择' },
          { title: '选择站点', description: '未选择' }
        ];
      } else if (currentStep === 1) {
        // 第二步：选择线路
        steps = [
          { title: '选择方式', description: '已选择' },
          { title: '选择线路', description: selectedLine || '未选择' },
          { title: '选择站点', description: '未选择' }
        ];
      } else {
        // 第三步：选择站点
        const step1Title = selectedLine ? '选择线路' : '直接选择';
        const step1Desc = selectedLine || '跳过线路选择';
        steps = [
          { title: '选择方式', description: '已选择' },
          { title: step1Title, description: step1Desc },
          { title: '选择站点', description: selectedStations.length > 0 ? `${selectedStations.length}个站点` : '未选择' }
        ];
      }
      
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
    } else if (currentStep === 1) {
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
    } else {
      // 第三步：直接选择站点模式
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
