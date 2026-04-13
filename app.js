/* ============================================================
   PORTAFOLIO — ARQUITECTURA DE SOFTWARE
   app.js — Lógica principal con integración Supabase
   ============================================================

   CONFIGURACIÓN REQUERIDA:
   1. Crea un proyecto en https://supabase.com
   2. Ejecuta el SQL en supabase_setup.sql
   3. Crea un bucket "portfolio" en Storage (público)
   4. Reemplaza SUPABASE_URL y SUPABASE_ANON_KEY abajo
   5. Cambia ADMIN_DISPLAY_NAME por tu nombre real
   ============================================================ */

"use strict";

// ============================================================
//  ⚙️  CONFIGURACIÓN — Editar estos valores
// ============================================================
const CONFIG = {
  SUPABASE_URL:      "https://yacldllzebtdntrremcm.supabase.co",   // Ej: https://xxxx.supabase.co
  SUPABASE_ANON_KEY: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlhY2xkbGx6ZWJ0ZG50cnJlbWNtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzYwMzY1MzQsImV4cCI6MjA5MTYxMjUzNH0.-N6IgsnPw_ieyimDzXBf69d-Ur3sft5G-WZgM3nJN1k",     // Clave pública anon
  STORAGE_BUCKET:    "portfolio",                 // Nombre del bucket
  ADMIN_DISPLAY_NAME: "Jhon Taipe Chavez",               // Tu nombre real para el header
  VISITOR_NAME:      "Visitante",
};

// Nombres de las unidades
const UNIT_NAMES = {
  1: "Unidad I",
  2: "Unidad II",
  3: "Unidad III",
  4: "Unidad IV",
};

// Iconos según tipo MIME
const FILE_ICONS = {
  "application/pdf":  "📕",
  "image/":           "🖼️",
  "video/":           "🎬",
  "audio/":           "🎵",
  "application/zip":  "📦",
  "application/x-rar":"📦",
  "application/vnd.openxmlformats-officedocument.wordprocessingml":  "📝",
  "application/msword": "📝",
  "application/vnd.openxmlformats-officedocument.spreadsheetml":     "📊",
  "application/vnd.ms-excel": "📊",
  "application/vnd.openxmlformats-officedocument.presentationml":    "📋",
  "application/vnd.ms-powerpoint": "📋",
  "text/plain":       "📃",
  "text/html":        "💻",
  "text/css":         "💻",
  "application/javascript": "💻",
  "application/json": "🔧",
};

// ============================================================
//  INICIALIZACIÓN SUPABASE
// ============================================================
let sb;
try {
  sb = supabase.createClient(CONFIG.SUPABASE_URL, CONFIG.SUPABASE_ANON_KEY);
} catch (err) {
  console.error("Error inicializando Supabase:", err);
}

// ============================================================
//  ESTADO DE LA APLICACIÓN
// ============================================================
const state = {
  currentUnit: 1,
  currentWeek: 1,
  isAdmin:     false,
  selectedFile: null,
};

// ============================================================
//  REFERENCIAS DOM
// ============================================================
const $ = (id) => document.getElementById(id);

const DOM = {
  // Modal
  loginModal:     $("loginModal"),
  closeModal:     $("closeModal"),
  emailInput:     $("emailInput"),
  passwordInput:  $("passwordInput"),
  togglePass:     $("togglePass"),
  loginBtn:       $("loginBtn"),
  loginBtnText:   $("loginBtnText"),
  loginError:     $("loginError"),
  // Header
  adminBtn:       $("adminBtn"),
  logoutBtn:      $("logoutBtn"),
  userRoleBadge:  $("userRoleBadge"),
  displayName:    $("displayName"),
  // Breadcrumb
  bcUnit:         $("bcUnit"),
  bcWeek:         $("bcWeek"),
  sectionTitle:   $("sectionTitle"),
  sectionSub:     $("sectionSub"),
  // Upload
  uploadBtn:      $("uploadBtn"),
  uploadPanel:    $("uploadPanel"),
  dropZone:       $("dropZone"),
  fileInput:      $("fileInput"),
  fileDescription:$("fileDescription"),
  cancelUpload:   $("cancelUpload"),
  confirmUpload:  $("confirmUpload"),
  selectedFileName:$("selectedFileName"),
  uploadProgress: $("uploadProgress"),
  progressFill:   $("progressFill"),
  progressLabel:  $("progressLabel"),
  // Grid
  filesGrid:      $("filesGrid"),
  loadingState:   $("loadingState"),
  emptyState:     $("emptyState"),
  // Toast
  toast:          $("toast"),
  toastMsg:       $("toastMsg"),
  toastIcon:      $("toastIcon"),
  // Footer
  footerYear:     $("footerYear"),
};

