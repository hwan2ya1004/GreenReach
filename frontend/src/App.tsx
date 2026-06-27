import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Landing from './pages/Landing';
import MapView from './pages/MapView';
import Dashboard from './pages/Dashboard';
import Compare from './pages/Compare';
import FeedbackAdmin from './pages/FeedbackAdmin';
import Navbar from './components/Navbar';
import ChatBot from './components/ChatBot';

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
        {/* 전역 플로팅 AI 챗봇 - 모든 페이지에서 오른쪽 하단에 표시 */}
        <ChatBot />
      </div>
    </BrowserRouter>
  );
}

export default App;
