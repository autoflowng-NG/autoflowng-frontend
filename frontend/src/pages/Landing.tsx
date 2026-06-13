/**
 * AutoFlowNG — Landing Page
 *
 * The marketing landing page has been moved to the /landing directory
 * (Next.js 16 with the new UI design).
 *
 * This file is kept as a placeholder. The Vite SPA (this frontend/)
 * handles authenticated app routes only. Unauthenticated users at "/"
 * are redirected to the Login page.
 *
 * To run the new landing page:
 *   cd landing && npm run dev
 *
 * Deploy landing/ as a separate Vercel project pointing to your domain root (autoflowng.com),
 * and frontend/ as the app subdomain (app.autoflowng.com).
 */

import { useEffect } from 'react';
import { useLocation } from 'wouter';

export default function Landing() {
  const [, navigate] = useLocation();

  useEffect(() => {
    // In the SPA context, unauthenticated root visits go to login.
    // The actual marketing landing page lives in /landing (Next.js).
    navigate('/login', { replace: true });
  }, [navigate]);

  return null;
}
