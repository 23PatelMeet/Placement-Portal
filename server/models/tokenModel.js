const mongoose = require("mongoose");

const tokenSchema = mongoose.Schema(
	{
		userId: {
			type: mongoose.Schema.Types.ObjectId,
			required: [true, "User ID is required"],
			ref: "User",
		},
		token: {
			type: String,
			required: [true, "Token is required"],
		},
		tokenType: {
			type: String,
			enum: ["Access", "Refresh", "Email Verification", "Password Reset"],
			required: [true, "Token type is required"],
			default: "Access",
		},
		deviceInfo: {
			userAgent: String,
			ipAddress: String,
			deviceId: String,
		},
		isRevoked: {
			type: Boolean,
			default: false,
		},
		revokedAt: {
			type: Date,
		},
		revokedBy: {
			type: mongoose.Schema.Types.ObjectId,
			ref: "User",
		},
		lastUsed: {
			type: Date,
			default: Date.now,
		},
		createdAt: {
			type: Date,
			required: true,
			default: Date.now,
		},
		expiresAt: {
			type: Date,
			required: [true, "Expiration date is required"],
		},
	},
	{
		timestamps: true,
	}
);

// Indexes for better performance
tokenSchema.index({ userId: 1 });
tokenSchema.index({ token: 1 }, { unique: true });
tokenSchema.index({ tokenType: 1 });
tokenSchema.index({ isRevoked: 1 });
tokenSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 }); // MongoDB TTL index

// Compound indexes
tokenSchema.index({ userId: 1, tokenType: 1 });
tokenSchema.index({ userId: 1, isRevoked: 1 });

// Methods
tokenSchema.methods.revoke = function (revokedBy = null) {
	this.isRevoked = true;
	this.revokedAt = new Date();
	if (revokedBy) {
		this.revokedBy = revokedBy;
	}
	return this.save();
};

tokenSchema.methods.updateLastUsed = function () {
	this.lastUsed = new Date();
	return this.save();
};

// Static methods
tokenSchema.statics.revokeAllUserTokens = function (userId, tokenType = null) {
	const query = { userId, isRevoked: false };
	if (tokenType) {
		query.tokenType = tokenType;
	}
	return this.updateMany(query, {
		isRevoked: true,
		revokedAt: new Date(),
	});
};

tokenSchema.statics.cleanupExpiredTokens = function () {
	return this.deleteMany({
		$or: [
			{ expiresAt: { $lt: new Date() } },
			{
				isRevoked: true,
				revokedAt: { $lt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) },
			}, // Keep revoked tokens for 7 days
		],
	});
};

const Token = mongoose.model("Token", tokenSchema);
module.exports = Token;
