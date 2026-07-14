import * as cheerio from "cheerio";

const thirdPartyDomains = [
  "baike.baidu.com",
  "zhihu.com",
  "weibo.com",
  "douyin.com",
  "bilibili.com",
  "sohu.com",
  "163.com",
  "qq.com",
  "gaokao.cn",
  "dxsbb.com",
  "gx211.cn",
  "yichengcareer.com",
  "chsi.com.cn",
  "cscse.edu.cn",
  "sqaad.org.cn",
  "chinaschool.com.cn",
  "showxue.com",
  "crs.jsj.edu.cn",
  "wikipedia.org",
  "baidu.com",
  "bing.com",
  "google.com",
  "sogou.com",
];

const thirdPartyText = [
  "掌上高考",
  "软科",
  "校友会",
  "培训机构",
  "留学机构",
  "保研机构",
  "新闻转载",
  "百科",
  "论坛",
  "国际本科",
  "2+2",
  "留学项目",
  "本科招生网",
  "招生代理",
  "继续教育",
  "合作学院",
  "国际商学院",
  "党政办公室",
  "教务部",
  "研究生院",
  "科学技术发展研究院",
  "国际关系学院",
  "学院介绍",
  "大学联盟",
  "校友圈",
  "高考志愿",
  "中国音乐期刊网",
];

function normalizeText(value) {
  return String(value || "").replace(/\s+/g, "").trim();
}

export function getHostname(value) {
  try {
    return new URL(value).hostname.replace(/^www\./, "");
  } catch {
    return "";
  }
}

export function isThirdPartyUrl(url) {
  const host = getHostname(url);
  return thirdPartyDomains.some((domain) => host === domain || host.endsWith(`.${domain}`));
}

function hasThirdPartyText(value) {
  return thirdPartyText.some((keyword) => String(value || "").includes(keyword));
}

async function fetchHome(url) {
  const response = await fetch(url, {
    redirect: "follow",
    headers: {
      "User-Agent": "BaoyanPilotBot/0.1 official website verification",
      Accept: "text/html,application/xhtml+xml",
    },
    signal: AbortSignal.timeout(15000),
  });

  if (!response.ok) throw new Error(`HTTP ${response.status}`);

  return {
    finalUrl: response.url,
    html: await response.text(),
  };
}

export async function verifyOfficialWebsite({ school, candidate }) {
  const url = candidate.url;
  const evidence = [];

  if (!url || isThirdPartyUrl(url) || hasThirdPartyText(`${candidate.title} ${candidate.snippet}`)) {
    return {
      schoolId: school.id,
      schoolName: school.name,
      officialWebsite: null,
      officialDomain: null,
      confidence: 0,
      evidence: ["third-party candidate rejected"],
      candidateUrls: [url].filter(Boolean),
      status: "not-found",
    };
  }

  try {
    const { finalUrl, html } = await fetchHome(url);
    const $ = cheerio.load(html);
    $("script, style, noscript").remove();
    const title = normalizeText($("title").text() || candidate.title);
    const body = normalizeText($("body").text()).slice(0, 5000);
    if (hasThirdPartyText(title)) {
      return {
        schoolId: school.id,
        schoolName: school.name,
        officialWebsite: null,
        officialDomain: null,
        confidence: 0,
        evidence: ["page title indicates non-main or third-party site"],
        candidateUrls: [url, finalUrl],
        title,
        status: "not-found",
      };
    }
    const linkText = $("a")
      .map((_, element) => normalizeText($(element).text()))
      .get()
      .join("|");
    const host = getHostname(finalUrl);
    let confidence = 0;

    if (title.includes(school.name)) {
      confidence += 0.35;
      evidence.push("title contains school name");
    }
    if (body.includes(school.name)) {
      confidence += 0.25;
      evidence.push("body contains school name");
    }
    if (candidate.title?.includes("官网") || candidate.title?.includes("官方网站") || candidate.title?.includes(school.name)) {
      confidence += 0.1;
      evidence.push("search title indicates official site");
    }
    if (host.endsWith("edu.cn")) {
      confidence += 0.15;
      evidence.push("domain ends with edu.cn");
    }
    if (/学校概况|学校简介|院系设置|学院设置|组织机构|教学单位|教学科研单位|机构设置/.test(linkText)) {
      confidence += 0.15;
      evidence.push("homepage contains university navigation links");
    }
    if (/版权所有|copyright/i.test(body)) {
      confidence += 0.05;
      evidence.push("copyright text exists");
    }

    const officialDomainLike = host.endsWith("edu.cn");
    const status = officialDomainLike && confidence >= 0.85 ? "verified" : officialDomainLike && confidence >= 0.6 ? "pending-review" : "not-found";
    return {
      schoolId: school.id,
      schoolName: school.name,
      officialWebsite: new URL("/", finalUrl).toString(),
      officialDomain: host,
      confidence: Math.min(confidence, 1),
      evidence,
      title,
      candidateUrls: [url, finalUrl],
      status,
    };
  } catch (error) {
    return {
      schoolId: school.id,
      schoolName: school.name,
      officialWebsite: null,
      officialDomain: null,
      confidence: 0,
      evidence: [`candidate inaccessible: ${error.message}`],
      candidateUrls: [url],
      status: "not-found",
    };
  }
}
