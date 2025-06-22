import { Navigate, Outlet } from "react-router-dom";

const ProtectedRoute = () => {
  const token = localStorage.getItem("authToken");
  return token ? <Outlet /> : <Navigate to="/admin/login" replace />;
};

export default ProtectedRoute;