const router = require("express").Router();
const mongoose = require("mongoose");
const User = require("../models/User");
const JobPosting = require("../models/Posting");
const Application = require("../models/Application");
const OTP = require("../models/OTP");
const { authMiddleware } = require("../config/jwt");

router.post("/register", async (req, res) => {
	try {
		const { companyName, email, hrName, address, password } = req.body;

		// Validation
		if (!companyName || !email || !hrName || !address || !password) {
			return res
				.status(400)
				.json({ message: "Please fill in all required fields" });
		}

		if (password.length < 6) {
			return res
				.status(400)
				.json({ message: "Password must be at least 6 characters" });
		}

		const emailLower = email.trim().toLowerCase();

		// Check if email already exists
		const existingUser = await User.findOne({ email: emailLower });
		if (existingUser) {
			return res
				.status(400)
				.json({ message: "Email has already been registered" });
		}

		// Check if there's a recently verified OTP for this email (within last 10 minutes)
		const recentlyVerifiedOTP = await OTP.findOne({
			email: emailLower,
			purpose: 'registration',
			isUsed: true,
			createdAt: { $gt: new Date(Date.now() - 10 * 60 * 1000) } // Last 10 minutes
		}).sort({ createdAt: -1 });

		if (!recentlyVerifiedOTP) {
			return res.status(400).json({
				message: "Please verify your email with OTP first"
			});
		}

		// Create new company user with verified email
		const user = new User({
			email: emailLower,
			userType: "company",
			isVerified: true, // Mark as verified since OTP was successful
			applicationStatus: "pending",
			companyProfile: {
				companyName: companyName.trim(),
				hrName: hrName.trim(),
				hrEmail: emailLower,
				address: address.trim(),
			},
		});

		await user.setPassword(password);
		await user.save();

		res.status(201).json({
			message: "Company registered successfully. Waiting for admin approval.",
			user: {
				id: user._id,
				companyName: user.companyProfile.companyName,
				email: user.email,
				hrName: user.companyProfile.hrName,
				userType: user.userType,
				isVerified: user.isVerified,
				applicationStatus: user.applicationStatus,
			},
		});
	} catch (error) {
		console.error("Company registration error:", error);
		res.status(500).json({ message: "Registration failed" });
	}
});


// Create job posting
router.post("/postings", authMiddleware, async (req, res) => {
	try {
		const {
			title,
			description,
			technology,
			jobType,
			location,
			applicationDeadline,
			salary,
			stipend,
			bond,
		} = req.body;

		// Validation
		if (
			!title ||
			!description ||
			!technology ||
			!jobType ||
			!location ||
			!applicationDeadline
		) {
			return res
				.status(400)
				.json({ message: "Please fill in all required fields" });
		}

		// Get company user
		const user = await User.findById(req.user.id);
		if (!user || user.userType !== "company") {
			return res.status(404).json({ message: "Company not found" });
		}

		// Create posting
		const posting = new JobPosting({
			companyId: user._id,
			title: title.trim(),
			description: description.trim(),
			technology: Array.isArray(technology) ? technology : [technology],
			jobType,
			location: location.trim(),
			applicationDeadline: new Date(applicationDeadline),
			salary,
			stipend,
			bond,
			minCGPA: req.body.minCGPA,
		});

		await posting.save();

		// Populate company details for response
		await posting.populate(
			"companyId",
			"companyProfile.companyName companyProfile.hrName"
		);

		res.status(201).json({
			message: "Job posting created successfully",
			posting,
		});
	} catch (error) {
		console.error("Create posting error:", error);
		res.status(500).json({ message: "Error creating job posting" });
	}
});

