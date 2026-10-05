#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
BOSS 直聘投递 · 本机执行器（boss-runner）

网页（简历工作台的「投递」页）只是遥控器和看板；真正干活的是这个进程：
它在你自己的 Mac 上调用投递技能脚本、驱动你自己登录了 BOSS 的 Ego 浏览器、
调用判岗模型，并把进度报给网页。关掉网页不影响它继续跑。

  启动：双击 start.command（或 python3 boss_runner.py）
  演示：python3 boss_runner.py --demo   （模拟 BOSS，不碰真实浏览器）
  退出：Ctrl+C

只依赖 macOS 自带的 python3（3.9+）和 curl，不需要装任何第三方包。

安全约定：
  - 只监听 127.0.0.1，局域网里的其他机器连不上
  - 每个请求都要带配对码（启动时打印在终端里），只接受白名单里的网页来源
  - 校验 Host 头，防 DNS 重绑定
  - 同一时刻只执行一个浏览器动作；发现别的会话（比如终端里的智能体）在操作浏览器就停手
"""

from __future__ import annotations

import argparse
import datetime as dt
import http.server
import json
import os
import random
import re
import secrets
import shutil
import subprocess
import sys
import threading
import time
import traceback
from collections import deque
from pathlib import Path
from typing import Any, Callable, Dict, List, Optional
from urllib.parse import parse_qs, urlparse

VERSION = "1.2.1"
DEFAULT_PORT = 47321
DAILY_CAP = 148
DEFAULT_LLM_ENDPOINT = "https://resume.kongbei.xyz/api/llm"
DEFAULT_ORIGINS = [
    "https://resume.kongbei.xyz",
    "http://localhost:5173",
    "http://localhost:5174",
    "http://127.0.0.1:5173",
    "http://127.0.0.1:5174",
]
APP_DIR = Path(__file__).resolve().parent
DEFAULT_DATA_DIR = Path.home() / "Library" / "Application Support" / "BossRunner"

# 浏览器动作：执行前要确认没有别的会话在用同一个标签页
BROWSER_ACTIONS = {"walk", "next", "more", "exhaust", "open", "deliver", "env"}
TIMEOUTS = {
    "walk": 150, "next": 120, "more": 150, "exhaust": 900, "reset": 15,
    "open": 60, "deliver": 150, "reject": 15, "env": 150, "report": 60,
}
EXTERNAL_WINDOW = 75  # 秒：Ego 空间这么久之内被别人碰过，就认为有人在用

PROFILE_TEMPLATE: Dict[str, Any] = {
    "_guide": "由 boss-runner 创建。全部字段都可以在网页「投递 › 判岗画像」里改。",
    "target_city": "",
    "target_cities": [],
    "city_code": "",
    "min_salary_k": 0,
    "max_salary_k": 0,
    "role_summary": "",
    "keyword_plan": ["推荐页"],
    "prefer": [],
    "avoid": [],
    "judge_rules": [
        "JD 的核心工作内容不在求职方向里的不投（标题对得上但实际做别的，也不投）",
        "「优先」「加分」类要求不算门槛；经验年限、学历不作为否决理由",
        "JD 明示工作地不在目标城市、兼职 / 合伙人 / 培训推广类岗位不投",
        "同一 JD 重复挂出不重复投",
    ],
}

PROFILE_KEYS = {
    "target_city", "target_cities", "city_code", "min_salary_k", "max_salary_k",
    "role_summary", "prefer", "avoid", "judge_rules", "keyword_plan", "experience", "accept_note",
}


# ═════════════════════════════════════════════════════════════════════
# 终端输出
# ═════════════════════════════════════════════════════════════════════

TTY = sys.stdout.isatty()
_print_lock = threading.Lock()


def _c(code: str, s: str) -> str:
    return f"\033[{code}m{s}\033[0m" if TTY else s


def dim(s: str) -> str:
    return _c("2", s)


def bold(s: str) -> str:
    return _c("1", s)


def red(s: str) -> str:
    return _c("31", s)


# 最近的日志也留一份给网页控制台（终端里看到什么，网页上就看到什么）
LOG: "deque[Dict[str, Any]]" = deque(maxlen=500)
_log_seq = 0
_ANSI = re.compile(r"\033\[[0-9;]*m")
_KIND = {"✓": "ok", "–": "skip", "!": "error", "▶": "system", "■": "system", "·": "info"}


def say(mark: str, text: str, note: str = "") -> None:
    """一行日志：时间  标记  正文  灰色备注"""
    global _log_seq
    now = dt.datetime.now().strftime("%H:%M:%S")
    line = f"{dim(now)}  {mark}  {text}"
    if note:
        line += f"  {dim(note)}"
    plain_mark = _ANSI.sub("", mark).strip()
    with _print_lock:
        print(line, flush=True)
        _log_seq += 1
        LOG.append({"seq": _log_seq, "t": now, "kind": _KIND.get(plain_mark, "info"), "mark": plain_mark,
                    "text": _ANSI.sub("", text), "note": _ANSI.sub("", note)})


def logs_since(seq: int) -> List[Dict[str, Any]]:
    with _print_lock:
        return [x for x in LOG if x["seq"] > seq][-200:]


def job_line(card: Dict[str, Any]) -> str:
    parts = [card.get("title") or "（无标题）", card.get("company") or "", card.get("salary") or ""]
    return " · ".join(p for p in parts if p)


# ═════════════════════════════════════════════════════════════════════
# 配置 / 文件
# ═════════════════════════════════════════════════════════════════════


def read_json(path: Path, fallback: Any) -> Any:
    try:
        with open(path, "r", encoding="utf-8") as f:
            return json.load(f)
    except Exception:
        return fallback


def write_json(path: Path, data: Any, private: bool = False) -> None:
    """原子写：先写临时文件再改名，进程中途被杀也不会留下半个文件"""
    path.parent.mkdir(parents=True, exist_ok=True)
    tmp = path.with_suffix(path.suffix + f".tmp{os.getpid()}")
    with open(tmp, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
        f.write("\n")
    if private:
        os.chmod(tmp, 0o600)
    os.replace(tmp, path)


def mtime(path: Path) -> float:
    try:
        return path.stat().st_mtime
    except OSError:
        return 0.0


class Paths:
    def __init__(self, data_dir: Path, skill_dir: Optional[Path]):
        self.data = data_dir
        self.skill = skill_dir
        self.work = data_dir / "boss-data"
        self.profile = data_dir / "user_profile.json"
        self.config = data_dir / "runner_config.json"
        self.progress = self.work / "stream_progress.json"
        self.walk = self.work / "walk_state.json"
        self.log = self.work / "web_activity.jsonl"
        self.stats = self.work / "web_stats.json"
        self.report = self.work / "投递汇总.html"
        self.space = Path.home() / ".boss-egolite" / "space.json"


class Config:
    """runner 自己的设置：配对码、个人密钥（键名沿用 invite_code）、判岗接口、简历摘要、本轮目标数"""

    def __init__(self, path: Path):
        self.path = path
        self.lock = threading.Lock()
        self.data: Dict[str, Any] = read_json(path, {})

    def get(self, key: str, default: Any = None) -> Any:
        with self.lock:
            return self.data.get(key, default)

    def update(self, **kw: Any) -> None:
        with self.lock:
            self.data.update(kw)
            write_json(self.path, self.data, private=True)


# ═════════════════════════════════════════════════════════════════════
# 浏览器执行层：真实（调技能脚本）/ 演示（模拟）
# ═════════════════════════════════════════════════════════════════════


class StepError(Exception):
    """一步没走通，要停下来交给人"""


def run_out(ok: bool, result: Any = None, lazy: Any = None, notes: Optional[List[str]] = None,
            stderr: str = "", timed_out: bool = False) -> Dict[str, Any]:
    return {"ok": ok, "result": result, "lazy": lazy, "notes": notes or [], "stderr": stderr, "timedOut": timed_out}


def parse_output(stdout: str) -> Dict[str, Any]:
    """脚本输出里：最后一行 JSON 是结果，LAZY 行是懒加载进度，其余是说明"""
    lines = [l.strip() for l in stdout.splitlines() if l.strip()]
    result = None
    lazy = None
    for l in reversed(lines):
        if result is None and l.startswith("{"):
            try:
                result = json.loads(l)
            except ValueError:
                pass
        if lazy is None and l.startswith("LAZY "):
            try:
                lazy = json.loads(l[5:])
            except ValueError:
                pass
    notes = [l for l in lines if not l.startswith("{") and not l.startswith("LAZY ")][-12:]
    return {"result": result, "lazy": lazy, "notes": notes}


class RealBoss:
    demo = False

    def __init__(self, paths: Paths):
        self.paths = paths
        self.last_own_end = 0.0
        self.running = False
        self.env = dict(os.environ)
        self.env.update({
            "BOSS_WORK_DIR": str(paths.work),
            "BOSS_PROFILE": str(paths.profile),
            "PYTHONUNBUFFERED": "1",
            "PYTHONIOENCODING": "utf-8",
            "PYTHONDONTWRITEBYTECODE": "1",
            # 从访达双击启动时 PATH 很短，补上 ego-browser / Homebrew 的常见位置
            "PATH": ":".join([str(Path.home() / ".local/bin"), "/opt/homebrew/bin", "/usr/local/bin",
                              os.environ.get("PATH", "/usr/bin:/bin")]),
        })

    def external(self) -> Dict[str, Any]:
        """有没有别的会话在动浏览器：投递脚本进程在跑，或 Ego 空间文件刚被别人写过"""
        if not self.running:
            try:
                out = subprocess.run(["pgrep", "-f", r"_live_driver\.py|phase_stream\.py|env_check\.py"],
                                     capture_output=True, text=True, timeout=5)
                if out.stdout.strip():
                    return {"active": True, "reason": "检测到终端里正在运行投递脚本", "at": time.time()}
            except Exception:
                pass
        at = mtime(self.paths.space)
        if at > self.last_own_end + 2 and time.time() - at < EXTERNAL_WINDOW and not self.running:
            return {"active": True, "reason": "另一个会话刚刚操作过 BOSS 浏览器", "at": at}
        return {"active": False, "reason": "", "at": at}

    def argv(self, action: str, args: Dict[str, Any]) -> List[str]:
        skill = self.paths.skill
        assert skill is not None
        driver = str(skill / "scripts" / "_live_driver.py")
        arg = lambda k, n=60: re.sub(r"[\r\n\t]", " ", str(args.get(k) or "")).strip()[:n]  # noqa: E731
        if action == "walk":
            kw = arg("keyword", 30).lstrip("-")
            return [driver, "walk", kw] if kw else [driver, "walk"]
        if action in ("next", "more", "exhaust", "reset"):
            return [driver, "walk", f"--{action}"]
        if action == "open":
            return [driver, "open", arg("jobId", 80)]
        if action == "deliver":
            return [driver, "deliver", arg("jobId", 80), arg("company"), arg("salary", 30),
                    arg("industry", 30), arg("direction", 30)]
        if action == "reject":
            return [driver, "reject", arg("jobId", 80)]
        if action == "env":
            return [str(skill / "scripts" / "env_check.py")]
        if action == "report":
            return [str(skill / "scripts" / "phase_stream.py"), "--mode", "report", "--workdir", str(self.paths.work)]
        raise StepError(f"未知动作：{action}")

    def run(self, action: str, args: Optional[Dict[str, Any]] = None, force: bool = False) -> Dict[str, Any]:
        args = args or {}
        if action in BROWSER_ACTIONS and not force:
            ext = self.external()
            if ext["active"]:
                raise StepError(f"{ext['reason']}，先等它停下（约一分钟）再继续")
        argv = self.argv(action, args)
        self.running = True
        try:
            proc = subprocess.run([sys.executable, *argv], cwd=str(self.paths.work), env=self.env,
                                  capture_output=True, text=True, timeout=TIMEOUTS.get(action, 120))
            parsed = parse_output(proc.stdout)
            err = "\n".join([l for l in proc.stderr.splitlines() if l.strip()][-8:])
            return run_out(proc.returncode == 0, parsed["result"], parsed["lazy"], parsed["notes"], err)
        except subprocess.TimeoutExpired:
            return run_out(False, stderr="脚本执行超时", timed_out=True)
        finally:
            self.running = False
            self.last_own_end = time.time()


DEMO_JOBS = [
    ("AI 产品经理（Agent 平台）", "18-30K", "深圳·南山区", "人工智能", "星河智能", "100-499人", "1-3年", "本科",
     "负责企业级 Agent 平台的产品规划：多 Agent 编排、RAG 知识库、工具调用。要求有大模型应用落地经验，熟悉 Dify / Coze。"),
    ("Java 后端开发工程师", "15-25K", "深圳·福田区", "计算机软件", "云帆软件", "500-999人", "3-5年", "本科",
     "负责订单与库存系统的后端开发，Spring Boot / MySQL / Redis。会使用 Copilot 等工具提效优先。"),
    ("AIGC 应用开发工程师", "20-28K", "深圳·南山区", "互联网", "像素跃迁", "20-99人", "1-3年", "本科",
     "基于大模型开发文生图、数字人等 AIGC 应用，负责提示词工程与工作流编排，Python / TypeScript。"),
    ("AI Agent 架构师", "35-60K", "深圳·南山区", "人工智能", "深蓝算力", "1000-9999人", "5-10年", "硕士",
     "负责公司 Agent 基础架构设计与团队管理。"),
    ("电商运营专员", "10-15K", "深圳·龙华区", "电子商务", "优选好物", "100-499人", "1-3年", "大专",
     "负责天猫店铺日常运营、活动策划与数据分析。"),
    ("大模型应用开发（RAG 方向）", "20-35K", "深圳·南山区", "计算机软件", "知图科技", "100-499人", "1-3年", "本科",
     "搭建企业知识库问答系统：文档解析、向量检索、召回重排与效果评估，面向客户交付。"),
    ("嵌入式软件工程师", "18-28K", "深圳·宝安区", "智能硬件", "凌芯电子", "500-999人", "3-5年", "本科",
     "负责 MCU 固件开发与驱动调试，STM32 / FreeRTOS。"),
    ("AI 解决方案工程师", "18-26K", "深圳·福田区", "人工智能", "数智方舟", "100-499人", "1-3年", "本科",
     "面向企业客户落地大模型应用：需求梳理、方案设计、PoC 搭建与交付，会用 AI 编程工具快速出原型。"),
    ("测试开发工程师", "15-22K", "深圳·南山区", "互联网", "青藤网络", "1000-9999人", "3-5年", "本科",
     "负责自动化测试框架建设与质量保障。"),
    ("Vibe Coding 全栈工程师", "20-30K", "深圳·南山区", "互联网", "一刻工作室", "20-99人", "1-3年", "不限",
     "用 Claude Code / Cursor 等 AI 编程工具独立交付 Web 产品，重度 AI 协作，快速迭代。"),
]


class FakeBoss:
    """演示模式：模拟推荐页和关键词页上的一串卡片，结果格式与真实脚本完全一致，不碰任何浏览器"""

    demo = True

    def __init__(self, paths: Paths):
        self.paths = paths
        self.kw = str(read_json(paths.walk, {}).get("keyword") or "")
        self.decks: Dict[str, List[Dict[str, Any]]] = {}
        self.idx = 0

    def cards(self) -> List[Dict[str, Any]]:
        """每个来源一批卡（标题相同、jobId 不同），换关键词时能看到新卡"""
        if self.kw not in self.decks:
            tag = secrets.token_hex(3)
            self.decks[self.kw] = [
                {"jobId": f"demo{tag}{i:02d}", "title": t, "salary": s, "city": c, "industry": ind,
                 "company": co, "scale": sc, "stage": "", "experience": ex, "degree": de, "jd": jd}
                for i, (t, s, c, ind, co, sc, ex, de, jd) in enumerate(DEMO_JOBS)
            ]
        return self.decks[self.kw]

    def external(self) -> Dict[str, Any]:
        return {"active": False, "reason": "", "at": 0}

    def _done(self) -> set:
        delivered = {d.get("jobId") for d in read_json(self.paths.progress, {}).get("delivered", [])}
        rejected = set(read_json(self.paths.walk, {}).get("rejected_jids", []))
        return delivered | rejected

    def _present(self) -> Dict[str, Any]:
        done = self._done()
        cards = self.cards()
        skipped = 0
        while self.idx < len(cards):
            c = cards[self.idx]
            self.idx += 1
            if c["jobId"] in done:
                skipped += 1
                continue
            job = {k: v for k, v in c.items() if k != "jd"}
            return {"present": self.idx - 1, "job": job, "auto_skipped_mech": [{}] * skipped,
                    "visible_total": len(cards), "recommend_exhausted": True}
        return {"view_exhausted": True, "keyword": self.kw, "kw_exhausted": True, "recommend_exhausted": True}

    def run(self, action: str, args: Optional[Dict[str, Any]] = None, force: bool = False) -> Dict[str, Any]:
        args = args or {}
        time.sleep(random.uniform(0.5, 1.2))
        jid = args.get("jobId")
        card = next((c for deck in self.decks.values() for c in deck if c["jobId"] == jid), None)
        if action in ("walk", "reset"):
            self.idx = 0
            if action == "reset":
                return run_out(True, notes=["WALK_STATE_RESET"])
            self.kw = str(args.get("keyword") or "")
            st = read_json(self.paths.walk, {})
            st.update({"keyword": self.kw, "idx": 0, "recommend_exhausted": True, "kw_exhausted": False})
            write_json(self.paths.walk, st)
            return run_out(True, self._present())
        if action in ("next", "more"):
            return run_out(True, self._present(), {"grew": False} if action == "more" else None)
        if action == "exhaust":
            return run_out(True, {"exhausted": True, "marker": "demo", "recommend_exhausted": True})
        if action == "open":
            if not card:
                return run_out(True, {"clicked": False, "panel_ok": False, "detail": ""})
            detail = f"{card['title']}\n{card['salary']} · {card['city']} · {card['experience']} · {card['degree']}\n\n职位描述\n{card['jd']}\n\n{card['company']} · {card['industry']} · {card['scale']}"
            return run_out(True, {"clicked": True, "panel_ok": True, "detail": detail})
        if action == "deliver":
            if not card:
                return run_out(True, {"not_found": True})
            prog = read_json(self.paths.progress, {"delivered": [], "failed": [], "blocked": []})
            prog.setdefault("delivered", []).append({
                "jobId": card["jobId"], "title": card["title"], "company": args.get("company") or card["company"],
                "salary": card["salary"], "industry": card["industry"], "direction": args.get("direction", ""),
                "deliveredAt": dt.datetime.now().astimezone().isoformat(timespec="seconds"), "result": "success",
            })
            write_json(self.paths.progress, prog)
            return run_out(True, {"delivered_ok": True, "verify": True})
        if action == "reject":
            st = read_json(self.paths.walk, {})
            rj = set(st.get("rejected_jids", []))
            rj.add(jid)
            st["rejected_jids"] = sorted(rj)
            write_json(self.paths.walk, st)
            return run_out(True, {"rejected": jid, "rejected_count": len(rj)})
        if action == "env":
            return run_out(True, notes=["✅ ego-browser CLI: 演示模式（未调用）", "✅ Ego TaskSpace: 演示模式（未调用）",
                                        "✅ Boss 直聘登录: 演示模式（未调用）"])
        if action == "report":
            self.paths.report.write_text("<!doctype html><meta charset=utf-8><title>演示</title><p>演示模式没有汇报页。</p>",
                                         encoding="utf-8")
            return run_out(True)
        raise StepError(f"未知动作：{action}")


# ═════════════════════════════════════════════════════════════════════
# 判岗：机械规则（薪资上限）+ 模型判断
# ═════════════════════════════════════════════════════════════════════

JUDGE_SYSTEM = """你是求职者本人的「判岗官」：替他决定 BOSS 直聘上这一个岗位要不要投简历。
只判断这一张，结论必须能被他的画像和规则直接支撑。

