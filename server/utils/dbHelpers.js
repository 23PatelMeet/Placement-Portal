const mongoose = require("mongoose");
const { User, JobPosting, Application, Token } = require("../models");

class DatabaseHelpers {
	// Connect to database if not already connected
	static async ensureConnection() {
		if (mongoose.connection.readyState === 0) {
			const mongoUri =
				process.env.MONGODB_URI || "mongodb://localhost:27017/placement_app";
			await mongoose.connect(mongoUri);
			console.log("Connected to MongoDB");
		}
	}

	// Create indexes for all models
	static async createIndexes() {
		try {
			await this.ensureConnection();
			console.log("Creating database indexes...");

			await Promise.all([
				User.createIndexes(),
				JobPosting.createIndexes(),
				Application.createIndexes(),
				Token.createIndexes(),
			]);

			console.log("Database indexes created successfully");
		} catch (error) {
			console.error("Error creating indexes:", error);
			throw error;
		}
	}

	// Clean up expired data
	static async cleanupExpiredData() {
		try {
			await this.ensureConnection();
			console.log("Cleaning up expired data...");

			// Clean up expired tokens
			await Token.cleanupExpiredTokens();

			// Update expired job postings
			await JobPosting.updateMany(
				{
					applicationDeadline: { $lt: new Date() },
					status: "Active",
				},
				{ status: "Expired" }
			);

			console.log("Expired data cleanup completed");
		} catch (error) {
			console.error("Error during cleanup:", error);
			throw error;
		}
	}

	// Get database statistics
	static async getDatabaseStats() {
		try {
			await this.ensureConnection();
			const stats = {
				users: await User.countDocuments(),
				students: await User.countDocuments({ userType: "student" }),
				companies: await User.countDocuments({ userType: "company" }),
				activeCompanies: await User.countDocuments({
					userType: "company",
					isActive: true,
					isVerified: true,
				}),
				jobPostings: await JobPosting.countDocuments(),
				activeJobPostings: await JobPosting.countDocuments({
					status: "Active",
				}),
				applications: await Application.countDocuments(),
				pendingApplications: await Application.countDocuments({
					status: "Applied",
				}),
				tokens: await Token.countDocuments({ isRevoked: false }),
			};

			return stats;
		} catch (error) {
			console.error("Error getting database stats:", error);
			throw error;
		}
	}

	// Migrate existing data (if needed)
	static async migrateExistingData() {
		try {
			await this.ensureConnection();
			console.log("Starting data migration...");

			// Add any migration logic here
			// For example, if you need to update existing records to match new schema

			console.log("Data migration completed");
		} catch (error) {
			console.error("Error during migration:", error);
			throw error;
		}
	}

	// Validate data integrity
	static async validateDataIntegrity() {
		try {
			await this.ensureConnection();
			console.log("Validating data integrity...");

			const issues = [];

			// Check for orphaned applications
			const orphanedApps = await Application.aggregate([
				{
					$lookup: {
						from: "students",
						localField: "studentId",
						foreignField: "_id",
						as: "student",
					},
				},
				{
					$lookup: {
						from: "postings",
						localField: "jobId",
						foreignField: "_id",
						as: "job",
					},
				},
				{
					$match: {
						$or: [{ student: { $size: 0 } }, { job: { $size: 0 } }],
					},
				},
			]);

			if (orphanedApps.length > 0) {
				issues.push(`Found ${orphanedApps.length} orphaned applications`);
			}

			// Check for postings without valid company references
			const orphanedPostings = await Posting.aggregate([
				{
					$lookup: {
						from: "companies",
						localField: "companyId",
						foreignField: "_id",
						as: "company",
					},
				},
				{
					$match: {
						company: { $size: 0 },
					},
				},
			]);

			if (orphanedPostings.length > 0) {
				issues.push(`Found ${orphanedPostings.length} orphaned job postings`);
			}

			if (issues.length === 0) {
				console.log("Data integrity validation passed");
			} else {
				console.warn("Data integrity issues found:", issues);
			}

			return { valid: issues.length === 0, issues };
		} catch (error) {
			console.error("Error during data integrity validation:", error);
			throw error;
		}
	}
}

module.exports = DatabaseHelpers;
