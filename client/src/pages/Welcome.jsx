import { Link } from 'react-router-dom'

function Welcome() {
  return (
    <div className="row justify-content-center">
      <div className="col-lg-8">
        <div className="card shadow-sm">
          <div className="card-body text-center">
            <h2 className="card-title mb-4">Welcome to Placement Portal</h2>
            <p className="mb-4">Are you already registered?</p>
            <div className="d-grid gap-3">
              <Link to="/login" className="btn btn-brand">Yes, I'm registered - Login</Link>
              <Link to="/register/student" className="btn btn-outline-primary">No, Register as Student</Link>
              <Link to="/register/company" className="btn btn-outline-secondary">No, Register as Company</Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default Welcome
