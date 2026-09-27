const path = require("path");
const router = require("express").Router();
const multer = require("multer");
const JobPosting = require("../models/Posting");
const Application = require("../models/Application");
const User = require("../models/User");
const { authMiddleware } = require("../config/jwt");

function parseStudentCgpa(raw) {
	if (raw == null || raw === "") return NaN;
	const s = String(raw).trim().replace(/,/g, ".");
	const n = parseFloat(s);
	return Number.isFinite(n) ? n : NaN;
}

// Resume upload: PNG, PDF, Word (doc, docx)
const resumeStorage = multer.diskStorage({
	destination: (req, file, cb) => {
		cb(null, path.join(__dirname, "..", "uploads", "resumes"));
	},
	filename: (req, file, cb) => {
		const ext = path.extname(file.originalname) || ".pdf";
		const safeName = `${Date.now()}-${Math.random().toString(36).slice(2, 9)}${ext}`;
		cb(null, safeName);
	},
});
const resumeFileFilter = (req, file, cb) => {
	const allowed = [
		"image/png",
		"application/pdf",
		"application/msword", // .doc
		"application/vnd.openxmlformats-officedocument.wordprocessingml.document", // .docx
	];
	const allowedExt = [".png", ".pdf", ".doc", ".docx"];
	const ext = path.extname(file.originalname).toLowerCase();
	if (allowed.includes(file.mimetype) || allowedExt.includes(ext)) {
		cb(null, true);
	} else {
		cb(new Error("Only PNG, PDF, and Word (DOC/DOCX) files are allowed"), false);
	}
};
const uploadResume = multer({
	storage: resumeStorage,
	fileFilter: resumeFileFilter,
	limits: { fileSize: 10 * 1024 * 1024 }, // 10 MB
});

// Get all active job postings
router.get("/", authMiddleware, async (req, res) => {
	try {
		// First, update any jobs that should be expired
		await JobPosting.updateMany(
			{
				status: "Active",
				applicationDeadline: { $lt: new Date() }
			},
			{ status: "Expired" }
		);

		const {
			technology,
			jobType,
			location,
			page = 1,
			limit = 10,
		} = req.query;

		// Build filter query (exclude admin-hidden postings from student catalog)
		const filter = {
			status: "Active",
			applicationDeadline: { $gt: new Date() },
			hiddenFromStudents: { $ne: true },
		};

		if (technology) {
			filter.technology = {
				$in: Array.isArray(technology) ? technology : [technology],
			};
		}
		if (jobType) filter.jobType = jobType;
		if (location) filter.location = new RegExp(location, "i");

		const jobs = await JobPosting.find(filter)
			.populate(
				"companyId",
				"companyProfile.companyName companyProfile.hrName companyProfile.address "
			)
			.sort({ createdAt: -1 })
			.limit(limit * 1)
			.skip((page - 1) * limit);

		const total = await JobPosting.countDocuments(filter);

		res.json({
			jobs,
			totalPages: Math.ceil(total / limit),
			currentPage: page,
			total,
		});
	} catch (error) {
		res.status(500).json({ message: "Error fetching jobs" });
	}
});



// Check application status for a job
router.get("/:jobId/status", authMiddleware, async (req, res) => {
	try {
		const application = await Application.findOne({
			userId: req.user.id,
			jobId: req.params.jobId,
		});

		res.json({
			hasApplied: !!application,
			status: application?.status || null,
			applicationId: application?._id || null,
		});
	} catch (error) {
		res.status(500).json({ message: "Error checking application status" });
	}
});

// Conditional multer: only parse multipart for file upload; skip for JSON (profile resume path)
const applyUploadMiddleware = (req, res, next) => {
	const contentType = req.headers["content-type"] || "";
	if (contentType.includes("multipart/form-data")) {
		uploadResume.single("resume")(req, res, next);
	} else {
		next();
	}
};

// Apply for a job (with resume file upload: PNG, PDF, Word) or JSON (profile resume path)
router.post(
	"/:jobId/apply",
	authMiddleware,
	applyUploadMiddleware,
	async (req, res) => {
		try {
			const { jobId } = req.params;
			const { lastSemester, lastSemesterCGPA, resume: resumeFromProfile, expectedSalary, availableFrom } = req.body;
			const resumeFile = req.file;

			// Required: lastSemester, lastSemesterCGPA; resume: either uploaded file OR path from profile
			if (!lastSemester || !lastSemesterCGPA) {
				return res.status(400).json({
					message: "Last semester and last semester CGPA are required. Please complete your profile first.",
				});
			}
			let resumePath;
			if (resumeFile) {
				const uploadsDir = path.join(__dirname, "..", "uploads");
				resumePath = path.relative(uploadsDir, resumeFile.path);
			} else if (resumeFromProfile && typeof resumeFromProfile === "string" && resumeFromProfile.trim()) {
				resumePath = resumeFromProfile.trim();
			} else {
				return res.status(400).json({
					message: "Resume is required. Please add a resume to your profile first.",
				});
			}

			// Check if already applied
			const existingApplication = await Application.findOne({
				userId: req.user.id,
				jobId: jobId,
			});

			if (existingApplication) {
				return res
					.status(400)
					.json({ message: "You have already applied to this job" });
			}

			// Get student and job details
			const user = await User.findById(req.user.id);
			if (!user || user.userType !== "student") {
				return res.status(404).json({ message: "Student not found" });
			}

			const job = await JobPosting.findById(jobId).populate("companyId");
			if (!job) {
				return res.status(404).json({ message: "Job not found" });
			}

			// Check if job is still accepting applications
			if (!job.isApplicationOpen()) {
				return res
					.status(400)
					.json({ message: "This job is no longer accepting applications" });
			}

			if (
				job.minCGPA != null &&
				typeof job.minCGPA === "number" &&
				!job.cgpaRequirementWaived
			) {
				const cgpa = parseStudentCgpa(lastSemesterCGPA);
				if (!Number.isFinite(cgpa) || cgpa + 1e-9 < job.minCGPA) {
					return res.status(400).json({
						message: `This role requires minimum CGPA of ${job.minCGPA}. Your application CGPA does not meet the requirement.`,
					});
				}
			}

			// Create application (resume stored as path: resumes/filename.ext)
			const application = new Application({
				userId: user._id,
				jobId: job._id,
				companyId: job.companyId._id,
				lastSemester: lastSemester.trim(),
				lastSemesterCGPA: lastSemesterCGPA.trim(),
				resume: resumePath,
				expectedSalary,
				availableFrom: availableFrom ? new Date(availableFrom) : null,
			});

			await application.save();

			// Update application count in job posting
			await JobPosting.findByIdAndUpdate(jobId, {
				$inc: { applicationCount: 1 },
			});

			res.status(201).json({
				message: "Application submitted successfully",
				application,
			});
		} catch (error) {
			if (error.message && error.message.includes("Only PNG, PDF")) {
				return res.status(400).json({ message: error.message });
			}
			if (error.code === "LIMIT_FILE_SIZE") {
				return res.status(400).json({ message: "Resume file must be under 10 MB" });
			}
			console.error("Apply job error:", error);
			res.status(500).json({ message: "Error submitting application" });
		}
	}
);


module.exports = router;