// ============================================================
//  AUTENTICACIÓN
// ============================================================

/** Verifica si hay sesión activa al cargar */
async function checkSession() {
  if (!sb) return;
  try {
    const { data: { session } } = await sb.auth.getSession();
    if (session) setAdminMode(true);
  } catch (err) {
    console.warn("No se pudo verificar sesión:", err);
  }
}

/** Inicia sesión con email y contraseña */
async function login() {
  const email    = DOM.emailInput.value.trim();
  const password = DOM.passwordInput.value;

  if (!email || !password) {
    showLoginError("Completa todos los campos.");
    return;
  }

  DOM.loginBtn.disabled    = true;
  DOM.loginBtnText.textContent = "Verificando…";
  DOM.loginError.classList.add("hidden");

  try {
    const { error } = await sb.auth.signInWithPassword({ email, password });
    if (error) {
      showLoginError("Email o contraseña incorrectos.");
    } else {
      DOM.loginModal.classList.add("hidden");
      setAdminMode(true);
      showToast("¡Bienvenido, Admin!", "success", "✓");
      resetLoginForm();
    }
  } catch (err) {
    showLoginError("Error de conexión. Intenta de nuevo.");
  } finally {
    DOM.loginBtn.disabled    = false;
    DOM.loginBtnText.textContent = "Iniciar sesión";
  }
}

/** Cierra la sesión del admin */
async function logout() {
  try {
    await sb.auth.signOut();
  } catch (_) {}
  setAdminMode(false);
  showToast("Sesión cerrada", "success", "✓");
}

/** Activa o desactiva el modo admin en la UI */
function setAdminMode(isAdmin) {
  state.isAdmin = isAdmin;

  DOM.displayName.textContent   = isAdmin ? CONFIG.ADMIN_DISPLAY_NAME : CONFIG.VISITOR_NAME;
  DOM.userRoleBadge.textContent  = isAdmin ? "Admin" : "Visitante";
  DOM.userRoleBadge.classList.toggle("admin", isAdmin);

  DOM.uploadBtn.classList.toggle("hidden", !isAdmin);
  DOM.adminBtn.classList.toggle("hidden",  isAdmin);
  DOM.logoutBtn.classList.toggle("hidden", !isAdmin);

  // Ocultar panel de carga si cierra sesión
  if (!isAdmin) DOM.uploadPanel.classList.add("hidden");

  loadFiles();
}

function showLoginError(msg) {
  DOM.loginError.innerHTML = `<i class="fas fa-circle-exclamation"></i> ${escapeHtml(msg)}`;
  DOM.loginError.classList.remove("hidden");
}

function resetLoginForm() {
  DOM.emailInput.value    = "";
  DOM.passwordInput.value = "";
  DOM.loginError.classList.add("hidden");
}

// ============================================================
//  NAVEGACIÓN
// ============================================================

/** Inicializa listeners de las pestañas de unidades */
function initNavigation() {
  document.querySelectorAll(".unit-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      document.querySelectorAll(".unit-btn").forEach((b) => {
        b.classList.remove("active");
        b.setAttribute("aria-selected", "false");
      });
      btn.classList.add("active");
      btn.setAttribute("aria-selected", "true");
      state.currentUnit = parseInt(btn.dataset.unit, 10);
      updateBreadcrumb();
      loadFiles();
    });
  });

  document.querySelectorAll(".week-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      document.querySelectorAll(".week-btn").forEach((b) => {
        b.classList.remove("active");
        b.setAttribute("aria-selected", "false");
      });
      btn.classList.add("active");
      btn.setAttribute("aria-selected", "true");
      state.currentWeek = parseInt(btn.dataset.week, 10);
      updateBreadcrumb();
      loadFiles();
    });
  });
}

