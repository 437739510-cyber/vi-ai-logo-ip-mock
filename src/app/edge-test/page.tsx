// EdgeOne SSR diagnostic page
import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "EdgeOne Diagnostic" };

export default function EdgeTestPage() {
  return (
    <div style={{padding:"40px", maxWidth:"600px", margin:"0 auto", fontFamily:"sans-serif"}}>
      <h1 style={{fontSize:"24px", color:"#333"}}>EdgeOne SSR Diagnostic ✅</h1>
      <p style={{color:"#666"}}>Server time: {new Date().toISOString()}</p>
      <p style={{color:"#666"}}>Node env: {String(process.env.NODE_ENV)}</p>
      <p style={{color:"#666"}}>Has fetch: {String(typeof fetch !== "undefined")}</p>
      <p style={{color:"#666"}}>Has process: {String(typeof process !== "undefined")}</p>
      <p style={{color:"#666"}}>Has Buffer: {String(typeof Buffer !== "undefined")}</p>
      <hr style={{margin:"20px 0"}} />
      <p>Pages:</p>
      <ul>
        <li><Link href="/">Homepage</Link></li>
        <li><Link href="/admin/login">Admin Login</Link></li>
        <li><Link href="/consultation">Consultation</Link></li>
      </ul>
    </div>
  );
}