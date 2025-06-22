import { useState } from 'react';
import { FiMenu } from 'react-icons/fi';
import { useTheme } from '../../context/ThemeContext';
import AdminSidebar from './AdminSidebar';

const AdminLayout = ({ children }) => {
  const { theme } = useTheme();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className={`min-h-screen flex ${theme === 'dark' ? 'bg-gray-900' : 'bg-gray-100'} transition-colors duration-300`}>
      <AdminSidebar sidebarOpen={sidebarOpen} setSidebarOpen={setSidebarOpen} />

      {/* Main Content */}
      <div className="flex-1 md:ml-64">
        {/* Mobile Menu Button */}
        <button 
          className="md:hidden p-4"
          onClick={() => setSidebarOpen(!sidebarOpen)}
        >
          <FiMenu size={24} className={theme === 'dark' ? 'text-white' : 'text-gray-800'} />
        </button>

        {/* Page Content */}
        <div className="p-6 md:p-10">
          {children}
        </div>
      </div>
    </div>
  );
};

export default AdminLayout;