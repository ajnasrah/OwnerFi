'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Script from 'next/script';
import { BuyerAdminView } from '@/lib/view-models';
import { CityRadiusSearch } from '@/components/admin/CityRadiusSearch';

declare global {
  interface Window {
    google: typeof google.maps extends infer T ? { maps: T } : never;
  }
}

interface CityCoordinates {
  lat: number;
  lng: number;
  city: string;
  state: string;
  formattedAddress: string;
}

interface BuyerMapData {
  name: string;
  city: string;
  state: string;
  email: string;
  phone: string;
  isAvailable: boolean;
}

export default function AdminBuyers() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [buyers, setBuyers] = useState<BuyerAdminView[]>([]);
  const [selectedBuyers, setSelectedBuyers] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState(false);
  const [selectAll, setSelectAll] = useState(false);

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalBuyers, setTotalBuyers] = useState(0);

  // Search state
  const [searchCity, setSearchCity] = useState<CityCoordinates | null>(null);
  const [searchRadius, setSearchRadius] = useState(30);
  const [searchState, setSearchState] = useState<string | null>(null);

  // Sort state
  const [sortBy, setSortBy] = useState<string>('joined');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  // Export state
  const [showExportDropdown, setShowExportDropdown] = useState(false);
  const [exporting, setExporting] = useState(false);
  const exportDropdownRef = useRef<HTMLDivElement>(null);

  // Tab state
  const [activeTab, setActiveTab] = useState<'table' | 'map'>('table');
  const [mapFilter, setMapFilter] = useState<'available' | 'all'>('available');
  const [allBuyersForMap, setAllBuyersForMap] = useState<BuyerAdminView[]>([]);
  const [loadingMap, setLoadingMap] = useState(false);
  const [mapsLoaded, setMapsLoaded] = useState(false);
  const [mapInitialized, setMapInitialized] = useState(false);
  const [geocodingProgress, setGeocodingProgress] = useState('');
  const mapRef = useRef<google.maps.Map | null>(null);
  const mapContainerRef = useRef<HTMLDivElement>(null);

  // Check if Google Maps is already loaded
  useEffect(() => {
    if (window.google?.maps) {
      setMapsLoaded(true);
    }
  }, []);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (exportDropdownRef.current && !exportDropdownRef.current.contains(event.target as Node)) {
        setShowExportDropdown(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    if (status === 'loading') return;
    if (status === 'unauthenticated' || (session?.user as { role?: string } | undefined)?.role !== 'admin') {
      router.push('/');
    }
    // Note: loadBuyers is called by the other useEffect that watches status
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, session, router]);

  const loadBuyers = async (page = 1) => {
    try {
      setLoading(true);

      // Build query params
      const params = new URLSearchParams({
        page: page.toString(),
      });

      // Add location filter if searching by city
      if (searchCity) {
        params.append('lat', searchCity.lat.toString());
        params.append('lng', searchCity.lng.toString());
        params.append('radius', searchRadius.toString());
      }

      // Add state filter if searching by state
      if (searchState) {
        params.append('state', searchState);
      }

      // Add sort parameters
      if (sortBy) {
        params.append('sortBy', sortBy);
        params.append('sortOrder', sortOrder);
      }

      const response = await fetch(`/api/admin/buyers?${params.toString()}`);
      if (response.ok) {
        const data = await response.json();
        setBuyers(data.buyers || []);
        setTotalPages(data.totalPages || 1);
        setCurrentPage(data.currentPage || 1);
        setTotalBuyers(data.total || 0);
      }
    } catch (error) {
      console.error('Error loading buyers:', error);
    } finally {
      setLoading(false);
    }
  };

  // Reload buyers when search filters, sort, or page changes
  useEffect(() => {
    if (status === 'authenticated') {
      loadBuyers(currentPage);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchCity, searchRadius, searchState, sortBy, sortOrder, currentPage, status]);

  // Reset to page 1 when search filters change
  useEffect(() => {
    setCurrentPage(1);
    setSelectedBuyers(new Set());
    setSelectAll(false);
  }, [searchCity, searchRadius, searchState]);

  const toggleSelectBuyer = (buyerId: string) => {
    const newSelected = new Set(selectedBuyers);
    if (newSelected.has(buyerId)) {
      newSelected.delete(buyerId);
    } else {
      newSelected.add(buyerId);
    }
    setSelectedBuyers(newSelected);
    setSelectAll(newSelected.size === buyers.length);
  };

  const handleSelectAll = () => {
    if (selectAll) {
      setSelectedBuyers(new Set());
      setSelectAll(false);
    } else {
      // Select only buyers on current page
      const allBuyerIds = new Set(buyers.map(b => b.id));
      setSelectedBuyers(allBuyerIds);
      setSelectAll(true);
    }
  };

  const handleSearch = (
    cityData: CityCoordinates | null,
    radius: number,
    state: string | null
  ) => {
    setSearchCity(cityData);
    setSearchRadius(radius);
    setSearchState(state);
    setCurrentPage(1); // Reset to first page
  };

  const handlePageChange = (newPage: number) => {
    setCurrentPage(newPage);
    setSelectedBuyers(new Set());
    setSelectAll(false);
  };

  const handleSort = (column: string) => {
    // Sorting is disabled when location filter is active (results are sorted by distance)
    if (searchCity) return;

    if (sortBy === column) {
      // Toggle sort order if clicking the same column
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      // Set new column with default desc order
      setSortBy(column);
      setSortOrder('desc');
    }
    setCurrentPage(1); // Reset to first page when sorting
  };

  // Sort indicator component
  const SortIndicator = ({ column }: { column: string }) => {
    // When location filter is active, sorting is by distance - hide indicators
    if (searchCity) {
      return null;
    }
    if (sortBy !== column) {
      return (
        <svg className="w-4 h-4 text-slate-500 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4" />
        </svg>
      );
    }
    return sortOrder === 'asc' ? (
      <svg className="w-4 h-4 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
      </svg>
    ) : (
      <svg className="w-4 h-4 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
      </svg>
    );
  };

  // Load all buyers for map view
  const loadAllBuyersForMap = async () => {
    setLoadingMap(true);
    try {
      let allBuyers: BuyerAdminView[] = [];
      let page = 1;
      let hasMore = true;

      while (hasMore) {
        const response = await fetch(`/api/admin/buyers?page=${page}`);
        if (!response.ok) break;
        const data = await response.json();
        allBuyers = [...allBuyers, ...(data.buyers || [])];
        hasMore = page < data.totalPages;
        page++;
      }

      setAllBuyersForMap(allBuyers);
    } catch (error) {
      console.error('Error loading buyers for map:', error);
    } finally {
      setLoadingMap(false);
    }
  };

  // Load map data when switching to map tab
  useEffect(() => {
    if (activeTab === 'map' && allBuyersForMap.length === 0 && !loadingMap) {
      loadAllBuyersForMap();
    }
  }, [activeTab, allBuyersForMap.length, loadingMap]);

  // Filter buyers for map based on selection
  const filteredMapBuyers = mapFilter === 'available'
    ? allBuyersForMap.filter(b => b.isAvailableForPurchase !== false && !b.purchasedBy)
    : allBuyersForMap;

  // Initialize map when Google Maps is loaded and we have data
  const initializeMap = useCallback(async () => {
    if (!window.google || !mapContainerRef.current || mapInitialized) return;
    if (filteredMapBuyers.length === 0) return;

    setMapInitialized(true);

    const { Map, InfoWindow } = window.google.maps;
    const geocoder = new window.google.maps.Geocoder();

    const map = new Map(mapContainerRef.current, {
      zoom: 4,
      center: { lat: 39.8283, lng: -98.5795 },
      mapTypeControl: true,
      streetViewControl: false,
    });
    mapRef.current = map;

    const infoWindow = new InfoWindow();
    const bounds = new window.google.maps.LatLngBounds();

    // Group buyers by city to reduce geocoding calls
    const locationGroups: Record<string, { city: string; state: string; buyers: BuyerMapData[] }> = {};
    filteredMapBuyers.forEach(b => {
      const city = b.preferredCity || b.city || '';
      const state = b.preferredState || b.state || '';
      const key = `${city},${state}`.toLowerCase();
      if (!locationGroups[key]) {
        locationGroups[key] = { city, state, buyers: [] };
      }
      locationGroups[key].buyers.push({
        name: `${b.firstName || ''} ${b.lastName || ''}`.trim(),
        city: city,
        state: state,
        email: b.email || '',
        phone: b.phone || '',
        isAvailable: b.isAvailableForPurchase !== false && !b.purchasedBy
      });
    });

    const locations = Object.values(locationGroups);
    let markersAdded = 0;

    // Geocode each unique location
    for (let i = 0; i < locations.length; i++) {
      const loc = locations[i];
      setGeocodingProgress(`Mapping ${i + 1}/${locations.length} cities...`);

      try {
        const address = `${loc.city}, ${loc.state}, USA`;
        const result = await new Promise<google.maps.GeocoderResult[] | null>((resolve) => {
          geocoder.geocode({ address }, (results, status) => {
            if (status === 'OK' && results) {
              resolve(results);
            } else {
              resolve(null);
            }
          });
        });

        if (result && result[0]) {
          const position = result[0].geometry.location;

          loc.buyers.forEach((buyer, idx) => {
            // Small offset for multiple buyers in same city
            const offset = idx * 0.008;
            const markerPos = {
              lat: position.lat() + offset,
              lng: position.lng() + (idx % 2 === 0 ? offset : -offset)
            };

            const marker = new window.google.maps.Marker({
              position: markerPos,
              map,
              icon: {
                path: window.google.maps.SymbolPath.CIRCLE,
                scale: 10,
                fillColor: buyer.isAvailable ? '#10b981' : '#ef4444',
                fillOpacity: 0.9,
                strokeColor: buyer.isAvailable ? '#059669' : '#dc2626',
                strokeWeight: 2,
              },
              title: buyer.name
            });

            marker.addListener('click', () => {
              infoWindow.setContent(`
                <div style="font-family: system-ui; min-width: 180px; padding: 4px;">
                  <h3 style="font-size: 14px; font-weight: 600; margin: 0 0 8px 0; color: #1e293b;">${buyer.name || 'Unknown'}</h3>
                  <p style="font-size: 12px; color: #64748b; margin: 4px 0;"><b>Location:</b> ${loc.city}, ${loc.state}</p>
                  <p style="font-size: 12px; color: #64748b; margin: 4px 0;"><b>Email:</b> ${buyer.email}</p>
                  <p style="font-size: 12px; color: #64748b; margin: 4px 0;"><b>Phone:</b> ${buyer.phone || 'N/A'}</p>
                  <span style="display: inline-block; padding: 2px 8px; border-radius: 12px; font-size: 11px; font-weight: 600; margin-top: 6px; background: ${buyer.isAvailable ? '#dcfce7' : '#fee2e2'}; color: ${buyer.isAvailable ? '#166534' : '#991b1b'};">
                    ${buyer.isAvailable ? 'Available' : 'Referred Out'}
                  </span>
                </div>
              `);
              infoWindow.open(map, marker);
            });

            bounds.extend(markerPos);
            markersAdded++;
          });
        }
      } catch (e) {
        console.error('Geocoding error:', e);
      }

      // Small delay between geocoding requests
      await new Promise(r => setTimeout(r, 100));
    }

    setGeocodingProgress(`${markersAdded} buyers mapped`);

    if (markersAdded > 0) {
      map.fitBounds(bounds);
    }
  }, [filteredMapBuyers, mapInitialized]);

  // Trigger map init when Google Maps is loaded and we switch to map tab
  useEffect(() => {
    if (mapsLoaded && activeTab === 'map' && !loadingMap && filteredMapBuyers.length > 0 && !mapInitialized) {
      initializeMap();
    }
  }, [mapsLoaded, activeTab, loadingMap, filteredMapBuyers, mapInitialized, initializeMap]);

  // Reset map when filter changes
  useEffect(() => {
    if (mapRef.current && mapContainerRef.current) {
      // Clear the container for Google Maps
      mapContainerRef.current.innerHTML = '';
      mapRef.current = null;
      setMapInitialized(false);
      setGeocodingProgress('');
    }
  }, [mapFilter]);

  const deleteBuyers = async () => {
    if (selectedBuyers.size === 0) return;

    const confirmMsg = `Are you sure you want to delete ${selectedBuyers.size} buyer(s)? This action cannot be undone.`;
    if (!confirm(confirmMsg)) return;

    setDeleting(true);
    try {
      const response = await fetch('/api/admin/buyers', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ buyerIds: Array.from(selectedBuyers) })
      });

      if (response.ok) {
        const result = await response.json();
        alert(`Successfully deleted ${result.deletedCount} buyer(s)`);
        setSelectedBuyers(new Set());
        setSelectAll(false);
        loadBuyers(currentPage);
      } else {
        const error = await response.json();
        alert(`Error: ${error.error}`);
      }
    } catch (error) {
      console.error('Error deleting buyers:', error);
      alert('Failed to delete buyers');
    } finally {
      setDeleting(false);
    }
  };

  // Generate HTML map with buyer locations (uses free OpenStreetMap - no API key needed)
  const generateMapHtml = (buyersData: BuyerMapData[], title: string): string => {
    const markers = buyersData.map((buyer, index) => ({
      ...buyer,
      id: index
    }));

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title} - OwnerFi Buyer Leads Map</title>
  <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
  <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; }
    #map { height: 100vh; width: 100%; padding-top: 50px; }
    .header {
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      z-index: 1000;
      background: linear-gradient(135deg, #1e293b 0%, #0f172a 100%);
      padding: 12px 24px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      box-shadow: 0 2px 10px rgba(0,0,0,0.3);
    }
    .header h1 { color: white; font-size: 18px; font-weight: 600; }
    .header .stats { color: #94a3b8; font-size: 14px; }
    .header .progress { color: #10b981; font-size: 12px; }
    .legend {
      position: fixed;
      bottom: 24px;
      left: 24px;
      z-index: 1000;
      background: white;
      padding: 16px;
      border-radius: 12px;
      box-shadow: 0 4px 12px rgba(0,0,0,0.15);
    }
    .legend h4 { font-size: 13px; color: #1e293b; margin-bottom: 10px; }
    .legend-item { display: flex; align-items: center; gap: 8px; margin: 6px 0; font-size: 12px; color: #64748b; }
    .legend-dot { width: 12px; height: 12px; border-radius: 50%; }
    .legend-dot.available { background: #10b981; }
    .legend-dot.referred { background: #ef4444; }
    .popup-content h3 { font-size: 14px; margin-bottom: 6px; color: #1e293b; }
    .popup-content p { font-size: 12px; color: #64748b; margin: 3px 0; }
    .popup-content .status {
      display: inline-block;
      padding: 2px 8px;
      border-radius: 12px;
      font-size: 11px;
      font-weight: 600;
      margin-top: 6px;
    }
    .popup-content .available { background: #dcfce7; color: #166534; }
    .popup-content .referred { background: #fee2e2; color: #991b1b; }
  </style>
</head>
<body>
  <div class="header">
    <h1>${title}</h1>
    <div>
      <div class="stats">${buyersData.length} buyer leads</div>
      <div class="progress" id="progress"></div>
    </div>
  </div>

  <div id="map"></div>

  <div class="legend">
    <h4>Legend</h4>
    <div class="legend-item">
      <div class="legend-dot available"></div>
      <span>Available Lead</span>
    </div>
    <div class="legend-item">
      <div class="legend-dot referred"></div>
      <span>Referred Out</span>
    </div>
  </div>

  <script>
    const buyers = ${JSON.stringify(markers)};

    // Initialize map centered on US
    const map = L.map('map').setView([39.8283, -98.5795], 4);

    // Add OpenStreetMap tiles (free, no API key)
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap contributors'
    }).addTo(map);

    const allCoords = [];
    let markersAdded = 0;
    const progressEl = document.getElementById('progress');

    // Create custom marker icons using circle markers (more reliable)
    function getMarkerColor(isAvailable) {
      return isAvailable ? '#10b981' : '#ef4444';
    }

    // Geocode using free Nominatim API
    async function geocode(city, state) {
      try {
        const query = encodeURIComponent(city + ", " + state + ", USA");
        const response = await fetch(
          "https://nominatim.openstreetmap.org/search?format=json&limit=1&q=" + query
        );
        if (!response.ok) return null;
        const data = await response.json();
        if (data && data.length > 0) {
          return { lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon) };
        }
      } catch (e) {
        console.error("Geocode error:", e);
      }
      return null;
    }

    // Add markers with geocoding
    async function addMarkers() {
      for (let i = 0; i < buyers.length; i++) {
        const buyer = buyers[i];
        progressEl.textContent = "Geocoding " + (i + 1) + " of " + buyers.length + "...";

        const coords = await geocode(buyer.city, buyer.state);

        if (coords && coords.lat && coords.lng) {
          const statusClass = buyer.isAvailable ? 'available' : 'referred';
          const statusText = buyer.isAvailable ? 'Available' : 'Referred Out';

          // Use circle markers (simpler, more reliable)
          const marker = L.circleMarker([coords.lat, coords.lng], {
            radius: 10,
            fillColor: getMarkerColor(buyer.isAvailable),
            color: buyer.isAvailable ? '#059669' : '#dc2626',
            weight: 2,
            opacity: 1,
            fillOpacity: 0.8
          }).addTo(map);

          marker.bindPopup(
            '<div class="popup-content">' +
            '<h3>' + buyer.name + '</h3>' +
            '<p><strong>Location:</strong> ' + buyer.city + ', ' + buyer.state + '</p>' +
            '<p><strong>Email:</strong> ' + buyer.email + '</p>' +
            '<p><strong>Phone:</strong> ' + (buyer.phone || 'N/A') + '</p>' +
            '<span class="status ' + statusClass + '">' + statusText + '</span>' +
            '</div>'
          );

          allCoords.push([coords.lat, coords.lng]);
          markersAdded++;

          // Update progress with markers found
          progressEl.textContent = "Geocoding " + (i + 1) + "/" + buyers.length + " (" + markersAdded + " found)";
        }

        // Delay to respect Nominatim rate limits (1 req/sec)
        await new Promise(r => setTimeout(r, 1000));
      }

      progressEl.textContent = markersAdded + " of " + buyers.length + " locations mapped";

      // Fit bounds to all markers
      if (allCoords.length > 0) {
        const bounds = L.latLngBounds(allCoords);
        map.fitBounds(bounds, { padding: [50, 50], maxZoom: 12 });
      }
    }

    // Start loading markers
    addMarkers();
  </script>
</body>
</html>`;
  };

  // Export map function
  const exportMap = async (availableOnly: boolean) => {
    setExporting(true);
    setShowExportDropdown(false);

    try {
      // Fetch all buyers (without pagination)
      const params = new URLSearchParams();

      // Add current search filters if any
      if (searchCity) {
        params.append('lat', searchCity.lat.toString());
        params.append('lng', searchCity.lng.toString());
        params.append('radius', searchRadius.toString());
      }
      if (searchState) {
        params.append('state', searchState);
      }

      // Fetch all pages
      let allBuyers: BuyerAdminView[] = [];
      let page = 1;
      let hasMore = true;

      while (hasMore) {
        params.set('page', page.toString());
        const response = await fetch(`/api/admin/buyers?${params.toString()}`);

        if (!response.ok) throw new Error('Failed to fetch buyers');

        const data = await response.json();
        allBuyers = [...allBuyers, ...(data.buyers || [])];
        hasMore = page < data.totalPages;
        page++;
      }

      // Filter by availability if needed
      let buyersToExport = allBuyers;
      if (availableOnly) {
        buyersToExport = allBuyers.filter(b =>
          b.isAvailableForPurchase !== false && !b.purchasedBy
        );
      }

      // Transform to map data
      const mapData: BuyerMapData[] = buyersToExport.map(buyer => ({
        name: `${buyer.firstName || ''} ${buyer.lastName || ''}`.trim() || 'Unknown',
        city: buyer.preferredCity || buyer.city || 'Unknown',
        state: buyer.preferredState || buyer.state || 'Unknown',
        email: buyer.email || '',
        phone: buyer.phone || '',
        isAvailable: buyer.isAvailableForPurchase !== false && !buyer.purchasedBy
      }));

      const title = availableOnly ? 'Available Buyer Leads' : 'All Buyer Leads';
      const html = generateMapHtml(mapData, title);

      // Download as HTML file
      const blob = new Blob([html], { type: 'text/html' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `buyer-leads-map-${availableOnly ? 'available' : 'all'}-${new Date().toISOString().split('T')[0]}.html`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      alert(`Exported ${mapData.length} buyer${mapData.length !== 1 ? 's' : ''} to map. Open the downloaded HTML file in your browser.`);

    } catch (error) {
      console.error('Export error:', error);
      alert('Failed to export map. Please try again.');
    } finally {
      setExporting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-900 p-8">
        <div className="text-center text-white">Loading buyers...</div>
      </div>
    );
  }

  return (
    <div className="h-screen overflow-hidden bg-slate-900 flex flex-col">
      <div className="flex-1 overflow-y-auto p-8">
        <div className="max-w-7xl mx-auto relative">
        {/* Header */}
        <div className="mb-6">
          <Link href="/admin" className="text-emerald-400 hover:text-emerald-300 mb-4 inline-block">
            ← Back to Admin Dashboard
          </Link>
          <h1 className="text-3xl font-bold text-white mb-2">Manage Buyers</h1>
          <p className="text-slate-400">
            Total: {totalBuyers} buyer{totalBuyers !== 1 ? 's' : ''}
          </p>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 mb-6">
          <button
            onClick={() => setActiveTab('table')}
            className={`px-6 py-3 rounded-lg font-semibold transition-all flex items-center gap-2 ${
              activeTab === 'table'
                ? 'bg-emerald-600 text-white shadow-lg'
                : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
            }`}
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h16M4 18h16" />
            </svg>
            Table View
          </button>
          <button
            onClick={() => setActiveTab('map')}
            className={`px-6 py-3 rounded-lg font-semibold transition-all flex items-center gap-2 ${
              activeTab === 'map'
                ? 'bg-emerald-600 text-white shadow-lg'
                : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
            }`}
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
            </svg>
            Map View
          </button>
        </div>

        {activeTab === 'table' ? (
          <>
        {/* Search Component */}
        <CityRadiusSearch onSearch={handleSearch} className="mb-6" />

        {/* Actions Bar */}
        <div className="bg-slate-800 rounded-lg p-5 mb-6 flex items-center justify-between shadow-lg">
          <div className="flex items-center gap-6">
            <label className="flex items-center gap-3 text-white cursor-pointer hover:text-emerald-400 transition-colors">
              <input
                type="checkbox"
                checked={selectAll}
                onChange={handleSelectAll}
                className="w-5 h-5 rounded border-slate-600 bg-slate-700 text-emerald-500 focus:ring-2 focus:ring-emerald-500 cursor-pointer"
              />
              <span className="font-medium">Select All ({buyers.length})</span>
            </label>
            {selectedBuyers.size > 0 && (
              <span className="px-3 py-1 bg-emerald-500/20 text-emerald-400 rounded-full font-semibold text-sm">
                {selectedBuyers.size} selected
              </span>
            )}
          </div>

          <div className="flex items-center gap-3">
            {/* Export Map Dropdown */}
            <div className="relative" ref={exportDropdownRef}>
              <button
                onClick={() => setShowExportDropdown(!showExportDropdown)}
                disabled={exporting}
                className="px-4 py-2 rounded-lg font-semibold bg-emerald-600 hover:bg-emerald-700 text-white transition-all hover:scale-105 flex items-center gap-2 shadow-md"
              >
                {exporting ? (
                  <>
                    <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                    Exporting...
                  </>
                ) : (
                  <>
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
                    </svg>
                    Export Map
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </>
                )}
              </button>

              {showExportDropdown && (
                <div className="absolute right-0 mt-2 w-56 bg-slate-700 rounded-lg shadow-xl border border-slate-600 overflow-hidden z-50">
                  <button
                    onClick={() => exportMap(true)}
                    className="w-full px-4 py-3 text-left text-white hover:bg-slate-600 transition-colors flex items-center gap-3"
                  >
                    <div className="w-3 h-3 rounded-full bg-emerald-500"></div>
                    <div>
                      <div className="font-medium">Available Only</div>
                      <div className="text-xs text-slate-400">Not referred out</div>
                    </div>
                  </button>
                  <button
                    onClick={() => exportMap(false)}
                    className="w-full px-4 py-3 text-left text-white hover:bg-slate-600 transition-colors flex items-center gap-3 border-t border-slate-600"
                  >
                    <div className="w-3 h-3 rounded-full bg-blue-500"></div>
                    <div>
                      <div className="font-medium">All Buyers</div>
                      <div className="text-xs text-slate-400">Include referred</div>
                    </div>
                  </button>
                </div>
              )}
            </div>

            <button
              onClick={() => loadBuyers(currentPage)}
              className="px-4 py-2 rounded-lg font-semibold bg-slate-700 hover:bg-slate-600 text-white transition-all hover:scale-105 flex items-center gap-2"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              Refresh
            </button>
            <button
              onClick={deleteBuyers}
              disabled={selectedBuyers.size === 0 || deleting}
              className={`px-5 py-2 rounded-lg font-semibold transition-all ${
                selectedBuyers.size > 0
                  ? 'bg-red-600 hover:bg-red-700 text-white hover:scale-105 shadow-lg'
                  : 'bg-slate-700 text-slate-500 cursor-not-allowed'
              }`}
            >
              {deleting ? 'Deleting...' : `Delete Selected (${selectedBuyers.size})`}
            </button>
          </div>
        </div>

        {/* Buyers Table */}
        <div className="bg-slate-800 rounded-lg overflow-hidden shadow-xl">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gradient-to-r from-slate-700 to-slate-600 text-white">
                <tr>
                  <th className="p-4 text-left w-12">
                    <input
                      type="checkbox"
                      checked={selectAll}
                      onChange={handleSelectAll}
                      className="w-5 h-5 rounded border-slate-500 bg-slate-600 text-emerald-500 focus:ring-2 focus:ring-emerald-500 cursor-pointer"
                    />
                  </th>
                  <th
                    className={`p-4 text-left font-semibold uppercase text-xs tracking-wider select-none transition-colors ${
                      searchCity ? '' : 'cursor-pointer hover:bg-slate-600/50'
                    }`}
                    onClick={() => handleSort('name')}
                  >
                    <div className="flex items-center gap-2">
                      Name
                      <SortIndicator column="name" />
                    </div>
                  </th>
                  <th
                    className={`p-4 text-left font-semibold uppercase text-xs tracking-wider select-none transition-colors ${
                      searchCity ? '' : 'cursor-pointer hover:bg-slate-600/50'
                    }`}
                    onClick={() => handleSort('email')}
                  >
                    <div className="flex items-center gap-2">
                      Email
                      <SortIndicator column="email" />
                    </div>
                  </th>
                  <th
                    className={`p-4 text-left font-semibold uppercase text-xs tracking-wider select-none transition-colors ${
                      searchCity ? '' : 'cursor-pointer hover:bg-slate-600/50'
                    }`}
                    onClick={() => handleSort('phone')}
                  >
                    <div className="flex items-center gap-2">
                      Phone
                      <SortIndicator column="phone" />
                    </div>
                  </th>
                  <th
                    className={`p-4 text-left font-semibold uppercase text-xs tracking-wider select-none transition-colors ${
                      searchCity ? '' : 'cursor-pointer hover:bg-slate-600/50'
                    }`}
                    onClick={() => handleSort('location')}
                  >
                    <div className="flex items-center gap-2">
                      Location
                      <SortIndicator column="location" />
                    </div>
                  </th>
                  <th
                    className={`p-4 text-center font-semibold uppercase text-xs tracking-wider select-none transition-colors ${
                      searchCity ? '' : 'cursor-pointer hover:bg-slate-600/50'
                    }`}
                    onClick={() => handleSort('matched')}
                  >
                    <div className="flex items-center justify-center gap-2">
                      Matched
                      <SortIndicator column="matched" />
                    </div>
                  </th>
                  <th
                    className={`p-4 text-center font-semibold uppercase text-xs tracking-wider select-none transition-colors ${
                      searchCity ? '' : 'cursor-pointer hover:bg-slate-600/50'
                    }`}
                    onClick={() => handleSort('liked')}
                  >
                    <div className="flex items-center justify-center gap-2">
                      Liked
                      <SortIndicator column="liked" />
                    </div>
                  </th>
                  <th
                    className={`p-4 text-left font-semibold uppercase text-xs tracking-wider select-none transition-colors ${
                      searchCity ? '' : 'cursor-pointer hover:bg-slate-600/50'
                    }`}
                    onClick={() => handleSort('joined')}
                  >
                    <div className="flex items-center gap-2">
                      Joined
                      <SortIndicator column="joined" />
                    </div>
                  </th>
                  <th className="p-4 text-left font-semibold uppercase text-xs tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-700/50">
                {buyers.map((buyer) => (
                  <tr key={buyer.id} className="hover:bg-slate-700/50 transition-all duration-150 hover:shadow-md">
                    <td className="p-4">
                      <input
                        type="checkbox"
                        checked={selectedBuyers.has(buyer.id)}
                        onChange={() => toggleSelectBuyer(buyer.id)}
                        className="w-5 h-5 rounded border-slate-600 bg-slate-700 text-emerald-500 focus:ring-2 focus:ring-emerald-500 cursor-pointer"
                      />
                    </td>
                    <td className="p-4">
                      <div className="text-white font-medium">
                        {buyer.firstName || buyer.lastName
                          ? `${buyer.firstName || ''} ${buyer.lastName || ''}`.trim()
                          : 'N/A'}
                      </div>
                    </td>
                    <td className="p-4">
                      <div className="text-slate-300 text-sm">{buyer.email}</div>
                    </td>
                    <td className="p-4">
                      <div className="text-slate-300 text-sm">{buyer.phone || 'N/A'}</div>
                    </td>
                    <td className="p-4">
                      <div className="text-slate-300 text-sm">
                        {(buyer.preferredCity || buyer.city) && (buyer.preferredState || buyer.state)
                          ? `${buyer.preferredCity || buyer.city}, ${buyer.preferredState || buyer.state}`
                          : 'N/A'}
                      </div>
                    </td>
                    <td className="p-4 text-center">
                      <span className="inline-flex items-center justify-center bg-blue-500/20 text-blue-400 px-3 py-1.5 rounded-full font-semibold text-sm min-w-[3rem]">
                        {buyer.matchedPropertiesCount || 0}
                      </span>
                    </td>
                    <td className="p-4 text-center">
                      <span className="inline-flex items-center justify-center bg-pink-500/20 text-pink-400 px-3 py-1.5 rounded-full font-semibold text-sm min-w-[3rem]">
                        ❤️ {buyer.likedPropertiesCount || 0}
                      </span>
                    </td>
                    <td className="p-4">
                      <div className="text-slate-300 text-sm">
                        {(() => {
                          if (!buyer.createdAt) return 'N/A';
                          const ts = buyer.createdAt as { toDate?: () => Date; _seconds?: number } | string | Date;
                          // Handle Firestore Timestamp with toDate() method
                          if (typeof ts === 'object' && typeof ts.toDate === 'function') {
                            return new Date(ts.toDate()).toLocaleDateString();
                          }
                          // Handle serialized Firestore timestamp { _seconds, _nanoseconds }
                          if (typeof ts === 'object' && typeof ts._seconds === 'number') {
                            return new Date(ts._seconds * 1000).toLocaleDateString();
                          }
                          // Handle ISO string or other date formats
                          const date = new Date(ts);
                          return isNaN(date.getTime()) ? 'N/A' : date.toLocaleDateString();
                        })()}
                      </div>
                    </td>
                    <td className="p-4">
                      <Link
                        href={`/admin/buyers/preview/${buyer.id}`}
                        className="inline-flex items-center gap-1 text-emerald-400 hover:text-emerald-300 font-semibold text-sm transition-colors hover:underline"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                        </svg>
                        Preview
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {buyers.length === 0 && (
              <div className="p-12 text-center">
                <div className="flex flex-col items-center gap-3">
                  <svg className="w-16 h-16 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                  </svg>
                  <div className="text-slate-400 text-lg font-medium">
                    {searchCity || searchState ? 'No buyers found matching your search criteria' : 'No buyers registered yet'}
                  </div>
                  <div className="text-slate-500 text-sm">
                    {searchCity || searchState ? 'Try adjusting your search filters' : 'Buyers will appear here once they register'}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Pagination Controls */}
        {totalPages > 1 && (
          <div className="mt-6 flex items-center justify-between bg-slate-800 rounded-lg p-5 shadow-lg">
            <div className="text-slate-300 font-medium">
              Showing <span className="text-emerald-400 font-semibold">{((currentPage - 1) * 100) + 1}</span> to <span className="text-emerald-400 font-semibold">{Math.min(currentPage * 100, totalBuyers)}</span> of <span className="text-emerald-400 font-semibold">{totalBuyers}</span> buyers
            </div>

            <div className="flex gap-2">
              <button
                onClick={() => handlePageChange(currentPage - 1)}
                disabled={currentPage === 1}
                className={`px-5 py-2 rounded-lg font-semibold transition-all flex items-center gap-2 ${
                  currentPage === 1
                    ? 'bg-slate-700 text-slate-500 cursor-not-allowed'
                    : 'bg-emerald-600 hover:bg-emerald-700 text-white hover:scale-105 shadow-md'
                }`}
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
                Previous
              </button>

              <div className="flex gap-1.5">
                {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                  let pageNum;
                  if (totalPages <= 5) {
                    pageNum = i + 1;
                  } else if (currentPage <= 3) {
                    pageNum = i + 1;
                  } else if (currentPage >= totalPages - 2) {
                    pageNum = totalPages - 4 + i;
                  } else {
                    pageNum = currentPage - 2 + i;
                  }

                  return (
                    <button
                      key={pageNum}
                      onClick={() => handlePageChange(pageNum)}
                      className={`px-4 py-2 rounded-lg font-semibold transition-all min-w-[2.5rem] ${
                        currentPage === pageNum
                          ? 'bg-emerald-500 text-white shadow-md scale-105'
                          : 'bg-slate-700 text-slate-300 hover:bg-slate-600 hover:scale-105'
                      }`}
                    >
                      {pageNum}
                    </button>
                  );
                })}
              </div>

              <button
                onClick={() => handlePageChange(currentPage + 1)}
                disabled={currentPage === totalPages}
                className={`px-5 py-2 rounded-lg font-semibold transition-all flex items-center gap-2 ${
                  currentPage === totalPages
                    ? 'bg-slate-700 text-slate-500 cursor-not-allowed'
                    : 'bg-emerald-600 hover:bg-emerald-700 text-white hover:scale-105 shadow-md'
                }`}
              >
                Next
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </button>
            </div>
          </div>
        )}
          </>
        ) : (
          /* Map View */
          <>
            {/* Load Google Maps only if not already loaded */}
            {!mapsLoaded && (
              <Script
                src={`https://maps.googleapis.com/maps/api/js?key=${process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY}&libraries=marker`}
                onLoad={() => setMapsLoaded(true)}
                strategy="afterInteractive"
              />
            )}

            <div className="bg-slate-800 rounded-lg overflow-hidden shadow-xl">
              {/* Map Controls */}
              <div className="p-4 border-b border-slate-700 flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <span className="text-white font-medium">Show:</span>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setMapFilter('available')}
                      className={`px-4 py-2 rounded-lg font-medium transition-all flex items-center gap-2 ${
                        mapFilter === 'available'
                          ? 'bg-emerald-600 text-white'
                          : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                      }`}
                    >
                      <div className="w-3 h-3 rounded-full bg-emerald-400"></div>
                      Available Only
                    </button>
                    <button
                      onClick={() => setMapFilter('all')}
                      className={`px-4 py-2 rounded-lg font-medium transition-all flex items-center gap-2 ${
                        mapFilter === 'all'
                          ? 'bg-emerald-600 text-white'
                          : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                      }`}
                    >
                      <div className="w-3 h-3 rounded-full bg-blue-400"></div>
                      All Buyers
                    </button>
                  </div>
                </div>
                <div className="text-slate-400 text-sm">
                  {loadingMap ? 'Loading buyers...' : geocodingProgress || `${filteredMapBuyers.length} buyers`}
                </div>
              </div>

              {/* Map Container */}
              <div className="relative" style={{ height: 'calc(100vh - 280px)' }}>
                {(loadingMap || !mapsLoaded) ? (
                  <div className="absolute inset-0 flex items-center justify-center bg-slate-900">
                    <div className="text-center">
                      <svg className="w-12 h-12 animate-spin text-emerald-500 mx-auto mb-4" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                      </svg>
                      <div className="text-white">{!mapsLoaded ? 'Loading Google Maps...' : 'Loading buyer data...'}</div>
                    </div>
                  </div>
                ) : (
                  <div ref={mapContainerRef} className="w-full h-full" />
                )}

                {/* Legend */}
                <div className="absolute bottom-4 left-4 bg-white rounded-lg shadow-lg p-4 z-[1000]">
                  <h4 className="text-sm font-semibold text-slate-800 mb-2">Legend</h4>
                  <div className="flex items-center gap-2 text-sm text-slate-600 mb-1">
                    <div className="w-3 h-3 rounded-full bg-emerald-500"></div>
                    <span>Available Lead</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm text-slate-600">
                    <div className="w-3 h-3 rounded-full bg-red-500"></div>
                    <span>Referred Out</span>
                  </div>
                </div>
              </div>
            </div>
          </>
        )}
        </div>
      </div>
    </div>
  );
}