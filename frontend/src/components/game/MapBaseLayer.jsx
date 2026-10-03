import { useEffect } from "react";
import { TileLayer, useMapEvents } from "react-leaflet";
import {
  MAP_TILE_ATTRIBUTION,
  MAP_TILE_CLASS,
  MAP_TILE_MAX_ZOOM,
  MAP_TILE_URL,
  mapDetailForZoom,
} from "../../lib/mapTiles";

function MapReadabilityController() {
  const map = useMapEvents({
    zoomend: () => {
      map.getContainer().dataset.mapDetail = mapDetailForZoom(map.getZoom());
    },
  });

  useEffect(() => {
    const container = map.getContainer();
    const sync = () => {
      container.dataset.mapDetail = mapDetailForZoom(map.getZoom());
    };
    sync();
    map.on("zoom", sync);
    return () => map.off("zoom", sync);
  }, [map]);

  return null;
}

export default function MapBaseLayer() {
  return (
    <>
      <MapReadabilityController />
      <TileLayer
        url={MAP_TILE_URL}
        attribution={MAP_TILE_ATTRIBUTION}
        maxZoom={MAP_TILE_MAX_ZOOM}
        className={MAP_TILE_CLASS}
        crossOrigin=""
      />
    </>
  );
}
