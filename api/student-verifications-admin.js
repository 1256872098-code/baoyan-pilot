import { timingSafeEqual } from "node:crypto";
import {
  getServerSupabase,
  readJsonBody,
  sendJson,
} from "./student-verifications.js";

const REPORT_BUCKET = "student-verification-reports";
const REVIEW_STATUSES = new Set(["verified", "needs_more_info", "rejected"]);

export const config = {
  maxDuration: 30,
};

function isAdminTokenValid(value) {
  const expected = String(process.env.STUDENT_VERIFICATION_ADMIN_TOKEN || "");
  const actual = String(value || "");
  if (!expected || !actual) return false;
  const expectedBuffer = Buffer.from(expected, "utf8");
  const actualBuffer = Buffer.from(actual, "utf8");
  return expectedBuffer.length === actualBuffer.length && timingSafeEqual(expectedBuffer, actualBuffer);
}

function requireAdmin(request, body, response) {
  const token = request.headers["x-admin-token"] || body?.adminToken;
  if (!isAdminTokenValid(token)) {
    sendJson(response, 403, { error: "管理员凭证无效。" });
    return false;
  }
  return true;
}

async function addSignedReportUrl(supabase, row) {
  if (!row.report_file_url) return { ...row, report_signed_url: "" };
  const { data, error } = await supabase.storage.from(REPORT_BUCKET).createSignedUrl(row.report_file_url, 300);
  return { ...row, report_signed_url: error ? "" : data?.signedUrl || "" };
}

async function listVerifications(supabase, response) {
  const { data, error } = await supabase
    .from("student_verifications")
    .select("id,user_id,user_name,school_id,school_name,college_name,major_name,verification_code,report_file_url,ai_review_result,ai_review_reason,status,admin_note,submitted_at,verified_at,updated_at")
    .order("submitted_at", { ascending: false })
    .limit(200);

  if (error) {
    sendJson(response, 503, { error: "审核列表加载失败，请稍后重试。" });
    return;
  }

  const rows = await Promise.all((data || []).map((row) => addSignedReportUrl(supabase, row)));
  sendJson(response, 200, { verifications: rows });
}

async function reviewVerification(supabase, body, response) {
  const id = String(body.id || "").trim();
  const status = String(body.status || "").trim();
  const adminNote = String(body.adminNote || "").trim().slice(0, 1000);

  if (!/^[0-9a-f-]{36}$/i.test(id) || !REVIEW_STATUSES.has(status)) {
    sendJson(response, 400, { error: "审核操作参数不正确。" });
    return;
  }
  if (["needs_more_info", "rejected"].includes(status) && !adminNote) {
    sendJson(response, 400, { error: "要求补充材料或驳回时，请填写审核说明。" });
    return;
  }

  const now = new Date().toISOString();
  const { data, error } = await supabase
    .from("student_verifications")
    .update({
      status,
      admin_note: adminNote || null,
      verified_at: status === "verified" ? now : null,
      updated_at: now,
    })
    .eq("id", id)
    .select("id,user_id,user_name,school_id,school_name,college_name,major_name,verification_code,report_file_url,ai_review_result,ai_review_reason,status,admin_note,submitted_at,verified_at,updated_at")
    .single();

  if (error) {
    sendJson(response, 503, { error: "审核结果保存失败，请稍后重试。" });
    return;
  }

  sendJson(response, 200, { verification: await addSignedReportUrl(supabase, data) });
}

export default async function handler(request, response) {
  if (request.method === "OPTIONS") {
    response.statusCode = 204;
    response.end();
    return;
  }
  if (request.method !== "POST") {
    sendJson(response, 405, { error: "只支持POST请求。" });
    return;
  }

  try {
    const body = await readJsonBody(request);
    if (!requireAdmin(request, body, response)) return;
    const supabase = getServerSupabase();

    if (body.action === "list") {
      await listVerifications(supabase, response);
      return;
    }
    if (body.action === "review") {
      await reviewVerification(supabase, body, response);
      return;
    }
    sendJson(response, 400, { error: "未知的管理员操作。" });
  } catch (error) {
    if (process.env.NODE_ENV !== "production") {
      // eslint-disable-next-line no-console
      console.error("Student verification admin API failed:", error?.message || error);
    }
    sendJson(response, 503, { error: "管理员审核服务暂时不可用，请稍后重试。" });
  }
}

