import React, { useState, useEffect, useRef } from 'react';
import { ginkgoTheme } from '../styles/ginkgoTheme';

interface LocationResult {
  id: string;
  place_name: string;
  text: string;
  center: [number, number];
  place_type: string[];
  context?: Array<{ id: string; text: string }>;
}

interface LocationSearchModalProps {
  isOpen: boolean;
  onClose: () => void;
  onLocationSelected: (location: LocationResult) => void;
  mapboxToken: string;
}

export function LocationSearchModal({ 
  isOpen, 
  onClose, 
  onLocationSelected, 
  mapboxToken 
}: LocationSearchModalProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [suggestions, setSuggestions] = useState<LocationResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedSuggestion, setSelectedSuggestion] = useState<LocationResult | null>(null);
  const [showMultipleResults, setShowMultipleResults] = useState(false);
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Clear suggestions when modal closes
  useEffect(() => {
    if (!isOpen) {
      setSearchQuery('');
      setSuggestions([]);
      setSelectedSuggestion(null);
      setShowMultipleResults(false);
      setError(null);
    }
  }, [isOpen]);

  // Debounced search function
  const searchLocations = async (query: string) => {
    if (!query.trim()) {
      setSuggestions([]);
      setError(null);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await fetch(
        `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(query)}.json?` +
        `access_token=${mapboxToken}&limit=5&types=country,region,place,locality,neighborhood,address`
      );
      
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Failed to search locations');
      }

      if (data.features && data.features.length > 0) {
        const results: LocationResult[] = data.features.map((feature: any) => ({
          id: feature.id,
          place_name: feature.place_name,
          text: feature.text,
          center: feature.center,
          place_type: feature.place_type || [],
          context: feature.context || []
        }));
        
        setSuggestions(results);
        setShowMultipleResults(results.length > 1);
      } else {
        setSuggestions([]);
        setError('No locations found. Try a different search term.');
      }
    } catch (err: any) {
      setError(err.message || 'Failed to search locations');
      setSuggestions([]);
    } finally {
      setLoading(false);
    }
  };

  // Handle input changes with debouncing
  const handleInputChange = (value: string) => {
    setSearchQuery(value);
    setSelectedSuggestion(null);
    setShowMultipleResults(false);

    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }

    searchTimeoutRef.current = setTimeout(() => {
      searchLocations(value);
    }, 300);
  };

  // Handle suggestion selection
  const handleSuggestionClick = (suggestion: LocationResult) => {
    setSelectedSuggestion(suggestion);
    setSearchQuery(suggestion.place_name);
    setSuggestions([]);
    setShowMultipleResults(false);
  };

  // Handle go to location
  const handleGoToLocation = () => {
    if (selectedSuggestion) {
      onLocationSelected(selectedSuggestion);
      onClose();
    } else if (suggestions.length === 1) {
      onLocationSelected(suggestions[0]);
      onClose();
    }
  };

  // Get location type display name
  const getLocationTypeDisplay = (placeType: string[]) => {
    const typeMap: Record<string, string> = {
      'country': 'Country',
      'region': 'State/Region', 
      'place': 'City',
      'locality': 'Town',
      'neighborhood': 'Neighborhood',
      'address': 'Address'
    };
    
    for (const type of placeType) {
      if (typeMap[type]) return typeMap[type];
    }
    return 'Location';
  };

  // Get context information (state, country, etc.)
  const getContextInfo = (context?: Array<{ id: string; text: string }>) => {
    if (!context || context.length === 0) return '';
    
    const relevantContext = context
      .filter(item => item.id.includes('region') || item.id.includes('country'))
      .map(item => item.text);
    
    return relevantContext.length > 0 ? relevantContext.join(', ') : '';
  };

  if (!isOpen) return null;

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'rgba(0, 0, 0, 0.6)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 3000,
      backdropFilter: 'blur(4px)'
    }}>
      <div style={{
        backgroundColor: 'white',
        borderRadius: '12px',
        padding: '2rem',
        maxWidth: '600px',
        width: '95%',
        maxHeight: '80vh',
        overflowY: 'auto',
        boxShadow: '0 20px 40px rgba(0,0,0,0.2)',
        position: 'relative'
      }}>
        {/* Close button */}
        <button
          onClick={onClose}
          style={{
            position: 'absolute',
            top: '1rem',
            right: '1rem',
            background: 'none',
            border: 'none',
            fontSize: '24px',
            cursor: 'pointer',
            color: ginkgoTheme.colors.text.secondary,
            padding: '8px',
            borderRadius: '50%',
            width: '40px',
            height: '40px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            transition: 'all 0.2s ease'
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = ginkgoTheme.colors.secondary.veryLightGreen;
            e.currentTarget.style.color = ginkgoTheme.colors.primary.green;
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = 'transparent';
            e.currentTarget.style.color = ginkgoTheme.colors.text.secondary;
          }}
        >
          ×
        </button>

        {/* Header */}
        <div style={{ marginBottom: '2rem', paddingRight: '3rem' }}>
          <h2 style={{
            margin: '0 0 0.5rem 0',
            color: ginkgoTheme.colors.primary.navy,
            fontSize: '28px',
            fontFamily: ginkgoTheme.typography.fontFamily.heading,
            fontWeight: 600
          }}>
            Find Your Location
          </h2>
          <p style={{
            margin: 0,
            color: ginkgoTheme.colors.text.secondary,
            fontSize: '16px',
            fontFamily: ginkgoTheme.typography.fontFamily.body,
            lineHeight: 1.5
          }}>
            Search for a city, address, or region to center your map and start analyzing your district.
          </p>
        </div>

        {/* Search Input */}
        <div style={{ marginBottom: '1.5rem' }}>
          <label style={{
            display: 'block',
            marginBottom: '0.5rem',
            fontWeight: 600,
            color: ginkgoTheme.colors.text.primary,
            fontFamily: ginkgoTheme.typography.fontFamily.body,
            fontSize: '16px'
          }}>
            Location Search
          </label>
          <div style={{ position: 'relative' }}>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => handleInputChange(e.target.value)}
              placeholder="Type a city, address, or region..."
              style={{
                width: '100%',
                padding: '16px 20px',
                border: `2px solid ${ginkgoTheme.colors.secondary.lightGray}`,
                borderRadius: '8px',
                fontSize: '16px',
                fontFamily: ginkgoTheme.typography.fontFamily.body,
                outline: 'none',
                transition: 'all 0.2s ease',
                boxSizing: 'border-box'
              }}
              onFocus={(e) => {
                e.target.style.borderColor = ginkgoTheme.colors.primary.green;
                e.target.style.boxShadow = `0 0 0 3px rgba(15, 234, 166, 0.1)`;
              }}
              onBlur={(e) => {
                e.target.style.borderColor = ginkgoTheme.colors.secondary.lightGray;
                e.target.style.boxShadow = 'none';
              }}
            />
            {loading && (
              <div style={{
                position: 'absolute',
                right: '16px',
                top: '50%',
                transform: 'translateY(-50%)',
                width: '20px',
                height: '20px',
                border: '2px solid transparent',
                borderTop: `2px solid ${ginkgoTheme.colors.primary.green}`,
                borderRadius: '50%',
                animation: 'spin 1s linear infinite'
              }} />
            )}
          </div>
        </div>

        {/* Error Message */}
        {error && (
          <div style={{
            padding: '12px 16px',
            backgroundColor: '#fef2f2',
            border: `1px solid #fecaca`,
            borderRadius: '8px',
            marginBottom: '1.5rem',
            color: '#dc2626',
            fontSize: '14px',
            fontFamily: ginkgoTheme.typography.fontFamily.body
          }}>
            {error}
          </div>
        )}

        {/* Autocomplete Suggestions */}
        {suggestions.length > 0 && !selectedSuggestion && (
          <div style={{
            marginBottom: '1.5rem',
            border: `1px solid ${ginkgoTheme.colors.secondary.lightGray}`,
            borderRadius: '8px',
            maxHeight: '300px',
            overflowY: 'auto'
          }}>
            {suggestions.map((suggestion, index) => (
              <div
                key={suggestion.id}
                onClick={() => handleSuggestionClick(suggestion)}
                style={{
                  padding: '16px 20px',
                  cursor: 'pointer',
                  borderBottom: index < suggestions.length - 1 ? 
                    `1px solid ${ginkgoTheme.colors.secondary.veryLightGreen}` : 'none',
                  transition: 'all 0.2s ease',
                  fontFamily: ginkgoTheme.typography.fontFamily.body
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = ginkgoTheme.colors.secondary.veryLightGreen;
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = 'transparent';
                }}
              >
                <div style={{
                  fontWeight: 600,
                  color: ginkgoTheme.colors.text.primary,
                  marginBottom: '4px',
                  fontSize: '16px'
                }}>
                  {suggestion.text}
                </div>
                <div style={{
                  fontSize: '14px',
                  color: ginkgoTheme.colors.text.secondary,
                  marginBottom: '4px'
                }}>
                  {suggestion.place_name}
                </div>
                <div style={{
                  fontSize: '12px',
                  color: ginkgoTheme.colors.primary.green,
                  fontWeight: 500
                }}>
                  {getLocationTypeDisplay(suggestion.place_type)}
                  {getContextInfo(suggestion.context) && 
                    ` • ${getContextInfo(suggestion.context)}`
                  }
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Selected Location Preview */}
        {selectedSuggestion && (
          <div style={{
            padding: '20px',
            backgroundColor: ginkgoTheme.colors.secondary.veryLightGreen,
            border: `2px solid ${ginkgoTheme.colors.primary.green}`,
            borderRadius: '8px',
            marginBottom: '2rem'
          }}>
            <div style={{
              fontWeight: 600,
              color: ginkgoTheme.colors.text.primary,
              marginBottom: '8px',
              fontSize: '18px',
              fontFamily: ginkgoTheme.typography.fontFamily.heading
            }}>
              Selected Location
            </div>
            <div style={{
              fontSize: '16px',
              color: ginkgoTheme.colors.text.primary,
              marginBottom: '4px',
              fontFamily: ginkgoTheme.typography.fontFamily.body
            }}>
              {selectedSuggestion.place_name}
            </div>
            <div style={{
              fontSize: '14px',
              color: ginkgoTheme.colors.primary.green,
              fontWeight: 500,
              fontFamily: ginkgoTheme.typography.fontFamily.body
            }}>
              {getLocationTypeDisplay(selectedSuggestion.place_type)}
            </div>
          </div>
        )}

        {/* Action Buttons */}
        <div style={{
          display: 'flex',
          gap: '16px',
          justifyContent: 'flex-end'
        }}>
          <button
            onClick={onClose}
            style={{
              padding: '12px 24px',
              backgroundColor: 'transparent',
              border: `2px solid ${ginkgoTheme.colors.secondary.lightGray}`,
              borderRadius: '6px',
              cursor: 'pointer',
              fontSize: '14px',
              fontWeight: 600,
              fontFamily: ginkgoTheme.typography.fontFamily.body,
              color: ginkgoTheme.colors.text.secondary,
              transition: 'all 0.3s ease'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = ginkgoTheme.colors.secondary.lightGray;
              e.currentTarget.style.transform = 'translateY(-1px)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = 'transparent';
              e.currentTarget.style.transform = 'translateY(0)';
            }}
          >
            Skip & Use Map
          </button>
          
          <button
            onClick={handleGoToLocation}
            disabled={!selectedSuggestion && suggestions.length !== 1}
            style={{
              padding: '12px 24px',
              backgroundColor: (!selectedSuggestion && suggestions.length !== 1) ?
                ginkgoTheme.colors.secondary.lightGray :
                ginkgoTheme.colors.primary.green,
              color: (!selectedSuggestion && suggestions.length !== 1) ?
                ginkgoTheme.colors.text.secondary :
                'white',
              border: 'none',
              borderRadius: '6px',
              cursor: (!selectedSuggestion && suggestions.length !== 1) ? 'not-allowed' : 'pointer',
              fontSize: '14px',
              fontWeight: 600,
              fontFamily: ginkgoTheme.typography.fontFamily.body,
              transition: 'all 0.3s ease',
              opacity: (!selectedSuggestion && suggestions.length !== 1) ? 0.6 : 1
            }}
            onMouseEnter={(e) => {
              if (selectedSuggestion || suggestions.length === 1) {
                e.currentTarget.style.backgroundColor = ginkgoTheme.colors.primary.orange;
                e.currentTarget.style.transform = 'translateY(-2px)';
                e.currentTarget.style.boxShadow = '0 4px 12px rgba(243, 113, 41, 0.4)';
              }
            }}
            onMouseLeave={(e) => {
              if (selectedSuggestion || suggestions.length === 1) {
                e.currentTarget.style.backgroundColor = ginkgoTheme.colors.primary.green;
                e.currentTarget.style.transform = 'translateY(0)';
                e.currentTarget.style.boxShadow = 'none';
              }
            }}
          >
            Go to Location
          </button>
        </div>
      </div>

      <style>
        {`
          @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
          }
        `}
      </style>
    </div>
  );
}