const router = require("express").Router();
const mongoose = require("mongoose");
const User = require("../models/User");
const JobPosting = require("../models/Posting");
const Application = require("../models/Application");
const { authMiddleware } = require("../config/jwt");

function adminOnly(req, res, next) {
	if (req.user?.role !== "admin") {
		return res.status(403).json({ message: "Admin access required" });
	}
	next();
}

router.get("/applications", authMiddleware, adminOnly, async (req, res) => {
	try {
		const { status = "pending", type = "all" } = req.query;
		const query = {};

		if (status !== "all") {
			query.applicationStatus = status;
		}

		if (type !== "all") {
			query.userType = type;
		} else {
			query.userType = { $in: ["student", "company"] };
		}

		const users = await User.find(query)
			.select(
				"email userType studentProfile.name studentProfile.studentId studentProfile.linkedCompanyUserId studentProfile.lastSemester studentProfile.lastSemesterCGPA studentProfile.address studentProfile.resume companyProfile.companyName companyProfile.companyId companyProfile.hrName companyProfile.address applicationStatus createdAt reviewedAt"
			)
			.populate({
				path: "studentProfile.linkedCompanyUserId",
				select: "email companyProfile.companyName",
			})
			.sort({ createdAt: -1 });

		return res.json(users);
	} catch (error) {
		console.error("Fetch applications error:", error);
		return res.status(500).json({ message: "Error fetching applications" });
	}
});

router.patch(
	"/applications/:userId",
	authMiddleware,
	adminOnly,
	async (req, res) => {
		try {
			const { userId } = req.params;
			const { action } = req.body;

			if (!["accept", "reject", "pending"].includes(action)) {
				return res.status(400).json({
					message: "Action must be accept, reject, or pending",
				});
			}

			const user = await User.findById(userId);
			if (!user || !["student", "company"].includes(user.userType)) {
				return res.status(404).json({ message: "Application not found" });
			}

			if (action === "accept") {
				user.applicationStatus = "accepted";
				user.reviewedAt = new Date();
			} else if (action === "reject") {
				user.applicationStatus = "rejected";
				user.reviewedAt = new Date();
			} else {
				user.applicationStatus = "pending";
				user.reviewedAt = null;
			}

			await user.save();

			const verb =
				action === "accept"
					? "accepted"
					: action === "reject"
						? "rejected"
						: "reset to pending";

			return res.json({
				message: `Registration ${verb}`,
				user: {
					id: user._id,
					email: user.email,
					userType: user.userType,
					applicationStatus: user.applicationStatus,
					reviewedAt: user.reviewedAt,
				},
			});
		} catch (error) {
			console.error("Update application error:", error);
			return res.status(500).json({ message: "Error updating application" });
		}
	}
);

router.get("/companies/accepted", authMiddleware, adminOnly, async (req, res) => {
	try {
		const companies = await User.find({
			userType: "company",
			applicationStatus: "accepted",
		})
			.select("email companyProfile.companyName")
			.sort({ "companyProfile.companyName": 1 })
			.lean();

		const rows = companies.map((c) => ({
			id: c._id,
			name: c.companyProfile?.companyName || "N/A",
			email: c.email,
		}));

		return res.json({ companies: rows });
	} catch (error) {
		console.error("Accepted companies list error:", error);
		return res.status(500).json({ message: "Error fetching companies" });
	}
});

router.patch(
	"/students/:studentId/linked-company",
	authMiddleware,
	adminOnly,
	async (req, res) => {
		try {
			const { studentId } = req.params;
			const { companyUserId } = req.body;

			if (!mongoose.Types.ObjectId.isValid(studentId)) {
				return res.status(400).json({ message: "Invalid student id" });
			}

			const student = await User.findById(studentId);
			if (!student || student.userType !== "student") {
				return res.status(404).json({ message: "Student not found" });
			}

			if (!companyUserId) {
				student.studentProfile.linkedCompanyUserId = null;
			} else {
				if (!mongoose.Types.ObjectId.isValid(companyUserId)) {
					return res.status(400).json({ message: "Invalid company id" });
				}
				const company = await User.findById(companyUserId);
				if (
					!company ||
					company.userType !== "company" ||
					company.applicationStatus !== "accepted"
				) {
					return res.status(400).json({
						message:
							"Company must exist and have an accepted registration before linking",
					});
				}
				student.studentProfile.linkedCompanyUserId = companyUserId;
			}

			await student.save();

			return res.json({
				message: companyUserId
					? "Student linked to company"
					: "Company link removed",
				studentId: student._id,
				linkedCompanyUserId: student.studentProfile.linkedCompanyUserId || null,
			});
		} catch (error) {
			console.error("Linked company update error:", error);
			return res.status(500).json({ message: "Error updating company link" });
		}
	}
);

