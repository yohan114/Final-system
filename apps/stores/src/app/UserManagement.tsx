"use client";

import React, { useState, useEffect } from "react";
import { 
  X, Plus, UserPlus, Users, Trash2, Key, Shield, User, Loader2, AlertCircle, CheckCircle2 
} from "lucide-react";
import { listUsersAction, createUserAction, deleteUserAction, adminResetPasswordAction } from "./actions";

interface UserItem {
  id: string;
  username: string;
  name: string;
  role: string;
  createdAt: Date;
}

export default function UserManagement({ onClose, currentUsername }: { onClose: () => void; currentUsername: string }) {
  const [users, setUsers] = useState<UserItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [successMsg, setSuccessMsg] = useState("");

  // Create User Form State
  const [formData, setFormData] = useState({
    username: "",
    name: "",
    password: "",
    role: "SK"
  });

  // Password reset inline state
  const [resettingUserId, setResettingUserId] = useState<string | null>(null);
  const [newTempPassword, setNewTempPassword] = useState("");

  const handleExecuteReset = async (id: string) => {
    if (!newTempPassword || newTempPassword.trim().length < 6) {
      alert("New password must be at least 6 characters long.");
      return;
    }
    setSubmitting(true);
    setErrorMsg("");
    setSuccessMsg("");

    const res = await adminResetPasswordAction({ userId: id, newPassword: newTempPassword });
    setSubmitting(false);

    if (res.error) {
      setErrorMsg(res.error);
    } else {
      setSuccessMsg(`Password for user '@${res.username}' reset successfully to '${newTempPassword}'.`);
      setResettingUserId(null);
      setNewTempPassword("");
      fetchUsers();
    }
  };

  const fetchUsers = async () => {
    setLoading(true);
    const res = await listUsersAction();
    setLoading(false);
    if (res.error) {
      setErrorMsg(res.error);
    } else if (res.users) {
      setUsers(res.users as unknown as UserItem[]);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setErrorMsg("");
    setSuccessMsg("");

    const res = await createUserAction(formData);
    setSubmitting(false);

    if (res.error) {
      setErrorMsg(res.error);
    } else {
      setSuccessMsg(`User '${formData.username}' created successfully.`);
      setFormData({ username: "", name: "", password: "", role: "SK" });
      fetchUsers();
    }
  };

  const handleDeleteUser = async (id: string, username: string) => {
    if (username === currentUsername) {
      alert("You cannot delete your own logged-in admin account.");
      return;
    }
    if (!confirm(`Are you sure you want to delete user account '${username}'?`)) return;

    setErrorMsg("");
    setSuccessMsg("");
    
    const res = await deleteUserAction(id);
    if (res.error) {
      setErrorMsg(res.error);
    } else {
      setSuccessMsg(`User deleted successfully.`);
      fetchUsers();
    }
  };

  const getRoleLabel = (role: string) => {
    switch (role) {
      case "ADMIN":
        return <span className="px-2 py-0.5 text-[10px] font-bold rounded-full bg-blue-950/40 text-blue-400 border border-blue-900/50">Admin</span>;
      case "HEADOFFICE":
        return <span className="px-2 py-0.5 text-[10px] font-bold rounded-full bg-amber-955/40 text-amber-400 border border-amber-900/50">Head Office</span>;
      case "SK":
        return <span className="px-2 py-0.5 text-[10px] font-bold rounded-full bg-emerald-950/40 text-emerald-400 border border-emerald-900/50">Storekeeper</span>;
      case "VIEWER":
        return <span className="px-2 py-0.5 text-[10px] font-bold rounded-full bg-zinc-800 text-zinc-400 border border-zinc-700">Viewer Only</span>;
      default:
        return <span className="px-2 py-0.5 text-[10px] font-bold rounded-full bg-slate-800 text-slate-400">{role}</span>;
    }
  };

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-3xl overflow-hidden shadow-2xl">
      <div className="bg-slate-950 px-6 py-4 flex items-center justify-between border-b border-slate-850">
        <h3 className="text-lg font-bold text-white flex items-center gap-2">
          <Users className="w-5 h-5 text-blue-500" />
          User Management & Roles
        </h3>
        <button 
          onClick={onClose}
          className="text-slate-400 hover:text-white rounded-lg p-1 hover:bg-slate-850 transition"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-5 divide-y md:divide-y-0 md:divide-x divide-slate-850 max-h-[80vh] overflow-y-auto">
        
        {/* Left Column: Create Form */}
        <form onSubmit={handleCreateUser} className="p-6 md:col-span-2 space-y-4">
          <h4 className="text-sm font-bold text-white flex items-center gap-2 pb-2 border-b border-slate-850">
            <UserPlus className="w-4 h-4 text-blue-500" />
            Create New Account
          </h4>

          {errorMsg && (
            <div className="bg-rose-950/30 border border-rose-900/50 p-3 rounded-xl text-rose-450 text-[11px] flex items-center gap-1.5">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {successMsg && (
            <div className="bg-emerald-950/30 border border-emerald-900/50 p-3 rounded-xl text-emerald-450 text-[11px] flex items-center gap-1.5">
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              <span>{successMsg}</span>
            </div>
          )}

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-350">Full Name</label>
            <div className="relative">
              <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
              <input
                type="text"
                required
                placeholder="e.g. John Doe"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-9 pr-3 py-2 text-xs focus:outline-none focus:border-blue-500 transition text-white"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-350">Username</label>
            <input
              type="text"
              required
              placeholder="e.g. jdoe"
              value={formData.username}
              onChange={(e) => setFormData({ ...formData, username: e.target.value })}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-blue-500 transition text-white"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-350">Password</label>
            <div className="relative">
              <Key className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
              <input
                type="password"
                required
                placeholder="Password"
                value={formData.password}
                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-9 pr-3 py-2 text-xs focus:outline-none focus:border-blue-500 transition text-white"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-350">Assign User Role</label>
            <div className="relative">
              <Shield className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
              <select
                value={formData.role}
                onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-9 pr-3 py-2 text-xs focus:outline-none focus:border-blue-500 transition text-white"
              >
                <option value="SK">Storekeeper (SK)</option>
                <option value="HEADOFFICE">Head Office</option>
                <option value="VIEWER">Viewer Only</option>
                <option value="ADMIN">System Admin</option>
              </select>
            </div>
          </div>

          <button
            type="submit"
            disabled={submitting}
            className="w-full flex items-center justify-center gap-1.5 bg-blue-600 hover:bg-blue-500 disabled:bg-blue-800 text-white font-semibold py-2 px-4 rounded-xl text-xs shadow transition"
          >
            {submitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
            Save Account
          </button>
        </form>

        {/* Right Column: User Accounts List */}
        <div className="p-6 md:col-span-3 space-y-4">
          <h4 className="text-sm font-bold text-white flex items-center gap-2 pb-2 border-b border-slate-850">
            <Users className="w-4 h-4 text-blue-500" />
            Registered Accounts
          </h4>

          {loading ? (
            <div className="flex flex-col items-center justify-center py-12 text-slate-500 text-xs gap-2">
              <Loader2 className="w-6 h-6 animate-spin text-blue-500" />
              <span>Loading registered accounts...</span>
            </div>
          ) : (
            <div className="space-y-2 max-h-[45vh] overflow-y-auto pr-1">
              {users.map((u) => {
                const isResetting = resettingUserId === u.id;

                if (isResetting) {
                  return (
                    <div 
                      key={u.id} 
                      className="bg-slate-950/90 border border-amber-500/30 p-3.5 rounded-xl flex flex-col gap-2 transition-all duration-300 ring-1 ring-amber-500/10"
                    >
                      <div className="text-xs font-bold text-white flex items-center gap-1.5">
                        <Key className="w-3.5 h-3.5 text-amber-500 animate-pulse" />
                        <span>Reset Password for @{u.username}</span>
                      </div>
                      <div className="flex gap-2">
                        <input
                          type="text"
                          required
                          placeholder="Temporary password (min 6 chars)"
                          value={newTempPassword}
                          onChange={(e) => setNewTempPassword(e.target.value)}
                          className="flex-1 bg-slate-900 border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:border-amber-500 transition"
                        />
                        <button
                          onClick={() => handleExecuteReset(u.id)}
                          disabled={submitting}
                          className="bg-amber-600 hover:bg-amber-500 disabled:bg-amber-800 text-white font-bold px-3 py-1.5 rounded-lg text-xs transition"
                        >
                          Reset
                        </button>
                        <button
                          onClick={() => {
                            setResettingUserId(null);
                            setNewTempPassword("");
                          }}
                          className="text-slate-400 hover:text-white text-xs px-2.5 py-1.5"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  );
                }

                return (
                  <div 
                    key={u.id} 
                    className="bg-slate-950/40 border border-slate-850 p-3 rounded-xl flex items-center justify-between hover:border-slate-750 transition"
                  >
                    <div className="space-y-1">
                      <div className="text-xs font-bold text-white flex items-center gap-2">
                        {u.name}
                        <span className="text-[10px] text-slate-500 font-normal">({u.username})</span>
                      </div>
                      <div className="flex items-center gap-2">
                        {getRoleLabel(u.role)}
                        <span className="text-[9px] text-slate-500">
                          Added {new Date(u.createdAt).toLocaleDateString()}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => {
                          setResettingUserId(u.id);
                          setNewTempPassword("");
                        }}
                        className="p-2 text-slate-500 hover:text-amber-500 hover:bg-amber-500/10 rounded-lg transition"
                        title="Reset User Password"
                      >
                        <Key className="w-4 h-4" />
                      </button>

                      <button
                        onClick={() => handleDeleteUser(u.id, u.username)}
                        disabled={u.username === currentUsername}
                        className="p-2 text-slate-500 hover:text-rose-500 disabled:text-slate-750 hover:bg-rose-500/10 disabled:bg-transparent rounded-lg transition"
                        title="Delete Account"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
