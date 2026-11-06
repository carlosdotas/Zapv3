export interface AssignmentLike {
  orderId?: string;
  driverId?: string;
  driverName?: string;
  driverPhone?: string;
  vehicleType?: string;
  assignedAt?: number;
  enRoute?: boolean;
  acceptedByDriver?: boolean;
}

export const assignmentStore = new Map<string, AssignmentLike>();
