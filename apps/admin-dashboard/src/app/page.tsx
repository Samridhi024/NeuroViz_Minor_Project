export default function DashboardPage() {
  // TODO: Dashboard overview with stats cards (orders, revenue, pending KYC, flagged batches)
  return (
    <div>
      <h1 style={{ fontSize: 24, fontWeight: 700, marginBottom: 24 }}>Dashboard</h1>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16 }}>
        {[
          { label: "Today's Orders", value: '—', color: '#3B82F6' },
          { label: "Today's Revenue", value: '—', color: '#16A34A' },
          { label: 'Pending KYC', value: '—', color: '#F59E0B' },
          { label: 'Flagged Batches', value: '—', color: '#EF4444' },
        ].map((stat) => (
          <div key={stat.label} style={{ backgroundColor: '#fff', padding: 24, borderRadius: 12, border: '1px solid #E5E7EB' }}>
            <p style={{ fontSize: 13, color: '#6B7280', marginBottom: 8 }}>{stat.label}</p>
            <p style={{ fontSize: 28, fontWeight: 700, color: stat.color }}>{stat.value}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
