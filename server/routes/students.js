const path = require("path");
const router = require("express").Router();
const multer = require("multer");
const User = require("../models/User");
const Application = require("../models/Application");
const OTP = require("../models/OTP");
const { authMiddleware } = require("../config/jwt");

// Profile avatar upload (images)
const profileAvatarStorage = multer.diskStorage({
	destination: (req, file, cb) => cb(null, path.join(__dirname, "..", "uploads", "profile", "avatars")),
	filename: (req, file, cb) => {
		const ext = path.extname(file.originalname) || ".jpg";
		cb(null, `${Date.now()}-${Math.random().toString(36).slice(2, 9)}${ext}`);
	},
});
const profileAvatarUpload = multer({
	storage: profileAvatarStorage,
	limits: { fileSize: 5 * 1024 * 1024 },
	fileFilter: (req, file, cb) => {
		const allowed = ["image/jpeg", "image/png", "image/gif", "image/webp"];
		if (allowed.includes(file.mimetype)) cb(null, true);
		else cb(new Error("Only JPEG, PNG, GIF, WebP images allowed"), false);
	},
}).single("profileImage");

// Profile resume upload (PDF, Word, PNG)
const profileResumeStorage = multer.diskStorage({
	destination: (req, file, cb) => cb(null, path.join(__dirname, "..", "uploads", "profile", "resumes")),
	filename: (req, file, cb) => {
		const ext = path.extname(file.originalname) || ".pdf";
		cb(null, `${Date.now()}-${Math.random().toString(36).slice(2, 9)}${ext}`);
	},
});
const profileResumeFilter = (req, file, cb) => {
	const allowed = ["image/png", "application/pdf", "application/msword", "application/vnd.openxmlformats-officedocument.wordprocessingml.document"];
	const ext = path.extname(file.originalname).toLowerCase();
	if (allowed.includes(file.mimetype) || [".png", ".pdf", ".doc", ".docx"].includes(ext)) cb(null, true);
	else cb(new Error("Only PNG, PDF, Word allowed"), false);
};
const profileResumeUpload = multer({
	storage: profileResumeStorage,
	fileFilter: profileResumeFilter,
	limits: { fileSize: 10 * 1024 * 1024 },
}).single("resume");

router.post("/register", async (req, res) => {
	try {
		const { name, email, password, confirmPassword } = req.body;

		// Validation
		if (!name || !email || !password) {
			return res
				.status(400)
				.json({ message: "Please fill in all required fields" });
		}

		if (password.length < 6) {
			return res
				.status(400)
				.json({ message: "Password must be at least 6 characters" });
		}

		if (confirmPassword && password !== confirmPassword) {
			return res.status(400).json({ message: "Passwords do not match" });
		}

		const emailLower = String(email).trim().toLowerCase();

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

		// Create new student user with verified email
		const user = new User({
			email: emailLower,
			userType: "student",
			isVerified: true, // Mark as verified since OTP was successful
			applicationStatus: "pending",
			studentProfile: {
				name: name.trim(),
			},
		});

		await user.setPassword(password);
		await user.save();

		res.status(201).json({
			message: "Student registered successfully. Waiting for admin approval.",
			user: {
				id: user._id,
				name: user.studentProfile.name,
				email: user.email,
				userType: user.userType,
				isVerified: user.isVerified,
				applicationStatus: user.applicationStatus,
			},
		});
	} catch (error) {
		console.error("Student registration error:", error);
		res.status(500).json({ message: "Registration failed" });
	}
});


// Get current student profile (explicit flat object so frontend always gets all fields)
router.get("/profile", authMiddleware, async (req, res) => {
	try {
		const user = await User.findById(req.user.id).select("email userType studentProfile");
		if (!user || user.userType !== "student") {
			return res.status(404).json({ message: "Student profile not found" });
		}
		const sp = user.studentProfile || {};
		res.json({
			email: user.email,
			name: sp.name ?? "",
			lastSemester: sp.lastSemester ?? "",
			lastSemesterCGPA: sp.lastSemesterCGPA ?? "",
			address: sp.address ?? "",
			resume: sp.resume ?? "",
			profileImage: sp.profileImage ?? "",
		});
	} catch (error) {
		console.error("Get profile error:", error);
		res.status(500).json({ message: "Error fetching profile" });
	}
});

// Update student profile (only update fields that are sent; others stay as in DB)
router.patch("/profile", authMiddleware, async (req, res) => {
	try {
		const user = await User.findById(req.user.id);
		if (!user || user.userType !== "student") {
			return res.status(404).json({ message: "Student not found" });
		}
		const updates = {};
		if (Object.prototype.hasOwnProperty.call(req.body, "lastSemester")) {
			updates["studentProfile.lastSemester"] = (req.body.lastSemester || "").trim();
		}
		if (Object.prototype.hasOwnProperty.call(req.body, "lastSemesterCGPA")) {
			updates["studentProfile.lastSemesterCGPA"] = (req.body.lastSemesterCGPA || "").trim();
		}
		if (Object.prototype.hasOwnProperty.call(req.body, "address")) {
			updates["studentProfile.address"] = (req.body.address || "").trim();
		}
		if (Object.prototype.hasOwnProperty.call(req.body, "resume")) {
			updates["studentProfile.resume"] = (req.body.resume || "").trim();
		}
		if (Object.prototype.hasOwnProperty.call(req.body, "profileImage")) {
			updates["studentProfile.profileImage"] = (req.body.profileImage || "").trim();
		}
		if (Object.keys(updates).length > 0) {
			await User.findByIdAndUpdate(req.user.id, { $set: updates });
		}
		const updated = await User.findById(req.user.id).select("email studentProfile");
		res.json({
			email: updated.email,
			...updated.studentProfile?.toObject?.(),
		});
	} catch (error) {
		console.error("Update profile error:", error);
		res.status(500).json({ message: "Error updating profile" });
	}
});

// Upload profile avatar; returns path for PATCH /profile
router.post("/profile/avatar", authMiddleware, (req, res) => {
	profileAvatarUpload(req, res, async (err) => {
		if (err) return res.status(400).json({ message: err.message || "Upload failed" });
		if (!req.file) return res.status(400).json({ message: "No file uploaded" });
		const relativePath = path.relative(path.join(__dirname, "..", "uploads"), req.file.path);
		res.json({ path: relativePath.replace(/\\/g, "/") });
	});
});

// Upload profile resume; returns path for PATCH /profile
router.post("/profile/resume", authMiddleware, (req, res) => {
	profileResumeUpload(req, res, async (err) => {
		if (err) return res.status(400).json({ message: err.message || "Upload failed" });
		if (!req.file) return res.status(400).json({ message: "No file uploaded" });
		const relativePath = path.relative(path.join(__dirname, "..", "uploads"), req.file.path);
		res.json({ path: relativePath.replace(/\\/g, "/") });
	});
});

// Get student applications
router.get("/applications", authMiddleware, async (req, res) => {
	try {
		const applications = await Application.find({ userId: req.user.id })
			.populate(
				"jobId",
				"title technology jobType applicationDeadline status location stipend bond salary minCGPA cgpaRequirementWaived hiddenFromStudents"
			)
			.populate({
				path: "companyId",
				select: "companyProfile.companyName companyProfile.industry",
			})
			.sort({ createdAt: -1 });

		res.json(applications);
	} catch (error) {
		res.status(500).json({ message: "Error fetching applications" });
	}
});

module.exports = router;