/** Actualiza breadcrumb y título de sección */
function updateBreadcrumb() {
  const unitName = UNIT_NAMES[state.currentUnit];
  const weekName = `Semana ${state.currentWeek}`;

  DOM.bcUnit.textContent      = unitName;
  DOM.bcWeek.textContent      = weekName;
  DOM.sectionTitle.textContent = `Arquitectura de Software — ${unitName}, ${weekName}`;
  DOM.sectionSub.textContent  = `Archivos y recursos de la ${weekName.toLowerCase()}`;

  // Cerrar panel de upload al cambiar de sección
  DOM.uploadPanel.classList.add("hidden");
  resetUploadForm();
}

// ============================================================
//  CARGA DE ARCHIVOS
// ============================================================

/** Carga los archivos de la unidad/semana actual desde Supabase */
async function loadFiles() {
  // Limpiar grid
  DOM.filesGrid.querySelectorAll(".file-card").forEach((c) => c.remove());
  DOM.loadingState.classList.remove("hidden");
  DOM.emptyState.classList.add("hidden");

  if (!sb) {
    DOM.loadingState.classList.add("hidden");
    showToast("Supabase no configurado. Revisa CONFIG en app.js", "error", "✕");
    return;
  }

  try {
    const { data, error } = await sb
      .from("files")
      .select("*")
      .eq("unit", state.currentUnit)
      .eq("week", state.currentWeek)
      .order("uploaded_at", { ascending: false });

    DOM.loadingState.classList.add("hidden");

    if (error) throw error;

    if (!data || data.length === 0) {
      DOM.emptyState.classList.remove("hidden");
      return;
    }

    data.forEach((file, index) => {
      const card = buildFileCard(file);
      // Delay escalonado en animación
      card.style.animationDelay = `${index * 0.05}s`;
      DOM.filesGrid.appendChild(card);
    });

  } catch (err) {
    DOM.loadingState.classList.add("hidden");
    console.error("Error cargando archivos:", err);
    showToast("Error al cargar archivos: " + (err.message || "desconocido"), "error", "✕");
  }
}

// ============================================================
//  CONSTRUCCIÓN DE TARJETA
// ============================================================

/** Devuelve el emoji según el tipo MIME */
function getFileIcon(mimeType) {
  if (!mimeType) return "📄";
  for (const [key, icon] of Object.entries(FILE_ICONS)) {
    if (mimeType.startsWith(key)) return icon;
  }
  return "📄";
}

/** Formatea fecha en español */
function formatDate(dateStr) {
  try {
    return new Date(dateStr).toLocaleDateString("es-PE", {
      day: "2-digit", month: "short", year: "numeric",
    });
  } catch (_) { return dateStr; }
}

/** Construye el elemento DOM de la tarjeta de archivo */
function buildFileCard(file) {
  const card = document.createElement("article");
  card.className = "file-card";
  card.setAttribute("aria-label", `Archivo: ${file.file_name}`);

  card.innerHTML = `
    <div class="file-card-icon">${getFileIcon(file.file_type)}</div>
    <div class="file-card-name">${escapeHtml(file.file_name)}</div>
    ${file.description
      ? `<div class="file-card-desc">${escapeHtml(file.description)}</div>`
      : ""}
    <div class="file-card-meta">
      <i class="fas fa-clock" style="margin-right:4px;opacity:.5;"></i>
      ${formatDate(file.uploaded_at)}
    </div>
    <div class="file-card-actions">
      <button class="btn-view" aria-label="Ver archivo ${escapeHtml(file.file_name)}">
        <i class="fas fa-eye"></i> Ver
      </button>
      ${state.isAdmin
        ? `<button class="btn-delete" aria-label="Eliminar archivo ${escapeHtml(file.file_name)}"
              data-id="${escapeHtml(file.id)}"
              data-path="${escapeHtml(file.storage_path || "")}">
            <i class="fas fa-trash-can"></i>
          </button>`
        : ""}
    </div>
  `;

  // Ver archivo
  card.querySelector(".btn-view").addEventListener("click", () => {
    window.open(file.file_url, "_blank", "noopener,noreferrer");
  });

  // Eliminar (admin)
  const deleteBtn = card.querySelector(".btn-delete");
  if (deleteBtn) {
    deleteBtn.addEventListener("click", () =>
      deleteFile(file.id, file.storage_path || "")
    );
  }

  return card;
}

