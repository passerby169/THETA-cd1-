"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner"; 

export default function RegisterPage() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://47.96.154.95:8000";
      // 注册接口要求传 JSON 格式
      const response = await fetch(`${apiUrl}/api/auth/register`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          username: username,
          email: email,
          password: password
        }),
      });

      if (response.ok) {
        toast.success("注册成功！请登录");
        router.push("/login"); // 注册完自动跳转登录页
      } else {
        const errData = await response.json();
        toast.error(errData.detail || "注册失败，该邮箱或用户名可能已被使用");
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
          注册 THETA 账号
        </h2>
        <form onSubmit={handleRegister} style={{ display: "flex", flexDirection: "column", gap: "15px" }}>
          <div>
            <label style={{ display: "block", marginBottom: "5px", fontSize: "14px", color: "#374151" }}>用户名</label>
            <input type="text" required value={username} onChange={(e) => setUsername(e.target.value)}
              style={{ width: "100%", padding: "10px", borderRadius: "4px", border: "1px solid #d1d5db" }} placeholder="起个响亮的名字" />
          </div>
          <div>
            <label style={{ display: "block", marginBottom: "5px", fontSize: "14px", color: "#374151" }}>邮箱账号</label>
            <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)}
              style={{ width: "100%", padding: "10px", borderRadius: "4px", border: "1px solid #d1d5db" }} placeholder="your@email.com" />
          </div>
          <div>
            <label style={{ display: "block", marginBottom: "5px", fontSize: "14px", color: "#374151" }}>密码</label>
            <input type="password" required value={password} onChange={(e) => setPassword(e.target.value)}
              style={{ width: "100%", padding: "10px", borderRadius: "4px", border: "1px solid #d1d5db" }} placeholder="设置密码" />
          </div>
          <button type="submit" disabled={loading}
            style={{ width: "100%", padding: "12px", backgroundColor: loading ? "#9ca3af" : "#10b981", color: "white", border: "none", borderRadius: "4px", cursor: loading ? "not-allowed" : "pointer", fontSize: "16px", marginTop: "10px" }}>
            {loading ? "注册中..." : "立即注册"}
          </button>
          <div style={{ textAlign: "center", marginTop: "15px", fontSize: "14px" }}>
            已有账号？ <a href="/login" style={{ color: "#2563eb", textDecoration: "none" }}>去登录</a>
          </div>
        </form>
      </div>
    </div>
  );
}