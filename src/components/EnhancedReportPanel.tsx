import React, { useState } from "react";
import {
  BudgetParameters,
  DEFAULT_BUDGET_PARAMS,
  calculateBudget,
  determinePlaceTypology,
  getServiceDemandIndicators,
} from "../utils/budgetCalculations";
import { generateBIDReportPDF, generatePDFForEmail } from "../utils/pdfExport";
import { ginkgoTheme } from "../styles/ginkgoTheme";
import { CATEGORY_COLORS, getCategoryColor } from "../constants/categoryColors";
import { Pie } from "react-chartjs-2";
import { Chart as ChartJS, ArcElement, Tooltip, Legend } from "chart.js";

// Register Chart.js components
ChartJS.register(ArcElement, Tooltip, Legend);

// Road class options for filtering
const ROAD_CLASS_OPTIONS = [
  { value: 'motorway', label: 'Motorways', color: '#E63946', description: 'Major highways' },
  { value: 'trunk', label: 'Trunk Roads', color: '#F77F00', description: 'Major arterials' },
  { value: 'primary', label: 'Primary Roads', color: '#FF6B6B', description: 'Main roads' },
  { value: 'secondary', label: 'Secondary Roads', color: '#4ECDC4', description: 'Important local roads' },
  { value: 'tertiary', label: 'Tertiary Roads', color: '#06FFA5', description: 'Local connector roads' },
  { value: 'residential', label: 'Residential Streets', color: '#95E77E', description: 'Neighborhood streets' },
  { value: 'service', label: 'Service Roads', color: '#A8E6CF', description: 'Parking lots, service roads' },
  { value: 'unclassified', label: 'Unclassified Roads', color: '#B4B4B4', description: 'Other roads' },
];

interface EnhancedReportPanelProps {
  data: any;
  onClose: () => void;
  mapVisible?: boolean;
  onFullReportToggle?: (isFullReport: boolean) => void;
  polygon?: any; // For PDF map generation
  mapboxToken?: string; // For PDF map generation
  // Road segments props
  selectedRoadClasses?: string[];
  setSelectedRoadClasses?: (classes: string[]) => void;
  onApplyRoadFilters?: () => void;
  useMetricUnits?: boolean;
  setUseMetricUnits?: (metric: boolean) => void;
}

