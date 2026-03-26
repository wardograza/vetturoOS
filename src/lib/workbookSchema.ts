import type { WorkbookSection } from "../types";

export const organizationWorkbookSections: WorkbookSection[] = [
  {
    title: "Organization Master (HQ Level)",
    scope: "organization",
    fields: [
      { key: "Organization_Name", label: "Organization Name", description: "Legal name of the organization.", required: true },
      { key: "Organization_Code", label: "Organization Code", description: "3-4 letter slug used in internal routing and database logic.", required: true },
      { key: "HQ_Full_Address", label: "HQ Full Address", description: "Used for legal headers and formal records." },
      { key: "Org_Website_URL", label: "Website URL", description: "Used for brand context and operator reference." },
      { key: "Org_Logo_URL", label: "Logo URL", description: "High-resolution logo URL for white-labeled UI." },
      { key: "Branding_Figma_Link", label: "Branding Figma Link", description: "Reference for visual system matching." },
      { key: "Primary_Brand_Color", label: "Primary Brand Color", description: "Primary UI theme color." },
      { key: "Secondary_Brand_Color", label: "Secondary Brand Color", description: "Secondary UI accent color." },
      { key: "Portfolio_Size_Count", label: "Portfolio Size Count", description: "Total number of malls in the portfolio." },
      { key: "Org_Go_Live_Target", label: "Go Live Target", description: "Target go-live date for rollout." },
      { key: "Standard_Hours_Open", label: "Standard Hours Open", description: "Default mall opening time.", required: true },
      { key: "Standard_Hours_Close", label: "Standard Hours Close", description: "Default mall closing time.", required: true },
      { key: "Fiscal_Year_Start", label: "Fiscal Year Start", description: "Used for planning and budget logic." },
      { key: "Currency_Preference", label: "Currency Preference", description: "INR, USD, or other reporting currency." },
      { key: "Master_Contract_Link", label: "Master Contract Link", description: "Enterprise agreement reference." },
      { key: "ERP_System_Provider", label: "ERP System Provider", description: "Source system for future integrations." },
      { key: "Web_App_Access_URL", label: "Web App Access URL", description: "White-labeled access URL." },
      { key: "Onboarding_Lead_Name", label: "Onboarding Lead Name", description: "Primary contact for data migration.", required: true },
      { key: "Onboarding_Lead_Email", label: "Onboarding Lead Email", description: "Main setup and onboarding email.", required: true },
      { key: "Onboarding_Lead_Phone", label: "Onboarding Lead Phone", description: "Phone used during live ingestion." },
      { key: "Group_CFO_Email", label: "Group CFO Email", description: "Used for high-level finance reporting." },
      { key: "Group_CTO_IT_Email", label: "Group CTO / IT Email", description: "Used for access, SSO, and security coordination." },
      { key: "Group_Leasing_Head", label: "Group Leasing Head", description: "Approver for leasing logic and Decision DNA." },
    ],
  },
];