【输出】只输出一个 JSON 对象，不要解释、不要 Markdown：
{"verdict":"投" 或 "不投","reason":"不超过 40 字，点出决定性依据（命中或违反了哪条）","direction":"方向标签，如 AI产品经理 / AI应用开发 / Agent开发 / AIGC应用 / AI解决方案","category":"判不投时选一个原因类别：方向不符 / 岗位类型不投 / 行业门槛 / 地点不符 / 薪资不符 / 管理岗 / 外包假岗 / 其他；判投时填空字符串","confidence":0 到 1 之间的小数}

【判断方法】
1. 先看 JD 的核心工作内容（不是标题，不是加分项）是否落在求职方向里
2. 逐条对照「判岗规则」，命中任何一条否决就判不投
3. 「优先」「加分」类要求不算门槛
4. 拿不准时判不投，并在 reason 里写明不确定点"""


JUDGE_CATEGORIES = {"方向不符", "岗位类型不投", "行业门槛", "地点不符", "薪资不符", "管理岗", "外包假岗", "其他"}


def salary_range(text: str) -> Optional[Dict[str, float]]:
    s = re.sub(r"\s", "", text or "")
    m = re.search(r"(\d+(?:\.\d+)?)-(\d+(?:\.\d+)?)K", s, re.I)
    if m:
        return {"min": float(m.group(1)), "max": float(m.group(2))}
    m = re.search(r"(\d+(?:\.\d+)?)K", s, re.I)
    if m:
        return {"min": float(m.group(1)), "max": float(m.group(1))}
    return None


def rule_verdict(card: Dict[str, Any], profile: Dict[str, Any]) -> Optional[Dict[str, Any]]:
    cap = float(profile.get("max_salary_k") or 0)
    r = salary_range(card.get("salary") or "")
    if cap > 0 and r and r["max"] > cap:
        return {"deliver": False, "reason": f"薪资上限 {r['max']:g}K 超过 {cap:g}K", "direction": "",
                "category": "薪资超上限", "confidence": 1, "source": "rule", "ms": 0}
    return None


def build_judge_messages(card: Dict[str, Any], jd: str, profile: Dict[str, Any], resume_brief: str) -> List[Dict[str, str]]:
    def lst(xs: Any, empty: str = "（无）") -> str:
        xs = [x for x in (xs or []) if x]
        return "、".join(xs) if xs else empty

    cities = profile.get("target_cities") or ([profile["target_city"]] if profile.get("target_city") else [])
    salary = f"{profile.get('min_salary_k') or 0}K 起" + (f"，上限 {profile['max_salary_k']}K" if profile.get("max_salary_k") else "")
    rules = [r for r in (profile.get("judge_rules") or []) if r]
    company = " · ".join(x for x in [card.get("company"), card.get("industry"), card.get("scale"), card.get("stage")] if x)
    user = f"""【求职画像】
