import React from 'react';
import {
  Sidebar,
  PanelBottom,
  PanelRight,
  LayoutGrid,
  Search,
  Settings,
} from 'lucide-react';

interface TopNavProps {
  activeTab: 'projetos' | 'daily' | 'equipamentos' | 'ide' | 'ports';
  setActiveTab: (tab: 'projetos' | 'daily' | 'equipamentos' | 'ide' | 'ports') => void;
}

export const TopNav: React.FC<TopNavProps> = ({ activeTab, setActiveTab }) => {
  const tabs = [
    { id: 'projetos', label: 'Projetos' },
    { id: 'daily', label: 'Daily' },
    { id: 'equipamentos', label: 'Equipamentos' },
    { id: 'ide', label: 'IDE' },
    { id: 'ports', label: 'Ports' },
  ] as const;

  return (
    <header
      style={{
        height: '42px',
        backgroundColor: '#090a0d',
        borderBottom: 'none',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0 12px',
        userSelect: 'none',
      }}
    >
      {/* Left: Nav Tabs */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
        {tabs.map((tab) => {
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`nav-tab ${isActive ? 'active' : ''}`}
            >
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Right: Layout icons & Profile */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
        {/* Layout Icons */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', color: '#686e7f' }}>
          <Sidebar size={16} style={{ cursor: 'pointer' }} />
          <PanelBottom size={16} style={{ cursor: 'pointer' }} />
          <PanelRight size={16} style={{ cursor: 'pointer' }} />
          <LayoutGrid size={16} style={{ cursor: 'pointer' }} />
          <Search size={16} style={{ cursor: 'pointer' }} />
          <Settings size={16} style={{ cursor: 'pointer' }} />
        </div>

        {/* Profile (Walancy Walancy + Red avatar) */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', lineHeight: 1.1 }}>
            <span style={{ fontSize: '0.78rem', fontWeight: 600, color: '#e4e4e7' }}>Walancy</span>
            <span style={{ fontSize: '0.66rem', color: '#71717a' }}>Walancy</span>
          </div>

          <div
            style={{
              width: '28px',
              height: '28px',
              borderRadius: '50%',
              backgroundColor: '#ef4444',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#ffffff',
              fontSize: '0.75rem',
              fontWeight: 700,
              boxShadow: '0 0 8px rgba(239, 68, 68, 0.4)',
            }}
          >
            W
          </div>
        </div>
      </div>
    </header>
  );
};