export function EnhancedReportPanel({
  data,
  onClose,
  mapVisible = true,
  onFullReportToggle,
  polygon,
  mapboxToken,
  selectedRoadClasses = [],
  setSelectedRoadClasses = () => {},
  onApplyRoadFilters = () => {},
  useMetricUnits = true,
  setUseMetricUnits = () => {},
}: EnhancedReportPanelProps) {
  const [params, setParams] = useState<BudgetParameters>(DEFAULT_BUDGET_PARAMS);
  const [activeTab, setActiveTab] = useState<
    "executive" | "details" | "parameters" | "roads"
  >("executive");
  const [showFullReport, setShowFullReport] = useState(!mapVisible);

  // Calculate budget with current parameters
  const budget = calculateBudget(
    params,
    data.totalPlaces,
    data.areaAcres,
    data.perimeterFt || data.areaAcres * 1320, // Estimate if not provided
    data.categoryBreakdown
  );

  const placeTypology = determinePlaceTypology(
    data.categoryBreakdown,
    data.totalPlaces
  );
  const serviceDemands = getServiceDemandIndicators(
    data.totalPlaces,
    data.areaAcres,
    data.categoryBreakdown,
    budget.cleanIntensity,
    budget.nightIntensity
  );

  // Update parameter
  const updateParam = (key: keyof BudgetParameters, value: any) => {
    setParams((prev) => ({ ...prev, [key]: value }));
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
      mapboxToken,
    });
  };

  // Share via email
  const [showShareModal, setShowShareModal] = useState(false);
  const [emailList, setEmailList] = useState("");
  const [shareLoading, setShareLoading] = useState(false);

  const handleShareReport = async () => {
    if (!emailList.trim()) {
      alert("Please enter at least one email address");
      return;
    }

    // Validate email format (basic validation)
    const emails = emailList
      .split(",")
      .map((email) => email.trim())
      .filter((email) => email);
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const invalidEmails = emails.filter((email) => !emailRegex.test(email));

    if (invalidEmails.length > 0) {
      alert(`Invalid email addresses: ${invalidEmails.join(", ")}`);
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
        params,
      });

      // Send email via Netlify function
      const response = await fetch("/.netlify/functions/send-email", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          emails: emails,
          reportData: {
            placeTypology,
            totalPlaces: data.totalPlaces,
            areaAcres: data.areaAcres,
            totalBudget: budget.total,
          },
          pdfData: pdfResponse.base64,
        }),
      });

      if (response.ok) {
        alert(
          `Report successfully sent to ${emails.length} recipient${
            emails.length > 1 ? "s" : ""
          }!`
        );
        setShowShareModal(false);
        setEmailList("");
      } else {
        const error = await response.json();
        throw new Error(error.message || "Failed to send email");
      }
    } catch (error) {
      console.error("Error sharing report:", error);
      alert("Failed to send report. Please try again.");
    } finally {
      setShareLoading(false);
    }
  };

  const panelStyle: React.CSSProperties = {
    position: "absolute",
    top: 0,
    right: 0,
    width: mapVisible && !showFullReport ? "50%" : "100%",
    height: "100%",
    backgroundColor: "white",
    borderLeft: mapVisible ? "2px solid #e2e8f0" : "none",
    boxShadow: mapVisible ? "-4px 0 10px rgba(0,0,0,0.1)" : "none",
    display: "flex",
    flexDirection: "column",
    transition: "width 0.3s ease",
    zIndex: 1000,
  };

  return (
    <div style={panelStyle}>
      {/* Header */}
      <div
        style={{
          padding: "1rem 1.5rem",
          borderBottom: `2px solid ${ginkgoTheme.colors.secondary.lightGray}`,
          backgroundColor: ginkgoTheme.colors.background.main,
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        <div>
          <h2
            style={{
              margin: 0,
              color: ginkgoTheme.colors.primary.navy,
              fontSize: "24px",
              fontFamily: ginkgoTheme.typography.fontFamily.heading,
              fontWeight: 600,
            }}
          >
            BID Budget Analysis
          </h2>
          <p
            style={{
              margin: "0.25rem 0 0",
              color: ginkgoTheme.colors.text.secondary,
              fontSize: "14px",
              fontFamily: ginkgoTheme.typography.fontFamily.body,
            }}
          >
            {placeTypology} • {data.totalPlaces} businesses •{" "}
            {data.areaAcres.toFixed(1)} acres
          </p>
        </div>
        <div style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
          {mapVisible && (
            <button
              onClick={() => {
                const newFullReportState = !showFullReport;
                setShowFullReport(newFullReportState);
                onFullReportToggle?.(newFullReportState);
              }}
              style={{
                padding: "12px 24px",
                backgroundColor: "transparent",
                border: `1px solid ${ginkgoTheme.colors.secondary.lightGray}`,
                borderRadius: "6px",
                cursor: "pointer",
                fontSize: "14px",
                fontFamily: ginkgoTheme.typography.fontFamily.body,
                color: ginkgoTheme.colors.text.secondary,
                transition: "all 0.2s ease",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor =
                  ginkgoTheme.colors.secondary.veryLightGreen;
                e.currentTarget.style.borderColor =
                  ginkgoTheme.colors.primary.green;
                e.currentTarget.style.color = ginkgoTheme.colors.primary.green;
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = "transparent";
                e.currentTarget.style.borderColor =
                  ginkgoTheme.colors.secondary.lightGray;
                e.currentTarget.style.color = ginkgoTheme.colors.text.secondary;
              }}
            >
              {showFullReport ? "Split View" : "Full Report"}
            </button>
          )}
          <button
            onClick={exportToPDF}
            style={{
              padding: "12px 24px",
              backgroundColor: ginkgoTheme.colors.primary.orange,
              color: "white",
              border: "none",
              borderRadius: "6px",
              cursor: "pointer",
              fontSize: "14px",
              fontWeight: 600,
              fontFamily: ginkgoTheme.typography.fontFamily.body,
              display: "flex",
              alignItems: "center",
              gap: "8px",
              transition: "all 0.3s ease",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor =
                ginkgoTheme.colors.primary.green;
              e.currentTarget.style.transform = "translateY(-2px)";
              e.currentTarget.style.boxShadow =
                "0 4px 12px rgba(15, 234, 166, 0.4)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor =
                ginkgoTheme.colors.primary.orange;
              e.currentTarget.style.transform = "translateY(0)";
              e.currentTarget.style.boxShadow = "none";
            }}
          >
            Export PDF
          </button>
          <button
            onClick={() => setShowShareModal(true)}
            style={{
              padding: "12px 24px",
              backgroundColor: "#162d54", // Navy blue
              color: "white",
              border: "none",
              borderRadius: "6px",
              cursor: "pointer",
              fontSize: "14px",
              fontWeight: 600,
              fontFamily: ginkgoTheme.typography.fontFamily.body,
              display: "flex",
              alignItems: "center",
              gap: "8px",
              transition: "all 0.3s ease",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = "rgb(15, 234, 166)"; // Green hover
              e.currentTarget.style.transform = "translateY(-2px)";
              e.currentTarget.style.boxShadow =
                "0 4px 12px rgba(15, 234, 166, 0.4)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = "#162d54"; // Back to navy blue
              e.currentTarget.style.transform = "translateY(0)";
              e.currentTarget.style.boxShadow = "none";
            }}
          >
            Share Report
          </button>
          <button
            onClick={onClose}
            style={{
              background: "none",
              border: "none",
              fontSize: "1.5rem",
              cursor: "pointer",
              padding: "0.5rem",
              color: "#64748b",
            }}
          >
            ✕
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div
        style={{
          display: "flex",
          borderBottom: `1px solid ${ginkgoTheme.colors.secondary.lightGray}`,
          backgroundColor: ginkgoTheme.colors.background.main,
        }}
      >
        {["executive", "details", "parameters", ...(data.segments ? ["roads"] : [])].map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            style={{
              padding: "0.75rem 1.5rem",
              backgroundColor: activeTab === tab ? "white" : "transparent",
              border: "none",
              borderBottom:
                activeTab === tab
                  ? `2px solid ${ginkgoTheme.colors.primary.navy}`
                  : "2px solid transparent",
              cursor: "pointer",
              fontWeight: activeTab === tab ? 600 : 400,
              fontFamily: ginkgoTheme.typography.fontFamily.body,
              color:
                activeTab === tab
                  ? ginkgoTheme.colors.primary.navy
                  : ginkgoTheme.colors.text.secondary,
              textTransform: "capitalize",
              transition: "all 0.2s ease",
            }}
          >
            {tab === "executive" && "Executive Summary"}
            {tab === "details" && "Service Details"}
            {tab === "parameters" && "Budget Parameters"}
            {tab === "roads" && "Road Analytics"}
          </button>
        ))}
      </div>

      {/* Content */}
      <div style={{ flex: 1, overflowY: "auto", padding: "1.5rem" }}>
        {activeTab === "executive" && (
          <ExecutiveSummary
            data={data}
            budget={budget}
            placeTypology={placeTypology}
            serviceDemands={serviceDemands}
            params={params}
          />
        )}

        {activeTab === "details" && (
          <ServiceDetails
            data={data}
            budget={budget}
            serviceDemands={serviceDemands}
            params={params}
          />
        )}

        {activeTab === "parameters" && (
          <ParameterSliders
            params={params}
            updateParam={updateParam}
            budget={budget}
          />
        )}

        {activeTab === "roads" && data.segments && (
          <RoadsAnalytics
            data={data}
            selectedRoadClasses={selectedRoadClasses}
            setSelectedRoadClasses={setSelectedRoadClasses}
            onApplyRoadFilters={onApplyRoadFilters}
            useMetricUnits={useMetricUnits}
            setUseMetricUnits={setUseMetricUnits}
          />
        )}
      </div>

      {/* Share Modal */}
      {showShareModal && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: "rgba(0,0,0,0.5)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 2000,
          }}
        >
          <div
            style={{
              backgroundColor: "white",
              borderRadius: "12px",
              padding: "2rem",
              maxWidth: "600px",
              width: "95%",
              maxHeight: "90vh",
              overflowY: "auto",
              boxShadow: "0 20px 40px rgba(0,0,0,0.15)",
            }}
          >
            <h3
              style={{
                marginTop: 0,
                color: ginkgoTheme.colors.primary.navy,
                fontFamily: ginkgoTheme.typography.fontFamily.heading,
                fontWeight: 600,
                fontSize: "20px",
              }}
            >
              Share BID Report
            </h3>
            <p style={{ color: "#64748b", marginBottom: "1.5rem" }}>
              Enter email addresses (separated by commas) to share this budget
              report as a PDF attachment.
            </p>

            <div style={{ marginBottom: "1.5rem" }}>
              <label
                style={{
                  display: "block",
                  marginBottom: "0.5rem",
                  fontWeight: 600,
                  color: "#374151",
                }}
              >
                Email Recipients:
              </label>
              <textarea
                value={emailList}
                onChange={(e) => setEmailList(e.target.value)}
                placeholder="john@company.com, mary@board.org, planning@city.gov"
                style={{
                  width: "100%",
                  minHeight: "80px",
                  padding: "12px 16px",
                  border: `2px solid ${ginkgoTheme.colors.secondary.lightGray}`,
                  borderRadius: "6px",
                  fontSize: "14px",
                  fontFamily: ginkgoTheme.typography.fontFamily.body,
                  resize: "vertical",
                  outline: "none",
                  transition: "all 0.2s ease",
                  backgroundColor: ginkgoTheme.colors.background.main,
                  boxSizing: "border-box",
                }}
                onFocus={(e) => {
                  e.target.style.borderColor = ginkgoTheme.colors.primary.green;
                  e.target.style.boxShadow = `0 0 0 3px rgba(15, 234, 166, 0.1)`;
                }}
                onBlur={(e) => {
                  e.target.style.borderColor =
                    ginkgoTheme.colors.secondary.lightGray;
                  e.target.style.boxShadow = "none";
                }}
              />
              <div
                style={{
                  fontSize: "0.8rem",
                  color: "#6b7280",
                  marginTop: "0.5rem",
                }}
              >
                Tip: Separate multiple email addresses with commas
              </div>
            </div>

            <div
              style={{
                backgroundColor: "#f8fafc",
                padding: "1rem",
                borderRadius: "6px",
                marginBottom: "1.5rem",
              }}
            >
              <h4
                style={{
                  margin: "0 0 0.5rem",
                  fontSize: "0.9rem",
                  color: "#374151",
                }}
              >
                Report Summary:
              </h4>
              <div style={{ fontSize: "0.85rem", color: "#6b7280" }}>
                <div>
                  • {placeTypology} with {data.totalPlaces} businesses
                </div>
                <div>• {data.areaAcres.toFixed(1)} acres coverage area</div>
                <div>
                  • ${budget.total.toLocaleString()} annual budget estimate
                </div>
              </div>
            </div>

            <div
              style={{
                display: "flex",
                gap: "1rem",
                justifyContent: "flex-end",
              }}
            >
              <button
                onClick={() => {
                  setShowShareModal(false);
                  setEmailList("");
                }}
                disabled={shareLoading}
                style={{
                  padding: "12px 24px",
                  backgroundColor: "transparent",
                  border: `2px solid ${
                    shareLoading
                      ? ginkgoTheme.colors.secondary.lightGray
                      : ginkgoTheme.colors.secondary.lightGray
                  }`,
                  borderRadius: "6px",
                  cursor: shareLoading ? "not-allowed" : "pointer",
                  fontSize: "14px",
                  fontWeight: 600,
                  fontFamily: ginkgoTheme.typography.fontFamily.body,
                  color: shareLoading
                    ? ginkgoTheme.colors.text.secondary
                    : ginkgoTheme.colors.text.secondary,
                  transition: "all 0.3s ease",
                  opacity: shareLoading ? 0.5 : 1,
                }}
                onMouseEnter={(e) => {
                  if (!shareLoading) {
                    e.currentTarget.style.backgroundColor =
                      ginkgoTheme.colors.secondary.lightGray;
                    e.currentTarget.style.transform = "translateY(-1px)";
                  }
                }}
                onMouseLeave={(e) => {
                  if (!shareLoading) {
                    e.currentTarget.style.backgroundColor = "transparent";
                    e.currentTarget.style.transform = "translateY(0)";
                  }
                }}
              >
                Cancel
              </button>
              <button
                onClick={handleShareReport}
                disabled={shareLoading || !emailList.trim()}
                style={{
                  padding: "12px 24px",
                  backgroundColor:
                    shareLoading || !emailList.trim()
                      ? ginkgoTheme.colors.secondary.lightGray
                      : ginkgoTheme.colors.primary.green,
                  color:
                    shareLoading || !emailList.trim()
                      ? ginkgoTheme.colors.text.secondary
                      : "white",
                  border: "none",
                  borderRadius: "6px",
                  cursor:
                    shareLoading || !emailList.trim()
                      ? "not-allowed"
                      : "pointer",
                  fontSize: "14px",
                  fontWeight: 600,
                  fontFamily: ginkgoTheme.typography.fontFamily.body,
                  display: "flex",
                  alignItems: "center",
                  gap: "8px",
                  transition: "all 0.3s ease",
                  opacity: shareLoading || !emailList.trim() ? 0.6 : 1,
                }}
                onMouseEnter={(e) => {
                  if (!shareLoading && emailList.trim()) {
                    e.currentTarget.style.backgroundColor =
                      ginkgoTheme.colors.primary.orange;
                    e.currentTarget.style.transform = "translateY(-2px)";
                    e.currentTarget.style.boxShadow =
                      "0 4px 12px rgba(243, 113, 41, 0.4)";
                  }
                }}
                onMouseLeave={(e) => {
                  if (!shareLoading && emailList.trim()) {
                    e.currentTarget.style.backgroundColor =
                      ginkgoTheme.colors.primary.green;
                    e.currentTarget.style.transform = "translateY(0)";
                    e.currentTarget.style.boxShadow = "none";
                  }
                }}
              >
                {shareLoading ? (
                  <>
                    <div
                      style={{
                        width: "16px",
                        height: "16px",
                        border: "2px solid transparent",
                        borderTop: "2px solid white",
                        borderRadius: "50%",
                        animation: "spin 1s linear infinite",
                      }}
                    />
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
function ExecutiveSummary({
  data,
  budget,
  placeTypology,
  serviceDemands,
  params,
}: any) {
  const getTypologyColor = (typology: string) => {
    const colors: Record<string, string> = {
      "Retail Core": "#8b5cf6",
      "Dining District": "#ef4444",
      "Mixed-Use District": "#0ea5e9",
      "Diverse Business Mix": "#10b981",
      "Service Hub": "#f59e0b",
      "Entertainment Zone": "#ec4899",
      "General Commercial": "#6b7280",
    };
    return colors[typology] || "#6b7280";
  };

  return (
    <div>
      {/* Key Metrics Grid */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
          gap: "1rem",
          marginBottom: "2rem",
        }}
      >
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
          subtitle={
            budget.cleanIntensity > 1.15
              ? "High demand"
              : budget.cleanIntensity > 1.05
              ? "Moderate"
              : "Standard"
          }
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
      <div
        style={{
          backgroundColor: "#f8fafc",
          borderRadius: "8px",
          padding: "1.5rem",
          marginBottom: "2rem",
        }}
      >
        <h3 style={{ marginTop: 0, marginBottom: "1rem", color: "#1e293b" }}>
          Budget Allocation
        </h3>
        <BudgetBar budget={budget} params={params} />
        <div style={{ marginTop: "1.5rem" }}>
          {params.cleaning_enabled && (
            <BudgetLineItemWithColor
              label="Cleaning & Maintenance"
              value={budget.cleaning}
              percentage={
                budget.subtotal > 0
                  ? ((budget.cleaning / budget.subtotal) * 100).toFixed(0)
                  : "0"
              }
              color="#0ea5e9"
            />
          )}
          {params.safety_enabled && (
            <BudgetLineItemWithColor
              label="Safety & Hospitality"
              value={budget.safety}
              percentage={
                budget.subtotal > 0
                  ? ((budget.safety / budget.subtotal) * 100).toFixed(0)
                  : "0"
              }
              color="#059669"
            />
          )}
          {params.marketing_enabled && (
            <BudgetLineItemWithColor
              label="Marketing & Events"
              value={budget.marketing}
              percentage={
                budget.subtotal > 0
                  ? ((budget.marketing / budget.subtotal) * 100).toFixed(0)
                  : "0"
              }
              color="#f59e0b"
            />
          )}
          {params.assets_enabled && (
            <BudgetLineItemWithColor
              label="Streetscape Assets"
              value={budget.assets}
              percentage={
                budget.subtotal > 0
                  ? ((budget.assets / budget.subtotal) * 100).toFixed(0)
                  : "0"
              }
              color="#8b5cf6"
            />
          )}
        </div>
      </div>

      {/* Priority Services */}
      <div
        style={{
          backgroundColor: "#fef3c7",
          borderRadius: "8px",
          padding: "1.5rem",
          marginBottom: "2rem",
        }}
      >
        <h3 style={{ marginTop: 0, marginBottom: "1rem", color: "#92400e" }}>
          🎯 Priority Service Recommendations
        </h3>
        <ServicePriorities serviceDemands={serviceDemands} />
      </div>

      {/* Quick Decision Points */}
      <div
        style={{
          backgroundColor: "#f0f9ff",
          borderRadius: "8px",
          padding: "1.5rem",
        }}
      >
        <h3 style={{ marginTop: 0, marginBottom: "1rem", color: "#075985" }}>
          ✅ Key Decision Points
        </h3>
        <ul style={{ margin: 0, paddingLeft: "1.5rem" }}>
          <li>
            Budget represents{" "}
            <strong>${budget.costPerBusiness.toLocaleString()}</strong> annual
            cost per business
          </li>
          <li>
            Coverage area of <strong>{data.areaAcres.toFixed(1)} acres</strong>{" "}
            at ${budget.costPerAcre.toLocaleString()}/acre
          </li>
          <li>
            Staffing estimate: <strong>{budget.cleanersNeeded}</strong>{" "}
            cleaners, <strong>{budget.supervisorsNeeded}</strong> supervisors
          </li>
          {budget.safetyFTE > 0 && (
            <li>
              Safety coverage: <strong>{budget.safetyFTE.toFixed(1)}</strong>{" "}
              FTE ambassadors
            </li>
          )}
        </ul>
      </div>

      {/* Categories Distribution Pie Chart */}
      <div
        style={{
          backgroundColor: "white",
          borderRadius: "8px",
          padding: "1.5rem",
          marginTop: "2rem",
          border: "1px solid #e2e8f0",
        }}
      >
        <h3
          style={{
            marginTop: 0,
            marginBottom: "1.5rem",
            color: ginkgoTheme.colors.primary.navy,
            fontFamily: ginkgoTheme.typography.fontFamily.heading,
          }}
        >
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
      {/* Service Priority Classification Explanation */}
      <div
        style={{
          backgroundColor: "#f0f9ff",
          borderRadius: "8px",
          padding: "1.5rem",
          marginBottom: "2rem",
          border: "1px solid #bfdbfe",
        }}
      >
        <h3
          style={{
            margin: "0 0 1rem 0",
            color: "#075985",
            display: "flex",
            alignItems: "center",
            gap: "0.5rem",
          }}
        >
          📊 Service Priority Classification System
        </h3>
        <p
          style={{ margin: "0 0 1rem 0", color: "#334155", fontSize: "0.9rem" }}
        >
          Priority badges are determined by service intensity calculations based
          on business mix analysis:
        </p>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(3, 1fr)",
            gap: "1rem",
            marginBottom: "1rem",
          }}
        >
          <div
            style={{
              padding: "0.75rem",
              backgroundColor: "white",
              borderRadius: "6px",
              border: "1px solid #e2e8f0",
              textAlign: "center",
            }}
          >
            <div
              style={{
                padding: "0.25rem 0.75rem",
                backgroundColor: "#dc262620",
                color: "#dc2626",
                borderRadius: "20px",
                fontSize: "0.8rem",
                fontWeight: 600,
                marginBottom: "0.5rem",
              }}
            >
              High Priority
            </div>
            <div style={{ fontSize: "0.8rem", color: "#64748b" }}>
              Intensity &gt; 1.15
              <br />
              (15% above baseline)
            </div>
          </div>

          <div
            style={{
              padding: "0.75rem",
              backgroundColor: "white",
              borderRadius: "6px",
              border: "1px solid #e2e8f0",
              textAlign: "center",
            }}
          >
            <div
              style={{
                padding: "0.25rem 0.75rem",
                backgroundColor: "#f59e0b20",
                color: "#f59e0b",
                borderRadius: "20px",
                fontSize: "0.8rem",
                fontWeight: 600,
                marginBottom: "0.5rem",
              }}
            >
              Medium Priority
            </div>
            <div style={{ fontSize: "0.8rem", color: "#64748b" }}>
              Intensity &gt; 1.05
              <br />
              (5-15% above baseline)
            </div>
          </div>

          <div
            style={{
              padding: "0.75rem",
              backgroundColor: "white",
              borderRadius: "6px",
              border: "1px solid #e2e8f0",
              textAlign: "center",
            }}
          >
            <div
              style={{
                padding: "0.25rem 0.75rem",
                backgroundColor: "#05966920",
                color: "#059669",
                borderRadius: "20px",
                fontSize: "0.8rem",
                fontWeight: 600,
                marginBottom: "0.5rem",
              }}
            >
              Standard
            </div>
            <div style={{ fontSize: "0.8rem", color: "#64748b" }}>
              Intensity ≤ 1.05
              <br />
              (At or below baseline)
            </div>
          </div>
        </div>

        <div
          style={{
            fontSize: "0.85rem",
            color: "#64748b",
            fontStyle: "italic",
            textAlign: "center",
          }}
        >
          Based on BOMA, ISSA, and IDA industry standards for cleaning service
          intensity
        </div>
      </div>

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
          `${budget.frontageEstimate.toLocaleString()} ft estimated frontage`,
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
          params.safety_enabled
            ? `${budget.safetyFTE.toFixed(1)} FTE ambassadors`
            : "Service not enabled",
          `Night economy factor: ${budget.nightIntensity.toFixed(2)}`,
          `${params.safety_days_per_week} days per week coverage`,
          `${params.safety_hours_per_day} hours per day`,
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
          `$${params.cost_per_event.toLocaleString()} per event`,
        ]}
      />

      {/* Streetscape Assets */}
      <div
        style={{
          backgroundColor: "#f8fafc",
          borderRadius: "8px",
          padding: "1.5rem",
          marginBottom: "1.5rem",
        }}
      >
        <h3 style={{ marginTop: 0, color: "#1e293b" }}>
          🌳 Streetscape Assets (Annualized)
        </h3>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(3, 1fr)",
            gap: "1rem",
          }}
        >
          <AssetCard
            name="Trash Cans"
            count={Math.ceil(
              budget.frontageEstimate / params.feet_per_trash_can
            )}
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
      <div
        style={{
          backgroundColor: "#fef3c7",
          borderRadius: "8px",
          padding: "1rem",
          marginBottom: "1.5rem",
        }}
      >
        <p style={{ margin: 0, color: "#92400e" }}>
          ⚠️ Adjust parameters below to see real-time budget impact. Default
          values are based on industry standards.
        </p>
      </div>

      {/* Live Budget Display */}
      <div
        style={{
          position: "sticky",
          top: 0,
          backgroundColor: "white",
          padding: "1rem",
          borderBottom: "2px solid #e2e8f0",
          marginBottom: "1.5rem",
          zIndex: 10,
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <h3 style={{ margin: 0 }}>Total Annual Budget:</h3>
          <div
            style={{ fontSize: "2rem", fontWeight: "bold", color: "#0ea5e9" }}
          >
            ${budget.total.toLocaleString()}
          </div>
        </div>
      </div>

      {/* Detailed Cost Breakdown */}
      <div
        style={{
          backgroundColor: "#f8fafc",
          borderRadius: "8px",
          padding: "1rem",
          marginBottom: "1.5rem",
          fontSize: "0.9rem",
        }}
      >
        <h4 style={{ margin: "0 0 0.5rem", color: "#1e293b" }}>
          Cost Breakdown
        </h4>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: "0.5rem",
          }}
        >
          {params.cleaning_enabled && (
            <>
              <div>Cleaners ({budget.cleanersNeeded}):</div>
              <div>
                $
                {(
                  budget.cleaning -
                    budget.supervisorsNeeded *
                      params.clean_hours_per_shift *
                      params.clean_days_per_week *
                      52 *
                      params.supervisor_loaded_rate || 0
                ).toLocaleString()}
              </div>
              <div>Supervisors ({budget.supervisorsNeeded}):</div>
              <div>
                $
                {(
                  budget.supervisorsNeeded *
                    params.clean_hours_per_shift *
                    params.clean_days_per_week *
                    52 *
                    params.supervisor_loaded_rate || 0
                ).toLocaleString()}
              </div>
            </>
          )}
          {params.safety_enabled && (
            <>
              <div>Safety ({budget.safetyFTE.toFixed(1)} FTE):</div>
              <div>${budget.safety.toLocaleString()}</div>
            </>
          )}
          {params.marketing_enabled && (
            <>
              <div>Marketing & Events:</div>
              <div>${budget.marketing.toLocaleString()}</div>
            </>
          )}
          {params.assets_enabled && (
            <>
              <div>Streetscape Assets:</div>
              <div>${budget.assets.toLocaleString()}</div>
            </>
          )}
          <div
            style={{
              fontWeight: "bold",
              borderTop: "1px solid #e2e8f0",
              paddingTop: "0.5rem",
            }}
          >
            Subtotal:
          </div>
          <div
            style={{
              fontWeight: "bold",
              borderTop: "1px solid #e2e8f0",
              paddingTop: "0.5rem",
            }}
          >
            ${budget.subtotal.toLocaleString()}
          </div>
          <div>
            Admin Overhead ({(params.admin_overhead_pct * 100).toFixed(0)}%):
          </div>
          <div>${budget.adminOverhead.toLocaleString()}</div>
        </div>
      </div>

      {/* Cleaning Parameters */}
      <ParameterSection title="Cleaning & Maintenance">
        <div style={{ marginBottom: "1rem" }}>
          <label
            style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}
          >
            <input
              type="checkbox"
              checked={params.cleaning_enabled}
              onChange={(e) =>
                updateParam("cleaning_enabled", e.target.checked)
              }
            />
            <span>Enable Cleaning Services</span>
          </label>
        </div>
        {params.cleaning_enabled && (
          <>
            <SliderInput
              label="Cleaner Hourly Rate (loaded)"
              value={params.clean_loaded_rate}
              min={20}
              max={100}
              step={1}
              unit="$/hr"
              onChange={(v) => updateParam("clean_loaded_rate", v)}
            />
            <SliderInput
              label="Days per Week"
              value={params.clean_days_per_week}
              min={3}
              max={7}
              step={1}
              onChange={(v) => updateParam("clean_days_per_week", v)}
            />

            {/* Calculation Method Toggle */}
            <div
              style={{
                marginBottom: "1rem",
                padding: "1rem",
                backgroundColor: "#f0f9ff",
                borderRadius: "6px",
              }}
            >
              <label
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "0.5rem",
                  marginBottom: "0.5rem",
                }}
              >
                <input
                  type="checkbox"
                  checked={params.use_area_based_cleaning}
                  onChange={(e) =>
                    updateParam("use_area_based_cleaning", e.target.checked)
                  }
                />
                <span style={{ fontWeight: "500" }}>
                  Use Area-Based Cleaning Calculation
                </span>
              </label>
              <div style={{ fontSize: "0.85rem", color: "#6b7280" }}>
                {params.use_area_based_cleaning
                  ? "Calculates cleaning needs based on total district area (more accurate for plazas, pedestrian areas)"
                  : "Calculates cleaning needs based on estimated business frontage (traditional method)"}
              </div>
            </div>

            {params.use_area_based_cleaning ? (
              <SliderInput
                label="Area Coverage (acres/hour)"
                value={params.acres_per_cleaner_hour}
                min={0.1}
                max={2.0}
                step={0.1}
                unit="acres"
                onChange={(v) => updateParam("acres_per_cleaner_hour", v)}
              />
            ) : (
              <SliderInput
                label="Productivity (ft/hour)"
                value={params.frontage_ft_per_cleaner_hour}
                min={500}
                max={1500}
                step={50}
                unit="ft"
                onChange={(v) => updateParam("frontage_ft_per_cleaner_hour", v)}
              />
            )}

            <SliderInput
              label="Supervisor Ratio (cleaners per supervisor)"
              value={params.supervisor_ratio}
              min={4}
              max={20}
              step={1}
              unit=":1"
              onChange={(v) => updateParam("supervisor_ratio", v)}
            />
          </>
        )}
      </ParameterSection>

      {/* Safety Parameters */}
      <ParameterSection title="Safety & Hospitality">
        <div style={{ marginBottom: "1rem" }}>
          <label
            style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}
          >
            <input
              type="checkbox"
              checked={params.safety_enabled}
              onChange={(e) => updateParam("safety_enabled", e.target.checked)}
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
              max={150}
              step={1}
              unit="$/hr"
              onChange={(v) => updateParam("safety_loaded_rate", v)}
            />
            <SliderInput
              label="Hours per Day"
              value={params.safety_hours_per_day}
              min={8}
              max={24}
              step={1}
              unit="hrs"
              onChange={(v) => updateParam("safety_hours_per_day", v)}
            />
            <SliderInput
              label="Days per Week"
              value={params.safety_days_per_week}
              min={3}
              max={7}
              step={1}
              onChange={(v) => updateParam("safety_days_per_week", v)}
            />
          </>
        )}
      </ParameterSection>

      {/* Marketing Parameters */}
      <ParameterSection title="Marketing & Events">
        <div style={{ marginBottom: "1rem" }}>
          <label
            style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}
          >
            <input
              type="checkbox"
              checked={params.marketing_enabled}
              onChange={(e) =>
                updateParam("marketing_enabled", e.target.checked)
              }
            />
            <span>Enable Marketing & Events</span>
          </label>
        </div>
        {params.marketing_enabled && (
          <>
            <SliderInput
              label="Base Annual Marketing"
              value={params.marketing_base_annual}
              min={10000}
              max={500000}
              step={10000}
              unit="$"
              onChange={(v) => updateParam("marketing_base_annual", v)}
            />
            <SliderInput
              label="Per Business Marketing"
              value={params.marketing_per_business}
              min={20}
              max={500}
              step={10}
              unit="$"
              onChange={(v) => updateParam("marketing_per_business", v)}
            />
            <SliderInput
              label="Events per Year"
              value={params.events_per_year}
              min={0}
              max={52}
              step={1}
              onChange={(v) => updateParam("events_per_year", v)}
            />
            <SliderInput
              label="Cost per Event"
              value={params.cost_per_event}
              min={1000}
              max={100000}
              step={2500}
              unit="$"
              onChange={(v) => updateParam("cost_per_event", v)}
            />
          </>
        )}
      </ParameterSection>

      {/* Streetscape Assets Parameters */}
      <ParameterSection title="Streetscape Assets">
        <div style={{ marginBottom: "1rem" }}>
          <label
            style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}
          >
            <input
              type="checkbox"
              checked={params.assets_enabled}
              onChange={(e) => updateParam("assets_enabled", e.target.checked)}
            />
            <span>Enable Streetscape Assets</span>
          </label>
        </div>
        {params.assets_enabled && (
          <>
            <SliderInput
              label="Feet per Trash Can"
              value={params.feet_per_trash_can}
              min={200}
              max={800}
              step={50}
              unit="ft"
              onChange={(v) => updateParam("feet_per_trash_can", v)}
            />
            <SliderInput
              label="Trash Can Unit Cost"
              value={params.trash_can_unit_cost}
              min={500}
              max={8000}
              step={100}
              unit="$"
              onChange={(v) => updateParam("trash_can_unit_cost", v)}
            />
            <SliderInput
              label="Feet per Planter"
              value={params.feet_per_planter}
              min={300}
              max={1200}
              step={50}
              unit="ft"
              onChange={(v) => updateParam("feet_per_planter", v)}
            />
            <SliderInput
              label="Planter Unit Cost"
              value={params.planter_unit_cost}
              min={100}
              max={800}
              step={25}
              unit="$"
              onChange={(v) => updateParam("planter_unit_cost", v)}
            />
            <SliderInput
              label="Feet per Banner"
              value={params.feet_per_banner}
              min={400}
              max={1500}
              step={50}
              unit="ft"
              onChange={(v) => updateParam("feet_per_banner", v)}
            />
            <SliderInput
              label="Banner Unit Cost"
              value={params.banner_unit_cost}
              min={50}
              max={500}
              step={10}
              unit="$"
              onChange={(v) => updateParam("banner_unit_cost", v)}
            />
          </>
        )}
      </ParameterSection>

      {/* Admin Overhead */}
      <ParameterSection title="Administration">
        <SliderInput
          label="Admin Overhead"
          value={params.admin_overhead_pct * 100}
          min={5}
          max={100}
          step={1}
          unit="%"
          onChange={(v) => updateParam("admin_overhead_pct", v / 100)}
        />
      </ParameterSection>
    </div>
  );
}

