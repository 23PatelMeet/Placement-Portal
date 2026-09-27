import axios from "axios";
import { getAuthHeader } from "./auth";

const apiBase = import.meta.env.REACT_APP_BACKEND_URL || "/api";
const api = axios.create({ baseURL: apiBase });

// Job posting functions
export async function createPosting(postingData) {
	try {
		const { data } = await api.post("/companies/postings", postingData, {
			headers: getAuthHeader(),
		});
		return data;
	} catch (error) {
		const message =
			error.response?.data?.message ||
			error.message ||
			"Failed to create posting";
		throw new Error(message);
	}
}

export async function getMyPostings() {
	try {
		// First refresh the postings to update expired jobs
		await refreshPostings();

		const { data } = await api.get("/companies/postings", {
			headers: getAuthHeader(),
		});
		return data;
	} catch (error) {
		const message =
			error.response?.data?.message ||
			error.message ||
			"Failed to fetch postings";
		throw new Error(message);
	}
}

export async function refreshPostings() {
	try {
		const { data } = await api.post("/companies/refresh-postings", {}, {
			headers: getAuthHeader(),
		});
		return data;
	} catch (error) {
		// Silently fail - refresh is optional
		console.warn("Failed to refresh postings:", error.message);
		return null;
	}
}

// Application status update function
export async function updateApplicationStatus(applicationId, status, notes = '') {
	try {
		const { data } = await api.put(
			`/companies/applications/${applicationId}/status`,
			{ status, notes },
			{ headers: getAuthHeader() }
		);
		return data;
	} catch (error) {
		const message =
			error.response?.data?.message ||
			error.message ||
			"Failed to update application status";
		throw new Error(message);
	}
}

// === REPORTING & ANALYTICS FUNCTIONS ===

// Get hiring analytics report
export async function getHiringAnalytics(startDate = null, endDate = null, jobId = null) {
	try {
		const params = new URLSearchParams();
		if (startDate) params.append('startDate', startDate);
		if (endDate) params.append('endDate', endDate);
		if (jobId) params.append('jobId', jobId);

		console.log('Calling hiring analytics API:', `/companies/reports/hiring-analytics?${params}`);

		const { data } = await api.get(`/companies/reports/hiring-analytics?${params}`, {
			headers: getAuthHeader(),
		});

		console.log('Hiring analytics response:', data);
		return data;
	} catch (error) {
		console.error('Hiring analytics API error:', error);
		throw error; // Re-throw the original error for better debugging
	}
}

// Get application timeline report
export async function getApplicationTimeline(period = 30) {
	try {
		console.log('Calling application timeline API:', `/companies/reports/application-timeline?period=${period}`);

		const { data } = await api.get(`/companies/reports/application-timeline?period=${period}`, {
			headers: getAuthHeader(),
		});

		console.log('Application timeline response:', data);
		return data;
	} catch (error) {
		console.error('Application timeline API error:', error);
		throw error; // Re-throw the original error for better debugging
	}
}

// Export candidate data
export async function exportCandidateData(filters = {}) {
	try {
		const params = new URLSearchParams();
		if (filters.jobId) params.append('jobId', filters.jobId);
		if (filters.status) params.append('status', filters.status);
		if (filters.format) params.append('format', filters.format);
		if (filters.dateRange) params.append('dateRange', filters.dateRange);
		if (filters.jobStatus) params.append('jobStatus', filters.jobStatus);

		const { data } = await api.get(`/companies/reports/candidates-export?${params}`, {
			headers: getAuthHeader(),
		});
		return data;
	} catch (error) {
		const message = error.response?.data?.message || error.message || "Failed to export candidate data";
		throw new Error(message);
	}
}


// Application management functions
export async function getApplications() {
	try {
		const { data } = await api.get("/companies/applications", {
			headers: getAuthHeader(),
		});
		return data;
	} catch {
		return [];
	}
}

export async function getRoundCandidates(jobId, round = 1) {
	try {
		const params = new URLSearchParams({
			jobId,
			round: String(round),
		});
		const { data } = await api.get(`/companies/rounds/candidates?${params}`, {
			headers: getAuthHeader(),
		});
		return data;
	} catch (error) {
		const message =
			error.response?.data?.message ||
			error.message ||
			"Failed to fetch round candidates";
		throw new Error(message);
	}
}

export async function promoteRoundCandidates(jobId, fromRound, applicationIds) {
	try {
		const { data } = await api.post(
			"/companies/rounds/promote",
			{ jobId, fromRound, applicationIds },
			{ headers: getAuthHeader() }
		);
		return data;
	} catch (error) {
		const message =
			error.response?.data?.message ||
			error.message ||
			"Failed to save round selection";
		throw new Error(message);
	}
}

export async function getRoundSummary(jobId = "", round = "all") {
	try {
		const params = new URLSearchParams();
		if (jobId) params.append("jobId", jobId);
		if (round) params.append("round", round);
		const { data } = await api.get(`/companies/rounds/summary?${params}`, {
			headers: getAuthHeader(),
		});
		return data;
	} catch (error) {
		const message =
			error.response?.data?.message ||
			error.message ||
			"Failed to fetch round summary";
		throw new Error(message);
	}
}

export async function getRoundStudentMatrix(jobId) {
	try {
		const params = new URLSearchParams({ jobId });
		const { data } = await api.get(`/companies/rounds/student-matrix?${params}`, {
			headers: getAuthHeader(),
		});
		return data;
	} catch (error) {
		const message =
			error.response?.data?.message ||
			error.message ||
			"Failed to fetch round student matrix";
		throw new Error(message);
	}
}




