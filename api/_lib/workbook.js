export const tenantRequiredFields = [
  "Brand_Name",
  "Category_Primary",
  "Unit_Code",
  "Lease_Start_Date",
  "Lease_Expiry_Date",
  "MG_Rent_Monthly",
  "Unit_GLA_SBA",
];

export const organizationRequiredFields = [
  "Organization_Name",
  "Organization_Code",
  "Standard_Hours_Open",
  "Standard_Hours_Close",
  "Onboarding_Lead_Name",
  "Onboarding_Lead_Email",
];

export function findMissingFields(payload, requiredFields) {
  return requiredFields.filter((field) => {
    const value = payload?.[field];
    return value === undefined || value === null || String(value).trim() === "";
  });
}
