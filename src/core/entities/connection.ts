import type { ID, ISODateString } from '../types/common';

export interface Connection {
  id: ID;
  studentId: string;
  leaderId: string;
  assignedByRole: string;
  createdAt: ISODateString;
}
