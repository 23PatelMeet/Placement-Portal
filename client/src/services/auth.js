import axios from "axios";
import { toast } from "react-toastify";

const apiBase = import.meta.env.REACT_APP_BACKEND_URL || "/api";
const api = axios.create({ baseURL: apiBase });

export async function login(email, password) {
	try {
		const { data } = await api.post("/auth/login", { email, password });

		if (data.token) {
			localStorage.setItem("token", data.token);
			localStorage.setItem("userRole", data.role);
			localStorage.setItem("userInfo", JSON.stringify(data.user));

			// Store role-specific info for backward compatibility
			if (data.role === "company") {
				localStorage.setItem(
					"companyInfo",
					JSON.stringify({
						companyName:
							data.user.companyName || data.user.companyProfile?.companyName,
						email: data.user.email,
						hrName: data.user.hrName || data.user.companyProfile?.hrName,
						isVerified: data.user.isVerified,
					})
				);
			} else if (data.role === "student") {
				localStorage.setItem(
					"studentInfo",
					JSON.stringify({
						name: data.user.name,
						email: data.user.email,
						studentId: data.user.studentId,
					})
				);
			}
			return data;
		}

		throw new Error("Invalid credentials");
	} catch (error) {
		const message =
			(error.response && error.response.data && error.response.data.message) ||
			error.message ||
			error.toString();
		toast.error(message);
		throw new Error(message);
	}
}

export async function registerStudent(name, email, password, confirmPassword) {
	try {
		const { data } = await api.post(
			"/students/register",
			{ name, email, password, confirmPassword },
			{ withCredentials: true }
		);

		if (data.token) {
			localStorage.setItem("token", data.token);
			localStorage.setItem("userRole", "student");
			localStorage.setItem("userInfo", JSON.stringify(data.user));
			toast.success("Student registered successfully!");
		}

		return data;
	} catch (err) {
		const message = err?.response?.data?.message || "Registration failed";
		toast.error(message);
		throw new Error(message);
	}
}

export async function registerCompany({
	companyName,
	hrName,
	address,
	password,
	email,
}) {
	try {
		const { data } = await api.post(
			"/companies/register",
			{ companyName, hrName, address, password, email },
			{ withCredentials: true }
		);

		if (data.token) {
			localStorage.setItem("token", data.token);
			localStorage.setItem("userRole", "company");
			localStorage.setItem("userInfo", JSON.stringify(data.user));
			toast.success("Company registered successfully!");
		}

		return data;
	} catch (error) {
		const message =
			(error.response && error.response.data && error.response.data.message) ||
			error.message ||
			error.toString();
		toast.error(message);
		throw new Error(message);
	}
}

export function getAuthHeader() {
	const token = localStorage.getItem("token");
	return token ? { Authorization: `Bearer ${token}` } : {};
}

export async function logout() {
	try {
		localStorage.removeItem("token");
		localStorage.removeItem("userRole");
		localStorage.removeItem("userInfo");
		localStorage.removeItem("companyInfo");
		localStorage.removeItem("studentInfo");

		await api.post("/auth/logout", {}, { withCredentials: true });
	} catch (error) {
		// Ignore logout errors, just clear local storage
		console.warn("Logout error:", error);
	}
}

export function getCurrentUser() {
	const userInfo = localStorage.getItem("userInfo");
	const userRole = localStorage.getItem("userRole");

	if (userInfo && userRole) {
		return {
			...JSON.parse(userInfo),
			role: userRole,
		};
	}

	return null;
}

export function isAuthenticated() {
	return !!localStorage.getItem("token");
}

export function getUserRole() {
	return localStorage.getItem("userRole");
}

// OTP related functions
export async function sendOTP(email, name = '') {
	try {
		const { data } = await api.post("/auth/send-otp", { email, name });
		toast.success("OTP sent to your email successfully!");
		return data;
	} catch (error) {
		const message =
			(error.response && error.response.data && error.response.data.message) ||
			error.message ||
			error.toString();
		toast.error(message);
		throw new Error(message);
	}
}

export async function verifyOTP(email, otp) {
	try {
		const { data } = await api.post("/auth/verify-otp", { email, otp });
		toast.success("Email verified successfully!");
		return data;
	} catch (error) {
		const message =
			(error.response && error.response.data && error.response.data.message) ||
			error.message ||
			error.toString();
		toast.error(message);
		throw new Error(message);
	}
}
