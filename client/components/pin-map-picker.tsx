"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { Loader2, MapPin, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import type { PlaceCenter, PlaceOption } from "@/lib/place-types";

interface PinMapPickerProps {
  open: boolean;
  cityContext?: PlaceCenter | null;
  initialValue?: PlaceOption | null;
  onClose: () => void;
  onConfirm: (place: PlaceOption) => void;
}

const DEFAULT_CENTER: [number, number] = [39.5, -98.35];

export default function PinMapPicker({
  open,
  cityContext = null,
  initialValue = null,
  onClose,
  onConfirm,
}: PinMapPickerProps) {
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<L.Map | null>(null);
  const markerRef = useRef<L.CircleMarker | null>(null);

  const [pendingPlace, setPendingPlace] = useState<PlaceOption | null>(initialValue);
  const [isResolvingAddress, setIsResolvingAddress] = useState(false);

  const mapCenter = useMemo<[number, number]>(() => {
    if (initialValue) {
      return [initialValue.latitude, initialValue.longitude];
    }
    if (cityContext) {
      return [cityContext.latitude, cityContext.longitude];
    }
    return DEFAULT_CENTER;
  }, [cityContext, initialValue]);

  const initialZoom = cityContext ?? initialValue ? 12 : 5;

  useEffect(() => {
    if (!open) {
      return;
    }
    setPendingPlace(initialValue);
  }, [initialValue, open]);

  useEffect(() => {
    if (!open || !mapContainerRef.current) {
      return;
    }

    const map = L.map(mapContainerRef.current, {
      center: mapCenter,
      zoom: initialZoom,
      minZoom: 4,
      maxBounds: L.latLngBounds([13, -180], [76, -60]),
      maxBoundsViscosity: 1.0,
      zoomControl: false,
      attributionControl: false,
    });

    // L.tileLayer("https://tile.jawg.io/jawg-sunny/{z}/{x}/{y}{r}.png?access-token={accessToken}", {
    //   maxZoom: 22,
    //   minZoom: 4,
    //   accessToken: process.env.NEXT_PUBLIC_JAWG_API_KEY ?? "",
    // } as L.TileLayerOptions & { accessToken: string }).addTo(map);
    L.tileLayer("https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png", {
      maxZoom: 19,
      minZoom: 4,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/">CARTO</a>',
    }).addTo(map);

    L.control.zoom({ position: "bottomright" }).addTo(map);

    mapRef.current = map;

    map.on("click", async (event: L.LeafletMouseEvent) => {
      const lat = Number(event.latlng.lat.toFixed(6));
      const lng = Number(event.latlng.lng.toFixed(6));
      setIsResolvingAddress(true);

      try {
        const response = await fetch(`/api/places/reverse?lat=${lat}&lon=${lng}`, {
          cache: "no-store",
        });
        const payload = await response.json();

        if (!response.ok || !payload?.place) {
          throw new Error("Reverse lookup failed");
        }

        setPendingPlace(payload.place as PlaceOption);
      } catch {
        const fallbackLabel = `Pinned location (${lat}, ${lng})`;
        setPendingPlace({
          label: fallbackLabel,
          address: fallbackLabel,
          latitude: lat,
          longitude: lng,
        });
      } finally {
        setIsResolvingAddress(false);
      }
    });

    window.setTimeout(() => {
      map.invalidateSize();
    }, 0);

    return () => {
      map.remove();
      mapRef.current = null;
      markerRef.current = null;
    };
  }, [initialZoom, mapCenter, open]);

  useEffect(() => {
    if (!open || !mapRef.current || !pendingPlace) {
      return;
    }

    const map = mapRef.current;
    if (markerRef.current) {
      markerRef.current.setLatLng([pendingPlace.latitude, pendingPlace.longitude]);
    } else {
      markerRef.current = L.circleMarker([pendingPlace.latitude, pendingPlace.longitude], {
        radius: 9,
        color: "#b45309",
        fillColor: "#f59e0b",
        fillOpacity: 0.9,
        weight: 3,
      }).addTo(map);
    }
  }, [open, pendingPlace]);

  if (!open) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-[2000] flex items-center justify-center bg-black/35 p-4 backdrop-blur-sm">
      <div className="w-full max-w-3xl overflow-y-auto rounded-2xl border border-stone-200 bg-white shadow-2xl" style={{ maxHeight: "calc(100vh - 2rem)" }}>
        <div className="flex items-center justify-between border-b border-stone-200 px-4 py-3">
          <div>
            <h3 className="text-base font-semibold text-stone-900">Drop a pin</h3>
            <p className="text-xs text-stone-500">
              {cityContext ? `Map centered near ${cityContext.label}` : "Click anywhere to pin a location."}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full p-1.5 text-stone-500 transition-colors hover:bg-stone-100 hover:text-stone-700"
            aria-label="Close map picker"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div ref={mapContainerRef} className="h-[420px] w-full" />

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-stone-200 px-4 py-3">
          <div className="min-h-6 text-sm text-stone-600">
            {isResolvingAddress ? (
              <span className="inline-flex items-center gap-2">
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                Resolving address...
              </span>
            ) : pendingPlace ? (
              <span className="inline-flex items-center gap-2">
                <MapPin className="h-3.5 w-3.5 text-amber-700" />
                {pendingPlace.label}
              </span>
            ) : (
              "Click on the map to place a pin."
            )}
          </div>

          <div className="flex items-center gap-2">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button
              type="button"
              disabled={!pendingPlace || isResolvingAddress}
              onClick={() => {
                if (!pendingPlace) {
                  return;
                }
                onConfirm(pendingPlace);
                onClose();
              }}
            >
              Use this pin
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
