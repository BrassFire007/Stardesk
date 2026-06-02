import React from 'react';

interface PullToRefreshProps {
  onRefresh: () => Promise<void>;
  children: React.ReactNode;
  disabled?: boolean;
}

export const PullToRefresh: React.FC<PullToRefreshProps> = ({ children }) => {
  return (
    <div className="flex-1 flex flex-col overflow-y-auto overflow-x-hidden scrollbar-hide relative min-h-0">
      <div className="flex-1 flex flex-col min-h-0 overflow-x-hidden">
        {children}
      </div>
    </div>
  );
};
