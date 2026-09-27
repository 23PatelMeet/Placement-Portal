import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { login } from '../services/auth'
import { toast } from "react-toastify"

function Login() {
  const [form, setForm] = useState({ email: '', password: '' })
  const [loading, setLoading] = useState(false)
  // const [error, setError] = useState('')
  const navigate = useNavigate()

  const onChange = (e) => setForm({ ...form, [e.target.name]: e.target.value })
  const handleSubmit = async (e) => {
    e.preventDefault()
    // setError('')
    setLoading(true)
    try {
      const response = await login(form.email, form.password)
      if (response.token) {
        // Save token for authenticated requests
        localStorage.setItem('token', response.token)
        toast.success("Login Successful...");
        if (response.role === 'admin') {
          navigate('/admin')
        } else if (response.role === 'company') {
          navigate('/company')
        } else {
          navigate('/student')
        }
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="col-lg-12 mx-auto mt-4">
      <div className="card shadow">
        <div className="card-header bg-primary">
          <h3 className="text-light">Login</h3>
        </div>
        <div className="card-bady p-4 row">
          <form onSubmit={handleSubmit}>
            <div className="input-group mb-3">
              <input
                type="email"
                name="email"
                className="input"
                // placeholder="Email"
                value={form.email}
                onChange={onChange}
                required
              />
              <label className="label">Email</label>
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
            <button className="btn btn-brand w-100" disabled={loading}>
              {loading ? 'Signing in...' : 'Login'}
            </button>
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

  )
}

export default Login


