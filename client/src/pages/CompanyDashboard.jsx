import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { getCurrentUser, logout } from "../services/auth";
import {
  createPosting,
  getApplications,
  getMyPostings,
  getHiringAnalytics,
  getApplicationTimeline,
  exportCandidateData,
  getRoundCandidates,
  promoteRoundCandidates,
  getRoundSummary,
  getRoundStudentMatrix,
} from "../services/company";
import {
  generateHiringReportPDF,
  exportToExcel,
} from "../services/reportUtils";
import { toast } from "react-toastify";

const apiBase = import.meta.env.REACT_APP_BACKEND_URL || `${window.location.origin}/api`;

const CompanyDashboard = ({
  userInfo: propUserInfo,
  onLogout: propOnLogout,
}) => {
  const navigate = useNavigate();
  const [form, setForm] = useState({
    title: "",
    description: "",
    technology: "",
    jobType: "Full-time",
    location: "",
    date: "",
    salary: "",
    stipend: "",
    bond: "",
    minCGPA: "",
  });
  const [loading, setLoading] = useState(false);
  const [apps, setApps] = useState([]);
  const [postings, setPostings] = useState([]);
  const [activeTab, setActiveTab] = useState("dashboard"); // dashboard, reports
  const [analytics, setAnalytics] = useState(null);
  

  // Reporting filters
  const [reportDateRange, setReportDateRange] = useState("30");
  const [reportJobTitle, setReportJobTitle] = useState(""); // New filter for specific job titles
  const [loadingReports, setLoadingReports] = useState(false);
  const [roundJobId, setRoundJobId] = useState("");
  const [currentRound, setCurrentRound] = useState("1");
  const [roundCandidates, setRoundCandidates] = useState([]);
  const [selectedRoundCandidates, setSelectedRoundCandidates] = useState([]);
  const [loadingRoundData, setLoadingRoundData] = useState(false);
  const [savingRoundData, setSavingRoundData] = useState(false);
  const [roundSummaryRows, setRoundSummaryRows] = useState([]);
  const [roundSummaryTotals, setRoundSummaryTotals] = useState({
    round1: 0,
    round2: 0,
    round3: 0,
    round4: 0,
    total: 0,
  });
  const [loadingRoundSummary, setLoadingRoundSummary] = useState(false);
  const [summaryRoundFilter, setSummaryRoundFilter] = useState("all");
  const [studentRoundRows, setStudentRoundRows] = useState([]);
  const [studentRoundTotals, setStudentRoundTotals] = useState({
    round1: 0,
    round2: 0,
    round3: 0,
    finalRound: 0,
  });
  const [selectedPosting, setSelectedPosting] = useState(null);
  const today = new Date().toISOString().split("T")[0];

  // Use prop userInfo if provided, otherwise get from localStorage
  const userInfo = propUserInfo || getCurrentUser();
  const companyInfo = userInfo?.companyProfile || {};

  // Handle logout - use prop function if provided, otherwise use auth logout
  const handleLogout = async () => {
    if (propOnLogout) {
      propOnLogout();
    } else {
      await logout();
      navigate("/");
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [appsData, postingsData] = await Promise.all([
        getApplications(),
        getMyPostings(),
      ]);
      setApps(appsData);
      setPostings(postingsData);
    } catch (error) {
      console.error("Error loading data:", error);
      setApps([]);
      setPostings([]);
    }
  };

  const onChange = (e) => setForm({ ...form, [e.target.name]: e.target.value });
  const onSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      // Simple posting data format
      const postingData = {
        title: form.title || `${form.technology} Position`,
        description:
          form.description ||
          `We are looking for a skilled ${form.technology} developer.`,
        technology: form.technology.split(",").map((t) => t.trim()),
        jobType: form.jobType || "Full-time",
        location: form.location || "Not specified",
        applicationDeadline: form.date,
        salary: form.salary || undefined,
        stipend: form.stipend || undefined,
        bond: form.bond || undefined,
        minCGPA: form.minCGPA ? parseFloat(form.minCGPA) : undefined,
      };

      await createPosting(postingData);
      toast.success("Job posting created successfully!");

      setForm({
        title: "",
        description: "",
        technology: "",
        jobType: "Full-time",
        location: "",
        date: "",
        salary: "",
        stipend: "",
        bond: "",
        minCGPA: "",
      });

      // Refresh both applications and postings
      const [appsData, postingsData] = await Promise.all([
        getApplications(),
        getMyPostings(),
      ]);
      setApps(appsData);
      setPostings(postingsData);
    } catch (err) {
      console.error("Job posting error:", err);
      toast.error(err?.message || "Failed to create posting");
    } finally {
      setLoading(false);
    }
  };

  // Test backend connectivity and user data
  const testBackendConnection = async () => {
    try {
      console.log("Testing backend connection...");
      const response = await fetch("http://localhost:5000/api/health");
      if (response.ok) {
        console.log("Backend is reachable");

        // Test if user has any job postings
        try {
          const jobsResponse = await getMyPostings();
          console.log("User jobs:", jobsResponse);

          const appsResponse = await getApplications();
          console.log("User applications:", appsResponse);

          // Count jobs by status
          const jobCounts = {
            total: jobsResponse.length,
            active: jobsResponse.filter((job) => job.status === "Active")
              .length,
            closed: jobsResponse.filter((job) => job.status === "Closed")
              .length,
            expired: jobsResponse.filter((job) => job.status === "Expired")
              .length,
          };

          console.log("Job counts by status:", jobCounts);

          if (jobsResponse.length === 0) {
            console.log("No jobs found - this explains why analytics show 0");
            toast.info(
              "No job postings found. Create some jobs to see analytics data.",
            );
          } else {
            console.log(
              `Found ${jobCounts.total} total jobs: ${jobCounts.active} active, ${jobCounts.closed} closed, ${jobCounts.expired} expired`,
            );
            if (jobCounts.active === 0 && jobCounts.total > 0) {
              toast.warning(
                `You have ${jobCounts.total} jobs but none are Active. Check if jobs have expired.`,
              );
            }
          }
        } catch (authError) {
          console.log("Authentication issue:", authError);
          toast.error("Please login again to access your data");
        }
        return true;
      } else {
        console.log("Backend responded with error:", response.status);
        return false;
      }
    } catch (error) {
      console.log("Backend is not reachable:", error.message);
      return false;
    }
  };

  const loadRoundCandidatesData = async (jobId, round) => {
    if (!jobId) {
      setRoundCandidates([]);
      setSelectedRoundCandidates([]);
      return;
    }
    setLoadingRoundData(true);
    try {
      const response = await getRoundCandidates(jobId, Number(round));
      setRoundCandidates(response?.candidates || []);
      setSelectedRoundCandidates([]);
    } catch (error) {
      setRoundCandidates([]);
      setSelectedRoundCandidates([]);
      toast.error(error.message || "Failed to load round candidates");
    } finally {
      setLoadingRoundData(false);
    }
  };

  const toggleCandidateSelection = (applicationId) => {
    setSelectedRoundCandidates((prev) =>
      prev.includes(applicationId)
        ? prev.filter((id) => id !== applicationId)
        : [...prev, applicationId],
    );
  };

  const handleSaveRoundSelection = async () => {
    const parsedRound = Number(currentRound);
    if (!roundJobId) {
      toast.error("Please select a job title");
      return;
    }
    if (parsedRound >= 4) {
      toast.info("Final round reached. No next round available.");
      return;
    }
    if (selectedRoundCandidates.length === 0) {
      toast.error("Please select at least one student");
      return;
    }

    setSavingRoundData(true);
    try {
      const nextRound = parsedRound + 1;
      const result = await promoteRoundCandidates(
        roundJobId,
        parsedRound,
        selectedRoundCandidates,
      );
      toast.success(
        result?.message || `Students moved to Round ${nextRound}`,
      );
      setCurrentRound(String(nextRound));
      await loadRoundCandidatesData(roundJobId, nextRound);
      await loadStudentRoundMatrix(roundJobId);
    } catch (error) {
      toast.error(error.message || "Failed to save round selection");
    } finally {
      setSavingRoundData(false);
    }
  };

  const loadRoundSummaryData = async (jobId, roundFilter = summaryRoundFilter) => {
    setLoadingRoundSummary(true);
    try {
      const response = await getRoundSummary(jobId || "", roundFilter);
      setRoundSummaryRows(response?.rows || []);
      setRoundSummaryTotals(
        response?.totals || {
          round1: 0,
          round2: 0,
          round3: 0,
          round4: 0,
          total: 0,
        },
      );
    } catch (error) {
      setRoundSummaryRows([]);
      setRoundSummaryTotals({
        round1: 0,
        round2: 0,
        round3: 0,
        round4: 0,
        total: 0,
      });
      toast.error(error.message || "Failed to load round summary");
    } finally {
      setLoadingRoundSummary(false);
    }
  };

  const loadStudentRoundMatrix = async (jobId) => {
    if (!jobId) {
      setStudentRoundRows([]);
      setStudentRoundTotals({ round1: 0, round2: 0, round3: 0, finalRound: 0 });
      return;
    }
    setLoadingRoundSummary(true);
    try {
      const response = await getRoundStudentMatrix(jobId);
      setStudentRoundRows(response?.rows || []);
      setStudentRoundTotals(
        response?.totals || { round1: 0, round2: 0, round3: 0, finalRound: 0 },
      );
    } catch (error) {
      setStudentRoundRows([]);
      setStudentRoundTotals({ round1: 0, round2: 0, round3: 0, finalRound: 0 });
      toast.error(error.message || "Failed to load student round matrix");
    } finally {
      setLoadingRoundSummary(false);
    }
  };

  const handleExportRoundSummaryExcel = async () => {
    try {
      if (!studentRoundRows.length) {
        toast.warning("No round summary data available to export");
        return;
      }
      const excelRows = studentRoundRows.map((row) => ({
        StudentEmail: row.studentEmail || "N/A",
        ...(summaryRoundFilter === "all"
          ? {
              Round1: row.round1 || "No",
              Round2: row.round2 || "No",
              Round3: row.round3 || "No",
              FinalRound: row.finalRound || "No",
            }
          : {
              [summaryRoundFilter === "4" ? "FinalRound" : `Round${summaryRoundFilter}`]:
                summaryRoundFilter === "1"
                  ? row.round1 || "No"
                  : summaryRoundFilter === "2"
                    ? row.round2 || "No"
                    : summaryRoundFilter === "3"
                      ? row.round3 || "No"
                      : row.finalRound || "No",
            }),
      }));
      excelRows.push({
        StudentEmail: "TOTAL",
        ...(summaryRoundFilter === "all"
          ? {
              Round1: studentRoundTotals.round1 || 0,
              Round2: studentRoundTotals.round2 || 0,
              Round3: studentRoundTotals.round3 || 0,
              FinalRound: studentRoundTotals.finalRound || 0,
            }
          : {
              [summaryRoundFilter === "4" ? "FinalRound" : `Round${summaryRoundFilter}`]:
                summaryRoundFilter === "1"
                  ? studentRoundTotals.round1 || 0
                  : summaryRoundFilter === "2"
                    ? studentRoundTotals.round2 || 0
                    : summaryRoundFilter === "3"
                      ? studentRoundTotals.round3 || 0
                      : studentRoundTotals.finalRound || 0,
            }),
      });
      await exportToExcel(excelRows, "round_results_summary", "RoundResults");
      toast.success("Round summary exported to Excel");
    } catch (error) {
      toast.error(error.message || "Failed to export round summary");
    }
  };

  // === REPORTING FUNCTIONS ===
  const loadAnalytics = async (dateRange = reportDateRange) => {
    setLoadingReports(true);
    try {
      console.log("Loading analytics with:", { dateRange });

      // Test backend connection first
      const isBackendReachable = await testBackendConnection();
      if (!isBackendReachable) {
        throw new Error(
          "Backend server is not running on http://localhost:5000",
        );
      }

      // Calculate start and end dates based on dateRange
      const endDate = new Date();
      const startDate = new Date();
      startDate.setDate(endDate.getDate() - parseInt(dateRange));

      console.log("Date range:", {
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString(),
      });

      const [analyticsData, timelineData] = await Promise.all([
        getHiringAnalytics(
          startDate.toISOString(),
          endDate.toISOString(),
          reportJobTitle || null,
        ),
        getApplicationTimeline(parseInt(dateRange)),
      ]);

      console.log("Received data:", { analyticsData, timelineData });

      // Extract and transform analytics data to match UI expectations
      const transformedAnalytics = analyticsData.data || analyticsData;
      console.log("Raw analytics data structure:", transformedAnalytics);

      if (transformedAnalytics.summary) {
        console.log("Summary data:", transformedAnalytics.summary);
        console.log("Jobs by status:", transformedAnalytics.jobsByStatus);

        // Flatten the summary data to root level for easier UI access
        setAnalytics({
          ...transformedAnalytics,
          totalJobs: transformedAnalytics.summary.totalJobs || 0,
          totalApplications:
            transformedAnalytics.summary.totalApplications || 0,
          activeJobs: transformedAnalytics.summary.activeJobs || 0,
          avgApplicationsPerJob:
            transformedAnalytics.summary.averageApplicationsPerJob || 0,
          timeline: timelineData?.data || timelineData || [],
        });
      } else {
        console.log(
          "No summary found, using direct data:",
          transformedAnalytics,
        );
        // Handle case where analytics is just the summary object directly
        setAnalytics({
          totalJobs: transformedAnalytics.totalJobs || 0,
          totalApplications: transformedAnalytics.totalApplications || 0,
          activeJobs: transformedAnalytics.activeJobs || 0,
          avgApplicationsPerJob:
            transformedAnalytics.averageApplicationsPerJob ||
            transformedAnalytics.avgApplicationsPerJob ||
            0,
          ...transformedAnalytics,
          timeline: timelineData?.data || timelineData || [],
        });
      }

      // Additional verification: Use actual job postings if analytics shows 0
      let hasAnyJobs = false;
      try {
        const myJobsData = await getMyPostings();
        hasAnyJobs = (myJobsData?.length ?? 0) > 0;
        const actualTotalJobs = myJobsData.length;
        const actualActiveJobs = myJobsData.filter(
          (job) => job.status === "Active",
        ).length;

        const analyticsTotalJobs =
          transformedAnalytics.summary?.totalJobs ??
          transformedAnalytics.totalJobs ??
          0;

        // If analytics shows 0 jobs but we have jobs, update the display
        if (analyticsTotalJobs === 0 && actualTotalJobs > 0) {
          const totalApps =
            transformedAnalytics.summary?.totalApplications ??
            transformedAnalytics.totalApplications ??
            0;
          const avgApps =
            actualTotalJobs > 0
              ? (totalApps / actualTotalJobs).toFixed(1)
              : 0;
          setAnalytics((prev) => ({
            ...prev,
            totalJobs: actualTotalJobs,
            activeJobs: actualActiveJobs,
            avgApplicationsPerJob: avgApps,
          }));
        } else if (
          (transformedAnalytics.summary?.activeJobs || 0) === 0 &&
          actualActiveJobs > 0
        ) {
          setAnalytics((prev) => ({
            ...prev,
            activeJobs: actualActiveJobs,
          }));
        }
      } catch (jobError) {
        console.log("Could not fetch job postings for verification:", jobError);
      }

      // Show helpful message - avoid "no jobs" toast if we have jobs (from analytics or fallback)
      const analyticsJobs =
        transformedAnalytics.summary?.totalJobs ??
        transformedAnalytics.totalJobs ??
        0;
      if (analyticsJobs === 0 && !hasAnyJobs) {
        toast.info(
          "No job postings found. Create some jobs to see analytics data.",
        );
      } else {
        toast.success("Analytics data loaded successfully!");
      }
    } catch (error) {
      console.error("Analytics error details:", error);
      console.error("Error response:", error.response?.data);
      console.error("Error status:", error.response?.status);

      let errorMessage = "Failed to load analytics";
      if (error.message.includes("Backend server is not running")) {
        errorMessage =
          "Backend server is not running. Please start the server on port 5000.";
      } else if (error.response?.status === 401) {
        errorMessage = "Authentication required. Please login again.";
      } else if (error.response?.status === 500) {
        errorMessage = "Server error. Please try again later.";
      } else if (
        error.code === "NETWORK_ERROR" ||
        error.message.includes("Network")
      ) {
        errorMessage =
          "Cannot connect to server. Please check if the backend is running.";
      }

      toast.error(errorMessage);
    } finally {
      setLoadingReports(false);
    }
  };

  const handleGenerateHiringPDF = async () => {
    setLoadingReports(true);
    try {
      if (!analytics) {
        toast.error("No analytics data available. Please refresh data first.");
        return;
      }

      const companyName =
        companyInfo.companyName || userInfo?.companyName || "Company";

      // Call PDF generation with the correct parameters
      await generateHiringReportPDF(analytics, companyName);
      toast.success("PDF report generated successfully!");
    } catch (error) {
      console.error("PDF generation error:", error);
      toast.error(
        "Failed to generate PDF report: " + (error.message || "Unknown error"),
      );
    } finally {
      setLoadingReports(false);
    }
  };

  const handleExportCandidates = async (format = "excel") => {
    setLoadingReports(true);
    try {
      console.log("Exporting candidates with format:", format);
      console.log("Using filters:", {
        dateRange: reportDateRange,
        jobTitle: reportJobTitle,
      });

      const candidatesData = await exportCandidateData({
        dateRange: reportDateRange,
        jobId: reportJobTitle, // Use jobId for backend compatibility
        format: format,
      });

      console.log("Candidates data received:", candidatesData);

      // Extract the actual data array
      const dataToExport =
        candidatesData.data || candidatesData.candidates || candidatesData;

      if (
        !dataToExport ||
        !Array.isArray(dataToExport) ||
        dataToExport.length === 0
      ) {
        const filterInfo = [];
        if (reportDateRange) filterInfo.push(`last ${reportDateRange} days`);
        if (reportJobTitle) {
          const selectedJob = postings.find((p) => p._id === reportJobTitle);
          if (selectedJob) filterInfo.push(`"${selectedJob.title}" job only`);
        }

        const filterText =
          filterInfo.length > 0 ? ` for ${filterInfo.join(" and ")}` : "";
        toast.warning(`No candidate data available to export${filterText}`);
        return;
      }

      if (format === "excel") {
        // Column order: ... Location, Current semester, Current semester CGPA, Resume Link, ApplicationDate, ...
        const excelRows = dataToExport.map((row) => ({
          CandidateName: row.CandidateName,
          Email: row.Email,
          JobTitle: row.JobTitle,
          JobType: row.JobType,
          Technologies: row.Technologies,
          Location: row.Location,
          "Current semester": row.LastSem ?? "N/A",
          "Current semester CGPA": row.LastSemCGPA ?? "N/A",
          "Resume Link": row.ResumePath ? `${apiBase}/uploads/${row.ResumePath}` : "N/A",
          ApplicationDate: row.ApplicationDate,
          ApplicationStatus: row.ApplicationStatus,
          JobDeadline: row.JobDeadline,
        }));

        // Generate filename with filter info
        const filterSuffix = [];
        if (reportDateRange) filterSuffix.push(`${reportDateRange}days`);
        if (reportJobTitle) {
          const selectedJob = postings.find((p) => p._id === reportJobTitle);
          if (selectedJob) {
            const cleanJobTitle = selectedJob.title
              .replace(/[^a-zA-Z0-9]/g, "_")
              .toLowerCase();
            filterSuffix.push(cleanJobTitle);
          }
        }

        const filename =
          filterSuffix.length > 0
            ? `candidates_export_${filterSuffix.join("_")}`
            : "candidates_export";

        await exportToExcel(excelRows, filename);
      }

      const filterInfo = [];
      if (reportDateRange) filterInfo.push(`last ${reportDateRange} days`);
      if (reportJobTitle) {
        const selectedJob = postings.find((p) => p._id === reportJobTitle);
        if (selectedJob) filterInfo.push(`"${selectedJob.title}" job only`);
      }

      const filterText =
        filterInfo.length > 0 ? ` (${filterInfo.join(", ")})` : "";
      toast.success(
        `${dataToExport.length} candidates exported to ${format.toUpperCase()}${filterText}!`,
      );
    } catch (error) {
      console.error("Export error details:", error);
      toast.error(
        "Failed to export candidates: " + (error.message || "Unknown error"),
      );
    } finally {
      setLoadingReports(false);
    }
  };

  // Load analytics data on mount and when filters change
  useEffect(() => {
    if (activeTab === "reports") {
      loadAnalytics();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, reportDateRange, reportJobTitle]);

  useEffect(() => {
    if ((activeTab === "rounds" || activeTab === "result") && roundJobId) {
      loadRoundCandidatesData(roundJobId, currentRound);
      loadStudentRoundMatrix(roundJobId);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, roundJobId, currentRound]);

  // Replace the navbar section with this updated version
  return (
    <div className="min-vh-100 bg-light">
      <header className="bg-white shadow-sm border-bottom">
        <div className="container-xxl px-3 px-md-4 mx-auto">
          <div className="row align-items-center py-3">
            <div className="col-md-6">
              <div className="d-flex align-items-center">
                <div className="me-2">
                  <div
                    className="bg-success rounded-circle d-flex align-items-center justify-content-center"
                    style={{ width: "48px", height: "48px" }}
                  >
                    <i className="bi bi-building fs-4 text-white "></i>
                  </div>
                </div>
                <div>
                  <h4 className="mb-0 fw-bold text-dark">
                    {companyInfo.companyName ||
                      userInfo?.companyName ||
                      "Company Portal"}
                  </h4>
                  <p className="mb-0 text-muted small">
                    {companyInfo?.email || userInfo?.email || ""}
                  </p>
                </div>
              </div>
            </div>
            <div className="col-md-6 text-end">
              <div className="d-flex align-items-center justify-content-end gap-3">
                <button
                  className="btn btn-outline-danger btn-sm"
                  onClick={handleLogout}
                >
                  <i className="bi bi-box-arrow-right me-1"></i>
                  <span className="d-none d-sm-inline">Logout</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Tab Navigation */}
      <div className="container-xxl px-3 px-md-4 pt-3 mx-auto">
        <ul className="nav nav-tabs nav-fill mb-0" role="tablist">
          <li className="nav-item" role="presentation">
            <button
              className={`nav-link ${activeTab === "dashboard" ? "active" : ""}`}
              onClick={() => setActiveTab("dashboard")}
              type="button"
              role="tab"
            >
              <i className="bi bi-speedometer2 me-2"></i>
              Dashboard
            </button>
          </li>
          <li className="nav-item" role="presentation">
            <button
              className={`nav-link ${activeTab === "Applications" ? "active" : ""}`}
              onClick={() => setActiveTab("Applications")}
              type="button"
              role="tab"
            >
              <i className="bi bi-people me-2"></i>
              Student Applications
            </button>
          </li>
          <li className="nav-item" role="presentation">
            <button
              className={`nav-link ${activeTab === "rounds" ? "active" : ""}`}
              onClick={() => setActiveTab("rounds")}
              type="button"
              role="tab"
            >
              <i className="bi bi-diagram-3 me-2"></i>
              Interview Rounds
            </button>
          </li>
          <li className="nav-item" role="presentation">
            <button
              className={`nav-link ${activeTab === "result" ? "active" : ""}`}
              onClick={() => setActiveTab("result")}
              type="button"
              role="tab"
            >
              <i className="bi bi-table me-2"></i>
              Result
            </button>
          </li>
          <li className="nav-item" role="presentation">
            <button
              className={`nav-link ${activeTab === "reports" ? "active" : ""}`}
              onClick={() => setActiveTab("reports")}
              type="button"
              role="tab"
            >
              <i className="bi bi-graph-up me-2"></i>
              Reports & Analytics
            </button>
          </li>
        </ul>
      </div>

      {/* Main Content */}
      <div className="container-xxl px-3 px-md-4 py-4 mx-auto">
        {activeTab === "dashboard" && (
          <div className="row g-4">
            {/* Job Creation Form */}
            <div className="col-lg-6">
              <div className="card shadow-sm h-100">
                <div className="card-header bg-primary text-white">
                  <h5 className="card-title mb-0">
                    <i className="bi bi-plus-circle me-2"></i>
                    Create New Job Posting
                  </h5>
                </div>
                <div className="card-body">
                  <form onSubmit={onSubmit}>
                    <div className="row g-3">
                      <div className="col-12">
                        <label className="form-label fw-semibold">
                          Job Title *
                        </label>
                        <input
                          name="title"
                          className="form-control"
                          value={form.title}
                          onChange={onChange}
                          placeholder="e.g., Full Stack Developer"
                          required
                        />
                      </div>
                      <div className="col-12">
                        <label className="form-label fw-semibold">
                          Job Description *
                        </label>
                        <textarea
                          name="description"
                          className="form-control"
                          rows="4"
                          value={form.description}
                          onChange={onChange}
                          placeholder="Describe the job role, responsibilities, and requirements..."
                          required
                        />
                      </div>
                      <div className="col-md-6">
                        <label className="form-label fw-semibold">
                          Technologies/Skills *
                        </label>
                        <input
                          name="technology"
                          className="form-control"
                          value={form.technology}
                          onChange={onChange}
                          placeholder="e.g., React, Node.js, MongoDB"
                          required
                        />
                        <small className="text-muted">
                          Separate multiple skills with commas
                        </small>
                      </div>
                      <div className="col-md-6">
                        <label className="form-label fw-semibold">
                          Job Type *
                        </label>
                        <select
                          name="jobType"
                          className="form-select"
                          value={form.jobType}
                          onChange={onChange}
                          required
                        >
                          <option value="Full-time">Full-time</option>
                          <option value="Part-time">Part-time</option>
                          <option value="Internship">Internship</option>
                          <option value="Contract">Contract</option>
                        </select>
                      </div>
                      <div className="col-md-6">
                        <label className="form-label fw-semibold">
                          Location *
                        </label>
                        <input
                          name="location"
                          className="form-control"
                          value={form.location}
                          onChange={onChange}
                          placeholder="e.g., Mumbai, India / Remote"
                          required
                        />
                      </div>
                      <div className="col-md-6">
                        <label className="form-label fw-semibold">
                          Application Deadline *
                        </label>
                        <input
                          type="date"
                          name="date"
                          min={today}
                          className="form-control"
                          value={form.date}
                          onChange={onChange}
                          required
                        />
                      </div>
                    </div>

                    {/* Optional fields in expandable section */}
                    <div className="mt-4">
                      <h6 className="text-muted mb-3">
                        <i className="bi bi-gear me-1"></i>
                        Additional Details (Optional)
                      </h6>
                      <div className="row g-3">
                        <div className="col-md-6">
                          <label className="form-label">Salary Range</label>
                          <input
                            name="salary"
                            className="form-control"
                            value={form.salary}
                            onChange={onChange}
                            placeholder="e.g., ₹5–8 LPA"
                          />
                        </div>
                        <div className="col-md-6">
                          <label className="form-label">Stipend</label>
                          <input
                            name="stipend"
                            className="form-control"
                            value={form.stipend}
                            onChange={onChange}
                            placeholder="e.g., ₹25,000/month"
                          />
                        </div>
                        <div className="col-md-6">
                          <label className="form-label">Bond Period</label>
                          <input
                            name="bond"
                            className="form-control"
                            value={form.bond}
                            onChange={onChange}
                            placeholder="e.g., 2 years"
                          />
                        </div>
                        <div className="col-md-6">
                          <label className="form-label">
                            Min CGPA Required
                          </label>
                          <input
                            name="minCGPA"
                            type="number"
                            step="0.1"
                            min="0"
                            max="10"
                            className="form-control"
                            value={form.minCGPA}
                            onChange={onChange}
                            placeholder="e.g., 7.0"
                          />
                        </div>
                      </div>
                    </div>

                    <div className="mt-4 d-grid">
                      <button
                        className="btn btn-primary btn-lg"
                        disabled={loading}
                        type="submit"
                      >
                        {loading ? (
                          <>
                            <span
                              className="spinner-border spinner-border-sm me-2"
                              role="status"
                            ></span>
                            Creating...
                          </>
                        ) : (
                          <>
                            <i className="bi bi-plus-lg me-2"></i>
                            Create Job Posting
                          </>
                        )}
                      </button>
                    </div>
                  </form>
                </div>
              </div>
            </div>

            {/* Right Column */}
            <div className="col-lg-6">
              <div className="row g-4">
                {/* My Job Postings */}
                <div className="col-12 ">
                  <div className="card shadow-sm ">
                    <div className="card-header bg-light">
                      <div className="d-flex justify-content-between align-items-center">
                        <h5 className="card-title mb-0">
                          <i className="bi bi-briefcase me-2"></i>
                          My Job Postings
                        </h5>
                        <div className="d-flex gap-2">
                          {postings.filter((p) => p.status === "Active")
                            .length > 0 && (
                            <span className="badge bg-success rounded-pill">
                              {
                                postings.filter((p) => p.status === "Active")
                                  .length
                              }{" "}
                              Active
                            </span>
                          )}
                          {postings.filter((p) => p.status === "Expired")
                            .length > 0 && (
                            <span className="badge bg-warning rounded-pill">
                              {
                                postings.filter((p) => p.status === "Expired")
                                  .length
                              }{" "}
                              Expired
                            </span>
                          )}
                          {postings.filter((p) => p.status === "Closed")
                            .length > 0 && (
                            <span className="badge bg-danger rounded-pill">
                              {
                                postings.filter((p) => p.status === "Closed")
                                  .length
                              }{" "}
                              Closed
                            </span>
                          )}
                          {postings.length === 0 && (
                            <span className="badge bg-secondary rounded-pill">
                              0 Postings
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="card-body p-0">
                      {postings.length === 0 ? (
                        <div className="text-center py-4">
                          <i className="bi bi-briefcase display-6 text-muted mb-2"></i>
                          <p className="text-muted mb-0">No job postings yet</p>
                        </div>
                      ) : (
                        <div
                          className="list-group list-group-flush navbar-nav-scroll" //navbar-nav-scroll
                          style={{ maxHeight: "762px" }}
                        >
                          {postings.slice(0).map((posting) => (
                            <div
                              key={posting._id}
                              className="list-group-item list-group-item-action"
                              role="button"
                              onClick={() => setSelectedPosting(posting)}
                              style={{ cursor: "pointer" }}
                            >
                              <div className="d-flex justify-content-between align-items-start">
                                <div className="flex-grow-1">
                                  <h6 className="mb-1 fw-semibold">
                                    {posting.title}
                                  </h6>
                                  {/* <p className="mb-1 text-muted small">
																	{posting.description.length > 100
																		? posting.description.substring(0, 100) +
																		"..."
																		: posting.description}
																</p> */}
                                  <div className="d-flex gap-2 mt-2">
                                    {posting.technology
                                      ?.slice(0, 3)
                                      .map((tech, index) => (
                                        <span
                                          key={index}
                                          className="badge bg-primary text-white small"
                                        >
                                          {tech}
                                        </span>
                                      ))}
                                    {posting.technology?.length > 3 && (
                                      <span className="badge bg-secondary small">
                                        +{posting.technology.length - 3} more
                                      </span>
                                    )}
                                  </div>
                                </div>
                                <div className="text-end ms-3">
                                  <span
                                    className={`badge ${
                                      posting.status === "Active"
                                        ? "bg-success"
                                        : posting.status === "Closed"
                                          ? "bg-danger"
                                          : "bg-warning"
                                    }`}
                                  >
                                    {posting.status}
                                  </span>
                                  {posting.hiddenFromStudents && (
                                    <div className="mt-1">
                                      <span className="badge bg-dark small">Hidden from students</span>
                                    </div>
                                  )}
                                  {posting.cgpaRequirementWaived && (
                                    <div className="mt-1">
                                      <span className="badge bg-info text-dark small">CGPA waived (admin)</span>
                                    </div>
                                  )}
                                  <div className="small text-muted mt-1">
                                    {new Date(
                                      posting.applicationDeadline,
                                    ).toLocaleDateString()}
                                  </div>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Job posting details modal */}
                {selectedPosting && (
                  <div
                    className="modal fade show"
                    style={{ display: "block", backgroundColor: "rgba(0,0,0,0.45)" }}
                    onClick={(e) => e.target === e.currentTarget && setSelectedPosting(null)}
                  >
                    <div className="modal-dialog modal-lg modal-dialog-centered modal-dialog-scrollable">
                      <div className="modal-content border-0 shadow-lg rounded-4 overflow-hidden" onClick={(e) => e.stopPropagation()}>
                        {/* Header with gradient */}
                        <div
                          className="modal-header border-0 text-white py-4 px-4"
                          style={{ background: "linear-gradient(135deg, #0d6efd 0%, #0a58ca 100%)" }}
                        >
                          <div className="flex-grow-1">
                            <div className="d-flex align-items-center gap-2 mb-1 opacity-90 small">
                              <i className="bi bi-building"></i>
                              <span>{companyInfo.companyName || "Company"}</span>
                            </div>
                            <h4 className="modal-title fw-bold mb-0 text-white">
                              {selectedPosting.title || "Job Position"}
                            </h4>
                          </div>
                          <button
                            type="button"
                            className="btn-close btn-close-white"
                            aria-label="Close"
                            onClick={() => setSelectedPosting(null)}
                          />
                        </div>
                        <div className="modal-body p-4 bg-light bg-opacity-50">
                          {/* Job type badge */}
                          <div className="mb-4">
                            <span
                              className={`badge rounded-pill fs-6 px-4 py-2 shadow-sm ${
                                selectedPosting.jobType === "Full-time"
                                  ? "bg-success"
                                  : selectedPosting.jobType === "Internship"
                                  ? "bg-info"
                                  : selectedPosting.jobType === "Part-time"
                                  ? "bg-warning text-dark"
                                  : "bg-secondary"
                              }`}
                            >
                              {selectedPosting.jobType || "Not specified"}
                            </span>
                          </div>

                          {/* Key metrics grid - card style */}
                          <div className="row g-3 mb-4">
                            {[
                              {
                                icon: "bi-calendar-event",
                                color: "warning",
                                label: "Deadline",
                                value: selectedPosting.applicationDeadline
                                  ? new Date(selectedPosting.applicationDeadline).toLocaleDateString("en-US", {
                                      month: "short",
                                      day: "numeric",
                                    })
                                  : "Open",
                              },
                              {
                                icon: "bi-cash",
                                color: "info",
                                label: "Stipend",
                                value: selectedPosting.stipend || "N/A",
                              },
                              {
                                icon: "bi-card-checklist",
                                color: "danger",
                                label: "Bond",
                                value: selectedPosting.bond || "N/A",
                              },
                              {
                                icon: "bi-currency-rupee",
                                color: "success",
                                label: "Salary",
                                value: selectedPosting.salary || "N/A",
                              },
                              {
                                icon: "bi-bookmark-check-fill",
                                color: "warning",
                                label: "minCGPA",
                                value: selectedPosting.minCGPA || "N/A",
                              },
                              {
                                icon: "bi-flag-fill",
                                color: "primary",
                                label: "Status",
                                badge: true,
                                status: selectedPosting.status,
                              },
                            ].map((item, idx) => (
                              <div key={idx} className="col-6 col-sm-4">
                                <div className="card border-0 shadow-sm h-100 rounded-3 overflow-hidden">
                                  <div className="card-body text-center py-3 px-2">
                                    <i className={`bi ${item.icon} text-${item.color} fs-4 mb-1 d-block`}></i>
                                    <div className="small text-muted text-uppercase">{item.label}</div>
                                    {item.badge ? (
                                      <span
                                        className={`badge rounded-pill mt-1 ${
                                          item.status === "Active"
                                            ? "bg-success"
                                            : item.status === "Closed"
                                            ? "bg-danger"
                                            : "bg-warning text-dark"
                                        }`}
                                      >
                                        {item.status || "N/A"}
                                      </span>
                                    ) : (
                                      <div className="fw-semibold text-dark small">{item.value}</div>
                                    )}
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>

                          {/* Technologies & Skills */}
                          {selectedPosting.technology && selectedPosting.technology.length > 0 && (
                            <div className="mb-4">
                              <div className="d-flex align-items-center gap-2 mb-3">
                                <div className="rounded-3 bg-primary bg-opacity-10 p-2">
                                  <i className="bi bi-tools text-primary"></i>
                                </div>
                                <h6 className="fw-bold text-dark mb-0">Technologies & Skills</h6>
                              </div>
                              <div className="d-flex flex-wrap gap-2">
                                {(Array.isArray(selectedPosting.technology)
                                  ? selectedPosting.technology
                                  : [selectedPosting.technology]
                                ).map((tech, index) => (
                                  <span
                                    key={index}
                                    className="badge rounded-pill bg-primary bg-opacity-10 text-primary border border-primary border-opacity-25 px-3 py-2 fw-normal"
                                  >
                                    {tech}
                                  </span>
                                ))}
                              </div>
                            </div>
                          )}

                          {/* Job Description */}
                          {selectedPosting.description && (
                            <div className="card border-0 shadow-sm rounded-3 overflow-hidden">
                              <div className="card-body p-4">
                                <div className="d-flex align-items-center gap-2 mb-3">
                                  <div className="rounded-3 bg-success bg-opacity-10 p-2">
                                    <i className="bi bi-file-text text-success"></i>
                                  </div>
                                  <h6 className="fw-bold text-dark mb-0">Job Description</h6>
                                </div>
                                <div className="text-dark lh-base" style={{ whiteSpace: "pre-wrap" }}>
                                  {selectedPosting.description}
                                </div>
                              </div>
                            </div>
                          )}
                        </div>
                        <div className="modal-footer border-0 bg-white px-4 py-3">
                          <button
                            type="button"
                            className="btn btn-primary rounded-pill px-4 shadow-sm"
                            onClick={() => setSelectedPosting(null)}
                          >
                            <i className="bi bi-x-lg me-2"></i>
                            Close
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Applications Table */}
                {/* <div className="col-12">
                  <div className="card shadow-sm">
                    <div className="card-header bg-light">
                      <div className="d-flex justify-content-between align-items-center">
                        <h5 className="card-title mb-0">
                          <i className="bi bi-people me-2"></i>
                          Student Applications
                        </h5>
                        <span className="badge bg-primary rounded-pill">
                          {apps.length} Application
                          {apps.length !== 1 ? "s" : ""}
                        </span>
                      </div>
                    </div>
                    <div className="card-body p-0">
                      {apps.length === 0 ? (
                        <div className="text-center py-5">
                          <i className="bi bi-inbox display-4 text-muted mb-3"></i>
                          <h5 className="text-muted">No Applications Yet</h5>
                          <p className="text-muted mb-0">
                            Create your first job posting to start receiving
                            applications
                          </p>
                        </div>
                      ) : (
                        <div
                          className="table-responsive  navbar-nav-scroll"
                          style={{ maxHeight: "450px" }}
                        >
                          <table className="table table-hover align-middle mb-0">
                            <thead className="table-light">
                              <tr>
                                <th className="fw-semibold px-3 py-3">
                                  Student
                                </th>
                                <th className="fw-semibold px-3 py-3">
                                  Technology
                                </th>
                                <th className="fw-semibold px-3 py-3">
                                  Applied Date
                                </th>
                                <th className="fw-semibold px-4 py-3 text-center">
                                  Status
                                </th>
                              </tr>
                            </thead>
                            <tbody>
                              {apps.map((a) => (
                                <tr key={a._id}>
                                  <td className="px-3 py-3">
                                    <div>
                                      <div className="fw-semibold text-dark">
                                        {a.userId?.studentProfile?.name ||
                                          a.name ||
                                          "N/A"}
                                      </div>
                                      <div
                                        className="small text-muted text-truncate"
                                        style={{ maxWidth: "200px" }}
                                      >
                                        {a.userId?.email ||
                                          a.studentEmail ||
                                          "N/A"}
                                      </div>
                                    </div>
                                  </td>
                                  <td className="px-3 py-3">
                                    <div className="d-flex flex-wrap gap-1">
                                      {(a.jobId?.technology
                                        ? Array.isArray(a.jobId.technology)
                                          ? a.jobId.technology
                                          : [a.jobId.technology]
                                        : a.technology
                                          ? [a.technology]
                                          : ["N/A"]
                                      ).map((tech, index) => (
                                        <span
                                          key={index}
                                          className="badge bg-light text-dark border small"
                                        >
                                          {tech}
                                        </span>
                                      ))}
                                    </div>
                                  </td>
                                  <td className="px-3 py-3 text-muted">
                                    {new Date(a.createdAt).toLocaleDateString(
                                      "en-US",
                                      {
                                        month: "short",
                                        day: "numeric",
                                        year: "numeric",
                                      },
                                    )}
                                  </td>
                                  <td className="px-3 py-3 text-center">
                                    <span
                                      className={`badge rounded-pill px-3 py-2 bg-info text-dark ${a.status === "Applied"}`}
                                    >
                                      {a.status}
                                    </span>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>
                  </div>
                </div> */}
              </div>
            </div>
          </div>
        )}

		{/* Applications Table */}
        {activeTab === "Applications" && (
          <div className="col-12">
            <div className="card shadow-sm">
              <div className="card-header bg-light">
                <div className="d-flex justify-content-between align-items-center">
                  <h5 className="card-title mb-0">
                    <i className="bi bi-people me-2"></i>
                    Student Applications
                  </h5>
                  <span className="badge bg-primary rounded-pill">
                    {apps.length} Application
                    {apps.length !== 1 ? "s" : ""}
                  </span>
                </div>
              </div>
              <div className="card-body p-0">
                {apps.length === 0 ? (
                  <div className="text-center py-5">
                    <i className="bi bi-inbox display-4 text-muted mb-3"></i>
                    <h5 className="text-muted">No Applications Yet</h5>
                    <p className="text-muted mb-0">
                      Create your first job posting to start receiving
                      applications
                    </p>
                  </div>
                ) : (
                  <div
                    className="table-responsive  navbar-nav-scroll"
                    style={{ maxHeight: "450px" }}
                  >
                    <table className="table table-hover align-middle mb-0">
                      <thead className="table-light">
                        <tr>
                          <th className="fw-semibold px-3 py-3">Student</th>
                          <th className="fw-semibold px-3 py-3">Job Title</th>
                          <th className="fw-semibold px-3 py-3">Current semester</th>
                          <th className="fw-semibold px-3 py-3">
                            Applied Date
                          </th>
                          <th className="fw-semibold px-3 py-3">Resume</th>
                          <th className="fw-semibold px-4 py-3 text-center">
                            Status
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {apps.map((a) => (
                          <tr key={a._id}>
                            <td className="px-3 py-3">
                              <div>
                                <div className="fw-semibold text-dark">
                                  {a.userId?.studentProfile?.name ||
                                    a.name ||
                                    "N/A"}
                                </div>
                                <div
                                  className="small text-muted text-truncate"
                                  style={{ maxWidth: "200px" }}
                                >
                                  {a.userId?.email || a.studentEmail || "N/A"}
                                </div>
                              </div>
                            </td>
                            <td className="px-3 py-3">
                              <span className="text-dark">
                                {a.jobId?.title || "N/A"}
                              </span>
                            </td>
                            <td className="px-3 py-3 text-muted">
                              {a.lastSemester || "—"}
                            </td>
                            <td className="px-3 py-3 text-muted">
                              {new Date(a.createdAt).toLocaleDateString(
                                "en-US",
                                {
                                  month: "short",
                                  day: "numeric",
                                  year: "numeric",
                                },
                              )}
                            </td>
                            <td className="px-3 py-3">
                              {a.resume ? (
                                <a
                                  href={`${apiBase}/uploads/${a.resume}`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-primary text-decoration-none d-inline-flex align-items-center gap-1"
                                >
                                  <i className="bi bi-file-earmark-pdf"></i>
                                  View Resume
                                </a>
                              ) : (
                                <span className="text-muted">—</span>
                              )}
                            </td>
                            <td className="px-3 py-3 text-center">
                              <span
                                className={`badge rounded-pill px-3 py-2 ${
                                  a.status === "Selected"
                                    ? "bg-success"
                                    : a.status === "Rejected"
                                    ? "bg-danger"
                                    : "bg-info text-dark"
                                }`}
                              >
                                {a.status || "Applied"}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {activeTab === "rounds" && (
          <div className="row g-4">
            <div className="col-12">
              <div className="card shadow-sm">
                <div className="card-header bg-light">
                  <h5 className="card-title mb-0">
                    <i className="bi bi-diagram-3 me-2"></i>
                    Interview Round Management
                  </h5>
                </div>
                <div className="card-body">
                  <div className="row g-3 mb-4">
                    <div className="col-md-5">
                      <label className="form-label fw-semibold">Job Title</label>
                      <select
                        className="form-select"
                        value={roundJobId}
                        onChange={(e) => setRoundJobId(e.target.value)}
                      >
                        <option value="">Select Job Title</option>
                        {postings.map((posting) => (
                          <option key={posting._id} value={posting._id}>
                            {posting.title}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="col-md-3">
                      <label className="form-label fw-semibold">Current Round</label>
                      <select
                        className="form-select"
                        value={currentRound}
                        onChange={(e) => setCurrentRound(e.target.value)}
                      >
                        <option value="1">Round 1</option>
                        <option value="2">Round 2</option>
                        <option value="3">Round 3</option>
                        <option value="4">Round 4 (Final)</option>
                      </select>
                    </div>
                    <div className="col-md-4 d-flex align-items-end gap-2">
                      <button
                        className="btn btn-outline-primary"
                        onClick={() =>
                          loadRoundCandidatesData(roundJobId, currentRound)
                        }
                        disabled={!roundJobId || loadingRoundData}
                      >
                        {loadingRoundData ? "Loading..." : "Load Students"}
                      </button>
                      <button
                        className="btn btn-success"
                        onClick={handleSaveRoundSelection}
                        disabled={
                          savingRoundData ||
                          Number(currentRound) >= 4 ||
                          selectedRoundCandidates.length === 0
                        }
                      >
                        {savingRoundData
                          ? "Saving..."
                          : `Move to Round ${Math.min(Number(currentRound) + 1, 4)}`}
                      </button>
                    </div>
                  </div>

                  <div className="table-responsive border rounded">
                    <table className="table table-hover align-middle mb-0">
                      <thead className="table-light">
                        <tr>
                          <th className="px-3 py-3 text-center">Select</th>
                          <th className="px-3 py-3">No.</th>
                          <th className="px-3 py-3">Student Name</th>
                          <th className="px-3 py-3">Student Email</th>
                          <th className="px-3 py-3">Current Round</th>
                        </tr>
                      </thead>
                      <tbody>
                        {!roundJobId ? (
                          <tr>
                            <td colSpan="5" className="text-center text-muted py-4">
                              Please select a Job Title to view round-wise students.
                            </td>
                          </tr>
                        ) : roundCandidates.length === 0 ? (
                          <tr>
                            <td colSpan="5" className="text-center text-muted py-4">
                              No students found for selected job and round.
                            </td>
                          </tr>
                        ) : (
                          roundCandidates.map((candidate, index) => (
                            <tr key={candidate._id}>
                              <td className="px-3 py-3 text-center">
                                <input
                                  type="checkbox"
                                  className="form-check-input"
                                  checked={selectedRoundCandidates.includes(candidate._id)}
                                  onChange={() =>
                                    toggleCandidateSelection(candidate._id)
                                  }
                                  disabled={
                                    Number(currentRound) >= 4 ||
                                    Number(candidate.interviewRound || 1) !== Number(currentRound)
                                  }
                                />
                              </td>
                              <td className="px-3 py-3">{index + 1}</td>
                              <td className="px-3 py-3">
                                {candidate.userId?.studentProfile?.name || "N/A"}
                              </td>
                              <td className="px-3 py-3">
                                {candidate.userId?.email || "N/A"}
                              </td>
                              <td className="px-3 py-3">
                                Round {candidate.interviewRound || 1}
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                  <div className="small text-muted mt-2">
                    Shows students who reached selected round (Yes). You can
                    select only students currently in this exact round to move
                    them to next round.
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === "result" && (
          <div className="row g-4">
            <div className="col-12">
              <div className="card shadow-sm">
                <div className="card-header bg-light">
                  <h5 className="card-title mb-0">
                    <i className="bi bi-table me-2"></i>
                    Result
                  </h5>
                </div>
                <div className="card-body">
                  <div className="row g-3 mb-4">
                    <div className="col-md-6">
                      <label className="form-label fw-semibold">Job Title</label>
                      <select
                        className="form-select"
                        value={roundJobId}
                        onChange={(e) => setRoundJobId(e.target.value)}
                      >
                        <option value="">Select Job Title</option>
                        {postings.map((posting) => (
                          <option key={posting._id} value={posting._id}>
                            {posting.title}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="col-md-6">
                      <label className="form-label fw-semibold">Round Result</label>
                      <select
                        className="form-select"
                        value={summaryRoundFilter}
                        onChange={(e) => setSummaryRoundFilter(e.target.value)}
                      >
                        <option value="all">All Round Result</option>
                        <option value="1">Round 1</option>
                        <option value="2">Round 2</option>
                        <option value="3">Round 3</option>
                        <option value="4">Final Round</option>
                      </select>
                    </div>
                  </div>
                  <div className="d-flex justify-content-end mb-3">
                    <button
                      className="btn btn-outline-success btn-sm"
                      onClick={handleExportRoundSummaryExcel}
                      disabled={loadingRoundSummary || studentRoundRows.length === 0}
                    >
                      <i className="bi bi-file-earmark-excel me-1"></i>
                      Export Excel
                    </button>
                  </div>

                  <div className="table-responsive border rounded">
                    <table className="table table-striped align-middle mb-0">
                      <thead className="table-light">
                        <tr>
                          <th className="px-3 py-3">Student Email</th>
                          {summaryRoundFilter === "all" ? (
                            <>
                              <th className="px-3 py-3 text-center">Round 1</th>
                              <th className="px-3 py-3 text-center">Round 2</th>
                              <th className="px-3 py-3 text-center">Round 3</th>
                              <th className="px-3 py-3 text-center">Final Round</th>
                            </>
                          ) : (
                            <th className="px-3 py-3 text-center">
                              {summaryRoundFilter === "4" ? "Final Round" : `Round ${summaryRoundFilter}`}
                            </th>
                          )}
                        </tr>
                      </thead>
                      <tbody>
                        {!roundJobId ? (
                          <tr>
                            <td
                              colSpan={summaryRoundFilter === "all" ? "5" : "2"}
                              className="text-center text-muted py-4"
                            >
                              Please select a Job Title to view result.
                            </td>
                          </tr>
                        ) : loadingRoundSummary ? (
                          <tr>
                            <td
                              colSpan={summaryRoundFilter === "all" ? "5" : "2"}
                              className="text-center text-muted py-4"
                            >
                              Loading result...
                            </td>
                          </tr>
                        ) : studentRoundRows.length === 0 ? (
                          <tr>
                            <td
                              colSpan={summaryRoundFilter === "all" ? "5" : "2"}
                              className="text-center text-muted py-4"
                            >
                              No result data found.
                            </td>
                          </tr>
                        ) : (
                          studentRoundRows.map((row) => (
                            <tr key={row.applicationId}>
                              <td className="px-3 py-3">{row.studentEmail}</td>
                              {summaryRoundFilter === "all" ? (
                                <>
                                  <td className="px-3 py-3 text-center">{row.round1}</td>
                                  <td className="px-3 py-3 text-center">{row.round2}</td>
                                  <td className="px-3 py-3 text-center">{row.round3}</td>
                                  <td className="px-3 py-3 text-center">{row.finalRound}</td>
                                </>
                              ) : (
                                <td className="px-3 py-3 text-center">
                                  {summaryRoundFilter === "1"
                                    ? row.round1
                                    : summaryRoundFilter === "2"
                                      ? row.round2
                                      : summaryRoundFilter === "3"
                                        ? row.round3
                                        : row.finalRound}
                                </td>
                              )}
                            </tr>
                          ))
                        )}
                      </tbody>
                      <tfoot className="table-light">
                        <tr>
                          <th className="px-3 py-3">TOTAL</th>
                          {summaryRoundFilter === "all" ? (
                            <>
                              <th className="px-3 py-3 text-center">{studentRoundTotals.round1 || 0}</th>
                              <th className="px-3 py-3 text-center">{studentRoundTotals.round2 || 0}</th>
                              <th className="px-3 py-3 text-center">{studentRoundTotals.round3 || 0}</th>
                              <th className="px-3 py-3 text-center">{studentRoundTotals.finalRound || 0}</th>
                            </>
                          ) : (
                            <th className="px-3 py-3 text-center">
                              {summaryRoundFilter === "1"
                                ? studentRoundTotals.round1 || 0
                                : summaryRoundFilter === "2"
                                  ? studentRoundTotals.round2 || 0
                                  : summaryRoundFilter === "3"
                                    ? studentRoundTotals.round3 || 0
                                    : studentRoundTotals.finalRound || 0}
                            </th>
                          )}
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

		{/* Reports Analytics */}
        {activeTab === "reports" && (
          <div className="row g-4">
            {/* Analytics Cards */}
            <div className="col-lg-12">
              <div className="card shadow-sm">
                <div className="card-header bg-info text-white">
                  <h5 className="card-title mb-0">
                    <i className="bi bi-graph-up me-2"></i>
                    Analytics & Reports
                  </h5>
                </div>
                <div className="card-body">
                  {/* Filter Controls */}
                  <div className="row g-3 mb-4">
                    <div className="col-md-3">
                      <label className="form-label fw-semibold">
                        Date Range
                      </label>
                      <select
                        className="form-select"
                        value={reportDateRange}
                        onChange={(e) => setReportDateRange(e.target.value)}
                      >
                        <option value="15">Last 15 Days</option>
                        <option value="30">Last 30 Days</option>
                        <option value="90">Last 3 Months</option>
                        <option value="180">Last 6 Months</option>
                        <option value="365">Last Year</option>
                      </select>
                    </div>
                    {/* <div className="col-md-3">
											<label className="form-label fw-semibold">Job Status</label>
											<select
												className="form-select"
												value={reportJobStatus}
												onChange={(e) => setReportJobStatus(e.target.value)}
											>
												<option value="">All Jobs</option>
												<option value="Active">Active Only</option>
												<option value="Closed">Closed Only</option>
												<option value="Expired">Expired Only</option>
											</select>
										</div> */}
                    <div className="col-md-3">
                      <label className="form-label fw-semibold">
                        Job Title
                      </label>
                      <select
                        className="form-select"
                        value={reportJobTitle}
                        onChange={(e) => setReportJobTitle(e.target.value)}
                      >
                        <option value="">All Job Titles</option>
                        {postings.map((posting) => (
                          <option key={posting._id} value={posting._id}>
                            {posting.title}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {/* Analytics Summary Cards */}
                  {analytics && (
                    <div className="row g-3 mb-4">
                      <div className="col-md-3">
                        <div className="card bg-primary text-white">
                          <div className="card-body text-center">
                            <i className="bi bi-briefcase fs-1 mb-2"></i>
                            <h3 className="mb-0">{analytics.totalJobs || 0}</h3>
                            <p className="mb-0">Total Jobs Posted</p>
                          </div>
                        </div>
                      </div>
                      <div className="col-md-3">
                        <div className="card bg-success text-white">
                          <div className="card-body text-center">
                            <i className="bi bi-people fs-1 mb-2"></i>
                            <h3 className="mb-0">
                              {analytics.totalApplications || 0}
                            </h3>
                            <p className="mb-0">Total Applications</p>
                          </div>
                        </div>
                      </div>
                      <div className="col-md-3">
                        <div className="card bg-info text-white">
                          <div className="card-body text-center">
                            <i className="bi bi-graph-up fs-1 mb-2"></i>
                            <h3 className="mb-0">
                              {analytics.avgApplicationsPerJob || 0}
                            </h3>
                            <p className="mb-0">Avg Applications/Job</p>
                          </div>
                        </div>
                      </div>
                      <div className="col-md-3">
                        <div className="card bg-warning text-dark">
                          <div className="card-body text-center">
                            <i className="bi bi-calendar-check fs-1 mb-2"></i>
                            <h3 className="mb-0">
                              {analytics.activeJobs || 0}
                            </h3>
                            <p className="mb-0">Active Jobs</p>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Export Options */}
                  <div className="row g-3 mt-4">
                    <div className="col-12">
                      <div className="card bg-light">
                        <div className="card-body">
                          <h6 className="card-title">Export Options</h6>
                          <div className="mb-3">
                            <small className="text-muted">
                              {(() => {
                                const filters = [];
                                if (reportDateRange)
                                  filters.push(`Last ${reportDateRange} days`);
                                // if (reportJobStatus) filters.push(`${reportJobStatus} jobs only`);
                                if (reportJobTitle) {
                                  const selectedJob = postings.find(
                                    (p) => p._id === reportJobTitle,
                                  );
                                  if (selectedJob)
                                    filters.push(
                                      `"${selectedJob.title}" job only`,
                                    );
                                }
                                return filters.length > 0
                                  ? `Current filters: ${filters.join(", ")}`
                                  : "Exporting all data (no filters applied)";
                              })()}
                            </small>
                          </div>
                          <div className="d-flex flex-wrap gap-2">
                            <button
                              className="btn btn-outline-success btn-sm"
                              onClick={() => handleExportCandidates("excel")}
                              disabled={loadingReports}
                            >
                              <i className="bi bi-file-excel me-1"></i>
                              Excel (.xlsx)
                            </button>

                            <button
                              className="btn btn-outline-danger btn-sm"
                              onClick={handleGenerateHiringPDF}
                              disabled={loadingReports}
                            >
                              <i className="bi bi-file-pdf me-1"></i>
                              Full Report PDF
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default CompanyDashboard;
