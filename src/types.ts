export interface TenantRow {
  tenant_name: string | null;
  unit_number: string | null;
  rent: number | null;
}

export interface Tenant {
  tenantName: string;
  unitNumber: string;
  rent: number;
}
