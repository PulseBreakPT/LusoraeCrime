import { TileLayer } from "react-leaflet";
import {
  MAP_TILE_ATTRIBUTION,
  MAP_TILE_CLASS,
  MAP_TILE_MAX_ZOOM,
  MAP_TILE_URL,
} from "../../lib/mapTiles";

export default function MapBaseLayer() {
  return (
    <TileLayer
      url={MAP_TILE_URL}
      attribution={MAP_TILE_ATTRIBUTION}
      maxZoom={MAP_TILE_MAX_ZOOM}
      className={MAP_TILE_CLASS}
      crossOrigin=""
    />
  );
}
