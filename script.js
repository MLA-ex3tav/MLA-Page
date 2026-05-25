const revealItems = document.querySelectorAll(".reveal");
const downloadBtn = document.getElementById("downloadBtn");
const buildChip = document.getElementById("buildChip");
const releasesLink = document.getElementById("releasesLink");
const footerReleasesLink = document.getElementById("footerReleasesLink");

const config = window.GITHUB_RELEASE_CONFIG ?? {};
const { owner, repo } = config;

const PLATFORM_PATTERNS = {
  windows: /\.(exe|msi)$/i,
  mac: /\.(dmg|pkg)$/i,
  linux: /\.(AppImage|deb|rpm)$/i,
};

const PLATFORM_LABELS = {
  windows: "Windows",
  mac: "macOS",
  linux: "Linux",
};

function detectPlatform() {
  const ua = navigator.userAgent.toLowerCase();
  const platform = (navigator.platform ?? "").toLowerCase();

  if (/win/.test(platform) || ua.includes("windows")) return "windows";
  if (/mac/.test(platform) || ua.includes("mac")) return "mac";
  if (/linux/.test(platform) || ua.includes("linux")) return "linux";
  return "windows";
}

function isConfigured() {
  return (
    typeof owner === "string" &&
    typeof repo === "string" &&
    owner.length > 0 &&
    repo.length > 0 &&
    owner !== "tu-usuario" &&
    repo !== "tu-repo-pos"
  );
}

function setChip(text, extraClass) {
  if (!buildChip) return;
  buildChip.classList.remove("is-downloading", "is-error");
  if (extraClass) buildChip.classList.add(extraClass);
  buildChip.textContent = text;
}

function setDownloadReady({ href, version, platform }) {
  if (!downloadBtn) return;

  downloadBtn.href = href;
  downloadBtn.removeAttribute("aria-disabled");
  downloadBtn.classList.remove("is-loading", "is-disabled");
  setChip(`${version} · ${PLATFORM_LABELS[platform]}`);
}

function releasesPageUrl() {
  return `https://github.com/${owner}/${repo}/releases`;
}

function syncReleaseLinks() {
  if (!isConfigured()) return;
  const url = releasesPageUrl();
  releasesLink?.setAttribute("href", url);
  footerReleasesLink?.setAttribute("href", url);
}

function setDownloadError(message, { linkToReleases = false } = {}) {
  if (!downloadBtn) return;

  downloadBtn.href = linkToReleases ? releasesPageUrl() : "#";
  downloadBtn.setAttribute("aria-disabled", linkToReleases ? "false" : "true");
  downloadBtn.classList.toggle("is-disabled", !linkToReleases);
  downloadBtn.classList.remove("is-loading");
  setChip(message, "is-error");
}

function pickAsset(assets, platform) {
  const usable = assets.filter((asset) => !/\.blockmap$/i.test(asset.name));
  const pattern = PLATFORM_PATTERNS[platform];
  const match = usable.find((asset) => pattern.test(asset.name));

  return match ?? usable[0] ?? null;
}

async function githubFetch(path) {
  const response = await fetch(
    `https://api.github.com/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}${path}`,
    { headers: { Accept: "application/vnd.github+json" } }
  );

  if (!response.ok) {
    const error = new Error("GitHub API error");
    error.status = response.status;
    throw error;
  }

  return response.json();
}

async function fetchLatestRelease() {
  try {
    return await githubFetch("/releases/latest");
  } catch (error) {
    if (error.status !== 404) throw error;

    const releases = await githubFetch("/releases?per_page=10");
    const latest = releases.find((release) => !release.draft && !release.prerelease);

    if (!latest) {
      const noRelease = new Error("No hay releases publicados.");
      noRelease.status = 404;
      throw noRelease;
    }

    return latest;
  }
}

async function loadLatestRelease() {
  syncReleaseLinks();

  if (!isConfigured()) {
    setDownloadError("Configura owner/repo en config.js");
    return;
  }

  downloadBtn?.classList.add("is-loading");
  setChip("Buscando última versión...");

  try {
    const release = await fetchLatestRelease();
    const platform = detectPlatform();
    const asset = pickAsset(release.assets ?? [], platform);

    if (!asset?.browser_download_url) {
      setDownloadError("Sin instalador para tu SO", { linkToReleases: true });
      return;
    }

    const version = release.tag_name ?? "latest";

    setDownloadReady({
      href: asset.browser_download_url,
      version,
      platform,
    });
  } catch (error) {
    if (error.status === 404) {
      setDownloadError("Sin releases en GitHub", { linkToReleases: true });
      return;
    }

    setDownloadError("Error al cargar release");
  }
}

const observer = new IntersectionObserver(
  (entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        entry.target.classList.add("is-visible");
        observer.unobserve(entry.target);
      }
    });
  },
  { threshold: 0.16 }
);

revealItems.forEach((item) => observer.observe(item));

downloadBtn?.addEventListener("click", (event) => {
  if (
    downloadBtn.getAttribute("aria-disabled") === "true" ||
    downloadBtn.classList.contains("is-loading")
  ) {
    event.preventDefault();
    return;
  }

  if (!downloadBtn.href || downloadBtn.href.endsWith("#")) {
    event.preventDefault();
    return;
  }

  setChip("Iniciando descarga...", "is-downloading");
});

loadLatestRelease();
