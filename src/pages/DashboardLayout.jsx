import React from 'react';
import { Outlet, Link, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import {
  Home, Users, QrCode, LogOut, BarChart3, Settings2, Palette,
  Database, BrainCircuit, Megaphone, MessageSquare, MapPin
} from 'lucide-react';

const NavLink = ({ to, icon: Icon, label, currentPath }) => {
  const isActive = currentPath === to || (to !== '/dashboard' && to !== '/admin' && currentPath.startsWith(to));
  const isExactActive = currentPath === to;
  const active = isExactActive || isActive;

  return (
    <Link
      to={to}
      className={`flex items-center gap-3 px-3 py-2.5 rounded-lg font-medium transition-colors ${
        active
          ? 'text-[#1C1917] bg-[#F3EFE7]'
          : 'text-[#57534E] hover:bg-[#F3EFE7]'
      }`}
    >
      <Icon className={`w-5 h-5 ${active ? 'text-[#B85C38]' : ''}`} />
      {label}
    </Link>
  );
};

const DashboardLayout = () => {
  const { user, logout } = useAuth();
  const location = useLocation();
  const currentPath = location.pathname;

  return (
    <div className="flex min-h-screen bg-[#F3EFE7] font-['Manrope']">
      <aside className="w-64 bg-white border-r border-[#E7E5E4] flex flex-col shrink-0">
        <div className="p-6">
          <Link to="/" className="font-['Cormorant_Garamond'] text-2xl font-bold text-[#B85C38]">FidéliTour</Link>
        </div>

        <nav className="flex-1 px-4 space-y-1">
          {user?.role === 'business_owner' && (
            <>
              <NavLink to="/dashboard" icon={Home} label="Dashboard" currentPath={currentPath} />
              <NavLink to="/dashboard/analytics" icon={BarChart3} label="Analytics" currentPath={currentPath} />
              <NavLink to="/dashboard/customers" icon={Users} label="Customers" currentPath={currentPath} />
              <NavLink to="/dashboard/scan" icon={QrCode} label="Scan Visit" currentPath={currentPath} />
              <NavLink to="/dashboard/campaigns" icon={Megaphone} label="Campaigns" currentPath={currentPath} />
              <NavLink to="/dashboard/ai-assistant" icon={BrainCircuit} label="AI Assistant" currentPath={currentPath} />
              <NavLink to="/dashboard/settings" icon={Settings2} label="Settings" currentPath={currentPath} />
            </>
          )}
          {user?.role === 'super_admin' && (
            <>
              <NavLink to="/admin" icon={Home} label="Dashboard" currentPath={currentPath} />
              <NavLink to="/admin/analytics" icon={BarChart3} label="Global Analytics" currentPath={currentPath} />
              <NavLink to="/admin/tenants" icon={Database} label="Manage Businesses" currentPath={currentPath} />
              <NavLink to="/admin/card-designer" icon={Palette} label="Card Designer" currentPath={currentPath} />
              <NavLink to="/admin/campaigns" icon={Megaphone} label="Campaigns" currentPath={currentPath} />
              <NavLink to="/admin/ai" icon={BrainCircuit} label="AI Intelligence" currentPath={currentPath} />
            </>
          )}
        </nav>

        <div className="p-4 border-t border-[#E7E5E4]">
          <div className="text-sm font-medium truncate px-2 mb-4 text-[#57534E]">{user?.email}</div>
          <button
            onClick={logout}
            className="flex items-center gap-2 w-full px-2 py-2 text-[#991B1B] hover:bg-red-50 rounded-lg transition-colors font-medium"
          >
            <LogOut className="w-5 h-5" /> Sign Out
          </button>
        </div>
      </aside>

      <main className="flex-1 overflow-auto">
        <Outlet />
      </main>
    </div>
  );
};
export default DashboardLayout;
