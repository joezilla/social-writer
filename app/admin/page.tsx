"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

interface UserInfo {
  id: string;
  email: string;
  name: string | null;
  role: string;
  enabled: boolean;
  createdAt: string;
  _count: { posts: number; voiceCorpusEntries: number };
}

export default function AdminPage() {
  const [users, setUsers] = useState<UserInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [showInvite, setShowInvite] = useState(false);
  const [inviteUrl, setInviteUrl] = useState("");

  // Create user form
  const [newEmail, setNewEmail] = useState("");
  const [newName, setNewName] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [newRole, setNewRole] = useState("user");

  // Invite form
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState("user");

  async function loadUsers() {
    const res = await fetch("/api/admin/users");
    const data = await res.json();
    setUsers(data.users || []);
    setLoading(false);
  }

  useEffect(() => {
    loadUsers();
  }, []);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    const res = await fetch("/api/admin/users", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: newEmail,
        name: newName,
        password: newPassword,
        role: newRole,
      }),
    });
    if (res.ok) {
      setShowCreate(false);
      setNewEmail("");
      setNewName("");
      setNewPassword("");
      loadUsers();
    }
  }

  async function handleInvite(e: React.FormEvent) {
    e.preventDefault();
    const res = await fetch("/api/admin/invite", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: inviteEmail, role: inviteRole }),
    });
    if (res.ok) {
      const data = await res.json();
      setInviteUrl(window.location.origin + data.inviteUrl);
      setInviteEmail("");
      loadUsers();
    }
  }

  async function toggleEnabled(user: UserInfo) {
    await fetch(`/api/admin/users/${user.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ enabled: !user.enabled }),
    });
    loadUsers();
  }

  async function toggleRole(user: UserInfo) {
    const newRole = user.role === "admin" ? "user" : "admin";
    await fetch(`/api/admin/users/${user.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ role: newRole }),
    });
    loadUsers();
  }

  async function deleteUser(user: UserInfo) {
    if (!confirm(`Delete user ${user.email}? This will delete all their data.`)) return;
    await fetch(`/api/admin/users/${user.id}`, { method: "DELETE" });
    loadUsers();
  }

  if (loading) {
    return <div className="p-8 text-muted-foreground">Loading...</div>;
  }

  return (
    <div className="max-w-[1000px] mx-auto px-4 sm:px-6 py-8 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">User Management</h1>
        <div className="flex gap-2">
          <Link
            href="/admin/settings"
            className="px-3 py-1.5 text-sm rounded-md border hover:bg-muted transition-colors"
          >
            Global Settings
          </Link>
          <button
            onClick={() => setShowInvite(true)}
            className="px-3 py-1.5 text-sm rounded-md border hover:bg-muted transition-colors"
          >
            Invite User
          </button>
          <button
            onClick={() => setShowCreate(true)}
            className="px-3 py-1.5 text-sm rounded-md bg-foreground text-background hover:opacity-90 transition-opacity"
          >
            Create User
          </button>
        </div>
      </div>

      {inviteUrl && (
        <div className="p-3 rounded-md bg-success/10 border border-success/20 text-sm">
          <p className="font-medium mb-1">Invite link generated:</p>
          <code className="block text-xs bg-muted p-2 rounded break-all">
            {inviteUrl}
          </code>
          <button
            onClick={() => {
              navigator.clipboard.writeText(inviteUrl);
              setInviteUrl("");
            }}
            className="mt-2 text-xs underline"
          >
            Copy & dismiss
          </button>
        </div>
      )}

      {showInvite && (
        <form onSubmit={handleInvite} className="p-4 rounded-md border space-y-3">
          <h3 className="font-medium text-sm">Invite User</h3>
          <input
            type="email"
            placeholder="Email"
            value={inviteEmail}
            onChange={(e) => setInviteEmail(e.target.value)}
            required
            className="w-full px-3 py-2 text-sm rounded-md border bg-background"
          />
          <select
            value={inviteRole}
            onChange={(e) => setInviteRole(e.target.value)}
            className="px-3 py-2 text-sm rounded-md border bg-background"
          >
            <option value="user">User</option>
            <option value="admin">Admin</option>
          </select>
          <div className="flex gap-2">
            <button type="submit" className="px-3 py-1.5 text-sm rounded-md bg-foreground text-background">
              Send Invite
            </button>
            <button type="button" onClick={() => setShowInvite(false)} className="px-3 py-1.5 text-sm rounded-md border">
              Cancel
            </button>
          </div>
        </form>
      )}

      {showCreate && (
        <form onSubmit={handleCreate} className="p-4 rounded-md border space-y-3">
          <h3 className="font-medium text-sm">Create User</h3>
          <input
            type="email"
            placeholder="Email"
            value={newEmail}
            onChange={(e) => setNewEmail(e.target.value)}
            required
            className="w-full px-3 py-2 text-sm rounded-md border bg-background"
          />
          <input
            type="text"
            placeholder="Name (optional)"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            className="w-full px-3 py-2 text-sm rounded-md border bg-background"
          />
          <input
            type="password"
            placeholder="Password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            required
            minLength={8}
            className="w-full px-3 py-2 text-sm rounded-md border bg-background"
          />
          <select
            value={newRole}
            onChange={(e) => setNewRole(e.target.value)}
            className="px-3 py-2 text-sm rounded-md border bg-background"
          >
            <option value="user">User</option>
            <option value="admin">Admin</option>
          </select>
          <div className="flex gap-2">
            <button type="submit" className="px-3 py-1.5 text-sm rounded-md bg-foreground text-background">
              Create
            </button>
            <button type="button" onClick={() => setShowCreate(false)} className="px-3 py-1.5 text-sm rounded-md border">
              Cancel
            </button>
          </div>
        </form>
      )}

      <div className="border rounded-md overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted/50">
            <tr>
              <th className="text-left px-4 py-2 font-medium">Email</th>
              <th className="text-left px-4 py-2 font-medium">Name</th>
              <th className="text-left px-4 py-2 font-medium">Role</th>
              <th className="text-left px-4 py-2 font-medium">Posts</th>
              <th className="text-left px-4 py-2 font-medium">Status</th>
              <th className="text-right px-4 py-2 font-medium">Actions</th>
            </tr>
          </thead>
          <tbody>
            {users.map((user) => (
              <tr key={user.id} className="border-t">
                <td className="px-4 py-2">{user.email}</td>
                <td className="px-4 py-2 text-muted-foreground">{user.name || "—"}</td>
                <td className="px-4 py-2">
                  <button
                    onClick={() => toggleRole(user)}
                    className="px-2 py-0.5 text-xs rounded-full border hover:bg-muted"
                  >
                    {user.role}
                  </button>
                </td>
                <td className="px-4 py-2 text-muted-foreground">{user._count.posts}</td>
                <td className="px-4 py-2">
                  <button
                    onClick={() => toggleEnabled(user)}
                    className={`px-2 py-0.5 text-xs rounded-full ${
                      user.enabled
                        ? "bg-success/10 text-success"
                        : "bg-destructive/10 text-destructive"
                    }`}
                  >
                    {user.enabled ? "Active" : "Disabled"}
                  </button>
                </td>
                <td className="px-4 py-2 text-right">
                  <button
                    onClick={() => deleteUser(user)}
                    className="text-xs text-destructive hover:underline"
                  >
                    Delete
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
