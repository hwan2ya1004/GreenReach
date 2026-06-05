import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Landing from './pages/Landing';
import MapView from './pages/MapView';
import Dashboard from './pages/Dashboard';
import Compare from './pages/Compare';
import FeedbackAdmin from './pages/FeedbackAdmin';
import Navbar from './components/Navbar';

function App() {
  return (
    <BrowserRouter>
      <div className="min-h-screen bg-gray-50">
        <Navbar />
        <Routes>
          <Route path="/" element={<Landing />} />
          <Route path="/map" element={<MapView />} />
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/compare" element={<Compare />} />
          {/* 관리자 전용 - Navbar에 노출 안 함 */}
          <Route path="/feedback" element={<FeedbackAdmin />} />
        </Routes>
      </div>
    </BrowserRouter>
  );
}

export default App;
