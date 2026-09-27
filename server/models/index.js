// Central export file for all models
const User = require("./User");
const JobPosting = require("./Posting");
const Application = require("./Application");
const Token = require("./tokenModel");

module.exports = {
	User,
	JobPosting,
	Application,
	Token,
};
