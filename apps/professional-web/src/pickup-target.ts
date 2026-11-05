export function isPickupForProfessional(call: { professionalId: string }, userId: string) {
  return call.professionalId === userId;
}
