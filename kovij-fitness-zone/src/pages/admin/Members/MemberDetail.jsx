import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { adminApi } from "../../../lib/adminApi";

export default function MemberDetail() {
  const { id } = useParams();
  const [data, setData] = useState(null);
  const [err, setErr] = useState(null);
  const [msg, setMsg] = useState("");

  useEffect(() => {
    (async () => {
      try {
        const { data: d } = await adminApi.get(`/admin/members/${id}`);
        setData(d);
      } catch (e) {
        setErr(e?.response?.data?.message || e.message);
      }
    })();
  }, [id]);

  const expire = async () => {
    setMsg("");
    try {
      await adminApi.post(`/admin/members/${id}/expire`);
      setMsg("Membership expired.");
      const { data: d } = await adminApi.get(`/admin/members/${id}`);
      setData(d);
    } catch (e) {
      setMsg(e?.response?.data?.message || e.message);
    }
  };

  const notify = async () => {
    const subject = window.prompt("Email subject?");
    const bodyHtml = window.prompt("HTML body (simple text ok)?");
    if (!subject || !bodyHtml) return;
    try {
      await adminApi.post(`/admin/members/${id}/notify`, { subject, bodyHtml });
      setMsg("Email queued.");
    } catch (e) {
      setMsg(e?.response?.data?.message || e.message);
    }
  };

  if (err) return <p className="text-red-500">{err}</p>;
  if (!data) return <p>Loading…</p>;

  const { member, profile, membership } = data;
  return (
    <div>
      <Link to="/admin/members" className="text-blue-600 text-sm hover:underline mb-4 inline-block">
        ← Members
      </Link>
      <h2 className="text-xl font-semibold mb-2">{member.name}</h2>
      <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
        {member.email} · {member.phone || "—"}
      </p>
      {msg && <p className="mb-2 text-sm text-green-600">{msg}</p>}
      <div className="flex flex-wrap gap-2 mb-6">
        <button type="button" onClick={expire} className="px-3 py-2 bg-amber-600 text-white rounded text-sm">
          Force expire active plan
        </button>
        <button type="button" onClick={notify} className="px-3 py-2 bg-gray-700 text-white rounded text-sm">
          Send custom email
        </button>
      </div>
      <h3 className="font-medium mb-2">Active membership</h3>
      {membership ? (
        <pre className="text-xs bg-gray-100 dark:bg-gray-800 p-3 rounded overflow-auto">{JSON.stringify(membership, null, 2)}</pre>
      ) : (
        <p className="text-sm text-gray-500">None</p>
      )}
      <h3 className="font-medium mt-4 mb-2">Profile</h3>
      {profile ? (
        <pre className="text-xs bg-gray-100 dark:bg-gray-800 p-3 rounded overflow-auto">{JSON.stringify(profile, null, 2)}</pre>
      ) : (
        <p className="text-sm text-gray-500">No profile</p>
      )}
    </div>
  );
}
