import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Samruddhi Agros - Admin Dashboard',
  description: 'Admin dashboard for Samruddhi Agros farm-to-customer platform',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <div style={{ display: 'flex', minHeight: '100vh' }}>
          <aside style={{ width: 260, backgroundColor: '#111827', color: '#fff', padding: 24 }}>
            <h1 style={{ fontSize: 18, fontWeight: 700, color: '#16A34A', marginBottom: 32 }}>
              🌾 Samruddhi Agros
            </h1>
            <nav>
              <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                {[
                  { href: '/', label: 'Dashboard' },
                  { href: '/products', label: 'Products' },
                  { href: '/orders', label: 'Orders' },
                  { href: '/inventory', label: 'Inventory' },
                  { href: '/delivery-partners', label: 'Delivery Partners' },
                  { href: '/offers', label: 'Offers' },
                  { href: '/refunds', label: 'Refunds' },
                  { href: '/analytics', label: 'Analytics' },
                  { href: '/audit-log', label: 'Audit Log' },
                ].map((item) => (
                  <li key={item.href} style={{ marginBottom: 8 }}>
                    <a href={item.href} style={{ color: '#D1D5DB', textDecoration: 'none', fontSize: 14, display: 'block', padding: '8px 12px', borderRadius: 8 }}>
                      {item.label}
                    </a>
                  </li>
                ))}
              </ul>
            </nav>
          </aside>
          <main style={{ flex: 1, padding: 32, backgroundColor: '#F9FAFB' }}>
            {children}
          </main>
        </div>
      </body>
    </html>
  );
}
