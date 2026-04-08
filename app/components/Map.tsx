"use client";

import { MapContainer, TileLayer, Marker, Popup, useMap } from "react-leaflet";
import L from "leaflet";
import { useEffect } from "react";

function AutoFit({ leaderboard }: any) {
  const map = useMap();

  useEffect(() => {
    const points = leaderboard
      .filter((t: any) => t.lastLat && t.lastLng)
      .map((t: any) => [t.lastLat, t.lastLng]);

    if (points.length > 0) {
      map.fitBounds(points, { padding: [50, 50] });
    }
  }, [leaderboard, map]);

  return null;
}

export default function Map({ leaderboard }: any) {
  useEffect(() => {
    delete (L.Icon.Default.prototype as any)._getIconUrl;
    L.Icon.Default.mergeOptions({
      iconUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png",
      iconRetinaUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png",
      shadowUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png",
    });
  }, []);

  if (!leaderboard) return null;

  return (
    <MapContainer
      key={leaderboard.length}
      center={[51.3397, 12.3731]}
      zoom={13}
      scrollWheelZoom
      style={{ height: "100%", width: "100%" }}
    >
      <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
      <AutoFit leaderboard={leaderboard} />

      {leaderboard.map((t: any) =>
        t.lastLat && t.lastLng ? (
          <Marker
            key={t.team + "-" + t.lastLat + "-" + t.lastLng}
            position={[t.lastLat, t.lastLng]}
          >
            <Popup>
              {t.team}: {t.score}P
            </Popup>
          </Marker>
        ) : null
      )}
    </MapContainer>
  );
}