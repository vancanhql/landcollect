const STORAGE_KEY = "parcel-projects-v2";
const OLD_STORAGE_KEY = "parcel-field-records-v1";

const screens = {
  projects: document.querySelector("#projectsScreen"),
  project: document.querySelector("#projectScreen"),
  wizard: document.querySelector("#wizardScreen"),
  map: document.querySelector("#mapScreen"),
};

const headerTitle = document.querySelector("#headerTitle");
const backButton = document.querySelector("#backButton");
const installButton = document.querySelector("#installButton");
const installDock = document.querySelector("#installDock");
const installDialog = document.querySelector("#installDialog");
const installText = document.querySelector("#installText");
const updateDock = document.querySelector("#updateDock");
const updateButton = document.querySelector("#updateButton");

const projectList = document.querySelector("#projectList");
const projectCount = document.querySelector("#projectCount");
const createProjectButton = document.querySelector("#createProjectButton");
const projectDialog = document.querySelector("#projectDialog");
const projectForm = document.querySelector("#projectForm");
const projectDialogTitle = document.querySelector("#projectDialogTitle");
const cancelProjectButton = document.querySelector("#cancelProjectButton");
const projectFields = {
  id: document.querySelector("#projectId"),
  name: document.querySelector("#projectName"),
  description: document.querySelector("#projectDescription"),
};

const projectNameTitle = document.querySelector("#projectNameTitle");
const projectDescriptionText = document.querySelector("#projectDescriptionText");
const parcelCountLarge = document.querySelector("#parcelCountLarge");
const photoCountLarge = document.querySelector("#photoCountLarge");
const editProjectButton = document.querySelector("#editProjectButton");
const projectMapButton = document.querySelector("#projectMapButton");
const exportProjectButton = document.querySelector("#exportProjectButton");
const createParcelButton = document.querySelector("#createParcelButton");
const parcelList = document.querySelector("#parcelList");
const parcelCount = document.querySelector("#parcelCount");

const parcelForm = document.querySelector("#parcelForm");
const parcelFields = {
  id: document.querySelector("#parcelId"),
  parcelCode: document.querySelector("#parcelCode"),
  owner: document.querySelector("#owner"),
  area: document.querySelector("#area"),
  landType: document.querySelector("#landType"),
  status: document.querySelector("#status"),
  notes: document.querySelector("#notes"),
  lat: document.querySelector("#lat"),
  lng: document.querySelector("#lng"),
};
const gpsButton = document.querySelector("#gpsButton");
const pickOnMapButton = document.querySelector("#pickOnMapButton");
const photoInput = document.querySelector("#photoInput");
const photoPreview = document.querySelector("#photoPreview");
const reviewBox = document.querySelector("#reviewBox");
const deleteParcelButton = document.querySelector("#deleteParcelButton");
const saveParcelButton = document.querySelector("#saveParcelButton");
const prevStepButton = document.querySelector("#prevStepButton");
const nextStepButton = document.querySelector("#nextStepButton");

const saveMapPointButton = document.querySelector("#saveMapPointButton");
const messageDialog = document.querySelector("#messageDialog");
const messageText = document.querySelector("#messageText");

let projects = [];
let currentProjectId = "";
let currentParcelId = "";
let currentStep = 0;
let draftPhotos = [];
let activeScreen = "projects";
let previousScreen = "projects";
let mapMode = "viewProject";
let deferredInstallPrompt = null;
let pendingMapPoint = null;
let map;
let baseLayers;
let currentBaseLayer;
let markerLayer;
let pickMarker;
let waitingServiceWorker = null;

