import React, { useState, useEffect } from "react";
import {
	getJobs,
	applyJob,
	getMyApplications,
	getProfile,
	updateProfile,
	uploadProfileAvatar,
	uploadProfileResume,
	getProfileImageUrl,
} from "../services/student";
import { getCurrentUser, logout } from "../services/auth";
import { toast } from "react-toastify";
import { useNavigate } from "react-router-dom";

const StudentDashboard = ({
	userInfo: propUserInfo,
	onLogout: propOnLogout,
}) => {
	const [jobs, setJobs] = useState([]);
	const [applications, setApplications] = useState([]);
	const [loading, setLoading] = useState(false);
	const [selected, setSelected] = useState(null);
	const [activeTab, setActiveTab] = useState("jobs");
	const [appliedIds, setAppliedIds] = useState(new Set());
	const [applyingJobId, setApplyingJobId] = useState(null);
	const [profileOpen, setProfileOpen] = useState(false);
	const [profileData, setProfileData] = useState(null);
	const [profileForm, setProfileForm] = useState({
		lastSemester: "",
		lastSemesterCGPA: "",
		address: "",
		resume: "",
		profileImage: "",
	});
	const [profileImageFile, setProfileImageFile] = useState(null);
	const [profileResumeFile, setProfileResumeFile] = useState(null);
	const [savingProfile, setSavingProfile] = useState(false);
	const [loadingProfile, setLoadingProfile] = useState(false);

	const navigate = useNavigate();

	// Use prop userInfo if provided, otherwise get from localStorage
	const userInfo = propUserInfo || getCurrentUser();
	const studentInfo = userInfo?.studentProfile || {};

	// Handle logout - use prop function if provided, otherwise use auth logout
	const handleLogout = async () => {
		if (propOnLogout) {
			propOnLogout();
		} else {
			await logout();
			navigate("/");
		}
	};

	useEffect(() => {
		loadData();
	}, []);

	// Load profile on mount so header shows avatar and name; data also used when opening profile modal
	useEffect(() => {
		if (userInfo?.userType !== "student") return;
		getProfile()
			.then((data) => {
				const p = data.studentProfile || data;
				setProfileData({
					name: p.name ?? data.name ?? userInfo?.studentProfile?.name,
					email: data.email ?? userInfo?.email,
					lastSemester: p.lastSemester ?? "",
					lastSemesterCGPA: p.lastSemesterCGPA ?? "",
					address: p.address ?? "",
					resume: p.resume ?? "",
					profileImage: p.profileImage ?? "",
				});
			})
			.catch(() => setProfileData(null));
	}, [userInfo?.userType, userInfo?.email, userInfo?.studentProfile?.name]);

	// Early return if userInfo is not available
	if (!userInfo) {
		return (
			<div className="min-vh-100 bg-light d-flex align-items-center justify-content-center">
				<div className="text-center">
					<div className="spinner-border text-primary" role="status">
						<span className="visually-hidden">Loading...</span>
					</div>
					<div className="mt-3">Loading user information...</div>
					<div className="mt-2">
						<button
							className="btn btn-primary btn-sm"
							onClick={() => navigate("/login")}
						>
							Go to Login
						</button>
					</div>
				</div>
			</div>
		);
	}

	const loadData = async () => {
		try {
			setLoading(true);

			// Load jobs and applications in parallel
			const [jobsResult, applicationsResult] = await Promise.all([
				getJobs(),
				getMyApplications(),
			]);

			setJobs(jobsResult || []);
			setApplications(applicationsResult || []);

			// Track applied job IDs
			const appliedJobIds = new Set(
				(applicationsResult || []).map((app) => app.jobId?._id || app.jobId)
			);
			setAppliedIds(appliedJobIds);
		} catch (error) {
			console.error("Error loading data:", error);
			toast.error("Failed to load data");
		} finally {
			setLoading(false);
		}
	};

	const directApply = async (job) => {
		if (appliedIds.has(job._id)) return;
		// Use profile data for lastSemester, lastSemesterCGPA, resume
		let data = profileData;
		if (!data?.lastSemester || !data?.lastSemesterCGPA || !data?.resume) {
			try {
				data = await getProfile();
			} catch {
				toast.error("Please complete your profile first (Current semester, CGPA, Resume)");
				openProfile();
				return;
			}
		}
		if (!data?.lastSemester?.trim() || !data?.lastSemesterCGPA?.trim() || !data?.resume?.trim()) {
			toast.error("Please complete your profile first (Current semester, CGPA, Resume)");
			openProfile();
			return;
		}
		setApplyingJobId(job._id);
		try {
			await applyJob(job._id, {
				lastSemester: data.lastSemester.trim(),
				lastSemesterCGPA: data.lastSemesterCGPA.trim(),
				resume: data.resume.trim(),
			});
			setAppliedIds((prev) => new Set([...prev, job._id]));
			toast.success("Application submitted successfully!");
			const updated = await getMyApplications();
			setApplications(updated || []);
			setSelected(null);
		} catch (err) {
			toast.error(err.message || "Failed to apply");
		} finally {
			setApplyingJobId(null);
		}
	};

	const openProfile = async () => {
		setProfileOpen(true);
		setLoadingProfile(true);
		try {
			const data = await getProfile();
			// Support both flat response and nested data.studentProfile
			const p = data.studentProfile || data;
			setProfileData({ name: p.name ?? data.name, email: data.email ?? p.email, ...p });
			setProfileForm({
				lastSemester: p.lastSemester ?? "",
				lastSemesterCGPA: p.lastSemesterCGPA ?? "",
				address: p.address ?? "",
				resume: p.resume ?? "",
				profileImage: p.profileImage ?? "",
			});
			setProfileImageFile(null);
			setProfileResumeFile(null);
		} catch (err) {
			// 404 or network error: still open modal with name/email from userInfo
			const fallback = {
				name: studentInfo?.name || userInfo?.name || "Student",
				email: userInfo?.email || "",
			};
			setProfileData(fallback);
			setProfileForm({
				lastSemester: "",
				lastSemesterCGPA: "",
				address: "",
				resume: "",
				profileImage: "",
			});
			setProfileImageFile(null);
			setProfileResumeFile(null);
			if (err?.response?.status !== 404) {
				toast.error(err?.message || "Failed to load profile");
			}
		} finally {
			setLoadingProfile(false);
		}
	};

	const saveProfile = async (e) => {
		e.preventDefault();
		const cgpa = parseFloat(profileForm.lastSemesterCGPA);
		if (profileForm.lastSemesterCGPA && (isNaN(cgpa) || cgpa < 1 || cgpa > 10)) {
			toast.error("Current semester CGPA must be a decimal number between 1 and 10");
			return;
		}
		setSavingProfile(true);
		try {
			let resumePath = profileForm.resume;
			let profileImagePath = profileForm.profileImage;
			if (profileImageFile) {
				const r = await uploadProfileAvatar(profileImageFile);
				profileImagePath = r.path || r.profileImage || "";
			}
			if (profileResumeFile) {
				const r = await uploadProfileResume(profileResumeFile);
				resumePath = r.path || r.resume || "";
			}
			// Send only profile fields; backend updates only these, rest of DB data stays as is
			const updated = await updateProfile({
				lastSemester: (profileForm.lastSemester || "").trim(),
				lastSemesterCGPA: (profileForm.lastSemesterCGPA || "").trim(),
				address: (profileForm.address || "").trim(),
				resume: resumePath || "",
				profileImage: profileImagePath || "",
			});
			toast.success("Profile updated successfully");
			setProfileOpen(false);
			setProfileData((prev) => ({ ...prev, ...updated }));
			setProfileForm({
				lastSemester: updated.lastSemester || "",
				lastSemesterCGPA: updated.lastSemesterCGPA || "",
				address: updated.address || "",
				resume: updated.resume || "",
				profileImage: updated.profileImage || "",
			});
		} catch (err) {
			console.error(err);
			toast.error(err.message || "Failed to update profile");
		} finally {
			setSavingProfile(false);
		}
	};


	return (
		<div className="min-vh-100" style={{ backgroundColor: "#f8f9fa" }}>
			{/* Modern Header */}
			<header className="bg-white shadow-sm border-bottom">
				<div className="container-fluid">
					<div className="row align-items-center py-3">
						<div className="col-md-6">
							<button
								type="button"
								className="d-flex align-items-center border-0 bg-transparent p-0 text-start w-100"
								onClick={openProfile}
								aria-label="Open profile"
							>
								<div className="me-3 flex-shrink-0">
									{profileData?.profileImage ? (
										<img
											src={getProfileImageUrl(profileData.profileImage)}
											alt="Profile"
											className="rounded-circle object-fit-cover"
											style={{ width: "48px", height: "48px" }}
										/>
									) : (
										<div
											className="bg-success rounded-circle d-flex align-items-center justify-content-center"
											style={{ width: "48px", height: "48px" }}
										>
											<i className="bi bi-person-fill text-white fs-4"></i>
										</div>
									)}
								</div>
								<div className="flex-grow-1">
									<h4 className="mb-0 fw-bold text-dark">
										{studentInfo?.name || userInfo?.name || "Student"}
									</h4>
									<p className="mb-0 text-muted small">
										{studentInfo?.email || userInfo?.email || ""}
									</p>
								</div>
							</button>
						</div>
						<div className="col-md-6 text-end">
							<div className="d-flex align-items-center justify-content-end gap-3">
								<div className="d-none d-md-flex align-items-center gap-4">
									<div className="text-center">
										<div className="fw-bold text-success fs-5">
											{jobs.length}
										</div>
										<small className="text-muted">Available Jobs</small>
									</div>
									<div className="text-center">
										<div className="fw-bold text-primary fs-5">
											{appliedIds.size}
										</div>
										<small className="text-muted">Applied</small>
									</div>
								</div>
								<button
									className="btn btn-outline-danger btn-sm"
									onClick={handleLogout}
								>
									<i className="bi bi-box-arrow-right me-1"></i>
									<span className="d-none d-sm-inline">Logout</span>
								</button>
							</div>
						</div>
					</div>
				</div>
			</header>

			{/* Main Content */}
			<div className="container-fluid py-4">
				{/* Mobile Stats - Only show on mobile */}
				<div className="row d-md-none mb-4">
					<div className="col-6">
						<div className="card text-center border-0 shadow-sm">
							<div className="card-body py-3">
								<div className="fw-bold text-success fs-4">{jobs.length}</div>
								<small className="text-muted">Available Jobs</small>
							</div>
						</div>
					</div>
					<div className="col-6">
						<div className="card text-center border-0 shadow-sm">
							<div className="card-body py-3">
								<div className="fw-bold text-primary fs-4">
									{appliedIds.size}
								</div>
								<small className="text-muted">Applied</small>
							</div>
						</div>
					</div>
				</div>

				<div className="row">


					{/* Main Content Area */}
					<div className="col-lg-12">
						{/* Improved Tabs */}
						<div className="card border-0 shadow-sm">
							<div className="card-header bg-white border-0">
								<ul className="nav nav-pills nav-fill">
									<li className="nav-item">
										<button
											className={`nav-link ${activeTab === "jobs" ? "active" : ""
												} d-flex align-items-center justify-content-center`}
											onClick={() => setActiveTab("jobs")}
											style={{
												backgroundColor:
													activeTab === "jobs" ? "#28a745" : "transparent",
												color: activeTab === "jobs" ? "white" : "#6c757d",
												border: "none",
												borderRadius: "8px",
											}}
										>
											<i className="bi bi-briefcase me-2"></i>
											<span className="d-none d-sm-inline">Available Jobs</span>
											{/* <span className="d-sm-none">Jobs</span> */}
											<span className="badge bg-light text-dark ms-2">
												{jobs.length}
											</span>
										</button>
									</li>
									<li className="nav-item">
										<button
											className={`nav-link ${activeTab === "applications" ? "active" : ""
												} d-flex align-items-center justify-content-center`}
											onClick={() => setActiveTab("applications")}
											style={{
												backgroundColor:
													activeTab === "applications"
														? "#28a745"
														: "transparent",
												color:
													activeTab === "applications" ? "white" : "#6c757d",
												border: "none",
												borderRadius: "8px",
											}}
										>
											<i className="bi bi-file-text me-2"></i>
											<span className="d-none d-sm-inline">
												My Applications
											</span>
											{/* <span className="d-sm-none">Applied</span> */}
											<span className="badge bg-light text-dark ms-2">
												{applications.length}
											</span>
										</button>
									</li>
								</ul>
							</div>

							<div className="card-body p-4 col-12">
								{activeTab === "jobs" && (
									<>
										{jobs.length === 0 ? (
											<div className="text-center py-5">
												<div className="mb-4">
													<i className="bi bi-briefcase display-4 text-muted"></i>
												</div>
												<h5 className="text-muted mb-2">No Jobs Available</h5>
												<p className="text-muted">
													Check back later for new opportunities
												</p>
											</div>
										) : (
											<div className="row g-3">
												{jobs.map((job) => (
													<div
														className="col-xl-6"
														key={job._id}
													>
														<div className="modern-job-card">
															{/* Card Header with Gradient */}
															<div className="card-header-gradient">
																<div className="d-flex justify-content-between align-items-start">
																	<div className="company-logo-section">
																		<div className="company-avatar">
																			<span className="company-initial">
																				{(
																					job.companyId?.companyProfile
																						?.companyName || "C"
																				)
																					.charAt(0)
																					.toUpperCase()}
																			</span>
																		</div>
																	</div>
																	<div className="job-type-modern">
																		<span
																			className={`job-type-badge ${job.jobType === "Full-time"
																				? "full-time"
																				: job.jobType === "Internship"
																					? "internship"
																					: job.jobType === "Part-time"
																						? "part-time"
																						: "other"
																				}`}
																		>
																			{job.jobType || "Other"}
																		</span>
																	</div>
																</div>
															</div>

															{/* Card Content */}
															<div className="card-content-modern">
																{/* Job Title & Company */}
																<div className="job-title-section">
																	<h5 className="job-title">
																		{job.title || "Job Position"}
																	</h5>
																	<p className="company-name">
																		{job.companyId?.companyProfile
																			?.companyName || "Unknown Company"}
																	</p>
																</div>

																{/* Job Info Grid */}
																<div className="job-info-grid">
																	<div className="info-item">
																		<div className="info-icon location">
																			<i className="bi bi-geo-alt"></i>
																		</div>
																		<span className="info-text">
																			{job.location || "Remote"}
																		</span>
																	</div>

																	<div className="info-item">
																		<div className="info-icon deadline">
																			<i className="bi bi-clock"></i>
																		</div>
																		<span className="info-text">
																			{job.applicationDeadline
																				? new Date(
																					job.applicationDeadline
																				).toLocaleDateString("en-US", {
																					month: "short",
																					day: "numeric",
																				})
																				: "Open"}
																		</span>
																	</div>
																</div>

																{/* Technology Stack */}
																{job.technology && (
																	<div className="tech-stack-section">
																		<div className="tech-chips">
																			{(Array.isArray(job.technology)
																				? job.technology.slice(0, 4)
																				: [job.technology]
																			).map((tech, index) => (
																				<span key={index} className="tech-chip">
																					{tech}
																				</span>
																			))}
																			{Array.isArray(job.technology) &&
																				job.technology.length > 4 && (
																					<span className="tech-chip more-count">
																						+{job.technology.length - 4}
																					</span>
																				)}
																		</div>
																	</div>
																)}

																{/* Action Section */}
																<div className="action-section">
																	<button
																		className="btn-modern secondary"
																		onClick={() => setSelected(job)}
																	>
																		<i className="bi bi-eye"></i>
																		<span>Details</span>
																	</button>
																	<button
																		className={`btn-modern primary ${appliedIds.has(job._id) ? "applied" : ""
																			}`}
																		disabled={appliedIds.has(job._id) || applyingJobId === job._id}
																		onClick={() => directApply(job)}
																	>
																		{appliedIds.has(job._id) ? (
																			<>
																				<i className="bi bi-check-circle"></i>
																				<span>Applied</span>
																			</>
																		) : applyingJobId === job._id ? (
																			<>
																				<div className="btn-spinner"></div>
																				<span>Applying...</span>
																			</>
																		) : (
																			<>
																				<i className="bi bi-send"></i>
																				<span>Apply</span>
																			</>
																		)}
																	</button>
																</div>
															</div>
														</div>
													</div>
												))}
											</div>
										)}
									</>
								)}

								{activeTab === "applications" && (
									<>
										{applications.length === 0 ? (
											<div className="text-center py-5">
												<div className="mb-4">
													<i className="bi bi-file-text display-4 text-muted"></i>
												</div>
												<h5 className="text-muted mb-2">No Applications Yet</h5>
												<p className="text-muted">
													Start applying to jobs to see your applications here
												</p>
											</div>
										) : (
											<>
												{/* Desktop Table View */}
												<div className="d-none d-lg-block" style={{ minWidth: '800px' }}>
													<div className="table-responsive">
														<table className="table table-hover align-middle">
															<thead className="table-light">
																<tr>
																	<th>Job Title</th>
																	<th>Company</th>
																	<th>Applied Date</th>
																	<th>Status</th>
																</tr>
															</thead>
															<tbody>
																{applications.map((app) => (
																	<tr key={app._id}>
																		<td>
																			<div className="fw-semibold">
																				{app.jobId?.title || "N/A"}
																			</div>
																			<small className="text-muted">
																				{app.jobId?.jobType}
																			</small>
																		</td>
																		<td>
																			{app.companyId?.companyProfile
																				?.companyName || "N/A"}
																		</td>
																		<td>
																			{new Date(
																				app.createdAt
																			).toLocaleDateString()}
																		</td>
																		<td>
																			<span
																				className={`badge bg-info ${app.status === "Applied"}`}
																			>
																				{app.status}
																			</span>
																		</td>
																	</tr>
																))}
															</tbody>
														</table>
													</div>
												</div>

												{/* Mobile Card View */}
												<div className="d-lg-none">
													<div className="row g-3">
														{applications.map((app) => (
															<div className="col-12" key={app._id}>
																<div className="card border-0 shadow-sm">
																	<div className="card-body p-3">
																		<div className="d-flex justify-content-between align-items-start mb-2">
																			<div className="flex-grow-1">
																				<h6 className="mb-1 fw-bold text-dark">
																					{app.jobId?.title || "N/A"}
																				</h6>
																				<small className="text-muted d-block mb-1">
																					{app.companyId?.companyProfile
																						?.companyName || "N/A"}
																				</small>
																			</div>
																			<span
																				className={`badge rounded-pill ${app.status === "Applied"
																					? "bg-info"
																					: app.status === "Selected"
																						? "bg-success"
																						: app.status === "Rejected"
																							? "bg-danger"
																							: "bg-secondary"
																					} px-3 py-2`}
																			>
																				{app.status}
																			</span>
																		</div>
																		<div className="d-flex justify-content-between align-items-center text-muted small">
																			<div className="d-flex align-items-center">
																				<i className="bi bi-briefcase me-1"></i>
																				<span>
																					{app.jobId?.jobType || "N/A"}
																				</span>
																			</div>
																			<div className="d-flex align-items-center">
																				<i className="bi bi-calendar-event me-1"></i>
																				<span>
																					{new Date(
																						app.createdAt
																					).toLocaleDateString()}
																				</span>
																			</div>
																		</div>
																	</div>
																</div>
															</div>
														))}
													</div>
												</div>
											</>
										)}
									</>
								)}
							</div>
						</div>
					</div>
				</div>
			</div>

			{/* Job Details Modal */}
			{selected && (
				<div
					className="modal fade show"
					style={{ display: "block", backgroundColor: "rgba(0,0,0,0.5)" }}
				>
					<div className="modal-dialog modal-lg modal-dialog-centered modal-dialog-scrollable">
						<div className="modal-content">
							<div className="modal-header border-0 pb-2">
								<div className="flex-grow-1">
									<h5 className="modal-title fw-bold text-dark mb-1">
										{selected.title || "Job Position"}
									</h5>
									<div className="text-muted d-flex align-items-center">
										<i className="bi bi-building me-2"></i>
										<span>
											{selected.companyId?.companyProfile?.companyName ||
												"Unknown Company"}
										</span>
									</div>
								</div>
								<button
									type="button"
									className="btn-close"
									onClick={() => setSelected(null)}
								></button>
							</div>
							<div className="modal-body">
								{/* Job Type Badge */}
								<div className="mb-4">
									<span
										className={`badge rounded-pill fs-6 ${selected.jobType === "Full-time"
											? "bg-success"
											: selected.jobType === "Internship"
												? "bg-info"
												: selected.jobType === "Part-time"
													? "bg-warning text-dark"
													: "bg-secondary"
											} px-3 py-2`}
									>
										{selected.jobType || "Not specified"}
									</span>
								</div>

								{/* Quick Info Cards */}
								<div className="row g-3 mb-4">
									<div className="col-6 col-sm-3">
										<div className="text-center p-3 bg-light rounded">
											<i className="bi bi-geo-alt text-success fs-4"></i>
											<div className="small text-muted mt-1">Location</div>
											<div className="fw-semibold small">
												{selected.location || "Remote"}
											</div>
										</div>
									</div>
									{/* <div className="col-6 col-sm-3">
										<div className="text-center p-3 bg-light rounded">
											<i className="bi bi-laptop text-primary fs-4"></i>
											<div className="small text-muted mt-1">Work Mode</div>
											<div className="fw-semibold small">
												{selected.workMode || "N/A"}
											</div>
										</div>
									</div> */}
									<div className="col-6 col-sm-3">
										<div className="text-center p-3 bg-light rounded">
											<i className="bi bi-calendar-event text-warning fs-4"></i>
											<div className="small text-muted mt-1">Deadline</div>
											<div className="fw-semibold small">
												{selected.applicationDeadline
													? new Date(
														selected.applicationDeadline
													).toLocaleDateString("en-US", {
														month: "short",
														day: "numeric",
													})
													: "Open"}
											</div>
										</div>
									</div>
									<div className="col-6 col-sm-3">
										<div className="text-center p-3 bg-light rounded">
											<i className="bi bi-cash text-info fs-4"></i>
											<div className="small text-muted mt-1">Stipend</div>
											<div className="fw-semibold small">
												{selected.stipend || "N/A"}
											</div>
										</div>
									</div>
									<div className="col-6 col-sm-3">
										<div className="text-center p-3 bg-light rounded">
											<i className="bi bi-card-checklist text-danger fs-4"></i>
											<div className="small text-muted mt-1">Bond</div>
											<div className="fw-semibold small">
												{selected.bond || "N/A"}
											</div>
										</div>
									</div>
									<div className="col-6 col-sm-3">
										<div className="text-center p-3 bg-light rounded">
											<i className="bi bi-currency-rupee text-success fs-4"></i>
											<div className="small text-muted mt-1">Salary</div>
											<div className="fw-semibold small">
												{selected.salary || "N/A"}
											</div>
										</div>
									</div>
									<div className="col-6 col-sm-3">
										<div className="text-center p-3 bg-light rounded">
											<i className="bi bi-bookmark-check-fill text-warning fs-4"></i>
											<div className="small text-muted mt-1">min CGPA</div>
											<div className="fw-semibold small">
												{selected.cgpaRequirementWaived
													? "Waived"
													: selected.minCGPA ?? "N/A"}
											</div>
											{selected.cgpaRequirementWaived &&
												selected.minCGPA != null &&
												selected.minCGPA !== "" && (
													<div className="small text-muted mt-1">
														Cut-off {selected.minCGPA} — not enforced for this drive
													</div>
												)}
										</div>
									</div>
								</div>

								{/* Technologies Section */}
								{selected.technology && (
									<div className="mb-4">
										<h6 className="fw-bold text-dark mb-3 d-flex align-items-center">
											<i className="bi bi-tools me-2 text-success"></i>
											Technologies & Skills
										</h6>
										<div className="d-flex flex-wrap gap-2">
											{(Array.isArray(selected.technology)
												? selected.technology
												: [selected.technology]
											).map((tech, index) => (
												<span
													key={index}
													className="badge bg-primary bg-opacity-10 text-primary border border-primary border-opacity-25 px-3 py-2"
												>
													{tech}
												</span>
											))}
										</div>
									</div>
								)}

								{/* Company Information */}
								{selected.companyId?.companyProfile && (
									<div className="border rounded-3 p-4 bg-light bg-opacity-50">
										<h6 className="fw-bold text-dark mb-3 d-flex align-items-center">
											<i className="bi bi-building me-2 text-success"></i>
											Company Information
										</h6>
										<div className="row g-3">
											<div className="col-md-6">
												<div className="mb-3">
													<div className="text-muted small mb-1">
														Company Name
													</div>
													<div className="fw-semibold">
														{selected.companyId.companyProfile.companyName}
													</div>
												</div>
												{selected.companyId.companyProfile.industry && (
													<div className="mb-3">
														<div className="text-muted small mb-1">
															Industry
														</div>
														<div className="fw-semibold">
															{selected.companyId.companyProfile.industry}
														</div>
													</div>
												)}
											</div>
											<div className="col-md-6">
												{selected.companyId.companyProfile.hrName && (
													<div className="mb-3">
														<div className="text-muted small mb-1">
															HR Contact
														</div>
														<div className="fw-semibold">
															{selected.companyId.companyProfile.hrName}
														</div>
													</div>
												)}
												{selected.companyId.companyProfile.location && (
													<div className="mb-2">
														<div className="text-muted small">
															Company Location
														</div>
														<div className="fw-semibold">
															{selected.companyId.companyProfile.location}
														</div>
													</div>
												)}
											</div>
										</div>
									</div>
								)}

								{/* Job Description */}
								{selected.description && (
									<div className="border rounded p-3 mt-4">
										<h6 className="fw-bold text-success mb-3">
											<i className="bi bi-file-text me-2"></i>
											Job Description
										</h6>
										<div
											className="text-dark"
											style={{ whiteSpace: "pre-wrap" }}
										>
											{selected.description}
										</div>
									</div>
								)}
							</div>
							<div className="modal-footer border-0">
								<button
									className="btn btn-outline-secondary"
									onClick={() => setSelected(null)}
								>
									Close
								</button>
								<button
									className="btn btn-success"
									disabled={appliedIds.has(selected._id) || applyingJobId === selected._id}
									onClick={() => directApply(selected)}
								>
									{appliedIds.has(selected._id) ? (
										<>
											<i className="bi bi-check-circle me-1"></i>
											Already Applied
										</>
									) : applyingJobId === selected._id ? (
										<>
											<span className="spinner-border spinner-border-sm me-1"></span>
											Applying...
										</>
									) : (
										<>
											<i className="bi bi-send me-1"></i>
											Apply for this Job
										</>
									)}
								</button>
							</div>
						</div>
					</div>
				</div>
			)}

			{/* Profile Modal */}
			{profileOpen && (
				<div
					className="modal fade show"
					style={{ display: "block", backgroundColor: "rgba(0,0,0,0.45)" }}
					onClick={(e) => e.target === e.currentTarget && setProfileOpen(false)}
				>
					<div className="modal-dialog modal-dialog-centered modal-dialog-scrollable" onClick={(e) => e.stopPropagation()}>
						<div className="modal-content border-0 shadow-lg rounded-4 overflow-hidden">
							<div
								className="modal-header text-white border-0 py-4"
								style={{ background: "linear-gradient(135deg, #198754 0%, #20c997 100%)" }}
							>
								<h5 className="modal-title fw-bold mb-0">My Profile</h5>
								<button type="button" className="btn-close btn-close-white" aria-label="Close" onClick={() => setProfileOpen(false)} />
							</div>
							<div className="modal-body p-4">
								{loadingProfile ? (
									<div className="text-center py-5">
										<div className="spinner-border text-success" role="status" />
										<p className="mt-2 text-muted mb-0">Loading profile...</p>
									</div>
								) : (
									<form onSubmit={saveProfile}>
										{/* Profile image + name, email (read-only) */}
										<div className="text-center mb-4">
											<div className="position-relative d-inline-block">
												{(profileForm.profileImage || profileImageFile) ? (
													<img
														src={profileImageFile ? URL.createObjectURL(profileImageFile) : getProfileImageUrl(profileForm.profileImage)}
														alt="Profile"
														className="rounded-circle border border-3 border-success object-fit-cover"
														style={{ width: "100px", height: "100px" }}
													/>
												) : (
													<div
														className="bg-success bg-opacity-25 rounded-circle d-flex align-items-center justify-content-center border border-3 border-success"
														style={{ width: "100px", height: "100px" }}
													>
														<i className="bi bi-person-fill text-success" style={{ fontSize: "2.5rem" }}></i>
													</div>
												)}
												<label className="position-absolute bottom-0 end-0 bg-success text-white rounded-circle shadow-sm mb-0" style={{ width: "32px", height: "32px", cursor: "pointer" }}>
													<input
														type="file"
														accept="image/jpeg,image/png,image/gif,image/webp"
														className="d-none"
														onChange={(e) => setProfileImageFile(e.target.files?.[0] || null)}
													/>
													<span className="d-flex align-items-center justify-content-center w-100 h-100"><i className="bi bi-camera-fill small"></i></span>
												</label>
											</div>
											<h5 className="fw-bold text-dark mt-3 mb-0">{profileData?.name || studentInfo?.name || "Student"}</h5>
											<p className="text-muted small mt-1 mb-0">{profileData?.email || userInfo?.email || ""}</p>
											{/* <small className="text-muted">Name and email are read-only</small> */}
										</div>

										{/* Editable fields */}
										<div className="card border-0 shadow-sm rounded-3 mb-3">
											<div className="card-body p-4">
												<div className="row g-3 mb-3">
													<div className="col-md-6">
														<label className="form-label fw-semibold text-dark">Current Semester</label>
														<input
															type="text"
															className="form-control rounded-3"
															placeholder="e.g. 6th, 7th, 8th"
															value={profileForm.lastSemester}
															onChange={(e) => setProfileForm((f) => ({ ...f, lastSemester: e.target.value }))}
														/>
													</div>
													<div className="col-md-6">
														<label className="form-label fw-semibold text-dark">Current Sem CGPA</label>
														<input
															step="0.1"
															min="0"
															max="10"
															type="number"
															className="form-control rounded-3"
															placeholder="e.g. 8.5"
															value={profileForm.lastSemesterCGPA}
															onChange={(e) => setProfileForm((f) => ({ ...f, lastSemesterCGPA: e.target.value }))}
														/>
													</div>
												</div>
												<div className="mb-3">
													<label className="form-label fw-semibold text-dark">Address</label>
													<textarea
														className="form-control rounded-3"
														rows={2}
														placeholder="Your address"
														value={profileForm.address}
														onChange={(e) => setProfileForm((f) => ({ ...f, address: e.target.value }))}
													/>
												</div>
												<div className="mb-3">
													<label className="form-label fw-semibold text-dark">Resume</label>
													{profileForm.resume ? (
														<div className="d-flex align-items-center gap-2 flex-wrap">
															<a
																href={getProfileImageUrl(profileForm.resume)}
																target="_blank"
																rel="noopener noreferrer"
																className="text-primary text-decoration-none d-inline-flex align-items-center"
															>
																<i className="bi bi-file-earmark-pdf me-1"></i> View current resume
															</a>
														</div>
													) : null}
													<input
														type="file"
														accept=".png,.pdf,.doc,.docx,image/png,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
														className="form-control rounded-3"
														onChange={(e) => setProfileResumeFile(e.target.files?.[0] || null)}
													/>
													{profileResumeFile && <small className="text-success">New file: {profileResumeFile.name}</small>}
												</div>
											</div>
										</div>
										<div className="modal-footer border-0 px-0 pb-0 pt-2">
											<button type="button" className="btn btn-outline-secondary rounded-pill px-4" onClick={() => setProfileOpen(false)}>
												Cancel
											</button>
											<button type="submit" className="btn btn-success rounded-pill px-4" disabled={savingProfile}>
												{savingProfile ? <span className="spinner-border spinner-border-sm me-2" /> : null}
												<i className="bi bi-check-lg me-2"></i>
												Save changes
											</button>
										</div>
									</form>
								)}
							</div>
						</div>
					</div>
				</div>
			)}

			<style>{`
				/* Apply Form Modal */
				.apply-form-modal {
					border-radius: 20px;
					overflow: hidden;
				}
				.apply-form-modal-header {
					background: linear-gradient(135deg, #198754 0%, #20c997 100%);
					padding: 1.25rem 1.5rem;
					display: flex;
					align-items: flex-start;
					justify-content: space-between;
					gap: 1rem;
				}
				.apply-form-icon-wrap {
					width: 48px;
					height: 48px;
					min-width: 48px;
					background: rgba(255, 255, 255, 0.25);
					border-radius: 14px;
					display: flex;
					align-items: center;
					justify-content: center;
					font-size: 1.35rem;
					color: #fff;
				}
				.apply-form-field-icon {
					width: 36px;
					height: 36px;
					min-width: 36px;
					border-radius: 10px;
					display: inline-flex;
					align-items: center;
					justify-content: center;
					font-size: 1rem;
				}
				.apply-form-field .form-control {
					border: 1px solid #e0e0e0;
					transition: border-color 0.2s, box-shadow 0.2s;
				}
				.apply-form-field .form-control:focus {
					border-color: #198754;
					box-shadow: 0 0 0 3px rgba(25, 135, 84, 0.15);
				}
				.apply-form-field .form-control.is-invalid {
					border-color: #dc3545;
				}

				/* Modern Job Card Styles */
				.modern-job-card {
					background: #ffffff;
					border-radius: 20px;
					overflow: hidden;
					box-shadow: 0 8px 32px rgba(0, 0, 0, 0.08);
					transition: all 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275);
					border: 1px solid rgba(255, 255, 255, 0.2);
					backdrop-filter: blur(10px);
					height: 100%;
					min-height: 420px;
					min-width: 280px;
					max-width: 400px;
					width: 100%;
					display: flex;
					flex-direction: column;
					margin: 0 auto;
				}
				
				.modern-job-card:hover {
					transform: translateY(-8px) scale(1.02);
					box-shadow: 0 20px 60px rgba(40, 167, 69, 0.15);
					border-color: rgba(40, 167, 69, 0.3);
				}
				
				/* Grid Container Fixes */
				.row.g-4 {
					display: grid;
					grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
					gap: 1.5rem;
					margin: 0;
				}
				
				.row.g-4 > .col-12,
				.row.g-4 > .col-md-6,
				.row.g-4 > .col-xl-4 {
					width: 100%;
					max-width: none;
					flex: none;
					padding: 0;
				}
				
				.card-header-gradient {
					background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
					padding: 20px;
					position: relative;
					overflow: hidden;
					min-height: 90px;
				}
				
				.card-header-gradient::before {
					content: '';
					position: absolute;
					top: 0;
					left: 0;
					right: 0;
					bottom: 0;
					background: url('data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><defs><pattern id="grid" width="10" height="10" patternUnits="userSpaceOnUse"><path d="M 10 0 L 0 0 0 10" fill="none" stroke="rgba(255,255,255,0.1)" stroke-width="0.5"/></pattern></defs><rect width="100" height="100" fill="url(%23grid)"/></svg>');
					opacity: 0.3;
				}
				
				.company-logo-section {
					position: relative;
					z-index: 2;
				}
				
				.company-avatar {
					width: 50px;
					height: 50px;
					min-width: 50px;
					min-height: 50px;
					background: linear-gradient(135deg, #fff, #f8f9fa);
					border-radius: 15px;
					display: flex;
					align-items: center;
					justify-content: center;
					box-shadow: 0 4px 15px rgba(0, 0, 0, 0.1);
					border: 2px solid rgba(255, 255, 255, 0.9);
				}
				
				.company-initial {
					font-size: 18px;
					font-weight: 700;
					color: #667eea;
					text-transform: uppercase;
				}
				
				.job-type-modern {
					position: relative;
					z-index: 2;
				}
				
				.job-type-badge {
					padding: 8px 16px;
					border-radius: 25px;
					font-size: 12px;
					font-weight: 600;
					text-transform: uppercase;
					letter-spacing: 0.5px;
					border: 2px solid rgba(255, 255, 255, 0.9);
					backdrop-filter: blur(10px);
				}
				
				.job-type-badge.full-time {
					background: rgba(40, 167, 69, 0.9);
					color: white;
					border-color: rgba(40, 167, 69, 0.3);
				}
				
				.job-type-badge.internship {
					background: rgba(23, 162, 184, 0.9);
					color: white;
					border-color: rgba(23, 162, 184, 0.3);
				}
				
				.job-type-badge.part-time {
					background: rgba(255, 193, 7, 0.9);
					color: #333;
					border-color: rgba(255, 193, 7, 0.3);
				}
				
				.job-type-badge.other {
					background: rgba(108, 117, 125, 0.9);
					color: white;
					border-color: rgba(108, 117, 125, 0.3);
				}
				
				.card-content-modern {
					padding: 24px;
					flex-grow: 1;
					display: flex;
					flex-direction: column;
				}
				
				.job-title-section {
					margin-bottom: 20px;
				}
				
				.job-title {
					font-size: 20px;
					font-weight: 700;
					color: #2d3748;
					margin: 0 0 8px 0;
					line-height: 1.3;
					letter-spacing: -0.02em;
				}
				
				.company-name {
					font-size: 14px;
					color: #718096;
					margin: 0;
					font-weight: 500;
				}
				
				.job-info-grid {
					display: grid;
					grid-template-columns: 1fr 1fr;
					gap: 12px;
					margin-bottom: 20px;
				}
				
				.info-item {
					display: flex;
					align-items: center;
					gap: 8px;
				}
				
				.info-icon {
					width: 32px;
					height: 32px;
					border-radius: 10px;
					display: flex;
					align-items: center;
					justify-content: center;
					font-size: 14px;
				}
				
				.info-icon.location {
					background: linear-gradient(135deg, #ff9a56, #ff6b6b);
					color: white;
				}
				
				.info-icon.deadline {
					background: linear-gradient(135deg, #4ecdc4, #44a08d);
					color: white;
				}
				
				.info-text {
					font-size: 13px;
					color: #4a5568;
					font-weight: 500;
				}
				
				.tech-stack-section {
					margin-bottom: 24px;
					flex-grow: 1;
				}
				
				.tech-chips {
					display: flex;
					flex-wrap: wrap;
					gap: 6px;
				}
				
				.tech-chip {
					background: linear-gradient(135deg, #f7fafc, #e2e8f0);
					color: #4a5568;
					padding: 6px 12px;
					border-radius: 12px;
					font-size: 11px;
					font-weight: 600;
					border: 1px solid rgba(226, 232, 240, 0.8);
					transition: all 0.2s ease;
				}
				
				.tech-chip:hover {
					background: linear-gradient(135deg, #667eea, #764ba2);
					color: white;
					transform: translateY(-1px);
				}
				
				.tech-chip.more-count {
					background: linear-gradient(135deg, #667eea, #764ba2);
					color: white;
					border-color: transparent;
				}
				
				.action-section {
					display: grid;
					grid-template-columns: 1fr 2fr;
					gap: 12px;
					margin-top: auto;
				}
				
				.btn-modern {
					border: none;
					border-radius: 12px;
					padding: 12px 16px;
					font-weight: 600;
					font-size: 13px;
					display: flex;
					align-items: center;
					justify-content: center;
					gap: 6px;
					transition: all 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275);
					cursor: pointer;
					text-transform: uppercase;
					letter-spacing: 0.5px;
				}
				
				.btn-modern.secondary {
					background: linear-gradient(135deg, #f7fafc, #e2e8f0);
					color: #4a5568;
					border: 1px solid rgba(226, 232, 240, 0.8);
				}
				
				.btn-modern.secondary:hover {
					background: linear-gradient(135deg, #e2e8f0, #cbd5e0);
					transform: translateY(-2px);
					box-shadow: 0 8px 25px rgba(0, 0, 0, 0.1);
				}
				
				.btn-modern.primary {
					background: linear-gradient(135deg, #667eea, #764ba2);
					color: white;
					box-shadow: 0 4px 15px rgba(102, 126, 234, 0.3);
				}
				
				.btn-modern.primary:hover:not(:disabled) {
					background: linear-gradient(135deg, #5a67d8, #6b46c1);
					transform: translateY(-2px);
					box-shadow: 0 8px 30px rgba(102, 126, 234, 0.4);
				}
				
				.btn-modern.primary.applied {
					background: linear-gradient(135deg, #48bb78, #38a169);
					box-shadow: 0 4px 15px rgba(72, 187, 120, 0.3);
				}
				
				.btn-modern:disabled {
					opacity: 0.7;
					cursor: not-allowed;
					transform: none !important;
				}
				
				.btn-spinner {
					width: 14px;
					height: 14px;
					border: 2px solid rgba(255, 255, 255, 0.3);
					border-radius: 50%;
					border-top-color: white;
					animation: spin 1s ease-in-out infinite;
				}
				
				@keyframes spin {
					to { transform: rotate(360deg); }
				}
				
				/* Responsive adjustments */
				@media (max-width: 768px) {
					.row.g-4 {
						grid-template-columns: 1fr;
						gap: 1rem;
					}
					
					.modern-job-card {
						min-width: 260px;
						max-width: 100%;
					}
					
					.job-info-grid {
						grid-template-columns: 1fr;
						gap: 8px;
					}
					
					.action-section {
						grid-template-columns: 1fr;
						gap: 8px;
					}
					
					.card-content-modern {
						padding: 20px;
					}
					
					.card-header-gradient {
						padding: 16px;
						min-height: 80px;
					}
					
					.company-avatar {
						width: 40px;
						height: 40px;
						min-width: 40px;
						min-height: 40px;
					}
					
					.company-initial {
						font-size: 16px;
					}
				}
				
				@media (min-width: 769px) and (max-width: 1024px) {
					.row.g-4 {
						grid-template-columns: repeat(2, 1fr);
						gap: 1.25rem;
					}
				}
				
				@media (min-width: 1025px) and (max-width: 1400px) {
					.row.g-4 {
						grid-template-columns: repeat(3, 1fr);
						gap: 1.5rem;
					}
				}
				
				@media (min-width: 1401px) {
					.row.g-4 {
						grid-template-columns: repeat(4, 1fr);
						gap: 1.5rem;
					}
					
					.modern-job-card {
						max-width: 350px;
					}
				}
				
				/* Zoom level specific fixes */
				@media (min-resolution: 125dpi) {
					.modern-job-card {
						min-width: 320px;
					}
				}
				
				@media (min-resolution: 150dpi) {
					.modern-job-card {
						min-width: 340px;
					}
				}
				
				/* High zoom levels (browser zoom > 150%) */
				@media screen and (max-width: 1600px) and (min-width: 1200px) {
					.row.g-4 {
						grid-template-columns: repeat(auto-fit, minmax(320px, 1fr));
						gap: 1.5rem;
					}
				}
				
				/* Ultra-wide screens */
				@media (min-width: 1920px) {
					.row.g-4 {
						grid-template-columns: repeat(5, 1fr);
						max-width: 1800px;
						margin: 0 auto;
					}
				}
				
				/* Navigation Styles */
				.nav-pills .nav-link {
					border-radius: 8px !important;
					font-weight: 500;
					transition: all 0.3s ease;
					border: 1px solid transparent;
				}
				
				.nav-pills .nav-link:hover:not(.active) {
					background-color: #f8f9fa;
					border-color: #dee2e6;
				}
				
				.stats-card {
					background: linear-gradient(135deg, #28a745, #20c997);
					border: none;
					color: white;
				}
				
				.collapse-toggle {
					transition: all 0.3s ease;
				}
				
				.collapse-toggle:hover {
					background-color: #e9ecef !important;
				}
				
				.collapse-toggle[aria-expanded="true"] i {
					transform: rotate(180deg);
				}
				
				.collapse-toggle i {
					transition: transform 0.3s ease;
				}
				
				.badge {
					font-weight: 500;
					letter-spacing: 0.3px;
				}
				
				.modal-content {
					border: none;
					border-radius: 16px;
					box-shadow: 0 20px 60px rgba(0, 0, 0, 0.15);
				}
				
				.modal-header {
					border-radius: 16px 16px 0 0;
				}
				
				.modal-footer {
					border-radius: 0 0 16px 16px;
				}
				
				.form-control:focus {
					border-color: #28a745;
					box-shadow: 0 0 0 0.2rem rgba(40, 167, 69, 0.25);
				}
				
				.form-select:focus {
					border-color: #28a745;
					box-shadow: 0 0 0 0.2rem rgba(40, 167, 69, 0.25);
				}
				
				@media (max-width: 768px) {
					.modal-dialog {
						margin: 0.5rem;
					}
					
					.modal-lg {
						max-width: calc(100vw - 1rem);
					}
				}
				
				.user-avatar {
					width: 48px;
					height: 48px;
					background: linear-gradient(135deg, #28a745, #20c997);
					border: 3px solid white;
					box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
				}
				
				.btn-primary {
					background-color: #28a745;
					border-color: #28a745;
				}
				
				.btn-primary:hover {
					background-color: #218838;
					border-color: #1e7e34;
				}
				
				.btn-outline-primary {
					color: #28a745;
					border-color: #28a745;
				}
				
				.btn-outline-primary:hover {
					background-color: #28a745;
					border-color: #28a745;
				}
				
				.text-primary {
					color: #28a745 !important;
				}
				
				.bg-success {
					background-color: #28a745 !important;
				}
				
				.table-hover tbody tr:hover {
					background-color: rgba(40, 167, 69, 0.05);
				}
			`}</style>
		</div>
	);
};

export default StudentDashboard;