// Helper Components
function MetricCard({ title, value, subtitle, color }: any) {
  return (
    <div
      style={{
        backgroundColor: "white",
        border: "1px solid #e2e8f0",
        borderRadius: "8px",
        padding: "1rem",
        borderTop: `3px solid ${color}`,
      }}
    >
      <div
        style={{
          fontSize: "0.9rem",
          color: "#64748b",
          marginBottom: "0.25rem",
        }}
      >
        {title}
      </div>
      <div style={{ fontSize: "1.5rem", fontWeight: "bold", color }}>
        {value}
      </div>
      <div style={{ fontSize: "0.85rem", color: "#94a3b8" }}>{subtitle}</div>
    </div>
  );
}

function BudgetBar({ budget, params }: any) {
  const total = budget.subtotal;
  const segments = [
    params.cleaning_enabled && {
      label: "Cleaning",
      value: budget.cleaning,
      color: "#0ea5e9",
    },
    params.safety_enabled && {
      label: "Safety",
      value: budget.safety,
      color: "#059669",
    },
    params.marketing_enabled && {
      label: "Marketing",
      value: budget.marketing,
      color: "#f59e0b",
    },
    params.assets_enabled && {
      label: "Assets",
      value: budget.assets,
      color: "#8b5cf6",
    },
  ].filter(Boolean);

  return (
    <div
      style={{
        display: "flex",
        height: "40px",
        borderRadius: "4px",
        overflow: "hidden",
        border: "1px solid #e2e8f0",
      }}
    >
      {segments.map((seg, i) => (
        <div
          key={i}
          style={{
            width: `${(seg.value / total) * 100}%`,
            backgroundColor: seg.color,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: "white",
            fontSize: "0.8rem",
            fontWeight: 600,
          }}
        >
          {seg.value / total > 0.1 &&
            `${((seg.value / total) * 100).toFixed(0)}%`}
        </div>
      ))}
    </div>
  );
}

