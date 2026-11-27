/** Avoid a ProfileService ↔ RoomsService cycle. Rooms registers the kick. */
type Kick = (playerId: string, keepSession?: string, replacedSession?: string) => void;
let kickFn: Kick = () => {};

export function setAccountKick(fn: Kick) {
  kickFn = fn;
}

/** A rotation targets the session it replaced, even if its notification arrives late. */
export function kickAccount(playerId: string, keepSession?: string, replacedSession?: string) {
  if (!playerId) return;
  try { kickFn(playerId, keepSession, replacedSession); } catch {
    console.error('session kick failed');
  }
}