export const tenantWorkbookSections: WorkbookSection[] = [
  {
    title: "Contact Matrix",
    scope: "tenant",
    fields: [
      { key: "Brand_Name", label: "Brand Name", description: "Trading name of the store.", required: true },
      { key: "Brand_POC_Name", label: "Brand POC Name", description: "Regional or corporate relationship owner." },
      { key: "Brand_POC_Email", label: "Brand POC Email", description: "Destination for lease, renewal, and legal nudges." },
      { key: "Store_Manager_Name", label: "Store Manager Name", description: "On-site store manager." },
      { key: "Store_Manager_Phone", label: "Store Manager Phone", description: "Phone for critical operational alerts." },
      { key: "Billing_Contact_Email", label: "Billing Contact Email", description: "Billing or finance contact for the tenant." },
      { key: "Nexus_Leasing_Lead", label: "Leasing Lead", description: "Internal leasing relationship owner." },
    ],
  },
  {
    title: "Tenant Profile & Decision DNA",
    scope: "tenant",
    fields: [
      { key: "Parent_Company", label: "Parent Company", description: "Legal entity or holding company name." },
      { key: "Category_Primary", label: "Primary Category", description: "Main segment such as F&B or Apparel.", required: true },
      { key: "Category_Secondary", label: "Secondary Category", description: "Sub-segment classification." },
      { key: "Brand_Grade", label: "Brand Grade", description: "A, B, or C positioning." },
      { key: "Store_Format", label: "Store Format", description: "Flagship, Boutique, Kiosk, or SIS." },
      { key: "Target_Audience", label: "Target Audience", description: "Primary demographic for the brand." },
      { key: "Avg_Transaction_Value", label: "Average Transaction Value", description: "Average bill value for store health benchmarking." },
      { key: "Annual_Marketing_Spend", label: "Annual Marketing Spend", description: "Estimated spend on promotions at this mall." },
      { key: "USP_Description", label: "USP Description", description: "One-sentence summary of unique value." },
      { key: "Expansion_History", label: "Expansion History", description: "Regional or national outlet history." },
    ],
  },
  {
    title: "Lease & Financial Master",
    scope: "tenant",
    fields: [
      { key: "Unit_Code", label: "Unit Code", description: "Unique identification for the unit.", required: true },
      { key: "Lease_Start_Date", label: "Lease Start Date", description: "Date the tenant becomes liable for rent.", required: true },
      { key: "Lease_Expiry_Date", label: "Lease Expiry Date", description: "Used for renewal alerts.", required: true },
      { key: "Lock_in_Expiry", label: "Lock-in Expiry", description: "Date until tenant cannot terminate." },
      { key: "MG_Rent_Monthly", label: "MG Rent Monthly", description: "Minimum guarantee monthly rent.", required: true },
      { key: "GTO_Percent", label: "GTO Percent", description: "Gross turnover revenue share percentage." },
      { key: "Escalation_Freq_Months", label: "Escalation Frequency Months", description: "How often rent increases." },
      { key: "Escalation_Percent", label: "Escalation Percent", description: "Increase percentage applied at interval." },
      { key: "Last_Escalation_Date", label: "Last Escalation Date", description: "Used for audit logic." },
      { key: "Security_Deposit", label: "Security Deposit", description: "Deposit held against lease." },
      { key: "CAM_Rate_SqFt", label: "CAM Rate Sq Ft", description: "CAM charge per square foot." },
      { key: "Utility_Meter_ID", label: "Utility Meter ID", description: "Reference number for utility mapping." },
    ],
  },
  {
    title: "Technical Specs & Compliance",
    scope: "tenant",
    fields: [
      { key: "Unit_GLA_SBA", label: "Unit GLA / SBA", description: "Unit area for technical and leasing fit.", required: true },
      { key: "Power_Load_kVA", label: "Power Load kVA", description: "Electrical load requirement." },
      { key: "Gas_Connection_YN", label: "Gas Connection Y/N", description: "Whether gas line is required." },
      { key: "Water_Inlet_YN", label: "Water Inlet Y/N", description: "Whether water inlet / drainage is required." },
      { key: "Exhaust_Provision_YN", label: "Exhaust Provision Y/N", description: "Whether ventilation provision is required." },
      { key: "Signage_Type", label: "Signage Type", description: "Approved signage format." },
      { key: "Insurance_Expiry", label: "Insurance Expiry", description: "Used for compliance nudges." },
      { key: "Trade_License_Expiry", label: "Trade License Expiry", description: "Used for renewal nudges." },
      { key: "Last_Audit_Score", label: "Last Audit Score", description: "Most recent hygiene or brand audit score." },
    ],
  },
];

export const documentDomainOptions = [
  {
    domain: "finance",
    subcategories: ["budget", "rent-roll", "deposit", "cam", "forecast", "recovery"],
  },
  {
    domain: "leasing",
    subcategories: ["tenant-onboarding", "brand-vetting", "lease", "renewal", "vacancy"],
  },
  {
    domain: "legal",
    subcategories: ["contract", "license", "compliance", "insurance", "trade-license"],
  },
  {
    domain: "operations",
    subcategories: ["facilities", "incident", "maintenance", "audit", "sop"],
  },
  {
    domain: "marketing",
    subcategories: ["campaign", "event", "footfall", "promotion", "creative"],
  },
  {
    domain: "sales",
    subcategories: ["trading", "conversion", "performance", "benchmark", "store-health"],
  },
];

export const invitePermissionOptions = [
  "view_dashboard",
  "view_revenue",
  "view_documents",
  "approve_documents",
  "create_tasks",
  "assign_tasks",
  "send_communications",
  "view_leasing_intel",
  "manage_configs",
  "invite_users",
];
