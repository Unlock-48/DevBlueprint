"use client";

import { LogoutButton } from "@/components/auth/logout-button";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";

type Status = "TODO" | "IN_PROGRESS" | "DONE";
type Tab = "overview" | "checklist" | "issues";
type ProjectSort = "updated" | "created" | "name" | "starred";
type Theme = "LIGHT" | "DARK" | "SYSTEM";

type ChecklistItem = {
  id: string;
  title: string;
  area: string;
  phase: string;
  details: string;
  priority: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  status: Status;
  origin: "EXPLICIT" | "INFERRED" | "PROPOSED";
  createdAt: string;
  updatedAt: string;
};

type Project = {
  id: string;
  name: string;
  description: string;
  starred: boolean;
  createdAt: string;
  updatedAt: string;
  documents?: Array<{ createdAt: string }>;
  items: ChecklistItem[];
};

type DocumentRecord = {
  id: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  status: "UPLOADED" | "PARSED" | "FAILED";
  createdAt: string;
  chunkCount?: number;
};

type AnalysisResult = {
  summary: string;
  stack: string[];
  structure: string[];
  issues: Array<{
    severity: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
    title: string;
    detail: string;
  }>;
  checklist: Array<{
    phase: string;
    area: string;
    title: string;
    details: string;
    priority: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  }>;
  readinessScore: number;
};

type AnalysisRun = {
  id: string;
  provider: string;
  model: string;
  status: "PROCESSING" | "COMPLETED" | "FAILED";
  resultJson?: AnalysisResult | null;
  errorMessage?: string | null;
  startedAt: string;
  completedAt?: string | null;
};

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

const statusLabel: Record<Status, string> = {
  TODO: "ยังไม่เริ่ม",
  IN_PROGRESS: "กำลังทำ",
  DONE: "เสร็จแล้ว",
};

