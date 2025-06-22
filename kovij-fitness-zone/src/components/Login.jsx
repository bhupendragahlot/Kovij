// import { useState } from 'react';
// import { useNavigate } from 'react-router-dom';
// import { FaLock, FaUser } from 'react-icons/fa';
// import { useTheme } from '../context/ThemeContext';

// function Login() {
//   const { theme } = useTheme();
//   const navigate = useNavigate();
//   const [formData, setFormData] = useState({
//     email: '',
//     password: ''
//   });
//   const [error, setError] = useState('');
//   const [loading, setLoading] = useState(false);

//   const handleChange = (e) => {
//     const { name, value } = e.target;
//     setFormData(prev => ({ ...prev, [name]: value }));
//   };

//   const handleSubmit = async (e) => {
//     e.preventDefault();
//     setError('');
//     setLoading(true);

//     try {
//       const response = await fetch('http://localhost:5000/api/auth/login', {
//         method: 'POST',
//         headers: {
//           'Content-Type': 'application/json'
//         },
//         body: JSON.stringify(formData)
//       });

//       const data = await response.json();

//       if (!response.ok) {
//         throw new Error(data.message || 'Login failed');
//       }

//       // Save token and user data to localStorage
//       localStorage.setItem('token', data.token);
//       localStorage.setItem('user', JSON.stringify(data.user));

//       // Redirect to admin dashboard
//       navigate('/admin/dashboard');
//     } catch (error) {
//       setError(error.message);
//     } finally {
//       setLoading(false);
//     }
//   };

//   return (
//     <div className={`min-h-screen flex items-center justify-center ${
//       theme === 'dark' 
//         ? 'bg-gradient-to-b from-gray-900 to-black' 
//         : 'bg-gradient-to-b from-gray-100 to-white'
//     }`}>
//       <div className={`w-full max-w-md p-8 rounded-xl shadow-lg ${
//         theme === 'dark'
//           ? 'bg-gray-800/50 backdrop-blur-sm border border-gray-700'
//           : 'bg-white/80 backdrop-blur-sm border border-gray-200'
//       }`}>
//         <div className="text-center mb-8">
//           <h1 className="text-3xl font-bold mb-2">
//             <span className="text-transparent bg-clip-text bg-gradient-to-r from-red-500 to-yellow-500">
//               Admin Login
//             </span>
//           </h1>
//           <p className={`${theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}`}>
//             Enter your credentials to access the admin panel
//           </p>
//         </div>

//         {error && (
//           <div className="bg-red-500/20 text-red-500 p-4 rounded-lg mb-6">
//             {error}
//           </div>
//         )}

//         <form onSubmit={handleSubmit}>
//           <div className="mb-6">
//             <label 
//               htmlFor="email" 
//               className={`block mb-2 font-medium ${
//                 theme === 'dark' ? 'text-gray-300' : 'text-gray-700'
//               }`}
//             >
//               email
//             </label>
//             <div className={`flex items-center border rounded-lg overflow-hidden ${
//               theme === 'dark' ? 'bg-gray-700/50 border-gray-600' : 'bg-gray-100 border-gray-300'
//             }`}>
//               <span className="p-3 text-gray-500">
//                 <FaUser />
//               </span>
//               <input
//                 type="text"
//                 id="email"
//                 name="email"
//                 value={formData.email}
//                 onChange={handleChange}
//                 required
//                 className={`w-full p-3 outline-none ${
//                   theme === 'dark' ? 'bg-gray-700/50 text-white' : 'bg-gray-100 text-gray-800'
//                 }`}
//                 placeholder="Enter your email"
//               />
//             </div>
//           </div>

//           <div className="mb-6">
//             <label 
//               htmlFor="password" 
//               className={`block mb-2 font-medium ${
//                 theme === 'dark' ? 'text-gray-300' : 'text-gray-700'
//               }`}
//             >
//               Password
//             </label>
//             <div className={`flex items-center border rounded-lg overflow-hidden ${
//               theme === 'dark' ? 'bg-gray-700/50 border-gray-600' : 'bg-gray-100 border-gray-300'
//             }`}>
//               <span className="p-3 text-gray-500">
//                 <FaLock />
//               </span>
//               <input
//                 type="password"
//                 id="password"
//                 name="password"
//                 value={formData.password}
//                 onChange={handleChange}
//                 required
//                 className={`w-full p-3 outline-none ${
//                   theme === 'dark' ? 'bg-gray-700/50 text-white' : 'bg-gray-100 text-gray-800'
//                 }`}
//                 placeholder="Enter your password"
//               />
//             </div>
//           </div>

