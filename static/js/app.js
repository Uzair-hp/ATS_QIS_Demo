/* ATS QIS — App JavaScript */

// ── Theme Toggle ──
function initTheme() {
    const saved = localStorage.getItem('inf-theme');
    if (saved) {
        document.documentElement.setAttribute('data-theme', saved);
    } else if (window.matchMedia('(prefers-color-scheme: dark)').matches) {
        document.documentElement.setAttribute('data-theme', 'dark');
    }
    updateThemeIcon();
}

function toggleTheme() {
    const current = document.documentElement.getAttribute('data-theme');
    const next = current === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', next);
    localStorage.setItem('inf-theme', next);
    updateThemeIcon();
}

function updateThemeIcon() {
    const btn = document.getElementById('themeToggle');
    if (!btn) return;
    const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
    btn.innerHTML = isDark
        ? '<i class="bi bi-sun-fill"></i>'
        : '<i class="bi bi-moon-fill"></i>';
    btn.title = isDark ? 'Switch to Light Mode' : 'Switch to Dark Mode';
}

// Apply theme ASAP (before DOMContentLoaded to avoid flash)
initTheme();

// ── Sidebar Toggle ──
function toggleSidebar() {
    const sidebar = document.getElementById('sidebar');
    const overlay = document.getElementById('sidebarOverlay');
    sidebar.classList.toggle('show');
    overlay.style.display = sidebar.classList.contains('show') ? 'block' : 'none';
}

// Close sidebar on overlay click or window resize
window.addEventListener('resize', () => {
    if (window.innerWidth > 991) {
        const sidebar = document.getElementById('sidebar');
        const overlay = document.getElementById('sidebarOverlay');
        if (sidebar) sidebar.classList.remove('show');
        if (overlay) overlay.style.display = 'none';
    }
});

// ── Delete Confirmation Modal ──
function confirmDelete(target, message) {
    const url = typeof target === 'string' ? target : target.dataset.url;
    const msg = typeof target === 'string' ? message : target.dataset.msg;
    
    document.getElementById('deleteModalForm').action = url;
    if (msg) {
        document.getElementById('deleteModalMessage').textContent = msg;
    }
    const modal = new bootstrap.Modal(document.getElementById('deleteModal'));
    modal.show();
}

// ── Archive Confirmation Modal ──
function confirmArchive(target, message) {
    const url = typeof target === 'string' ? target : target.dataset.url;
    const msg = typeof target === 'string' ? message : target.dataset.msg;

    document.getElementById('archiveModalForm').action = url;
    if (msg) {
        document.getElementById('archiveModalMessage').textContent = msg;
    }
    const modal = new bootstrap.Modal(document.getElementById('archiveModal'));
    modal.show();
}

// ── Toast Notifications ──
function showToast(message, type = 'success') {
    const container = document.getElementById('toastContainer');
    if (!container) return;

    const icons = {
        success: 'bi-check-circle-fill',
        danger: 'bi-exclamation-circle-fill',
        warning: 'bi-exclamation-triangle-fill',
        info: 'bi-info-circle-fill',
    };

    const toast = document.createElement('div');
    toast.className = `inf-toast toast-${type}`;
    toast.innerHTML = `
        <i class="bi ${icons[type] || icons.info} toast-icon"></i>
        <span>${message}</span>
        <button class="toast-close" onclick="this.parentElement.remove()">
            <i class="bi bi-x"></i>
        </button>
    `;
    container.appendChild(toast);

    setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transform = 'translateX(40px)';
        toast.style.transition = 'all 0.3s ease';
        setTimeout(() => toast.remove(), 300);
    }, 4000);
}

// ── Auto-show flash messages as toasts on page load ──
document.addEventListener('DOMContentLoaded', () => {
    updateThemeIcon();

    const flashData = document.querySelectorAll('.flash-data');
    flashData.forEach(el => {
        showToast(el.dataset.message, el.dataset.category);
    });
});

// ── Auto-resize Textarea to fit content dynamically ──
function autoResizeTextarea(textarea) {
    if (!textarea) return;
    textarea.style.height = 'auto';
    textarea.style.height = (textarea.scrollHeight) + 'px';
}

// ── Register Service Worker for PWA ──
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('/sw.js')
            .then(reg => console.log('Service Worker registered successfully with scope:', reg.scope))
            .catch(err => console.error('Service Worker registration failed:', err));
    });
}
