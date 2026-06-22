import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function Home() {
  const { user } = useAuth();

  return (
    <div className="home-page">
      <section className="hero">
        <h1>Build your perfect resume, <span className="accent">ATS-ready</span></h1>
        <p className="hero-sub">
          CVBuilder guides you step-by-step through creating a polished, professionally formatted
          resume that passes Applicant Tracking Systems and lands on hiring managers&apos; desks.
        </p>
        {user ? (
          <Link to="/dashboard" className="btn-primary btn-lg">Go to My Resumes</Link>
        ) : (
          <div className="hero-cta">
            <Link to="/register" className="btn-primary btn-lg">Get Started — Free</Link>
            <Link to="/login" className="btn-secondary btn-lg">Log In</Link>
          </div>
        )}
      </section>

      <section className="features">
        <div className="feature-card">
          <div className="feature-icon">🧙</div>
          <h3>Step-by-step Wizard</h3>
          <p>Fill in your details one section at a time — personal info, education, experience, skills, and projects.</p>
        </div>
        <div className="feature-card">
          <div className="feature-icon">📄</div>
          <h3>3 ATS-Friendly Templates</h3>
          <p>Modern, Classic, and Minimal designs — all tested to parse cleanly through ATS scanners.</p>
        </div>
        <div className="feature-card">
          <div className="feature-icon">⬇️</div>
          <h3>One-Click PDF Export</h3>
          <p>Download a pixel-perfect PDF generated server-side — no browser printing quirks.</p>
        </div>
        <div className="feature-card">
          <div className="feature-icon">🔒</div>
          <h3>Secure by Design</h3>
          <p>Your data is protected with bcrypt, JWT sessions, rate limiting, and strict input validation.</p>
        </div>
      </section>
    </div>
  );
}