function BudgetLineItem({ label, value, percentage }: any) {
  return (
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        padding: "0.5rem 0",
      }}
    >
      <span style={{ color: "#64748b" }}>{label}</span>
      <span style={{ fontWeight: 600 }}>
        ${value.toLocaleString()} ({percentage}%)
      </span>
    </div>
  );
}

function BudgetLineItemWithColor({ label, value, percentage, color }: any) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        padding: "0.75rem 0",
        borderBottom: "1px solid #e2e8f0",
      }}
    >
      {/* Color indicator */}
      <div
        style={{
          width: "16px",
          height: "16px",
          backgroundColor: color,
          borderRadius: "3px",
          marginRight: "12px",
          flexShrink: 0,
        }}
      />

      {/* Service name */}
      <span
        style={{
          color: "#374151",
          fontFamily: ginkgoTheme.typography.fontFamily.body,
          fontWeight: 500,
          flexGrow: 1,
        }}
      >
        {label}
      </span>

      {/* Amount and percentage */}
      <span
        style={{
          fontWeight: 600,
          color: "#1e293b",
          fontFamily: ginkgoTheme.typography.fontFamily.body,
        }}
      >
        ${value.toLocaleString()} ({percentage}%)
      </span>
    </div>
  );
}

function ServicePriorities({ serviceDemands }: any) {
  const allNeeds = [
    ...serviceDemands.cleaning.needs.map((n: string) => ({
      service: "Cleaning",
      need: n,
      priority: serviceDemands.cleaning.priority,
    })),
    ...serviceDemands.safety.needs.map((n: string) => ({
      service: "Safety",
      need: n,
      priority: serviceDemands.safety.priority,
    })),
    ...serviceDemands.marketing.needs.map((n: string) => ({
      service: "Marketing",
      need: n,
      priority: serviceDemands.marketing.priority,
    })),
  ];

  // Sort by priority
  const sortedNeeds = allNeeds.sort((a, b) => {
    const priorityOrder = { High: 0, Medium: 1, Standard: 2 };
    return priorityOrder[a.priority] - priorityOrder[b.priority];
  });

  return (
    <ul style={{ margin: 0, paddingLeft: "1.5rem" }}>
      {sortedNeeds.slice(0, 5).map((item, i) => (
        <li key={i} style={{ marginBottom: "0.5rem" }}>
          <strong>{item.service}:</strong> {item.need}
        </li>
      ))}
    </ul>
  );
}

