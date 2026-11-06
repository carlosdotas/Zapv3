import { useEffect } from 'react';
import { companyService } from '../services/companyService';
import { driverTrackingClient } from '../services/driverTrackingClient';
import { realtimeAssignmentService } from '../services/realtimeAssignmentService';

export function useOperationalServices(isAuthenticated: boolean): void {
  useEffect(() => { void companyService.refresh(); }, []);

  useEffect(() => {
    if (!isAuthenticated) {
      realtimeAssignmentService.clear();
      driverTrackingClient.disconnect();
      return;
    }
    driverTrackingClient.start();
    const release = realtimeAssignmentService.start();
    return () => {
      release();
      driverTrackingClient.dispose();
    };
  }, [isAuthenticated]);
}
