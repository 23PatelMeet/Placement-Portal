import axios from "axios";
import { toast } from "react-toastify";
import { getAuthHeader } from "./auth";

const apiBase = import.meta.env.REACT_APP_BACKEND_URL || "/api";
const api = axios.create({ baseURL: apiBase });

export async function fetchApplications(filters = {}) {
	try {
		const { status = "pending", type = "all" } = filters;
		const params = new URLSearchParams({ status, type });
		const { data } = await api.get(`/admin/applications?${params.toString()}`, {
			headers: getAuthHeader(),
		});
		return data;
	} catch (error) {
		const message = error?.response?.data?.message || "Failed to fetch applications";
		toast.error(message);
		throw new Error(message);
	}
}

/** @param { 'accept' | 'reject' | 'pending' } action */
export async function reviewApplication(userId, action) {
	try {
		const { data } = await api.patch(
			`/admin/applications/${userId}`,
			{ action },
			{ headers: getAuthHeader() }
		);
		toast.success(data.message || "Application updated");
		return data;
	} catch (error) {
		const message = error?.response?.data?.message || "Failed to update application";
		toast.error(message);
		throw new Error(message);
	}
}

export async function fetchAcceptedCompaniesForAdmin() {
	try {
		const { data } = await api.get(`/admin/companies/accepted`, {
			headers: getAuthHeader(),
		});
		return data.companies || [];
	} catch (error) {
		const message = error?.response?.data?.message || "Failed to load companies";
		toast.error(message);
		throw new Error(message);
	}
}

export async function fetchAdminJobs(status = "all", companyId = "") {
	try {
		const params = new URLSearchParams();
		if (status && status !== "all") params.set("status", status);
		if (companyId) params.set("companyId", companyId);
		const { data } = await api.get(`/admin/jobs?${params.toString()}`, {
			headers: getAuthHeader(),
		});
		return data.jobs || [];
	} catch (error) {
		const message = error?.response?.data?.message || "Failed to fetch jobs";
		toast.error(message);
		throw new Error(message);
	}
}

export async function updateAdminJob(jobId, payload) {
	try {
		const { data } = await api.patch(`/admin/jobs/${jobId}`, payload, {
			headers: getAuthHeader(),
		});
		toast.success(data.message || "Job updated");
		return data;
	} catch (error) {
		const message = error?.response?.data?.message || "Failed to update job";
		toast.error(message);
		throw new Error(message);
	}
}
