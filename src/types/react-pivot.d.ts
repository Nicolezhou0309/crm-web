declare module 'react-pivot/index.jsx' {
  import React from 'react';
  
  interface PivotProps {
    data: any[];
    rows?: string[];
    cols?: string[];
    aggregatorName?: string;
    vals?: string[];
    rendererName?: string;
    [key: string]: any;
  }
  
  const Pivot: React.ComponentClass<PivotProps>;
  export = Pivot;
} 