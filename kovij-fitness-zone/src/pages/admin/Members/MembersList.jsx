import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { adminApi } from "../../../lib/adminApi";

export default function MembersList() {
  const [members, setMembers] = useState([]);
  const [q, setQ] = useState("");
  const [err, setErr] = useState(null);

  const load = async () => {
    setErr(null);
    try {
      const { data } = await adminApi.get("/admin/members", { params: { q } });
      setMembers(data.members || []);
    } catch (e) {
      setErr(e?.response?.data?.message || e.message);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div>
      <h2 className="text-xl font-semibold mb-4">Members</h2>
      <div className="flex gap-2 mb-4">
        <input
          className="border rounded px-3 py-2 flex-1 max-w-xs bg-white dark:bg-gray-800 dark:border-gray-600"
          placeholder="Search name, email, phone"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        <button type="button" onClick={load} className="px-4 py-2 bg-blue-600 text-white rounded">
          Search
        </button>
      </div>
      {err && <p className="text-red-500 mb-2">{err}</p>}
      <div className="overflow-x-auto border rounded-lg dark:border-gray-700">
        <table className="min-w-full text-sm">
          <thead className="bg-gray-100 dark:bg-gray-800">
            <tr>
              <th className="text-left p-2">Name</th>
              <th className="text-left p-2">Email</th>
              <th className="text-left p-2">Phone</th>
              <th className="p-2"></th>
            </tr>
          </thead>
          <tbody>
            {members.map((m) => (
              <tr key={m._id} className="border-t dark:border-gray-700">
                <td className="p-2">{m.name}</td>
                <td className="p-2">{m.email}</td>
                <td className="p-2">{m.phone || "—"}</td>
                <td className="p-2">
                  <Link to={`/admin/members/${m._id}`} className="text-blue-600 hover:underline">
                    View
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