// Get company's job postings
router.get("/postings", authMiddleware, async (req, res) => {
	try {
		// First, update any jobs that should be expired
		await JobPosting.updateMany(
			{
				companyId: req.user.id,
				status: "Active",
				applicationDeadline: { $lt: new Date() }
			},
			{ status: "Expired" }
		);

		// Then fetch the updated postings
		const postings = await JobPosting.find({ companyId: req.user.id })
			.sort({ createdAt: -1 })
			.populate("companyId", "companyProfile.companyName");

		res.json(postings);
	} catch (error) {
		res.status(500).json({ message: "Error fetching job postings" });
	}
});

// Refresh job postings status (update expired jobs)
router.post("/refresh-postings", authMiddleware, async (req, res) => {
	try {
		// Update expired jobs for this company
		const result = await JobPosting.updateMany(
			{
				companyId: req.user.id,
				status: "Active",
				applicationDeadline: { $lt: new Date() }
			},
			{ status: "Expired" }
		);

		res.json({
			message: "Job postings refreshed successfully",
			updatedCount: result.modifiedCount
		});
	} catch (error) {
		res.status(500).json({ message: "Error refreshing job postings" });
	}
});


// Get applications for company's job postings
router.get("/applications", authMiddleware, async (req, res) => {
	try {
		const applications = await Application.find({ companyId: req.user.id })
			.populate(
				"userId",
				"studentProfile.name email"
			)
			.populate("jobId", "title technology jobType applicationDeadline")
			.sort({ createdAt: -1 });

		res.json(applications);
	} catch (error) {
		res.status(500).json({ message: "Error fetching applications" });
	}
});

// Get candidates for selected job and interview round
router.get("/rounds/candidates", authMiddleware, async (req, res) => {
	try {
		const { jobId, round = "1" } = req.query;
		const parsedRound = parseInt(round, 10);

		if (!jobId) {
			return res.status(400).json({ message: "jobId is required" });
		}
		if (Number.isNaN(parsedRound) || parsedRound < 1 || parsedRound > 4) {
			return res.status(400).json({ message: "round must be between 1 and 4" });
		}

		const roundFilter =
			parsedRound === 1
				? { $or: [{ interviewRound: { $gte: 1 } }, { interviewRound: { $exists: false } }] }
				: { interviewRound: { $gte: parsedRound } };

		const candidates = await Application.find({
			companyId: req.user.id,
			jobId,
			...roundFilter,
		})
			.populate("userId", "studentProfile.name email")
			.populate("jobId", "title")
			.sort({ createdAt: 1 });

		res.json({
			jobId,
			round: parsedRound,
			total: candidates.length,
			candidates,
		});
	} catch (error) {
		console.error("Round candidates error:", error);
		res.status(500).json({ message: "Error fetching round candidates" });
	}
});

// Promote selected candidates to next interview round
router.post("/rounds/promote", authMiddleware, async (req, res) => {
	try {
		const { jobId, fromRound, applicationIds } = req.body;
		const parsedFromRound = parseInt(fromRound, 10);

		if (!jobId) {
			return res.status(400).json({ message: "jobId is required" });
		}
		if (Number.isNaN(parsedFromRound) || parsedFromRound < 1 || parsedFromRound > 3) {
			return res.status(400).json({ message: "fromRound must be between 1 and 3" });
		}
		if (!Array.isArray(applicationIds) || applicationIds.length === 0) {
			return res.status(400).json({ message: "Select at least one student" });
		}

		const roundFilter =
			parsedFromRound === 1
				? { $or: [{ interviewRound: 1 }, { interviewRound: { $exists: false } }] }
				: { interviewRound: parsedFromRound };

		const result = await Application.updateMany(
			{
				companyId: req.user.id,
				jobId,
				_id: { $in: applicationIds },
				...roundFilter,
			},
			{
				$set: { interviewRound: parsedFromRound + 1 },
			}
		);

		res.json({
			message: `Selected students moved to Round ${parsedFromRound + 1}`,
			updatedCount: result.modifiedCount,
		});
	} catch (error) {
		console.error("Round promotion error:", error);
		res.status(500).json({ message: "Error saving round selections" });
	}
});

