// Minimal event bus. The simulation emits, rendering and UI listen, so the
// simulation never imports either of them.
//   edge:cut (edge)          edge:restore (edge)
//   topology:changed ({ cutEdges, algo, T })
//   view:changed (key)
const handlers = new Map();

export function on(name, fn) {
  if (!handlers.has(name)) handlers.set(name, []);
  handlers.get(name).push(fn);
  return () => handlers.set(name, handlers.get(name).filter(f => f !== fn));
}

export function emit(name, ...args) {
  for (const fn of handlers.get(name) || []) fn(...args);
}
