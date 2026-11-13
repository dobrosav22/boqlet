/**
 * Set once the tab is on its way to the sign-in page (signed out with a reason, or sent to sign in).
 * Requests still in flight then fail too and the session is gone: neither their 401s nor the auth
 * gate's own redirect may send the tab elsewhere and lose the reason (F01 §10, found in FE-020's run).
 */
let leaving = false;

export const isLeaving = () => leaving;
export const startLeaving = () => {
  leaving = true;
};
