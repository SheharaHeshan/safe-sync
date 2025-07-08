import React, { useState, useEffect, useRef } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Polygon, Polyline, useMap, useMapEvents, Circle, Tooltip } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import icon from 'leaflet/dist/images/marker-icon.png';
import iconShadow from 'leaflet/dist/images/marker-shadow.png';
import './App.css';

// Fix for default marker icons in React-Leaflet
let DefaultIcon = L.icon({
  iconUrl: icon,
  shadowUrl: iconShadow,
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41]
});

L.Marker.prototype.options.icon = DefaultIcon;

// Global constants
const GALLE_CENTER = [6.0535, 80.2210];
const DEFAULT_ZOOM = 14;
const SEARCH_ZOOM = 15;
const SEVERITY_COLORS = {
  low: '#64B5F6',    // Light blue
  medium: '#2196F3', // Medium blue
  high: '#1976D2'    // Dark blue
};

// Updated Galle district boundaries (expanded to properly include all areas)
const GALLE_AREA = {
  north: 6.4200, // Expanded north boundary
  south: 5.9700, // Expanded south boundary
  east: 80.5000, // Expanded east boundary
  west: 79.9800  // Expanded west boundary
};

// Galle District viewbox for optimized search
const GALLE_VIEWBOX = '80.1210,5.9535,80.3210,6.1535'; // [west,south,east,north]

// Animation settings for smooth transitions
const TRANSITION_OPTIONS = {
  duration: 2.5,    // Duration in seconds
  easeLinearity: 0.2,  // Lower value = smoother curve
  animate: true,
  zoom: {
    animate: true,
    duration: 1.5,  // Zoom duration
    easeLinearity: 0.2
  }
};

// Sri Lanka viewbox for search
const SL_VIEWBOX = '79.5,5.8,82.0,9.9'; // [west,south,east,north]

// Location types to prioritize in search
const PRIORITY_TYPES = [
  'city',
  'town',
  'village',
  'suburb',
  'neighbourhood',
  'tourism',
  'landmark',
  'natural',
  'historic'
];

// Bounds for the map view restriction
const GALLE_BOUNDS = [
  [GALLE_AREA.south, GALLE_AREA.west], // Southwest
  [GALLE_AREA.north, GALLE_AREA.east]  // Northeast
];

// Component to handle map bounds
function MapBoundsHandler() {
  const map = useMap();
  
  useEffect(() => {
    if (!map) return;
    
    // Initially set bounds to Galle
    map.setMaxBounds(GALLE_BOUNDS);
    map.fitBounds(GALLE_BOUNDS, {
      maxZoom: DEFAULT_ZOOM
    });
    
    // Set min/max zoom levels
    map.setMinZoom(10);
    map.setMaxZoom(18);
  }, [map]);
  
  return null;
}

// Component to update map view when searching
function SearchResultHandler({ searchResult }) {
  const map = useMap();

  useEffect(() => {
    if (!searchResult || !map) return;

    try {
      const { lat, lon } = searchResult;
      const targetLatLng = [parseFloat(lat), parseFloat(lon)];
      
      // Simple zoom out and fly to
      const currentZoom = map.getZoom();
      map.setZoom(currentZoom - 1, { duration: 0.5 });
      
      setTimeout(() => {
        map.flyTo(targetLatLng, SEARCH_ZOOM, {
          duration: 2,
          easeLinearity: 0.5
        });
      }, 500);

    } catch (error) {
      console.error('Map transition error:', error);
      // Fallback to simple movement
      map.setView([parseFloat(searchResult.lat), parseFloat(searchResult.lon)], SEARCH_ZOOM);
    }
  }, [map, searchResult]);

  return null;
}

// Component to handle map clicks
function MapEventHandler({ onMapClick }) {
  useMapEvents({
    click: onMapClick
  });
  return null;
}

// Map style configuration
const TILE_LAYER_OPTIONS = {
  maxZoom: 18,
  minZoom: 10,
  keepBuffer: 4, // Number of rows/columns in buffer beyond the visible map
  updateWhenIdle: true, // Only load tiles when panning/zooming ends
  updateWhenZooming: false, // Don't load tiles during zoom
  preferCanvas: true, // Use Canvas rendering instead of SVG
  className: 'map-tiles'
};