// ============================================================
//  SUBIDA DE ARCHIVOS
// ============================================================

/** Activa/desactiva el panel de upload */
DOM.uploadBtn.addEventListener("click", () => {
  const isHidden = DOM.uploadPanel.classList.toggle("hidden");
  if (!isHidden) {
    DOM.fileDescription.focus();
  }
});

DOM.cancelUpload.addEventListener("click", () => {
  DOM.uploadPanel.classList.add("hidden");
  resetUploadForm();
});

/** Selección por click */
DOM.fileInput.addEventListener("change", (e) => {
  const f = e.target.files[0];
  if (f) setSelectedFile(f);
});

/** Drag & Drop */
DOM.dropZone.addEventListener("dragover", (e) => {
  e.preventDefault();
  DOM.uploadPanel.classList.add("drag-over");
});
DOM.dropZone.addEventListener("dragleave", () => {
  DOM.uploadPanel.classList.remove("drag-over");
});
DOM.dropZone.addEventListener("drop", (e) => {
  e.preventDefault();
  DOM.uploadPanel.classList.remove("drag-over");
  const f = e.dataTransfer.files[0];
  if (f) setSelectedFile(f);
});

function setSelectedFile(file) {
  state.selectedFile = file;
  DOM.selectedFileName.textContent = `📎 ${file.name} (${formatBytes(file.size)})`;
  DOM.selectedFileName.classList.remove("hidden");
}

function formatBytes(bytes) {
  if (bytes < 1024) return bytes + " B";
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB";
  return (bytes / (1024 * 1024)).toFixed(1) + " MB";
}

/** Confirmar subida */
DOM.confirmUpload.addEventListener("click", uploadFile);

async function uploadFile() {
  if (!state.selectedFile) {
    showToast("Selecciona un archivo primero.", "error", "✕");
    return;
  }

  const file        = state.selectedFile;
  const description = DOM.fileDescription.value.trim();
  const timestamp   = Date.now();
  const safeName    = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
  const storagePath = `unit${state.currentUnit}/week${state.currentWeek}/${timestamp}_${safeName}`;

  // UI — inicio
  DOM.confirmUpload.disabled    = true;
  DOM.confirmUpload.innerHTML   = '<i class="fas fa-spinner fa-spin"></i> Subiendo…';
  DOM.uploadProgress.classList.remove("hidden");
  DOM.progressLabel.classList.remove("hidden");
  setProgress(20, "Subiendo archivo al storage…");

  try {
    // 1. Subir archivo a Supabase Storage
    const { error: storageErr } = await sb.storage
      .from(CONFIG.STORAGE_BUCKET)
      .upload(storagePath, file, { cacheControl: "3600", upsert: false });

    if (storageErr) throw new Error("Storage: " + storageErr.message);

    setProgress(65, "Registrando en base de datos…");

    // 2. Obtener URL pública
    const { data: urlData } = sb.storage
      .from(CONFIG.STORAGE_BUCKET)
      .getPublicUrl(storagePath);

    if (!urlData?.publicUrl) throw new Error("No se pudo obtener la URL pública.");

    // 3. Guardar en tabla `files`
    const { error: dbErr } = await sb.from("files").insert({
      unit:         state.currentUnit,
      week:         state.currentWeek,
      file_name:    file.name,
      file_url:     urlData.publicUrl,
      storage_path: storagePath,
      file_type:    file.type || "application/octet-stream",
      description:  description || null,
    });

    if (dbErr) {
      // Intentar borrar el archivo del storage si falla BD
      await sb.storage.from(CONFIG.STORAGE_BUCKET).remove([storagePath]).catch(() => {});
      throw new Error("Base de datos: " + dbErr.message);
    }

    setProgress(100, "¡Archivo subido con éxito!");

    setTimeout(() => {
      DOM.uploadPanel.classList.add("hidden");
      resetUploadForm();
      loadFiles();
      showToast("Archivo subido correctamente.", "success", "✓");
    }, 600);

  } catch (err) {
    console.error("Error al subir:", err);
    showToast("Error al subir: " + err.message, "error", "✕");
    resetUploadForm();
  }
}

