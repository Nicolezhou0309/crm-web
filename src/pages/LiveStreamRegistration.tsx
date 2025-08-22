import React from 'react';
import LiveStreamRegistrationBase from '../components/LiveStreamRegistrationBase';
import LiveStreamBanner from '../components/LiveStreamBanner';

const LiveStreamRegistration: React.FC = () => {
  return (
    <div className="page-card">
      <div className="flex justify-between items-center mb-6">
        <h4 className="m-0 font-bold text-gray-800 text-lg">直播报名管理</h4>
      </div>
      <div className="page-table-wrap">
        <LiveStreamBanner />
        <LiveStreamRegistrationBase />
      </div>
    </div>
  );
};

export default LiveStreamRegistration; 