import React from 'react';
import LiveStreamRegistrationBase from '../components/LiveStreamRegistrationBase';
import LiveStreamBanner from '../components/LiveStreamBanner';

const LiveStreamRegistration: React.FC = () => {
  return (
    <div className="page-card">
      <div className="page-header">
      </div>
      <div className="page-table-wrap">
        <LiveStreamBanner />
        <LiveStreamRegistrationBase />
      </div>
    </div>
  );
};

export default LiveStreamRegistration; 