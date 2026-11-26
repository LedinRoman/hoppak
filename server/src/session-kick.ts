/** Avoid a ProfileService ↔ RoomsService cycle. Rooms registers the kick. */
let kickFn: (playerId: string, sessionId?: string) => void = () => {};

export function setAccountKick(fn: (playerId: string, sessionId?: string) => void) {
  kickFn = fn;
}

/** Close sockets of this account. sessionId, when set, is the new login and is left open. */
export function kickAccount(playerId: string, sessionId?: string) {
  if (!playerId) return;
  try { kickFn(playerId, sessionId); } catch (err) {
    console.error('session kick failed');
  }
}
