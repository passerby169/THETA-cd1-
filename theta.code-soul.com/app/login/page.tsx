"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner"; 

export default function LoginPage() {
  const router = useRouter();
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    const formData = new URLSearchParams();
    formData.append("username", identifier); // 后端支持在此处填入用户名或邮箱
    formData.append("password", password);

    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://47.96.154.95:8000";
      // 注意：后端的标准登录接口是 /api/auth/login
      const response = await fetch(`${apiUrl}/api/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: formData,
      });

      if (response.ok) {
        const data = await response.json();
        localStorage.setItem("access_token", data.access_token);
        localStorage.setItem("user", JSON.stringify({ username: identifier }));
        toast.success("登录成功！");
        router.push("/"); 
      } else {
        const errData = await response.json();
        toast.error(errData.detail || "账号或密码错误");
      }
    } catch (error) {
      toast.error("网络错误，无法连接到服务器");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", backgroundColor: "#f3f4f6" }}>
      <div style={{ backgroundColor: "white", padding: "40px", borderRadius: "8px", boxShadow: "0 4px 6px rgba(0,0,0,0.1)", width: "100%", maxWidth: "400px" }}>
        <h2 style={{ textAlign: "center", fontSize: "24px", fontWeight: "bold", marginBottom: "20px", color: "#111827" }}>
          THETA 平台登录
        </h2>
        <form onSubmit={handleLogin} style={{ display: "flex", flexDirection: "column", gap: "15px" }}>
          <div>
            <label style={{ display: "block", marginBottom: "5px", fontSize: "14px", color: "#374151" }}>用户名 或 邮箱</label>
            <input type="text" required value={identifier} onChange={(e) => setIdentifier(e.target.value)}
              style={{ width: "100%", padding: "10px", borderRadius: "4px", border: "1px solid #d1d5db" }} placeholder="输入用户名或邮箱" />
          </div>
          <div>
            <label style={{ display: "block", marginBottom: "5px", fontSize: "14px", color: "#374151" }}>密码</label>
            <input type="password" required value={password} onChange={(e) => setPassword(e.target.value)}
              style={{ width: "100%", padding: "10px", borderRadius: "4px", border: "1px solid #d1d5db" }} placeholder="••••••••" />
          </div>
          <button type="submit" disabled={loading}
            style={{ width: "100%", padding: "12px", backgroundColor: loading ? "#9ca3af" : "#2563eb", color: "white", border: "none", borderRadius: "4px", cursor: loading ? "not-allowed" : "pointer", fontSize: "16px", marginTop: "10px" }}>
            {loading ? "登录中..." : "登 录"}
          </button>
          <div style={{ textAlign: "center", marginTop: "15px", fontSize: "14px" }}>
            还没有账户？ <a href="/register" style={{ color: "#10b981", textDecoration: "none" }}>立即注册</a>
          </div>
        </form>
      </div>
    </div>
  );
}