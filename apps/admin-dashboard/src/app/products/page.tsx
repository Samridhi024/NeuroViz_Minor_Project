export default function ProductsPage() {
  // TODO: Product list with CRUD, filters, search
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <h1 style={{ fontSize: 24, fontWeight: 700 }}>Products</h1>
        <button style={{ backgroundColor: '#16A34A', color: '#fff', border: 'none', padding: '10px 20px', borderRadius: 8, cursor: 'pointer', fontWeight: 600 }}>
          + Add Product
        </button>
      </div>
      <p style={{ color: '#6B7280' }}>Product management coming in Iteration 4.</p>
    </div>
  );
}