router.get("/jobs", authMiddleware, adminOnly, async (req, res) => {
	try {
		const { status = "all", companyId: companyFilter } = req.query;
		const match = {};
		if (status !== "all" && ["Active", "Closed", "Expired"].includes(status)) {
			match.status = status;
		}
		if (
			companyFilter &&
			mongoose.Types.ObjectId.isValid(String(companyFilter))
		) {
			match.companyId = new mongoose.Types.ObjectId(String(companyFilter));
		}

		const jobs = await JobPosting.find(match)
			.populate("companyId", "companyProfile.companyName email")
			.sort({ createdAt: -1 })
			.lean();

		const jobIds = jobs.map((j) => j._id);
		let countMap = new Map();
		if (jobIds.length) {
			const counts = await Application.aggregate([
				{ $match: { jobId: { $in: jobIds } } },
				{ $group: { _id: "$jobId", count: { $sum: 1 } } },
			]);
			countMap = new Map(counts.map((c) => [String(c._id), c.count]));
		}

		const rows = jobs.map((j) => ({
			_id: j._id,
			title: j.title,
			jobType: j.jobType,
			location: j.location,
			status: j.status,
			applicationDeadline: j.applicationDeadline,
			minCGPA: j.minCGPA,
			cgpaRequirementWaived: !!j.cgpaRequirementWaived,
			hiddenFromStudents: !!j.hiddenFromStudents,
			applicationCount: countMap.get(String(j._id)) ?? 0,
			storedApplicationCount: j.applicationCount ?? 0,
			company: j.companyId
				? {
						id: j.companyId._id,
						name: j.companyId.companyProfile?.companyName || "N/A",
						email: j.companyId.email,
				  }
				: null,
			createdAt: j.createdAt,
		}));

		return res.json({ jobs: rows });
	} catch (error) {
		console.error("Admin jobs list error:", error);
		return res.status(500).json({ message: "Error fetching job postings" });
	}
});

router.patch("/jobs/:jobId", authMiddleware, adminOnly, async (req, res) => {
	try {
		const { jobId } = req.params;
		if (!mongoose.Types.ObjectId.isValid(jobId)) {
			return res.status(400).json({ message: "Invalid job id" });
		}

		const job = await JobPosting.findById(jobId);
		if (!job) {
			return res.status(404).json({ message: "Job not found" });
		}

		const prevStatus = job.status;
		const { hiddenFromStudents, cgpaRequirementWaived, status } = req.body;

		if (typeof hiddenFromStudents === "boolean") {
			job.hiddenFromStudents = hiddenFromStudents;
		}
		if (typeof cgpaRequirementWaived === "boolean") {
			job.cgpaRequirementWaived = cgpaRequirementWaived;
		}
		if (status !== undefined && status !== null) {
			if (!["Active", "Closed", "Expired"].includes(status)) {
				return res.status(400).json({
					message: "status must be Active, Closed, or Expired",
				});
			}
			job.status = status;
		}

		await job.save();

		let message = "Job posting updated";
		if (prevStatus !== "Closed" && job.status === "Closed") {
			message =
				"Job closed — it is removed from the student job board and no longer accepts applications.";
		} else if (prevStatus === "Closed" && job.status === "Active") {
			message = "Job reopened as Active (if the deadline is still valid, students can see it again).";
		}

		return res.json({
			message,
			job: {
				_id: job._id,
				title: job.title,
				status: job.status,
				hiddenFromStudents: !!job.hiddenFromStudents,
				cgpaRequirementWaived: !!job.cgpaRequirementWaived,
				applicationDeadline: job.applicationDeadline,
			},
		});
	} catch (error) {
		console.error("Admin job update error:", error);
		return res.status(500).json({ message: "Error updating job posting" });
	}
});

module.exports = router;
