"use client";

import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useTheme } from "../../../context/ThemeContext";
import { Plus, Search, Edit, Trash2, Eye } from "lucide-react";
import { FaInstagram } from "react-icons/fa";

const TrainersList = () => {
  const { theme } = useTheme();
  const navigate = useNavigate();
  const [searchTerm, setSearchTerm] = useState("");
  const [trainers, setTrainers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [viewTrainer, setViewTrainer] = useState(null);
  const [showModal, setShowModal] = useState(false);


  // Add this line to get the token from localStorage
  const token = localStorage.getItem("token");

  useEffect(() => {
    fetch(`/api/trainers`)
      .then((res) => res.json())
      .then(setTrainers)
      .finally(() => setLoading(false));
  }, []);

  const filteredTrainers = trainers.filter(
    (trainer) =>
      trainer.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      trainer.role?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      trainer.description?.toLowerCase().includes(searchTerm.toLowerCase())
  );

const handleDelete = async (id) => {
  const token = localStorage.getItem('token');
  if (window.confirm("Are you sure you want to delete this trainer?")) {
    await fetch(`/api/trainers/${id}`, {
      method: "DELETE",
      headers: {
        Authorization: `Bearer ${token}`
      }
    });
    setTrainers(trainers.filter((t) => t._id !== id));
  }
};

 const handleToggleShow = async (id, current) => {
  const token = localStorage.getItem('token');
  await fetch(`/api/trainers/${id}`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`
    },
    body: JSON.stringify({ showOnFrontend: !current })
  });
  setTrainers(
    trainers.map((t) =>
      t._id === id ? { ...t, showOnFrontend: !current } : t
    )
  );
};

  const handleView = (trainer) => {
    setViewTrainer(trainer);
    setShowModal(true);
  };

  return (
    <div className="min-h-screen space-y-6 max-w-6xl mx-auto px-2 py-4">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1
            className={`text-2xl font-bold ${
              theme === "dark" ? "text-white" : "text-gray-900"
            }`}
          >
            Trainers
          </h1>
          <p
            className={`mt-2 ${
              theme === "dark" ? "text-gray-400" : "text-gray-600"
            }`}
          >
            Manage your fitness trainers and their profiles
          </p>
        </div>
        <button
          onClick={() => navigate("/admin/trainers/new")}
          className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 w-full sm:w-auto justify-center"
        >
          <Plus size={20} className="mr-2" />
          Add New Trainer
        </button>
      </div>
      <div
        className={`${
          theme === "dark"
            ? "bg-gray-800 border-gray-700"
            : "bg-white border-gray-200"
        } border rounded-lg p-4`}
      >
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="relative flex-1">
            <Search
              className={`absolute left-3 top-1/2 transform -translate-y-1/2 ${
                theme === "dark" ? "text-gray-400" : "text-gray-500"
              }`}
              size={20}
            />
            <input
              type="text"
              placeholder="Search trainers..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border rounded-lg"
            />
          </div>
        </div>
      </div>
      {/* Table for desktop, cards for mobile */}
      <div className="hidden md:block">
        <div
          className={`${
            theme === "dark"
              ? "bg-gray-800 border-gray-700"
              : "bg-white border-gray-200"
          } border rounded-lg overflow-x-auto`}
        >
          <table className="w-full min-w-[600px]">
            <thead
              className={`${theme === "dark" ? "bg-gray-700" : "bg-gray-50"}`}
            >
              <tr>
                <th className="px-4 py-2 text-left text-xs font-medium uppercase">
                  Image
                </th>
                <th className="px-4 py-2 text-left text-xs font-medium uppercase">
                  Name
                </th>
                <th className="px-4 py-2 text-left text-xs font-medium uppercase">
                  Role
                </th>
                <th className="px-4 py-2 text-left text-xs font-medium uppercase">
                  Instagram
                </th>
                <th className="px-4 py-2 text-left text-xs font-medium uppercase">
                  Show
                </th>
                <th className="px-4 py-2 text-left text-xs font-medium uppercase">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={6} className="text-center py-8">
                    Loading...
                  </td>
                </tr>
              ) : filteredTrainers.length === 0 ? (
                <tr>
                  <td colSpan={6} className="text-center py-8">
                    No trainers found.
                  </td>
                </tr>
              ) : (
                filteredTrainers.map((trainer) => (
                  <tr
                    key={trainer._id}
                    className="transition-transform duration-200 transform border-b border-transparent hover:border-blue-500"
                  >
                    <td className="px-4 py-2">
                      <img
                        src={trainer.image}
                        alt={trainer.name}
                        className="w-10 h-10 rounded-full object-cover"
                      />
                    </td>
                    <td className="px-4 py-2">{trainer.name}</td>
                    <td className="px-4 py-2">{trainer.role}</td>
                    <td className="px-4 py-2">
                      <a
                        href={trainer.instagram}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-pink-500 hover:text-pink-600 text-xl flex items-center"
                        title="Instagram"
                      >
                        <FaInstagram />
                      </a>
                    </td>
                    <td className="px-4 py-2">
                      <label className="inline-flex items-center cursor-pointer">
                        <input
                          type="checkbox"
                          checked={trainer.showOnFrontend}
                          onChange={() =>
                            handleToggleShow(
                              trainer._id,
                              trainer.showOnFrontend
                            )
                          }
                          className="sr-only peer"
                        />
                        <div className="relative w-11 h-6 bg-gray-200 rounded-full peer peer-focus:ring-4 peer-focus:ring-blue-300 dark:peer-focus:ring-blue-800 dark:bg-gray-700 peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-0.5 after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-blue-600 dark:peer-checked:bg-blue-600"></div>
                        <span className="ml-3 text-sm font-medium text-gray-900 dark:text-gray-600">
                          {trainer.showOnFrontend ? "Yes" : "No"}
                        </span>
                      </label>
                    </td>
                    <td className="px-4 py-2">
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleView(trainer)}
                          className="p-2 rounded-lg text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900"
                        >
                          <Eye size={16} />
                        </button>
                        <button
                          onClick={() =>
                            navigate(`/admin/trainers/edit/${trainer._id}`)
                          }
                          className="p-2 rounded-lg text-yellow-600 hover:bg-yellow-50 dark:hover:bg-yellow-900"
                        >
                          <Edit size={16} />
                        </button>
                        <button
                          onClick={() => handleDelete(trainer._id)}
                          className="p-2 rounded-lg text-red-600 hover:bg-red-50 dark:hover:bg-red-900"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
      {/* Mobile cards */}
      <div className="md:hidden space-y-4">
        {loading ? (
          <div className="text-center py-8">Loading...</div>
        ) : filteredTrainers.length === 0 ? (
          <div className="text-center py-8">No trainers found.</div>
        ) : (
          filteredTrainers.map((trainer) => (
            <div
              key={trainer._id}
              className={`${
                theme === "dark"
                  ? "bg-gray-800 border-gray-700"
                  : "bg-white border-gray-200"
              } border rounded-lg p-4 flex flex-col gap-2`}
            >
              <div className="flex items-center gap-3">
                <img
                  src={trainer.image}
                  alt={trainer.name}
                  className="w-14 h-14 rounded-full object-cover"
                />
                <div>
                  <div className="font-semibold">{trainer.name}</div>
                  <div className="text-xs text-gray-500">{trainer.role}</div>
                </div>
              </div>
              <div className="text-sm mt-2">{trainer.description}</div>
              <div className="flex items-center gap-2 mt-2">
                <a
                  href={trainer.instagram}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-pink-500 hover:text-pink-600 text-xl flex items-center"
                  title="Instagram"
                >
                  <FaInstagram />
                </a>
                <label className="inline-flex items-center mb-0 cursor-pointer ml-auto">
                  <input
                    type="checkbox"
                    checked={trainer.showOnFrontend}
                    onChange={() =>
                      handleToggleShow(trainer._id, trainer.showOnFrontend)
                    }
                    className="sr-only peer"
                  />
                  <div className="relative w-9 h-5 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 dark:peer-focus:ring-blue-800 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all dark:border-gray-600 peer-checked:bg-blue-600 dark:peer-checked:bg-blue-600"></div>
                  <span className="ml-2 text-xs text-gray-900 dark:text-gray-300">
                    {trainer.showOnFrontend ? "Yes" : "No"}
                  </span>
                </label>
              </div>
              <div className="flex gap-2 mt-2">
                <button
                  onClick={() => handleView(trainer)}
                  className="flex-1 p-2 rounded-lg text-blue-600 border border-blue-100 hover:bg-blue-50 text-xs"
                >
                  <Eye size={14} className="inline mr-1" /> View
                </button>
                <button
                  onClick={() =>
                    navigate(`/admin/trainers/edit/${trainer._id}`)
                  }
                  className="flex-1 p-2 rounded-lg text-yellow-600 border border-yellow-100 hover:bg-yellow-50 text-xs"
                >
                  <Edit size={14} className="inline mr-1" /> Edit
                </button>
                <button
                  onClick={() => handleDelete(trainer._id)}
                  className="flex-1 p-2 rounded-lg text-red-600 border border-red-100 hover:bg-red-50 text-xs"
                >
                  <Trash2 size={14} className="inline mr-1" /> Delete
                </button>
              </div>
            </div>
          ))
        )}
      </div>
      {showModal && viewTrainer && (
        <div
          className={`fixed inset-0 z-50 flex items-center justify-center transition bg-black/40 ${
            theme === "dark" ? "backdrop-blur-sm" : ""
          }`}
        >
          <div
            className={`w-full max-w-md mx-2 rounded-lg shadow-lg p-6 relative
      ${
        theme === "dark" ? "bg-gray-900 text-white" : "bg-white text-gray-900"
      }`}
          >
            <button
              className={`absolute top-2 right-2 ${
                theme === "dark"
                  ? "text-gray-400 hover:text-gray-200"
                  : "text-gray-400 hover:text-gray-700"
              }`}
              onClick={() => setShowModal(false)}
            >
              <span className="text-2xl">&times;</span>
            </button>
            <div className="flex flex-col items-center gap-3">
              <img
                src={viewTrainer.image}
                alt={viewTrainer.name}
                className="w-24 h-24 rounded-full object-cover"
              />
              <h2 className="text-xl font-bold">{viewTrainer.name}</h2>
              <div
                className={`text-sm ${
                  theme === "dark" ? "text-gray-300" : "text-gray-500"
                }`}
              >
                {viewTrainer.role}
              </div>
              <div
                className={`text-center text-sm my-2 ${
                  theme === "dark" ? "text-gray-200" : ""
                }`}
              >
                {viewTrainer.description}
              </div>
              <a
                href={viewTrainer.instagram}
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-500 underline text-xs"
              >
                Instagram
              </a>
              <div className="mt-2 text-xs">
                Show on frontend:{" "}
                <span
                  className={
                    viewTrainer.showOnFrontend
                      ? "text-green-600"
                      : "text-red-600"
                  }
                >
                  {viewTrainer.showOnFrontend ? "Yes" : "No"}
                </span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default TrainersList;
