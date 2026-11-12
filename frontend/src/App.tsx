import React, { Suspense, lazy } from 'react';
import { Route, Routes } from 'react-router-dom';
import { AppShell } from './components/AppShell';
import { HomeRedirect, RequireAdmin, RequireAuth } from './components/RouteGuards';
import { LoadingRegion, Skeleton } from './components/ui/States';

// Route-level code splitting keeps the first load small on mobile networks.
const LoginPage = lazy(() => import('./pages/LoginPage'));
const SocietyDashboard = lazy(() => import('./pages/SocietyDashboard'));
const ProductPoolDetails = lazy(() => import('./pages/ProductPoolDetails'));
const CheckoutPage = lazy(() => import('./pages/CheckoutPage'));
const MyOrdersPage = lazy(() => import('./pages/MyOrdersPage'));
const OrderDetailPage = lazy(() => import('./pages/OrderDetailPage'));
const ProfilePage = lazy(() => import('./pages/ProfilePage'));
const SocietyAdminPage = lazy(() => import('./pages/admin/SocietyAdminPage'));
const PoolDispatchPage = lazy(() => import('./pages/admin/PoolDispatchPage'));
const NotFoundPage = lazy(() => import('./pages/NotFoundPage'));

const PageFallback: React.FC = () => (
  <div className="max-w-[640px] mx-auto px-4 pt-4">
    <LoadingRegion label="Loading page" className="space-y-4">
      <Skeleton className="h-6 w-1/2" />
      <Skeleton className="h-40 rounded-2xl" />
      <Skeleton className="h-40 rounded-2xl" />
    </LoadingRegion>
  </div>
);

const App: React.FC = () => (
  <Suspense fallback={<PageFallback />}>
    <Routes>
      <Route path="/" element={<HomeRedirect />} />

      <Route element={<AppShell />}>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/signup" element={<LoginPage initialMode="signup" />} />
      </Route>

      <Route element={<RequireAuth />}>
        {/* Resident tabs */}
        <Route element={<AppShell nav />}>
          <Route path="/s/:societyId" element={<SocietyDashboard />} />
          <Route path="/orders" element={<MyOrdersPage />} />
          <Route path="/profile" element={<ProfilePage />} />
        </Route>

        {/* Pages with their own sticky action bar */}
        <Route element={<AppShell actionBar />}>
          <Route path="/pools/:poolId" element={<ProductPoolDetails />} />
          <Route path="/pools/:poolId/checkout" element={<CheckoutPage />} />
        </Route>

        <Route element={<AppShell />}>
          <Route path="/orders/:orderId" element={<OrderDetailPage />} />
        </Route>

        {/* Society admin */}
        <Route element={<RequireAdmin />}>
          <Route element={<AppShell />}>
            <Route path="/admin/s/:societyId" element={<SocietyAdminPage />} />
          </Route>
          <Route element={<AppShell actionBar />}>
            <Route path="/admin/pools/:id/dispatch" element={<PoolDispatchPage />} />
          </Route>
        </Route>
      </Route>

      <Route element={<AppShell />}>
        <Route path="*" element={<NotFoundPage />} />
      </Route>
    </Routes>
  </Suspense>
);

export default App;