//           <button
//             type="submit"
//             disabled={loading}
//             className={`w-full py-3 px-6 rounded-lg font-bold transition-all duration-300 transform hover:scale-105 disabled:opacity-70 disabled:cursor-not-allowed ${
//               theme === 'dark'
//                 ? 'bg-gradient-to-r from-red-600 to-red-500 text-white'
//                 : 'bg-gradient-to-r from-red-700 to-red-600 text-white'
//             }`}
//           >
//             {loading ? 'Logging in...' : 'Login'}
//           </button>
//         </form>
//       </div>
//     </div>
//   );
// }

// export default Login;

import { useState } from 'react';
import { useTheme } from '../context/ThemeContext';
import { FiMail, FiLock, FiEye, FiEyeOff, FiUser, FiSun, FiMoon } from 'react-icons/fi';
import axios from 'axios';


const Login = () => {
  const [formData, setFormData] = useState({
    email: '',
    password: ''
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  // Removed theme and toggleTheme
  const { theme, toggleTheme } = useTheme();

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const response = await axios.post('/api/auth/login', {
        email: formData.email,
        password: formData.password
      });

      // Handle successful login
      console.log('Login successful:', response.data);
      // Redirect or store token in localStorage
      localStorage.setItem('authToken', response.data.token);
      window.location.href = '/admin/dashboard'; // or use React Router navigation
    } catch (err) {
      setError(err.response?.data?.message || 'Login failed. Please check your credentials.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col md:flex-row min-h-screen bg-gray-50 transition-colors duration-300">
      {/* Left side - Text content */}
      <div className="flex-1 flex flex-col justify-center p-8 md:p-16 lg:p-24">
        <div className="max-w-lg">
          <h1 className="text-4xl font-bold text-gray-800 mb-6">
            Admin Dashboard
          </h1>
          <p className="text-lg text-gray-600 mb-8">
            Welcome back! Log in to access your admin dashboard and manage your application.
          </p>
          <div className="flex items-center text-gray-500">
            <FiUser className="mr-2" />
            <span>Secure admin access</span>
          </div>
        </div>
      </div>

      {/* Right side - Login form */}
      <div className="flex-1 flex items-center justify-center p-8 md:p-16 lg:p-24">
        <div className="w-full max-w-md bg-white rounded-lg shadow-lg p-8">
          <div className="flex justify-between items-center mb-8">
            <h2 className="text-2xl font-semibold text-gray-800">
              Login
            </h2>
            {/* Removed theme toggle button */}
            <button 
              onClick={toggleTheme} 
              className="p-2 rounded-full hover:bg-gray-100 transition-colors"
              aria-label="Toggle theme"
            >
              {theme === 'dark' ? (
                <FiSun className="text-yellow-400" size={20} />
              ) : (
                <FiMoon className="text-gray-600" size={20} />
              )}
            </button>
          </div>

          {error && (
            <div className="mb-6 p-3 bg-red-100 border border-red-300 text-red-700 rounded-md">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit}>
            <div className="mb-6">
              <label htmlFor="email" className="block mb-2 text-sm font-medium text-gray-700">
                Email Address
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
                  <FiMail className="text-gray-500" />
                </div>
                <input
                  type="email"
                  id="email"
                  name="email"
                  value={formData.email}
                  onChange={handleChange}
                  className="bg-gray-50 border border-gray-300 text-gray-900 text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 block w-full pl-10 p-2.5"
                  placeholder="admin@example.com"
                  required
                />
              </div>
            </div>

            <div className="mb-6">
              <label htmlFor="password" className="block mb-2 text-sm font-medium text-gray-700">
                Password
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
                  <FiLock className="text-gray-500" />
                </div>
                <input
                  type={showPassword ? "text" : "password"}
                  id="password"
                  name="password"
                  value={formData.password}
                  onChange={handleChange}
                  className="bg-gray-50 border border-gray-300 text-gray-900 text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 block w-full pl-10 p-2.5"
                  placeholder="••••••••"
                  required
                />
                <button
                  type="button"
                  className="absolute inset-y-0 right-0 flex items-center pr-3"
                  onClick={() => setShowPassword(!showPassword)}
                >
                  {showPassword ? (
                    <FiEyeOff className="text-gray-500" />
                  ) : (
                    <FiEye className="text-gray-500" />
                  )}
                </button>
              </div>
            </div>

            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center">
                <input
                  id="remember"
                  type="checkbox"
                  className="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500"
                />
                <label htmlFor="remember" className="ml-2 text-sm text-gray-700">
                  Remember me
                </label>
              </div>
              <a href="#" className="text-sm text-blue-600 hover:underline">
                Forgot password?
              </a>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-blue-600 hover:bg-blue-700 focus:ring-4 focus:ring-blue-300 font-medium rounded-lg text-sm px-5 py-2.5 text-white disabled:opacity-75"
            >
              {loading ? 'Logging in...' : 'Log In'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};


export default Login;