// Get round-wise summary for each job (or selected job)
router.get("/rounds/summary", authMiddleware, async (req, res) => {
	try {
		const { jobId, round = "all" } = req.query;
		const matchFilter = {
			companyId: new mongoose.Types.ObjectId(req.user.id),
		};
		if (jobId && mongoose.Types.ObjectId.isValid(jobId)) {
			matchFilter.jobId = new mongoose.Types.ObjectId(jobId);
		}
		const parsedRound = round === "all" ? null : parseInt(round, 10);
		if (parsedRound !== null && (Number.isNaN(parsedRound) || parsedRound < 1 || parsedRound > 4)) {
			return res.status(400).json({ message: "round must be all or between 1 and 4" });
		}

		const summaryRows = await Application.aggregate([
			{ $match: matchFilter },
			{
				$addFields: {
					normalizedRound: { $ifNull: ["$interviewRound", 1] },
				},
			},
			...(parsedRound ? [{ $match: { normalizedRound: parsedRound } }] : []),
			{
				$group: {
					_id: {
						jobId: "$jobId",
						round: "$normalizedRound",
					},
					count: { $sum: 1 },
				},
			},
			{
				$lookup: {
					from: "jobpostings",
					localField: "_id.jobId",
					foreignField: "_id",
					as: "job",
				},
			},
			{ $unwind: { path: "$job", preserveNullAndEmptyArrays: true } },
			{
				$project: {
					_id: 0,
					jobId: "$_id.jobId",
					jobTitle: "$job.title",
					round: "$_id.round",
					count: 1,
				},
			},
			{ $sort: { jobTitle: 1, round: 1 } },
		]);

		const byJob = new Map();
		for (const row of summaryRows) {
			const key = String(row.jobId);
			if (!byJob.has(key)) {
				byJob.set(key, {
					jobId: row.jobId,
					jobTitle: row.jobTitle || "N/A",
					round1: 0,
					round2: 0,
					round3: 0,
					round4: 0,
					total: 0,
				});
			}
			const item = byJob.get(key);
			if (row.round === 1) item.round1 = row.count;
			if (row.round === 2) item.round2 = row.count;
			if (row.round === 3) item.round3 = row.count;
			if (row.round >= 4) item.round4 += row.count;
			item.total += row.count;
		}

		const rows = Array.from(byJob.values());
		const totals = rows.reduce(
			(acc, r) => {
				acc.round1 += r.round1;
				acc.round2 += r.round2;
				acc.round3 += r.round3;
				acc.round4 += r.round4;
				acc.total += r.total;
				return acc;
			},
			{ round1: 0, round2: 0, round3: 0, round4: 0, total: 0 }
		);

		res.json({
			rows,
			totals,
		});
	} catch (error) {
		console.error("Round summary error:", error);
		res.status(500).json({ message: "Error fetching round summary" });
	}
});

// Get student-wise round matrix for a selected job
router.get("/rounds/student-matrix", authMiddleware, async (req, res) => {
	try {
		const { jobId } = req.query;
		if (!jobId || !mongoose.Types.ObjectId.isValid(jobId)) {
			return res.status(400).json({ message: "Valid jobId is required" });
		}

		const applications = await Application.find({
			companyId: req.user.id,
			jobId: new mongoose.Types.ObjectId(jobId),
		})
			.populate("userId", "email")
			.sort({ createdAt: 1 });

		const rows = applications.map((app) => {
			const reachedRound = Number(app.interviewRound || 1);
			return {
				applicationId: app._id,
				studentEmail: app.userId?.email || "N/A",
				round1: reachedRound >= 1 ? "Yes" : "No",
				round2: reachedRound >= 2 ? "Yes" : "No",
				round3: reachedRound >= 3 ? "Yes" : "No",
				finalRound: reachedRound >= 4 ? "Yes" : "No",
			};
		});

		const totals = rows.reduce(
			(acc, r) => {
				if (r.round1 === "Yes") acc.round1 += 1;
				if (r.round2 === "Yes") acc.round2 += 1;
				if (r.round3 === "Yes") acc.round3 += 1;
				if (r.finalRound === "Yes") acc.finalRound += 1;
				return acc;
			},
			{ round1: 0, round2: 0, round3: 0, finalRound: 0 }
		);

		res.json({ rows, totals });
	} catch (error) {
		console.error("Student matrix error:", error);
		res.status(500).json({ message: "Error fetching student round matrix" });
	}
});

