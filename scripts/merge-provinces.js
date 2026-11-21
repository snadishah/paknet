const proj4=require('proj4');const fs=require('fs');const pc=require('polygon-clipping');
const g=JSON.parse(fs.readFileSync('node_modules/@highcharts/map-collection/countries/pk/pk-all.geo.json'));
const t=g['hc-transform'].default;const P=proj4(t.crs,'WGS84');
const inv=(x,y)=>{const X=(x-t.jsonmarginX)/t.jsonres/t.scale+t.xoffset;const Y=t.yoffset-((-y+t.jsonmarginY)/t.jsonres)/t.scale;const q=P.forward([X,Y]);return [+q[0].toFixed(4),+q[1].toFixed(4)];};
const F={};
for(const f of g.features){const geom=f.geometry;const polys=geom.type==='Polygon'?[geom.coordinates]:geom.coordinates;F[f.properties.name]=polys.map(p=>p.map(r=>r.map(pt=>inv(pt[0],pt[1]))));}
console.log(Object.entries(F).map(([k,v])=>k+':'+v.reduce((a,p)=>a+p[0].length,0)).join(' '));
const out={
 'Balochistan':F['Baluchistan'],'Sindh':F['Sind'],
 'Punjab':pc.union(F['Punjab'],F['F.C.T.']),
 'Khyber Pakhtunkhwa':pc.union(F['N.W.F.P.'],F['F.A.T.A.']),
 'Gilgit-Baltistan':F['Northern Areas'],'Azad Kashmir':F['Azad Kashmir']};
for(const k in out) console.log(k,out[k].length,out[k].map(p=>p.length+':'+p[0].length).join(','));
fs.writeFileSync('data/prov_merged.json',JSON.stringify(out));
