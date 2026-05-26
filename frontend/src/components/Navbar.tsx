import { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Menu, X, Leaf } from 'lucide-react';

const navLinks = [
  { to: '/', label: '홈' },
  { to: '/map', label: '내 동네 분석' },
  { to: '/compare', label: '동네 비교' },
  { to: '/dashboard', label: '지자체 대시보드' },
];

export default function Navbar() {
  const [open, setOpen] = useState(false);
  const location = useLocation();

  return (
    <nav className="bg-white border-b border-gray-200 sticky top-0 z-50 shadow-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* 로고 */}
          <Link to="/" className="flex items-center gap-2 font-bold text-xl text-green-700">
            <Leaf className="w-6 h-6 text-green-600" />
            <span>GreenReach</span>
            <span className="text-sm font-normal text-gray-500 hidden sm:inline">그린리치</span>
          </Link>

          {/* 데스크탑 메뉴 */}
          <div className="hidden md:flex items-center gap-1">
            {navLinks.map((link) => (
              <Link
                key={link.to}
                to={link.to}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  location.pathname === link.to
                    ? 'bg-green-50 text-green-700'
                    : 'text-gray-600 hover:text-green-700 hover:bg-green-50'
                }`}
              >
                {link.label}
              </Link>
            ))}
            <Link
              to="/map"
              className="ml-3 bg-green-600 hover:bg-green-700 text-white text-sm font-semibold px-4 py-2 rounded-lg transition-colors"
            >
              내 위치 분석하기
            </Link>
          </div>

          {/* 모바일 햄버거 */}
          <button
            className="md:hidden p-2 rounded-lg text-gray-600 hover:bg-gray-100"
            onClick={() => setOpen(!open)}
          >
            {open ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {/* 모바일 메뉴 */}
      {open && (
        <div className="md:hidden border-t border-gray-100 bg-white px-4 py-3 space-y-1">
          {navLinks.map((link) => (
            <Link
              key={link.to}
              to={link.to}
              onClick={() => setOpen(false)}
              className={`block px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                location.pathname === link.to
                  ? 'bg-green-50 text-green-700'
                  : 'text-gray-600 hover:text-green-700 hover:bg-green-50'
              }`}
            >
              {link.label}
            </Link>
          ))}
          <Link
            to="/map"
            onClick={() => setOpen(false)}
            className="block mt-2 bg-green-600 text-white text-sm font-semibold px-4 py-2 rounded-lg text-center"
          >
            내 위치 분석하기
          </Link>
        </div>
      )}
    </nav>
  );
}
