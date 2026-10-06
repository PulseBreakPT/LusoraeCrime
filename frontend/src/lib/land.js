// Geografia partilhada com o backend: o modo convidado usa os mesmos
// polígonos de Portugal e corpos de água que o jogo autenticado.
import portugal from "../data/portugal.json";
import water from "../data/water_pt.json";

const ringBbox = (ring) => {
  let minLng=Infinity,minLat=Infinity,maxLng=-Infinity,maxLat=-Infinity;
  for (const point of ring || []) {
    const lng=Number(point?.[0]),lat=Number(point?.[1]);
    if (!Number.isFinite(lng) || !Number.isFinite(lat)) continue;
    minLng=Math.min(minLng,lng); minLat=Math.min(minLat,lat);
    maxLng=Math.max(maxLng,lng); maxLat=Math.max(maxLat,lat);
  }
  return [minLng,minLat,maxLng,maxLat];
};

const loadPolygons = (collection) => {
  const result=[];
  for (const feature of collection?.features || []) {
    const geometry=feature?.geometry;
    if (!geometry) continue;
    const polys=geometry.type==="MultiPolygon"
      ? geometry.coordinates
      : geometry.type==="Polygon" ? [geometry.coordinates] : [];
    for (const rings of polys) {
      if (!rings?.[0]?.length) continue;
      result.push({ bbox:ringBbox(rings[0]), rings });
    }
  }
  return result;
};

const PORTUGAL=loadPolygons(portugal);
const WATER=loadPolygons(water);

const pointInRing = (lng,lat,ring) => {
  let inside=false;
  let j=ring.length-1;
  for (let i=0;i<ring.length;i+=1) {
    const xi=Number(ring[i][0]),yi=Number(ring[i][1]);
    const xj=Number(ring[j][0]),yj=Number(ring[j][1]);
    if ((yi>lat)!==(yj>lat)) {
      const cross=((xj-xi)*(lat-yi))/(yj-yi)+xi;
      if (lng<cross) inside=!inside;
    }
    j=i;
  }
  return inside;
};

const inPolyset = (polyset,lat,lng) => {
  for (const {bbox,rings} of polyset) {
    const [x0,y0,x1,y1]=bbox;
    if (!(x0<=lng&&lng<=x1&&y0<=lat&&lat<=y1)) continue;
    if (!pointInRing(lng,lat,rings[0])) continue;
    const inHole=rings.slice(1).some((ring)=>pointInRing(lng,lat,ring));
    if (!inHole) return true;
  }
  return false;
};

const segmentDistanceM = (lat,lng,ax,ay,bx,by) => {
  const kx=111320*Math.cos(lat*Math.PI/180);
  const ky=110540;
  const px=lng*kx,py=lat*ky,x1=ax*kx,y1=ay*ky,x2=bx*kx,y2=by*ky;
  const dx=x2-x1,dy=y2-y1;
  if (dx===0&&dy===0) return Math.hypot(px-x1,py-y1);
  const t=Math.max(0,Math.min(1,((px-x1)*dx+(py-y1)*dy)/(dx*dx+dy*dy)));
  return Math.hypot(px-(x1+t*dx),py-(y1+t*dy));
};

const distanceToPolysetM = (polyset,lat,lng,margin=.15) => {
  let best=Infinity;
  for (const {bbox,rings} of polyset) {
    const [x0,y0,x1,y1]=bbox;
    if (!(x0-margin<=lng&&lng<=x1+margin&&y0-margin<=lat&&lat<=y1+margin)) continue;
    for (const ring of rings) {
      let j=ring.length-1;
      for (let i=0;i<ring.length;i+=1) {
        best=Math.min(best,segmentDistanceM(lat,lng,ring[j][0],ring[j][1],ring[i][0],ring[i][1]));
        j=i;
      }
    }
  }
  return best;
};

const validPoint = (lat,lng) =>
  Number.isFinite(Number(lat)) && Number.isFinite(Number(lng))
  && Number(lat)>=-90 && Number(lat)<=90 && Number(lng)>=-180 && Number(lng)<=180;

export function isInPortugal(lat,lng) {
  if (!validPoint(lat,lng)) return false;
  return inPolyset(PORTUGAL,Number(lat),Number(lng));
}

export function isInWaterBody(lat,lng) {
  if (!validPoint(lat,lng)) return false;
  return inPolyset(WATER,Number(lat),Number(lng));
}

export function isOnLand(lat,lng) {
  return isInPortugal(lat,lng) && !isInWaterBody(lat,lng);
}

export function distanceToBoundaryM(lat,lng) {
  if (!validPoint(lat,lng)) return Infinity;
  return distanceToPolysetM(PORTUGAL,Number(lat),Number(lng),.15);
}

export function isValidHqLocation(lat,lng,minInlandM=120) {
  if (!isOnLand(lat,lng)) return false;
  return distanceToBoundaryM(Number(lat),Number(lng)) >= Number(minInlandM||0);
}
