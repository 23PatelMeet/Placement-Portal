const router = require("express").Router();
const User = require("../models/User");
const OTP = require("../models/OTP");
const { signToken } = require("../config/jwt");
const { generateOTP, sendOTPEmail } = require("../config/email");

router.post("/login", async (req, res) => {
	try {
		const { email, password } = req.body;

		if (!email || !password) {
			return res
				.status(400)
				.json({ message: "Email and password are required" });
		}

		const emailLower = String(email).trim().toLowerCase();
		console.log("Login attempt for:", emailLower);

		// Find user by email
		const user = await User.findOne({
			email: emailLower,
			isActive: true,
		});

		if (!user) {
			return res.status(400).json({ message: "Invalid credentials" });
		}

		if (
			user.userType !== "admin" &&
			user.applicationStatus !== "accepted"
		) {
			const statusMessage =
				user.applicationStatus === "rejected"
					? "Your application has been rejected by admin"
					: "Your registration is pending admin approval";
			return res.status(403).json({ message: statusMessage });
		}

		// Validate password
		const isValid = await user.validatePassword(password);
		if (!isValid) {
			return res.status(400).json({ message: "Passwords do not match" });
		}

		// Generate token
		const token = signToken({
			id: user._id,
			email: user.email,
			role: user.userType,
		});

		// Prepare user data based on type
		let userData = {
			id: user._id,
			email: user.email,
			userType: user.userType,
			isVerified: user.isVerified,
			applicationStatus: user.applicationStatus,
		};

		if (user.userType === "student") {
			userData = {
				...userData,
				name: user.studentProfile?.name,
				studentId: user.studentProfile?.studentId,
			};
		} else if (user.userType === "company") {
			userData = {
				...userData,
				companyName: user.companyProfile?.companyName,
				hrName: user.companyProfile?.hrName,
			};
		}

		return res.json({
			token,
			role: user.userType,
			user: userData,
		});
	} catch (error) {
		console.error("Login error:", error);
		return res.status(500).json({ message: "Internal server error" });
	}
});

// Send OTP for email verification
router.post("/send-otp", async (req, res) => {
	try {
		const { email, name } = req.body;

		if (!email) {
			return res.status(400).json({ message: "Email is required" });
		}

		const emailLower = email.toLowerCase().trim();

		// Check if user already exists
		const existingUser = await User.findOne({ email: emailLower });
		if (existingUser) {
			return res.status(400).json({ message: "User with this email already exists" });
		}

		// Generate OTP
		const otp = generateOTP();

		// Save OTP to database
		await OTP.createOTP(emailLower, otp, 'registration');

		// Send OTP email
		const emailResult = await sendOTPEmail(emailLower, otp, name || '');

		if (emailResult.success) {
			return res.json({
				message: "OTP sent successfully to your email",
				email: emailLower,
			});
		} else {
			return res.status(500).json({
				message: "Failed to send OTP email",
				error: emailResult.error,
			});
		}
	} catch (error) {
		console.error("Send OTP error:", error);
		return res.status(500).json({ message: "Internal server error" });
	}
});

// Verify OTP
router.post("/verify-otp", async (req, res) => {
	try {
		const { email, otp } = req.body;

		if (!email || !otp) {
			return res.status(400).json({ message: "Email and OTP are required" });
		}

		const emailLower = email.toLowerCase().trim();

		// Verify OTP
		const verificationResult = await OTP.verifyOTP(emailLower, otp, 'registration');

		if (verificationResult.success) {
			return res.json({
				message: "Email verified successfully",
				verified: true,
			});
		} else {
			return res.status(400).json({
				message: verificationResult.message,
				verified: false,
			});
		}
	} catch (error) {
		console.error("Verify OTP error:", error);
		return res.status(500).json({ message: "Internal server error" });
	}
});

module.exports = router;

// Add logout endpoint to clear auth cookie
router.post("/logout", (_req, res) => {
	try {
		res.clearCookie("token", {
			path: "/",
			httpOnly: true,
			sameSite: "none",
			secure: true,
		});
		return res.status(200).json({ message: "Logged out" });
	} catch (_e) {
		return res.status(200).json({ message: "Logged out" });
	}
});
