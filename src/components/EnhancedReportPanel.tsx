import React, { useState } from 'react';
import {
  BudgetParameters,
  DEFAULT_BUDGET_PARAMS,
  calculateBudget,
  determinePlaceTypology,
  getServiceDemandIndicators
} from '../utils/budgetCalculations';
import { generateBIDReportPDF, generatePDFForEmail } from '../utils/pdfExport';
import { ginkgoTheme } from '../styles/ginkgoTheme';
import { Pie } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  ArcElement,
  Tooltip,
  Legend
} from 'chart.js';

// Register Chart.js components
ChartJS.register(ArcElement, Tooltip, Legend);

interface EnhancedReportPanelProps {
  data: any;
  onClose: () => void;
  mapVisible?: boolean;
  onFullReportToggle?: (isFullReport: boolean) => void;
  polygon?: any; // For PDF map generation
  mapboxToken?: string; // For PDF map generation
}

export function EnhancedReportPanel({ data, onClose, mapVisible = true, onFullReportToggle, polygon, mapboxToken }: EnhancedReportPanelProps) {
  const [params, setParams] = useState<BudgetParameters>(DEFAULT_BUDGET_PARAMS);
  const [activeTab, setActiveTab] = useState<'executive' | 'details' | 'parameters'>('executive');
  const [showFullReport, setShowFullReport] = useState(!mapVisible);
  
  // Calculate budget with current parameters
  const budget = calculateBudget(
    params,
    data.totalPlaces,
    data.areaAcres,
    data.perimeterFt || data.areaAcres * 1320, // Estimate if not provided
    data.categoryBreakdown
  );
  
  const placeTypology = determinePlaceTypology(data.categoryBreakdown, data.totalPlaces);
  const serviceDemands = getServiceDemandIndicators(
    data.totalPlaces,
    data.areaAcres,
    data.categoryBreakdown,
    budget.cleanIntensity,
    budget.nightIntensity
  );
  
  // Update parameter
  const updateParam = (key: keyof BudgetParameters, value: any) => {
    setParams(prev => ({ ...prev, [key]: value }));
  };
  
  // Export to PDF
  const exportToPDF = async () => {
    await generateBIDReportPDF({
      data,
      budget,
      placeTypology,
      serviceDemands,
      params,
      polygon,
      mapboxToken
    });
  };
  
  // Share via email
  const [showShareModal, setShowShareModal] = useState(false);
  const [emailList, setEmailList] = useState('');
  const [shareLoading, setShareLoading] = useState(false);
  
  const handleShareReport = async () => {
    if (!emailList.trim()) {
      alert('Please enter at least one email address');
      return;
    }
    
    // Validate email format (basic validation)
    const emails = emailList.split(',').map(email => email.trim()).filter(email => email);
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const invalidEmails = emails.filter(email => !emailRegex.test(email));
    
    if (invalidEmails.length > 0) {
      alert(`Invalid email addresses: ${invalidEmails.join(', ')}`);
      return;
    }
    
    setShareLoading(true);
    
    try {
      // Generate PDF data as base64
      const pdfResponse = await generatePDFForEmail({
        data,
        budget,
        placeTypology,
        serviceDemands,
        params
      });
      
      // Send email via Netlify function
      const response = await fetch('/.netlify/functions/send-email', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          emails: emails,
          reportData: {
            placeTypology,
            totalPlaces: data.totalPlaces,
            areaAcres: data.areaAcres.toFixed(1),
            totalBudget: budget.total
          },
          pdfData: pdfResponse.base64
        }),
      });
      
      if (response.ok) {
        alert(`Report successfully sent to ${emails.length} recipient${emails.length > 1 ? 's' : ''}!`);
        setShowShareModal(false);
        setEmailList('');
      } else {
        const error = await response.json();
        throw new Error(error.message || 'Failed to send email');
      }
    } catch (error) {
      console.error('Error sharing report:', error);
      alert('Failed to send report. Please try again.');
    } finally {
      setShareLoading(false);
    }
  };
  
  const panelStyle: React.CSSProperties = {
    position: 'absolute',
    top: 0,
    right: 0,
    width: mapVisible && !showFullReport ? '50%' : '100%',
    height: '100%',
    backgroundColor: 'white',
    borderLeft: mapVisible ? '2px solid #e2e8f0' : 'none',
    boxShadow: mapVisible ? '-4px 0 10px rgba(0,0,0,0.1)' : 'none',
    display: 'flex',
    flexDirection: 'column',
    transition: 'width 0.3s ease',
    zIndex: 1000,
  };
  
  return (
    <div style={panelStyle}>
      {/* Header */}
      <div style={{
        padding: '1rem 1.5rem',
        borderBottom: `2px solid ${ginkgoTheme.colors.secondary.lightGray}`,
        backgroundColor: ginkgoTheme.colors.background.main,
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center'
      }}>
        <div>
          <h2 style={{ 
            margin: 0, 
            color: ginkgoTheme.colors.primary.navy, 
            fontSize: '24px',
            fontFamily: ginkgoTheme.typography.fontFamily.heading,
            fontWeight: 600
          }}>
            BID Budget Analysis
          </h2>
          <p style={{ 
            margin: '0.25rem 0 0', 
            color: ginkgoTheme.colors.text.secondary, 
            fontSize: '14px',
            fontFamily: ginkgoTheme.typography.fontFamily.body
          }}>
            {placeTypology} • {data.totalPlaces} businesses • {data.areaAcres.toFixed(1)} acres
          </p>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
          {mapVisible && (
            <button
              onClick={() => {
                const newFullReportState = !showFullReport;
                setShowFullReport(newFullReportState);
                onFullReportToggle?.(newFullReportState);
              }}
              style={{
                padding: '12px 24px',
                backgroundColor: 'transparent',
                border: `1px solid ${ginkgoTheme.colors.secondary.lightGray}`,
                borderRadius: '6px',
                cursor: 'pointer',
                fontSize: '14px',
                fontFamily: ginkgoTheme.typography.fontFamily.body,
                color: ginkgoTheme.colors.text.secondary,
                transition: 'all 0.2s ease'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = ginkgoTheme.colors.secondary.veryLightGreen;
                e.currentTarget.style.borderColor = ginkgoTheme.colors.primary.green;
                e.currentTarget.style.color = ginkgoTheme.colors.primary.green;
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = 'transparent';
                e.currentTarget.style.borderColor = ginkgoTheme.colors.secondary.lightGray;
                e.currentTarget.style.color = ginkgoTheme.colors.text.secondary;
              }}
            >
              {showFullReport ? 'Split View' : 'Full Report'}
            </button>
          )}
          <button
            onClick={exportToPDF}
            style={{
              padding: '12px 24px',
              backgroundColor: ginkgoTheme.colors.primary.orange,
              color: 'white',
              border: 'none',
              borderRadius: '6px',
              cursor: 'pointer',
              fontSize: '14px',
              fontWeight: 600,
              fontFamily: ginkgoTheme.typography.fontFamily.body,
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              transition: 'all 0.3s ease'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = ginkgoTheme.colors.primary.green;
              e.currentTarget.style.transform = 'translateY(-2px)';
              e.currentTarget.style.boxShadow = '0 4px 12px rgba(15, 234, 166, 0.4)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = ginkgoTheme.colors.primary.orange;
              e.currentTarget.style.transform = 'translateY(0)';
              e.currentTarget.style.boxShadow = 'none';
            }}
          >
            Export PDF
          </button>
          <button
            onClick={() => setShowShareModal(true)}
            style={{
              padding: '12px 24px',
              backgroundColor: '#162d54', // Navy blue
              color: 'white',
              border: 'none',
              borderRadius: '6px',
              cursor: 'pointer',
              fontSize: '14px',
              fontWeight: 600,
              fontFamily: ginkgoTheme.typography.fontFamily.body,
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              transition: 'all 0.3s ease'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = 'rgb(15, 234, 166)'; // Green hover
              e.currentTarget.style.transform = 'translateY(-2px)';
              e.currentTarget.style.boxShadow = '0 4px 12px rgba(15, 234, 166, 0.4)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = '#162d54'; // Back to navy blue
              e.currentTarget.style.transform = 'translateY(0)';
              e.currentTarget.style.boxShadow = 'none';
            }}
          >
            Share Report
          </button>
          <button
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              fontSize: '1.5rem',
              cursor: 'pointer',
              padding: '0.5rem',
              color: '#64748b'
            }}
          >
            ✕
          </button>
        </div>
      </div>
      
      {/* Tabs */}
      <div style={{
        display: 'flex',
        borderBottom: `1px solid ${ginkgoTheme.colors.secondary.lightGray}`,
        backgroundColor: ginkgoTheme.colors.background.main
      }}>
        {(['executive', 'details', 'parameters'] as const).map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            style={{
              padding: '0.75rem 1.5rem',
              backgroundColor: activeTab === tab ? 'white' : 'transparent',
              border: 'none',
              borderBottom: activeTab === tab ? `2px solid ${ginkgoTheme.colors.primary.navy}` : '2px solid transparent',
              cursor: 'pointer',
              fontWeight: activeTab === tab ? 600 : 400,
              fontFamily: ginkgoTheme.typography.fontFamily.body,
              color: activeTab === tab ? ginkgoTheme.colors.primary.navy : ginkgoTheme.colors.text.secondary,
              textTransform: 'capitalize',
              transition: 'all 0.2s ease'
            }}
          >
            {tab === 'executive' ? 'Executive Summary' :
             tab === 'details' ? 'Service Details' :
             'Budget Parameters'}
          </button>
        ))}
      </div>
      
      {/* Content */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '1.5rem' }}>
        {activeTab === 'executive' && (
          <ExecutiveSummary
            data={data}
            budget={budget}
            placeTypology={placeTypology}
            serviceDemands={serviceDemands}
          />
        )}
        
        {activeTab === 'details' && (
          <ServiceDetails
            data={data}
            budget={budget}
            serviceDemands={serviceDemands}
            params={params}
          />
        )}
        
        {activeTab === 'parameters' && (
          <ParameterSliders
            params={params}
            updateParam={updateParam}
            budget={budget}
          />
        )}
      </div>

      {/* Share Modal */}
      {showShareModal && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0,0,0,0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 2000
        }}>
          <div style={{
            backgroundColor: 'white',
            borderRadius: '12px',
            padding: '2rem',
            maxWidth: '600px',
            width: '95%',
            maxHeight: '90vh',
            overflowY: 'auto',
            boxShadow: '0 20px 40px rgba(0,0,0,0.15)'
          }}>
            <h3 style={{ marginTop: 0, color: ginkgoTheme.colors.primary.navy, fontFamily: ginkgoTheme.typography.fontFamily.heading, fontWeight: 600, fontSize: '20px' }}>
              Share BID Report
            </h3>
            <p style={{ color: '#64748b', marginBottom: '1.5rem' }}>
              Enter email addresses (separated by commas) to share this budget report as a PDF attachment.
            </p>
            
            <div style={{ marginBottom: '1.5rem' }}>
              <label style={{ 
                display: 'block', 
                marginBottom: '0.5rem', 
                fontWeight: 600, 
                color: '#374151' 
              }}>
                Email Recipients:
              </label>
              <textarea
                value={emailList}
                onChange={(e) => setEmailList(e.target.value)}
                placeholder="john@company.com, mary@board.org, planning@city.gov"
                style={{
                  width: '100%',
                  minHeight: '80px',
                  padding: '12px 16px',
                  border: `2px solid ${ginkgoTheme.colors.secondary.lightGray}`,
                  borderRadius: '6px',
                  fontSize: '14px',
                  fontFamily: ginkgoTheme.typography.fontFamily.body,
                  resize: 'vertical',
                  outline: 'none',
                  transition: 'all 0.2s ease',
                  backgroundColor: ginkgoTheme.colors.background.main,
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
              <div style={{ 
                fontSize: '0.8rem', 
                color: '#6b7280', 
                marginTop: '0.5rem' 
              }}>
                Tip: Separate multiple email addresses with commas
              </div>
            </div>
            
            <div style={{ 
              backgroundColor: '#f8fafc', 
              padding: '1rem', 
              borderRadius: '6px', 
              marginBottom: '1.5rem' 
            }}>
              <h4 style={{ margin: '0 0 0.5rem', fontSize: '0.9rem', color: '#374151' }}>
                Report Summary:
              </h4>
              <div style={{ fontSize: '0.85rem', color: '#6b7280' }}>
                <div>• {placeTypology} with {data.totalPlaces} businesses</div>
                <div>• {data.areaAcres.toFixed(1)} acres coverage area</div>
                <div>• ${budget.total.toLocaleString()} annual budget estimate</div>
              </div>
            </div>
            
            <div style={{ 
              display: 'flex', 
              gap: '1rem', 
              justifyContent: 'flex-end' 
            }}>
              <button
                onClick={() => {
                  setShowShareModal(false);
                  setEmailList('');
                }}
                disabled={shareLoading}
                style={{
                  padding: '12px 24px',
                  backgroundColor: 'transparent',
                  border: `2px solid ${shareLoading ? ginkgoTheme.colors.secondary.lightGray : ginkgoTheme.colors.secondary.lightGray}`,
                  borderRadius: '6px',
                  cursor: shareLoading ? 'not-allowed' : 'pointer',
                  fontSize: '14px',
                  fontWeight: 600,
                  fontFamily: ginkgoTheme.typography.fontFamily.body,
                  color: shareLoading ? ginkgoTheme.colors.text.secondary : ginkgoTheme.colors.text.secondary,
                  transition: 'all 0.3s ease',
                  opacity: shareLoading ? 0.5 : 1
                }}
                onMouseEnter={(e) => {
                  if (!shareLoading) {
                    e.currentTarget.style.backgroundColor = ginkgoTheme.colors.secondary.lightGray;
                    e.currentTarget.style.transform = 'translateY(-1px)';
                  }
                }}
                onMouseLeave={(e) => {
                  if (!shareLoading) {
                    e.currentTarget.style.backgroundColor = 'transparent';
                    e.currentTarget.style.transform = 'translateY(0)';
                  }
                }}
              >
                Cancel
              </button>
              <button
                onClick={handleShareReport}
                disabled={shareLoading || !emailList.trim()}
                style={{
                  padding: '12px 24px',
                  backgroundColor: shareLoading || !emailList.trim() ? 
                    ginkgoTheme.colors.secondary.lightGray : 
                    ginkgoTheme.colors.primary.green,
                  color: shareLoading || !emailList.trim() ? 
                    ginkgoTheme.colors.text.secondary : 
                    'white',
                  border: 'none',
                  borderRadius: '6px',
                  cursor: shareLoading || !emailList.trim() ? 'not-allowed' : 'pointer',
                  fontSize: '14px',
                  fontWeight: 600,
                  fontFamily: ginkgoTheme.typography.fontFamily.body,
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  transition: 'all 0.3s ease',
                  opacity: shareLoading || !emailList.trim() ? 0.6 : 1
                }}
                onMouseEnter={(e) => {
                  if (!shareLoading && emailList.trim()) {
                    e.currentTarget.style.backgroundColor = ginkgoTheme.colors.primary.orange;
                    e.currentTarget.style.transform = 'translateY(-2px)';
                    e.currentTarget.style.boxShadow = '0 4px 12px rgba(243, 113, 41, 0.4)';
                  }
                }}
                onMouseLeave={(e) => {
                  if (!shareLoading && emailList.trim()) {
                    e.currentTarget.style.backgroundColor = ginkgoTheme.colors.primary.green;
                    e.currentTarget.style.transform = 'translateY(0)';
                    e.currentTarget.style.boxShadow = 'none';
                  }
                }}
              >
                {shareLoading ? (
                  <>
                    <div style={{
                      width: '16px',
                      height: '16px',
                      border: '2px solid transparent',
                      borderTop: '2px solid white',
                      borderRadius: '50%',
                      animation: 'spin 1s linear infinite'
                    }} />
                    Sending...
                  </>
                ) : (
                  <>Send Report</>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

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

// Executive Summary Component
function ExecutiveSummary({ data, budget, placeTypology, serviceDemands }: any) {
  const getTypologyColor = (typology: string) => {
    const colors: Record<string, string> = {
      'Retail Core': '#8b5cf6',
      'Dining District': '#ef4444',
      'Mixed-Use District': '#0ea5e9',
      'Diverse Business Mix': '#10b981',
      'Service Hub': '#f59e0b',
      'Entertainment Zone': '#ec4899',
      'General Commercial': '#6b7280'
    };
    return colors[typology] || '#6b7280';
  };
  
  return (
    <div>
      {/* Key Metrics Grid */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
        gap: '1rem',
        marginBottom: '2rem'
      }}>
        <MetricCard
          title="Annual Budget"
          value={`$${budget.total.toLocaleString()}`}
          subtitle={`$${budget.costPerBusiness.toLocaleString()} per business`}
          color="#0ea5e9"
        />
        <MetricCard
          title="Business Density"
          value={`${(data.totalPlaces / data.areaAcres).toFixed(1)}`}
          subtitle="per acre"
          color="#059669"
        />
        <MetricCard
          title="Service Intensity"
          value={budget.cleanIntensity.toFixed(2)}
          subtitle={budget.cleanIntensity > 1.15 ? 'High demand' : 
                   budget.cleanIntensity > 1.05 ? 'Moderate' : 'Standard'}
          color="#f59e0b"
        />
        <MetricCard
          title="District Type"
          value={placeTypology}
          subtitle={`${data.totalPlaces} total businesses`}
          color={getTypologyColor(placeTypology)}
        />
      </div>
      
      {/* Budget Breakdown */}
      <div style={{
        backgroundColor: '#f8fafc',
        borderRadius: '8px',
        padding: '1.5rem',
        marginBottom: '2rem'
      }}>
        <h3 style={{ marginTop: 0, marginBottom: '1rem', color: '#1e293b' }}>
          Budget Allocation
        </h3>
        <BudgetBar budget={budget} />
        <div style={{ marginTop: '1.5rem' }}>
          <BudgetLineItemWithColor label="Cleaning & Maintenance" value={budget.cleaning} percentage={(budget.cleaning / budget.subtotal * 100).toFixed(0)} color="#0ea5e9" />
          <BudgetLineItemWithColor label="Safety & Hospitality" value={budget.safety} percentage={(budget.safety / budget.subtotal * 100).toFixed(0)} color="#059669" />
          <BudgetLineItemWithColor label="Marketing & Events" value={budget.marketing} percentage={(budget.marketing / budget.subtotal * 100).toFixed(0)} color="#f59e0b" />
          <BudgetLineItemWithColor label="Streetscape Assets" value={budget.assets} percentage={(budget.assets / budget.subtotal * 100).toFixed(0)} color="#8b5cf6" />
        </div>
      </div>
      
      {/* Priority Services */}
      <div style={{
        backgroundColor: '#fef3c7',
        borderRadius: '8px',
        padding: '1.5rem',
        marginBottom: '2rem'
      }}>
        <h3 style={{ marginTop: 0, marginBottom: '1rem', color: '#92400e' }}>
          🎯 Priority Service Recommendations
        </h3>
        <ServicePriorities serviceDemands={serviceDemands} />
      </div>
      
      {/* Quick Decision Points */}
      <div style={{
        backgroundColor: '#f0f9ff',
        borderRadius: '8px',
        padding: '1.5rem'
      }}>
        <h3 style={{ marginTop: 0, marginBottom: '1rem', color: '#075985' }}>
          ✅ Key Decision Points
        </h3>
        <ul style={{ margin: 0, paddingLeft: '1.5rem' }}>
          <li>Budget represents <strong>${budget.costPerBusiness.toLocaleString()}</strong> annual cost per business</li>
          <li>Coverage area of <strong>{data.areaAcres.toFixed(1)} acres</strong> at ${budget.costPerAcre.toLocaleString()}/acre</li>
          <li>Staffing estimate: <strong>{budget.cleanersNeeded}</strong> cleaners, <strong>{budget.supervisorsNeeded}</strong> supervisors</li>
          {budget.safetyFTE > 0 && <li>Safety coverage: <strong>{budget.safetyFTE.toFixed(1)}</strong> FTE ambassadors</li>}
        </ul>
      </div>
      
      {/* Categories Distribution Pie Chart */}
      <div style={{
        backgroundColor: 'white',
        borderRadius: '8px',
        padding: '1.5rem',
        marginTop: '2rem',
        border: '1px solid #e2e8f0'
      }}>
        <h3 style={{ marginTop: 0, marginBottom: '1.5rem', color: ginkgoTheme.colors.primary.navy, fontFamily: ginkgoTheme.typography.fontFamily.heading }}>
          Business Category Distribution
        </h3>
        <CategoryPieChart data={data} />
      </div>
    </div>
  );
}

// Service Details Component
function ServiceDetails({ data, budget, serviceDemands, params }: any) {
  return (
    <div>
      {/* Cleaning Services */}
      <ServiceSection
        title="Cleaning & Maintenance"
        icon="🧹"
        cost={budget.cleaning}
        priority={serviceDemands.cleaning.priority}
        needs={serviceDemands.cleaning.needs}
        details={[
          `${budget.cleanersNeeded} cleaners needed per day`,
          `${budget.supervisorsNeeded} supervisors`,
          `${params.clean_days_per_week} days per week coverage`,
          `${budget.frontageEstimate.toLocaleString()} ft estimated frontage`
        ]}
      />
      
      {/* Safety Services */}
      <ServiceSection
        title="Safety & Hospitality"
        icon="🛡️"
        cost={budget.safety}
        priority={serviceDemands.safety.priority}
        needs={serviceDemands.safety.needs}
        details={[
          params.safety_enabled ? `${budget.safetyFTE.toFixed(1)} FTE ambassadors` : 'Service not enabled',
          `Night economy factor: ${budget.nightIntensity.toFixed(2)}`,
          `${params.safety_days_per_week} days per week coverage`,
          `${params.safety_hours_per_day} hours per day`
        ]}
      />
      
      {/* Marketing Services */}
      <ServiceSection
        title="Marketing & Events"
        icon="📣"
        cost={budget.marketing}
        priority={serviceDemands.marketing.priority}
        needs={serviceDemands.marketing.needs}
        details={[
          `Base budget: $${params.marketing_base_annual.toLocaleString()}`,
          `Per business: $${params.marketing_per_business}`,
          `${params.events_per_year} annual events`,
          `$${params.cost_per_event.toLocaleString()} per event`
        ]}
      />
      
      {/* Streetscape Assets */}
      <div style={{
        backgroundColor: '#f8fafc',
        borderRadius: '8px',
        padding: '1.5rem',
        marginBottom: '1.5rem'
      }}>
        <h3 style={{ marginTop: 0, color: '#1e293b' }}>
          🌳 Streetscape Assets (Annualized)
        </h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1rem' }}>
          <AssetCard
            name="Trash Cans"
            count={Math.ceil(budget.frontageEstimate / params.feet_per_trash_can)}
            unitCost={params.trash_can_unit_cost}
            lifeYears={params.trash_can_life_years}
          />
          <AssetCard
            name="Planters"
            count={Math.ceil(budget.frontageEstimate / params.feet_per_planter)}
            unitCost={params.planter_unit_cost}
            lifeYears={params.planter_life_years}
          />
          <AssetCard
            name="Banners"
            count={Math.ceil(budget.frontageEstimate / params.feet_per_banner)}
            unitCost={params.banner_unit_cost}
            lifeYears={params.banner_life_years}
          />
        </div>
      </div>
    </div>
  );
}

// Parameter Sliders Component
function ParameterSliders({ params, updateParam, budget }: any) {
  return (
    <div>
      <div style={{
        backgroundColor: '#fef3c7',
        borderRadius: '8px',
        padding: '1rem',
        marginBottom: '1.5rem'
      }}>
        <p style={{ margin: 0, color: '#92400e' }}>
          ⚠️ Adjust parameters below to see real-time budget impact. Default values are based on industry standards.
        </p>
      </div>
      
      {/* Live Budget Display */}
      <div style={{
        position: 'sticky',
        top: 0,
        backgroundColor: 'white',
        padding: '1rem',
        borderBottom: '2px solid #e2e8f0',
        marginBottom: '1.5rem',
        zIndex: 10
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h3 style={{ margin: 0 }}>Total Annual Budget:</h3>
          <div style={{ fontSize: '2rem', fontWeight: 'bold', color: '#0ea5e9' }}>
            ${budget.total.toLocaleString()}
          </div>
        </div>
      </div>
      
      {/* Cleaning Parameters */}
      <ParameterSection title="Cleaning & Maintenance">
        <SliderInput
          label="Cleaner Hourly Rate (loaded)"
          value={params.clean_loaded_rate}
          min={20}
          max={50}
          step={1}
          unit="$/hr"
          onChange={(v) => updateParam('clean_loaded_rate', v)}
        />
        <SliderInput
          label="Days per Week"
          value={params.clean_days_per_week}
          min={3}
          max={7}
          step={1}
          onChange={(v) => updateParam('clean_days_per_week', v)}
        />
        <SliderInput
          label="Productivity (ft/hour)"
          value={params.frontage_ft_per_cleaner_hour}
          min={500}
          max={1500}
          step={50}
          unit="ft"
          onChange={(v) => updateParam('frontage_ft_per_cleaner_hour', v)}
        />
        <SliderInput
          label="Supervisor Ratio"
          value={params.supervisor_ratio}
          min={4}
          max={12}
          step={1}
          unit=":1"
          onChange={(v) => updateParam('supervisor_ratio', v)}
        />
      </ParameterSection>
      
      {/* Safety Parameters */}
      <ParameterSection title="Safety & Hospitality">
        <div style={{ marginBottom: '1rem' }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <input
              type="checkbox"
              checked={params.safety_enabled}
              onChange={(e) => updateParam('safety_enabled', e.target.checked)}
            />
            <span>Enable Safety Services</span>
          </label>
        </div>
        {params.safety_enabled && (
          <>
            <SliderInput
              label="Ambassador Hourly Rate"
              value={params.safety_loaded_rate}
              min={25}
              max={60}
              step={1}
              unit="$/hr"
              onChange={(v) => updateParam('safety_loaded_rate', v)}
            />
            <SliderInput
              label="Hours per Day"
              value={params.safety_hours_per_day}
              min={8}
              max={24}
              step={1}
              unit="hrs"
              onChange={(v) => updateParam('safety_hours_per_day', v)}
            />
            <SliderInput
              label="Days per Week"
              value={params.safety_days_per_week}
              min={3}
              max={7}
              step={1}
              onChange={(v) => updateParam('safety_days_per_week', v)}
            />
          </>
        )}
      </ParameterSection>
      
      {/* Marketing Parameters */}
      <ParameterSection title="Marketing & Events">
        <SliderInput
          label="Base Annual Marketing"
          value={params.marketing_base_annual}
          min={10000}
          max={100000}
          step={5000}
          unit="$"
          onChange={(v) => updateParam('marketing_base_annual', v)}
        />
        <SliderInput
          label="Per Business Marketing"
          value={params.marketing_per_business}
          min={20}
          max={200}
          step={10}
          unit="$"
          onChange={(v) => updateParam('marketing_per_business', v)}
        />
        <SliderInput
          label="Events per Year"
          value={params.events_per_year}
          min={0}
          max={24}
          step={1}
          onChange={(v) => updateParam('events_per_year', v)}
        />
        <SliderInput
          label="Cost per Event"
          value={params.cost_per_event}
          min={1000}
          max={20000}
          step={1000}
          unit="$"
          onChange={(v) => updateParam('cost_per_event', v)}
        />
      </ParameterSection>
      
      {/* Admin Overhead */}
      <ParameterSection title="Administration">
        <SliderInput
          label="Admin Overhead"
          value={params.admin_overhead_pct * 100}
          min={5}
          max={25}
          step={1}
          unit="%"
          onChange={(v) => updateParam('admin_overhead_pct', v / 100)}
        />
      </ParameterSection>
    </div>
  );
}

// Helper Components
function MetricCard({ title, value, subtitle, color }: any) {
  return (
    <div style={{
      backgroundColor: 'white',
      border: '1px solid #e2e8f0',
      borderRadius: '8px',
      padding: '1rem',
      borderTop: `3px solid ${color}`
    }}>
      <div style={{ fontSize: '0.9rem', color: '#64748b', marginBottom: '0.25rem' }}>
        {title}
      </div>
      <div style={{ fontSize: '1.5rem', fontWeight: 'bold', color }}>
        {value}
      </div>
      <div style={{ fontSize: '0.85rem', color: '#94a3b8' }}>
        {subtitle}
      </div>
    </div>
  );
}

function BudgetBar({ budget }: any) {
  const total = budget.subtotal;
  const segments = [
    { label: 'Cleaning', value: budget.cleaning, color: '#0ea5e9' },
    { label: 'Safety', value: budget.safety, color: '#059669' },
    { label: 'Marketing', value: budget.marketing, color: '#f59e0b' },
    { label: 'Assets', value: budget.assets, color: '#8b5cf6' }
  ];
  
  return (
    <div style={{
      display: 'flex',
      height: '40px',
      borderRadius: '4px',
      overflow: 'hidden',
      border: '1px solid #e2e8f0'
    }}>
      {segments.map((seg, i) => (
        <div
          key={i}
          style={{
            width: `${(seg.value / total * 100)}%`,
            backgroundColor: seg.color,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'white',
            fontSize: '0.8rem',
            fontWeight: 600
          }}
        >
          {seg.value / total > 0.1 && `${(seg.value / total * 100).toFixed(0)}%`}
        </div>
      ))}
    </div>
  );
}

function BudgetLineItem({ label, value, percentage }: any) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0.5rem 0' }}>
      <span style={{ color: '#64748b' }}>{label}</span>
      <span style={{ fontWeight: 600 }}>
        ${value.toLocaleString()} ({percentage}%)
      </span>
    </div>
  );
}

function BudgetLineItemWithColor({ label, value, percentage, color }: any) {
  return (
    <div style={{ 
      display: 'flex', 
      alignItems: 'center', 
      padding: '0.75rem 0',
      borderBottom: '1px solid #e2e8f0'
    }}>
      {/* Color indicator */}
      <div style={{
        width: '16px',
        height: '16px',
        backgroundColor: color,
        borderRadius: '3px',
        marginRight: '12px',
        flexShrink: 0
      }} />
      
      {/* Service name */}
      <span style={{ 
        color: '#374151',
        fontFamily: ginkgoTheme.typography.fontFamily.body,
        fontWeight: 500,
        flexGrow: 1
      }}>
        {label}
      </span>
      
      {/* Amount and percentage */}
      <span style={{ 
        fontWeight: 600,
        color: '#1e293b',
        fontFamily: ginkgoTheme.typography.fontFamily.body
      }}>
        ${value.toLocaleString()} ({percentage}%)
      </span>
    </div>
  );
}

function ServicePriorities({ serviceDemands }: any) {
  const allNeeds = [
    ...serviceDemands.cleaning.needs.map((n: string) => ({ service: 'Cleaning', need: n, priority: serviceDemands.cleaning.priority })),
    ...serviceDemands.safety.needs.map((n: string) => ({ service: 'Safety', need: n, priority: serviceDemands.safety.priority })),
    ...serviceDemands.marketing.needs.map((n: string) => ({ service: 'Marketing', need: n, priority: serviceDemands.marketing.priority }))
  ];
  
  // Sort by priority
  const sortedNeeds = allNeeds.sort((a, b) => {
    const priorityOrder = { 'High': 0, 'Medium': 1, 'Standard': 2 };
    return priorityOrder[a.priority] - priorityOrder[b.priority];
  });
  
  return (
    <ul style={{ margin: 0, paddingLeft: '1.5rem' }}>
      {sortedNeeds.slice(0, 5).map((item, i) => (
        <li key={i} style={{ marginBottom: '0.5rem' }}>
          <strong>{item.service}:</strong> {item.need}
        </li>
      ))}
    </ul>
  );
}

function ServiceSection({ title, icon, cost, priority, needs, details }: any) {
  const priorityColors = {
    'High': '#dc2626',
    'Medium': '#f59e0b',
    'Standard': '#059669'
  };
  
  return (
    <div style={{
      backgroundColor: '#f8fafc',
      borderRadius: '8px',
      padding: '1.5rem',
      marginBottom: '1.5rem'
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
        <h3 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <span style={{ fontSize: '1.5rem' }}>{icon}</span>
          {title}
        </h3>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <span style={{
            padding: '0.25rem 0.75rem',
            backgroundColor: priorityColors[priority] + '20',
            color: priorityColors[priority],
            borderRadius: '20px',
            fontSize: '0.85rem',
            fontWeight: 600
          }}>
            {priority} Priority
          </span>
          <span style={{ fontSize: '1.25rem', fontWeight: 'bold' }}>
            ${cost.toLocaleString()}
          </span>
        </div>
      </div>
      
      {needs.length > 0 && (
        <div style={{ marginBottom: '1rem' }}>
          <strong>Service Needs:</strong>
          <ul style={{ margin: '0.5rem 0 0 1.5rem', padding: 0 }}>
            {needs.map((need: string, i: number) => (
              <li key={i} style={{ marginBottom: '0.25rem' }}>{need}</li>
            ))}
          </ul>
        </div>
      )}
      
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '0.5rem' }}>
        {details.map((detail: string, i: number) => (
          <div key={i} style={{ fontSize: '0.9rem', color: '#64748b' }}>
            • {detail}
          </div>
        ))}
      </div>
    </div>
  );
}

function AssetCard({ name, count, unitCost, lifeYears }: any) {
  const annualCost = (count * unitCost) / lifeYears;
  
  return (
    <div style={{
      padding: '1rem',
      backgroundColor: 'white',
      border: '1px solid #e2e8f0',
      borderRadius: '4px'
    }}>
      <div style={{ fontWeight: 600, marginBottom: '0.5rem' }}>{name}</div>
      <div style={{ fontSize: '0.9rem', color: '#64748b' }}>
        <div>Quantity: {count}</div>
        <div>Unit cost: ${unitCost}</div>
        <div>Life: {lifeYears} years</div>
        <div style={{ marginTop: '0.5rem', fontWeight: 600, color: '#1e293b' }}>
          Annual: ${Math.round(annualCost).toLocaleString()}
        </div>
      </div>
    </div>
  );
}

function ParameterSection({ title, children }: any) {
  return (
    <div style={{
      marginBottom: '2rem',
      padding: '1.5rem',
      backgroundColor: '#f8fafc',
      borderRadius: '8px'
    }}>
      <h3 style={{ marginTop: 0, marginBottom: '1rem', color: '#1e293b' }}>
        {title}
      </h3>
      {children}
    </div>
  );
}

function SliderInput({ label, value, min, max, step, unit = '', onChange }: any) {
  return (
    <div style={{ marginBottom: '1rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
        <label style={{ fontSize: '0.9rem', color: '#64748b' }}>{label}</label>
        <span style={{ fontWeight: 600 }}>
          {unit && unit !== '$' && unit !== '%' && !unit.startsWith(':') ? value.toLocaleString() + ' ' + unit :
           unit === '$' ? '$' + value.toLocaleString() :
           unit === '%' ? value.toFixed(0) + '%' :
           unit.startsWith(':') ? value + unit :
           value.toLocaleString()}
        </span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        style={{
          width: '100%',
          height: '6px',
          borderRadius: '3px',
          background: `linear-gradient(to right, #0ea5e9 0%, #0ea5e9 ${((value - min) / (max - min) * 100)}%, #e2e8f0 ${((value - min) / (max - min) * 100)}%, #e2e8f0 100%)`,
          outline: 'none',
          WebkitAppearance: 'none'
        }}
      />
    </div>
  );
}

// Category Pie Chart Component
function CategoryPieChart({ data }: { data: any }) {
  // Get category colors (same as used in map - updated for better visibility)
  const CATEGORY_COLORS: Record<string, string> = {
    food_and_drink: "#f37129",     // Ginkgo orange
    shopping: "#0feaa6",            // Ginkgo green
    health: "#034744",              // Ginkgo dark teal
    education: "#162e54",           // Ginkgo navy
    entertainment: "#ec4899",       // Pink for better visibility
    transportation: "#06b6d4",      // Cyan for better visibility
    finance: "#8b5cf6",             // Purple for better visibility
    government: "#9e765f",          // Brown
    other: "#6b7280",               // Gray for uncategorized
    retail: "#0feaa6",              // Map retail to green
    restaurant: "#f37129",          // Map restaurant to orange
    service: "#034744",             // Map service to dark teal
  };
  
  // Comprehensive color mapping for all business categories
  const EXTENDED_COLORS: Record<string, string> = {
    ...CATEGORY_COLORS,
    
    // === From Screenshot - High Priority ===
    "beauty_salon": "#e11d48",           // Rose
    "professional_services": "#3b82f6", // Blue  
    "tattoo_and_piercing": "#a855f7",   // Purple
    "community_services_non_profits": "#22c55e", // Green
    "landmark_and_historical_building": "#8b5cf6", // Violet
    "automotive_repair": "#047857",       // Dark green
    "coffee_shop": "#78350f",            // Dark brown
    "counseling_and_mental_health": "#831843", // Dark pink
    "gym": "#047857",                    // Emerald
    "art_gallery": "#fb923c",            // Light orange
    "shopping": "#0feaa6",               // Ginkgo green
    "beauty_and_spa": "#db2777",         // Pink
    caterer: "#f97316",                  // Orange
    bakery: "#ea580c",                   // Dark orange
    restaurant: "#f37129",               // Ginkgo orange
    "advertising_agency": "#f59e0b",     // Amber
    brewery: "#ca8a04",                  // Amber
    "bicycle_shop": "#9333ea",           // Violet
    "carpet_store": "#7c3aed",           // Purple
    chiropractor: "#4338ca",             // Indigo
    massage: "#15803d",                  // Green
    plumbing: "#365314",                 // Olive
    "printing_services": "#6366f1",      // Indigo
    "real_estate_agent": "#422006",      // Dark brown
    "thai_restaurant": "#7c2d12",        // Rust
    "asian_restaurant": "#db2777",       // Pink
    "bank_credit_union": "#c026d3",      // Fuchsia
    distillery: "#1e40af",               // Blue
    "engineering_services": "#1e3a8a",   // Navy
    "fashion_accessories_store": "#0c4a6e", // Dark blue
    "flowers_and_gifts_shop": "#075985", // Sky blue
    "furniture_store": "#0e7490",        // Dark cyan
    "grocery_store": "#0d9488",          // Teal
    
    // === Additional Common Categories ===
    bar: "#dc2626",                      // Red
    winery: "#7c2d12",                   // Brown
    contractor: "#0891b2",               // Dark cyan
    electrician: "#0e7490",              // Teal
    "appliance_repair_service": "#059669", // Emerald
    "auto_glass_service": "#10b981",     // Green
    "hardware_store": "#84cc16",         // Lime
    theatre: "#ec4899",                  // Pink
    "topic_concert_venue": "#f43f5e",    // Rose
    "naturopathic_holistic": "#14b8a6",  // Teal
    "event_photography": "#f87171",      // Light red
    acupuncture: "#c084fc",              // Light purple
    "arts_and_crafts": "#fbbf24",        // Yellow
    bartender: "#a78bfa",                // Light violet
    "building_supply_store": "#94a3b8",  // Slate
    "clothing_store": "#93c5fd",         // Light blue
    "construction_services": "#6ee7b7",  // Light green
    "fast_food_restaurant": "#fed7aa",   // Light orange
    
    // === Generic Mappings ===
    bank: "#1f2937",                     // Dark gray
    "credit_union": "#374151",           // Gray
    spa: "#be123c",                      // Crimson
    repair: "#0891b2",                   // Cyan
    shop: "#10b981",                     // Green
    store: "#84cc16",                    // Lime
    services: "#3b82f6",                 // Blue
    "dental_office": "#7c3aed",          // Purple
    "medical_office": "#8b5cf6",         // Violet
    "law_office": "#6366f1",             // Indigo
    "insurance_agency": "#3b82f6",       // Blue
    hotel: "#ec4899",                    // Pink
    motel: "#f43f5e",                    // Rose
    "gas_station": "#dc2626",            // Red
    pharmacy: "#059669",                 // Emerald
    "pet_store": "#22c55e",              // Green
    florist: "#84cc16",                  // Lime
    "shoe_store": "#a855f7",             // Purple
    "jewelry_store": "#fbbf24",          // Yellow
    "electronics_store": "#06b6d4",      // Cyan
    "sporting_goods_store": "#10b981",   // Green
    "toy_store": "#f472b6",              // Light pink
    "book_store": "#8b5cf6",             // Violet
    "music_store": "#ec4899",            // Pink
    "gift_shop": "#f59e0b",              // Amber
    "antique_store": "#92400e",          // Dark orange
    "thrift_store": "#78350f",           // Dark brown
    laundromat: "#0891b2",               // Cyan
    "dry_cleaner": "#06b6d4",            // Light cyan
    "nail_salon": "#f9a8d4",             // Light pink
    "hair_salon": "#e879f9",             // Light purple
    "tanning_salon": "#fbbf24",          // Yellow
    "fitness_center": "#22c55e",         // Green
    "dance_studio": "#f472b6",           // Light pink
    "martial_arts": "#dc2626",           // Red
    "yoga_studio": "#84cc16",            // Lime
    daycare: "#fed7aa",                  // Light orange
    "senior_center": "#a78bfa",          // Light violet
    library: "#8b5cf6",                  // Violet
    "post_office": "#6366f1",            // Indigo
    "fire_station": "#dc2626",           // Red
    "police_station": "#1e40af",         // Blue
    hospital: "#f43f5e",                 // Rose
    clinic: "#ec4899",                   // Pink
    "veterinary_clinic": "#22c55e",      // Green
    church: "#8b5cf6",                   // Violet
    mosque: "#6366f1",                   // Indigo
    synagogue: "#3b82f6",                // Blue
    temple: "#a855f7",                   // Purple
    cemetery: "#6b7280",                 // Gray
    park: "#22c55e",                     // Green
    "movie_theater": "#ec4899",          // Pink
    casino: "#dc2626",                   // Red
    "bowling_alley": "#f59e0b",          // Amber
    "golf_course": "#84cc16",            // Lime
    stadium: "#3b82f6",                  // Blue
    arena: "#8b5cf6",                    // Violet
    "amusement_park": "#f472b6",         // Light pink
    zoo: "#22c55e",                      // Green
    museum: "#8b5cf6",                   // Violet
    gallery: "#fb923c",                  // Light orange
    "convention_center": "#3b82f6",      // Blue
    
    // === Variations and Aliases ===
    "auto_repair": "#047857",            // Same as automotive_repair
    "car_repair": "#047857",             // Alias
    "vehicle_repair": "#047857",         // Alias
    "beauty_spa": "#db2777",             // Variation
    "spa_salon": "#be123c",              // Variation
    "health_spa": "#14b8a6",             // Variation
    "nail_spa": "#f9a8d4",               // Variation
    "day_spa": "#e11d48",                // Variation
    "medical_spa": "#8b5cf6",            // Variation
    "wellness_center": "#22c55e",        // Variation
    "fitness_gym": "#047857",            // Variation
    "workout_gym": "#22c55e",            // Variation
    "sports_gym": "#10b981",             // Variation
    "family_restaurant": "#f37129",      // Variation
    "fine_dining": "#7c2d12",            // Variation
    "casual_dining": "#ea580c",          // Variation
    "quick_service": "#fed7aa",          // Variation
    "coffee_house": "#78350f",           // Variation
    "coffee_bar": "#92400e",             // Variation
    "espresso_bar": "#713f12",           // Variation
    "internet_cafe": "#422006",          // Variation
    "juice_bar": "#84cc16",              // Variation
    "smoothie_bar": "#22c55e",           // Variation
    "wine_bar": "#7c2d12",               // Variation
    "cocktail_bar": "#dc2626",           // Variation
    "sports_bar": "#1e40af",             // Variation
    "neighborhood_bar": "#92400e",       // Variation
    "dive_bar": "#422006",               // Variation
    "lounge": "#8b5cf6",                 // Variation
    "nightclub": "#ec4899",              // Variation
    "dance_club": "#f472b6",             // Variation
  };

  // Process the places data to count categories
  const categoryCounts: Record<string, number> = {};
  
  if (data.places && Array.isArray(data.places)) {
    data.places.forEach((place: any) => {
      if (place.properties && place.properties.category) {
        const category = place.properties.category.toLowerCase();
        categoryCounts[category] = (categoryCounts[category] || 0) + 1;
      } else {
        categoryCounts['other'] = (categoryCounts['other'] || 0) + 1;
      }
    });
  }

  // Filter out categories with 0 places and prepare chart data
  const chartLabels: string[] = [];
  const chartData: number[] = [];
  const chartColors: string[] = [];

  Object.entries(categoryCounts)
    .filter(([_, count]) => count > 0)
    .sort(([,a], [,b]) => b - a) // Sort by count descending
    .forEach(([category, count]) => {
      // Format category name for display
      const displayName = category.split('_').map(word => 
        word.charAt(0).toUpperCase() + word.slice(1)
      ).join(' ');
      
      chartLabels.push(`${displayName} (${count})`);
      chartData.push(count);
      
      // Try to find color in extended colors first, then fall back
      const normalizedCategory = category.toLowerCase().replace(/ /g, '_');
      chartColors.push(EXTENDED_COLORS[normalizedCategory] || EXTENDED_COLORS.other);
    });

  const chartConfig = {
    labels: chartLabels,
    datasets: [
      {
        data: chartData,
        backgroundColor: chartColors,
        borderColor: chartColors.map(color => color),
        borderWidth: 2,
        hoverBorderWidth: 3,
        hoverBorderColor: '#ffffff'
      }
    ]
  };

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'right' as const,
        labels: {
          padding: 20,
          font: {
            family: ginkgoTheme.typography.fontFamily.body,
            size: 12
          },
          color: ginkgoTheme.colors.text.primary,
          usePointStyle: true,
          pointStyle: 'circle'
        }
      },
      tooltip: {
        backgroundColor: 'rgba(0, 0, 0, 0.8)',
        titleColor: 'white',
        bodyColor: 'white',
        borderColor: ginkgoTheme.colors.primary.green,
        borderWidth: 1,
        cornerRadius: 8,
        displayColors: true,
        callbacks: {
          label: function(context: any) {
            const total = context.dataset.data.reduce((a: number, b: number) => a + b, 0);
            const percentage = ((context.raw / total) * 100).toFixed(1);
            return `${context.label}: ${percentage}%`;
          }
        }
      }
    }
  };

  if (chartLabels.length === 0) {
    return (
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        height: '200px',
        color: ginkgoTheme.colors.text.secondary,
        fontFamily: ginkgoTheme.typography.fontFamily.body
      }}>
        No category data available
      </div>
    );
  }

  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      height: '400px'
    }}>
      <Pie data={chartConfig} options={chartOptions} />
    </div>
  );
}