// === REPORTING & ANALYTICS ROUTES ===

// Get hiring analytics report
router.get("/reports/hiring-analytics", authMiddleware, async (req, res) => {
	try {
		const companyId = req.user.id;
		const { startDate, endDate, jobId } = req.query;

		// Build date filter
		const dateFilter = {};
		if (startDate) dateFilter.$gte = new Date(startDate);
		if (endDate) dateFilter.$lte = new Date(endDate);

		const matchFilter = { companyId };
		if (startDate || endDate) {
			matchFilter.createdAt = dateFilter;
		}

		// Add job-specific filter if jobId is provided
		if (jobId) {
			matchFilter.jobId = jobId;
		}

		// Job postings filter: company + optional specific job (no date filter - show all jobs)
		const jobPostingFilter = { companyId };
		if (jobId) {
			jobPostingFilter._id = jobId;
		}

		// Get comprehensive analytics
		const [
			totalJobs,
			totalApplications,
			applicationsByStatus,
			applicationsByJob,
			jobsByStatus,
			recentActivity
		] = await Promise.all([
			// Total job postings (filtered by specific job and date range if provided)
			JobPosting.countDocuments(jobPostingFilter),

			// Total applications
			Application.countDocuments(matchFilter),

			// Applications by status
			Application.aggregate([
				{ $match: matchFilter },
				{ $group: { _id: "$status", count: { $sum: 1 } } }
			]),

			// Applications per job
			Application.aggregate([
				{ $match: matchFilter },
				{
					$lookup: {
						from: "jobpostings",
						localField: "jobId",
						foreignField: "_id",
						as: "job"
					}
				},
				{ $unwind: "$job" },
				{
					$group: {
						_id: "$jobId",
						jobTitle: { $first: "$job.title" },
						applicationCount: { $sum: 1 },
						statuses: { $push: "$status" }
					}
				},
				{ $sort: { applicationCount: -1 } }
			]),

			// Jobs by status (filtered by specific job and date range if provided)
			JobPosting.aggregate([
				{ $match: jobPostingFilter },
				{ $group: { _id: "$status", count: { $sum: 1 } } }
			]),

			// Recent activity (last 30 days)
			Application.find(matchFilter)
				.populate("userId", "studentProfile.name email")
				.populate("jobId", "title")
				.sort({ createdAt: -1 })
				.limit(20)
		]);

		// Calculate conversion rates
		const activeJobs = jobsByStatus.find(j => j._id === "Active")?.count || 0;
		const averageApplicationsPerJob = totalJobs > 0 ? (totalApplications / totalJobs).toFixed(1) : 0;

		const analytics = {
			summary: {
				totalJobs,
				totalApplications,
				activeJobs,
				averageApplicationsPerJob
			},
			applicationsByStatus,
			applicationsByJob,
			jobsByStatus,
			recentActivity,
			generatedAt: new Date(),
			dateRange: { startDate, endDate }
		};

		res.json(analytics);
	} catch (error) {
		console.error("Hiring analytics error:", error);
		res.status(500).json({ message: "Error generating hiring analytics" });
	}
});

