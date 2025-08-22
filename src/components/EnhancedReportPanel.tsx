import React, { useState, useEffect } from 'react';
import {
  BudgetParameters,
  DEFAULT_BUDGET_PARAMS,
  calculateBudget,
  determinePlaceTypology,
  getServiceDemandIndicators
} from '../utils/budgetCalculations';

interface EnhancedReportPanelProps {
  data: any;
  onClose: () => void;
  mapVisible?: boolean;
}

export function EnhancedReportPanel({ data, onClose, mapVisible = true }: EnhancedReportPanelProps) {
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
  
  // Export to PDF placeholder
  const exportToPDF = () => {
    // TODO: Implement PDF export
    alert('PDF export will be implemented with jsPDF library');
  };
  
  // Export to CSV
  const exportToCSV = () => {
    const csvData = [
      ['Metric', 'Value'],
      ['Total Businesses', data.totalPlaces],
      ['Area (acres)', data.areaAcres.toFixed(2)],
      ['Density (per acre)', (data.totalPlaces / data.areaAcres).toFixed(1)],
      ['Place Typology', placeTypology],
      ['', ''],
      ['Budget Component', 'Annual Cost'],
      ['Cleaning', `$${budget.cleaning.toLocaleString()}`],
      ['Safety/Hospitality', `$${budget.safety.toLocaleString()}`],
      ['Streetscape Assets', `$${budget.assets.toLocaleString()}`],
      ['Marketing', `$${budget.marketing.toLocaleString()}`],
      ['Admin Overhead', `$${budget.adminOverhead.toLocaleString()}`],
      ['Total Annual Budget', `$${budget.total.toLocaleString()}`],
      ['', ''],
      ['Cost per Business', `$${budget.costPerBusiness.toLocaleString()}`],
      ['Cost per Acre', `$${budget.costPerAcre.toLocaleString()}`],
    ];
    
    const csv = csvData.map(row => row.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `bid-budget-report-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
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
        borderBottom: '2px solid #e2e8f0',
        backgroundColor: '#f8fafc',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center'
      }}>
        <div>
          <h2 style={{ margin: 0, color: '#1e293b', fontSize: '1.5rem' }}>
            BID Budget Analysis
          </h2>
          <p style={{ margin: '0.25rem 0 0', color: '#64748b', fontSize: '0.9rem' }}>
            {placeTypology} • {data.totalPlaces} businesses • {data.areaAcres.toFixed(1)} acres
          </p>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
          {mapVisible && (
            <button
              onClick={() => setShowFullReport(!showFullReport)}
              style={{
                padding: '0.5rem 1rem',
                backgroundColor: '#f1f5f9',
                border: '1px solid #cbd5e1',
                borderRadius: '4px',
                cursor: 'pointer',
                fontSize: '0.9rem'
              }}
            >
              {showFullReport ? '⬅️ Split View' : '⬅️➡️ Full Report'}
            </button>
          )}
          <button
            onClick={exportToPDF}
            style={{
              padding: '0.5rem 1rem',
              backgroundColor: '#0ea5e9',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
              fontSize: '0.9rem'
            }}
          >
            📄 Export PDF
          </button>
          <button
            onClick={exportToCSV}
            style={{
              padding: '0.5rem 1rem',
              backgroundColor: '#059669',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
              fontSize: '0.9rem'
            }}
          >
            📊 Export CSV
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
        borderBottom: '1px solid #e2e8f0',
        backgroundColor: '#f8fafc'
      }}>
        {(['executive', 'details', 'parameters'] as const).map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            style={{
              padding: '0.75rem 1.5rem',
              backgroundColor: activeTab === tab ? 'white' : 'transparent',
              border: 'none',
              borderBottom: activeTab === tab ? '2px solid #0ea5e9' : '2px solid transparent',
              cursor: 'pointer',
              fontWeight: activeTab === tab ? 600 : 400,
              color: activeTab === tab ? '#0ea5e9' : '#64748b',
              textTransform: 'capitalize'
            }}
          >
            {tab === 'executive' ? '📊 Executive Summary' :
             tab === 'details' ? '📋 Service Details' :
             '⚙️ Budget Parameters'}
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
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(2, 1fr)',
          gap: '1rem',
          marginTop: '1rem'
        }}>
          <BudgetLineItem label="Cleaning & Maintenance" value={budget.cleaning} percentage={(budget.cleaning / budget.subtotal * 100).toFixed(0)} />
          <BudgetLineItem label="Safety & Hospitality" value={budget.safety} percentage={(budget.safety / budget.subtotal * 100).toFixed(0)} />
          <BudgetLineItem label="Marketing & Events" value={budget.marketing} percentage={(budget.marketing / budget.subtotal * 100).toFixed(0)} />
          <BudgetLineItem label="Streetscape Assets" value={budget.assets} percentage={(budget.assets / budget.subtotal * 100).toFixed(0)} />
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