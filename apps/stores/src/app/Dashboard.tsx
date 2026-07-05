"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { 
  FileText, Plus, Search, Filter, Calendar, Camera, Video, ArrowRightLeft, 
  Settings, CheckCircle, PackageOpen, HelpCircle, Check, Loader2, Info, X, 
  MapPin, Clipboard, AlertCircle, Wrench, ChevronRight, Eye, RefreshCcw,
  LogOut, ShieldAlert, UserCheck, Shield, Users, Edit, Trash2, Box, Key
} from "lucide-react";
import { 
  createRequestAction, approveRequestAction, receiveWorkshopAction, 
  dispatchSiteAction, returnWorkshopAction, logoutAction,
  editRequestAction, deleteRequestAction, changePasswordAction
} from "./actions";
import UserManagement from "./UserManagement";
import InventoryPanel from "./InventoryPanel";

interface Site {
  id: string;
  name: string;
}

interface Machine {
  id: string;
  name: string;
  code: string;
  condition: string;
  status: string;
  siteId: string | null;
  site: Site | null;
  updatedAt: string | Date;
}

interface MediaFile {
  id: string;
  url: string;
  type: string;
  phase: string;
  createdAt: Date;
}

interface MachineRequest {
  id: string;
  mrnNumber: string;
  itemName: string;
  quantity: number;
  purpose: string | null;
  targetSite: string | null;
  status: string;
  createdAt: string | Date;
  updatedAt: string | Date;
  receivedDate: string | Date | null;
  receiptNotes: string | null;
  sentSiteDate: string | Date | null;
  transferNoteNo: string | null;
  dispatchNotes: string | null;
  returnedDate: string | Date | null;
  returnReason: string | null;
  returnNotes: string | null;
  requestedBy: string | null;
  receivedBy: string | null;
  dispatchedBy: string | null;
  returnedBy: string | null;
  machineId: string | null;
  machine: Machine | null;
  mediaFiles: MediaFile[];
}

interface Session {
  userId: string;
  username: string;
  name: string;
  role: string;
  mustChangePassword: boolean;
}

