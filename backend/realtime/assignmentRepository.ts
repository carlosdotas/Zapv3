import { prisma } from '../db';
import type { OrderAssignmentData } from './types';

export async function loadAssignments(activeAssignments: Map<string, OrderAssignmentData>) {
  try {
    const stored = await prisma.assignments.findMany();
    for (const row of stored) {
      try {
        activeAssignments.set(row.order_key, JSON.parse(row.data));
      } catch {
        // registro corrompido é ignorado
      }
    }
    console.log(`[Realtime Assignments] ${activeAssignments.size} atribuições carregadas do banco.`);
  } catch (err) {
    console.error('[Realtime Assignments] Não foi possível carregar as atribuições.', err);
    throw err;
  }

}

export const persistAssignment = (key: string, data: OrderAssignmentData) =>
    prisma.assignments
      .upsert({
        where: { order_key: key },
        create: { order_key: key, data: JSON.stringify(data), assigned_at: data.assignedAt },
        update: { data: JSON.stringify(data), assigned_at: data.assignedAt }
      });


