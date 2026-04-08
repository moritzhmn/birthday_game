"use client";

import { MapContainer, TileLayer, Marker, Popup, useMap, CircleMarker } from "react-leaflet";
import L from "leaflet";
import { useEffect } from "react";

function AutoFit({ points }: { points: [number, number][] }) {
  const map = useMap();
  useEffect(() => {
    if (points.length > 0) map.fitBounds(points, { padding: [50, 50] });
  }, [points, map]);
  return null;
}

export default function Map({ leaderboard, meeting, player }: any) {
  useEffect(() => {
    delete (L.Icon.Default.prototype as any)._getIconUrl;
    L.Icon.Default.mergeOptions({
      iconUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png",
      iconRetinaUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png",
      shadowUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png",
    });
  }, []);

  const points: [number, number][] = [
    ...leaderboard.filter((t: any) => t.lastLat && t.lastLng).map((t: any) => [t.lastLat, t.lastLng]),
    ...(player ? [[player.lat, player.lng]] : []),
    ...(meeting ? [[meeting.lat, meeting.lng]] : [])
  ];

  return (
    <MapContainer
      center={points.length > 0 ? points[0] : [53.5511, 9.9937]}
      zoom={13}
      scrollWheelZoom
      style={{ height: "100%", width: "100%" }}
    >
      <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
      <AutoFit points={points} />

      {leaderboard.map((t: any) =>
        t.lastLat && t.lastLng ? (
          <CircleMarker key={t.team} center={[t.lastLat, t.lastLng]} pathOptions={{ color: t.color }} radius={10}>
            <Popup>{t.team}: {t.score}P</Popup>
          </CircleMarker>
        ) : null
      )}

      {meeting && <Marker position={[meeting.lat, meeting.lng]}><Popup>Treffpunkt</Popup></Marker>}
      {player && <CircleMarker center={[player.lat, player.lng]} pathOptions={{ color: "black" }} radius={8}><Popup>Du</Popup></CircleMarker>}
    </MapContainer>
  );
}