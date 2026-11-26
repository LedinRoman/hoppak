/** Avoid a ProfileService ↔ RoomsService cycle. Rooms registers the kick. */
let kickFn: (playerId: string) => void = () => {};

export function setAccountKick(fn: (playerId: string) => void) {
  kickFn = fn;
}

export function kickAccount(playerId: string) {
  if (!playerId) return;
  try { kickFn(playerId); } catch (err) {
    console.error('session kick failed');
  }
}