function uid() {
  return crypto.randomUUID ? crypto.randomUUID() : `id-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function nowIso() {
  return new Date().toISOString();
}

function showMessage(message) {
  messageText.textContent = message;
  if (typeof messageDialog.showModal === "function") {
    messageDialog.showModal();
  } else {
    alert(message);
  }
}

function formatDate(value) {
  return new Intl.DateTimeFormat("vi-VN", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(new Date(value));
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function toNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function currentProject() {
  return projects.find((project) => project.id === currentProjectId);
}

function currentParcel() {
  return currentProject()?.parcels.find((parcel) => parcel.id === currentParcelId);
}

function loadProjects() {
  try {
    projects = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
  } catch {
    projects = [];
  }

  if (!projects.length) migrateOldRecords();
}

function migrateOldRecords() {
  try {
    const oldRecords = JSON.parse(localStorage.getItem(OLD_STORAGE_KEY) || "[]");
    if (!Array.isArray(oldRecords) || !oldRecords.length) return;

    projects = [
      {
        id: uid(),
        name: "Dự án đã chuyển đổi",
        description: "Dữ liệu được chuyển từ phiên bản lưu thửa đất cũ.",
        createdAt: nowIso(),
        updatedAt: nowIso(),
        parcels: oldRecords,
      },
    ];
    saveProjects();
  } catch {
    projects = [];
  }
}

function saveProjects() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(projects));
    return true;
  } catch {
    showMessage("Không lưu được dữ liệu. Bộ nhớ trình duyệt có thể đã đầy, thường do ảnh hiện trạng quá nhiều hoặc quá lớn.");
    return false;
  }
}

function showScreen(name, options = {}) {
  previousScreen = options.previousScreen || activeScreen;
  activeScreen = name;

  Object.entries(screens).forEach(([screenName, screen]) => {
    screen.classList.toggle("is-active", screenName === name);
  });

  updateHeader();

  if (name === "map") {
    ensureMap();
    setTimeout(() => {
      map.invalidateSize();
      renderMapMarkers();
    }, 80);
  }
}

function updateHeader() {
  headerTitle.textContent = "Ứng dụng thu thập thông tin thửa đất";
  backButton.hidden = activeScreen === "projects";
}

function goBack() {
  if (activeScreen === "project") {
    currentProjectId = "";
    currentParcelId = "";
    renderProjects();
    showScreen("projects");
    return;
  }

  if (activeScreen === "wizard") {
    renderProject();
    showScreen("project");
    return;
  }

  if (activeScreen === "map") {
    saveMapPointButton.hidden = true;
    pendingMapPoint = null;
    showScreen(previousScreen === "wizard" ? "wizard" : "project");
  }
}

function renderProjects() {
  projectCount.textContent = projects.length;
  projectList.innerHTML = "";

  if (!projects.length) {
    projectList.innerHTML = `<div class="empty-state">Chưa có dự án. Anh bấm “Tạo dự án” để bắt đầu một đợt khảo sát mới.</div>`;
    return;
  }

  projects
    .slice()
    .sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt))
    .forEach((project) => {
      const card = document.createElement("article");
      card.className = "item-card";
      card.innerHTML = `
        <div class="item-title">
          <span>${escapeHtml(project.name)}</span>
          <span>${project.parcels.length} thửa</span>
        </div>
        <div class="item-meta">
          <span>${escapeHtml(project.description || "Chưa có ghi chú khu vực")}</span>
          <span>Cập nhật: ${formatDate(project.updatedAt)}</span>
        </div>
      `;

      const actions = document.createElement("div");
      actions.className = "item-actions";
      actions.append(
        miniButton("Xem", () => openProject(project.id)),
        miniButton("Sửa", () => openProjectDialog(project)),
        miniButton("Xóa", () => deleteProject(project.id), "delete-mini"),
      );
      card.append(actions);
      projectList.append(card);
    });
}

function renderProject() {
  const project = currentProject();
  if (!project) {
    renderProjects();
    showScreen("projects");
    return;
  }

  projectNameTitle.textContent = project.name;
  projectDescriptionText.textContent = project.description || "Chưa có ghi chú khu vực.";
  parcelCount.textContent = project.parcels.length;
  parcelCountLarge.textContent = project.parcels.length;
  photoCountLarge.textContent = project.parcels.reduce((total, parcel) => total + (parcel.photos?.length || 0), 0);
  parcelList.innerHTML = "";

  if (!project.parcels.length) {
    parcelList.innerHTML = `<div class="empty-state">Chưa có thửa đất trong dự án này. Anh bấm “Thêm thửa đất” để bắt đầu thu thập.</div>`;
    return;
  }

  project.parcels
    .slice()
    .sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt))
    .forEach((parcel) => {
      const lat = Number(parcel.lat);
      const lng = Number(parcel.lng);
      const card = document.createElement("article");
      card.className = "item-card";
      card.innerHTML = `
        <div class="item-title">
          <span>${escapeHtml(parcel.parcelCode || "Chưa có số thửa")}</span>
          <span>${parcel.photos?.length || 0} ảnh</span>
        </div>
        <div class="item-meta">
          <span>${escapeHtml(parcel.status || "Chưa có hiện trạng")}</span>
          <span>${lat.toFixed(7)}, ${lng.toFixed(7)}</span>
          <span>Cập nhật: ${formatDate(parcel.updatedAt)}</span>
        </div>
      `;

      const actions = document.createElement("div");
      actions.className = "item-actions";
      actions.append(
        miniButton("Sửa", () => openParcelWizard(parcel.id)),
        miniButton("Bản đồ", () => openMap("viewParcel", "project", parcel.id)),
        miniButton("Xóa", () => deleteParcel(parcel.id), "delete-mini"),
      );
      card.append(actions);
      parcelList.append(card);
    });
}

function miniButton(label, onClick, className = "") {
  const button = document.createElement("button");
  button.type = "button";
  button.textContent = label;
  if (className) button.classList.add(className);
  button.addEventListener("click", onClick);
  return button;
}

function openProject(id) {
  currentProjectId = id;
  currentParcelId = "";
  renderProject();
  showScreen("project");
}

function openProjectDialog(project = null) {
  projectDialogTitle.textContent = project ? "Sửa dự án" : "Tạo dự án";
  projectFields.id.value = project?.id || "";
  projectFields.name.value = project?.name || "";
  projectFields.description.value = project?.description || "";
  projectDialog.showModal();
}

function deleteProject(id) {
  const project = projects.find((item) => item.id === id);
  if (!project) return;
  if (!confirm(`Xóa dự án “${project.name}” và toàn bộ thửa đất bên trong?`)) return;

  projects = projects.filter((item) => item.id !== id);
  if (currentProjectId === id) currentProjectId = "";
  if (!saveProjects()) return;
  renderProjects();
  showScreen("projects");
}

function openParcelWizard(parcelId = "") {
  currentParcelId = parcelId;
  currentStep = 0;
  fillParcelForm(currentParcel());
  renderStep();
  showScreen("wizard");
}

function fillParcelForm(parcel = null) {
  parcelFields.id.value = parcel?.id || "";
  parcelFields.parcelCode.value = parcel?.parcelCode || "";
  parcelFields.owner.value = parcel?.owner || "";
  parcelFields.area.value = parcel?.area || "";
  parcelFields.landType.value = parcel?.landType || "";
  parcelFields.status.value = parcel?.status || "Chưa khảo sát";
  parcelFields.notes.value = parcel?.notes || "";
  parcelFields.lat.value = parcel?.lat ?? "";
  parcelFields.lng.value = parcel?.lng ?? "";
  draftPhotos = parcel?.photos ? [...parcel.photos] : [];
  deleteParcelButton.hidden = !parcel;
  renderPhotos();
}

function renderStep() {
  document.querySelectorAll(".form-step").forEach((step) => {
    step.classList.toggle("is-active", Number(step.dataset.step) === currentStep);
  });

  document.querySelectorAll("[data-step-dot]").forEach((dot) => {
    dot.classList.toggle("is-active", Number(dot.dataset.stepDot) === currentStep);
  });

  prevStepButton.disabled = currentStep === 0;
  nextStepButton.hidden = currentStep === 4;
  if (currentStep === 4) renderReview();
}

function renderReview() {
  const rows = [
    ["Số tờ / số thửa", parcelFields.parcelCode.value || "Chưa nhập"],
    ["Chủ sử dụng", parcelFields.owner.value || "Chưa nhập"],
    ["Diện tích", parcelFields.area.value ? `${parcelFields.area.value} m²` : "Chưa nhập"],
    ["Loại đất", parcelFields.landType.value || "Chưa nhập"],
    ["Hiện trạng", parcelFields.status.value],
    ["Tọa độ", `${parcelFields.lat.value || "?"}, ${parcelFields.lng.value || "?"}`],
    ["Ảnh", `${draftPhotos.length} ảnh`],
  ];

  reviewBox.innerHTML = rows
    .map(([label, value]) => `<div class="review-row"><strong>${label}</strong><span>${escapeHtml(value)}</span></div>`)
    .join("");
}

function parcelFromForm() {
  const lat = toNumber(parcelFields.lat.value);
  const lng = toNumber(parcelFields.lng.value);

  if (!parcelFields.parcelCode.value.trim()) {
    showMessage("Anh cần nhập số tờ / số thửa trước khi lưu.");
    currentStep = 0;
    renderStep();
    return null;
  }

  if (lat === null || lng === null) {
    showMessage("Anh cần có vĩ độ và kinh độ trước khi lưu thửa đất.");
    currentStep = 2;
    renderStep();
    return null;
  }

  const existing = currentParcel();
  return {
    id: parcelFields.id.value || uid(),
    parcelCode: parcelFields.parcelCode.value.trim(),
    owner: parcelFields.owner.value.trim(),
    area: parcelFields.area.value.trim(),
    landType: parcelFields.landType.value.trim(),
    status: parcelFields.status.value,
    notes: parcelFields.notes.value.trim(),
    lat,
    lng,
    photos: draftPhotos,
    createdAt: existing?.createdAt || nowIso(),
    updatedAt: nowIso(),
  };
}

function saveParcel() {
  const project = currentProject();
  const parcel = parcelFromForm();
  if (!project || !parcel) return;

  const index = project.parcels.findIndex((item) => item.id === parcel.id);
  if (index >= 0) {
    project.parcels[index] = parcel;
  } else {
    project.parcels.push(parcel);
  }

  project.updatedAt = nowIso();
  currentParcelId = parcel.id;
  if (!saveProjects()) return;
  renderProject();
  showMessage("Đã lưu thửa đất.");
  showScreen("project");
}

function deleteParcel(parcelId = currentParcelId) {
  const project = currentProject();
  const parcel = project?.parcels.find((item) => item.id === parcelId);
  if (!project || !parcel) return;
  if (!confirm(`Xóa thửa đất “${parcel.parcelCode || "chưa có số thửa"}”?`)) return;

  project.parcels = project.parcels.filter((item) => item.id !== parcelId);
  project.updatedAt = nowIso();
  if (!saveProjects()) return;
  currentParcelId = "";
  renderProject();
  showScreen("project");
}

function renderPhotos() {
  photoPreview.innerHTML = "";

  if (!draftPhotos.length) {
    photoPreview.innerHTML = `<div class="empty-state">Chưa có ảnh hiện trạng.</div>`;
    return;
  }

  draftPhotos.forEach((photo) => {
    const card = document.createElement("div");
    card.className = "photo-card";

    const image = document.createElement("img");
    image.src = photo.dataUrl;
    image.alt = photo.name || "Ảnh hiện trạng";

    const removeButton = document.createElement("button");
    removeButton.type = "button";
    removeButton.textContent = "×";
    removeButton.title = "Xóa ảnh";
    removeButton.addEventListener("click", () => {
      draftPhotos = draftPhotos.filter((item) => item.id !== photo.id);
      renderPhotos();
    });

    card.append(image, removeButton);
    photoPreview.append(card);
  });
}

function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

async function compressImage(file) {
  const dataUrl = await readFileAsDataUrl(file);
  const image = new Image();
  await new Promise((resolve, reject) => {
    image.onload = resolve;
    image.onerror = reject;
    image.src = dataUrl;
  });

  const maxSize = 960;
  const scale = Math.min(1, maxSize / Math.max(image.width, image.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(image.width * scale);
  canvas.height = Math.round(image.height * scale);
  canvas.getContext("2d").drawImage(image, 0, 0, canvas.width, canvas.height);

  return {
    id: uid(),
    name: file.name,
    type: "image/jpeg",
    capturedAt: nowIso(),
    dataUrl: canvas.toDataURL("image/jpeg", 0.78),
  };
}

function ensureMap() {
  if (map) return;

  map = L.map("map", { zoomControl: false }).setView([16.0471, 108.2068], 6);
  L.control.zoom({ position: "bottomright" }).addTo(map);

  baseLayers = {
    satellite: L.tileLayer("https://{s}.google.com/vt/lyrs=s&x={x}&y={y}&z={z}", {
      subdomains: ["mt0", "mt1", "mt2", "mt3"],
      maxZoom: 20,
      attribution: "&copy; Google",
    }),
    topo: L.tileLayer("https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png", {
      maxNativeZoom: 17,
      maxZoom: 20,
      attribution: "Map data: &copy; OpenStreetMap contributors, SRTM | Map style: &copy; OpenTopoMap",
    }),
    street: L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxNativeZoom: 19,
      maxZoom: 20,
      attribution: "&copy; OpenStreetMap contributors",
    }),
  };

  currentBaseLayer = baseLayers.satellite.addTo(map);
  markerLayer = L.layerGroup().addTo(map);

  map.on("click", (event) => {
    if (mapMode !== "pickPoint") return;
    pendingMapPoint = event.latlng;
    saveMapPointButton.hidden = false;
    renderPickMarker(event.latlng);
  });

  document.querySelectorAll("[data-layer]").forEach((button) => {
    button.addEventListener("click", () => switchLayer(button.dataset.layer));
  });
}

function switchLayer(layerName) {
  if (!baseLayers[layerName] || currentBaseLayer === baseLayers[layerName]) return;
  map.removeLayer(currentBaseLayer);
  currentBaseLayer = baseLayers[layerName].addTo(map);

  document.querySelectorAll("[data-layer]").forEach((button) => {
    button.classList.toggle("is-active", button.dataset.layer === layerName);
  });
}

function openMap(mode, fromScreen = "project", parcelId = "") {
  mapMode = mode;
  previousScreen = fromScreen;
  if (parcelId) currentParcelId = parcelId;
  pendingMapPoint = null;
  saveMapPointButton.hidden = mode !== "pickPoint";
  showScreen("map", { previousScreen: fromScreen });
}

function renderMapMarkers() {
  ensureMap();
  markerLayer.clearLayers();
  if (pickMarker) {
    map.removeLayer(pickMarker);
    pickMarker = null;
  }

  const project = currentProject();
  if (!project) return;

  const parcels = mapMode === "viewParcel" ? project.parcels.filter((item) => item.id === currentParcelId) : project.parcels;
  const bounds = [];

  parcels.forEach((parcel) => {
    if (!Number.isFinite(parcel.lat) || !Number.isFinite(parcel.lng)) return;
    bounds.push([parcel.lat, parcel.lng]);
    const marker = L.marker([parcel.lat, parcel.lng]).addTo(markerLayer);
    marker.bindPopup(`
      <strong>${escapeHtml(parcel.parcelCode || "Thửa đất")}</strong><br>
      ${escapeHtml(parcel.status || "")}<br>
      ${parcel.area ? `${escapeHtml(parcel.area)} m²<br>` : ""}
    `);
  });

  if (mapMode === "pickPoint") {
    const lat = toNumber(parcelFields.lat.value);
    const lng = toNumber(parcelFields.lng.value);
    if (lat !== null && lng !== null) {
      const point = L.latLng(lat, lng);
      pendingMapPoint = point;
      saveMapPointButton.hidden = false;
      renderPickMarker(point);
      map.setView(point, Math.max(map.getZoom(), 18));
      return;
    }
  }

  if (bounds.length === 1) {
    map.setView(bounds[0], 18);
  } else if (bounds.length > 1) {
    map.fitBounds(bounds, { padding: [36, 36], maxZoom: 17 });
  } else {
    map.setView([16.0471, 108.2068], 6);
  }
}

function renderPickMarker(latlng) {
  if (pickMarker) map.removeLayer(pickMarker);
  pickMarker = L.circleMarker(latlng, {
    radius: 10,
    weight: 3,
    color: "#c65332",
    fillColor: "#ffffff",
    fillOpacity: 0.95,
  })
    .bindPopup("Vị trí đang chọn")
    .addTo(map);
}

function buildGeoJson(project, includePhotos = true) {
  return {
    type: "FeatureCollection",
    name: project.name,
    generatedAt: nowIso(),
    properties: {
      ten_du_an: project.name,
      mo_ta_du_an: project.description,
      ngay_tao: project.createdAt,
      ngay_cap_nhat: project.updatedAt,
    },
    features: project.parcels.map((parcel) => ({
      type: "Feature",
      id: parcel.id,
      geometry: {
        type: "Point",
        coordinates: [parcel.lng, parcel.lat],
      },
      properties: {
        du_an: project.name,
        so_to_so_thua: parcel.parcelCode,
        chu_su_dung_dia_chi: parcel.owner,
        dien_tich: parcel.area,
        loai_dat: parcel.landType,
        hien_trang: parcel.status,
        ghi_chu: parcel.notes,
        so_anh: parcel.photos?.length || 0,
        anh_hien_trang: includePhotos ? parcel.photos || [] : [],
        ngay_tao: parcel.createdAt,
        ngay_cap_nhat: parcel.updatedAt,
      },
    })),
  };
}

function downloadGeoJson() {
  const project = currentProject();
  if (!project || !project.parcels.length) {
    showMessage("Dự án chưa có thửa đất để xuất GeoJSON.");
    return;
  }

  const includePhotos = confirm("Đưa ảnh hiện trạng vào GeoJSON? File sẽ lớn hơn nhưng đầy đủ dữ liệu hơn.");
  const blob = new Blob([JSON.stringify(buildGeoJson(project, includePhotos), null, 2)], {
    type: "application/geo+json;charset=utf-8",
  });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `${project.name.toLowerCase().replaceAll(/\s+/g, "-")}-${new Date().toISOString().slice(0, 10)}.geojson`;
  anchor.click();
  URL.revokeObjectURL(url);
}

createProjectButton.addEventListener("click", () => openProjectDialog());
cancelProjectButton.addEventListener("click", () => projectDialog.close());

projectForm.addEventListener("submit", (event) => {
  event.preventDefault();
  const id = projectFields.id.value || uid();
  const existing = projects.find((project) => project.id === id);
  const project = {
    id,
    name: projectFields.name.value.trim(),
    description: projectFields.description.value.trim(),
    createdAt: existing?.createdAt || nowIso(),
    updatedAt: nowIso(),
    parcels: existing?.parcels || [],
  };

  if (!project.name) {
    showMessage("Anh cần nhập tên dự án.");
    return;
  }

  const index = projects.findIndex((item) => item.id === id);
  if (index >= 0) projects[index] = project;
  else projects.push(project);

  currentProjectId = id;
  if (!saveProjects()) return;
  projectDialog.close();
  renderProjects();
  renderProject();
  showScreen("project");
});

editProjectButton.addEventListener("click", () => openProjectDialog(currentProject()));
projectMapButton.addEventListener("click", () => openMap("viewProject", "project"));
exportProjectButton.addEventListener("click", downloadGeoJson);
createParcelButton.addEventListener("click", () => openParcelWizard());

parcelForm.addEventListener("submit", (event) => {
  event.preventDefault();
  saveParcel();
});

saveParcelButton.addEventListener("click", saveParcel);

prevStepButton.addEventListener("click", () => {
  currentStep = Math.max(0, currentStep - 1);
  renderStep();
});

nextStepButton.addEventListener("click", () => {
  currentStep = Math.min(4, currentStep + 1);
  renderStep();
});

deleteParcelButton.addEventListener("click", () => deleteParcel());

gpsButton.addEventListener("click", () => {
  if (!navigator.geolocation) {
    showMessage("Thiết bị hoặc trình duyệt này chưa hỗ trợ GPS.");
    return;
  }

  gpsButton.disabled = true;
  gpsButton.textContent = "Đang lấy GPS...";

  navigator.geolocation.getCurrentPosition(
    (position) => {
      parcelFields.lat.value = position.coords.latitude.toFixed(7);
      parcelFields.lng.value = position.coords.longitude.toFixed(7);
      gpsButton.disabled = false;
      gpsButton.textContent = "Lấy tọa độ GPS";
      showMessage("Đã lấy tọa độ GPS.");
    },
    (error) => {
      gpsButton.disabled = false;
      gpsButton.textContent = "Lấy tọa độ GPS";
      showMessage(`Không lấy được GPS: ${error.message}`);
    },
    {
      enableHighAccuracy: true,
      timeout: 15000,
      maximumAge: 0,
    },
  );
});

pickOnMapButton.addEventListener("click", () => openMap("pickPoint", "wizard"));

saveMapPointButton.addEventListener("click", () => {
  if (!pendingMapPoint) {
    showMessage("Anh chạm vào bản đồ để chọn vị trí trước.");
    return;
  }

  parcelFields.lat.value = pendingMapPoint.lat.toFixed(7);
  parcelFields.lng.value = pendingMapPoint.lng.toFixed(7);
  saveMapPointButton.hidden = true;
  showScreen("wizard");
});

photoInput.addEventListener("change", async () => {
  const files = Array.from(photoInput.files || []);
  if (!files.length) return;

  try {
    const photos = await Promise.all(files.map(compressImage));
    draftPhotos = [...draftPhotos, ...photos];
    renderPhotos();
  } catch {
    showMessage("Không đọc được ảnh. Anh thử chụp lại hoặc chọn ảnh khác.");
  } finally {
    photoInput.value = "";
  }
});

backButton.addEventListener("click", goBack);

window.addEventListener("beforeinstallprompt", (event) => {
  event.preventDefault();
  deferredInstallPrompt = event;
});

installButton.addEventListener("click", async () => {
  if (isStandaloneApp()) {
    hideInstallButton();
    return;
  }

  if (deferredInstallPrompt) {
    deferredInstallPrompt.prompt();
    const choice = await deferredInstallPrompt.userChoice;
    deferredInstallPrompt = null;
    if (choice.outcome === "accepted") hideInstallButton();
    return;
  }

  showInstallHelp();
});

window.addEventListener("appinstalled", () => {
  hideInstallButton();
  deferredInstallPrompt = null;
});

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("service-worker.js").then(setupServiceWorkerUpdates).catch(() => {});
  });
}

function isStandaloneApp() {
  return window.matchMedia("(display-mode: standalone)").matches || window.navigator.standalone === true;
}

function hideInstallButton() {
  installDock.hidden = true;
}

function showInstallHelp() {
  const ua = navigator.userAgent.toLowerCase();
  const isIos = /iphone|ipad|ipod/.test(ua);
  const isAndroid = /android/.test(ua);

  if (isIos) {
    installText.textContent = "Trên iPhone/iPad: bấm nút Chia sẻ trong Safari, chọn “Thêm vào Màn hình chính”, rồi bấm “Thêm”.";
  } else if (isAndroid) {
    installText.textContent = "Trên Android: mở menu trình duyệt, chọn “Cài đặt ứng dụng” hoặc “Thêm vào màn hình chính”. Nếu dùng Chrome, đôi khi nút cài sẽ hiện sau khi tải lại trang.";
  } else {
    installText.textContent = "Trên máy tính hoặc điện thoại: mở menu trình duyệt và chọn “Cài đặt ứng dụng” hoặc “Thêm vào màn hình chính” nếu trình duyệt hỗ trợ.";
  }

  if (typeof installDialog.showModal === "function") {
    installDialog.showModal();
  } else {
    showMessage(installText.textContent);
  }
}

function setupServiceWorkerUpdates(registration) {
  registration.update().catch(() => {});

  if (registration.waiting) {
    showUpdatePrompt(registration.waiting);
  }

  registration.addEventListener("updatefound", () => {
    const newWorker = registration.installing;
    if (!newWorker) return;

    newWorker.addEventListener("statechange", () => {
      if (newWorker.state === "installed" && navigator.serviceWorker.controller) {
        showUpdatePrompt(newWorker);
      }
    });
  });

  navigator.serviceWorker.addEventListener("controllerchange", () => {
    window.location.reload();
  });

  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") {
      registration.update().catch(() => {});
    }
  });
}

function showUpdatePrompt(worker) {
  waitingServiceWorker = worker;
  installDock.hidden = true;
  updateDock.hidden = false;
}

updateButton.addEventListener("click", () => {
  if (!waitingServiceWorker) {
    window.location.reload();
    return;
  }

  waitingServiceWorker.postMessage({ type: "SKIP_WAITING" });
});

loadProjects();
if (isStandaloneApp()) hideInstallButton();
renderProjects();
showScreen("projects");
