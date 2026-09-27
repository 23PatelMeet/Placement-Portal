const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");

// Simple Student Profile Schema
const studentProfileSchema = new mongoose.Schema(
	{
		name: {
			type: String,
			required: [true, "Name is required"],
			trim: true,
		},
		studentId: {
			type: String,
			trim: true,
		},
		lastSemester: { type: String, trim: true },
		lastSemesterCGPA: { type: String, trim: true },
		address: { type: String, trim: true },
		resume: { type: String, trim: true },
		profileImage: { type: String, trim: true },
		linkedCompanyUserId: {
			type: mongoose.Schema.Types.ObjectId,
			ref: "User",
			default: null,
		},
	},
	{ _id: false }
);

// Simple Company Profile Schema
const companyProfileSchema = new mongoose.Schema(
	{
		companyName: {
			type: String,
			required: [true, "Company name is required"],
			trim: true,
		},
		companyId: {
			type: String,
			trim: true,
		},
		hrName: {
			type: String,
			required: [true, "HR name is required"],
			trim: true,
		},
		address: {
			type: String,
			required: [true, "Address is required"],
			trim: true,
		},
	},
	{ _id: false }
);

// Main User Schema
const userSchema = new mongoose.Schema(
	{
		email: {
			type: String,
			required: [true, "Email is required"],
			lowercase: true,
			trim: true,
			match: [
				/^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/,
				"Please enter a valid email",
			],
		},
		passwordHash: {
			type: String,
			required: [true, "Password is required"],
		},
		userType: {
			type: String,
			enum: ["student", "company", "admin"],
			required: [true, "User type is required"],
		},
		// Embedded profile data based on user type
		studentProfile: {
			type: studentProfileSchema,
			required: function () {
				return this.userType === "student";
			},
		},
		companyProfile: {
			type: companyProfileSchema,
			required: function () {
				return this.userType === "company";
			},
		},
		isActive: {
			type: Boolean,
			default: true,
		},
		isVerified: {
			type: Boolean,
			default: false,
		},
		applicationStatus: {
			type: String,
			enum: ["pending", "accepted", "rejected"],
			default: function () {
				return this.userType === "admin" ? "accepted" : "pending";
			},
		},
		reviewedAt: {
			type: Date,
			default: null,
		},
	},
	{
		timestamps: true,
		toJSON: { virtuals: true },
		toObject: { virtuals: true },
	}
);

// Indexes for performance
userSchema.index({ email: 1 }, { unique: true });
userSchema.index({ userType: 1 });
userSchema.index({ "studentProfile.studentId": 1 }, { sparse: true });
userSchema.index({ "companyProfile.companyId": 1 }, { sparse: true });
userSchema.index({ createdAt: -1 });



// Virtual for profile data
userSchema.virtual("profile").get(function () {
	switch (this.userType) {
		case "student":
			return this.studentProfile;
		case "company":
			return this.companyProfile;
		default:
			return null;
	}
});

// Virtual for display name
userSchema.virtual("displayName").get(function () {
	switch (this.userType) {
		case "student":
			return this.studentProfile?.name || "Student";
		case "company":
			return this.companyProfile?.companyName || "Company";
		default:
			return "User";
	}
});

// Password methods
userSchema.methods.setPassword = async function (password) {
	this.passwordHash = await bcrypt.hash(password, 10);
};

userSchema.methods.validatePassword = function (password) {
	return bcrypt.compare(password, this.passwordHash);
};


// Profile management methods
userSchema.methods.updateProfile = function (profileData) {
	if (this.userType === "student" && profileData) {
		this.studentProfile = { ...this.studentProfile.toObject(), ...profileData };
	} else if (this.userType === "company" && profileData) {
		this.companyProfile = { ...this.companyProfile.toObject(), ...profileData };
	}
	return this.save();
};

// Pre-save middleware
userSchema.pre("save", function (next) {
	// Ensure only one profile type is set
	if (this.userType === "student") {
		this.companyProfile = undefined;
		this.adminProfile = undefined;
	} else if (this.userType === "company") {
		this.studentProfile = undefined;
		this.adminProfile = undefined;
	}
	next();
});

// Remove sensitive data from JSON output
userSchema.methods.toJSON = function () {
	const user = this.toObject();
	delete user.passwordHash;
	delete user.loginAttempts;
	delete user.lockUntil;
	return user;
};

module.exports = mongoose.model("User", userSchema);