// Get application timeline report
router.get("/reports/application-timeline", authMiddleware, async (req, res) => {
	try {
		const companyId = req.user.id;
		const { period = "30" } = req.query; // days

		const startDate = new Date();
		startDate.setDate(startDate.getDate() - parseInt(period));

		const timeline = await Application.aggregate([
			{
				$match: {
					companyId,
					createdAt: { $gte: startDate }
				}
			},
			{
				$group: {
					_id: {
						$dateToString: {
							format: "%Y-%m-%d",
							date: "$createdAt"
						}
					},
					applications: { $sum: 1 },
					statuses: { $push: "$status" }
				}
			},
			{
				$addFields: {
					applied: {
						$size: {
							$filter: {
								input: "$statuses",
								cond: { $eq: ["$$this", "Applied"] }
							}
						}
					},
					reviewed: {
						$size: {
							$filter: {
								input: "$statuses",
								cond: { $eq: ["$$this", "Reviewed"] }
							}
						}
					},
					selected: {
						$size: {
							$filter: {
								input: "$statuses",
								cond: { $eq: ["$$this", "Selected"] }
							}
						}
					},
					rejected: {
						$size: {
							$filter: {
								input: "$statuses",
								cond: { $eq: ["$$this", "Rejected"] }
							}
						}
					}
				}
			},
			{ $sort: { _id: 1 } }
		]);

		res.json({
			timeline,
			period: parseInt(period),
			generatedAt: new Date()
		});
	} catch (error) {
		console.error("Application timeline error:", error);
		res.status(500).json({ message: "Error generating application timeline" });
	}
});

// Export candidate data
router.get("/reports/candidates-export", authMiddleware, async (req, res) => {
	try {
		const companyId = req.user.id;
		const { format = "json", jobId, status, dateRange, jobStatus } = req.query;

		const matchFilter = { companyId };
		if (jobId) matchFilter.jobId = jobId;
		if (status) matchFilter.status = status;

		// Add date range filter
		if (dateRange) {
			const days = parseInt(dateRange);
			if (!isNaN(days)) {
				const startDate = new Date();
				startDate.setDate(startDate.getDate() - days);
				matchFilter.createdAt = { $gte: startDate };
			}
		}

		// Add job status filter - need to populate and filter jobs by status
		let jobFilter = {};
		if (jobStatus) {
			jobFilter.status = jobStatus;
		}

		const candidates = await Application.find(matchFilter)
			.populate("userId", "studentProfile.name email studentProfile.studentId")
			.populate({
				path: "jobId",
				select: "title technology jobType location applicationDeadline status",
				match: jobFilter // This will filter jobs by status
			})
			.sort({ createdAt: -1 });

		// Filter out applications where jobId is null (due to jobStatus filter)
		const filteredCandidates = candidates.filter(app => app.jobId);

		// Transform data for export (column order: ... Location, Last Sem, Last Sem CGPA, Resume Link, ...)
		const exportData = filteredCandidates.map(app => ({
			CandidateName: app.userId?.studentProfile?.name || "N/A",
			Email: app.userId?.email || "N/A",
			JobTitle: app.jobId?.title || "N/A",
			JobType: app.jobId?.jobType || "N/A",
			Technologies: app.jobId?.technology?.join(", ") || "N/A",
			Location: app.jobId?.location || "N/A",
			LastSem: app.lastSemester || "N/A",
			LastSemCGPA: app.lastSemesterCGPA || "N/A",
			ResumePath: app.resume || "", // path only; client will build full Resume Link URL
			ApplicationDate: new Date(app.createdAt).toLocaleDateString("en-US"),
			ApplicationStatus: app.status,
			JobDeadline: new Date(app.jobId?.applicationDeadline).toLocaleDateString("en-US")
		}));

		res.json({
			candidates: exportData,
			totalCount: exportData.length,
			filters: { jobId, status, dateRange, jobStatus },
			generatedAt: new Date()
		});
	} catch (error) {
		console.error("Candidates export error:", error);
		res.status(500).json({ message: "Error exporting candidate data" });
	}
});


module.exports = router;