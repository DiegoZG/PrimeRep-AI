type SubscriptionListener = () => void;
const listeners = new Set<SubscriptionListener>();

export function onSubscriptionRequired(listener: SubscriptionListener) {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}

export function notifySubscriptionRequired() {
  for (const listener of listeners) listener();
}