function ServiceSection({ title, icon, cost, priority, needs, details }: any) {
  const priorityColors = {
    High: "#dc2626",
    Medium: "#f59e0b",
    Standard: "#059669",
  };

  return (
    <div
      style={{
        backgroundColor: "#f8fafc",
        borderRadius: "8px",
        padding: "1.5rem",
        marginBottom: "1.5rem",
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: "1rem",
        }}
      >
        <h3
          style={{
            margin: 0,
            display: "flex",
            alignItems: "center",
            gap: "0.5rem",
          }}
        >
          <span style={{ fontSize: "1.5rem" }}>{icon}</span>
          {title}
        </h3>
        <div style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
          <span
            style={{
              padding: "0.25rem 0.75rem",
              backgroundColor: priorityColors[priority] + "20",
              color: priorityColors[priority],
              borderRadius: "20px",
              fontSize: "0.85rem",
              fontWeight: 600,
            }}
          >
            {priority} Priority
          </span>
          <span style={{ fontSize: "1.25rem", fontWeight: "bold" }}>
            ${cost.toLocaleString()}
          </span>
        </div>
      </div>

      {needs.length > 0 && (
        <div style={{ marginBottom: "1rem" }}>
          <strong>Service Needs:</strong>
          <ul style={{ margin: "0.5rem 0 0 1.5rem", padding: 0 }}>
            {needs.map((need: string, i: number) => (
              <li key={i} style={{ marginBottom: "0.25rem" }}>
                {need}
              </li>
            ))}
          </ul>
        </div>
      )}

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(2, 1fr)",
          gap: "0.5rem",
        }}
      >
        {details.map((detail: string, i: number) => (
          <div key={i} style={{ fontSize: "0.9rem", color: "#64748b" }}>
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
    <div
      style={{
        padding: "1rem",
        backgroundColor: "white",
        border: "1px solid #e2e8f0",
        borderRadius: "4px",
      }}
    >
      <div style={{ fontWeight: 600, marginBottom: "0.5rem" }}>{name}</div>
      <div style={{ fontSize: "0.9rem", color: "#64748b" }}>
        <div>Quantity: {count}</div>
        <div>Unit cost: ${unitCost}</div>
        <div>Life: {lifeYears} years</div>
        <div style={{ marginTop: "0.5rem", fontWeight: 600, color: "#1e293b" }}>
          Annual: ${Math.round(annualCost).toLocaleString()}
        </div>
      </div>
    </div>
  );
}

function ParameterSection({ title, children }: any) {
  return (
    <div
      style={{
        marginBottom: "2rem",
        padding: "1.5rem",
        backgroundColor: "#f8fafc",
        borderRadius: "8px",
      }}
    >
      <h3 style={{ marginTop: 0, marginBottom: "1rem", color: "#1e293b" }}>
        {title}
      </h3>
      {children}
    </div>
  );
}

function SliderInput({
  label,
  value,
  min,
  max,
  step,
  unit = "",
  onChange,
}: any) {
  return (
    <div style={{ marginBottom: "1rem" }}>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          marginBottom: "0.5rem",
        }}
      >
        <label style={{ fontSize: "0.9rem", color: "#64748b" }}>{label}</label>
        <span style={{ fontWeight: 600 }}>
          {unit && unit !== "$" && unit !== "%" && !unit.startsWith(":")
            ? value.toLocaleString() + " " + unit
            : unit === "$"
            ? "$" + value.toLocaleString()
            : unit === "%"
            ? value.toFixed(0) + "%"
            : unit.startsWith(":")
            ? value + unit
            : value.toLocaleString()}
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
          width: "100%",
          height: "6px",
          borderRadius: "3px",
          background: `linear-gradient(to right, #0ea5e9 0%, #0ea5e9 ${
            ((value - min) / (max - min)) * 100
          }%, #e2e8f0 ${((value - min) / (max - min)) * 100}%, #e2e8f0 100%)`,
          outline: "none",
          WebkitAppearance: "none",
        }}
      />
    </div>
  );
}