function setProgress(pct, label) {
  DOM.progressFill.style.width = pct + "%";
  DOM.progressLabel.textContent = label;
}

function resetUploadForm() {
  state.selectedFile             = null;
  DOM.fileInput.value            = "";
  DOM.fileDescription.value      = "";
  DOM.selectedFileName.classList.add("hidden");
  DOM.selectedFileName.textContent = "";
  DOM.confirmUpload.disabled     = false;
  DOM.confirmUpload.innerHTML    = '<i class="fas fa-upload"></i> Subir';
  DOM.uploadProgress.classList.add("hidden");
  DOM.progressLabel.classList.add("hidden");
  DOM.progressFill.style.width   = "0%";
  DOM.uploadPanel.classList.remove("drag-over");
}

// ============================================================
//  ELIMINACIÓN DE ARCHIVOS
// ============================================================

async function deleteFile(id, storagePath) {
  if (!confirm("¿Seguro que quieres eliminar este archivo? Esta acción no se puede deshacer.")) {
    return;
  }

  try {
    // 1. Eliminar registro de la base de datos
    const { error: dbErr } = await sb.from("files").delete().eq("id", id);
    if (dbErr) throw new Error("BD: " + dbErr.message);

    // 2. Eliminar archivo del storage
    if (storagePath) {
      const { error: stErr } = await sb.storage
        .from(CONFIG.STORAGE_BUCKET)
        .remove([storagePath]);
      if (stErr) console.warn("No se pudo borrar del storage:", stErr.message);
    }

    showToast("Archivo eliminado.", "success", "✓");
    loadFiles();

  } catch (err) {
    console.error("Error al eliminar:", err);
    showToast("Error al eliminar: " + err.message, "error", "✕");
  }
}

// ============================================================
//  TOAST
// ============================================================
let toastTimer;

function showToast(msg, type = "", icon = "") {
  DOM.toast.className = `toast ${type}`;
  DOM.toastMsg.textContent  = msg;
  DOM.toastIcon.textContent = icon;
  DOM.toast.classList.remove("hidden");

  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => DOM.toast.classList.add("hidden"), 3800);
}

// ============================================================
//  MODAL — EVENTOS
// ============================================================

DOM.adminBtn.addEventListener("click", () => {
  DOM.loginModal.classList.remove("hidden");
  DOM.emailInput.focus();
});

DOM.closeModal.addEventListener("click", () => {
  DOM.loginModal.classList.add("hidden");
  resetLoginForm();
});

DOM.loginModal.addEventListener("click", (e) => {
  if (e.target === DOM.loginModal) {
    DOM.loginModal.classList.add("hidden");
    resetLoginForm();
  }
});

DOM.loginBtn.addEventListener("click", login);

// Enter en contraseña dispara login
DOM.passwordInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter") login();
});

// Mostrar/ocultar contraseña
DOM.togglePass.addEventListener("click", () => {
  const isPassword = DOM.passwordInput.type === "password";
  DOM.passwordInput.type = isPassword ? "text" : "password";
  DOM.togglePass.querySelector("i").className = isPassword
    ? "fas fa-eye-slash"
    : "fas fa-eye";
});

DOM.logoutBtn.addEventListener("click", logout);

// ============================================================
//  UTILIDADES
// ============================================================

/** Escapa caracteres HTML para prevenir XSS */
function escapeHtml(str) {
  if (typeof str !== "string") return String(str);
  const map = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" };
  return str.replace(/[&<>"']/g, (c) => map[c]);
}

// ============================================================
//  INICIALIZACIÓN
// ============================================================

function init() {
  // Año en footer
  if (DOM.footerYear) DOM.footerYear.textContent = new Date().getFullYear();

  // Nombre del visitante por defecto
  DOM.displayName.textContent = CONFIG.VISITOR_NAME;

  // Navegación
  initNavigation();

  // Labels iniciales
  updateBreadcrumb();

  // Verificar sesión y cargar archivos
  checkSession().then(() => {
    if (!state.isAdmin) loadFiles();
  });
}

// Arrancar cuando el DOM esté listo
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", init);
} else {
  init();
}
