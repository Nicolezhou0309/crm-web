import React from 'react';
import { Alert } from 'antd';
import type { FrequencyControlState } from '../types';

interface FrequencyAlertProps {
  cooldown: FrequencyControlState['cooldown'];
}

export const FrequencyAlert: React.FC<FrequencyAlertProps> = ({ cooldown }) => {
  if (!cooldown) {
    return null;
  }

  return (
    <Alert
      type="warning"
      showIcon
      banner
      style={{ marginBottom: 16, fontSize: 14, fontWeight: 'normal', textAlign: 'left' }}
      message={
        <span>
          {cooldown.message}
          {cooldown.secondsLeft > 0 && (
            <span style={{ marginLeft: 8, fontWeight: 'bold' }}>
              (剩余 {cooldown.secondsLeft} 秒)
            </span>
          )}
        </span>
      }
    />
  );
};