// Category Pie Chart Component
function CategoryPieChart({ data }: { data: any }) {
  // Process the places data to count categories
  const categoryCounts: Record<string, number> = {};

  if (data.places && Array.isArray(data.places)) {
    data.places.forEach((place: any) => {
      if (place.properties && place.properties.category) {
        const category = place.properties.category.toLowerCase();
        categoryCounts[category] = (categoryCounts[category] || 0) + 1;
      } else {
        categoryCounts["other"] = (categoryCounts["other"] || 0) + 1;
      }
    });
  }

  // Filter out categories with 0 places and prepare chart data
  const chartLabels: string[] = [];
  const chartData: number[] = [];
  const chartColors: string[] = [];

  // Sort categories by count and show top 10, group rest as "Other"
  const sortedCategories = Object.entries(categoryCounts)
    .filter(([_, count]) => count > 0)
    .sort(([, a], [, b]) => b - a); // Sort by count descending

  const TOP_CATEGORIES_COUNT = 10;
  const topCategories = sortedCategories.slice(0, TOP_CATEGORIES_COUNT);
  const otherCategories = sortedCategories.slice(TOP_CATEGORIES_COUNT);

  // Add top categories using unified color system
  topCategories.forEach(([category, count]) => {
    // Format category name for display
    const displayName = category
      .split("_")
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(" ");

    chartLabels.push(`${displayName} (${count})`);
    chartData.push(count);
    chartColors.push(getCategoryColor(category));
  });

  // Group remaining categories as "Other" if there are any
  if (otherCategories.length > 0) {
    const otherCount = otherCategories.reduce(
      (sum, [_, count]) => sum + count,
      0
    );

    chartLabels.push(`Other (${otherCount})`);
    chartData.push(otherCount);
    chartColors.push(CATEGORY_COLORS.other); // Use unified "other" color
  }

  const chartConfig = {
    labels: chartLabels,
    datasets: [
      {
        data: chartData,
        backgroundColor: chartColors,
        borderColor: chartColors.map((color) => color),
        borderWidth: 2,
        hoverBorderWidth: 3,
        hoverBorderColor: "#ffffff",
      },
    ],
  };

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    cutout: "70%", // Makes it a thin donut chart
    plugins: {
      legend: {
        position: "right" as const,
        labels: {
          padding: 15,
          font: {
            family: ginkgoTheme.typography.fontFamily.body,
            size: 11,
          },
          color: ginkgoTheme.colors.text.primary,
          usePointStyle: true,
          pointStyle: "circle",
          boxWidth: 12,
          boxHeight: 12,
        },
      },
      tooltip: {
        backgroundColor: "rgba(0, 0, 0, 0.9)",
        titleColor: "white",
        bodyColor: "white",
        borderColor: ginkgoTheme.colors.primary.green,
        borderWidth: 1,
        cornerRadius: 8,
        displayColors: true,
        titleFont: {
          size: 13,
          weight: "bold",
        },
        bodyFont: {
          size: 12,
        },
        padding: 12,
        callbacks: {
          label: function (context: any) {
            const total = context.dataset.data.reduce(
              (a: number, b: number) => a + b,
              0
            );
            const percentage = ((context.raw / total) * 100).toFixed(1);

            // For "Other" category, show additional detail in tooltip
            if (context.label.startsWith("Other")) {
              const otherCategoryNames = otherCategories.map(([category]) =>
                category
                  .split("_")
                  .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
                  .join(" ")
              );
              return [
                `${context.label}: ${percentage}%`,
                `Includes: ${otherCategoryNames.slice(0, 5).join(", ")}${
                  otherCategoryNames.length > 5 ? "..." : ""
                }`,
              ];
            }

            return `${context.label}: ${percentage}%`;
          },
        },
      },
    },
  };

  if (chartLabels.length === 0) {
    return (
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          height: "200px",
          color: ginkgoTheme.colors.text.secondary,
          fontFamily: ginkgoTheme.typography.fontFamily.body,
        }}
      >
        No category data available
      </div>
    );
  }

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        height: "400px",
        position: "relative",
      }}
    >
      <Pie data={chartConfig} options={chartOptions} />

      {/* Center text for donut chart */}
      <div
        style={{
          position: "absolute",
          top: "50%",
          left: "35%", // Adjusted for legend on right
          transform: "translate(-50%, -50%)",
          textAlign: "center",
          pointerEvents: "none",
        }}
      >
        <div
          style={{
            fontSize: "28px",
            fontWeight: "bold",
            color: ginkgoTheme.colors.primary.navy,
            fontFamily: ginkgoTheme.typography.fontFamily.heading,
          }}
        >
          {data.totalPlaces}
        </div>
        <div
          style={{
            fontSize: "12px",
            color: ginkgoTheme.colors.text.secondary,
            fontFamily: ginkgoTheme.typography.fontFamily.body,
            marginTop: "4px",
          }}
        >
          Total Businesses
        </div>
      </div>
    </div>
  );
}

