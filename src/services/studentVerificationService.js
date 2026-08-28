import { supabase } from "../lib/supabaseClient.js";

const MAX_REPORT_BYTES = 3 * 1024 * 1024;

async function getAuthHeaders(includeJson = false) {
  if (!supabase) throw new Error("学籍核验服务尚未完成配置，请稍后再试。");
  const { data, error } = await supabase.auth.getSession();
  const accessToken = data?.session?.access_token;
  if (error || !accessToken) throw new Error("请先登录后再申请学籍核验。");
  return {
    ...(includeJson ? { "Content-Type": "application/json" } : {}),
    Authorization: `Bearer ${accessToken}`,
  };
}

function readFileAsBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const value = String(reader.result || "");
      resolve(value.includes(",") ? value.split(",").pop() : value);
    };
    reader.onerror = () => reject(new Error("PDF读取失败，请重新选择文件。"));
    reader.readAsDataURL(file);
  });
}

async function parseApiResponse(response, fallbackMessage) {
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload?.error || fallbackMessage);
  return payload;
}

export function validateVerificationPdf(file) {
  if (!file) return "";
  if (file.type !== "application/pdf" && !file.name.toLowerCase().endsWith(".pdf")) {
    return "仅支持上传PDF格式的《教育部学籍在线验证报告》。";
  }
  if (file.size > MAX_REPORT_BYTES) return "PDF文件不能超过3MB。";
  return "";
}

export async function fetchLatestStudentVerification(userId) {
  if (!userId) return null;
  const response = await fetch("/api/student-verifications", { headers: await getAuthHeaders() });
  const payload = await parseApiResponse(response, "核验状态加载失败，请稍后重试。");
  return payload.verification || null;
}

export async function submitStudentVerification({
  user,
  userName,
  schoolId,
  schoolName,
  collegeName,
  majorName,
  verificationCode,
  reportFile,
}) {
  if (!user?.id) throw new Error("请先登录后再申请学籍核验。");
  const code = String(verificationCode || "").replace(/\s/g, "");
  if (!/^\d{16}$/.test(code)) throw new Error("请输入16位学信网在线验证码。");
  if (!schoolName || !collegeName?.trim() || !majorName?.trim()) {
    throw new Error("请选择认证学校，并完整填写学院和专业。");
  }

  const fileError = validateVerificationPdf(reportFile);
  if (fileError) throw new Error(fileError);

  const pdf = reportFile
    ? {
        name: reportFile.name,
        type: reportFile.type || "application/pdf",
        base64: await readFileAsBase64(reportFile),
      }
    : null;

  const response = await fetch("/api/student-verifications", {
    method: "POST",
    headers: await getAuthHeaders(true),
    body: JSON.stringify({
      userName: String(userName || user.nickname || "保研用户").trim(),
      schoolId: schoolId || null,
      schoolName,
      collegeName: collegeName.trim(),
      majorName: majorName.trim(),
      verificationCode: code,
      pdf,
    }),
  });
  const payload = await parseApiResponse(response, "材料提交失败，请稍后重试。");
  return payload.verification;
}

export async function fetchAdminStudentVerifications(adminToken) {
  const response = await fetch("/api/student-verifications-admin", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-admin-token": adminToken,
    },
    body: JSON.stringify({ action: "list" }),
  });
  const payload = await parseApiResponse(response, "审核列表加载失败，请稍后重试。");
  return payload.verifications || [];
}

export async function fetchAdminRegisteredUserCount(adminToken) {
  const response = await fetch("/api/student-verifications-admin", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-admin-token": adminToken,
    },
    body: JSON.stringify({ action: "stats" }),
  });
  const payload = await parseApiResponse(response, "注册用户统计暂时无法加载，请稍后重试。");
  const count = Number(payload?.stats?.registeredUserCount);
  if (!Number.isFinite(count)) throw new Error("注册用户统计暂时无法加载，请稍后重试。");
  return count;
}

export async function reviewStudentVerification({ adminToken, id, status, adminNote }) {
  const response = await fetch("/api/student-verifications-admin", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-admin-token": adminToken,
    },
    body: JSON.stringify({ action: "review", id, status, adminNote }),
  });
  const payload = await parseApiResponse(response, "审核结果保存失败，请稍后重试。");
  return payload.verification;
}
