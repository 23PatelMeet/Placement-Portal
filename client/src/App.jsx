import { Routes, Route, Navigate } from 'react-router-dom'
import './App.css'
import { ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import Welcome from './pages/Welcome'
import Login from './pages/Login'
import StudentRegister from './pages/StudentRegister'
import CompanyRegister from './pages/CompanyRegister'
import StudentDashboard from './pages/StudentDashboard'
import CompanyDashboard from './pages/CompanyDashboard'
import AdminDashboard from './pages/AdminDashboard'

function App() {
  return (
    <div className="min-vh-100 d-flex flex-column ">
      <div className="container my-4 flex-grow-1">
        <ToastContainer />
        <Routes>
          <Route path="/" element={<Welcome />} />
          <Route path="/login" element={<Login />} />
          <Route path="/register/student" element={<StudentRegister />} />
          <Route path="/register/company" element={<CompanyRegister />} />
          <Route path="/student" element={<StudentDashboard />} />
          <Route path="/company" element={<CompanyDashboard />} />
          <Route path="/admin" element={<AdminDashboard />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </div>
      <footer className="text-center py-3 border-top">Placement Portal</footer>
    </div>
  )
}

export default App