// Roads Analytics Component
function RoadsAnalytics({ 
  data, 
  selectedRoadClasses, 
  setSelectedRoadClasses, 
  onApplyRoadFilters, 
  useMetricUnits, 
  setUseMetricUnits 
}: {
  data: any;
  selectedRoadClasses: string[];
  setSelectedRoadClasses: (classes: string[]) => void;
  onApplyRoadFilters: () => void;
  useMetricUnits: boolean;
  setUseMetricUnits: (metric: boolean) => void;
}) {
  return (
    <div style={{ padding: "1rem" }}>
      {/* Header */}
      <div style={{ 
        display: "flex", 
        justifyContent: "space-between", 
        alignItems: "center", 
        marginBottom: "1.5rem" 
      }}>
        <h2 style={{ 
          fontSize: "1.8rem", 
          fontWeight: 600, 
          color: ginkgoTheme.colors.primary.navy,
          margin: 0
        }}>
          Road Network Analysis
        </h2>
        
        {/* Unit Toggle */}
        <button
          onClick={() => setUseMetricUnits(!useMetricUnits)}
          style={{
            padding: "8px 12px",
            fontSize: "14px",
            background: useMetricUnits ? ginkgoTheme.colors.primary.green : ginkgoTheme.colors.primary.orange,
            color: ginkgoTheme.colors.primary.navy,
            border: "none",
            borderRadius: "6px",
            cursor: "pointer",
            fontWeight: 600,
            transition: "all 0.2s ease"
          }}
        >
          {useMetricUnits ? "Metric (KM)" : "Imperial (MI)"}
        </button>
      </div>
      
      {/* Road Filters Section */}
      <div style={{ 
        background: ginkgoTheme.colors.background.light,
        padding: "1.5rem",
        borderRadius: "8px",
        marginBottom: "2rem"
      }}>
        <h3 style={{ 
          fontSize: "1.2rem", 
          fontWeight: 600, 
          color: ginkgoTheme.colors.primary.navy,
          marginBottom: "1rem" 
        }}>
          Filter Road Types
        </h3>
        
        {/* Select All/None buttons */}
        <div style={{ display: "flex", gap: "8px", marginBottom: "1rem" }}>
          <button
            onClick={() => setSelectedRoadClasses(ROAD_CLASS_OPTIONS.map(opt => opt.value))}
            style={{
              padding: "8px 16px",
              fontSize: "14px",
              background: ginkgoTheme.colors.primary.green,
              color: ginkgoTheme.colors.primary.navy,
              border: "none",
              borderRadius: "6px",
              cursor: "pointer",
              fontWeight: 500
            }}
          >
            Select All
          </button>
          <button
            onClick={() => setSelectedRoadClasses([])}
            style={{
              padding: "8px 16px",
              fontSize: "14px",
              background: ginkgoTheme.colors.text.light,
              color: "white",
              border: "none",
              borderRadius: "6px",
              cursor: "pointer",
              fontWeight: 500
            }}
          >
            Clear All
          </button>
        </div>
        
        {/* Road class checkboxes */}
        <div style={{ 
          display: "grid", 
          gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", 
          gap: "12px",
          marginBottom: "1rem"
        }}>
          {ROAD_CLASS_OPTIONS.map((option) => (
            <label
              key={option.value}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "12px",
                cursor: "pointer",
                fontSize: "14px",
                color: ginkgoTheme.colors.primary.navy,
                padding: "8px",
                borderRadius: "6px",
                backgroundColor: selectedRoadClasses.includes(option.value) 
                  ? ginkgoTheme.colors.secondary.lightGray 
                  : "transparent",
                border: `1px solid ${selectedRoadClasses.includes(option.value) 
                  ? ginkgoTheme.colors.primary.green 
                  : ginkgoTheme.colors.secondary.lightGray}`,
                transition: "all 0.2s ease"
              }}
            >
              <input
                type="checkbox"
                checked={selectedRoadClasses.includes(option.value)}
                onChange={(e) => {
                  if (e.target.checked) {
                    setSelectedRoadClasses([...selectedRoadClasses, option.value]);
                  } else {
                    setSelectedRoadClasses(selectedRoadClasses.filter(cls => cls !== option.value));
                  }
                }}
                style={{ cursor: "pointer", transform: "scale(1.2)" }}
              />
              <div
                style={{
                  width: "16px",
                  height: "16px",
                  borderRadius: "3px",
                  backgroundColor: option.color,
                  flexShrink: 0
                }}
              />
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 600 }}>{option.label}</div>
                <div style={{ fontSize: "12px", color: ginkgoTheme.colors.text.light }}>
                  {option.description}
                </div>
              </div>
            </label>
          ))}
        </div>
        
        {/* Apply filters button */}
        <button
          onClick={onApplyRoadFilters}
          style={{
            width: "100%",
            padding: "12px",
            fontSize: "16px",
            background: ginkgoTheme.colors.button.secondaryBg,
            color: ginkgoTheme.colors.button.secondaryText,
            border: "none",
            borderRadius: "8px",
            cursor: "pointer",
            fontWeight: 600,
            transition: "all 0.3s ease"
          }}
          disabled={selectedRoadClasses.length === 0}
        >
          Apply Filters ({selectedRoadClasses.length} selected)
        </button>
      </div>

      {/* Road Analytics Dashboard */}
      {data.segments && data.segments.classByClass && data.segments.classByClass.length > 0 && (
        <div style={{ 
          background: "white",
          padding: "1.5rem",
          borderRadius: "8px",
          border: `1px solid ${ginkgoTheme.colors.secondary.lightGray}`
        }}>
          <h3 style={{ 
            fontSize: "1.2rem", 
            fontWeight: 600, 
            color: ginkgoTheme.colors.primary.navy,
            marginBottom: "1.5rem" 
          }}>
            Road Network Metrics
          </h3>
          
          {/* Overall Statistics */}
          <div style={{ 
            background: ginkgoTheme.colors.background.light,
            padding: "1.5rem",
            borderRadius: "8px",
            marginBottom: "1.5rem"
          }}>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "1rem" }}>
              <div>
                <div style={{ 
                  fontSize: "12px", 
                  color: ginkgoTheme.colors.text.light,
                  marginBottom: "4px"
                }}>Total Length</div>
                <div style={{ 
                  fontSize: "1.5rem",
                  fontWeight: 700, 
                  color: ginkgoTheme.colors.primary.navy 
                }}>
                  {useMetricUnits 
                    ? `${(data.segments.totalLengthM / 1000).toFixed(1)} km`
                    : `${data.segments.totalLengthMiles.toFixed(1)} mi`
                  }
                </div>
              </div>
              <div>
                <div style={{ 
                  fontSize: "12px", 
                  color: ginkgoTheme.colors.text.light,
                  marginBottom: "4px"
                }}>Road Density</div>
                <div style={{ 
                  fontSize: "1.5rem",
                  fontWeight: 700, 
                  color: ginkgoTheme.colors.primary.navy 
                }}>
                  {useMetricUnits
                    ? `${data.segments.densityPerKm2.toFixed(1)} m/km²`
                    : `${data.segments.densityPerMile2.toFixed(1)} ft/mi²`
                  }
                </div>
              </div>
              <div>
                <div style={{ 
                  fontSize: "12px", 
                  color: ginkgoTheme.colors.text.light,
                  marginBottom: "4px"
                }}>Road Types</div>
                <div style={{ 
                  fontSize: "1.5rem",
                  fontWeight: 700, 
                  color: ginkgoTheme.colors.primary.navy 
                }}>
                  {data.segments.classByClass.length}
                </div>
              </div>
              <div>
                <div style={{ 
                  fontSize: "12px", 
                  color: ginkgoTheme.colors.text.light,
                  marginBottom: "4px"
                }}>Total Segments</div>
                <div style={{ 
                  fontSize: "1.5rem",
                  fontWeight: 700, 
                  color: ginkgoTheme.colors.primary.navy 
                }}>
                  {data.segments.total.toLocaleString()}
                </div>
              </div>
            </div>
          </div>
          
          {/* Road Class Breakdown */}
          <div>
            <h4 style={{ 
              fontSize: "1rem", 
              fontWeight: 600, 
              color: ginkgoTheme.colors.primary.navy,
              marginBottom: "1rem"
            }}>
              Road Class Breakdown
            </h4>
            
            <div style={{ display: "grid", gap: "12px" }}>
              {data.segments.classByClass
                .sort((a: any, b: any) => b.lengthM - a.lengthM)
                .map((classData: any) => {
                  const percentage = (classData.lengthM / data.segments.totalLengthM * 100);
                  const displayLength = useMetricUnits 
                    ? `${(classData.lengthM / 1000).toFixed(1)} km`
                    : `${classData.lengthMiles.toFixed(1)} mi`;
                  
                  return (
                    <div key={classData.class} style={{ 
                      padding: "12px",
                      border: `1px solid ${ginkgoTheme.colors.secondary.lightGray}`,
                      borderRadius: "6px"
                    }}>
                      <div style={{ 
                        display: "flex", 
                        justifyContent: "space-between", 
                        alignItems: "center",
                        marginBottom: "8px"
                      }}>
                        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                          <div
                            style={{
                              width: "16px",
                              height: "16px",
                              borderRadius: "3px",
                              backgroundColor: classData.color,
                              flexShrink: 0
                            }}
                          />
                          <span style={{ 
                            fontSize: "16px",
                            fontWeight: 600,
                            color: ginkgoTheme.colors.primary.navy
                          }}>
                            {ROAD_CLASS_OPTIONS.find(opt => opt.value === classData.class)?.label || classData.class}
                          </span>
                        </div>
                        <div style={{ display: "flex", gap: "16px", alignItems: "center" }}>
                          <span style={{ 
                            fontSize: "14px",
                            color: ginkgoTheme.colors.text.light 
                          }}>
                            {displayLength}
                          </span>
                          <span style={{ 
                            fontSize: "16px",
                            fontWeight: 700,
                            color: ginkgoTheme.colors.primary.orange,
                            minWidth: "50px",
                            textAlign: "right"
                          }}>
                            {percentage.toFixed(1)}%
                          </span>
                        </div>
                      </div>
                      
                      {/* Progress bar */}
                      <div style={{
                        width: "100%",
                        height: "8px",
                        backgroundColor: ginkgoTheme.colors.secondary.lightGray,
                        borderRadius: "4px",
                        overflow: "hidden"
                      }}>
                        <div
                          style={{
                            width: `${percentage}%`,
                            height: "100%",
                            backgroundColor: classData.color,
                            borderRadius: "4px",
                            transition: "width 0.3s ease"
                          }}
                        />
                      </div>
                    </div>
                  );
                })
              }
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
