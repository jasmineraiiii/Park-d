// Leaflet map with Park'd parking pins. OpenStreetMap tiles, no API key needed.
// markers: [{ id, lat, lng, text, tone: 'ok'|'warn'|'full'|'closed'|'temp'|'home', title, radius? }]
// route: { from: {lat,lng}, to: {lat,lng} } draws a straight-line guide (not a road route).
import React, { useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

const CENTER = [30.7333, 76.7794];

export default function LiveMap({ markers = [], selectedId, onSelect, onMapClick, route, me, className = 'h-72 sm:h-96', fit = true, center }) {
  const el = useRef(null);
  const map = useRef(null);
  const layer = useRef(null);
  const routeLayer = useRef(null);
  const onSelectRef = useRef(onSelect);
  onSelectRef.current = onSelect;
  const clickRef = useRef(onMapClick);
  clickRef.current = onMapClick;

  useEffect(() => {
    map.current = L.map(el.current, { scrollWheelZoom: false, zoomControl: true }).setView(center || CENTER, center ? 15 : 13);
    map.current.on('click', (e) => clickRef.current?.({ lat: e.latlng.lat, lng: e.latlng.lng }));
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19, attribution: '© OpenStreetMap' }).addTo(map.current);
    layer.current = L.layerGroup().addTo(map.current);
    return () => { map.current.remove(); map.current = null; };
  }, []);

  useEffect(() => {
    if (!map.current) return;
    layer.current.clearLayers();
    const pts = [];
    for (const m of markers) {
      if (!Number.isFinite(m.lat) || !Number.isFinite(m.lng)) continue;
      pts.push([m.lat, m.lng]);
      if (m.radius) L.circle([m.lat, m.lng], { radius: m.radius, color: '#2563eb', weight: 1, fillOpacity: 0.1 }).addTo(layer.current);
      const icon = L.divIcon({ className: '', html: `<div class="pk-pin pk-${m.tone || 'ok'}${m.id === selectedId ? ' pk-sel' : ''}">${String(m.text ?? '').replace(/[<>&]/g, '')}</div>`, iconSize: [40, 40], iconAnchor: [20, 24] });
      L.marker([m.lat, m.lng], { icon, title: m.title || '' }).on('click', () => onSelectRef.current?.(m.id)).addTo(layer.current);
    }
    if (me) L.marker([me.lat, me.lng], { icon: L.divIcon({ className: '', html: '<div class="pk-me"></div>', iconSize: [18, 18], iconAnchor: [9, 9] }), title: 'You' }).addTo(layer.current);
    if (fit && pts.length && !route) map.current.fitBounds(L.latLngBounds(pts).pad(0.15), { maxZoom: 15 });
  }, [markers, selectedId, me, fit, route]);

  useEffect(() => {
    if (!map.current) return;
    routeLayer.current?.remove();
    routeLayer.current = null;
    if (!route?.from || !route?.to) return;
    const pts = [[route.from.lat, route.from.lng], [route.to.lat, route.to.lng]];
    routeLayer.current = L.layerGroup([
      L.polyline(pts, { color: '#0284c7', weight: 6, opacity: 0.35, lineCap: 'round', className: 'pk-route' }),
      L.polyline(pts, { color: '#0284c7', weight: 2.5, dashArray: '8 8', opacity: 0.95 }).bindTooltip('Straight-line guide · use Directions for the road route', { sticky: true }),
    ]).addTo(map.current);
    map.current.flyToBounds(L.latLngBounds(pts).pad(0.35), { maxZoom: 16, duration: 0.6 });
  }, [route?.from?.lat, route?.from?.lng, route?.to?.lat, route?.to?.lng]); // eslint-disable-line react-hooks/exhaustive-deps

  return <div ref={el} className={`relative w-full z-0 ${className}`} />;
}
