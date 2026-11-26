// Camera API used by the UI, scenarios and stories: named views, fly-to and the
// auto tour. The globe camera itself lives in globecam.js.
import { flyTo, flying } from './globecam.js';

export { flyTo, VIEWS, updateCamera } from './globecam.js';

const TOUR = ['pakistan', 'karachi', 'sea', 'north', 'far', 'top'];
const tour = { on: false, idx: 0, next: 0 };
export function setTour(on) { tour.on = on; tour.next = 0; }
export const tourOn = () => tour.on;
// Called each frame by main.js.
export function updateTour() { if (tour.on && !flying() && performance.now() > tour.next) { flyTo(TOUR[tour.idx++ % TOUR.length], 3000); tour.next = performance.now() + 8000; } }
