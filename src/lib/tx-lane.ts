export type TxLaneState = {
  open: boolean;
  done: boolean;
};

let state: TxLaneState = { open: false, done: false };
const listeners = new Set<(s: TxLaneState) => void>();

function emit(next: TxLaneState) {
  state = next;
  listeners.forEach((fn) => fn(state));
}

export function beginTxLane() {
  emit({ open: true, done: false });
}

export function finishTxLane() {
  emit({ open: true, done: true });
}

export function hideTxLane() {
  emit({ open: false, done: false });
}

export function subscribeTxLane(fn: (s: TxLaneState) => void) {
  listeners.add(fn);
  fn(state);
  return () => {
    listeners.delete(fn);
  };
}
