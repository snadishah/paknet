const topo=require('topojson-client');const fs=require('fs');
const w=JSON.parse(fs.readFileSync('node_modules/world-atlas/countries-10m.json'));
const fc=topo.feature(w,w.objects.countries);
const want={'586':'PAK','356':'IND','004':'AFG','364':'IRN','156':'CHN','512':'OMN','762':'TJK','784':'ARE'};
const out={};
for(const f of fc.features){ if(want[f.id]) out[want[f.id]]={name:f.properties.name,geom:f.geometry}; }
console.log(Object.keys(out), out.PAK.geom.type, out.PAK.geom.coordinates.length);
// clip to bbox and simplify by rounding
const bb=[44,12,92,46];
function clipRing(r){return r.filter(p=>p[0]>bb[0]-3&&p[0]<bb[2]+3&&p[1]>bb[1]-3&&p[1]<bb[3]+3).map(p=>[+p[0].toFixed(3),+p[1].toFixed(3)])}
const res={};
for(const k in out){const g=out[k].geom;const polys=g.type==='Polygon'?[g.coordinates]:g.coordinates;
 res[k]=polys.map(poly=>poly.map(clipRing).filter(r=>r.length>3)).filter(p=>p.length);}
fs.writeFileSync('data/countries.json',JSON.stringify(res));
const cities=require('all-the-cities');const pk=cities.filter(c=>c.country==='PK');
console.log('PK cities',pk.length, pk.filter(c=>c.population>50000).length, pk.filter(c=>c.population>20000).length);
const sel=pk.filter(c=>c.population>=0).map(c=>({n:c.name,lat:+c.loc.coordinates[1].toFixed(4),lon:+c.loc.coordinates[0].toFixed(4),p:c.population,a:c.adminCode}));
sel.sort((a,b)=>b.p-a.p);
fs.writeFileSync('data/cities.json',JSON.stringify(sel));
console.log(sel.slice(0,40).map(c=>c.n+':'+c.p+':'+c.a).join(', '));
console.log(fs.statSync('countries.json').size);