function LoadingIndicator() {
  const map = useMap();
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!map) return;

    const handleLoad = () => setLoading(true);
    const handleLoadEnd = () => setLoading(false);

    map.on('loading', handleLoad);
    map.on('load', handleLoadEnd);
    map.on('tileerror', handleLoadEnd);

    return () => {
      map.off('loading', handleLoad);
      map.off('load', handleLoadEnd);
      map.off('tileerror', handleLoadEnd);
    };
  }, [map]);

  if (!loading) return null;

  return (
    <div className="map-loading-indicator">
      Loading map...
    </div>
  );
}

// Add new plot dialog component
function PlotDialog({ isOpen, onClose, position, onSubmit }) {
  const [plotData, setPlotData] = useState({
    incidentName: '',
    reporterName: '',
    dateTime: new Date().toISOString().slice(0, 16), // Current date and time
    radius: 100, // Default radius in meters
    severity: 'moderate',
    description: '',
    affectedArea: '',
    evacuationStatus: 'not_required',
    waterLevel: '',
    weatherConditions: ''
  });

  const handleChange = (e) => {
    const { name, value } = e.target;
    setPlotData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    onSubmit({
      ...plotData,
      position,
      timestamp: new Date(plotData.dateTime).getTime()
    });
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="plot-dialog-overlay">
      <div className="plot-dialog">
        <h2>Add Flood Incident</h2>
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label>Incident Name *</label>
            <input
              type="text"
              name="incidentName"
              value={plotData.incidentName}
              onChange={handleChange}
              required
              placeholder="e.g., Galle Road Flooding"
            />
          </div>

          <div className="form-group">
            <label>Reporter Name *</label>
            <input
              type="text"
              name="reporterName"
              value={plotData.reporterName}
              onChange={handleChange}
              required
              placeholder="Your name"
            />
          </div>

          <div className="form-group">
            <label>Date and Time *</label>
            <input
              type="datetime-local"
              name="dateTime"
              value={plotData.dateTime}
              onChange={handleChange}
              required
            />
          </div>

          <div className="form-group">
            <label>Circle Radius (meters) *</label>
            <input
              type="number"
              name="radius"
              value={plotData.radius}
              onChange={handleChange}
              min="10"
              max="1000"
              required
            />
          </div>

          <div className="form-group">
            <label>Severity Level *</label>
            <select
              name="severity"
              value={plotData.severity}
              onChange={handleChange}
              required
            >
              <option value="minor">Minor</option>
              <option value="moderate">Moderate</option>
              <option value="severe">Severe</option>
              <option value="critical">Critical</option>
            </select>
          </div>

          <div className="form-group">
            <label>Affected Area</label>
            <input
              type="text"
              name="affectedArea"
              value={plotData.affectedArea}
              onChange={handleChange}
              placeholder="e.g., Residential Area, School Zone"
            />
          </div>

          <div className="form-group">
            <label>Water Level</label>
            <select
              name="waterLevel"
              value={plotData.waterLevel}
              onChange={handleChange}
            >
              <option value="">Select Water Level</option>
              <option value="ankle">Ankle Deep (less than 0.5m)</option>
              <option value="knee">Knee Deep (0.5m - 1m)</option>
              <option value="waist">Waist Deep (1m - 1.5m)</option>
              <option value="above_waist">Above Waist (more than 1.5m)</option>
            </select>
          </div>

          <div className="form-group">
            <label>Evacuation Status</label>
            <select
              name="evacuationStatus"
              value={plotData.evacuationStatus}
              onChange={handleChange}
            >
              <option value="not_required">Not Required</option>
              <option value="recommended">Recommended</option>
              <option value="in_progress">In Progress</option>
              <option value="completed">Completed</option>
            </select>
          </div>

          <div className="form-group">
            <label>Weather Conditions</label>
            <select
              name="weatherConditions"
              value={plotData.weatherConditions}
              onChange={handleChange}
            >
              <option value="">Select Weather</option>
              <option value="heavy_rain">Heavy Rain</option>
              <option value="moderate_rain">Moderate Rain</option>
              <option value="light_rain">Light Rain</option>
              <option value="cloudy">Cloudy</option>
              <option value="clear">Clear</option>
            </select>
          </div>

          <div className="form-group">
            <label>Description</label>
            <textarea
              name="description"
              value={plotData.description}
              onChange={handleChange}
              placeholder="Additional details about the incident..."
              rows="3"
            />
          </div>

          <div className="dialog-buttons">
            <button type="button" onClick={onClose} className="cancel-button">
              Cancel
            </button>
            <button type="submit" className="submit-button">
              Add Incident
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// Add status indicator component
function StatusIndicator({ status, isActive }) {
  // Now accepts explicit isActive prop
  return (
    <div className="status-indicator">
      <span className={`status-dot ${isActive ? 'active' : 'inactive'}`}>●</span>
      <span className="status-text">
        {isActive ? 'ACTIVE' : 'INACTIVE'}
      </span>
    </div>
  );
}

// Add severity label helper with emoji indicators
function getSeverityLabel(severity) {
  switch (severity) {
    case 'minor':
      return { label: 'Minor', icon: '⚪' };
    case 'moderate':
      return { label: 'Moderate', icon: '🟡' };
    case 'severe':
      return { label: 'Severe', icon: '🟠' };
    case 'critical':
      return { label: 'Critical', icon: '🔴' };
    default:
      return { label: 'Unknown', icon: '⚪' };
  }
}

// Format water level text
function formatWaterLevel(level) {
  if (!level) return null;
  const formatted = level
    .split('_')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
  return `${formatted} Water`;
}

// Add configuration dialog component
function ConfigDialog({ incident, onClose, onUpdate, onDelete }) {
  const [editData, setEditData] = useState({
    incidentName: incident.incidentName,
    reporterName: incident.reporterName,
    radius: incident.radius,
    severity: incident.severity,
    description: incident.description,
    affectedArea: incident.affectedArea,
    evacuationStatus: incident.evacuationStatus,
    waterLevel: incident.waterLevel,
    weatherConditions: incident.weatherConditions,
    isActive: incident.evacuationStatus === 'in_progress' || incident.evacuationStatus === 'recommended'
  });

  const handleChange = (e) => {
    const { name, value } = e.target;
    setEditData(prev => ({
      ...prev,
      [name]: value,
      // Update evacuationStatus when isActive changes
      ...(name === 'isActive' && {
        evacuationStatus: value === 'true' ? 'in_progress' : 'not_required'
      })
    }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    onUpdate(incident.id, {
      ...editData,
      // Ensure evacuationStatus matches isActive state
      evacuationStatus: editData.isActive === 'true' ? 'in_progress' : 'not_required'
    });
    onClose();
  };

  return (
    <div className="config-dialog-overlay">
      <div className="config-dialog">
        <h2>Configure Incident</h2>
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label>Status *</label>
            <select
              name="isActive"
              value={editData.isActive}
              onChange={handleChange}
              required
              className="status-select"
            >
              <option value="true">ACTIVE</option>
              <option value="false">INACTIVE</option>
            </select>
          </div>

          <div className="form-group">
            <label>Incident Name *</label>
            <input
              type="text"
              name="incidentName"
              value={editData.incidentName}
              onChange={handleChange}
              required
            />
          </div>

          <div className="form-group">
            <label>Reporter Name *</label>
            <input
              type="text"
              name="reporterName"
              value={editData.reporterName}
              onChange={handleChange}
              required
            />
          </div>

          <div className="form-group">
            <label>Circle Radius (meters) *</label>
            <input
              type="number"
              name="radius"
              value={editData.radius}
              onChange={handleChange}
              min="10"
              max="1000"
              required
            />
          </div>

          <div className="form-group">
            <label>Severity Level *</label>
            <select
              name="severity"
              value={editData.severity}
              onChange={handleChange}
              required
            >
              <option value="minor">Minor</option>
              <option value="moderate">Moderate</option>
              <option value="severe">Severe</option>
              <option value="critical">Critical</option>
            </select>
          </div>

          <div className="form-group">
            <label>Evacuation Status *</label>
            <select
              name="evacuationStatus"
              value={editData.evacuationStatus}
              onChange={handleChange}
              required
            >
              <option value="not_required">Not Required</option>
              <option value="recommended">Recommended</option>
              <option value="in_progress">In Progress</option>
              <option value="completed">Completed</option>
            </select>
          </div>

          <div className="form-group">
            <label>Water Level</label>
            <select
              name="waterLevel"
              value={editData.waterLevel}
              onChange={handleChange}
            >
              <option value="">Select Water Level</option>
              <option value="ankle">Ankle Deep (less than 0.5m)</option>
              <option value="knee">Knee Deep (0.5m - 1m)</option>
              <option value="waist">Waist Deep (1m - 1.5m)</option>
              <option value="above_waist">Above Waist (more than 1.5m)</option>
            </select>
          </div>

          <div className="form-group">
            <label>Weather Conditions</label>
            <select
              name="weatherConditions"
              value={editData.weatherConditions}
              onChange={handleChange}
            >
              <option value="">Select Weather</option>
              <option value="heavy_rain">Heavy Rain</option>
              <option value="moderate_rain">Moderate Rain</option>
              <option value="light_rain">Light Rain</option>
              <option value="cloudy">Cloudy</option>
              <option value="clear">Clear</option>
            </select>
          </div>

          <div className="form-group">
            <label>Affected Area</label>
            <input
              type="text"
              name="affectedArea"
              value={editData.affectedArea}
              onChange={handleChange}
              placeholder="e.g., Residential Area, School Zone"
            />
          </div>

          <div className="form-group">
            <label>Description</label>
            <textarea
              name="description"
              value={editData.description}
              onChange={handleChange}
              placeholder="Additional details about the incident..."
              rows="3"
            />
          </div>

          <div className="dialog-buttons">
            <button 
              type="button" 
              onClick={() => onDelete(incident.id)}
              className="delete-button"
            >
              Delete Incident
            </button>
            <div>
              <button type="button" onClick={onClose} className="cancel-button">
                Cancel
              </button>
              <button type="submit" className="submit-button">
                Save Changes
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}

// Add PulseCircle component
function PulseCircle({ center, radius }) {
  return (
    <>
      <Circle
        center={center}
        radius={radius}
        pathOptions={{
          color: 'rgba(76, 175, 80, 0.3)',
          fillColor: 'rgba(76, 175, 80, 0.1)',
          fillOpacity: 0.3,
          weight: 2,
          className: 'pulse-circle-1'
        }}
      />
      <Circle
        center={center}
        radius={radius}
        pathOptions={{
          color: 'rgba(76, 175, 80, 0.2)',
          fillColor: 'rgba(76, 175, 80, 0.05)',
          fillOpacity: 0.2,
          weight: 2,
          className: 'pulse-circle-2'
        }}
      />
      <Circle
        center={center}
        radius={radius}
        pathOptions={{
          color: 'rgba(76, 175, 80, 0.1)',
          fillColor: 'rgba(76, 175, 80, 0.02)',
          fillOpacity: 0.1,
          weight: 2,
          className: 'pulse-circle-3'
        }}
      />
    </>
  );
}

function ManagePage() {
  const [mainView, setMainView] = React.useState('contributors');
  return (
    <div className="manage-page">
      {/* Top bar with contributor profiles */}
      <div className="manage-topbar">
        <div className="manage-profiles">
          <button className="manage-profile-btn large" title="Jane">
            <span className="profile-icon">👩‍💼</span>
          </button>
          <button className="manage-profile-btn large" title="Sam">
            <span className="profile-icon">👨‍💼</span>
          </button>
          <button className="manage-profile-btn large" title="Lee">
            <span className="profile-icon">🧑‍💼</span>
          </button>
          <button className="manage-profile-btn large add-btn" title="Add">
            <span className="profile-icon">+</span>
          </button>
        </div>
      </div>
      <div className="manage-layout">
        {/* Sidebar with large buttons */}
        <div className="manage-sidebar wide">
          <button className="manage-sidebar-btn sidebar-action" onClick={()=>setMainView('report')}>
            <span className="sidebar-btn-icon">📝</span>
            <span className="sidebar-btn-label">Submit Report</span>
          </button>
          <button className="manage-sidebar-btn sidebar-action" onClick={()=>setMainView('contributors')}>
            <span className="sidebar-btn-icon">👥</span>
            <span className="sidebar-btn-label">Manage Contributors</span>
          </button>
        </div>
        {/* Main content area */}
        <div className="manage-main">
          {mainView === 'contributors' && (
            <div className="messenger-box">
              <div className="messenger-header">Contributors Chat</div>
              <div className="messenger-messages">
                <div className="message left">
                  <span className="avatar">👩‍💼</span>
                  <div className="bubble">Hi, I submitted a report.</div>
                </div>
                <div className="message right">
                  <span className="avatar">🧑‍💼</span>
                  <div className="bubble">Thank you! We'll review it soon.</div>
                </div>
              </div>
              <div className="messenger-input">
                <input type="text" placeholder="Type a message..." />
                <button>Send</button>
              </div>
            </div>
          )}
          {mainView === 'report' && (
            <div className="report-box">
              <h3>Submit Report</h3>
              <p>Report submission form goes here.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function App() {
  const [floodIncidents, setFloodIncidents] = useState(() => {
    const saved = localStorage.getItem('floodIncidents');
    return saved ? JSON.parse(saved) : [];
  });
  const [searchQuery, setSearchQuery] = useState('');
  const [activeSection, setActiveSection] = useState('dashboard');
  const [isExpanded, setIsExpanded] = useState(true);
  const [plotMode, setPlotMode] = useState(null);
  const [isPlotMenuOpen, setIsPlotMenuOpen] = useState(false);
  const [tempPoints, setTempPoints] = useState([]);
  const [isMobile, setIsMobile] = useState(window.innerWidth <= 768);
  const [isConfigMode, setIsConfigMode] = useState(false);
  const [selectedIncident, setSelectedIncident] = useState(null);
  const [showAddPlotMenu, setShowAddPlotMenu] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [searchResult, setSearchResult] = useState(null);
  const mapRef = useRef();
  const [showPlotDialog, setShowPlotDialog] = useState(false);
  const [plotPosition, setPlotPosition] = useState(null);
  const [showConfigDialog, setShowConfigDialog] = useState(false);

  // Handle window resize
  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth <= 768);
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Save flood incidents to localStorage whenever they change
  useEffect(() => {
    localStorage.setItem('floodIncidents', JSON.stringify(floodIncidents));
  }, [floodIncidents]);

  // Reset search when component unmounts or on error
  useEffect(() => {
    return () => {
      setSearchResult(null);
      setSearchQuery('');
      setIsSearching(false);
    };
  }, []);

  const handleSearch = async () => {
    if (!searchQuery.trim() || isSearching) return;

    try {
      setIsSearching(true);
      setSearchResult(null);

      await new Promise(resolve => setTimeout(resolve, 100));
      
      const baseUrl = 'https://nominatim.openstreetmap.org/search';
      const params = new URLSearchParams({
        q: `${searchQuery.trim()}, Galle District, Sri Lanka`,
        format: 'json',
        limit: 3, // Increased to get more results
        countrycodes: 'lk',
        addressdetails: 1
      });

      const response = await fetch(`${baseUrl}?${params}`, {
        headers: {
          'Accept-Language': 'en-US,en;q=0.9',
          'User-Agent': 'DisasterTrackingApp/1.0'
        }
      });
      
      if (!response.ok) {
        throw new Error('Search request failed');
      }

      const data = await response.json();
      console.log('Search results:', data);

      if (!data || data.length === 0) {
        alert('Location not found. Please try another search.');
        return;
      }

      // Find the first result that matches Galle district
      const galleResult = data.find(result => {
        const lat = parseFloat(result.lat);
        const lon = parseFloat(result.lon);
        
        // Check coordinates
        const isInBounds = lat >= GALLE_AREA.south && lat <= GALLE_AREA.north && 
                          lon >= GALLE_AREA.west && lon <= GALLE_AREA.east;
        
        // Check address details
        const address = result.address || {};
        const isInGalle = 
          address.county?.toLowerCase().includes('galle') ||
          address.state_district?.toLowerCase().includes('galle') ||
          address.district?.toLowerCase().includes('galle') ||
          (address.city?.toLowerCase() === 'galle') ||
          (address.town?.toLowerCase() === 'galle');

        return isInBounds || isInGalle;
      });

      if (!galleResult) {
        alert('Location not found in Galle district. Please try another search.');
        return;
      }

      await new Promise(resolve => setTimeout(resolve, 100));
      setSearchResult(galleResult);

    } catch (error) {
      console.error('Search error:', error);
      alert('Search failed. Please try again.');
      setSearchResult(null);
    } finally {
      setIsSearching(false);
    }
  };

  const handleSearchKeyPress = (e) => {
    if (e.key === 'Enter') {
      handleSearch();
    }
  };

  const handleMapClick = (e) => {
    if (plotMode === 'circle') {
      const clickedPosition = {
        lat: e.latlng.lat,
        lng: e.latlng.lng
      };
      setPlotPosition(clickedPosition);
      setShowPlotDialog(true);
    }
  };

  // Add incident update handler
  const handleIncidentUpdate = (id, updatedData) => {
    const newIncidents = floodIncidents.map(incident => 
      incident.id === id
        ? { ...incident, ...updatedData }
        : incident
    );
    setFloodIncidents(newIncidents);
    // Force re-render by creating new array
    setTimeout(() => {
      setFloodIncidents([...newIncidents]);
    }, 100);
  };

  // Add incident delete handler
  const handleIncidentDelete = (id) => {
    if (window.confirm('Are you sure you want to delete this incident?')) {
      setFloodIncidents(prev => prev.filter(incident => incident.id !== id));
      setShowConfigDialog(false);
      setSelectedIncident(null);
    }
  };

  const toggleAddPlotMenu = () => {
    setShowAddPlotMenu(!showAddPlotMenu);
    setIsConfigMode(false);
    setPlotMode(null);
    setTempPoints([]);
  };

  const toggleConfigMode = () => {
    setIsConfigMode(!isConfigMode);
    setShowAddPlotMenu(false);
    setPlotMode(null);
    setTempPoints([]);
  };

  const handlePlotModeSelect = (mode) => {
    setPlotMode(mode);
    setShowAddPlotMenu(false);
    setTempPoints([]);
  };

  const handlePlotSubmit = (plotData) => {
    if (!plotData.position || !plotData.position.lat || !plotData.position.lng) {
      console.error('Invalid position data:', plotData);
      return;
    }

    const newIncident = {
      id: Date.now().toString(),
      type: 'circle',
      position: [plotData.position.lat, plotData.position.lng],
      radius: parseFloat(plotData.radius),
      timestamp: plotData.timestamp,
      incidentName: plotData.incidentName,
      reporterName: plotData.reporterName,
      severity: plotData.severity,
      description: plotData.description,
      affectedArea: plotData.affectedArea,
      evacuationStatus: plotData.evacuationStatus,
      waterLevel: plotData.waterLevel,
      weatherConditions: plotData.weatherConditions
    };

    console.log('Adding new incident:', newIncident);
    setFloodIncidents(prev => [...prev, newIncident]);
    setPlotMode(null);
    setShowPlotDialog(false);
    setPlotPosition(null);
  };

  // Preconnect to tile server
  useEffect(() => {
    const link = document.createElement('link');
    link.rel = 'preconnect';
    link.href = 'https://tile.openstreetmap.org';
    document.head.appendChild(link);
    return () => document.head.removeChild(link);
  }, []);

  return (
    <div className="app">
      <nav className={`sidebar ${isExpanded ? 'expanded' : 'collapsed'}`}>
        <div className="sidebar-header">
          <span className="logo">FloodTrack</span>
          <button 
            className="expand-btn" 
            onClick={() => setIsExpanded(!isExpanded)}
            aria-label={isExpanded ? 'Collapse sidebar' : 'Expand sidebar'}
          >
            {isExpanded ? (
              <span className="menu-icon">
                {isMobile ? '←' : '≡'}
              </span>
            ) : (
              <span className="menu-icon">≡</span>
            )}
          </button>
        </div>

        <div className="nav-links">
          <button 
            className={`nav-item ${activeSection === 'dashboard' ? 'active' : ''}`}
            onClick={() => setActiveSection('dashboard')}
          >
            <span className="nav-icon">📊</span>
            {isExpanded && <span className="nav-text">Dashboard</span>}
          </button>

          <div className="plot-controls">
            <button 
              className={`nav-item ${showAddPlotMenu ? 'active' : ''}`}
              onClick={toggleAddPlotMenu}
            >
              <span className="nav-icon">📍</span>
              {isExpanded && (
                <>
                  <span className="nav-text">Add Plot</span>
                  {showAddPlotMenu && (
                    <span className="arrow">▼</span>
                  )}
                </>
              )}
            </button>

            {showAddPlotMenu && isExpanded && (
              <div className="plot-submenu">
                <button 
                  className={`submenu-item ${plotMode === 'marker' ? 'active' : ''}`}
                  onClick={() => handlePlotModeSelect('marker')}
                >
                  <span className="plot-icon">📍</span>
                  <span>Single Point</span>
                </button>
                <button 
                  className={`submenu-item ${plotMode === 'area' ? 'active' : ''}`}
                  onClick={() => handlePlotModeSelect('area')}
                >
                  <span className="plot-icon">⭕</span>
                  <span>Flooded Area</span>
                </button>
                <button 
                  className={`submenu-item ${plotMode === 'circle' ? 'active' : ''}`}
                  onClick={() => handlePlotModeSelect('circle')}
                >
                  <span className="plot-icon">⚪</span>
                  <span>Circular Zone</span>
                </button>
                <button 
                  className={`submenu-item ${plotMode === 'path' ? 'active' : ''}`}
                  onClick={() => handlePlotModeSelect('path')}
                >
                  <span className="plot-icon">➡️</span>
                  <span>Water Flow Path</span>
                </button>
              </div>
            )}

            <button 
              className={`nav-item ${isConfigMode ? 'active' : ''}`}
              onClick={toggleConfigMode}
            >
              <span className="nav-icon">⚙️</span>
              {isExpanded && <span className="nav-text">Config Plot</span>}
            </button>
          </div>

          <button 
            className={`nav-item ${activeSection === 'incidents' ? 'active' : ''}`}
            onClick={() => setActiveSection('incidents')}
          >
            <span className="nav-icon">🌊</span>
            {isExpanded && <span className="nav-text">Flood Incidents</span>}
          </button>

          <button 
            className={`nav-item ${activeSection === 'analytics' ? 'active' : ''}`}
            onClick={() => setActiveSection('analytics')}
          >
            <span className="nav-icon">📈</span>
            {isExpanded && <span className="nav-text">Analytics</span>}
          </button>

          <button 
            className={`nav-item ${activeSection === 'reports' ? 'active' : ''}`}
            onClick={() => setActiveSection('reports')}
          >
            <span className="nav-icon">📋</span>
            {isExpanded && <span className="nav-text">Reports</span>}
          </button>

          <button 
            className={`nav-item ${activeSection === 'settings' ? 'active' : ''}`}
            onClick={() => setActiveSection('settings')}
          >
            <span className="nav-icon">⚙️</span>
            {isExpanded && <span className="nav-text">Settings</span>}
          </button>

          <button 
            className={`nav-item ${activeSection === 'manage' ? 'active' : ''}`}
            onClick={() => setActiveSection('manage')}
          >
            <span className="nav-icon">🛠️</span>
            {isExpanded && <span className="nav-text">Manage</span>}
          </button>
        </div>

        <div className="user-profile">
          <div className="profile-icon">👤</div>
          {isExpanded && (
            <div className="profile-info">
              <div className="profile-name">Agent Name</div>
              <div className="profile-role">Flood Response</div>
            </div>
          )}
        </div>
      </nav>

      {activeSection === 'manage' ? (
        <ManagePage />
      ) : (
        <div className="map-container">
          <MapContainer
            center={GALLE_CENTER}
            zoom={DEFAULT_ZOOM}
            scrollWheelZoom={true}
            style={{ height: "100%", width: "100%" }}
            ref={mapRef}
            {...TILE_LAYER_OPTIONS}
          >
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              {...TILE_LAYER_OPTIONS}
            />
            <MapBoundsHandler />
            <MapEventHandler onMapClick={handleMapClick} />
            <LoadingIndicator />
            {searchResult && <SearchResultHandler searchResult={searchResult} />}

            {/* Render flood incidents with tooltips */}
            {floodIncidents.map(incident => {
              const isActive = incident.evacuationStatus === 'in_progress' || incident.evacuationStatus === 'recommended';
              
              return incident.position && incident.position.length === 2 ? (
                <React.Fragment key={`${incident.id}-${incident.severity}-${incident.evacuationStatus}`}>
                  {isActive && (
                    <PulseCircle 
                      center={incident.position} 
                      radius={incident.radius}
                    />
                  )}
                  <Circle
                    center={incident.position}
                    radius={incident.radius}
                    pathOptions={{
                      color: getIncidentColor(incident.severity),
                      fillColor: getIncidentColor(incident.severity),
                      fillOpacity: 0.3
                    }}
                    eventHandlers={{
                      click: () => {
                        setSelectedIncident(incident);
                        setShowConfigDialog(true);
                      }
                    }}
                  >
                    <Tooltip 
                      key={`tooltip-${incident.id}-${incident.severity}-${incident.evacuationStatus}`}
                      direction="top" 
                      offset={[0, -20]}
                      opacity={1}
                      permanent={false}
                      className="incident-tooltip"
                    >
                      <div className="tooltip-content">
                        <div className="tooltip-header">
                          <h3 className="incident-name">{incident.incidentName}</h3>
                          <StatusIndicator 
                            status={incident.evacuationStatus}
                            isActive={incident.evacuationStatus === 'in_progress' || incident.evacuationStatus === 'recommended'}
                          />
                        </div>
                        <div className="tooltip-details">
                          <div className="severity-info">
                            <span className="detail-icon">
                              {getSeverityLabel(incident.severity).icon}
                            </span>
                            <span className="detail-label">
                              {getSeverityLabel(incident.severity).label} Severity
                            </span>
                          </div>
                          {incident.waterLevel && (
                            <div className="water-level-info">
                              <span className="detail-icon">💧</span>
                              <span className="detail-label">
                                {formatWaterLevel(incident.waterLevel)}
                              </span>
                            </div>
                          )}
                          {incident.reporterName && (
                            <div className="reporter-info">
                              <span className="detail-icon">👤</span>
                              <span className="detail-label">
                                Reported by: {incident.reporterName}
                              </span>
                            </div>
                          )}
                        </div>
                      </div>
                    </Tooltip>
                  </Circle>
                </React.Fragment>
              ) : null;
            })}
            
            {/* Plot Dialog */}
            {showPlotDialog && plotPosition && (
              <PlotDialog
                isOpen={showPlotDialog}
                onClose={() => {
                  setShowPlotDialog(false);
                  setPlotMode(null);
                  setPlotPosition(null);
                }}
                position={plotPosition}
                onSubmit={handlePlotSubmit}
              />
            )}

            {/* Add Configuration Dialog */}
            {showConfigDialog && selectedIncident && (
              <ConfigDialog
                incident={selectedIncident}
                onClose={() => {
                  setShowConfigDialog(false);
                  setSelectedIncident(null);
                }}
                onUpdate={handleIncidentUpdate}
                onDelete={handleIncidentDelete}
              />
            )}

            <div className="map-controls">
              <div className="map-search">
                <input
                  type="text"
                  placeholder="Search locations in Galle district (e.g., Baddegama, Hikkaduwa)"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyPress={handleSearchKeyPress}
                  className="search-input"
                  disabled={isSearching}
                />
                <button 
                  className={`search-button ${isSearching ? 'searching' : ''}`}
                  onClick={handleSearch}
                  disabled={isSearching}
                >
                  <span className="search-icon">
                    {isSearching ? '⌛' : '🔍'}
                  </span>
                  {isSearching ? 'Searching...' : 'Search'}
                </button>
              </div>
            </div>
          </MapContainer>

          {/* Plot instructions */}
          {plotMode && (
            <div className="plot-instructions">
              {plotMode === 'marker' && 'Click on the map to mark a flood incident point'}
              {plotMode === 'area' && 'Click multiple points to define the flooded area. Double click to finish.'}
              {plotMode === 'circle' && 'Click on the map to place a circular flood zone'}
              {plotMode === 'path' && (
                tempPoints.length === 0
                  ? 'Click the starting point of the water flow path'
                  : 'Click the ending point of the water flow path'
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default App; 

// Add helper function for incident colors
function getIncidentColor(severity) {
  switch (severity) {
    case 'minor':
      return '#ffd700'; // Gold
    case 'moderate':
      return '#ffa500'; // Orange
    case 'severe':
      return '#ff4500'; // Red-Orange
    case 'critical':
      return '#ff0000'; // Red
    default:
      return '#ffa500'; // Default Orange
  }
} 