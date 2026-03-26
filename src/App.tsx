import { useEffect, useMemo, useState } from "react";
import { supabase } from "./lib/supabase";
import type { Tenant, TenantRow } from "./types";

function formatCurrency(value: number) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(value);
}

function mapTenantRow(row: TenantRow): Tenant {
  return {
    tenantName: row.tenant_name?.trim() || "Unnamed Tenant",
    unitNumber: row.unit_number?.trim() || "Unassigned",
    rent: typeof row.rent === "number" ? row.rent : 0,
  };
}

function App() {
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    async function loadTenants() {
      if (!supabase) {
        if (!active) return;
        setError(
          "Supabase environment variables are missing. Add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.",
        );
        setLoading(false);
        return;
      }

      setLoading(true);
      setError(null);

      const { data, error: fetchError } = await supabase
        .from("tenants")
        .select("tenant_name, unit_number, rent")
        .order("tenant_name", { ascending: true });

      if (!active) return;

      if (fetchError) {
        setError(fetchError.message);
        setTenants([]);
        setLoading(false);
        return;
      }

      const mapped = (data ?? []).map(mapTenantRow);
      setTenants(mapped);
      setLoading(false);
    }

    void loadTenants();

    return () => {
      active = false;
    };
  }, []);

  const summary = useMemo(() => {
    const totalRent = tenants.reduce((sum, tenant) => sum + tenant.rent, 0);
    const highestRentTenant = tenants.reduce<Tenant | null>(
      (highest, tenant) => (!highest || tenant.rent > highest.rent ? tenant : highest),
      null,
    );
    const averageRent = tenants.length > 0 ? totalRent / tenants.length : 0;

    return {
      totalTenants: tenants.length,
      totalRent,
      averageRent,
      highestRentTenant,
    };
  }, [tenants]);

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="sidebar-brand">
          <p className="sidebar-kicker">Vetturo OS</p>
          <h1>Tenant Dashboard</h1>
          <p className="sidebar-copy">
            Clean visibility into tenant occupancy and rent performance from Supabase.
          </p>
        </div>

        <nav className="sidebar-nav" aria-label="Primary navigation">
          <span className="nav-item active">Dashboard</span>
          <span className="nav-item">Tenants</span>
          <span className="nav-item">Insights</span>
          <span className="nav-item">Supabase</span>
        </nav>
      </aside>

      <main className="main-panel">
        <header className="page-header">
          <div>
            <p className="page-kicker">Operations Overview</p>
            <h2>Tenant and rent visibility</h2>
            <p className="page-copy">
              Live data from the <code>tenants</code> table using the configured Supabase project.
            </p>
          </div>
        </header>

        {loading ? (
          <section className="state-card">
            <h3>Loading tenants…</h3>
            <p>Fetching tenant_name, unit_number, and rent from Supabase.</p>
          </section>
        ) : error ? (
          <section className="state-card error">
            <h3>Unable to load data</h3>
            <p>{error}</p>
          </section>
        ) : tenants.length === 0 ? (
          <section className="state-card">
            <h3>No tenants found</h3>
            <p>The tenants table is reachable, but it returned no rows.</p>
          </section>
        ) : (
          <>
            <section className="metrics-grid">
              <article className="metric-card">
                <span>Total Tenants</span>
                <strong>{summary.totalTenants}</strong>
              </article>

              <article className="metric-card">
                <span>Total Monthly Rent</span>
                <strong>{formatCurrency(summary.totalRent)}</strong>
              </article>

              <article className="metric-card">
                <span>Average Rent</span>
                <strong>{formatCurrency(summary.averageRent)}</strong>
              </article>
            </section>

            <section className="content-grid">
              <article className="panel">
                <div className="panel-header">
                  <div>
                    <p className="panel-kicker">Tenant List</p>
                    <h3>Current tenants</h3>
                  </div>
                </div>

                <div className="tenant-list">
                  {tenants.map((tenant) => (
                    <div className="tenant-row" key={`${tenant.tenantName}-${tenant.unitNumber}`}>
                      <div>
                        <strong>{tenant.tenantName}</strong>
                        <p>Unit {tenant.unitNumber}</p>
                      </div>
                      <span>{formatCurrency(tenant.rent)}</span>
                    </div>
                  ))}
                </div>
              </article>

              <article className="panel">
                <div className="panel-header">
                  <div>
                    <p className="panel-kicker">Insights</p>
                    <h3>Quick highlights</h3>
                  </div>
                </div>

                <div className="insights-list">
                  <div className="insight-card">
                    <span>Highest Rent</span>
                    <strong>
                      {summary.highestRentTenant
                        ? summary.highestRentTenant.tenantName
                        : "No tenant data"}
                    </strong>
                    <p>
                      {summary.highestRentTenant
                        ? `${formatCurrency(summary.highestRentTenant.rent)} • Unit ${summary.highestRentTenant.unitNumber}`
                        : "No rent values available."}
                    </p>
                  </div>

                  <div className="insight-card">
                    <span>Data Source</span>
                    <strong>Supabase</strong>
                    <p>Reading from the populated tenants table in production-safe mode.</p>
                  </div>

                  <div className="insight-card">
                    <span>Columns in Use</span>
                    <strong>tenant_name, unit_number, rent</strong>
                    <p>Only the required tenant fields are mapped and rendered.</p>
                  </div>
                </div>
              </article>
            </section>
          </>
        )}
      </main>
    </div>
  );
}

export default App;