export default function Home() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [loading, setLoading] = useState(true);
  const [apiError, setApiError] = useState("");
  const [tab, setTab] = useState<Tab>("overview");
  const [showNewProject, setShowNewProject] = useState(false);
  const [showProjectList, setShowProjectList] = useState(true);
  const [editingProject, setEditingProject] = useState<Project | null>(null);
  const [editingItem, setEditingItem] = useState<ChecklistItem | null>(null);
  const [showStructureModal, setShowStructureModal] = useState(false);
  const [openItemMenu, setOpenItemMenu] = useState<string | null>(null);
  const [projectSort, setProjectSort] = useState<ProjectSort>("updated");
  const [starredOnly, setStarredOnly] = useState(false);
  const [newProjectName, setNewProjectName] = useState("");
  const [newItemTitle, setNewItemTitle] = useState("");
  const [filter, setFilter] = useState<Status | "ALL">("ALL");
  const [documents, setDocuments] = useState<DocumentRecord[]>([]);
  const [analysis, setAnalysis] = useState<AnalysisRun | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [showNotes, setShowNotes] = useState(false);
  const [notesByProject, setNotesByProject] = useState<Record<string, string>>(
    {},
  );
  const fileInputRef = useRef<HTMLInputElement>(null);
  const project =
    projects.find((entry) => entry.id === selectedId) ?? projects[0];
  const items = project?.items ?? [];
  const completed = items.filter((item) => item.status === "DONE").length;
  const progress = items.length
    ? Math.round((completed / items.length) * 100)
    : 0;
  const readiness =
    analysis?.resultJson?.readinessScore ?? Math.max(0, progress - 8);
  const issueCount = analysis?.resultJson?.issues.length ?? 0;
  const visibleItems =
    filter === "ALL" ? items : items.filter((item) => item.status === filter);
  const timestamp = (value: string) => {
    const parsed = Date.parse(value);
    return Number.isNaN(parsed) ? 0 : parsed;
  };
  const visibleProjects = projects
    .filter((entry) => !starredOnly || entry.starred)
    .toSorted((a, b) => {
      if (projectSort === "name") return a.name.localeCompare(b.name, "th");
      if (projectSort === "created")
        return timestamp(b.createdAt) - timestamp(a.createdAt);
      if (projectSort === "starred")
        return (
          Number(b.starred) - Number(a.starred) ||
          timestamp(b.updatedAt) - timestamp(a.updatedAt)
        );
      return timestamp(b.updatedAt) - timestamp(a.updatedAt);
    });

  useEffect(() => {
    const savedTheme = localStorage.getItem(
      "devblueprint-theme",
    ) as Theme | null;
    if (savedTheme)
      document.documentElement.dataset.theme = savedTheme.toLowerCase();
  }, []);

  useEffect(() => {
    const selectProject = (event: Event) => {
      const projectId = (event as CustomEvent<string>).detail;
      if (projectId) setSelectedId(projectId);
    };
    window.addEventListener("devblueprint:select-project", selectProject);
    return () =>
      window.removeEventListener("devblueprint:select-project", selectProject);
  }, []);

  useEffect(() => {
    async function loadProjects() {
      try {
        const response = await fetch("/api/projects", { cache: "no-store" });
        const payload = (await response.json()) as {
          projects?: Project[];
          error?: { message?: string };
        };
        if (!response.ok)
          throw new Error(payload.error?.message ?? "โหลดโปรเจกต์ไม่สำเร็จ");
        setProjects(payload.projects ?? []);
        setSelectedId(payload.projects?.[0]?.id ?? "");
      } catch (error) {
        setApiError(
          error instanceof Error ? error.message : "โหลดโปรเจกต์ไม่สำเร็จ",
        );
      } finally {
        setLoading(false);
      }
    }
    void loadProjects();
  }, []);

  useEffect(() => {
    if (!selectedId) return;
    let cancelled = false;
    async function loadDocuments() {
      const response = await fetch(`/api/projects/${selectedId}/documents`, {
        cache: "no-store",
      });
      if (!response.ok) return;
      const payload = (await response.json()) as {
        documents: DocumentRecord[];
      };
      if (!cancelled) setDocuments(payload.documents);
    }
    void loadDocuments();
    return () => {
      cancelled = true;
    };
  }, [selectedId]);

  useEffect(() => {
    if (!showNotes) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setShowNotes(false);
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [showNotes]);

  function updateNote(value: string) {
    if (!selectedId) return;
    setNotesByProject((current) => ({ ...current, [selectedId]: value }));
    localStorage.setItem(`devblueprint-note-${selectedId}`, value);
  }

  useEffect(() => {
    if (!selectedId) return;
    let cancelled = false;
    async function loadAnalysis() {
      const response = await fetch(`/api/projects/${selectedId}/analysis`, {
        cache: "no-store",
      });
      if (!response.ok) return;
      const payload = (await response.json()) as { run: AnalysisRun | null };
      if (!cancelled) setAnalysis(payload.run);
    }
    void loadAnalysis();
    return () => {
      cancelled = true;
    };
  }, [selectedId]);

  async function cycleStatus(itemId: string) {
    if (!project) return;
    const item = items.find((entry) => entry.id === itemId);
    if (!item) return;
    const status: Status =
      item.status === "TODO"
        ? "IN_PROGRESS"
        : item.status === "IN_PROGRESS"
          ? "DONE"
          : "TODO";
    const response = await fetch(
      `/api/projects/${project.id}/items/${itemId}`,
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      },
    );
    if (!response.ok) {
      setApiError("เปลี่ยนสถานะ checklist ไม่สำเร็จ");
      return;
    }
    const payload = (await response.json()) as { item: ChecklistItem };
    setProjects((current) =>
      current.map((entry) =>
        entry.id === project.id
          ? {
              ...entry,
              items: entry.items.map((value) =>
                value.id === itemId ? payload.item : value,
              ),
              updatedAt: new Date().toISOString(),
            }
          : entry,
      ),
    );
  }

  async function addItem(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const title = newItemTitle.trim();
    if (!title) return;
    if (!project) return;
    const response = await fetch(`/api/projects/${project.id}/items`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title }),
    });
    if (!response.ok) {
      setApiError("เพิ่ม checklist ไม่สำเร็จ");
      return;
    }
    const payload = (await response.json()) as { item: ChecklistItem };
    setProjects((current) =>
      current.map((entry) =>
        entry.id === project.id
          ? {
              ...entry,
              items: [...entry.items, payload.item],
              updatedAt: new Date().toISOString(),
            }
          : entry,
      ),
    );
    setNewItemTitle("");
  }

  async function createProject(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const name = newProjectName.trim();
    if (!name) return;
    const response = await fetch("/api/projects", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, description: "โปรเจกต์ใหม่" }),
    });
    if (!response.ok) {
      setApiError("สร้างโปรเจกต์ไม่สำเร็จ");
      return;
    }

    const payload = (await response.json()) as { project: Project };
    setProjects((current) => [payload.project, ...current]);
    setDocuments([]);
    setSelectedId(payload.project.id);
    setNewProjectName("");
    setShowNewProject(false);
    setTab("overview");
  }

  async function toggleProjectStar(entry: Project) {
    const response = await fetch(`/api/projects/${entry.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ starred: !entry.starred }),
    });
    if (!response.ok) {
      setApiError("เปลี่ยนสถานะติดดาวไม่สำเร็จ");
      return;
    }

    const payload = (await response.json()) as {
      project: Pick<Project, "id" | "starred" | "updatedAt">;
    };
    setProjects((current) =>
      current.map((value) =>
        value.id === entry.id
          ? {
              ...value,
              starred: payload.project.starred,
              updatedAt: payload.project.updatedAt,
            }
          : value,
      ),
    );
  }

  async function saveProject(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editingProject) return;
    const form = new FormData(event.currentTarget);
    const response = await fetch(`/api/projects/${editingProject.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: String(form.get("name") ?? "").trim(),
        description: String(form.get("description") ?? "").trim(),
      }),
    });
    const payload = (await response.json().catch(() => ({}))) as {
      project?: Project;
      error?: { message?: string };
    };
    if (!response.ok || !payload.project) {
      setApiError(payload.error?.message ?? "แก้ไขโปรเจกต์ไม่สำเร็จ");
      return;
    }
    setProjects((current) =>
      current.map((entry) =>
        entry.id === editingProject.id
          ? { ...entry, ...payload.project }
          : entry,
      ),
    );
    setEditingProject(null);
  }

  async function deleteProject(entry: Project) {
    if (!window.confirm(`ต้องการลบโปรเจกต์ “${entry.name}” หรือไม่?`)) return;
    const response = await fetch(`/api/projects/${entry.id}`, {
      method: "DELETE",
    });
    if (!response.ok) {
      setApiError("ลบโปรเจกต์ไม่สำเร็จ");
      return;
    }
    const remaining = projects.filter((value) => value.id !== entry.id);
    setProjects(remaining);
    if (entry.id === selectedId) setSelectedId(remaining[0]?.id ?? "");
  }

  async function saveItem(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!project || !editingItem) return;
    const form = new FormData(event.currentTarget);
    const response = await fetch(
      `/api/projects/${project.id}/items/${editingItem.id}`,
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: String(form.get("title") ?? "").trim(),
          area: String(form.get("area") ?? "").trim() || "New requirement",
        }),
      },
    );
    const payload = (await response.json().catch(() => ({}))) as {
      item?: ChecklistItem;
      error?: { message?: string };
    };
    if (!response.ok || !payload.item) {
      setApiError(payload.error?.message ?? "แก้ไขรายการไม่สำเร็จ");
      return;
    }
    setProjects((current) =>
      current.map((entry) =>
        entry.id === project.id
          ? {
              ...entry,
              items: entry.items.map((item) =>
                item.id === editingItem.id ? payload.item! : item,
              ),
            }
          : entry,
      ),
    );
    setEditingItem(null);
  }

  async function deleteItem(item: ChecklistItem) {
    if (!project || !window.confirm(`ต้องการลบ “${item.title}” หรือไม่?`))
      return;
    const response = await fetch(
      `/api/projects/${project.id}/items/${item.id}`,
      { method: "DELETE" },
    );
    if (!response.ok) {
      setApiError("ลบรายการไม่สำเร็จ");
      return;
    }
    setProjects((current) =>
      current.map((entry) =>
        entry.id === project.id
          ? {
              ...entry,
              items: entry.items.filter((value) => value.id !== item.id),
            }
          : entry,
      ),
    );
    setOpenItemMenu(null);
  }

  async function uploadDocument(file: File) {
    if (!project) return;
    if (file.size === 0) {
      setApiError("กรุณาเลือกไฟล์ก่อนอัปโหลด");
      return;
    }
    setUploading(true);
    setApiError("");
    const form = new FormData();
    form.append("file", file);
    const response = await fetch(`/api/projects/${project.id}/documents`, {
      method: "POST",
      body: form,
    });
    const payload = (await response.json().catch(() => ({}))) as {
      document?: DocumentRecord;
      error?: { message?: string };
    };
    setUploading(false);
    if (!response.ok || !payload.document) {
      setApiError(payload.error?.message ?? "อัปโหลดเอกสารไม่สำเร็จ");
      return;
    }
    setDocuments((current) => [payload.document as DocumentRecord, ...current]);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  async function startAnalysis() {
    if (!project || !documents.length) {
      setApiError("ต้องอัปโหลดเอกสารก่อนเริ่มวิเคราะห์");
      return;
    }
    setAnalyzing(true);
    setApiError("");
    const response = await fetch(`/api/projects/${project.id}/analysis`, {
      method: "POST",
    });
    const payload = (await response.json().catch(() => ({}))) as {
      run?: AnalysisRun;
      error?: { message?: string };
    };
    setAnalyzing(false);
    if (!response.ok || !payload.run) {
      setApiError(payload.error?.message ?? "เริ่มวิเคราะห์ไม่สำเร็จ");
      if (payload.run) setAnalysis(payload.run);
      return;
    }
    setAnalysis(payload.run);
    const projectsResponse = await fetch("/api/projects", {
      cache: "no-store",
    });
    if (projectsResponse.ok) {
      const projectsPayload = (await projectsResponse.json()) as {
        projects?: Project[];
      };
      setProjects(projectsPayload.projects ?? []);
    }
  }

  function projectStructure() {
    const analyzedStructure =
      analysis?.status === "COMPLETED"
        ? (analysis.resultJson?.structure ?? [])
        : [];
    const folders = ["src/app", "src/components", "prisma", "docs", "public"];
    const documentNodes = documents.map(
      (document) => `${document.fileName} (${document.chunkCount ?? 0} chunks)`,
    );
    const checklistNodes = items.slice(0, 5).map((item) => item.title);
    return {
      folders: analyzedStructure.length ? [] : folders,
      documentNodes: analyzedStructure.length ? [] : documentNodes,
      checklistNodes: analyzedStructure.length ? [] : checklistNodes,
      exactLines: analyzedStructure,
    };
  }

  function exportStructurePdf() {
    window.print();
  }

  function downloadExport(format: "json" | "md") {
    const body =
      format === "json"
        ? JSON.stringify(project, null, 2)
        : `# ${project.name}\n\n${project.description}\n\n## Checklist\n\n${items
            .map(
              (item) =>
                `- [${item.status === "DONE" ? "x" : " "}] ${item.title} (${item.area})`,
            )
            .join("\n")}`;
    const blob = new Blob([body], {
      type: format === "json" ? "application/json" : "text/markdown",
    });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `${project.name.toLowerCase().replaceAll(" ", "-")}.${format}`;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  if (loading)
    return <main className="loading-screen">กำลังโหลดข้อมูลโปรเจกต์...</main>;
  if (!project)
    return (
      <main className="loading-screen">
        <div>
          <h1>ยังไม่มีโปรเจกต์</h1>
          <p>{apiError || "กรุณาเข้าสู่ระบบและสร้างโปรเจกต์แรก"}</p>
          <button
            className="button primary"
            onClick={() => setShowNewProject(true)}
          >
            ＋ สร้างโปรเจกต์
          </button>
        </div>
        {showNewProject && (
          <NewProjectModal
            newProjectName={newProjectName}
            setNewProjectName={setNewProjectName}
            onClose={() => setShowNewProject(false)}
            onSubmit={createProject}
          />
        )}
      </main>
    );

  return (
    <main className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <span className="brand-mark">D</span>
          <span>DevBlueprint</span>
        </div>
        <div className="workspace-label">WORKSPACE</div>
        <Link href="/settings" className="workspace-switch">
          <span className="workspace-avatar">D</span>
          <span>ทีมของฉัน</span>
          <span className="chevron">⌄</span>
        </Link>
        <ContributionCalendar projects={projects} />
        <nav className="side-nav" aria-label="เมนูหลัก">
          <button className="nav-link active">
            <span>▦</span>ภาพรวม
          </button>
          <button
            className={showProjectList ? "nav-link active" : "nav-link"}
            onClick={() => setShowProjectList((current) => !current)}
          >
            <span>◈</span>โปรเจกต์{" "}
            <span className="nav-count">{projects.length}⌄</span>
          </button>
          {showProjectList && (
            <div className="project-picker" aria-label="เลือกโปรเจกต์">
              <div className="project-picker-tools">
                <select
                  aria-label="เรียงโปรเจกต์"
                  value={projectSort}
                  onChange={(event) =>
                    setProjectSort(event.target.value as ProjectSort)
                  }
                >
                  <option value="updated">แก้ไขล่าสุด</option>
                  <option value="created">สร้างล่าสุด</option>
                  <option value="name">ชื่อตัวอักษร</option>
                  <option value="starred">ติดดาวก่อน</option>
                </select>
                <button
                  className={starredOnly ? "star-filter active" : "star-filter"}
                  onClick={() => setStarredOnly((current) => !current)}
                  aria-label="แสดงเฉพาะโปรเจกต์ติดดาว"
                >
                  ★
                </button>
              </div>
              {visibleProjects.map((entry) => (
                <div
                  className={
                    entry.id === project.id
                      ? "project-picker-item selected"
                      : "project-picker-item"
                  }
                  key={entry.id}
                >
                  <button
                    className="project-picker-select"
                    onClick={() => {
                      setSelectedId(entry.id);
                      setTab("overview");
                      setFilter("ALL");
                    }}
                  >
                    <span className="project-picker-dot" />{" "}
                    <span>{entry.name}</span>
                  </button>
                  <button
                    className={
                      entry.starred ? "project-star active" : "project-star"
                    }
                    onClick={() => void toggleProjectStar(entry)}
                    aria-label={
                      entry.starred
                        ? `ยกเลิกติดดาว ${entry.name}`
                        : `ติดดาว ${entry.name}`
                    }
                  >
                    ★
                  </button>
                  <button
                    className="project-action"
                    onClick={() => setEditingProject(entry)}
                    aria-label={`แก้ไข ${entry.name}`}
                  >
                    ✎
                  </button>
                  <button
                    className="project-action danger"
                    onClick={() => void deleteProject(entry)}
                    aria-label={`ลบ ${entry.name}`}
                  >
                    🗑
                  </button>
                </div>
              ))}
              {visibleProjects.length === 0 && (
                <span className="project-picker-empty">
                  ยังไม่มีโปรเจกต์ติดดาว
                </span>
              )}
              <button
                className="project-picker-new"
                onClick={() => setShowNewProject(true)}
              >
                ＋ สร้างโปรเจกต์ใหม่
              </button>
            </div>
          )}
          <Link href="/settings" className="nav-link">
            <span>⚙</span>ตั้งค่า
          </Link>
        </nav>
        <div className="sidebar-footer">
          <div className="ai-status">
            <span className="status-dot" />
            AI พร้อมใช้งาน
          </div>
          <div className="user-card">
            <div className="user-avatar">คุณ</div>
            <div>
              <strong>ผู้ใช้งาน</strong>
              <small>OWNER</small>
            </div>
            <LogoutButton />
          </div>
        </div>
      </aside>

      <section className="content">
        <header className="topbar">
          <div className="breadcrumbs">
            <span>Workspace</span>
            <b>/</b>
            <strong>{project.name}</strong>
          </div>
          <div className="top-actions">
            <button className="help-button" onClick={() => setShowNotes(true)}>
              โน้ต
            </button>
          </div>
        </header>

        <div className="page-content">
          <div className="page-heading">
            <div>
              <div className="eyebrow">PROJECT OVERVIEW</div>
              <h1>{project.name}</h1>
              <p>{project.description}</p>
            </div>
            <div className="heading-actions">
              <button
                className="button secondary"
                onClick={() => downloadExport("md")}
              >
                ส่งออก MD
              </button>
              <input
                ref={fileInputRef}
                className="visually-hidden"
                type="file"
                accept=".md,.txt,.json,.yaml,.yml,text/plain,application/json"
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  if (file) void uploadDocument(file);
                }}
              />
              <button
                className="button secondary"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
              >
                {uploading ? "กำลังอัปโหลด..." : "↑ อัปโหลดเอกสาร"}
              </button>
              <button
                className="button secondary"
                onClick={() => setEditingProject(project)}
              >
                ✎ แก้ไข
              </button>
              <button
                className="button primary"
                onClick={() => setShowNewProject(true)}
              >
                ＋ โปรเจกต์ใหม่
              </button>
            </div>
          </div>

          <div className="project-tabs">
            {(
              [
                ["overview", "ภาพรวม"],
                ["checklist", "Checklist"],
                ["issues", "ประเด็นที่ต้องตัดสินใจ"],
              ] as const
            ).map(([value, label]) => (
              <button
                key={value}
                data-tab={value}
                className={tab === value ? "tab active" : "tab"}
                onClick={() => setTab(value)}
              >
                {label}
                {value === "issues" && (
                  <span className="tab-badge">{issueCount}</span>
                )}
              </button>
            ))}
          </div>

          {tab === "overview" && (
            <>
              <div className="stats-grid">
                <div className="stat-card">
                  <span className="stat-icon purple">◒</span>
                  <div>
                    <small>Readiness score</small>
                    <strong>
                      {readiness}
                      <em>/100</em>
                    </strong>
                  </div>
                  <span className="trend">
                    {analysis?.status === "COMPLETED" ? "จาก AI" : "รอ AI"}
                  </span>
                </div>
                <div className="stat-card">
                  <span className="stat-icon blue">✓</span>
                  <div>
                    <small>ความคืบหน้า</small>
                    <strong>
                      {progress}
                      <em>%</em>
                    </strong>
                  </div>
                  <span className="trend neutral">
                    {completed}/{items.length} รายการ
                  </span>
                </div>
                <div className="stat-card">
                  <span className="stat-icon orange">!</span>
                  <div>
                    <small>ประเด็นเปิดอยู่</small>
                    <strong>{issueCount}</strong>
                  </div>
                  <span className="trend warning">
                    {issueCount ? "ต้องตรวจสอบ" : "ยังไม่มีผล AI"}
                  </span>
                </div>
              </div>
              <div className="overview-grid">
                <section className="panel progress-panel">
                  <div className="panel-heading">
                    <div>
                      <h2>ความคืบหน้าโปรเจกต์</h2>
                      <p>อัปเดตล่าสุด {project.updatedAt}</p>
                    </div>
                    <button
                      className="text-button"
                      onClick={() => setTab("checklist")}
                    >
                      ดูทั้งหมด →
                    </button>
                  </div>
                  <div className="progress-row">
                    <div
                      className="progress-ring"
                      style={
                        {
                          "--progress": `${progress * 3.6}deg`,
                        } as React.CSSProperties
                      }
                    >
                      <div>
                        <strong>{progress}%</strong>
                        <small>เสร็จแล้ว</small>
                      </div>
                    </div>
                    <div className="progress-legend">
                      <div>
                        <span className="legend-dot done" />
                        <span>เสร็จแล้ว</span>
                        <strong>{completed}</strong>
                      </div>
                      <div>
                        <span className="legend-dot doing" />
                        <span>กำลังทำ</span>
                        <strong>
                          {
                            items.filter(
                              (item) => item.status === "IN_PROGRESS",
                            ).length
                          }
                        </strong>
                      </div>
                      <div>
                        <span className="legend-dot todo" />
                        <span>ยังไม่เริ่ม</span>
                        <strong>
                          {
                            items.filter((item) => item.status === "TODO")
                              .length
                          }
                        </strong>
                      </div>
                    </div>
                  </div>
                </section>
                <StructurePanel
                  projectName={project.name}
                  structure={projectStructure()}
                  onExport={exportStructurePdf}
                  onExpand={() => setShowStructureModal(true)}
                />
              </div>
              <DocumentPanel documents={documents} />
              <AnalysisPanel
                analysis={analysis}
                analyzing={analyzing}
                hasDocuments={documents.length > 0}
                onStart={() => void startAnalysis()}
              />
              <section className="panel checklist-panel">
                <div className="panel-heading">
                  <div>
                    <h2>Checklist ล่าสุด</h2>
                    <p>รายการงานจาก blueprint ของคุณ</p>
                  </div>
                  <button
                    className="text-button"
                    onClick={() => setTab("checklist")}
                  >
                    เปิด Checklist →
                  </button>
                </div>
                <div className="item-list">
                  {items.slice(0, 3).map((item) => (
                    <ChecklistRow
                      key={item.id}
                      item={item}
                      onClick={() => cycleStatus(item.id)}
                      menuOpen={openItemMenu === item.id}
                      onMenu={() =>
                        setOpenItemMenu(
                          openItemMenu === item.id ? null : item.id,
                        )
                      }
                      onEdit={() => {
                        setEditingItem(item);
                        setOpenItemMenu(null);
                      }}
                      onDelete={() => void deleteItem(item)}
                    />
                  ))}
                </div>
              </section>
            </>
          )}

          {tab === "checklist" && (
            <section className="panel full-panel">
              <div className="panel-heading">
                <div>
                  <h2>Checklist รายละเอียด</h2>
                  <p>
                    งานจาก AI ถูกแบ่งตาม Phase และหมวดงาน
                    แก้ไขสถานะได้ทีละรายการ
                  </p>
                </div>
                <button
                  className="button secondary small"
                  onClick={() => downloadExport("json")}
                >
                  ส่งออก JSON
                </button>
              </div>
              <form className="add-item" onSubmit={addItem}>
                <input
                  value={newItemTitle}
                  onChange={(event) => setNewItemTitle(event.target.value)}
                  placeholder="เพิ่ม requirement หรือ task ใหม่..."
                />
                <button className="button primary small">เพิ่มรายการ</button>
              </form>
              <div className="filter-row">
                {(["ALL", "TODO", "IN_PROGRESS", "DONE"] as const).map(
                  (value) => (
                    <button
                      key={value}
                      className={filter === value ? "filter active" : "filter"}
                      onClick={() => setFilter(value)}
                    >
                      {value === "ALL" ? "ทั้งหมด" : statusLabel[value]}
                    </button>
                  ),
                )}
              </div>
              {visibleItems.length ? (
                <ChecklistGroups
                  items={visibleItems}
                  openItemMenu={openItemMenu}
                  onStatus={cycleStatus}
                  onMenu={(id) =>
                    setOpenItemMenu(openItemMenu === id ? null : id)
                  }
                  onEdit={(item) => {
                    setEditingItem(item);
                    setOpenItemMenu(null);
                  }}
                  onDelete={deleteItem}
                />
              ) : (
                <div className="empty-state">ยังไม่มีรายการในสถานะนี้</div>
              )}
            </section>
          )}
          {tab === "issues" && (
            <section className="panel full-panel">
              <div className="panel-heading">
                <div>
                  <h2>ประเด็นที่ต้องตัดสินใจ</h2>
                  <p>จุดที่ควรทบทวนก่อนเริ่มพัฒนา</p>
                </div>
              </div>
              {analysis?.resultJson?.issues.length ? (
                <div className="issue-list">
                  {analysis.resultJson.issues.map((issue) => (
                    <div
                      className={`issue ${issue.severity.toLowerCase()}`}
                      key={`${issue.severity}-${issue.title}`}
                    >
                      <span>{issue.severity}</span>
                      <div>
                        <strong>{issue.title}</strong>
                        <p>{issue.detail}</p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="empty-state">
                  เริ่ม AI Analysis เพื่อให้ระบบตรวจหา Issues จากเอกสาร
                </div>
              )}
            </section>
          )}
        </div>
      </section>

      {showNotes && (
        <div
          className="note-drawer-backdrop"
          role="presentation"
          onMouseDown={() => setShowNotes(false)}
        >
          <aside
            className="note-drawer"
            role="dialog"
            aria-modal="true"
            aria-label="โน้ต"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <div className="note-drawer-header">
              <div>
                <div className="eyebrow">PROJECT NOTE</div>
                <h2>โน้ต</h2>
                <p>{project.name}</p>
              </div>
              <button
                className="modal-close inline"
                onClick={() => setShowNotes(false)}
                aria-label="ปิดโน้ต"
              >
                ×
              </button>
            </div>
            <textarea
              className="note-textarea"
              value={
                notesByProject[selectedId] ??
                (typeof window === "undefined"
                  ? ""
                  : (localStorage.getItem(`devblueprint-note-${selectedId}`) ??
                    ""))
              }
              onChange={(event) => updateNote(event.target.value)}
              placeholder="เขียนโน้ตสำหรับโปรเจกต์นี้..."
              autoFocus
            />
            <span className="note-hint">
              บันทึกอัตโนมัติในเบราว์เซอร์ของคุณ
            </span>
          </aside>
        </div>
      )}
      {apiError && (
        <div className="api-error" role="alert">
          {apiError}
        </div>
      )}
      {showNewProject && (
        <NewProjectModal
          newProjectName={newProjectName}
          setNewProjectName={setNewProjectName}
          onClose={() => setShowNewProject(false)}
          onSubmit={createProject}
        />
      )}
      {editingProject && (
        <EditProjectModal
          project={editingProject}
          onClose={() => setEditingProject(null)}
          onSubmit={saveProject}
        />
      )}
      {editingItem && (
        <EditItemModal
          item={editingItem}
          onClose={() => setEditingItem(null)}
          onSubmit={saveItem}
        />
      )}
      {showStructureModal && (
        <StructureModal
          projectName={project.name}
          structure={projectStructure()}
          onExport={exportStructurePdf}
          onClose={() => setShowStructureModal(false)}
        />
      )}
    </main>
  );
}

function ContributionCalendar({ projects }: { projects: Project[] }) {
  const [expanded, setExpanded] = useState(false);
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const today = new Date();
  const end = new Date(today);
  end.setHours(23, 59, 59, 999);
  const start = new Date(end);
  start.setDate(start.getDate() - 83);
  start.setDate(start.getDate() - start.getDay());
  const cells = Array.from({ length: expanded ? 364 : 84 }, (_, index) => {
    const date = new Date(start);
    date.setDate(start.getDate() + index);
    const key = date.toISOString().slice(0, 10);
    const activeProjects = projects.filter((project) => {
      const createdOrUploaded = [
        project.createdAt,
        ...(project.documents ?? []).map((document) => document.createdAt),
      ].some((value) => value.slice(0, 10) === key);
      const completedOnDate =
        project.items.length > 0 &&
        project.items.every((item) => item.status === "DONE") &&
        project.items
          .reduce(
            (latest, item) =>
              item.updatedAt > latest ? item.updatedAt : latest,
            project.createdAt,
          )
          .slice(0, 10) === key;
      return createdOrUploaded || completedOnDate;
    });
    const completed = activeProjects.some(
      (project) =>
        project.items.length > 0 &&
        project.items.every((item) => item.status === "DONE") &&
        project.items
          .reduce(
            (latest, item) =>
              item.updatedAt > latest ? item.updatedAt : latest,
            project.createdAt,
          )
          .slice(0, 10) === key,
    );
    return {
      date,
      key,
      count: activeProjects.length,
      activeProjects,
      completed,
    };
  });
  const visibleCells = cells.filter((cell) => cell.date <= end);
  const total = visibleCells.reduce((sum, cell) => sum + cell.count, 0);
  const level = (cell: (typeof cells)[number]) =>
    cell.count === 0 ? "empty" : cell.completed ? "complete" : "active";
  const selected = visibleCells.find((cell) => cell.key === selectedKey);
  const monthLabels = Array.from({ length: 4 }, (_, index) => {
    const date = new Date(
      today.getFullYear(),
      today.getMonth() - (3 - index),
      1,
    );
    return `${date.toLocaleString("th-TH", { month: "long" })} ${date.getFullYear() + 543}`;
  });
  return (
    <section
      className={`workspace-calendar ${expanded ? "expanded" : ""}`}
      aria-label="กิจกรรมของทีม"
    >
      <div className="workspace-calendar-heading">
        <div>
          <strong>กิจกรรม</strong>
          <span className="workspace-calendar-months">
            {monthLabels.slice(-4).join(" · ")}
          </span>
        </div>
        <div className="workspace-calendar-heading-actions">
          <span>{total} ครั้ง</span>
          <button
            className="workspace-calendar-expand"
            onClick={() => setExpanded((value) => !value)}
            aria-label={expanded ? "ปิดปฏิทิน" : "ขยายปฏิทิน"}
          >
            {expanded ? "×" : "⛶"}
          </button>
        </div>
      </div>
      <div className="workspace-calendar-grid">
        {visibleCells.map((cell) => (
          <button
            className={`workspace-calendar-cell ${level(cell)} ${selectedKey === cell.key ? "selected" : ""}`}
            title={
              cell.count
                ? `${cell.key} · ${cell.activeProjects.length} โปรเจกต์`
                : cell.key
            }
            onClick={() => setSelectedKey(cell.count ? cell.key : null)}
            key={cell.key}
          />
        ))}
      </div>
      {selected?.activeProjects.length ? (
        <div className="workspace-calendar-detail">
          <strong>{selected.key}</strong>
          {selected.activeProjects.map((entry) => (
            <button
              key={entry.id}
              onClick={() => {
                setSelectedKey(null);
                window.dispatchEvent(
                  new CustomEvent("devblueprint:select-project", {
                    detail: entry.id,
                  }),
                );
              }}
            >
              <span className="workspace-calendar-detail-dot" />
              {entry.name}
              <small>{selected.completed ? "เสร็จสมบูรณ์" : "มีกิจกรรม"}</small>
            </button>
          ))}
        </div>
      ) : null}
      <div className="workspace-calendar-footer">
        <span>น้อย</span>
        <i className="workspace-calendar-cell empty" />
        <i className="workspace-calendar-cell low" />
        <i className="workspace-calendar-cell medium" />
        <i className="workspace-calendar-cell high" />
        <span>มาก</span>
      </div>
    </section>
  );
}

function NewProjectModal({
  newProjectName,
  setNewProjectName,
  onClose,
  onSubmit,
}: {
  newProjectName: string;
  setNewProjectName: (value: string) => void;
  onClose: () => void;
  onSubmit: (event: React.FormEvent<HTMLFormElement>) => void;
}) {
  return (
    <div className="modal-backdrop" role="presentation">
      <form className="modal" onSubmit={onSubmit}>
        <button type="button" className="modal-close" onClick={onClose}>
          ×
        </button>
        <div className="eyebrow">NEW PROJECT</div>
        <h2>สร้างโปรเจกต์ใหม่</h2>
        <p>เริ่มจากชื่อโปรเจกต์ แล้วเพิ่ม requirement ได้ทันที</p>
        <label htmlFor="project-name">ชื่อโปรเจกต์</label>
        <input
          id="project-name"
          autoFocus
          value={newProjectName}
          onChange={(event) => setNewProjectName(event.target.value)}
          placeholder="เช่น Customer Portal"
        />
        <div className="modal-actions">
          <button type="button" className="button secondary" onClick={onClose}>
            ยกเลิก
          </button>
          <button className="button primary">สร้างโปรเจกต์</button>
        </div>
      </form>
    </div>
  );
}

function AnalysisPanel({
  analysis,
  analyzing,
  hasDocuments,
  onStart,
}: {
  analysis: AnalysisRun | null;
  analyzing: boolean;
  hasDocuments: boolean;
  onStart: () => void;
}) {
  const result = analysis?.resultJson;
  return (
    <section className="panel analysis-panel">
      <div className="panel-heading">
        <div>
          <h2>AI Analysis</h2>
          <p>
            วิเคราะห์เอกสารด้วย Google Gemini เพื่อสรุปเทคโนโลยี โครงสร้าง
            และงานถัดไป
          </p>
        </div>
        <button
          className="button primary small"
          onClick={onStart}
          disabled={!hasDocuments || analyzing}
        >
          {analyzing
            ? "กำลังวิเคราะห์..."
            : analysis?.status === "COMPLETED"
              ? "วิเคราะห์ใหม่"
              : "เริ่มวิเคราะห์"}
        </button>
      </div>
      {!hasDocuments && (
        <div className="empty-state">อัปโหลดเอกสารก่อนเริ่มวิเคราะห์</div>
      )}
      {analysis?.status === "PROCESSING" && (
        <div className="empty-state">
          กำลังส่งเอกสารให้ Gemini วิเคราะห์ กรุณารอสักครู่...
        </div>
      )}
      {analysis?.status === "FAILED" && (
        <div className="issue high">
          <span>ERROR</span>
          <div>
            <strong>วิเคราะห์ไม่สำเร็จ</strong>
            <p>
              {analysis.errorMessage ||
                "ตรวจสอบ GEMINI_API_KEY และลองใหม่อีกครั้ง"}
            </p>
          </div>
        </div>
      )}
      {result && analysis.status === "COMPLETED" && (
        <div className="analysis-result">
          <div className="analysis-score">
            <strong>{result.readinessScore}</strong>
            <span>/100 readiness</span>
          </div>
          <div className="analysis-summary">
            <strong>เอกสารนี้เกี่ยวกับอะไร</strong>
            <p>{result.summary}</p>
          </div>
          <div className="analysis-meta">
            <span>พบ Tech stack {result.stack.length} รายการ</span>
            <span>
              โครงสร้าง{" "}
              {result.structure.length ? "นำเข้าตามเอกสาร" : "ไม่พบในเอกสาร"}
            </span>
            <span>สร้าง Checklist {result.checklist.length} รายการ</span>
          </div>
          {!!result.issues.length && (
            <div className="analysis-issues">
              <strong>ประเด็นที่พบ {result.issues.length} รายการ</strong>
              {result.issues.slice(0, 3).map((issue) => (
                <div
                  className={`issue ${issue.severity.toLowerCase()}`}
                  key={`${issue.severity}-${issue.title}`}
                >
                  <span>{issue.severity}</span>
                  <div>
                    <strong>{issue.title}</strong>
                    <p>{issue.detail}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
          <button
            className="text-button"
            onClick={() =>
              document
                .querySelector<HTMLButtonElement>('[data-tab="checklist"]')
                ?.click()
            }
          >
            ดู Checklist แบบละเอียด →
          </button>
        </div>
      )}
    </section>
  );
}

function StructurePanel({
  projectName,
  structure,
  onExport,
  onExpand,
}: {
  projectName: string;
  structure: {
    folders: string[];
    documentNodes: string[];
    checklistNodes: string[];
    exactLines?: string[];
  };
  onExport: () => void;
  onExpand: () => void;
}) {
  return (
    <section className="panel structure-panel">
      <div className="panel-heading">
        <div>
          <h2>โครงสร้างโปรเจกต์</h2>
          <p>โครงสร้างที่ได้จากการวิเคราะห์โปรเจกต์</p>
        </div>
        <div className="structure-actions">
          <button className="structure-action" onClick={onExport}>
            ส่งออก PDF
          </button>
          <button
            className="structure-action"
            onClick={onExpand}
            aria-label="ขยายโครงสร้าง"
          >
            ⛶
          </button>
        </div>
      </div>
      <StructureTree projectName={projectName} structure={structure} />
    </section>
  );
}

function StructureTree({
  projectName,
  structure,
}: {
  projectName: string;
  structure: {
    folders: string[];
    documentNodes: string[];
    checklistNodes: string[];
    exactLines?: string[];
  };
}) {
  const exactNodes =
    structure.exactLines?.map((line, index) => {
      const markerIndex = line.search(/[├└]/);
      const root = index === 0;
      const beforeMarker = markerIndex >= 0 ? line.slice(0, markerIndex) : "";
      const label = root
        ? line.trim()
        : line
            .slice(markerIndex >= 0 ? markerIndex : 0)
            .replace(/^[├└]──\s*/, "")
            .replace(/^[├└]─\s*/, "")
            .trim();
      const depth = root ? 0 : Math.floor(beforeMarker.length / 4) + 1;
      const pathPart = label.split(/\s+#/, 1)[0]?.trim() ?? label;
      return {
        key: `${index}-${label}`,
        label,
        depth,
        folder: pathPart.endsWith("/"),
      };
    }) ?? [];
  return (
    <div className="structure-tree">
      {exactNodes.length ? (
        <div className="exact-structure">
          {exactNodes.map((node) => (
            <div
              className={
                node.depth === 0
                  ? "exact-structure-row root"
                  : "exact-structure-row"
              }
              style={{ "--tree-depth": node.depth } as React.CSSProperties}
              key={node.key}
            >
              <span className={node.folder ? "tree-folder" : "tree-file-icon"}>
                {node.folder ? "▰" : "▤"}
              </span>
              <span>{node.label}</span>
            </div>
          ))}
        </div>
      ) : (
        <>
          <div className="tree-root">
            <span>◆</span>
            {projectName}/
          </div>
          {structure.folders.map((folder) => (
            <div className="tree-node" key={folder}>
              <span className="tree-branch">├─</span>
              <span className="tree-folder">▰</span>
              <span>{folder}/</span>
            </div>
          ))}
          {structure.documentNodes.map((fileName) => (
            <div className="tree-node tree-file" key={fileName}>
              <span className="tree-branch">├─</span>
              <span>▤</span>
              <span>{fileName}</span>
            </div>
          ))}
          {structure.checklistNodes.length > 0 && (
            <>
              <div className="tree-node">
                <span className="tree-branch">└─</span>
                <span className="tree-folder">▰</span>
                <span>checklist/</span>
              </div>
              {structure.checklistNodes.map((item) => (
                <div className="tree-node tree-file tree-child" key={item}>
                  <span className="tree-branch">├─</span>
                  <span>□</span>
                  <span>{item}</span>
                </div>
              ))}
            </>
          )}
          {!structure.documentNodes.length &&
            !structure.checklistNodes.length && (
              <div className="structure-empty">
                อัปโหลดเอกสารเพื่อให้ AI สร้างโครงสร้างที่ตรงกับโปรเจกต์นี้
              </div>
            )}
        </>
      )}
    </div>
  );
}

function StructureModal({
  projectName,
  structure,
  onExport,
  onClose,
}: {
  projectName: string;
  structure: {
    folders: string[];
    documentNodes: string[];
    checklistNodes: string[];
    exactLines?: string[];
  };
  onExport: () => void;
  onClose: () => void;
}) {
  return (
    <div className="structure-modal-backdrop">
      <section
        className="structure-modal"
        role="dialog"
        aria-modal="true"
        aria-label="โครงสร้างโปรเจกต์"
      >
        <div className="structure-modal-header">
          <div>
            <div className="eyebrow">PROJECT STRUCTURE</div>
            <h2>{projectName}</h2>
          </div>
          <div className="structure-actions">
            <button className="structure-action" onClick={onExport}>
              ส่งออก PDF
            </button>
            <button className="modal-close inline" onClick={onClose}>
              ×
            </button>
          </div>
        </div>
        <StructureTree projectName={projectName} structure={structure} />
      </section>
    </div>
  );
}

function DocumentPanel({ documents }: { documents: DocumentRecord[] }) {
  return (
    <section className="panel document-panel">
      <div className="panel-heading">
        <div>
          <h2>เอกสารที่อัปโหลด</h2>
          <p>เอกสารของโปรเจกต์นี้ที่พร้อมใช้ในการวิเคราะห์</p>
        </div>
        <span className="document-count">{documents.length} ไฟล์</span>
      </div>
      {documents.length ? (
        <div className="uploaded-documents">
          {documents.map((document) => (
            <div className="uploaded-document" key={document.id}>
              <span className="document-icon">DOC</span>
              <div className="uploaded-document-copy">
                <strong>{document.fileName}</strong>
                <small>
                  {formatBytes(document.sizeBytes)} · {document.chunkCount ?? 0}{" "}
                  chunks
                </small>
              </div>
              <span
                className={`document-status ${document.status.toLowerCase()}`}
              >
                {document.status === "PARSED"
                  ? "พร้อมวิเคราะห์"
                  : document.status}
              </span>
            </div>
          ))}
        </div>
      ) : (
        <div className="document-empty">ยังไม่มีเอกสารที่อัปโหลด</div>
      )}
    </section>
  );
}

function ChecklistGroups({
  items,
  openItemMenu,
  onStatus,
  onMenu,
  onEdit,
  onDelete,
}: {
  items: ChecklistItem[];
  openItemMenu: string | null;
  onStatus: (id: string) => void;
  onMenu: (id: string) => void;
  onEdit: (item: ChecklistItem) => void;
  onDelete: (item: ChecklistItem) => void;
}) {
  const groups = new Map<string, ChecklistItem[]>();
  for (const item of items)
    groups.set(item.phase, [...(groups.get(item.phase) ?? []), item]);
  return (
    <div className="checklist-groups">
      {[...groups.entries()].map(([phase, phaseItems]) => (
        <section className="checklist-group" key={phase}>
          <div className="checklist-group-heading">
            <h3>{phase}</h3>
            <span>{phaseItems.length} งาน</span>
          </div>
          <div className="item-list">
            {phaseItems.map((item) => (
              <ChecklistRow
                key={item.id}
                item={item}
                onClick={() => onStatus(item.id)}
                menuOpen={openItemMenu === item.id}
                onMenu={() => onMenu(item.id)}
                onEdit={() => onEdit(item)}
                onDelete={() => void onDelete(item)}
              />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}

function ChecklistRow({
  item,
  onClick,
  menuOpen,
  onMenu,
  onEdit,
  onDelete,
}: {
  item: ChecklistItem;
  onClick: () => void;
  menuOpen: boolean;
  onMenu: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  return (
    <div className="checklist-row">
      <button
        className={`check-button ${item.status.toLowerCase()}`}
        onClick={onClick}
        aria-label={`เปลี่ยนสถานะ ${item.title}`}
      >
        {item.status === "DONE"
          ? "✓"
          : item.status === "IN_PROGRESS"
            ? "•"
            : ""}
      </button>
      <div className="item-copy">
        <strong className={item.status === "DONE" ? "completed" : ""}>
          {item.title}
        </strong>
        <div>
          <span>{item.area}</span>
          <span className={`priority ${item.priority.toLowerCase()}`}>
            {item.priority}
          </span>
          <span className={`origin ${item.origin.toLowerCase()}`}>
            {item.origin}
          </span>
        </div>
        {item.details && <p className="item-details">{item.details}</p>}
      </div>
      <span className={`status-label ${item.status.toLowerCase()}`}>
        {statusLabel[item.status]}
      </span>
      <div className="item-menu-wrap">
        <button
          className="more-button"
          onClick={onMenu}
          aria-label={`ตัวเลือก ${item.title}`}
        >
          •••
        </button>
        {menuOpen && (
          <div className="item-menu">
            <button onClick={onEdit}>✎ แก้ไขชื่อและรายละเอียด</button>
            <button className="danger" onClick={onDelete}>
              🗑 ลบรายการ
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function EditProjectModal({
  project,
  onClose,
  onSubmit,
}: {
  project: Project;
  onClose: () => void;
  onSubmit: (event: React.FormEvent<HTMLFormElement>) => void;
}) {
  return (
    <div className="modal-backdrop" role="presentation">
      <form className="modal" onSubmit={onSubmit}>
        <button type="button" className="modal-close" onClick={onClose}>
          ×
        </button>
        <div className="eyebrow">EDIT PROJECT</div>
        <h2>แก้ไขโปรเจกต์</h2>
        <p>เปลี่ยนชื่อและรายละเอียดของโปรเจกต์</p>
        <label htmlFor="edit-project-name">ชื่อโปรเจกต์</label>
        <input
          id="edit-project-name"
          name="name"
          defaultValue={project.name}
          autoFocus
          required
        />
        <label htmlFor="edit-project-description">รายละเอียด</label>
        <textarea
          id="edit-project-description"
          name="description"
          defaultValue={project.description}
          rows={4}
        />
        <div className="modal-actions">
          <button type="button" className="button secondary" onClick={onClose}>
            ยกเลิก
          </button>
          <button className="button primary">บันทึก</button>
        </div>
      </form>
    </div>
  );
}

function EditItemModal({
  item,
  onClose,
  onSubmit,
}: {
  item: ChecklistItem;
  onClose: () => void;
  onSubmit: (event: React.FormEvent<HTMLFormElement>) => void;
}) {
  return (
    <div className="modal-backdrop" role="presentation">
      <form className="modal" onSubmit={onSubmit}>
        <button type="button" className="modal-close" onClick={onClose}>
          ×
        </button>
        <div className="eyebrow">EDIT CHECKLIST</div>
        <h2>แก้ไขรายการ</h2>
        <p>แก้ไขชื่อและรายละเอียดของ requirement</p>
        <label htmlFor="edit-item-title">ชื่อรายการ</label>
        <input
          id="edit-item-title"
          name="title"
          defaultValue={item.title}
          autoFocus
          required
        />
        <label htmlFor="edit-item-area">รายละเอียด</label>
        <textarea
          id="edit-item-area"
          name="area"
          defaultValue={item.area}
          rows={3}
        />
        <div className="modal-actions">
          <button type="button" className="button secondary" onClick={onClose}>
            ยกเลิก
          </button>
          <button className="button primary">บันทึก</button>
        </div>
      </form>
    </div>
  );
}