方向：{profile.get('role_summary') or '（未填写）'}
希望投：{lst(profile.get('prefer'))}
不投：{lst(profile.get('avoid'))}
城市：{lst(cities, '不限')}；薪资：{salary}

【判岗规则】（逐条执行）
{chr(10).join(f'{i + 1}. {r}' for i, r in enumerate(rules)) if rules else '（无额外规则，只按方向判断）'}

【我的简历要点】（判断技能是否对口时参考）
{resume_brief or '（略）'}

【岗位】
标题：{card.get('title')}
薪资：{card.get('salary') or '未标注'}　城市：{card.get('city') or '未标注'}
公司：{company or '未标注'}
经验 / 学历：{' / '.join(x for x in [card.get('experience'), card.get('degree')] if x) or '未标注'}

JD 正文：
{jd[:4200]}"""
    return [{"role": "system", "content": JUDGE_SYSTEM}, {"role": "user", "content": user}]


def strip_thinking(text: str) -> str:
    text = re.sub(r"<think(?:ing)?>[\s\S]*?</think(?:ing)?>", "", text or "", flags=re.I)
    return re.sub(r"<think(?:ing)?>[\s\S]*$", "", text, flags=re.I).strip()


def llm_chat(endpoint: str, invite: str, messages: List[Dict[str, str]], temperature: float = 0.2,
             max_tokens: int = 8000) -> Dict[str, str]:
    """用 curl 发请求：macOS 自带、走系统证书，不受各种 Python 安装方式的证书问题影响"""
    body = json.dumps({"messages": messages, "temperature": temperature, "max_tokens": max_tokens,
                       "stream": False, "reasoning_split": True}, ensure_ascii=False).encode("utf-8")
    cmd = ["curl", "-sS", "-X", "POST", endpoint, "-H", "Content-Type: application/json",
           "--data-binary", "@-", "--max-time", "200", "-w", "\n__HTTP__%{http_code}"]
    if invite:
        cmd += ["-H", f"X-Invite-Code: {invite}"]
    try:
        p = subprocess.run(cmd, input=body, capture_output=True, timeout=215)
    except subprocess.TimeoutExpired:
        raise StepError("判岗模型超时没有返回，稍后重试")
    out = p.stdout.decode("utf-8", "replace")
    text, _, code = out.rpartition("\n__HTTP__")
    status = int(code) if code.strip().isdigit() else 0
    if p.returncode != 0 or status == 0:
        raise StepError("连不上判岗服务：" + (p.stderr.decode("utf-8", "replace").strip()[-160:] or "网络错误"))
    if status in (401, 403):
        raise StepError("个人密钥无效或账号已停用：回网页重新登录一次")
    if status == 402:
        raise StepError("AI 额度用完了：找站长加额度，或在网页头像菜单里填自己的模型密钥")
    if status == 429:
        raise StepError("判岗调用太频繁，或今天的额度用完了，稍后再试")
    if status >= 400:
        # 网站会给出说人话的原因（比如自带的模型密钥失效、站长的模型欠费）
        try:
            msg = (json.loads(text).get("error") or {}).get("message")
        except Exception:
            msg = None
        raise StepError(msg if isinstance(msg, str) and msg else f"判岗服务出错（HTTP {status}）")
    try:
        data = json.loads(text)
        msg = data["choices"][0]["message"]
    except Exception:
        raise StepError("判岗服务返回了看不懂的内容")
    rd = msg.get("reasoning_details")
    reasoning = rd if isinstance(rd, str) else "".join(
        (x if isinstance(x, str) else (x or {}).get("text", "")) for x in (rd or []))
    return {"content": strip_thinking(msg.get("content") or ""), "reasoning": reasoning.strip()}


def judge_job(card: Dict[str, Any], jd: str, profile: Dict[str, Any], cfg: Config) -> Dict[str, Any]:
    started = time.time()
    res = llm_chat(cfg.get("llm_endpoint") or DEFAULT_LLM_ENDPOINT, cfg.get("invite_code") or "",
                   build_judge_messages(card, jd, profile, cfg.get("resume_brief") or ""))
    m = re.search(r"\{[\s\S]*\}", res["content"])
    if not m:
        raise StepError("模型没有按格式给出结论")
    try:
        parsed = json.loads(m.group(0))
    except ValueError:
        raise StepError("模型返回的结论不是合法 JSON")
    v = str(parsed.get("verdict", "")).strip()
    if v not in ("投", "不投"):
        raise StepError(f"模型结论不明确：{v or '空'}")
    conf = parsed.get("confidence")
    cat = str(parsed.get("category", "")).strip()
    return {
        "deliver": v == "投",
        "reason": str(parsed.get("reason", ""))[:120],
        "direction": str(parsed.get("direction", ""))[:24],
        "category": "" if v == "投" else (cat if cat in JUDGE_CATEGORIES else "其他"),
        "confidence": max(0.0, min(1.0, float(conf))) if isinstance(conf, (int, float)) else None,
        "source": "ai",
        "ms": int((time.time() - started) * 1000),
    }


DEMO_GOOD = re.compile(r"AI|Agent|大模型|AIGC|RAG|Vibe", re.I)
DEMO_BAD = re.compile(r"嵌入式|测试|运营|Java 后端|管理")


def demo_judge(card: Dict[str, Any], jd: str) -> Dict[str, Any]:
    """演示模式的假判岗：只看几个关键词，不调模型"""
    time.sleep(random.uniform(1.2, 2.4))
    text = f"{card.get('title')} {jd}"
    bad = DEMO_BAD.search(text)
    good = DEMO_GOOD.search(text)
    if good and not bad:
        return {"deliver": True, "reason": f"核心工作是「{good.group(0)}」相关，落在求职方向里", "direction": "AI应用",
                "category": "", "confidence": 0.82, "source": "ai", "ms": 1800}
    why = f"核心工作是{bad.group(0)}，不在方向里" if bad else "和 AI 方向无关"
    cat = "管理岗" if bad and bad.group(0) == "管理" else "岗位类型不投" if bad else "方向不符"
    return {"deliver": False, "reason": why, "direction": "", "category": cat, "confidence": 0.9, "source": "ai", "ms": 1800}


# ═════════════════════════════════════════════════════════════════════
# 会话：自动投递循环 + 逐张确认 + 关键词计划（与网页上的状态一一对应）
#
#   网页点「开始」→ 从当前位置接着走：下一张 → 读 JD → AI 判 → 投 / 跳
#   一个来源（推荐页 / 某个关键词）翻完 → 按关键词计划换下一个
#   投到每天目标（最多 148）、计划翻完、或出现任何异常 → 停下
#   打开「逐张确认」：每张判完先等网页上点投或跳
# ═════════════════════════════════════════════════════════════════════


class Busy(Exception):
    pass


def explain_failure(out: Dict[str, Any]) -> str:
    err = f"{out.get('stderr', '')}\n" + "\n".join(out.get("notes") or [])
    if out.get("timedOut"):
        return "脚本执行超时（浏览器可能卡住了），去 Ego 浏览器看一眼"
    if "未知弹窗" in err:
        return "出现未知弹窗，已整批停手：请到 Ego 浏览器里处理后再继续"
    if "不感兴趣" in err:
        return "误触了「不感兴趣」弹窗，已整批停手：请到 Ego 浏览器里处理"
    if "TaskSpace" in err or "ego-browser" in err:
        return "连不上 Ego 浏览器：确认 Ego Lite 已打开"
    lines = [l for l in (out.get("stderr") or "").splitlines() if l.strip()]
    return lines[-1] if lines else "脚本执行失败"


RECOMMEND_NAMES = {"推荐页", "推荐", "recommend", "rec"}


def source_label(kw: str) -> str:
    return f"关键词「{kw}」" if kw else "推荐页"


class Stats:
    """今天的漏斗计数（按天存在 boss-data/web_stats.json，只留最近 30 天）"""

    KEYS = ("seen", "filtered", "opened", "aiYes", "aiNo", "ruleNo")

    def __init__(self, path: Path):
        self.path = path
        self.lock = threading.Lock()

    def bump(self, key: str, n: int = 1) -> None:
        if n <= 0:
            return
        today = dt.date.today().isoformat()
        with self.lock:
            data = read_json(self.path, {})
            day = data.setdefault(today, {})
            day[key] = int(day.get(key, 0)) + n
            for old in sorted(data)[:-30]:
                data.pop(old, None)
            write_json(self.path, data)

    @staticmethod
    def today(path: Path) -> Dict[str, int]:
        d = read_json(path, {}).get(dt.date.today().isoformat(), {})
        return {k: int(d.get(k, 0)) for k in Stats.KEYS}


class Session:
    def __init__(self, boss: Any, paths: Paths, cfg: Config):
        self.boss = boss
        self.paths = paths
        self.cfg = cfg
        self.stats = Stats(paths.stats)
        self.lock = threading.RLock()
        self.seq = 0
        self.busy: Optional[str] = None
        self.decision: Optional[str] = None
        self.live: Dict[str, Any] = {
            "phase": "idle", "card": None, "jd": "", "jdOk": False, "verdict": None, "judgeError": "",
            "listEnd": None, "notice": None, "env": None,
        }
        self.auto: Dict[str, Any] = {
            "running": False, "dailyTarget": int(cfg.get("daily_target", 50)),
            "confirm": bool(cfg.get("confirm_each", False)), "done": 0, "stopReason": "",
            "stopping": False, "awaiting": False,
        }

    # ---------------------------- 状态 ----------------------------

    def set(self, **kw: Any) -> None:
        with self.lock:
            self.live.update(kw)
            self.seq += 1

    def set_auto(self, **kw: Any) -> None:
        with self.lock:
            self.auto.update(kw)
            self.seq += 1

    def snapshot(self) -> Dict[str, Any]:
        with self.lock:
            return {**json.loads(json.dumps(self.live)), "auto": dict(self.auto), "busy": self.busy, "seq": self.seq}

    def profile(self) -> Dict[str, Any]:
        return read_json(self.paths.profile, {})

    def today_count(self) -> int:
        today = dt.date.today().isoformat()
        delivered = read_json(self.paths.progress, {}).get("delivered", [])
        return sum(1 for d in delivered if str(d.get("deliveredAt", "")).startswith(today))

    def running(self) -> bool:
        return bool(self.auto["running"])

    # ---------------------------- 关键词计划 ----------------------------

    def plan(self) -> List[str]:
        """计划里的来源，"" 代表推荐页；没设置时只有推荐页"""
        out: List[str] = []
        for x in self.profile().get("keyword_plan") or []:
            x = str(x).strip()
            k = "" if x in RECOMMEND_NAMES else x
            if x and k not in out:
                out.append(k)
        return out or [""]

    def current_source(self) -> str:
        return str(read_json(self.paths.walk, {}).get("keyword") or "")

    def next_source(self) -> Optional[str]:
        plan, cur = self.plan(), self.current_source()
        if cur in plan:
            i = plan.index(cur)
            return plan[i + 1] if i + 1 < len(plan) else None
        return plan[0] if plan[0] != cur else None

    def plan_info(self) -> Dict[str, Any]:
        return {"sources": self.plan(), "current": self.current_source(), "next": self.next_source()}

    # ---------------------------- 调度 ----------------------------

    def submit(self, name: str, fn: Callable[[], None]) -> None:
        with self.lock:
            if self.busy:
                raise Busy(self.busy)
            self.busy = name
            self.seq += 1

        def work() -> None:
            try:
                fn()
            except StepError as e:
                self.fail(str(e))
            except Exception as e:  # noqa: BLE001
                traceback.print_exc()
                self.fail(f"内部错误：{e}")
            finally:
                with self.lock:
                    self.busy = None
                    if self.live["phase"] not in ("idle", "awaiting"):
                        self.live["phase"] = "awaiting" if self.live.get("card") else "idle"
                    self.seq += 1

        threading.Thread(target=work, daemon=True).start()

    def fail(self, text: str, tone: str = "error") -> None:
        say(red("!"), text)
        self.set(phase="idle", notice={"tone": tone, "text": text})
        if self.running():
            self.stop_auto(text)

    def log_activity(self, action: str, ok: bool, card: Dict[str, Any], by: str, reason: str = "",
                     direction: str = "", category: str = "", flags: Optional[Dict[str, bool]] = None,
                     error: str = "") -> None:
        entry = {
            "ts": dt.datetime.now(dt.timezone.utc).isoformat(timespec="seconds").replace("+00:00", "Z"),
            "action": action, "jobId": card.get("jobId"), "ok": ok, "title": card.get("title", ""),
            "company": card.get("company", ""), "salary": card.get("salary", ""), "city": card.get("city", ""),
            "industry": card.get("industry", ""), "direction": direction, "reason": reason[:200],
            "category": category, "by": by, "flags": flags or {}, "error": error or None,
        }
        try:
            self.paths.work.mkdir(parents=True, exist_ok=True)
            with open(self.paths.log, "a", encoding="utf-8") as f:
                f.write(json.dumps(entry, ensure_ascii=False) + "\n")
        except OSError:
            pass

    # ---------------------------- 单步 ----------------------------

    def present(self, action: str, keyword: str = "") -> str:
        self.set(phase="scrolling" if action == "more" else "walking", verdict=None, jd="", jdOk=False,
                 judgeError="", listEnd=None)
        out = self.boss.run(action, {"keyword": keyword} if keyword else {})
        r = out.get("result")
        if not r:
            self.set(phase="idle")
            raise StepError(explain_failure(out))
        if r.get("blocked"):
            self.set(card=None, phase="idle", listEnd={"keyword": keyword, "kwExhausted": False,
                                                       "recommendExhausted": False,
                                                       "blocked": str(r.get("reason") or "被规则拦截")})
            return "blocked"
        if r.get("view_exhausted"):
            self.set(card=None, phase="idle", listEnd={"keyword": str(r.get("keyword") or ""),
                                                       "kwExhausted": bool(r.get("kw_exhausted")),
                                                       "recommendExhausted": bool(r.get("recommend_exhausted"))})
            return "end"
        if r.get("job"):
            card = {"surface": r["job"], "position": int(r.get("present") or 0),
                    "visibleTotal": int(r.get("visible_total") or 0),
                    "autoSkipped": len(r.get("auto_skipped_mech") or [])}
            self.set(card=card, phase="idle")
            self.stats.bump("seen")
            self.stats.bump("filtered", card["autoSkipped"])
            say(dim("·"), f"第 {card['position'] + 1} 张  {job_line(card['surface'])}")
            return "card"
        self.set(phase="idle")
        raise StepError("脚本返回了无法识别的结果")

    def prepare(self) -> str:
        """读 JD + 判。返回 ok（有结论）/ nojd（面板没切过去）/ error（判不了，要停）"""
        card = self.live.get("card")
        if not card or card.get("outcome"):
            return "ok"
        s = card["surface"]
        profile = self.profile()
        if not self.boss.demo and not (profile.get("role_summary") or "").strip():
            self.set(phase="awaiting", judgeError="先在设置里写一句求职方向，AI 才知道该投什么")
            return "error"
        rule = rule_verdict(s, profile)
        if rule:
            self.set(verdict=rule, phase="awaiting")
            self.stats.bump("ruleNo")
            say(dim("·"), "规则判定：不投", rule["reason"])
            return "ok"
        self.set(phase="opening")
        out = self.boss.run("open", {"jobId": s["jobId"]})
        r = out.get("result") or {}
        detail = str(r.get("detail") or "").strip()
        ok = bool(r.get("panel_ok")) and bool(detail)
        self.set(jd=detail, jdOk=ok)
        if not ok:
            self.set(phase="awaiting", judgeError="右侧面板没切到这张卡，JD 没读到")
            say(red("!"), "JD 没读到：右侧面板没切到这张卡")
            return "nojd"
        self.stats.bump("opened")
        self.set(phase="judging")
        try:
            v = demo_judge(s, detail) if self.boss.demo else judge_job(s, detail, profile, self.cfg)
        except StepError as e:
            self.set(judgeError=str(e), phase="awaiting")
            say(red("!"), f"AI 判断失败：{e}")
            return "error"
        self.stats.bump("aiYes" if v["deliver"] else "aiNo")
        if (self.live.get("card") or {}).get("surface", {}).get("jobId") == s["jobId"]:
            self.set(verdict=v, phase="awaiting")
            conf = f"把握 {round(v['confidence'] * 100)}%" if v.get("confidence") is not None else ""
            say(dim("·"), f"AI 判断：{'投' if v['deliver'] else '不投'}  {v.get('reason', '')}", conf)
        return "ok"

    def deliver(self, by: str = "manual") -> bool:
        card = self.live.get("card")
        if not card or card.get("outcome"):
            return False
        s = card["surface"]
        v = self.live.get("verdict") or {}
        self.set(phase="delivering", notice=None)
        out = self.boss.run("deliver", {"jobId": s["jobId"], "company": s.get("company", ""),
                                        "salary": s.get("salary", ""), "industry": s.get("industry", ""),
                                        "direction": v.get("direction", "")})
        r = out.get("result") or {}
        if r.get("delivered_ok"):
            self.log_activity("deliver", True, s, by, v.get("reason", ""), v.get("direction", ""))
            self.set(phase="idle", card={**card, "outcome": "delivered"})
            if self.running():
                self.set_auto(done=self.auto["done"] + 1)
            say(bold("✓"), bold("投递 ") + job_line(s), v.get("reason", ""))
            return True

        fatal = True
        if r.get("daily_limit"):
            text = "BOSS 提示今日沟通次数已达上限，今天先到这里"
        elif r.get("not_found"):
            text = "这张卡已从列表消失（BOSS 列表会动态重排），已略过"
            fatal = False
        elif r.get("anomaly"):
            text = f"页面异常：{r.get('anomaly')}。去 Ego 浏览器看一眼（可能是验证码或登录过期）"
        elif r.get("timeout"):
            text = "投递超时：可能已达每日上限，或卡片被列表重排挤掉。超时不等于已投递，别手动补记录。"
        elif not out.get("ok"):
            text = explain_failure(out)
        else:
            text = str(r.get("reason") or "投递没有成功")
        self.log_activity("deliver", False, s, by, flags={"timeout": bool(r.get("timeout")),
                                                          "dailyLimit": bool(r.get("daily_limit")),
                                                          "notFound": bool(r.get("not_found")),
                                                          "anomaly": bool(r.get("anomaly"))}, error=text)
        self.set(phase="idle", card={**card, "outcome": "failed" if fatal else "vanished", "outcomeNote": text},
                 notice={"tone": "error" if fatal else "warn", "text": text})
        say(red("!") if fatal else dim("·"), text)
        if fatal and self.running():
            self.stop_auto(text)
        return False

    def skip(self, by: str = "manual", reason: str = "", category: str = "") -> None:
        card = self.live.get("card")
        if not card or card.get("outcome"):
            return
        s = card["surface"]
        v = self.live.get("verdict") or {}
        ai_no = bool(v) and not v.get("deliver")
        why = reason or (v.get("reason") if ai_no else "手动跳过")
        cat = category or ("薪资超上限" if v.get("source") == "rule" else (v.get("category") or "其他") if ai_no else "手动跳过")
        self.set(phase="rejecting")
        out = self.boss.run("reject", {"jobId": s["jobId"]})
        if not out.get("ok"):
            raise StepError(explain_failure(out))
        self.log_activity("reject", True, s, by, why, category=cat)
        self.set(phase="idle", card={**card, "outcome": "rejected"})
        say(dim("–"), dim("跳过 ") + job_line(s), why)

    def exhaust_recommend(self) -> None:
        say(dim("·"), "推荐页还没翻到底，先把它翻完（可能要几分钟）")
        self.set(phase="exhausting")
        out = self.boss.run("exhaust")
        self.set(phase="idle")
        if not out.get("result"):
            raise StepError(explain_failure(out))

    def wait_decision(self) -> Optional[str]:
        """逐张确认：等网页上点投或跳；中途关掉逐张确认就按 AI 的结论走"""
        self.decision = None
        self.set_auto(awaiting=True)
        self.set(phase="awaiting")
        try:
            while self.running():
                if self.decision:
                    return self.decision
                if not self.auto["confirm"]:
                    v = self.live.get("verdict") or {}
                    return "deliver" if v.get("deliver") else "skip"
                time.sleep(0.3)
            return None
        finally:
            self.decision = None
            self.set_auto(awaiting=False)

    # ---------------------------- 自动 ----------------------------

    def auto_loop(self) -> None:
        cap = min(int(self.auto["dailyTarget"]), DAILY_CAP)
        say(bold("▶"), bold(f"开始：今天目标 {cap} 份，已投 {self.today_count()} 份"),
            "逐张确认" if self.auto["confirm"] else "全自动")
        want = self.current_source()
        say(dim("·"), f"从{source_label(want)}接着走")
        res: Optional[str] = self.present("walk", want)
        dry = 0
        switches = 0
        tried_exhaust = False

        while self.running():
            today = self.today_count()
            cap = min(int(self.auto["dailyTarget"]), DAILY_CAP)
            if today >= cap:
                return self.stop_auto(f"今天已投 {today} 份，到目标了" if cap < DAILY_CAP
                                      else f"今天已投 {today} 份，按惯例收工（BOSS 上限 150/天）")

            if res is None:
                card = self.live.get("card")
                res = "card" if card and not card.get("outcome") else self.present("next")
                if not self.running():
                    return

            if res == "blocked":
                # 技能硬规则：推荐页没翻到底不许搜关键词 → 先翻到底再搜一次
                if tried_exhaust:
                    return self.stop_auto((self.live.get("listEnd") or {}).get("blocked") or "被规则拦截")
                tried_exhaust = True
                self.exhaust_recommend()
                res = self.present("walk", want)
                continue

            if res == "end":
                if not (self.live.get("listEnd") or {}).get("kwExhausted"):
                    res = self.present("more")
                    if res != "end":
                        dry = 0
                        continue
                    dry += 1
                    if dry < 2:
                        continue
                dry = 0
                nxt = self.next_source()
                switches += 1
                if nxt is None or switches > len(self.plan()) + 1:
                    return self.stop_auto("关键词计划里的来源都翻完了：在设置里加几个关键词再继续")
                say(bold("▸"), f"{source_label(self.current_source())}翻完了，换{source_label(nxt)}")
                want = nxt
                tried_exhaust = False
                res = self.present("walk", want)
                continue

            # res == "card"：当前这张还没处理
            status = "ok" if self.live.get("verdict") else self.prepare()
            if not self.running():
                return
            if status == "nojd":
                c = self.live.get("card")
                if c:
                    self.set(card={**c, "outcome": "vanished", "outcomeNote": "面板没切到这张卡，已略过"})
                res = None
                continue
            if status == "error":
                return self.stop_auto(f"AI 判断失败：{self.live.get('judgeError')}")

            v = self.live.get("verdict") or {}
            if self.auto["confirm"]:
                d = self.wait_decision()
                if d is None:
                    return
                if d == "deliver":
                    self.deliver("manual")
                else:
                    self.skip("manual")
            elif v.get("deliver"):
                self.deliver("auto")
            else:
                self.skip("rule" if v.get("source") == "rule" else "auto", v.get("reason", ""), v.get("category", ""))
            res = None
            if not self.running():
                return
            time.sleep(random.uniform(0.9, 2.5))  # 像人一样留一点间隔

    def stop_auto(self, reason: str = "已暂停") -> None:
        if self.auto["running"]:
            say(bold("■"), bold(f"停下：{reason}"), f"这次投出 {self.auto['done']} 份")
        self.set_auto(running=False, stopReason=reason, stopping=self.busy is not None)

    # ---------------------------- 对外动作 ----------------------------

    def act(self, kind: str, payload: Dict[str, Any]) -> None:
        kind = {"auto_start": "start", "auto_stop": "pause"}.get(kind, kind)

        if kind == "pause":
            self.stop_auto()
            return
        if kind == "set_target":
            n = max(1, min(DAILY_CAP, int(payload.get("target") or 1)))
            self.cfg.update(daily_target=n)
            self.set_auto(dailyTarget=n)
            say(dim("·"), f"每天目标设为 {n} 份")
            return
        if kind == "set_confirm":
            on = bool(payload.get("on"))
            self.cfg.update(confirm_each=on)
            self.set_auto(confirm=on)
            say(dim("·"), "逐张确认：" + ("开" if on else "关（全自动）"))
            return
        if kind == "dismiss":
            self.set(notice=None)
            return

        if kind in ("deliver", "skip"):
            if self.running():
                if not self.auto["awaiting"]:
                    raise StepError("全自动在跑：打开「逐张确认」后才能自己决定投或跳")
                self.decision = kind
                return
            if kind == "deliver":
                return self.submit("deliver", lambda: (self.deliver("manual"), None)[1])
            return self.submit("skip", lambda: self.skip("manual"))

        if kind == "start":
            if self.running():
                return
            ext = self.boss.external()
            if ext["active"]:
                raise StepError(f"{ext['reason']}，等它停下再开始")
            if not (self.profile().get("role_summary") or "").strip():
                raise StepError("先在设置里写一句求职方向，AI 才知道该投什么")
            endpoint = self.cfg.get("llm_endpoint") or DEFAULT_LLM_ENDPOINT
            local = re.match(r"^http://(localhost|127\.0\.0\.1)", endpoint)
            if not self.boss.demo and not local and not self.cfg.get("invite_code"):
                raise StepError("还没拿到个人密钥：在网页上重新登录一次，执行器会自动接上")
            today = self.today_count()
            cap = min(int(self.auto["dailyTarget"]), DAILY_CAP)
            if today >= cap:
                raise StepError(f"今天已投 {today} 份，已经到每天目标 {cap} 份了：调高目标再开始")
            self.set_auto(running=True, done=0, stopReason="", stopping=False)
            self.set(notice=None, listEnd=None, judgeError="")

            def loop() -> None:
                try:
                    self.auto_loop()
                finally:
                    self.set_auto(running=False, stopping=False, awaiting=False)
            return self.submit("auto", loop)

        if kind == "exhaust":
            def ex() -> None:
                self.exhaust_recommend()
                self.set(notice={"tone": "info", "text": "推荐页已翻到底，关键词搜索已解锁"}, listEnd=None)
            return self.submit("exhaust", ex)

        if kind == "env":
            def env() -> None:
                self.set(phase="checking", env=None)
                out = self.boss.run("env")
                items = []
                for line in out.get("notes") or []:
                    m = re.match(r"^(✅|❌)\s*([^:：]+)[:：]\s*(.*)$", line)
                    if m:
                        items.append({"ok": m.group(1) == "✅", "name": m.group(2).strip(), "detail": m.group(3).strip()})
                if not items:
                    items = [{"ok": bool(out.get("ok")), "name": "环境检测",
                              "detail": (out.get("stderr") or "完成").splitlines()[-1]}]
                self.set(phase="idle", env=items)
                bad = [i for i in items if not i["ok"]]
                say(red("!") if bad else bold("✓"), "环境检测：" + ("、".join(i["name"] for i in bad) + " 没通过" if bad else "全部通过"))
            return self.submit("env", env)

        raise StepError(f"未知动作：{kind}")


# ═════════════════════════════════════════════════════════════════════
# 数据快照（给网页看板用；按文件修改时间缓存）
# ═════════════════════════════════════════════════════════════════════


class DataView:
    def __init__(self, paths: Paths):
        self.paths = paths
        self.cache_key: Optional[str] = None
        self.cache: Dict[str, Any] = {}

    def version(self) -> str:
        files = [self.paths.progress, self.paths.walk, self.paths.profile, self.paths.log, self.paths.stats]
        return "-".join(str(int(mtime(f) * 1000)) for f in files) + f"-{dt.date.today().isoformat()}"

    def read(self) -> Dict[str, Any]:
        v = self.version()
        if v == self.cache_key:
            return self.cache
        progress = read_json(self.paths.progress, {})
        walk = read_json(self.paths.walk, {})
        delivered = progress.get("delivered", [])
        today = dt.date.today().isoformat()
        activity: List[Dict[str, Any]] = []
        try:
            with open(self.paths.log, "r", encoding="utf-8") as f:
                for line in f.readlines()[-3000:]:
                    try:
                        activity.append(json.loads(line))
                    except ValueError:
                        pass
        except OSError:
            pass

        # 今天的跳过原因（只统计执行器经手的；终端里智能体判的没有记录原因）
        now = dt.datetime.now().astimezone()
        reasons: Dict[str, int] = {}
        skipped_today = 0
        for a in activity:
            if a.get("action") != "reject":
                continue
            try:
                ts = dt.datetime.fromisoformat(str(a.get("ts", "")).replace("Z", "+00:00")).astimezone()
            except ValueError:
                continue
            if ts.date() != now.date():
                continue
            skipped_today += 1
            cat = a.get("category") or ("薪资超上限" if a.get("by") == "rule" else "其他")
            reasons[cat] = reasons.get(cat, 0) + 1

        delivered_today = sum(1 for d in delivered if str(d.get("deliveredAt", "")).startswith(today))
        self.cache = {
            "profile": read_json(self.paths.profile, {}),
            "walk": {
                "keyword": walk.get("keyword", ""), "idx": walk.get("idx", 0), "lastJid": walk.get("last_jid", ""),
                "recommendExhausted": bool(walk.get("recommend_exhausted")),
                "kwExhausted": bool(walk.get("kw_exhausted")),
                "rejectedCount": len(walk.get("rejected_jids") or []),
            },
            "delivered": delivered,
            "counts": {"delivered": len(delivered), "failed": len(progress.get("failed", [])),
                       "blocked": len(progress.get("blocked", []))},
            "today": {"date": today, "delivered": delivered_today},
            "funnel": {**Stats.today(self.paths.stats), "delivered": delivered_today, "skipped": skipped_today},
            "skipReasons": sorted(({"label": k, "count": n} for k, n in reasons.items()), key=lambda x: -x["count"]),
            "activity": activity[-160:],
        }
        self.cache_key = v
        return self.cache


# ═════════════════════════════════════════════════════════════════════
# HTTP 接口（只给网页用）
# ═════════════════════════════════════════════════════════════════════


class App:
    def __init__(self, session: Session, data: DataView, cfg: Config, paths: Paths, port: int, origins: List[str]):
        self.session = session
        self.data = data
        self.cfg = cfg
        self.paths = paths
        self.port = port
        self.origins = origins
        self.bad_tokens = 0
        self.connected = False


def make_handler(app: App):
    allowed_hosts = {f"127.0.0.1:{app.port}", f"localhost:{app.port}"}

    class Handler(http.server.BaseHTTPRequestHandler):
        server_version = f"boss-runner/{VERSION}"
        protocol_version = "HTTP/1.1"

        def log_message(self, *_: Any) -> None:  # 安静：日志只打业务事件
            pass

        # ------------------------------ 公共 ------------------------------

        def origin(self) -> Optional[str]:
            return self.headers.get("Origin")

        def origin_ok(self) -> bool:
            o = self.origin()
            return o is None or o in app.origins

        def cors(self) -> None:
            o = self.origin()
            if o and o in app.origins:
                self.send_header("Access-Control-Allow-Origin", o)
                self.send_header("Vary", "Origin")
                self.send_header("Access-Control-Allow-Private-Network", "true")

        def reply(self, status: int, body: Any, ctype: str = "application/json; charset=utf-8") -> None:
            raw = body if isinstance(body, bytes) else json.dumps(body, ensure_ascii=False).encode("utf-8")
            self.send_response(status)
            self.cors()
            self.send_header("Content-Type", ctype)
            self.send_header("Content-Length", str(len(raw)))
            self.send_header("Cache-Control", "no-store")
            self.end_headers()
            self.wfile.write(raw)

        def guard(self, allow_query_token: bool = False) -> bool:
            if self.headers.get("Host") not in allowed_hosts:
                self.reply(421, {"error": "Host 不对"})
                return False
            if not self.origin_ok():
                self.reply(403, {"error": "这个网页来源没有被允许"})
                return False
            token = self.headers.get("X-Runner-Token") or ""
            if not token and allow_query_token:
                token = (parse_qs(urlparse(self.path).query).get("t") or [""])[0]
            code = str(app.cfg.get("pair_code") or "")
            if not code or not secrets.compare_digest(token.replace("-", "").replace(" ", ""), code):
                app.bad_tokens += 1
                if app.bad_tokens > 20:
                    time.sleep(1)  # 有人在猜配对码：拖慢
                self.reply(401, {"error": "配对码不对"})
                return False
            return True

        def body(self) -> Dict[str, Any]:
            n = int(self.headers.get("Content-Length") or 0)
            if n > 256 * 1024:
                raise ValueError("请求体过大")
            raw = self.rfile.read(n) if n else b""
            return json.loads(raw.decode("utf-8")) if raw else {}

        # ------------------------------ 路由 ------------------------------

        def do_OPTIONS(self) -> None:  # noqa: N802
            if not self.origin_ok():
                self.reply(403, {"error": "这个网页来源没有被允许"})
                return
            self.send_response(204)
            self.cors()
            self.send_header("Access-Control-Allow-Methods", "GET, POST, PUT, OPTIONS")
            self.send_header("Access-Control-Allow-Headers", "Content-Type, X-Runner-Token")
            self.send_header("Access-Control-Max-Age", "600")
            self.send_header("Content-Length", "0")
            self.end_headers()

        def do_GET(self) -> None:  # noqa: N802
            url = urlparse(self.path)
            if url.path == "/hello":
                # 不要配对码：网页靠它判断「执行器开没开」
                if self.headers.get("Host") not in allowed_hosts or not self.origin_ok():
                    self.reply(403, {"error": "forbidden"})
                    return
                self.reply(200, {"app": "boss-runner", "version": VERSION, "demo": app.session.boss.demo})
                return
            if url.path == "/state":
                if not self.guard():
                    return
                q = parse_qs(url.query)
                if not app.connected:
                    app.connected = True
                    say(bold("✓"), "网页已连接，可以在网页控制台里操作了")
                try:
                    ls = int((q.get("ls") or ["0"])[0] or 0)
                except ValueError:
                    ls = 0
                dv = app.data.version()
                ext = app.session.boss.external()
                snap = app.session.snapshot()
                out: Dict[str, Any] = {
                    "dataVersion": dv, "live": snap, "external": ext,
                    "config": {"inviteConfigured": bool(app.cfg.get("invite_code")), "demo": app.session.boss.demo},
                }
                if (q.get("dv") or [""])[0] != dv:
                    out["data"] = app.data.read()
                out["plan"] = app.session.plan_info()
                out["logSeq"] = _log_seq
                out["logs"] = logs_since(ls)
                self.reply(200, out)
                return
            if url.path == "/report":
                if not self.guard(allow_query_token=True):
                    return
                app.session.boss.run("report")
                if app.paths.report.exists():
                    self.reply(200, app.paths.report.read_bytes(), "text/html; charset=utf-8")
                else:
                    self.reply(404, {"error": "还没有投递记录，生成不了汇报页"})
                return
            self.reply(404, {"error": "没有这个接口"})

        def do_PUT(self) -> None:  # noqa: N802
            if not self.guard():
                return
            url = urlparse(self.path)
            try:
                patch = self.body()
            except Exception as e:  # noqa: BLE001
                self.reply(400, {"error": str(e)})
                return
            if url.path == "/profile":
                cur = read_json(app.paths.profile, dict(PROFILE_TEMPLATE))
                for k, v in patch.items():
                    if k not in PROFILE_KEYS:
                        continue
                    if k in ("prefer", "avoid", "judge_rules", "target_cities", "keyword_plan"):
                        if isinstance(v, list):
                            cur[k] = [str(x).strip() for x in v if str(x).strip()][:60]
                    elif k in ("min_salary_k", "max_salary_k"):
                        try:
                            n = int(float(v))
                            if 0 <= n < 1000:
                                cur[k] = n
                        except (TypeError, ValueError):
                            pass
                    else:
                        cur[k] = str(v or "")[:2000]
                if cur.get("target_cities"):
                    cur["target_city"] = cur["target_cities"][0]
                write_json(app.paths.profile, cur)
                say(dim("·"), "判岗画像已更新")
                self.reply(200, {"ok": True, "profile": cur})
                return
            if url.path == "/config":
                upd: Dict[str, Any] = {}
                if isinstance(patch.get("inviteCode"), str):
                    upd["invite_code"] = patch["inviteCode"].strip()[:80]
                ep = patch.get("llmEndpoint")
                if isinstance(ep, str) and re.match(r"^(https://|http://(localhost|127\.0\.0\.1)(:\d+)?/)", ep):
                    upd["llm_endpoint"] = ep[:200]
                if isinstance(patch.get("resumeBrief"), str):
                    upd["resume_brief"] = patch["resumeBrief"][:1500]
                if upd:
                    app.cfg.update(**upd)
                self.reply(200, {"ok": True, "inviteConfigured": bool(app.cfg.get("invite_code"))})
                return
            self.reply(404, {"error": "没有这个接口"})

        def do_POST(self) -> None:  # noqa: N802
            if not self.guard():
                return
            if urlparse(self.path).path != "/action":
                self.reply(404, {"error": "没有这个接口"})
                return
            try:
                payload = self.body()
                app.session.act(str(payload.get("type") or ""), payload)
                self.reply(202, {"ok": True})
            except Busy as e:
                self.reply(409, {"error": f"上一步（{e}）还在执行，稍等"})
            except StepError as e:
                say(red("!"), str(e))
                app.session.set(notice={"tone": "warn", "text": str(e)})
                self.reply(422, {"error": str(e)})
            except Exception as e:  # noqa: BLE001
                self.reply(400, {"error": str(e)})

    return Handler


# ═════════════════════════════════════════════════════════════════════
# 启动
# ═════════════════════════════════════════════════════════════════════


def find_ego() -> Optional[str]:
    for p in [shutil.which("ego-browser"), str(Path.home() / ".local/bin/ego-browser"),
              "/opt/homebrew/bin/ego-browser", "/usr/local/bin/ego-browser"]:
        if p and os.path.exists(p):
            return p
    return None


def main() -> None:
    ap = argparse.ArgumentParser(description="BOSS 直聘投递 · 本机执行器")
    ap.add_argument("--port", type=int, default=DEFAULT_PORT)
    ap.add_argument("--data-dir", default=None, help="数据目录（画像、投递记录），默认 ~/Library/Application Support/BossRunner")
    ap.add_argument("--skill-dir", default=None, help="投递技能目录（含 scripts/），默认用安装包自带的 skill/")
    ap.add_argument("--demo", action="store_true", help="演示模式：模拟 BOSS，不碰真实浏览器")
    ap.add_argument("--allow-origin", action="append", default=[], help="额外允许的网页来源")
    ap.add_argument("--reset-code", action="store_true", help="重新生成配对码")
    a = ap.parse_args()

    if sys.version_info < (3, 9):
        print("需要 Python 3.9 或更新版本。")
        sys.exit(1)

    data_dir = Path(a.data_dir).expanduser().resolve() if a.data_dir else DEFAULT_DATA_DIR
    if a.demo and not a.data_dir:
        data_dir = DEFAULT_DATA_DIR / "demo"
    skill_dir = Path(a.skill_dir).expanduser().resolve() if a.skill_dir else APP_DIR / "skill"
    if not a.demo and not (skill_dir / "scripts" / "_live_driver.py").exists():
        print(red(f"没找到投递技能脚本：{skill_dir}/scripts/_live_driver.py"))
        print("重新运行一次网页上的安装命令即可修复。")
        sys.exit(1)

    paths = Paths(data_dir, None if a.demo else skill_dir)
    paths.work.mkdir(parents=True, exist_ok=True)
    if not paths.profile.exists():
        write_json(paths.profile, PROFILE_TEMPLATE)

    cfg = Config(paths.config)
    if a.reset_code or not cfg.get("pair_code"):
        cfg.update(pair_code=f"{secrets.randbelow(10 ** 8):08d}")
    code = str(cfg.get("pair_code"))

    boss = FakeBoss(paths) if a.demo else RealBoss(paths)
    session = Session(boss, paths, cfg)
    app = App(session, DataView(paths), cfg, paths, a.port, DEFAULT_ORIGINS + a.allow_origin)

    try:
        server = http.server.ThreadingHTTPServer(("127.0.0.1", a.port), make_handler(app))
    except OSError:
        print(red(f"端口 {a.port} 已被占用：执行器可能已经在另一个终端窗口里运行了。"))
        sys.exit(1)
    server.daemon_threads = True

    ego = find_ego()
    bar = dim("│")
    print()
    print(f"  {bold('BOSS 投递 · 本机执行器')}  {dim('v' + VERSION)}" + (f"  {bold('演示模式')}" if a.demo else ""))
    print(f"  {bar} 配对码   {bold(code[:4] + ' ' + code[4:])}   {dim('在网页「投递」页输入一次即可')}")
    print(f"  {bar} 网页     {DEFAULT_ORIGINS[0]}  {dim('→ 投递')}")
    print(f"  {bar} 数据     {dim(str(data_dir))}")
    if not a.demo:
        print(f"  {bar} Ego      {ego or red('没找到 ego-browser：先安装 Ego Lite 并在里面登录 BOSS 直聘')}")
    print(f"  {bar} 退出     {dim('Ctrl+C（自动投递会在当前这一步做完后停下）')}")
    print()
    say(bold("✓"), "已就绪，等网页连接", f"127.0.0.1:{a.port}")

    try:
        server.serve_forever(poll_interval=0.5)
    except KeyboardInterrupt:
        print()
        if session.running():
            session.stop_auto("执行器退出")
        say(dim("·"), "已退出")
    finally:
        server.server_close()


if __name__ == "__main__":
    main()
