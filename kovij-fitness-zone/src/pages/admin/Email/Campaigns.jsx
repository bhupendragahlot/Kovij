import { useEffect, useState } from "react";
import { adminApi } from "../../../lib/adminApi";

export default function Campaigns() {
  const [campaigns, setCampaigns] = useState([]);
  const [form, setForm] = useState({
    title: "",
    type: "offer",
    subject: "",
    bodyHtml: "<p>Hello {{name}}</p>",
    audienceFilter: "all",
  });
  const [msg, setMsg] = useState("");

  const load = async () => {
    const { data } = await adminApi.get("/campaigns");
    setCampaigns(data.campaigns || []);
  };

  useEffect(() => {
    load().catch(() => {});
  }, []);

  const create = async (e) => {
    e.preventDefault();
    setMsg("");
    try {
      await adminApi.post("/campaigns", form);
      setMsg("Campaign created.");
      setForm({ ...form, title: "", subject: "", bodyHtml: "<p></p>" });
      await load();
    } catch (e) {
      setMsg(e?.response?.data?.message || e.message);
    }
  };

  const send = async (id) => {
    setMsg("");
    try {
      const { data } = await adminApi.post(`/campaigns/${id}/send`);
      setMsg(`Queued: ${data.queued}`);
      await load();
    } catch (e) {
      setMsg(e?.response?.data?.message || e.message);
    }
  };

  const test = async (id) => {
    const to = window.prompt("Send test to email?");
    if (!to) return;
    try {
      await adminApi.post(`/campaigns/${id}/test`, { to });
      setMsg("Test queued.");
    } catch (e) {
      setMsg(e?.response?.data?.message || e.message);
    }
  };

  return (
    <div>
      <h2 className="text-xl font-semibold mb-4">Email campaigns</h2>
      {msg && <p className="mb-2 text-sm text-green-600">{msg}</p>}
      <form onSubmit={create} className="space-y-3 max-w-xl mb-8 border p-4 rounded-lg dark:border-gray-700">
        <input
          className="w-full border rounded px-3 py-2 dark:bg-gray-800 dark:border-gray-600"
          placeholder="Title"
          value={form.title}
          onChange={(e) => setForm({ ...form, title: e.target.value })}
          required
        />
        <select
          className="w-full border rounded px-3 py-2 dark:bg-gray-800 dark:border-gray-600"
          value={form.type}
          onChange={(e) => setForm({ ...form, type: e.target.value })}
        >
          <option value="offer">Offer</option>
          <option value="festival">Festival</option>
          <option value="info">Info</option>
          <option value="bulk">Bulk</option>
        </select>
        <input
          className="w-full border rounded px-3 py-2 dark:bg-gray-800 dark:border-gray-600"
          placeholder="Subject"
          value={form.subject}
          onChange={(e) => setForm({ ...form, subject: e.target.value })}
          required
        />
        <textarea
          className="w-full border rounded px-3 py-2 font-mono text-xs dark:bg-gray-800 dark:border-gray-600"
          rows={6}
          value={form.bodyHtml}
          onChange={(e) => setForm({ ...form, bodyHtml: e.target.value })}
          required
        />
        <select
          className="w-full border rounded px-3 py-2 dark:bg-gray-800 dark:border-gray-600"
          value={form.audienceFilter}
          onChange={(e) => setForm({ ...form, audienceFilter: e.target.value })}
        >
          <option value="all">All members</option>
          <option value="activeMembers">Active membership</option>
          <option value="expired">No active membership</option>
          <option value="noMembership">Never joined</option>
        </select>
        <button type="submit" className="px-4 py-2 bg-blue-600 text-white rounded">
          Create draft
        </button>
      </form>

      <h3 className="font-medium mb-2">Recent</h3>
      <ul className="space-y-2">
        {campaigns.map((c) => (
          <li key={c._id} className="flex flex-wrap items-center gap-2 border rounded p-3 dark:border-gray-700 text-sm">
            <span className="font-medium">{c.title}</span>
            <span className="text-gray-500">{c.status}</span>
            <button type="button" onClick={() => send(c._id)} className="text-blue-600 hover:underline">
              Send
            </button>
            <button type="button" onClick={() => test(c._id)} className="text-gray-600 hover:underline">
              Test
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
