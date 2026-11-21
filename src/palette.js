// Colours shared by the map, the packets and the UI.
export const INK = '#22312b';

export const PROV_COL = {
  'Balochistan': '#a3c9ab', 'Sindh': '#7fb391', 'Punjab': '#5f9f7a',
  'Khyber Pakhtunkhwa': '#71ab88', 'Gilgit-Baltistan': '#4e8d6a', 'Azad Kashmir': '#8bbd9b'
};

// Packet colours. Red is reserved for cuts and attacks.
export const FLOW = {
  intl: { c: '#f08a00', label: 'International' },
  dom: { c: '#1d4ed8', label: 'Domestic' },
  cdn: { c: '#0891b2', label: 'Local cache (CDN)' },
  sat: { c: '#7c3aed', label: 'Satellite' },
  atk: { c: '#dc2626', label: 'Attack / hijacked' },
  loop: { c: '#d97706', label: 'Routing loop' }
};
