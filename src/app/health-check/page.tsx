import Link from "next/link";

export default function HealthCheckPage() {
  return (
    <div style={{ padding: "40px", maxWidth: "600px", margin: "0 auto", fontFamily: "sans-serif" }}>
      <h1 style={{ fontSize: "24px", color: "#333" }}>BrandBrain Health Check ✅</h1>
      <p style={{ color: "#666", marginTop: "12px" }}>
        Server time: {new Date().toISOString()}
      </p>
      <p style={{ color: "#666" }}>
        Node env: {process.env.NODE_ENV || "not set"}
      </p>
      <p style={{ color: "#666" }}>
        EdgeOne: {typeof globalThis !== "undefined" ? "globalThis OK" : "no globalThis"}
      </p>
      <ul style={{ marginTop: "20px", lineHeight: "2" }}>
        <li><Link href="/" style={{ color: "#0066cc" }}>Back to Home</Link></li>
        <li><Link href="/admin/login" style={{ color: "#0066cc" }}>Admin Login</Link></li>
        <li><Link href="/member/login" style={{ color: "#0066cc" }}>Member Login</Link></li>
      </ul>
    </div>
  );
}