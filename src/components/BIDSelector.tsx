import React, { useState, useEffect, useRef } from "react";
import { ginkgoTheme } from "../styles/ginkgoTheme";

interface BID {
  bid_id: string;
  name: string;
  short_name: string;
  display_name: string;
  city: string;
  state: string;
  location: string;
  area_sq_miles: number | null;
  annual_budget_usd: number | null;
  established_year: number | null;
  total_segments: number | null;
  total_length_miles: number | null;
  total_places: number | null;
  data_available: boolean;
  centroid: {
    type: string;
    coordinates: [number, number];
  } | null;
}

interface BIDSelectorProps {
  onBIDSelected: (bid: BID) => void;
  selectedBID: BID | null;
  isLoading?: boolean;
}

export function BIDSelector({ onBIDSelected, selectedBID, isLoading = false }: BIDSelectorProps) {
  const [bids, setBids] = useState<BID[]>([]);
  const [filteredBids, setFilteredBids] = useState<BID[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCity, setSelectedCity] = useState("");
  const [selectedState, setSelectedState] = useState("");
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [isLoadingBids, setIsLoadingBids] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const dropdownRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Fetch BIDs on mount
  useEffect(() => {
    fetchBIDs();
  }, []);

  // Handle click outside dropdown
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsDropdownOpen(false);
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  // Filter BIDs when search/filter criteria change
  useEffect(() => {
    let filtered = bids;

    if (searchTerm) {
      filtered = filtered.filter(bid =>
        bid.display_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        bid.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        bid.city.toLowerCase().includes(searchTerm.toLowerCase()) ||
        bid.location.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    if (selectedCity) {
      filtered = filtered.filter(bid => bid.city === selectedCity);
    }

    if (selectedState) {
      filtered = filtered.filter(bid => bid.state === selectedState);
    }

    setFilteredBids(filtered);
  }, [bids, searchTerm, selectedCity, selectedState]);

  const fetchBIDs = async () => {
    setIsLoadingBids(true);
    setError(null);
    
    try {
      const response = await fetch('/.netlify/functions/bid-list');
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      const data = await response.json();
      setBids(data.bids || []);
      setFilteredBids(data.bids || []);
    } catch (error) {
      console.error('Error fetching BIDs:', error);
      setError(error instanceof Error ? error.message : 'Failed to load BIDs');
      setBids([]);
      setFilteredBids([]);
    } finally {
      setIsLoadingBids(false);
    }
  };

  const handleBIDSelect = (bid: BID) => {
    onBIDSelected(bid);
    setIsDropdownOpen(false);
    setSearchTerm(bid.display_name);
  };

  const handleInputClick = () => {
    setIsDropdownOpen(true);
    if (inputRef.current) {
      inputRef.current.select();
    }
  };

  const handleSearchChange = (value: string) => {
    setSearchTerm(value);
    setIsDropdownOpen(true);
  };

  // Get unique cities and states for filters
  const uniqueCities = Array.from(new Set(bids.map(bid => bid.city))).sort();
  const uniqueStates = Array.from(new Set(bids.map(bid => bid.state))).sort();

  const formatBudget = (budget: number | null) => {
    if (!budget) return 'N/A';
    if (budget >= 1000000) {
      return `$${(budget / 1000000).toFixed(1)}M`;
    }
    if (budget >= 1000) {
      return `$${(budget / 1000).toFixed(0)}K`;
    }
    return `$${budget.toLocaleString()}`;
  };

  return (
    <div style={{
      position: 'relative',
      width: '100%',
      maxWidth: '500px'
    }} ref={dropdownRef}>
      
      {/* Search Input */}
      <div style={{
        position: 'relative',
        marginBottom: '1rem'
      }}>
        <input
          ref={inputRef}
          type="text"
          value={searchTerm}
          onChange={(e) => handleSearchChange(e.target.value)}
          onClick={handleInputClick}
          placeholder={selectedBID ? selectedBID.display_name : "Search for a Business Improvement District..."}
          disabled={isLoading || isLoadingBids}
          style={{
            width: '100%',
            padding: '12px 16px',
            fontSize: '16px',
            borderRadius: '8px',
            border: `2px solid ${ginkgoTheme.colors.secondary.lightGray}`,
            backgroundColor: ginkgoTheme.colors.background.main,
            color: ginkgoTheme.colors.text.primary,
            fontFamily: ginkgoTheme.typography.fontFamily.body,
            outline: 'none',
            transition: 'all 0.2s ease',
            cursor: isLoading || isLoadingBids ? 'not-allowed' : 'text',
            opacity: isLoading || isLoadingBids ? 0.6 : 1,
          }}
          onFocus={(e) => {
            e.currentTarget.style.borderColor = ginkgoTheme.colors.primary.green;
            e.currentTarget.style.boxShadow = `0 0 0 3px rgba(15, 234, 166, 0.1)`;
          }}
          onBlur={(e) => {
            e.currentTarget.style.borderColor = ginkgoTheme.colors.secondary.lightGray;
            e.currentTarget.style.boxShadow = 'none';
          }}
        />
        
        {/* Search Icon */}
        <div style={{
          position: 'absolute',
          right: '12px',
          top: '50%',
          transform: 'translateY(-50%)',
          color: ginkgoTheme.colors.text.light,
          fontSize: '18px',
          pointerEvents: 'none'
        }}>
          🔍
        </div>
      </div>

      {/* Filter Controls */}
      <div style={{
        display: 'flex',
        gap: '0.5rem',
        marginBottom: '1rem',
        flexWrap: 'wrap'
      }}>
        <select
          value={selectedState}
          onChange={(e) => setSelectedState(e.target.value)}
          disabled={isLoading || isLoadingBids}
          style={{
            padding: '6px 12px',
            fontSize: '14px',
            borderRadius: '6px',
            border: `1px solid ${ginkgoTheme.colors.secondary.lightGray}`,
            backgroundColor: ginkgoTheme.colors.background.main,
            color: ginkgoTheme.colors.text.primary,
            fontFamily: ginkgoTheme.typography.fontFamily.body,
            cursor: 'pointer'
          }}
        >
          <option value="">All States</option>
          {uniqueStates.map(state => (
            <option key={state} value={state}>{state}</option>
          ))}
        </select>

        <select
          value={selectedCity}
          onChange={(e) => setSelectedCity(e.target.value)}
          disabled={isLoading || isLoadingBids || !selectedState}
          style={{
            padding: '6px 12px',
            fontSize: '14px',
            borderRadius: '6px',
            border: `1px solid ${ginkgoTheme.colors.secondary.lightGray}`,
            backgroundColor: ginkgoTheme.colors.background.main,
            color: ginkgoTheme.colors.text.primary,
            fontFamily: ginkgoTheme.typography.fontFamily.body,
            cursor: 'pointer',
            opacity: !selectedState ? 0.5 : 1
          }}
        >
          <option value="">All Cities</option>
          {uniqueCities
            .filter(city => !selectedState || bids.some(bid => bid.city === city && bid.state === selectedState))
            .map(city => (
              <option key={city} value={city}>{city}</option>
            ))}
        </select>

        {(selectedCity || selectedState || searchTerm) && (
          <button
            onClick={() => {
              setSelectedCity('');
              setSelectedState('');
              setSearchTerm('');
            }}
            style={{
              padding: '6px 12px',
              fontSize: '14px',
              background: ginkgoTheme.colors.secondary.lightGray,
              color: ginkgoTheme.colors.text.secondary,
              border: 'none',
              borderRadius: '6px',
              cursor: 'pointer',
              fontFamily: ginkgoTheme.typography.fontFamily.body
            }}
          >
            Clear Filters
          </button>
        )}
      </div>

      {/* Error Display */}
      {error && (
        <div style={{
          padding: '12px',
          backgroundColor: '#fee',
          border: '1px solid #fcc',
          borderRadius: '6px',
          color: '#c33',
          fontSize: '14px',
          marginBottom: '1rem'
        }}>
          <strong>Error:</strong> {error}
          <button
            onClick={fetchBIDs}
            style={{
              marginLeft: '8px',
              padding: '4px 8px',
              background: '#c33',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              fontSize: '12px',
              cursor: 'pointer'
            }}
          >
            Retry
          </button>
        </div>
      )}

      {/* Dropdown Results */}
      {isDropdownOpen && (
        <div style={{
          position: 'absolute',
          top: '100%',
          left: '0',
          right: '0',
          backgroundColor: ginkgoTheme.colors.background.main,
          border: `2px solid ${ginkgoTheme.colors.secondary.lightGray}`,
          borderRadius: '8px',
          maxHeight: '400px',
          overflowY: 'auto',
          zIndex: 1000,
          boxShadow: ginkgoTheme.shadows.large
        }}>
          
          {/* Loading State */}
          {isLoadingBids && (
            <div style={{
              padding: '20px',
              textAlign: 'center',
              color: ginkgoTheme.colors.text.light,
              fontSize: '14px'
            }}>
              Loading BIDs...
            </div>
          )}

          {/* No Results */}
          {!isLoadingBids && filteredBids.length === 0 && (
            <div style={{
              padding: '20px',
              textAlign: 'center',
              color: ginkgoTheme.colors.text.light,
              fontSize: '14px'
            }}>
              {bids.length === 0 ? 'No BIDs available' : 'No BIDs match your search'}
            </div>
          )}

          {/* BID Results */}
          {!isLoadingBids && filteredBids.map((bid) => (
            <div
              key={bid.bid_id}
              onClick={() => handleBIDSelect(bid)}
              style={{
                padding: '12px 16px',
                borderBottom: `1px solid ${ginkgoTheme.colors.secondary.lightGray}`,
                cursor: 'pointer',
                transition: 'all 0.2s ease',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = ginkgoTheme.colors.background.hover;
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = 'transparent';
              }}
            >
              <div style={{
                fontSize: '16px',
                fontWeight: 600,
                color: ginkgoTheme.colors.text.primary,
                marginBottom: '4px',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center'
              }}>
                <span>{bid.display_name}</span>
                {bid.data_available && (
                  <span style={{
                    fontSize: '12px',
                    backgroundColor: ginkgoTheme.colors.primary.green,
                    color: ginkgoTheme.colors.text.primary,
                    padding: '2px 6px',
                    borderRadius: '4px',
                    fontWeight: 500
                  }}>
                    Data Ready
                  </span>
                )}
              </div>
              
              <div style={{
                fontSize: '13px',
                color: ginkgoTheme.colors.text.light,
                marginBottom: '6px'
              }}>
                📍 {bid.location}
                {bid.area_sq_miles && (
                  <span style={{ marginLeft: '12px' }}>
                    📐 {bid.area_sq_miles} sq mi
                  </span>
                )}
              </div>

              {(bid.total_segments || bid.total_places || bid.annual_budget_usd) && (
                <div style={{
                  fontSize: '12px',
                  color: ginkgoTheme.colors.text.secondary,
                  display: 'flex',
                  gap: '12px',
                  flexWrap: 'wrap'
                }}>
                  {bid.total_segments && (
                    <span>🛣️ {bid.total_segments} segments</span>
                  )}
                  {bid.total_places && (
                    <span>🏢 {bid.total_places} places</span>
                  )}
                  {bid.annual_budget_usd && (
                    <span>💰 {formatBudget(bid.annual_budget_usd)}/year</span>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Selected BID Summary */}
      {selectedBID && (
        <div style={{
          marginTop: '1rem',
          padding: '12px',
          backgroundColor: ginkgoTheme.colors.background.light,
          borderRadius: '8px',
          border: `1px solid ${ginkgoTheme.colors.primary.green}`,
        }}>
          <div style={{
            fontSize: '14px',
            fontWeight: 600,
            color: ginkgoTheme.colors.text.primary,
            marginBottom: '4px'
          }}>
            Selected: {selectedBID.display_name}
          </div>
          <div style={{
            fontSize: '12px',
            color: ginkgoTheme.colors.text.secondary
          }}>
            {selectedBID.location}
            {selectedBID.area_sq_miles && ` • ${selectedBID.area_sq_miles} sq mi`}
            {selectedBID.established_year && ` • Est. ${selectedBID.established_year}`}
          </div>
        </div>
      )}
    </div>
  );
}