export default function Dashboard({ 
  initialRequests, 
  initialSites, 
  initialMachines, 
  session 
}: { 
  initialRequests: any[]; 
  initialSites: any[];
  initialMachines: any[];
  session: Session;
}) {
  const router = useRouter();
  
  // State
  const [requests, setRequests] = useState<MachineRequest[]>(initialRequests as unknown as MachineRequest[]);
  const [sites, setSites] = useState<Site[]>(initialSites as unknown as Site[]);
  const [machines, setMachines] = useState<Machine[]>(initialMachines as unknown as Machine[]);
  const [activeTab, setActiveTab] = useState<"REQUESTS" | "INVENTORY">("REQUESTS");
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  
  // Modals
  const [activeModal, setActiveModal] = useState<"REQUEST" | "RECEIVE" | "DISPATCH" | "RETURN" | "TIMELINE" | "USER_MANAGEMENT" | "EDIT" | "CHANGE_PASSWORD" | null>(null);
  const [selectedRequest, setSelectedRequest] = useState<MachineRequest | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  // Change Password Form State
  const [changePasswordData, setChangePasswordData] = useState({
    oldPassword: "",
    newPassword: "",
    confirmPassword: ""
  });

  // New Request Form State
  const [newRequest, setNewRequest] = useState({
    mrnNumber: "",
    itemName: "",
    quantity: 1,
    purpose: "",
    targetSite: ""
  });

  // Edit Request Form State (Admin Only)
  const [editFormData, setEditFormData] = useState({
    id: "",
    mrnNumber: "",
    itemName: "",
    quantity: 1,
    purpose: "",
    targetSite: "",
    machineId: "",
    status: ""
  });

  // Workshop Receipt State
  const [receiptData, setReceiptData] = useState({
    receivedDate: new Date().toLocaleDateString("en-CA"),
    receiptNotes: "",
    machineId: "",
    condition: "GOOD"
  });

  // Dispatch to Site State
  const [dispatchData, setDispatchData] = useState({
    sentSiteDate: new Date().toLocaleDateString("en-CA"),
    transferNoteNo: "",
    dispatchNotes: "",
    siteId: ""
  });

  // Return from Site State
  const [returnData, setReturnData] = useState({
    returnedDate: new Date().toLocaleDateString("en-CA"),
    returnReason: "PROJECT_END",
    condition: "GOOD",
    returnNotes: ""
  });

  // Files selected for uploads
  const [selectedFiles, setSelectedFiles] = useState<FileList | null>(null);
  const [filePreviews, setFilePreviews] = useState<{ name: string; type: string; url: string }[] | null>(null);

  // Sync state with props
  React.useEffect(() => {
    setRequests(initialRequests as unknown as MachineRequest[]);
    setSites(initialSites as unknown as Site[]);
    setMachines(initialMachines as unknown as Machine[]);
  }, [initialRequests, initialSites, initialMachines]);

  // Roles permission helpers
  const isViewer = session.role === "VIEWER";
  const isSK = session.role === "SK";
  const isAdmin = session.role === "ADMIN";
  const isHeadOffice = session.role === "HEADOFFICE";
  
  // Can approve requests? (Admin and HeadOffice only)
  const canApprove = isAdmin || isHeadOffice;
  // Can request/receive/dispatch/return? (Admin and SK only)
  const canModify = isAdmin || isSK;

  // Filter requests
  const filteredRequests = requests.filter(req => {
    const matchesSearch = 
      req.itemName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      req.mrnNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (req.transferNoteNo && req.transferNoteNo.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (req.targetSite && req.targetSite.toLowerCase().includes(searchQuery.toLowerCase()));

    const matchesStatus = statusFilter === "ALL" ? true : req.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  // Sort Requests: IN_REPAIR or those with DAMAGED/BROKEN physical machines are bubbled to the top, then sorted by createdAt desc
  const sortedRequests = [...filteredRequests].sort((a, b) => {
    const aDamaged = a.status === "IN_REPAIR" || (a.machine && (a.machine.condition === "DAMAGED" || a.machine.condition === "BROKEN"));
    const bDamaged = b.status === "IN_REPAIR" || (b.machine && (b.machine.condition === "DAMAGED" || b.machine.condition === "BROKEN"));
    if (aDamaged && !bDamaged) return -1;
    if (!aDamaged && bDamaged) return 1;
    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
  });

  // Stats Calculations
  const stats = {
    total: requests.length,
    pending: requests.filter(r => r.status === "PENDING").length,
    approved: requests.filter(r => r.status === "APPROVED").length,
    workshop: requests.filter(r => r.status === "RECEIVED_WORKSHOP").length,
    site: requests.filter(r => r.status === "SENT_TO_SITE").length,
    repair: requests.filter(r => r.status === "IN_REPAIR").length,
    returned: requests.filter(r => r.status === "RETURNED_WORKSHOP").length,
  };

  // Helper for strictly formatted date times (including seconds) in Colombo timezone
  const formatDateTime = (date: Date | string | null): string => {
    if (!date) return "N/A";
    const d = new Date(date);
    // Print in YYYY-MM-DD HH:mm:ss format
    return d.toLocaleString("en-CA", { 
      timeZone: "Asia/Colombo",
      hour12: false 
    }).replace(",", "");
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "PENDING":
        return <span className="px-2.5 py-1 text-xs font-semibold rounded-full bg-amber-50 text-amber-700 border border-amber-200 dark:bg-amber-950/30 dark:text-amber-400 dark:border-amber-900/50">Pending Approval</span>;
      case "APPROVED":
        return <span className="px-2.5 py-1 text-xs font-semibold rounded-full bg-indigo-50 text-indigo-700 border border-indigo-200 dark:bg-indigo-950/30 dark:text-indigo-400 dark:border-indigo-900/50">Approved</span>;
      case "RECEIVED_WORKSHOP":
        return <span className="px-2.5 py-1 text-xs font-semibold rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-950/30 dark:text-emerald-400 dark:border-emerald-900/50">At Workshop</span>;
      case "SENT_TO_SITE":
        return <span className="px-2.5 py-1 text-xs font-semibold rounded-full bg-blue-50 text-blue-700 border border-blue-200 dark:bg-blue-950/30 dark:text-blue-400 dark:border-blue-900/50">Active on Site</span>;
      case "IN_REPAIR":
        return <span className="px-2.5 py-1 text-xs font-semibold rounded-full bg-rose-50 text-rose-700 border border-rose-200 dark:bg-rose-950/30 dark:text-rose-455 dark:border-rose-900/50">In Repair / Breakdown</span>;
      case "RETURNED_WORKSHOP":
        return <span className="px-2.5 py-1 text-xs font-semibold rounded-full bg-zinc-100 text-zinc-700 border border-zinc-300 dark:bg-zinc-800 dark:text-zinc-350 dark:border-zinc-700">Project Completed</span>;
      default:
        return <span className="px-2.5 py-1 text-xs font-semibold rounded-full bg-gray-100 text-gray-700">{status}</span>;
    }
  };

  const getRoleBadge = (role: string) => {
    switch (role) {
      case "ADMIN":
        return <span className="px-2 py-0.5 text-[10px] font-bold rounded-full bg-blue-500/10 text-blue-450 border border-blue-500/20">Admin</span>;
      case "SK":
        return <span className="px-2 py-0.5 text-[10px] font-bold rounded-full bg-emerald-500/10 text-emerald-450 border border-emerald-500/20">Storekeeper</span>;
      case "HEADOFFICE":
        return <span className="px-2 py-0.5 text-[10px] font-bold rounded-full bg-amber-500/10 text-amber-450 border border-amber-500/20">Head Office</span>;
      case "VIEWER":
        return <span className="px-2 py-0.5 text-[10px] font-bold rounded-full bg-slate-800 text-slate-400 border border-slate-700">Viewer</span>;
      default:
        return null;
    }
  };

  // Previews
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      setSelectedFiles(e.target.files);
      const previews: { name: string; type: string; url: string }[] = [];
      for (let i = 0; i < e.target.files.length; i++) {
        const file = e.target.files[i];
        previews.push({
          name: file.name,
          type: file.type,
          url: URL.createObjectURL(file)
        });
      }
      setFilePreviews(previews);
    }
  };

  // Upload
  const uploadFiles = async (phase: string): Promise<{ url: string; type: string }[]> => {
    if (!selectedFiles || selectedFiles.length === 0) return [];
    
    const formData = new FormData();
    formData.append("phase", phase);
    for (let i = 0; i < selectedFiles.length; i++) {
      formData.append("files", selectedFiles[i]);
    }

    const res = await fetch("/api/upload", {
      method: "POST",
      body: formData,
    });

    const data = await res.json();
    if (!res.ok || data.error) {
      throw new Error(data.error || "Failed to upload files");
    }

    return data.files || [];
  };

  // Submit Operations
  const handleCreateRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setErrorMsg("");

    const res = await createRequestAction(newRequest);
    setSubmitting(false);

    if (res.error) {
      setErrorMsg(res.error);
    } else {
      setActiveModal(null);
      setNewRequest({ mrnNumber: "", itemName: "", quantity: 1, purpose: "", targetSite: "" });
      router.refresh();
    }
  };

  const handleApproveRequest = async (id: string) => {
    if (!confirm("Are you sure you want to approve this request?")) return;
    const res = await approveRequestAction(id);
    if (res.error) {
      alert(res.error);
    } else {
      router.refresh();
    }
  };

  const handleReceiveWorkshop = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedRequest) return;
    setSubmitting(true);
    setErrorMsg("");

    try {
      const uploadedMedia = await uploadFiles("RECEIPT");
      
      const res = await receiveWorkshopAction({
        id: selectedRequest.id,
        receivedDate: receiptData.receivedDate,
        receiptNotes: receiptData.receiptNotes,
        machineId: receiptData.machineId || null,
        condition: receiptData.condition,
        mediaFiles: uploadedMedia
      });

      setSubmitting(false);
      if (res.error) {
        setErrorMsg(res.error);
      } else {
        setActiveModal(null);
        setSelectedRequest(null);
        setReceiptData({ receivedDate: new Date().toLocaleDateString("en-CA"), receiptNotes: "", machineId: "", condition: "GOOD" });
        setSelectedFiles(null);
        setFilePreviews(null);
        router.refresh();
      }
    } catch (err: any) {
      setSubmitting(false);
      setErrorMsg(err.message || "Something went wrong during file uploads");
    }
  };

  const handleDispatchSite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedRequest) return;
    setSubmitting(true);
    setErrorMsg("");

    try {
      // Validate: file uploads are mandatory for site assignment (dispatch)
      if (!selectedFiles || selectedFiles.length === 0) {
        setErrorMsg("Assigning the machine to a site (dispatching) requires uploading images or videos.");
        setSubmitting(false);
        return;
      }

      const uploadedMedia = await uploadFiles("DISPATCH");

      const res = await dispatchSiteAction({
        id: selectedRequest.id,
        sentSiteDate: dispatchData.sentSiteDate,
        transferNoteNo: dispatchData.transferNoteNo,
        dispatchNotes: dispatchData.dispatchNotes,
        siteId: dispatchData.siteId || null,
        mediaFiles: uploadedMedia
      });

      setSubmitting(false);
      if (res.error) {
        setErrorMsg(res.error);
      } else {
        setActiveModal(null);
        setSelectedRequest(null);
        setDispatchData({ sentSiteDate: new Date().toLocaleDateString("en-CA"), transferNoteNo: "", dispatchNotes: "", siteId: "" });
        setSelectedFiles(null);
        setFilePreviews(null);
        router.refresh();
      }
    } catch (err: any) {
      setSubmitting(false);
      setErrorMsg(err.message || "Something went wrong during file uploads");
    }
  };

  const handleReturnWorkshop = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedRequest) return;
    setSubmitting(true);
    setErrorMsg("");

    try {
      const uploadedMedia = await uploadFiles("RETURN");

      const res = await returnWorkshopAction({
        id: selectedRequest.id,
        returnedDate: returnData.returnedDate,
        returnReason: returnData.returnReason,
        condition: returnData.condition,
        returnNotes: returnData.returnNotes,
        mediaFiles: uploadedMedia
      });

      setSubmitting(false);
      if (res.error) {
        setErrorMsg(res.error);
      } else {
        setActiveModal(null);
        setSelectedRequest(null);
        setReturnData({ returnedDate: new Date().toLocaleDateString("en-CA"), returnReason: "PROJECT_END", condition: "GOOD", returnNotes: "" });
        setSelectedFiles(null);
        setFilePreviews(null);
        router.refresh();
      }
    } catch (err: any) {
      setSubmitting(false);
      setErrorMsg(err.message || "Something went wrong during file uploads");
    }
  };

  // Edit / Delete Handlers (ADMIN only)
  const handleStartEdit = (req: MachineRequest) => {
    setErrorMsg("");
    setSelectedRequest(req);
    setEditFormData({
      id: req.id,
      mrnNumber: req.mrnNumber,
      itemName: req.itemName,
      quantity: req.quantity,
      purpose: req.purpose || "",
      targetSite: req.targetSite || "",
      machineId: req.machineId || "",
      status: req.status
    });
    setActiveModal("EDIT");
  };

  const handleEditRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isAdmin) return;
    setSubmitting(true);
    setErrorMsg("");

    const res = await editRequestAction(editFormData.id, {
      mrnNumber: editFormData.mrnNumber,
      itemName: editFormData.itemName,
      quantity: editFormData.quantity,
      purpose: editFormData.purpose,
      targetSite: editFormData.targetSite,
      machineId: editFormData.machineId || null,
      status: editFormData.status
    });

    setSubmitting(false);
    if (res.error) {
      setErrorMsg(res.error);
    } else {
      setActiveModal(null);
      setSelectedRequest(null);
      router.refresh();
    }
  };

  const handleDeleteRequest = async (id: string, name: string) => {
    if (!isAdmin) return;
    if (!confirm(`Are you sure you want to delete request for "${name}"? This action is permanent.`)) return;

    const res = await deleteRequestAction(id);
    if (res.error) {
      alert(res.error);
    } else {
      router.refresh();
    }
  };

  const handleLogout = async () => {
    if (!confirm("Are you sure you want to log out?")) return;
    const res = await logoutAction();
    if (res.success) {
      router.push("/login");
      router.refresh();
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (changePasswordData.newPassword !== changePasswordData.confirmPassword) {
      setErrorMsg("New passwords do not match.");
      return;
    }
    setSubmitting(true);
    setErrorMsg("");

    const res = await changePasswordAction({
      oldPassword: changePasswordData.oldPassword,
      newPassword: changePasswordData.newPassword
    });
    setSubmitting(false);

    if (res.error) {
      setErrorMsg(res.error);
    } else {
      alert("Password changed successfully.");
      setChangePasswordData({ oldPassword: "", newPassword: "", confirmPassword: "" });
      setActiveModal(null);
      // Wait, we also need to refresh the page since user.mustChangePassword might have changed in session cookie!
      router.refresh();
    }
  };

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 flex flex-col font-sans">
      
      {/* Header */}
      <header className="sticky top-0 z-40 bg-slate-955/80 backdrop-blur-md border-b border-slate-800 px-6 py-4 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        
        {/* Logo */}
        <div className="flex items-center gap-3">
          <div className="bg-blue-600 p-2.5 rounded-xl shadow-lg shadow-blue-500/20 text-white shrink-0">
            <ArrowRightLeft className="w-6 h-6 animate-pulse" />
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight text-white flex items-center gap-2">
              Main Stores <span className="text-blue-500 text-xs px-2 py-0.5 rounded-md bg-blue-500/10 border border-blue-500/20">Asset Manager</span>
            </h1>
            <p className="text-xs text-slate-400">Construction Machinery Requisitions & Sites Tracking</p>
          </div>
        </div>

        {/* Action Panel / Profile */}
        <div className="flex flex-wrap items-center gap-3 w-full md:w-auto justify-end">
          
          {/* User badge */}
          <div className="bg-slate-950/40 border border-slate-800 rounded-xl px-3 py-1.5 flex items-center gap-2 text-xs">
            <div className="w-6 h-6 rounded-full bg-blue-600/10 border border-blue-500/20 flex items-center justify-center text-blue-450 font-black uppercase">
              {session.name.substring(0, 2)}
            </div>
            <div className="text-left leading-none">
              <div className="font-bold text-white text-xs">{session.name}</div>
              <div className="text-[9px] text-slate-500 mt-0.5 flex items-center gap-1.5">
                <span>@{session.username}</span>
                {getRoleBadge(session.role)}
              </div>
            </div>
          </div>

          {/* Refresh */}
          <button 
            onClick={() => router.refresh()} 
            className="p-2 text-slate-400 hover:text-white rounded-xl hover:bg-slate-800 transition shrink-0"
            title="Refresh Data"
          >
            <RefreshCcw className="w-4.5 h-4.5" />
          </button>

          {/* Change Password Trigger */}
          <button
            onClick={() => {
              setErrorMsg("");
              setChangePasswordData({ oldPassword: "", newPassword: "", confirmPassword: "" });
              setActiveModal("CHANGE_PASSWORD");
            }}
            className="flex items-center gap-1.5 bg-slate-800 hover:bg-slate-750 text-white px-3 py-2.5 rounded-xl text-xs font-semibold border border-slate-750 transition"
            title="Change Your Password"
          >
            <Key className="w-4 h-4 text-amber-500" />
            <span>Change Password</span>
          </button>

          {/* Users Panel Trigger */}
          {isAdmin && (
            <button
              onClick={() => {
                setErrorMsg("");
                setActiveModal("USER_MANAGEMENT");
              }}
              className="flex items-center gap-1.5 bg-slate-800 hover:bg-slate-750 text-white px-3 py-2.5 rounded-xl text-xs font-semibold border border-slate-750 transition"
            >
              <Users className="w-4 h-4 text-blue-400" />
              Users Panel
            </button>
          )}

          {/* Logout */}
          <button
            onClick={handleLogout}
            className="flex items-center gap-1.5 bg-slate-800 hover:bg-rose-950/30 hover:text-rose-455 hover:border-rose-900/50 text-slate-350 px-3 py-2.5 rounded-xl text-xs font-semibold border border-slate-750 transition shrink-0"
          >
            <LogOut className="w-4.5 h-4.5" />
            Logout
          </button>

          {/* New Request Button */}
          {canModify && (
            <button 
              onClick={() => {
                setErrorMsg("");
                setActiveModal("REQUEST");
              }}
              className="flex items-center gap-1.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white px-4 py-2.5 rounded-xl text-xs font-semibold shadow-lg shadow-blue-500/15 transition-all transform hover:scale-[1.02] shrink-0"
            >
              <Plus className="w-4.5 h-4.5" />
              New Request
            </button>
          )}

        </div>

      </header>

      {/* Tabs Selector */}
      <section className="bg-slate-950/45 border-b border-slate-850 px-6 py-2 flex gap-4">
        <button
          onClick={() => setActiveTab("REQUESTS")}
          className={`px-4 py-2 text-xs font-bold transition-all relative ${
            activeTab === "REQUESTS" ? "text-blue-500" : "text-slate-400 hover:text-white"
          }`}
        >
          <span className="flex items-center gap-1.5">
            <FileText className="w-4 h-4" />
            Requisitions & Transactions
          </span>
          {activeTab === "REQUESTS" && (
            <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-600 rounded-t"></span>
          )}
        </button>
        <button
          onClick={() => setActiveTab("INVENTORY")}
          className={`px-4 py-2 text-xs font-bold transition-all relative ${
            activeTab === "INVENTORY" ? "text-blue-500" : "text-slate-400 hover:text-white"
          }`}
        >
          <span className="flex items-center gap-1.5">
            <Box className="w-4 h-4" />
            Machines & Sites Inventory
          </span>
          {activeTab === "INVENTORY" && (
            <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-600 rounded-t"></span>
          )}
        </button>
      </section>

      {/* Main Contents */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-6 space-y-6">
        
        {activeTab === "REQUESTS" ? (
          <>
            {/* Stats Summary Panel */}
            <section className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
              <div className="bg-slate-950/50 border border-slate-850 p-4 rounded-2xl flex flex-col justify-between hover:border-slate-700 transition">
                <span className="text-xs font-medium text-slate-400">Total Requests</span>
                <div className="flex items-baseline justify-between mt-2">
                  <span className="text-2xl font-bold text-white">{stats.total}</span>
                  <FileText className="w-4 h-4 text-slate-550" />
                </div>
              </div>
              <div className="bg-slate-950/50 border border-slate-850 p-4 rounded-2xl flex flex-col justify-between hover:border-slate-700 transition">
                <span className="text-xs font-medium text-amber-500">Pending Approval</span>
                <div className="flex items-baseline justify-between mt-2">
                  <span className="text-2xl font-bold text-amber-400">{stats.pending + stats.approved}</span>
                  <HelpCircle className="w-4 h-4 text-amber-550" />
                </div>
              </div>
              <div className="bg-slate-950/50 border border-slate-850 p-4 rounded-2xl flex flex-col justify-between hover:border-slate-700 transition">
                <span className="text-xs font-medium text-emerald-500">At Workshop</span>
                <div className="flex items-baseline justify-between mt-2">
                  <span className="text-2xl font-bold text-emerald-400">{stats.workshop}</span>
                  <PackageOpen className="w-4 h-4 text-emerald-550" />
                </div>
              </div>
              <div className="bg-slate-950/50 border border-slate-850 p-4 rounded-2xl flex flex-col justify-between hover:border-slate-700 transition">
                <span className="text-xs font-medium text-blue-500">Out on Sites</span>
                <div className="flex items-baseline justify-between mt-2">
                  <span className="text-2xl font-bold text-blue-400">{stats.site}</span>
                  <MapPin className="w-4 h-4 text-blue-550" />
                </div>
              </div>
              <div className="bg-slate-950/50 border border-slate-850 p-4 rounded-2xl flex flex-col justify-between hover:border-slate-700 transition">
                <span className="text-xs font-medium text-rose-500">In Repair</span>
                <div className="flex items-baseline justify-between mt-2">
                  <span className="text-2xl font-bold text-rose-400">{stats.repair}</span>
                  <Wrench className="w-4 h-4 text-rose-550" />
                </div>
              </div>
              <div className="bg-slate-950/50 border border-slate-850 p-4 rounded-2xl flex flex-col justify-between hover:border-slate-700 transition">
                <span className="text-xs font-medium text-zinc-400">Completed Logs</span>
                <div className="flex items-baseline justify-between mt-2">
                  <span className="text-2xl font-bold text-zinc-300">{stats.returned}</span>
                  <CheckCircle className="w-4 h-4 text-zinc-550" />
                </div>
              </div>
            </section>

            {/* Filter Toolbar */}
            <section className="bg-slate-950/40 border border-slate-800 rounded-2xl p-4 flex flex-col sm:flex-row gap-4 items-center justify-between">
              <div className="relative w-full sm:max-w-md">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                <input 
                  type="text" 
                  placeholder="Search by machine name, MRN, Transfer Note, or site..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 bg-slate-900 border border-slate-850 hover:border-slate-750 focus:border-blue-500 rounded-xl text-sm focus:outline-none transition text-white"
                />
              </div>

              <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
                <Filter className="w-4 h-4 text-slate-400 shrink-0" />
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="bg-slate-900 border border-slate-850 focus:border-blue-500 px-3 py-2.5 rounded-xl text-sm focus:outline-none transition w-full sm:w-48 text-slate-200"
                >
                  <option value="ALL">All Statuses</option>
                  <option value="PENDING">Pending Approval</option>
                  <option value="APPROVED">Approved Requests</option>
                  <option value="RECEIVED_WORKSHOP">At Workshop</option>
                  <option value="SENT_TO_SITE">Active on Site</option>
                  <option value="IN_REPAIR">In Repair / Breakdown</option>
                  <option value="RETURNED_WORKSHOP">Project Completed</option>
                </select>
              </div>
            </section>

            {/* Requisitions List Grid (Puts damaged requests at top, highlights in red/glow) */}
            <section className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {sortedRequests.length === 0 ? (
                <div className="col-span-full bg-slate-950/20 border border-dashed border-slate-800 rounded-3xl py-16 px-4 text-center">
                  <Clipboard className="w-12 h-12 text-slate-650 mx-auto mb-4" />
                  <h3 className="text-lg font-bold text-white">No requests found</h3>
                  <p className="text-sm text-slate-400 max-w-sm mx-auto mt-1">
                    There are no machine requests matching your query.
                  </p>
                </div>
              ) : (
                sortedRequests.map((req) => {
                  const receiptImages = req.mediaFiles.filter(m => m.phase === "RECEIPT");
                  const dispatchImages = req.mediaFiles.filter(m => m.phase === "DISPATCH");
                  const returnImages = req.mediaFiles.filter(m => m.phase === "RETURN");
                  
                  // Check if the assigned machine is broken/damaged, or if request status itself is IN_REPAIR
                  const isRequestDamaged = req.status === "IN_REPAIR" || (req.machine && (req.machine.condition === "DAMAGED" || req.machine.condition === "BROKEN"));

                  return (
                    <div 
                      key={req.id} 
                      className={`overflow-hidden flex flex-col justify-between rounded-2xl border transition duration-300 relative ${
                        isRequestDamaged
                          ? "bg-rose-950/20 border-rose-800 shadow-xl shadow-rose-950/10 ring-1 ring-rose-500/20"
                          : "bg-slate-950/40 border-slate-850 hover:border-slate-750 hover:shadow-xl hover:shadow-blue-900/5"
                      }`}
                    >
                      {/* Damaged Label */}
                      {isRequestDamaged && (
                        <div className="absolute top-2 right-2 bg-rose-600 text-white font-bold text-[9px] uppercase px-2 py-0.5 rounded-full border border-rose-500 shadow-sm flex items-center gap-1">
                          <ShieldAlert className="w-3 h-3 text-white animate-pulse" />
                          Breakdown / Damage
                        </div>
                      )}

                      <div className="p-5 space-y-4">
                        {/* Status Badge & Date */}
                        <div className="flex items-center justify-between">
                          {getStatusBadge(req.status)}
                          <span className="text-[10px] text-slate-500 flex items-center gap-1">
                            <Calendar className="w-3.5 h-3.5" />
                            {new Date(req.createdAt).toLocaleDateString()}
                          </span>
                        </div>

                        {/* Machine Name & Qty */}
                        <div>
                          <h2 className="text-lg font-bold text-white leading-tight">{req.itemName}</h2>
                          <div className="flex items-center gap-4 text-xs text-slate-400 mt-1">
                            <span>Quantity: <strong className="text-white">{req.quantity}</strong></span>
                            <span>MRN: <strong className="text-white">{req.mrnNumber}</strong></span>
                          </div>
                        </div>

                        {/* Purpose / Target Site / Linked Machine */}
                        <div className="space-y-2 bg-slate-900/40 border border-slate-850 rounded-xl p-3 text-xs">
                          {req.targetSite && (
                            <div className="flex items-center gap-1.5 text-slate-350">
                              <MapPin className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                              <span>Target Site: <strong className="text-white">{req.targetSite}</strong></span>
                            </div>
                          )}
                          
                          {/* Display physical machine serial code allocation if assigned */}
                          {req.machine && (
                            <div className="flex items-center gap-1.5 text-slate-350 border-t border-slate-850/50 pt-1.5 mt-1.5">
                              <Box className="w-3.5 h-3.5 text-blue-450 shrink-0" />
                              <span>Assigned Unit: <strong className="text-blue-400 font-mono">{req.machine.name} ({req.machine.code})</strong></span>
                            </div>
                          )}

                          {req.purpose && (
                            <p className="text-slate-450 italic mt-1 line-clamp-2">
                              "{req.purpose}"
                            </p>
                          )}

                          {req.requestedBy && (
                            <div className="text-[10px] text-slate-500 pt-1 border-t border-slate-850/40 mt-2">
                              Logged by <strong className="text-slate-405">@{req.requestedBy}</strong>
                            </div>
                          )}
                        </div>

                        {/* Media count pills */}
                        <div className="flex flex-wrap gap-2 text-[10px] font-semibold text-slate-450 uppercase">
                          {receiptImages.length > 0 && (
                            <span className="px-2 py-0.5 rounded bg-slate-900 border border-slate-800">
                              {receiptImages.length} Receipt Media
                            </span>
                          )}
                          {dispatchImages.length > 0 && (
                            <span className="px-2 py-0.5 rounded bg-slate-900 border border-slate-800">
                              {dispatchImages.length} Dispatch Media
                            </span>
                          )}
                          {returnImages.length > 0 && (
                            <span className="px-2 py-0.5 rounded bg-slate-900 border border-slate-800">
                              {returnImages.length} Return Media
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Actions Footer */}
                      <div className="bg-slate-950/60 border-t border-slate-850/50 p-4 flex gap-2 items-center justify-between">
                        
                        {/* Left action: Timeline */}
                        <div className="flex items-center gap-1.5">
                          <button
                            onClick={() => {
                              setSelectedRequest(req);
                              setActiveModal("TIMELINE");
                            }}
                            className="flex items-center gap-1 text-xs text-slate-400 hover:text-white px-2 py-1.5 rounded hover:bg-slate-850 transition"
                          >
                            <Eye className="w-3.5 h-3.5" />
                            Timeline
                          </button>

                          {/* Admin Edit/Delete Options */}
                          {isAdmin && (
                            <>
                              <button
                                onClick={() => handleStartEdit(req)}
                                className="p-1.5 text-slate-450 hover:text-blue-450 hover:bg-slate-800 rounded transition"
                                title="Edit Request"
                              >
                                <Edit className="w-3.5 h-3.5" />
                              </button>
                              <button
                                onClick={() => handleDeleteRequest(req.id, req.itemName)}
                                className="p-1.5 text-slate-550 hover:text-rose-500 hover:bg-rose-500/10 rounded transition"
                                title="Delete Request"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </>
                          )}
                        </div>

                        {/* Right: Flow State Transitions */}
                        <div className="flex gap-2">
                          {/* Approve: ADMIN or HEADOFFICE */}
                          {req.status === "PENDING" && canApprove && (
                            <button
                              onClick={() => handleApproveRequest(req.id)}
                              className="bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold px-3 py-1.5 rounded-lg transition animate-pulse"
                            >
                              Approve
                            </button>
                          )}
                          
                          {/* Receive: ADMIN or SK */}
                          {req.status === "APPROVED" && canModify && (
                            <button
                              onClick={() => {
                                setErrorMsg("");
                                setSelectedRequest(req);
                                setReceiptData({ receivedDate: new Date().toLocaleDateString("en-CA"), receiptNotes: "", machineId: "", condition: "GOOD" });
                                setFilePreviews(null);
                                setSelectedFiles(null);
                                setActiveModal("RECEIVE");
                              }}
                              className="bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold px-3 py-1.5 rounded-lg transition"
                            >
                              Receive Workshop
                            </button>
                          )}

                          {/* Dispatch: ADMIN or SK */}
                          {req.status === "RECEIVED_WORKSHOP" && canModify && (
                            <button
                              onClick={() => {
                                setErrorMsg("");
                                setSelectedRequest(req);
                                setDispatchData({ sentSiteDate: new Date().toLocaleDateString("en-CA"), transferNoteNo: "", dispatchNotes: "", siteId: "" });
                                setFilePreviews(null);
                                setSelectedFiles(null);
                                setActiveModal("DISPATCH");
                              }}
                              className="bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold px-3 py-1.5 rounded-lg transition"
                            >
                              Send to Site
                            </button>
                          )}

                          {/* Return: ADMIN or SK */}
                          {req.status === "SENT_TO_SITE" && canModify && (
                            <button
                              onClick={() => {
                                setErrorMsg("");
                                setSelectedRequest(req);
                                setReturnData({ returnedDate: new Date().toLocaleDateString("en-CA"), returnReason: "PROJECT_END", condition: "GOOD", returnNotes: "" });
                                setFilePreviews(null);
                                setSelectedFiles(null);
                                setActiveModal("RETURN");
                              }}
                              className="bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold px-3 py-1.5 rounded-lg transition"
                            >
                              Return / Repair
                            </button>
                          )}

                          {/* Finish Repair: ADMIN or SK */}
                          {req.status === "IN_REPAIR" && canModify && (
                            <button
                              onClick={() => {
                                setErrorMsg("");
                                setSelectedRequest(req);
                                setReceiptData({ receivedDate: new Date().toLocaleDateString("en-CA"), receiptNotes: "", machineId: req.machineId || "", condition: "GOOD" });
                                setFilePreviews(null);
                                setSelectedFiles(null);
                                setActiveModal("RECEIVE");
                              }}
                              className="bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold px-3 py-1.5 rounded-lg transition"
                            >
                              Finish Repair
                            </button>
                          )}
                        </div>

                      </div>
                    </div>
                  );
                })
              )}
            </section>
          </>
        ) : (
          /* Inventory & Sites tab view */
          <InventoryPanel sites={sites} machines={machines} session={session} />
        )}

      </main>

      {/* MODALS CONTAINER */}
      {activeModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-955/80 backdrop-blur-sm p-4 overflow-y-auto">
          
          {/* USER MANAGEMENT MODAL */}
          {activeModal === "USER_MANAGEMENT" && isAdmin && (
            <UserManagement 
              onClose={() => setActiveModal(null)} 
              currentUsername={session.username} 
            />
          )}

          {/* REQUEST MODAL */}
          {activeModal === "REQUEST" && canModify && (
            <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-lg overflow-hidden shadow-2xl">
              <div className="bg-slate-950 px-6 py-4 flex items-center justify-between border-b border-slate-850">
                <h3 className="text-lg font-bold text-white flex items-center gap-2">
                  <Plus className="w-5 h-5 text-blue-500" />
                  New Machine/Tool Request
                </h3>
                <button 
                  onClick={() => setActiveModal(null)}
                  className="text-slate-400 hover:text-white rounded-lg p-1 hover:bg-slate-850 transition"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleCreateRequest} className="p-6 space-y-4">
                {errorMsg && (
                  <div className="bg-rose-955/30 border border-rose-900/50 p-3.5 rounded-xl text-rose-455 text-xs flex items-center gap-2">
                    <AlertCircle className="w-4.5 h-4.5 shrink-0" />
                    <span>{errorMsg}</span>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-slate-350">MRN Number <span className="text-rose-500">*</span></label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. MRN-55610"
                      value={newRequest.mrnNumber}
                      onChange={(e) => setNewRequest({ ...newRequest, mrnNumber: e.target.value })}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-sm focus:outline-none focus:border-blue-500 transition text-white"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-slate-350">Quantity <span className="text-rose-500">*</span></label>
                    <input
                      type="number"
                      required
                      min={1}
                      value={newRequest.quantity}
                      onChange={(e) => setNewRequest({ ...newRequest, quantity: parseInt(e.target.value) || 1 })}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-sm focus:outline-none focus:border-blue-500 transition text-white"
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-350">Machine/Tool Name <span className="text-rose-500">*</span></label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. SANY SY215 Excavator, Torque Wrench 1/2"
                    value={newRequest.itemName}
                    onChange={(e) => setNewRequest({ ...newRequest, itemName: e.target.value })}
                    className="w-full bg-slate-955 border border-slate-800 rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:border-blue-500 transition text-white"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-350">Target Project / Site Name <span className="text-rose-500">*</span></label>
                  <select
                    required
                    value={newRequest.targetSite}
                    onChange={(e) => setNewRequest({ ...newRequest, targetSite: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-blue-500 transition text-white text-slate-200"
                  >
                    <option value="">Select target project / site...</option>
                    {sites.map(s => (
                      <option key={s.id} value={s.name}>{s.name}</option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-350">Purpose / Requisition Notes</label>
                  <textarea
                    rows={3}
                    placeholder="Provide details on where the machine will be deployed..."
                    value={newRequest.purpose}
                    onChange={(e) => setNewRequest({ ...newRequest, purpose: e.target.value })}
                    className="w-full bg-slate-955 border border-slate-800 rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:border-blue-500 transition text-white resize-none"
                  />
                </div>

                <div className="flex justify-end gap-3 pt-3 border-t border-slate-850">
                  <button
                    type="button"
                    onClick={() => setActiveModal(null)}
                    className="bg-slate-800 hover:bg-slate-750 px-4.5 py-2 rounded-xl text-sm font-semibold transition text-white"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={submitting}
                    className="flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-500 disabled:bg-blue-800 text-white px-5 py-2 rounded-xl text-sm font-semibold shadow-lg transition"
                  >
                    {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
                    Create Request
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* EDIT REQUEST MODAL (ADMIN ONLY) */}
          {activeModal === "EDIT" && isAdmin && selectedRequest && (
            <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-lg overflow-hidden shadow-2xl">
              <div className="bg-slate-950 px-6 py-4 flex items-center justify-between border-b border-slate-850">
                <h3 className="text-lg font-bold text-white flex items-center gap-2">
                  <Edit className="w-5 h-5 text-blue-550" />
                  Edit Requisition Request
                </h3>
                <button 
                  onClick={() => {
                    setActiveModal(null);
                    setSelectedRequest(null);
                  }}
                  className="text-slate-400 hover:text-white rounded-lg p-1 hover:bg-slate-850 transition"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleEditRequest} className="p-6 space-y-4">
                {errorMsg && (
                  <div className="bg-rose-955/30 border border-rose-900/50 p-3.5 rounded-xl text-rose-455 text-xs flex items-center gap-2">
                    <AlertCircle className="w-4.5 h-4.5 shrink-0" />
                    <span>{errorMsg}</span>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-slate-350">MRN Number</label>
                    <input
                      type="text"
                      required
                      value={editFormData.mrnNumber}
                      onChange={(e) => setEditFormData({ ...editFormData, mrnNumber: e.target.value })}
                      className="w-full bg-slate-955 border border-slate-800 rounded-xl px-3.5 py-2 text-sm focus:outline-none focus:border-blue-500 transition text-white"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-slate-350">Quantity</label>
                    <input
                      type="number"
                      required
                      min={1}
                      value={editFormData.quantity}
                      onChange={(e) => setEditFormData({ ...editFormData, quantity: parseInt(e.target.value) || 1 })}
                      className="w-full bg-slate-955 border border-slate-800 rounded-xl px-3.5 py-2 text-sm focus:outline-none focus:border-blue-500 transition text-white"
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-350">Machine/Tool Name</label>
                  <input
                    type="text"
                    required
                    value={editFormData.itemName}
                    onChange={(e) => setEditFormData({ ...editFormData, itemName: e.target.value })}
                    className="w-full bg-slate-955 border border-slate-800 rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:border-blue-500 transition text-white"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-350">Target Site <span className="text-rose-500">*</span></label>
                  <select
                    required
                    value={editFormData.targetSite}
                    onChange={(e) => setEditFormData({ ...editFormData, targetSite: e.target.value })}
                    className="w-full bg-slate-955 border border-slate-800 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-blue-500 transition text-white text-slate-200"
                  >
                    <option value="">Select target project / site...</option>
                    {sites.map(s => (
                      <option key={s.id} value={s.name}>{s.name}</option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-350">Purpose / Requisition Notes</label>
                  <textarea
                    rows={3}
                    value={editFormData.purpose}
                    onChange={(e) => setEditFormData({ ...editFormData, purpose: e.target.value })}
                    className="w-full bg-slate-955 border border-slate-800 rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:border-blue-500 transition text-white resize-none"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-slate-350">Link Physical Unit</label>
                    <select
                      value={editFormData.machineId}
                      onChange={(e) => setEditFormData({ ...editFormData, machineId: e.target.value })}
                      className="w-full bg-slate-955 border border-slate-800 rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-blue-500 transition text-white"
                    >
                      <option value="">No unit assigned</option>
                      {machines.map(m => (
                        <option key={m.id} value={m.id}>{m.name} ({m.code})</option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-slate-350">Current Status</label>
                    <select
                      value={editFormData.status}
                      onChange={(e) => setEditFormData({ ...editFormData, status: e.target.value })}
                      className="w-full bg-slate-955 border border-slate-800 rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-blue-500 transition text-white"
                    >
                      <option value="PENDING">Pending Approval</option>
                      <option value="APPROVED">Approved</option>
                      <option value="RECEIVED_WORKSHOP">At Workshop</option>
                      <option value="SENT_TO_SITE">Sent to Site</option>
                      <option value="IN_REPAIR">In Repair</option>
                      <option value="RETURNED_WORKSHOP">Completed</option>
                    </select>
                  </div>
                </div>

                <div className="flex justify-end gap-3 pt-3 border-t border-slate-850">
                  <button
                    type="button"
                    onClick={() => {
                      setActiveModal(null);
                      setSelectedRequest(null);
                    }}
                    className="bg-slate-800 hover:bg-slate-750 px-4.5 py-2 rounded-xl text-sm font-semibold transition text-white"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={submitting}
                    className="flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-500 disabled:bg-blue-800 text-white px-5 py-2 rounded-xl text-sm font-semibold shadow-lg transition"
                  >
                    {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
                    Save Changes
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* RECEIVE AT WORKSHOP MODAL */}
          {activeModal === "RECEIVE" && selectedRequest && canModify && (
            <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-lg overflow-hidden shadow-2xl">
              <div className="bg-slate-950 px-6 py-4 flex items-center justify-between border-b border-slate-850">
                <h3 className="text-lg font-bold text-white flex items-center gap-2">
                  <PackageOpen className="w-5 h-5 text-emerald-500" />
                  {selectedRequest.status === "IN_REPAIR" ? "Finish Repair & Re-Receive" : "Receive at Workshop"}
                </h3>
                <button 
                  onClick={() => {
                    setActiveModal(null);
                    setSelectedRequest(null);
                    setFilePreviews(null);
                  }}
                  className="text-slate-400 hover:text-white rounded-lg p-1 hover:bg-slate-850 transition"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleReceiveWorkshop} className="p-6 space-y-4">
                <div className="bg-slate-950/50 p-3 rounded-xl border border-slate-850 text-xs space-y-1">
                  <div>Machine/Tool: <strong className="text-white">{selectedRequest.itemName}</strong></div>
                  <div>Quantity: <strong className="text-white">{selectedRequest.quantity}</strong></div>
                  <div>MRN Number: <strong className="text-white">{selectedRequest.mrnNumber}</strong></div>
                </div>

                {errorMsg && (
                  <div className="bg-rose-955/30 border border-rose-900/50 p-3.5 rounded-xl text-rose-455 text-xs flex items-center gap-2">
                    <AlertCircle className="w-4.5 h-4.5 shrink-0" />
                    <span>{errorMsg}</span>
                  </div>
                )}

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-350">Receive Date <span className="text-rose-500">*</span></label>
                  <div className="relative">
                    <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                    <input
                      type="date"
                      required
                      value={receiptData.receivedDate}
                      onChange={(e) => setReceiptData({ ...receiptData, receivedDate: e.target.value })}
                      className="w-full bg-slate-955 border border-slate-800 rounded-xl pl-10 pr-3.5 py-2.5 text-sm focus:outline-none focus:border-blue-500 transition text-white"
                    />
                  </div>
                </div>

                {/* Machine Assignment Dropdown */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-slate-350">Link Physical Inventory Unit</label>
                    <select
                      value={receiptData.machineId}
                      onChange={(e) => setReceiptData({ ...receiptData, machineId: e.target.value })}
                      className="w-full bg-slate-955 border border-slate-800 rounded-xl px-3 py-2.5 text-xs focus:outline-none focus:border-blue-500 transition text-white"
                    >
                      <option value="">No unit linked</option>
                      {/* Only list units in workshop or currently linked to this request */}
                      {machines.filter(m => m.status === "WORKSHOP" || m.id === selectedRequest.machineId).map(m => (
                        <option key={m.id} value={m.id}>{m.name} ({m.code})</option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-slate-350">Unit Condition</label>
                    <select
                      value={receiptData.condition}
                      onChange={(e) => setReceiptData({ ...receiptData, condition: e.target.value })}
                      className="w-full bg-slate-955 border border-slate-800 rounded-xl px-3 py-2.5 text-xs focus:outline-none focus:border-blue-500 transition text-white"
                    >
                      <option value="GOOD">Operational (Good)</option>
                      <option value="DAMAGED">Damaged</option>
                      <option value="BROKEN">Broken / Down</option>
                    </select>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-350">Receipt Notes</label>
                  <textarea
                    rows={2}
                    placeholder="Log condition, serial numbers, operational status..."
                    value={receiptData.receiptNotes}
                    onChange={(e) => setReceiptData({ ...receiptData, receiptNotes: e.target.value })}
                    className="w-full bg-slate-955 border border-slate-800 rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:border-blue-500 transition text-white resize-none"
                  />
                </div>

                {/* Upload Section */}
                <div className="space-y-2">
                  <label className="text-xs font-semibold text-slate-350">Add Images & Videos (Proof of Receipt)</label>
                  <div className="border border-dashed border-slate-800 rounded-xl p-4 text-center hover:bg-slate-955/35 cursor-pointer relative transition">
                    <input
                      type="file"
                      multiple
                      accept="image/*,video/*"
                      onChange={handleFileChange}
                      className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                    />
                    <Camera className="w-8 h-8 text-slate-600 mx-auto mb-2" />
                    <p className="text-xs text-slate-400 font-medium">Select files</p>
                  </div>

                  {filePreviews && (
                    <div className="grid grid-cols-4 gap-2 mt-2">
                      {filePreviews.map((p, idx) => (
                        <div key={idx} className="relative aspect-square border border-slate-800 rounded-lg overflow-hidden bg-slate-955">
                          {p.type.startsWith("video/") ? (
                            <div className="w-full h-full flex flex-col items-center justify-center bg-slate-900 text-[10px]">
                              <Video className="w-5 h-5 text-indigo-500 mb-1" />
                              <span className="truncate w-full px-1 text-center text-slate-400">{p.name}</span>
                            </div>
                          ) : (
                            <img src={p.url} alt="preview" className="w-full h-full object-cover" />
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="flex justify-end gap-3 pt-3 border-t border-slate-850">
                  <button
                    type="button"
                    onClick={() => {
                      setActiveModal(null);
                      setSelectedRequest(null);
                      setFilePreviews(null);
                    }}
                    className="bg-slate-800 hover:bg-slate-750 px-4.5 py-2 rounded-xl text-sm font-semibold transition text-white"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={submitting}
                    className="flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-500 disabled:bg-emerald-800 text-white px-5 py-2 rounded-xl text-sm font-semibold shadow-lg transition"
                  >
                    {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
                    Confirm Receipt
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* DISPATCH TO SITE MODAL */}
          {activeModal === "DISPATCH" && selectedRequest && canModify && (
            <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-lg overflow-hidden shadow-2xl">
              <div className="bg-slate-950 px-6 py-4 flex items-center justify-between border-b border-slate-850">
                <h3 className="text-lg font-bold text-white flex items-center gap-2">
                  <ArrowRightLeft className="w-5 h-5 text-blue-500" />
                  Dispatch Machine to Site
                </h3>
                <button 
                  onClick={() => {
                    setActiveModal(null);
                    setSelectedRequest(null);
                    setFilePreviews(null);
                  }}
                  className="text-slate-400 hover:text-white rounded-lg p-1 hover:bg-slate-850 transition"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleDispatchSite} className="p-6 space-y-4">
                <div className="bg-slate-955/50 p-3 rounded-xl border border-slate-850 text-xs space-y-1">
                  <div>Machine/Tool: <strong className="text-white">{selectedRequest.itemName}</strong></div>
                  {selectedRequest.machine && (
                    <div>Linked Unit: <strong className="text-blue-400 font-mono">{selectedRequest.machine.name} ({selectedRequest.machine.code})</strong></div>
                  )}
                  <div>Quantity: <strong className="text-white">{selectedRequest.quantity}</strong></div>
                  <div>MRN Number: <strong className="text-white">{selectedRequest.mrnNumber}</strong></div>
                </div>

                {errorMsg && (
                  <div className="bg-rose-955/30 border border-rose-900/50 p-3.5 rounded-xl text-rose-455 text-xs flex items-center gap-2">
                    <AlertCircle className="w-4.5 h-4.5 shrink-0" />
                    <span>{errorMsg}</span>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-slate-350">Dispatch Date <span className="text-rose-500">*</span></label>
                    <div className="relative">
                      <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                      <input
                        type="date"
                        required
                        value={dispatchData.sentSiteDate}
                        onChange={(e) => setDispatchData({ ...dispatchData, sentSiteDate: e.target.value })}
                        className="w-full bg-slate-955 border border-slate-800 rounded-xl pl-10 pr-3.5 py-2 text-sm focus:outline-none focus:border-blue-500 transition text-white"
                      />
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-slate-350">Transfer Note Number <span className="text-rose-500">*</span></label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. TN-8854"
                      value={dispatchData.transferNoteNo}
                      onChange={(e) => setDispatchData({ ...dispatchData, transferNoteNo: e.target.value })}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-sm focus:outline-none focus:border-blue-500 transition text-white"
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-350">Structured Site Allocation <span className="text-rose-500">*</span></label>
                  <select
                    required
                    value={dispatchData.siteId}
                    onChange={(e) => setDispatchData({ ...dispatchData, siteId: e.target.value })}
                    className="w-full bg-slate-955 border border-slate-800 rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-blue-500 transition text-white text-slate-200"
                  >
                    <option value="">Select structured construction site...</option>
                    {sites.map(s => (
                      <option key={s.id} value={s.id}>{s.name}</option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-350">Dispatch Condition & Notes</label>
                  <textarea
                    rows={2}
                    placeholder="Log delivery details, vehicle numbers, remarks..."
                    value={dispatchData.dispatchNotes}
                    onChange={(e) => setDispatchData({ ...dispatchData, dispatchNotes: e.target.value })}
                    className="w-full bg-slate-955 border border-slate-800 rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:border-blue-500 transition text-white resize-none"
                  />
                </div>

                {/* Upload Section */}
                <div className="space-y-2">
                  <label className="text-xs font-semibold text-slate-350">Add Images & Videos (Proof of Loading) <span className="text-rose-500">*</span></label>
                  <div className="border border-dashed border-slate-800 rounded-xl p-4 text-center hover:bg-slate-955/35 cursor-pointer relative transition">
                    <input
                      type="file"
                      multiple
                      required
                      accept="image/*,video/*"
                      onChange={handleFileChange}
                      className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                    />
                    <Camera className="w-8 h-8 text-slate-600 mx-auto mb-2" />
                    <p className="text-xs text-slate-400 font-medium">Click to select mandatory images & videos</p>
                  </div>

                  {filePreviews && (
                    <div className="grid grid-cols-4 gap-2 mt-2">
                      {filePreviews.map((p, idx) => (
                        <div key={idx} className="relative aspect-square border border-slate-800 rounded-lg overflow-hidden bg-slate-955">
                          {p.type.startsWith("video/") ? (
                            <div className="w-full h-full flex flex-col items-center justify-center bg-slate-900 text-[10px]">
                              <Video className="w-5 h-5 text-indigo-500 mb-1" />
                              <span className="truncate w-full px-1 text-center text-slate-400">{p.name}</span>
                            </div>
                          ) : (
                            <img src={p.url} alt="preview" className="w-full h-full object-cover" />
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="flex justify-end gap-3 pt-3 border-t border-slate-850">
                  <button
                    type="button"
                    onClick={() => {
                      setActiveModal(null);
                      setSelectedRequest(null);
                      setFilePreviews(null);
                    }}
                    className="bg-slate-800 hover:bg-slate-750 px-4.5 py-2 rounded-xl text-sm font-semibold transition text-white"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={submitting}
                    className="flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-500 disabled:bg-blue-800 text-white px-5 py-2 rounded-xl text-sm font-semibold shadow-lg transition"
                  >
                    {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
                    Confirm Dispatch
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* RETURN / REPAIR MODAL */}
          {activeModal === "RETURN" && selectedRequest && canModify && (
            <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-lg overflow-hidden shadow-2xl">
              <div className="bg-slate-950 px-6 py-4 flex items-center justify-between border-b border-slate-850">
                <h3 className="text-lg font-bold text-white flex items-center gap-2">
                  <ArrowRightLeft className="w-5 h-5 text-indigo-500 animate-spin-slow" />
                  Return Machine from Site
                </h3>
                <button 
                  onClick={() => {
                    setActiveModal(null);
                    setSelectedRequest(null);
                    setFilePreviews(null);
                  }}
                  className="text-slate-400 hover:text-white rounded-lg p-1 hover:bg-slate-850 transition"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleReturnWorkshop} className="p-6 space-y-4">
                <div className="bg-slate-955/50 p-3 rounded-xl border border-slate-850 text-xs space-y-1">
                  <div>Machine/Tool: <strong className="text-white">{selectedRequest.itemName}</strong></div>
                  {selectedRequest.machine && (
                    <div>Linked Unit: <strong className="text-blue-400 font-mono">{selectedRequest.machine.name} ({selectedRequest.machine.code})</strong></div>
                  )}
                  <div>Quantity: <strong className="text-white">{selectedRequest.quantity}</strong></div>
                </div>

                {errorMsg && (
                  <div className="bg-rose-955/30 border border-rose-900/50 p-3.5 rounded-xl text-rose-455 text-xs flex items-center gap-2">
                    <AlertCircle className="w-4.5 h-4.5 shrink-0" />
                    <span>{errorMsg}</span>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-slate-350">Return Date <span className="text-rose-500">*</span></label>
                    <div className="relative">
                      <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                      <input
                        type="date"
                        required
                        value={returnData.returnedDate}
                        onChange={(e) => setReturnData({ ...returnData, returnedDate: e.target.value })}
                        className="w-full bg-slate-955 border border-slate-800 rounded-xl pl-10 pr-3.5 py-2 text-sm focus:outline-none focus:border-blue-500 transition text-white"
                      />
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-slate-350">Return Reason <span className="text-rose-500">*</span></label>
                    <select
                      value={returnData.returnReason}
                      onChange={(e) => setReturnData({ ...returnData, returnReason: e.target.value })}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:border-blue-500 transition text-white text-slate-200"
                    >
                      <option value="PROJECT_END">Project Ended / Works Completed</option>
                      <option value="REPAIR">Machine Breakdown / Repair Needed</option>
                      <option value="OTHER">Other Reason</option>
                    </select>
                  </div>
                </div>

                {/* Return condition check (crucial to highlight damaged/broken machines) */}
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-350">Received Unit Condition <span className="text-rose-500">*</span></label>
                  <select
                    value={returnData.condition}
                    onChange={(e) => setReturnData({ ...returnData, condition: e.target.value })}
                    className="w-full bg-slate-955 border border-slate-800 rounded-xl px-3 py-2.5 text-xs focus:outline-none focus:border-blue-500 transition text-white text-slate-200"
                  >
                    <option value="GOOD">Operational (Good)</option>
                    <option value="DAMAGED">Damaged / Needs Servicing</option>
                    <option value="BROKEN">Broken / Needs Overhaul</option>
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-350">Return Condition & Details</label>
                  <textarea
                    rows={2}
                    placeholder="Log details on damage, parts breakdown, or general remarks..."
                    value={returnData.returnNotes}
                    onChange={(e) => setReturnData({ ...returnData, returnNotes: e.target.value })}
                    className="w-full bg-slate-955 border border-slate-800 rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:border-blue-500 transition text-white resize-none"
                  />
                </div>

                {/* Upload Section */}
                <div className="space-y-2">
                  <label className="text-xs font-semibold text-slate-350">Add Images & Videos (Proof of Return Condition)</label>
                  <div className="border border-dashed border-slate-800 rounded-xl p-4 text-center hover:bg-slate-955/35 cursor-pointer relative transition">
                    <input
                      type="file"
                      multiple
                      accept="image/*,video/*"
                      onChange={handleFileChange}
                      className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                    />
                    <Camera className="w-8 h-8 text-slate-600 mx-auto mb-2" />
                    <p className="text-xs text-slate-400 font-medium">Click to select files</p>
                  </div>

                  {filePreviews && (
                    <div className="grid grid-cols-4 gap-2 mt-2">
                      {filePreviews.map((p, idx) => (
                        <div key={idx} className="relative aspect-square border border-slate-800 rounded-lg overflow-hidden bg-slate-955">
                          {p.type.startsWith("video/") ? (
                            <div className="w-full h-full flex flex-col items-center justify-center bg-slate-900 text-[10px]">
                              <Video className="w-5 h-5 text-indigo-500 mb-1" />
                              <span className="truncate w-full px-1 text-center text-slate-400">{p.name}</span>
                            </div>
                          ) : (
                            <img src={p.url} alt="preview" className="w-full h-full object-cover" />
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="flex justify-end gap-3 pt-3 border-t border-slate-850">
                  <button
                    type="button"
                    onClick={() => {
                      setActiveModal(null);
                      setSelectedRequest(null);
                      setFilePreviews(null);
                    }}
                    className="bg-slate-800 hover:bg-slate-750 px-4.5 py-2 rounded-xl text-sm font-semibold transition text-white"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={submitting}
                    className="flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-500 disabled:bg-indigo-800 text-white px-5 py-2 rounded-xl text-sm font-semibold shadow-lg transition"
                  >
                    {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
                    Confirm Return
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* TIMELINE VIEW MODAL (WITH STRICT TIMESTAMP LOGGING) */}
          {activeModal === "TIMELINE" && selectedRequest && (
            <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-2xl overflow-hidden shadow-2xl">
              <div className="bg-slate-950 px-6 py-4 flex items-center justify-between border-b border-slate-850">
                <div className="space-y-0.5">
                  <h3 className="text-base font-bold text-white flex items-center gap-2">
                    <Info className="w-4.5 h-4.5 text-blue-500" />
                    Strict Lifecycle Timestamp Logs
                  </h3>
                  <p className="text-xs text-slate-400">{selectedRequest.itemName} (MRN: {selectedRequest.mrnNumber})</p>
                </div>
                <button 
                  onClick={() => {
                    setActiveModal(null);
                    setSelectedRequest(null);
                  }}
                  className="text-slate-400 hover:text-white rounded-lg p-1 hover:bg-slate-850 transition"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="p-6 space-y-6 max-h-[70vh] overflow-y-auto">
                
                {/* Visual Vertical Timeline */}
                <div className="relative border-l border-slate-800 ml-4 pl-6 space-y-8">
                  
                  {/* Step 1: Requested */}
                  <div className="relative">
                    <div className="absolute -left-[31px] top-1.5 bg-blue-600 w-4 h-4 rounded-full border-4 border-slate-900 ring-4 ring-blue-500/10"></div>
                    <div>
                      <h4 className="font-bold text-white text-sm flex items-center gap-2">
                        1. Requested
                        <span className="text-[10px] bg-slate-850 text-slate-400 font-bold px-2.5 py-0.5 rounded border border-slate-800 flex items-center gap-1 font-mono">
                          {formatDateTime(selectedRequest.createdAt)}
                        </span>
                      </h4>
                      <div className="text-xs text-slate-400 mt-1.5 space-y-1">
                        <div>Quantity Requested: <strong className="text-slate-250">{selectedRequest.quantity} units</strong></div>
                        {selectedRequest.targetSite && <div>Target Deployment Site: <strong className="text-slate-250">{selectedRequest.targetSite}</strong></div>}
                        {selectedRequest.purpose && <div className="italic text-slate-450 mt-1">"{selectedRequest.purpose}"</div>}
                        {selectedRequest.requestedBy && (
                          <div className="text-[10px] text-slate-500 pt-1">
                            Logged by <strong className="text-slate-400">@{selectedRequest.requestedBy}</strong>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Step 2: Approved */}
                  {selectedRequest.status !== "PENDING" && (
                    <div className="relative">
                      <div className="absolute -left-[31px] top-1.5 bg-indigo-500 w-4 h-4 rounded-full border-4 border-slate-900 ring-4 ring-indigo-500/10"></div>
                      <div>
                        <h4 className="font-bold text-white text-sm flex items-center gap-2">
                          2. Approved for Purchase/Release
                          <span className="text-[10px] bg-slate-850 text-slate-400 font-bold px-2.5 py-0.5 rounded border border-slate-800 flex items-center gap-1 font-mono">
                            {formatDateTime(selectedRequest.updatedAt)}
                          </span>
                        </h4>
                        <p className="text-xs text-slate-400 mt-1">Approved by Admin / Head Office Approver</p>
                      </div>
                    </div>
                  )}

                  {/* Step 3: Received Workshop */}
                  {selectedRequest.receivedDate && (
                    <div className="relative">
                      <div className="absolute -left-[31px] top-1.5 bg-emerald-500 w-4 h-4 rounded-full border-4 border-slate-900 ring-4 ring-emerald-500/10"></div>
                      <div>
                        <h4 className="font-bold text-white text-sm flex items-center gap-2 animate-pulse">
                          3. Received at Workshop
                          <span className="text-[10px] bg-slate-850 text-slate-400 font-bold px-2.5 py-0.5 rounded border border-slate-800 flex items-center gap-1 font-mono">
                            {formatDateTime(selectedRequest.receivedDate)}
                          </span>
                        </h4>
                        
                        {selectedRequest.receivedBy && (
                          <div className="text-[10px] text-slate-500 mt-0.5">
                            Logged by <strong className="text-slate-400">@{selectedRequest.receivedBy}</strong>
                          </div>
                        )}

                        {selectedRequest.machine && (
                          <div className="text-xs text-slate-350 mt-1.5 flex items-center gap-2">
                            <span>Unit Allocated:</span>
                            <span className="text-blue-400 font-bold font-mono bg-blue-950/40 px-2 py-0.5 rounded border border-blue-900/40">
                              {selectedRequest.machine.name} ({selectedRequest.machine.code})
                            </span>
                            <span className="text-[10px]">
                              Condition: <strong>{selectedRequest.machine.condition}</strong>
                            </span>
                          </div>
                        )}

                        {selectedRequest.receiptNotes && (
                          <p className="text-xs text-slate-300 mt-1.5 bg-slate-950/40 p-2 border border-slate-850 rounded-lg italic">
                            "{selectedRequest.receiptNotes}"
                          </p>
                        )}

                        {/* Media Files */}
                        {selectedRequest.mediaFiles.filter(m => m.phase === "RECEIPT").length > 0 && (
                          <div className="mt-3 space-y-1">
                            <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Receipt Photos & Videos:</span>
                            <div className="grid grid-cols-3 gap-2">
                              {selectedRequest.mediaFiles.filter(m => m.phase === "RECEIPT").map((m) => (
                                <div key={m.id} className="relative aspect-video rounded-lg overflow-hidden border border-slate-800 bg-slate-955 hover:border-slate-650 transition">
                                  {m.type === "VIDEO" ? (
                                    <video src={m.url} controls className="w-full h-full object-cover" />
                                  ) : (
                                    <a href={m.url} target="_blank" rel="noopener noreferrer">
                                      <img src={m.url} alt="Receipt Media" className="w-full h-full object-cover cursor-zoom-in" />
                                    </a>
                                  )}
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Step 4: Dispatched to Site */}
                  {selectedRequest.sentSiteDate && (
                    <div className="relative">
                      <div className="absolute -left-[31px] top-1.5 bg-blue-500 w-4 h-4 rounded-full border-4 border-slate-900 ring-4 ring-blue-500/10"></div>
                      <div>
                        <h4 className="font-bold text-white text-sm flex items-center gap-2">
                          4. Dispatched to Site
                          <span className="text-[10px] bg-slate-850 text-slate-400 font-bold px-2.5 py-0.5 rounded border border-slate-800 flex items-center gap-1 font-mono">
                            {formatDateTime(selectedRequest.sentSiteDate)}
                          </span>
                        </h4>
                        
                        <div className="text-xs text-slate-450 mt-1 flex flex-wrap items-center gap-2">
                          <span>Transfer Note:</span>
                          <strong className="text-white bg-slate-800 px-1.5 py-0.5 rounded text-[10px] border border-slate-700 font-mono">{selectedRequest.transferNoteNo}</strong>
                          {selectedRequest.machine?.site && (
                            <span className="text-[10px] text-blue-400">
                              → Active at <strong>{selectedRequest.machine.site.name}</strong>
                            </span>
                          )}
                          {selectedRequest.dispatchedBy && (
                            <span className="text-[10px] text-slate-500">
                              (Logged by @{selectedRequest.dispatchedBy})
                            </span>
                          )}
                        </div>
                        
                        {selectedRequest.dispatchNotes && (
                          <p className="text-xs text-slate-300 mt-1.5 bg-slate-950/40 p-2 border border-slate-850 rounded-lg italic">
                            "{selectedRequest.dispatchNotes}"
                          </p>
                        )}

                        {/* Dispatch Media */}
                        {selectedRequest.mediaFiles.filter(m => m.phase === "DISPATCH").length > 0 && (
                          <div className="mt-3 space-y-1">
                            <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Dispatch Photos:</span>
                            <div className="grid grid-cols-3 gap-2">
                              {selectedRequest.mediaFiles.filter(m => m.phase === "DISPATCH").map((m) => (
                                <div key={m.id} className="relative aspect-video rounded-lg overflow-hidden border border-slate-800 bg-slate-955">
                                  <a href={m.url} target="_blank" rel="noopener noreferrer">
                                    <img src={m.url} alt="Dispatch Media" className="w-full h-full object-cover cursor-zoom-in" />
                                  </a>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Step 5: Returned from Site */}
                  {selectedRequest.returnedDate && (
                    <div className="relative">
                      <div className="absolute -left-[31px] top-1.5 bg-indigo-500 w-4 h-4 rounded-full border-4 border-slate-900 ring-4 ring-indigo-500/10"></div>
                      <div>
                        <h4 className="font-bold text-white text-sm flex items-center gap-2">
                          5. Returned to Workshop / Repair
                          <span className="text-[10px] bg-slate-850 text-slate-400 font-bold px-2.5 py-0.5 rounded border border-slate-800 flex items-center gap-1 font-mono">
                            {formatDateTime(selectedRequest.returnedDate)}
                          </span>
                        </h4>

                        <div className="text-xs mt-1 flex items-center gap-1.5">
                          <span>Return Reason:</span>
                          <span className={`px-2 py-0.5 text-[10px] font-bold rounded-full border ${
                            selectedRequest.returnReason === "REPAIR" 
                              ? "bg-rose-955/30 border-rose-900/50 text-rose-455" 
                              : "bg-emerald-955/30 border-emerald-900/50 text-emerald-455"
                          }`}>
                            {selectedRequest.returnReason === "REPAIR" ? "Breakdown Repair" : "Project Completed"}
                          </span>
                          {selectedRequest.returnedBy && (
                            <span className="text-[10px] text-slate-500">
                              (Logged by @{selectedRequest.returnedBy})
                            </span>
                          )}
                        </div>

                        {selectedRequest.returnNotes && (
                          <p className="text-xs text-slate-300 mt-2 bg-slate-950/40 p-2 border border-slate-850 rounded-lg italic">
                            "{selectedRequest.returnNotes}"
                          </p>
                        )}

                        {/* Return Media */}
                        {selectedRequest.mediaFiles.filter(m => m.phase === "RETURN").length > 0 && (
                          <div className="mt-3 space-y-1">
                            <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Return Photos & Videos:</span>
                            <div className="grid grid-cols-3 gap-2">
                              {selectedRequest.mediaFiles.filter(m => m.phase === "RETURN").map((m) => (
                                <div key={m.id} className="relative aspect-video rounded-lg overflow-hidden border border-slate-800 bg-slate-955 hover:border-slate-650 transition">
                                  {m.type === "VIDEO" ? (
                                    <video src={m.url} controls className="w-full h-full object-cover" />
                                  ) : (
                                    <a href={m.url} target="_blank" rel="noopener noreferrer">
                                      <img src={m.url} alt="Return Media" className="w-full h-full object-cover cursor-zoom-in" />
                                    </a>
                                  )}
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                </div>

              </div>

              <div className="bg-slate-950 px-6 py-4 flex justify-end border-t border-slate-850">
                <button
                  onClick={() => {
                    setActiveModal(null);
                    setSelectedRequest(null);
                  }}
                  className="bg-slate-800 hover:bg-slate-750 px-5 py-2 rounded-xl text-sm font-semibold transition text-white"
                >
                  Close Timeline
                </button>
              </div>
            </div>
          )}

          {/* STANDARD CHANGE PASSWORD MODAL */}
          {activeModal === "CHANGE_PASSWORD" && (
            <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-md overflow-hidden shadow-2xl">
              <div className="bg-slate-950 px-6 py-4 flex items-center justify-between border-b border-slate-850">
                <h3 className="text-lg font-bold text-white flex items-center gap-2">
                  <Key className="w-5 h-5 text-amber-500" />
                  Change Password
                </h3>
                <button 
                  onClick={() => {
                    setActiveModal(null);
                    setChangePasswordData({ oldPassword: "", newPassword: "", confirmPassword: "" });
                  }}
                  className="text-slate-400 hover:text-white rounded-lg p-1 hover:bg-slate-850 transition"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleChangePassword} className="p-6 space-y-4">
                {errorMsg && (
                  <div className="bg-rose-955/30 border border-rose-900/50 p-3.5 rounded-xl text-rose-455 text-xs flex items-center gap-2">
                    <AlertCircle className="w-4.5 h-4.5 shrink-0" />
                    <span>{errorMsg}</span>
                  </div>
                )}

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-350">Current Password</label>
                  <input
                    type="password"
                    required
                    placeholder="Enter current password"
                    value={changePasswordData.oldPassword}
                    onChange={(e) => setChangePasswordData({ ...changePasswordData, oldPassword: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-sm focus:outline-none focus:border-blue-500 transition text-white"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-350">New Password (Min 6 chars)</label>
                  <input
                    type="password"
                    required
                    placeholder="Enter new password"
                    value={changePasswordData.newPassword}
                    onChange={(e) => setChangePasswordData({ ...changePasswordData, newPassword: e.target.value })}
                    className="w-full bg-slate-955 border border-slate-800 rounded-xl px-3.5 py-2 text-sm focus:outline-none focus:border-blue-500 transition text-white"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-350">Confirm New Password</label>
                  <input
                    type="password"
                    required
                    placeholder="Confirm new password"
                    value={changePasswordData.confirmPassword}
                    onChange={(e) => setChangePasswordData({ ...changePasswordData, confirmPassword: e.target.value })}
                    className="w-full bg-slate-955 border border-slate-800 rounded-xl px-3.5 py-2 text-sm focus:outline-none focus:border-blue-500 transition text-white"
                  />
                </div>

                <div className="flex justify-end gap-3 pt-3 border-t border-slate-850">
                  <button
                    type="button"
                    onClick={() => {
                      setActiveModal(null);
                      setChangePasswordData({ oldPassword: "", newPassword: "", confirmPassword: "" });
                    }}
                    className="bg-slate-800 hover:bg-slate-750 px-4.5 py-2 rounded-xl text-sm font-semibold transition text-white"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={submitting}
                    className="flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-500 disabled:bg-blue-800 text-white px-5 py-2 rounded-xl text-sm font-semibold shadow-lg transition"
                  >
                    {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
                    Change Password
                  </button>
                </div>
              </form>
            </div>
          )}

        </div>
      )}

      {/* FORCED FIRST-TIME / RESET PASSWORD UPDATE OVERLAY */}
      {session.mustChangePassword && (
        <div className="fixed inset-0 z-50 bg-slate-955/90 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-md overflow-hidden shadow-2xl animate-pulse-slow">
            <div className="bg-slate-950 px-6 py-4 border-b border-slate-850 flex items-center justify-between">
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <ShieldAlert className="w-5 h-5 text-amber-500 animate-bounce" />
                Change Password Required
              </h3>
              <button
                onClick={handleLogout}
                className="flex items-center gap-1.5 bg-rose-950/45 hover:bg-rose-955/60 border border-rose-900/50 hover:border-rose-500 text-rose-455 px-3 py-1.5 rounded-xl text-xs font-semibold shadow transition"
              >
                <LogOut className="w-3.5 h-3.5" />
                Logout
              </button>
            </div>

            <form onSubmit={handleChangePassword} className="p-6 space-y-4">
              <p className="text-xs text-slate-400">
                You are logging in with a temporary password or your password has been reset. You must update your password before accessing the system.
              </p>

              {errorMsg && (
                <div className="bg-rose-955/30 border border-rose-900/50 p-3.5 rounded-xl text-rose-455 text-xs flex items-center gap-2">
                  <AlertCircle className="w-4.5 h-4.5 shrink-0" />
                  <span>{errorMsg}</span>
                </div>
              )}

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-350">Current Temporary Password</label>
                <input
                  type="password"
                  required
                  placeholder="Enter current password"
                  value={changePasswordData.oldPassword}
                  onChange={(e) => setChangePasswordData({ ...changePasswordData, oldPassword: e.target.value })}
                  className="w-full bg-slate-955 border border-slate-800 rounded-xl px-3.5 py-2 text-sm focus:outline-none focus:border-blue-500 transition text-white"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-350">New Password (Min 6 chars)</label>
                <input
                  type="password"
                  required
                  placeholder="Enter new password"
                  value={changePasswordData.newPassword}
                  onChange={(e) => setChangePasswordData({ ...changePasswordData, newPassword: e.target.value })}
                  className="w-full bg-slate-955 border border-slate-800 rounded-xl px-3.5 py-2 text-sm focus:outline-none focus:border-blue-500 transition text-white"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-350">Confirm New Password</label>
                <input
                  type="password"
                  required
                  placeholder="Confirm new password"
                  value={changePasswordData.confirmPassword}
                  onChange={(e) => setChangePasswordData({ ...changePasswordData, confirmPassword: e.target.value })}
                  className="w-full bg-slate-955 border border-slate-800 rounded-xl px-3.5 py-2 text-sm focus:outline-none focus:border-blue-500 transition text-white"
                />
              </div>

              <button
                type="submit"
                disabled={submitting}
                className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-semibold py-2.5 px-4 rounded-xl text-sm shadow-lg transition"
              >
                {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
                Change Password & Access Dashboard
              </button>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
