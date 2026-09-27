import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { registerCompany, sendOTP, verifyOTP } from "../services/auth";
import { toast } from "react-toastify";

function CompanyRegister() {
	const [form, setForm] = useState({
		companyName: "",
		hrName: "",
		address: "",
		password: "",
		confirmPassword: "",
		email: "",
		otp: "",
	});
	const [loading, setLoading] = useState(false);
	const [otpSent, setOtpSent] = useState(false);
	const [otpVerified, setOtpVerified] = useState(false);
	const [sendingOtp, setSendingOtp] = useState(false);
	const [verifyingOtp, setVerifyingOtp] = useState(false);
	const navigate = useNavigate();

	const onChange = (e) => setForm({ ...form, [e.target.name]: e.target.value });

	const handleSendOTP = async () => {
		if (!form.email) {
			toast.error('Please enter your email first')
			return
		}

		setSendingOtp(true)
		try {
			await sendOTP(form.email, form.hrName || form.companyName)
			setOtpSent(true)
		} catch (error) {
			console.error('Send OTP error:', error)
		} finally {
			setSendingOtp(false)
		}
	}

	const handleVerifyOTP = async () => {
		if (!form.otp) {
			toast.error('Please enter the OTP')
			return
		}

		setVerifyingOtp(true)
		try {
			await verifyOTP(form.email, form.otp)
			setOtpVerified(true)
		} catch (error) {
			console.error('Verify OTP error:', error)
		} finally {
			setVerifyingOtp(false)
		}
	}

	const onSubmit = async (e) => {
		e.preventDefault();

		if (!otpVerified) {
			toast.error('Please verify your email with OTP first')
			return
		}

		if (form.password !== form.confirmPassword) {
			toast.error("Passwords do not match");
			return;
		}
		setLoading(true);
		try {
			const response = await registerCompany({
				companyName: form.companyName,
				email: form.email,
				hrName: form.hrName,
				address: form.address,
				password: form.password,
			});
			if (response.token) {
				localStorage.setItem("token", response.token);
			}
			setForm({
				companyName: "",
				hrName: "",
				address: "",
				password: "",
				confirmPassword: "",
				email: "",
				otp: "",
			});
			navigate("/login");
		} finally {
			setLoading(false);
		}
	};

	return (
		<div className="col-lg-12 mx-auto mt-4">
			<div className="card shadow">
				<div className="card-header bg-primary">
					<h3 className="text-light">Company Registration</h3>
				</div>
				<div className="card-bady p-4 row">
					<form onSubmit={onSubmit}>
						<div className="">
							<div className="input-group mb-3">
								<input
									name="companyName"
									className="input"
									value={form.companyName}
									onChange={onChange}
									required
								/>
								<label className="label">Company Name</label>
							</div>
							<div className="input-group mb-3">
								<input
									type="email"
									name="email"
									className="input"
									value={form.email}
									onChange={onChange}
									required
								/>
								<label className="label">Email</label>
							</div>

							{/* OTP Section */}
							<div className="row mb-3">
								<div className="col-8">
									<div className="input-group">
										<input
											type="text"
											name="otp"
											className="input"
											value={form.otp}
											onChange={onChange}
											// placeholder="Enter OTP"
											disabled={!otpSent}
											required
										/>
										<label className="label">OTP</label>
									</div>
								</div>
								<div className="col-4">
									{!otpVerified ? (
										<>
											{!otpSent ? (
												<button
													type="button"
													className="btn btn-outline-primary w-100"
													onClick={handleSendOTP}
													disabled={sendingOtp || !form.email}
												>
													{sendingOtp ? 'Sending...' : 'Send OTP'}
												</button>
											) : (
												<button
													type="button"
													className="btn btn-outline-success w-100"
													onClick={handleVerifyOTP}
													disabled={verifyingOtp || !form.otp}
												>
													{verifyingOtp ? 'Verifying...' : 'Verify OTP'}
												</button>
											)}
										</>
									) : (
										<button type="button" className="btn btn-success w-100" disabled>
											✓ Verified
										</button>
									)}
								</div>
							</div>
							<div className="input-group mb-3">
								<input
									name="hrName"
									className="input"
									value={form.hrName}
									onChange={onChange}
									required
								/>
								<label className="label">HR Name</label>
							</div>
							<div className="input-group mb-3">
								<input
									name="address"
									className="input"
									value={form.address}
									onChange={onChange}
									required
								/>
								<label className="label">Address</label>
							</div>
							<div className="input-group mb-3">
								<input
									type="password"
									name="password"
									className="input"
									value={form.password}
									onChange={onChange}
									required
								/>
								<label className="label">Password</label>
							</div>
							<div className="input-group mb-3">
								<input
									type="password"
									name="confirmPassword"
									className="input"
									value={form.confirmPassword}
									onChange={onChange}
									required
								/>
								<label className="label">Confirm Password</label>
							</div>
						</div>
						<div className="mt-3">
							<button className="btn btn-brand" disabled={loading || !otpVerified}>
								{loading ? "Registering..." : "Register"}
							</button>
						</div>
					</form>

					<div className="text-center mt-3">
						<Link to="/" className="text-muted">← Back to Welcome</Link>
					</div>
				</div>
			</div>
			<style>{`
				.input-group {
				position: relative;
				/*background: #000;*/
				}
				.input {
				border: solid 1.5px #b7b7b7;
				border-radius: 10px;
				background: none;
				padding: 15px;
				width: 100%;
				color: #212121;
				}
				.label {
				position: absolute;
				left: 15px;
				color: #212121;
				pointer-events: none;
				transform: translateY(15px);
				transition: 150ms cubic-bezier(0.4, 0, 0.2, 1);
				}
				.input:focus,
				input:valid {
				outline: none;
				border: 1.5px solid #212121;
				}
				.input:focus ~ label,
				input:valid ~ label {
				transform: translateX(-10%) translateY(-50%) scale(0.9);
				background: #fff;
				padding: 0 0.2em;
				color: #212121;
				}
				.link {
				text-decoration: none;
				color: #212121;
				cursor: pointer;
				}
				.link:hover {
				font-size: large;
				}
				samp {
				color: #6a6a6a;
				}
				.bar {
				text-align: center;
				margin: 0px 25px;
				}
        `}</style>
		</div>
	);
}

export default CompanyRegister;
