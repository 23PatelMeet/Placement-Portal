const mongoose = require("mongoose");

const applicationSchema = new mongoose.Schema(
	{
		userId: {
			type: mongoose.Schema.Types.ObjectId,
			ref: "User",
			required: [true, "User ID is required"],
		},
		jobId: {
			type: mongoose.Schema.Types.ObjectId,
			ref: "JobPosting",
			required: [true, "Job ID is required"],
		},
		companyId: {
			type: mongoose.Schema.Types.ObjectId,
			ref: "User",
			required: [true, "Company ID is required"],
		},
		status: {
			type: String,
			enum: ["Applied", "Selected", "Rejected"],
			default: "Applied",
		},
		notes: {
			type: String,
			trim: true,
		},
		lastSemester: {
			type: String,
			trim: true,
		},
		lastSemesterCGPA: {
			type: String,
			trim: true,
		},
		resume: {
			type: String,
			trim: true,
		},
		interviewRound: {
			type: Number,
			min: 1,
			max: 4,
			default: 1,
		},
	},
	{
		timestamps: true,
		toJSON: { virtuals: true },
		toObject: { virtuals: true },
	}
);

// Indexes for better performance
applicationSchema.index({ userId: 1, jobId: 1 }, { unique: true });
applicationSchema.index({ userId: 1 });
applicationSchema.index({ jobId: 1 });
applicationSchema.index({ companyId: 1 });
applicationSchema.index({ status: 1 });
applicationSchema.index({ createdAt: -1 });

// Virtual for student details
applicationSchema.virtual("student", {
	ref: "User",
	localField: "userId",
	foreignField: "_id",
	justOne: true,
});

// Virtual for job details
applicationSchema.virtual("job", {
	ref: "JobPosting",
	localField: "jobId",
	foreignField: "_id",
	justOne: true,
});

// Virtual for company details
applicationSchema.virtual("company", {
	ref: "User",
	localField: "companyId",
	foreignField: "_id",
	justOne: true,
});

// Simple method to update status
applicationSchema.methods.updateStatus = function (newStatus, notes = "") {
	this.status = newStatus;
	if (notes) this.notes = notes;
	return this.save();
};

module.exports = mongoose.model("Application", applicationSchema);
