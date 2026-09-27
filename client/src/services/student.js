import axios from "axios";
import { getAuthHeader } from "./auth";

const apiBase = import.meta.env.REACT_APP_BACKEND_URL || `${window.location.origin}/api`;
const api = axios.create({ baseURL: apiBase });

// Job-related functions
export async function getJobs(filters = {}) {
	try {
		const hasExplicitPagination =
			Object.prototype.hasOwnProperty.call(filters, "page") ||
			Object.prototype.hasOwnProperty.call(filters, "limit");

		// Backward-compatible single request when caller explicitly controls pagination.
		if (hasExplicitPagination) {
			const params = new URLSearchParams(filters).toString();
			const { data } = await api.get(`/jobs?${params}`, {
				headers: getAuthHeader(),
			});
			return Array.isArray(data) ? data : data.jobs || [];
		}

		// By default, fetch all active jobs across pages so UI counters are accurate.
		const pageSize = 100;
		let currentPage = 1;
		let totalPages = 1;
		const allJobs = [];

		while (currentPage <= totalPages) {
			const params = new URLSearchParams({
				...filters,
				page: String(currentPage),
				limit: String(pageSize),
			}).toString();
			const { data } = await api.get(`/jobs?${params}`, {
				headers: getAuthHeader(),
			});

			// Handle legacy array response shape if encountered.
			if (Array.isArray(data)) {
				allJobs.push(...data);
				break;
			}

			allJobs.push(...(data.jobs || []));
			totalPages = Number(data.totalPages) || 1;
			currentPage += 1;
		}

		return allJobs;
	} catch (error) {
		const message =
			error.response?.data?.message || error.message || "Failed to fetch jobs";
		throw new Error(message);
	}
}


export async function applyJob(jobId, applicationData) {
	try {
		const isFormData = applicationData instanceof FormData;
		const config = {
			headers: {
				...getAuthHeader(),
				// Do not set Content-Type for FormData; axios sets multipart/form-data with boundary
				...(isFormData ? {} : { "Content-Type": "application/json" }),
			},
		};
		const { data } = await api.post(`/jobs/${jobId}/apply`, applicationData, config);
		return data;
	} catch (error) {
		const message =
			error.response?.data?.message ||
			error.message ||
			"Failed to apply for job";
		throw new Error(message);
	}
}


export async function getMyApplications() {
	const { data } = await api.get("/students/applications", {
		headers: getAuthHeader(),
	});
	return data;
}

export async function getProfile() {
	const { data } = await api.get("/students/profile", {
		headers: getAuthHeader(),
	});
	return data;
}

export async function updateProfile(payload) {
	const { data } = await api.patch("/students/profile", payload, {
		headers: { ...getAuthHeader(), "Content-Type": "application/json" },
	});
	return data;
}

export async function uploadProfileAvatar(file) {
	const formData = new FormData();
	formData.append("profileImage", file);
	const { data } = await api.post("/students/profile/avatar", formData, {
		headers: getAuthHeader(),
	});
	return data;
}

export async function uploadProfileResume(file) {
	const formData = new FormData();
	formData.append("resume", file);
	const { data } = await api.post("/students/profile/resume", formData, {
		headers: getAuthHeader(),
	});
	return data;
}

export function getProfileImageUrl(path) {
	if (!path) return null;
	return `${apiBase}/uploads/${path}`;
}

export function getProfileResumeUrl(path) {
	if (!path) return null;
	return `${apiBase}/uploads/${path}`;
}
