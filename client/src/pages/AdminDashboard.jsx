import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
	fetchApplications,
	reviewApplication,
	fetchAdminJobs,
	updateAdminJob,
	fetchAcceptedCompaniesForAdmin,
} from "../services/admin";
import { logout } from "../services/auth";

function AdminDashboard() {
	const navigate = useNavigate();
	const [applications, setApplications] = useState([]);
	const [loading, setLoading] = useState(true);
	const [updatingId, setUpdatingId] = useState("");
	const [selectedId, setSelectedId] = useState("");
	const [activeTab, setActiveTab] = useState("dashboard");
	const [statusFilter, setStatusFilter] = useState("pending");
	const [typeFilter, setTypeFilter] = useState("all");

	const [jobListFilter, setJobListFilter] = useState("all");
	const [jobCompanyFilter, setJobCompanyFilter] = useState("");
	const [adminJobs, setAdminJobs] = useState([]);
	const [jobsLoading, setJobsLoading] = useState(false);
	const [jobUpdatingId, setJobUpdatingId] = useState("");
	const [acceptedCompanies, setAcceptedCompanies] = useState([]);

	const loadApplications = async () => {
		setLoading(true);
		try {
			const data = await fetchApplications({
				status: statusFilter,
				type: typeFilter,
			});
			setApplications(data);
		} finally {
			setLoading(false);
		}
	};

	useEffect(() => {
		loadApplications();
	}, [statusFilter, typeFilter]);

	const loadAcceptedCompanies = async () => {
		try {
			const list = await fetchAcceptedCompaniesForAdmin();
			setAcceptedCompanies(Array.isArray(list) ? list : []);
		} catch {
			setAcceptedCompanies([]);
		}
	};

	useEffect(() => {
		loadAcceptedCompanies();
	}, []);

	useEffect(() => {
		if (activeTab === "all") setActiveTab("dashboard");
	}, [activeTab]);

	const loadAdminJobs = async () => {
		setJobsLoading(true);
		try {
			const rows = await fetchAdminJobs(jobListFilter, jobCompanyFilter || undefined);
			setAdminJobs(rows);
		} catch {
			setAdminJobs([]);
		} finally {
			setJobsLoading(false);
		}
	};

	useEffect(() => {
		if (jobListFilter === "Closed") setJobListFilter("all");
	}, [jobListFilter]);

	useEffect(() => {
		if (activeTab !== "jobs") return;
		loadAdminJobs();
	}, [activeTab, jobListFilter, jobCompanyFilter]);

	const queueRegistrationAction = async (user, applicationStatusNext) => {
		if (user.applicationStatus === applicationStatusNext) return;
		const action =
			applicationStatusNext === "accepted"
				? "accept"
				: applicationStatusNext === "rejected"
					? "reject"
					: "pending";
		setUpdatingId(user._id);
		try {
			await reviewApplication(user._id, action);
			await loadApplications();
			await loadAcceptedCompanies();
		} finally {
			setUpdatingId("");
		}
	};

	useEffect(() => {
		if (!applications.length) {
			setSelectedId("");
			return;
		}

		const exists = applications.some((app) => app._id === selectedId);
		if (!exists) {
			setSelectedId(applications[0]._id);
		}
	}, [applications, selectedId]);

	const handleReview = async (userId, action) => {
		setUpdatingId(userId);
		try {
			await reviewApplication(userId, action);
			await loadApplications();
			await loadAcceptedCompanies();
		} finally {
			setUpdatingId("");
		}
	};

	const handleLogout = async () => {
		await logout();
		navigate("/login");
	};

	const selectedApplication =
		applications.find((app) => app._id === selectedId) || null;

	const getDisplayName = (user) =>
		user.userType === "student"
			? user.studentProfile?.name || "N/A"
			: user.companyProfile?.companyName || "N/A";

	const statusCount = applications.reduce(
		(acc, user) => {
			acc[user.applicationStatus] = (acc[user.applicationStatus] || 0) + 1;
			return acc;
		},
		{ pending: 0, accepted: 0, rejected: 0 }
	);

	const handleTabClick = (tab) => {
		setActiveTab(tab);
		if (tab === "jobs") return;
		if (tab === "student") {
			setTypeFilter("student");
		} else if (tab === "company") {
			setTypeFilter("company");
		} else {
			setTypeFilter("all");
		}
	};

	const patchJob = async (jobId, payload) => {
		setJobUpdatingId(jobId);
		try {
			await updateAdminJob(jobId, payload);
			await loadAdminJobs();
		} finally {
			setJobUpdatingId("");
		}
	};

	const detailsRows =
		selectedApplication?.userType === "company"
			? [
					["Company", selectedApplication.companyProfile?.companyName || "N/A"],
					["Email", selectedApplication.email || "N/A"],
					["User Type", "Company"],
					["HR Name", selectedApplication.companyProfile?.hrName || "N/A"],
					// ["Company ID", selectedApplication.companyProfile?.companyId || "N/A"],
					["Address", selectedApplication.companyProfile?.address || "N/A"],
					[
						"Registered On",
						selectedApplication.createdAt
							? new Date(selectedApplication.createdAt).toLocaleDateString()
							: "N/A",
					],
			  ]
			: [
					["Name", selectedApplication?.studentProfile?.name || "N/A"],
					["Email", selectedApplication?.email || "N/A"],
					["User Type", "Student"],
					// ["Student ID", selectedApplication?.studentProfile?.studentId || "N/A"],
					["Last Semester", selectedApplication?.studentProfile?.lastSemester || "N/A"],
					["CGPA", selectedApplication?.studentProfile?.lastSemesterCGPA || "N/A"],
					["Address", selectedApplication?.studentProfile?.address || "N/A"],
					[
						"Resume",
						selectedApplication?.studentProfile?.resume
							? selectedApplication.studentProfile.resume
							: "N/A",
					],
			  ];

	return (
		<div className="admin-dashboard-wrapper py-3">
			<div className="admin-topbar">
				<div className="d-flex align-items-center gap-3">
					<div className="admin-avatar">A</div>
					<div>
						<div className="admin-title">Admin Panel</div>
					</div>
				</div>
				<button className="btn btn-outline-secondary btn-sm px-3" onClick={handleLogout}>
					Logout
				</button>
			</div>

			<div className="admin-tabs mb-3">
				<button
					className={activeTab === "dashboard" ? "active" : ""}
					onClick={() => handleTabClick("dashboard")}
				>
					Dashboard
				</button>
				<button
					className={activeTab === "student" ? "active" : ""}
					onClick={() => handleTabClick("student")}
				>
					Student Applications
				</button>
				<button
					className={activeTab === "company" ? "active" : ""}
					onClick={() => handleTabClick("company")}
				>
					Company Applications
				</button>
				<button
					className={activeTab === "jobs" ? "active" : ""}
					onClick={() => handleTabClick("jobs")}
				>
					Job postings
				</button>
			</div>

			{activeTab === "jobs" ? (
				<div className="card admin-card shadow-sm">
					<div className="card-header admin-card-header d-flex flex-wrap justify-content-between align-items-center gap-2">
						<span>All job postings (read-only overview)</span>
						<div className="d-flex flex-wrap align-items-center gap-2">
							<div className="d-flex align-items-center gap-1">
								<label className="small mb-0 text-white-50">Status</label>
								<select
									className="form-select form-select-sm"
									style={{ width: "auto", minWidth: "9rem" }}
									value={jobListFilter}
									onChange={(e) => setJobListFilter(e.target.value)}
								>
									<option value="all">All</option>
									<option value="Active">Active</option>
									<option value="Expired">Expired</option>
								</select>
							</div>
							<div className="d-flex align-items-center gap-1">
								<label className="small mb-0 text-white-50">Company</label>
								<select
									className="form-select form-select-sm"
									style={{ width: "auto", minWidth: "11rem" }}
									value={jobCompanyFilter}
									onChange={(e) => setJobCompanyFilter(e.target.value)}
								>
									<option value="">All companies</option>
									{acceptedCompanies.map((c) => (
										<option key={c.id} value={c.id}>
											{c.name}
										</option>
									))}
								</select>
							</div>
						</div>
					</div>
					<div className="card-body">
						<p className="small text-muted mb-3">
							Use Company to narrow the table. Posting status here is read-only (Active / Expired /
							Closed from the system or company). Hide removes a listing from the student board. Waive
							CGPA skips the minimum CGPA check when the posting has a cut-off.
						</p>
						{jobsLoading ? (
							<p className="text-muted mb-0">Loading jobs…</p>
						) : adminJobs.length === 0 ? (
							<p className="text-muted mb-0">No job postings match this filter.</p>
						) : (
							<div className="admin-jobs-table-wrap table-responsive">
								<table className="table table-sm table-striped align-middle mb-0">
									<thead>
										<tr>
											<th>Title</th>
											<th>Company</th>
											<th>Posting status</th>
											<th>Deadline</th>
											<th className="text-end">Applications</th>
											<th className="text-center">Min CGPA</th>
											<th className="text-center">CGPA waived</th>
											<th className="text-center">Hidden</th>
											<th className="text-end">Actions</th>
										</tr>
									</thead>
									<tbody>
										{adminJobs.map((job) => {
											const busy = jobUpdatingId === job._id;
											const deadline = job.applicationDeadline
												? new Date(job.applicationDeadline)
												: null;
											return (
												<tr key={job._id}>
													<td className="fw-semibold">{job.title}</td>
													<td className="small">
														{job.company?.name || "—"}
														<div className="text-muted">{job.company?.email}</div>
													</td>
													<td className="align-middle">
														<span
															className={`badge text-uppercase ${
																job.status === "Active"
																	? "text-bg-success"
																	: job.status === "Closed"
																		? "text-bg-danger"
																		: "text-bg-warning text-dark"
															}`}
														>
															{job.status}
														</span>
													</td>
													<td className="small text-nowrap">
														{deadline ? deadline.toLocaleDateString() : "—"}
													</td>
													<td className="text-end">{job.applicationCount}</td>
													<td className="text-center small">
														{job.minCGPA != null ? job.minCGPA : "—"}
													</td>
													<td className="text-center">
														{job.cgpaRequirementWaived ? (
															<span className="badge text-bg-info">Yes</span>
														) : (
															<span className="text-muted">No</span>
														)}
													</td>
													<td className="text-center">
														{job.hiddenFromStudents ? (
															<span className="badge text-bg-warning text-dark">Yes</span>
														) : (
															<span className="text-muted">No</span>
														)}
													</td>
													<td className="text-end">
														<div className="btn-group btn-group-sm flex-wrap justify-content-end">
															<button
																type="button"
																className="btn btn-outline-secondary"
																disabled={busy}
																onClick={() =>
																	patchJob(job._id, {
																		hiddenFromStudents: !job.hiddenFromStudents,
																	})
																}
															>
																{job.hiddenFromStudents ? "Unhide" : "Hide"}
															</button>
															<button
																type="button"
																className="btn btn-outline-secondary"
																disabled={busy || job.minCGPA == null}
																title={
																	job.minCGPA == null
																		? "No min CGPA on this posting"
																		: ""
																}
																onClick={() =>
																	patchJob(job._id, {
																		cgpaRequirementWaived: !job.cgpaRequirementWaived,
																	})
																}
															>
																{job.cgpaRequirementWaived ? "Enforce CGPA" : "Waive CGPA"}
															</button>
														</div>
													</td>
												</tr>
											);
										})}
									</tbody>
								</table>
							</div>
						)}
					</div>
				</div>
			) : (
			<div className="row g-3">
				<div className="col-lg-6">
					<div className="card admin-card shadow-sm h-100">
						<div className="card-header admin-card-header">Review Selected Application</div>
						<div className="card-body">
							<div className="row g-3 mb-3">
								<div className="col-sm-6">
									<label className="form-label">Status Filter</label>
									<select
										className="form-select"
										value={statusFilter}
										onChange={(e) => setStatusFilter(e.target.value)}
									>
										<option value="pending">Pending</option>
										<option value="accepted">Accepted</option>
										<option value="rejected">Rejected</option>
										<option value="all">All</option>
									</select>
								</div>
								<div className="col-sm-6">
									<label className="form-label">Type Filter</label>
									{activeTab === "dashboard" ? (
										<select
											className="form-select"
											value={typeFilter}
											onChange={(e) => setTypeFilter(e.target.value)}
										>
											<option value="all">All</option>
											<option value="student">Students</option>
											<option value="company">Companies</option>
										</select>
									) : activeTab === "student" ? (
										<select className="form-select" disabled value="student">
											<option value="student">Students</option>
										</select>
									) : (
										<select className="form-select" disabled value="company">
											<option value="company">Companies</option>
										</select>
									)}
								</div>
							</div>

							<div className="admin-status-grid mb-3">
								<div className="status-box pending">
									<div>Pending</div>
									<strong>{statusCount.pending}</strong>
								</div>
								<div className="status-box accepted">
									<div>Accepted</div>
									<strong>{statusCount.accepted}</strong>
								</div>
								<div className="status-box rejected">
									<div>Rejected</div>
									<strong>{statusCount.rejected}</strong>
								</div>
							</div>

							{loading ? (
								<p className="text-muted mb-0">Loading applications...</p>
							) : !selectedApplication ? (
								<p className="text-muted mb-0">Select an application from the right panel.</p>
							) : (
								<>
									<div className="review-detail-box">
										{detailsRows.map(([label, value]) => (
											<p key={label}>
												<span>{label}:</span> {value}
											</p>
										))}
										<p>
											<span>Status:</span>{" "}
											<span
												className={`badge rounded-pill text-capitalize ${
													selectedApplication.applicationStatus === "accepted"
														? "text-bg-success"
														: selectedApplication.applicationStatus === "rejected"
														? "text-bg-danger"
														: "text-bg-warning"
												}`}
											>
												{selectedApplication.applicationStatus}
											</span>
										</p>
									</div>
									<div className="d-flex gap-2 mt-3">
										<button
											className="btn btn-success flex-fill"
											disabled={
												updatingId === selectedApplication._id ||
												selectedApplication.applicationStatus === "accepted"
											}
											onClick={() => handleReview(selectedApplication._id, "accept")}
										>
											Accept Application
										</button>
										<button
											className="btn btn-danger flex-fill"
											disabled={
												updatingId === selectedApplication._id ||
												selectedApplication.applicationStatus === "rejected"
											}
											onClick={() => handleReview(selectedApplication._id, "reject")}
										>
											Reject Application
										</button>
									</div>
								</>
							)}
						</div>
					</div>
				</div>

				<div className="col-lg-6">
					<div className="card admin-card shadow-sm h-100">
						<div className="card-header admin-card-header d-flex justify-content-between align-items-center">
							<span>Application Queue</span>
							<div className="d-flex gap-2">
								<span className="badge text-bg-warning">Pending {statusCount.pending}</span>
								<span className="badge text-bg-success">Accepted {statusCount.accepted}</span>
								<span className="badge text-bg-danger">Rejected {statusCount.rejected}</span>
							</div>
						</div>
						<div className="card-body p-2">
							{loading ? (
								<p className="text-muted px-2 py-2 mb-0">Loading applications...</p>
							) : applications.length === 0 ? (
								<p className="text-muted px-2 py-2 mb-0">No applications found.</p>
							) : (
								<div className="application-list">
									{applications.map((user) => {
										const busyQueue = updatingId === user._id;
										return (
											<div
												key={user._id}
												className={`application-item ${
													selectedId === user._id ? "selected" : ""
												}`}
											>
												<div
													className="application-item-main"
													role="button"
													tabIndex={0}
													onClick={() => setSelectedId(user._id)}
													onKeyDown={(e) => {
														if (e.key === "Enter" || e.key === " ") {
															e.preventDefault();
															setSelectedId(user._id);
														}
													}}
												>
													<div className="d-flex justify-content-between align-items-start gap-2">
														<div>
															<div className="app-name">{getDisplayName(user)}</div>
															<div className="app-email">{user.email}</div>
															<div className="small text-muted text-capitalize">
																{user.userType}
															</div>
														</div>
														<span
															className={`badge rounded-pill text-capitalize ${
																user.applicationStatus === "accepted"
																	? "text-bg-success"
																	: user.applicationStatus === "rejected"
																		? "text-bg-danger"
																		: "text-bg-warning"
															}`}
														>
															{user.applicationStatus}
														</span>
													</div>
												</div>
												<div
													className="application-item-controls border-top mt-2 pt-2 px-1"
													onClick={(e) => e.stopPropagation()}
												>
													<label className="form-label small mb-0">Status</label>
													<select
														className="form-select form-select-sm"
														value={user.applicationStatus}
														disabled={busyQueue}
														onChange={(e) =>
															queueRegistrationAction(user, e.target.value)
														}
													>
														<option value="pending">Pending</option>
														<option value="accepted">Accepted</option>
														<option value="rejected">Rejected</option>
													</select>
												</div>
											</div>
										);
									})}
								</div>
							)}
						</div>
					</div>
				</div>
			</div>
			)}

			<style>{`
				.admin-dashboard-wrapper {
					max-width: 1320px;
					margin: 0 auto;
				}
				.admin-topbar {
					display: flex;
					justify-content: space-between;
					align-items: center;
					background: #f8f9fb;
					border: 1px solid #e2e5ec;
					border-radius: 12px;
					padding: 12px 16px;
					margin-bottom: 14px;
				}
				.admin-avatar {
					width: 42px;
					height: 42px;
					border-radius: 50%;
					background: #3158d3;
					color: #fff;
					display: grid;
					place-items: center;
					font-weight: 700;
				}
				.admin-title {
					font-weight: 700;
					font-size: 1.05rem;
				}
				.admin-subtitle {
					font-size: 0.85rem;
					color: #687184;
				}
				.admin-tabs {
					display: grid;
					grid-template-columns: repeat(auto-fit, minmax(130px, 1fr));
					gap: 8px;
				}
				.admin-jobs-table-wrap {
					max-height: 620px;
					overflow: auto;
					border: 1px solid #e1e7f2;
					border-radius: 10px;
				}
				.admin-tabs button {
					border: 1px solid #dde2ee;
					background: #fff;
					color: #4b5568;
					border-radius: 10px;
					padding: 8px 10px;
					font-size: 0.9rem;
				}
				.admin-tabs button.active {
					background: linear-gradient(90deg, #3f61de, #2f55d4);
					border-color: #3157d2;
					color: #ffffff;
					font-weight: 600;
				}
				.admin-card {
					border-radius: 12px;
					border: 1px solid #e1e5f0;
				}
				.admin-card-header {
					background: linear-gradient(90deg, #3f61de, #2f55d4);
					color: #fff;
					font-weight: 600;
					border-top-left-radius: 12px;
					border-top-right-radius: 12px;
				}
				.admin-status-grid {
					display: grid;
					grid-template-columns: repeat(3, minmax(0, 1fr));
					gap: 10px;
				}
				.status-box {
					padding: 10px;
					border-radius: 10px;
					background: #f8f9fb;
					border: 1px solid #e4e8f1;
					text-align: center;
				}
				.status-box strong {
					display: block;
					font-size: 1.1rem;
					margin-top: 2px;
				}
				.status-box.pending strong {
					color: #bb8a00;
				}
				.status-box.accepted strong {
					color: #1d8d50;
				}
				.status-box.rejected strong {
					color: #c53939;
				}
				.review-detail-box {
					background: #f7f9fe;
					border: 1px solid #e2e8f3;
					border-radius: 10px;
					padding: 12px;
				}
				.review-detail-box p {
					margin-bottom: 8px;
				}
				.review-detail-box p:last-child {
					margin-bottom: 0;
				}
				.review-detail-box span:first-child {
					font-weight: 600;
					color: #30384a;
					margin-right: 6px;
				}
				.application-list {
					max-height: 520px;
					overflow-y: auto;
					padding: 4px;
				}
				.application-item {
					width: 100%;
					border: 1px solid #e1e7f2;
					background: #fff;
					border-radius: 10px;
					padding: 10px;
					margin-bottom: 8px;
					text-align: left;
				}
				.application-item.selected {
					border-color: #3560dc;
					background: #f2f5ff;
				}
				.application-item-main {
					cursor: pointer;
					outline: none;
					border-radius: 8px;
					padding: 2px;
				}
				.application-item-main:focus-visible {
					box-shadow: 0 0 0 2px #3560dc88;
				}
				.app-name {
					font-weight: 600;
					color: #283247;
				}
				.app-email {
					font-size: 0.88rem;
					color: #5e6a82;
				}
				@media (max-width: 991px) {
					.admin-tabs {
						grid-template-columns: repeat(2, minmax(0, 1fr));
					}
				}
			`}</style>
		</div>
	);
}

export default AdminDashboard;
