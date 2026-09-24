let generation = 0;

export function invalidateAccountRequests() {
  generation += 1;
  return generation;
}

export function accountRequestGuard() {
  const started = generation;
  return () => started === generation;
}

export function accountGeneration() {
  return generation;
}
