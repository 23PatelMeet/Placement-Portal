const mongoose = require("mongoose");

const jobPostingSchema = new mongoose.Schema(
	{
		companyId: {
			type: mongoose.Schema.Types.ObjectId,
			ref: "User",
			required: [true, "Company ID is required"],
		},
		title: {
			type: String,
			required: [true, "Job title is required"],
			trim: true,
		},
		description: {
			type: String,
			required: [true, "Job description is required"],
			trim: true,
		},
		technology: {
			type: [String],
			required: [true, "At least one technology is required"],
		},
		jobType: {
			type: String,
			enum: ["Full-time", "Part-time", "Internship", "Contract"],
			required: [true, "Job type is required"],
		},
		location: {
			type: String,
			required: [true, "Job location is required"],
			trim: true,
		},
		applicationDeadline: {
			type: Date,
			required: [true, "Application deadline is required"],
		},
		salary: {
			type: String, // Simple string like "5-8 LPA"
		},
		stipend: {
			type: String, // Simple string like "25000/month"
		},
		bond: {
			type: String, // Simple string like "2 years"
		},
		minCGPA: {
			type: Number,
			min: 0,
			max: 10,
		},
		applicationCount: {
			type: Number,
			default: 0,
		},
		status: {
			type: String,
			enum: ["Active", "Closed", "Expired"],
			default: "Active",
		},
		// Admin: remove job from student catalog and block new applications
		hiddenFromStudents: {
			type: Boolean,
			default: false,
		},
		// Admin: skip minCGPA check on apply (fairness / special drive)
		cgpaRequirementWaived: {
			type: Boolean,
			default: false,
		},
	},
	{
		timestamps: true,
		toJSON: { virtuals: true },
		toObject: { virtuals: true },
	}
);

// Indexes for better performance
jobPostingSchema.index({ companyId: 1 });
jobPostingSchema.index({ status: 1, isActive: 1 });
jobPostingSchema.index({ applicationDeadline: 1 });
jobPostingSchema.index({ technology: 1 });
jobPostingSchema.index({ jobType: 1 });
jobPostingSchema.index({ location: 1 });
jobPostingSchema.index({ createdAt: -1 });

// Compound indexes
jobPostingSchema.index({ status: 1, applicationDeadline: 1 });
jobPostingSchema.index({ companyId: 1, status: 1 });

// Virtual for company details
jobPostingSchema.virtual("company", {
	ref: "User",
	localField: "companyId",
	foreignField: "_id",
	justOne: true,
});

// Virtual for applications
jobPostingSchema.virtual("applications", {
	ref: "Application",
	localField: "_id",
	foreignField: "jobId",
});

// Middleware to update status based on deadline
jobPostingSchema.pre("save", function (next) {
	if (
		this.applicationDeadline &&
		this.applicationDeadline < new Date() &&
		this.status === "Active"
	) {
		this.status = "Expired";
	}
	next();
});

// Method to check if applications are still open
jobPostingSchema.methods.isApplicationOpen = function () {
	return (
		this.status === "Active" &&
		!this.hiddenFromStudents &&
		this.applicationDeadline > new Date() &&
		(!this.maxApplications || this.applicationCount < this.maxApplications)
	);
};

module.exports = mongoose.model("JobPosting", jobPostingSchema);
