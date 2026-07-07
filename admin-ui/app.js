/* global window, document, Chart, alert, location */

const CONFIG = {
  API_BASE: '/api/v1',
  TOKEN_KEY: 'indeal_admin_token',
  USER_KEY: 'indeal_admin_user',
};

const state = {
  user: null,
  charts: {},
  drawerOpen: false,
};

const routes = [
  { hash: '#/dashboard', label: 'Dashboard', short: 'Db' },
  { hash: '#/users', label: 'Users', short: 'Us' },
  { hash: '#/companies', label: 'Companies', short: 'Co' },
  { hash: '#/deals', label: 'Deals', short: 'De' },
  { hash: '#/email-logs', label: 'Email Logs', short: 'Em' },
];

const statusClass = (value) => `status-${String(value || '').replace(/\s+/g, '')}`;
const root = document.getElementById('root');
const chartPalette = {
  blue: '#1d5fd0',
  blueDark: '#114bb8',
  cyan: '#20d8d1',
  cyanSoft: '#8aefff',
  sky: '#4aa8ff',
  teal: '#11b8b0',
  rose: '#d94b63',
};

const auth = {
  getToken: () => localStorage.getItem(CONFIG.TOKEN_KEY),
  setSession: ({ token, user }) => {
    localStorage.setItem(CONFIG.TOKEN_KEY, token);
    localStorage.setItem(CONFIG.USER_KEY, JSON.stringify(user));
    state.user = user;
  },
  loadUser: () => {
    try {
      const raw = localStorage.getItem(CONFIG.USER_KEY);
      state.user = raw ? JSON.parse(raw) : null;
    } catch {
      state.user = null;
    }
    return state.user;
  },
  clear: () => {
    localStorage.removeItem(CONFIG.TOKEN_KEY);
    localStorage.removeItem(CONFIG.USER_KEY);
    state.user = null;
  },
};

const formatDate = (value) => (value ? new Date(value).toLocaleString() : '—');
const formatNumber = (value) => new Intl.NumberFormat().format(Number(value || 0));
const formatMoney = (value) =>
  value === null || value === undefined ? '—' : new Intl.NumberFormat().format(Number(value));
const hasCharts = () => typeof Chart !== 'undefined';

const destroyCharts = () => {
  Object.values(state.charts).forEach((chart) => chart.destroy());
  state.charts = {};
};

const api = async (path, options = {}) => {
  const headers = { 'Content-Type': 'application/json', ...(options.headers || {}) };
  const token = auth.getToken();
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const res = await fetch(`${CONFIG.API_BASE}${path}`, {
    ...options,
    headers,
  });

  const text = await res.text();
  let body = {};
  try {
    body = text ? JSON.parse(text) : {};
  } catch {
    body = {};
  }

  if (res.status === 401) {
    auth.clear();
    location.hash = '#/login';
    throw new Error('Session expired. Please log in again.');
  }

  if (!res.ok) {
    throw new Error(body.message || 'Request failed');
  }

  if (body.data?.user && !state.user) {
    state.user = body.data.user;
  }

  return body;
};

const badge = (value) => `<span class="badge ${statusClass(value)}">${value || 'unknown'}</span>`;

const renderLayout = (title, subtitle, content) => {
  const currentHash = location.hash || '#/dashboard';
  root.innerHTML = `
    <div class="app-shell">
      <aside class="sidebar">
        <div class="brand">
          <small>inDeal control plane</small>
          <h1>Admin</h1>
        </div>
        <nav class="nav">
          ${routes
            .map(
              (route) => `
                <a class="nav-link ${currentHash === route.hash ? 'active' : ''}" href="${route.hash}">
                  <strong>${route.short}</strong>
                  <span>${route.label}</span>
                </a>
              `
            )
            .join('')}
        </nav>
      </aside>
      <main class="main">
        <div class="topbar">
          <div>
            <h2>${title}</h2>
            <p>${subtitle}</p>
          </div>
          <div class="topbar-actions">
            <div class="pill">${state.user?.email || ''}</div>
            <button class="btn-ghost" id="logout-btn">Logout</button>
          </div>
        </div>
        <div class="content-grid">${content}</div>
      </main>
    </div>
    <div id="drawer-backdrop" class="drawer-backdrop"></div>
  `;

  document.getElementById('logout-btn').addEventListener('click', () => {
    auth.clear();
    location.hash = '#/login';
  });
};

const showDrawer = (title, bodyHtml) => {
  const backdrop = document.getElementById('drawer-backdrop');
  if (!backdrop) return;
  backdrop.innerHTML = `
    <div class="drawer">
      <div class="drawer-head">
        <div>
          <h3>${title}</h3>
        </div>
        <button class="btn-ghost" id="drawer-close">Close</button>
      </div>
      ${bodyHtml}
    </div>
  `;
  backdrop.classList.add('open');
  backdrop.addEventListener('click', (event) => {
    if (event.target === backdrop) {
      backdrop.classList.remove('open');
    }
  });
  document.getElementById('drawer-close').addEventListener('click', () => {
    backdrop.classList.remove('open');
  });
};

const renderLogin = (errorMessage = '') => {
  destroyCharts();
  root.innerHTML = `
    <div class="login-shell">
      <div class="card login-card">
        <small class="mono">same-origin access only</small>
        <h2>Admin sign in</h2>
        ${errorMessage ? `<div class="error-box">${errorMessage}</div>` : ''}
        <form id="login-form">
          <input type="email" name="email" placeholder="Email" required />
          <input type="password" name="password" placeholder="Password" required />
          <button class="btn" type="submit">Login</button>
        </form>
        <div class="login-note">
          Access is limited to <code>admin</code> and <code>support</code> roles.
        </div>
      </div>
    </div>
  `;

  document.getElementById('login-form').addEventListener('submit', async (event) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    try {
      const res = await api('/auth/login', {
        method: 'POST',
        body: JSON.stringify({
          email: String(form.get('email') || '').trim(),
          password: String(form.get('password') || ''),
        }),
      });
      const { token, user } = res.data || {};
      if (!user || !['admin', 'support'].includes(user.role)) {
        auth.clear();
        renderLogin('Access denied');
        return;
      }
      auth.setSession({ token, user });
      location.hash = '#/dashboard';
    } catch (error) {
      renderLogin(error.message);
    }
  });
};

const ensureAuthorized = () => {
  const user = state.user || auth.loadUser();
  if (!auth.getToken() || !user) {
    location.hash = '#/login';
    return false;
  }
  if (!['admin', 'support'].includes(user.role)) {
    auth.clear();
    location.hash = '#/login';
    return false;
  }
  return true;
};

const renderPagination = (pagination, onPageChange) => {
  const wrapper = document.createElement('div');
  wrapper.className = 'pagination';
  wrapper.innerHTML = `
    <div>${pagination.total} total records</div>
    <div class="pagination-controls">
      <button class="btn-ghost" ${pagination.page <= 1 ? 'disabled' : ''} data-dir="-1">Previous</button>
      <div class="pill">Page ${pagination.page} / ${pagination.totalPages || 1}</div>
      <button class="btn-ghost" ${pagination.page >= pagination.totalPages ? 'disabled' : ''} data-dir="1">Next</button>
    </div>
  `;
  wrapper.querySelectorAll('button[data-dir]').forEach((btn) => {
    btn.addEventListener('click', () => onPageChange(pagination.page + Number(btn.dataset.dir)));
  });
  return wrapper;
};

const tableCard = ({ title, filtersHtml, headHtml, bodyHtml }) => `
  <div class="card">
    <h3>${title}</h3>
    ${filtersHtml || ''}
    <div class="table-wrap">
      <table>
        <thead>${headHtml}</thead>
        <tbody>${bodyHtml || '<tr><td colspan="99"><div class="empty">No results found.</div></td></tr>'}</tbody>
      </table>
    </div>
    <div id="pagination-slot"></div>
  </div>
`;

const attachListCommon = ({ pagination, onPageChange }) => {
  if (!pagination) return;
  const slot = document.getElementById('pagination-slot');
  if (!slot) return;
  slot.replaceWith(renderPagination(pagination, onPageChange));
};

const renderDashboard = async () => {
  renderLayout(
    'Dashboard',
    'Platform health and activity snapshots',
    `<div class="card">Loading dashboard…</div>`
  );
  try {
    const [overviewRes, registrationsRes, dealsRes, requestsRes] = await Promise.all([
      api('/admin/analytics/overview'),
      api('/admin/analytics/registrations?period=30d'),
      api('/admin/analytics/deals?period=30d'),
      api('/admin/analytics/requests?period=30d'),
    ]);

    const overview = overviewRes.data;
    const registrations = registrationsRes.data;
    const deals = dealsRes.data;
    const requests = requestsRes.data;

    renderLayout(
      'Dashboard',
      'Platform health and activity snapshots',
      `
        <div class="stats-grid">
          <div class="card stat-card"><div class="label">Total Users</div><div class="value">${formatNumber(overview.totalUsers)}</div></div>
          <div class="card stat-card"><div class="label">Total Companies</div><div class="value">${formatNumber(overview.totalCompanies)}</div></div>
          <div class="card stat-card"><div class="label">Total Deals</div><div class="value">${formatNumber(overview.totalDeals)}</div></div>
          <div class="card stat-card"><div class="label">Deal Requests</div><div class="value">${formatNumber(overview.totalDealRequests)}</div></div>
          <div class="card stat-card"><div class="label">Active Chats</div><div class="value">${formatNumber(overview.activeChats)}</div></div>
        </div>
        <div class="chart-grid">
          <div class="card">
            <h3>Registrations</h3>
            ${
              hasCharts()
                ? '<canvas id="chart-registrations"></canvas>'
                : '<div class="empty">Chart.js failed to load. Dashboard metrics are still available above.</div>'
            }
          </div>
          <div class="card">
            <h3>Deal Status</h3>
            ${
              hasCharts()
                ? '<canvas id="chart-deals"></canvas>'
                : '<div class="empty">Chart.js failed to load. Check network access to jsDelivr.</div>'
            }
          </div>
          <div class="card">
            <h3>Request Status</h3>
            ${
              hasCharts()
                ? '<canvas id="chart-requests"></canvas>'
                : '<div class="empty">Chart.js failed to load. Tables and actions still work.</div>'
            }
          </div>
        </div>
      `
    );

    destroyCharts();
    if (!hasCharts()) {
      return;
    }
    state.charts.registrations = new Chart(document.getElementById('chart-registrations'), {
      type: 'bar',
      data: {
        labels: registrations.series.map((item) => new Date(item.date).toLocaleDateString()),
        datasets: [
          {
            label: 'Users',
            data: registrations.series.map((item) => item.usersCount),
            backgroundColor: chartPalette.blue,
          },
          {
            label: 'Companies',
            data: registrations.series.map((item) => item.companiesCount),
            backgroundColor: chartPalette.cyan,
          },
        ],
      },
    });
    state.charts.deals = new Chart(document.getElementById('chart-deals'), {
      type: 'doughnut',
      data: {
        labels: deals.statusBreakdown.map((item) => item.status),
        datasets: [
          {
            data: deals.statusBreakdown.map((item) => item.total),
            backgroundColor: [
              chartPalette.teal,
              chartPalette.blue,
              chartPalette.cyan,
              chartPalette.sky,
            ],
          },
        ],
      },
    });
    state.charts.requests = new Chart(document.getElementById('chart-requests'), {
      type: 'bar',
      data: {
        labels: requests.statusBreakdown.map((item) => item.status),
        datasets: [
          {
            label: 'Requests',
            data: requests.statusBreakdown.map((item) => item.total),
            backgroundColor: chartPalette.blueDark,
          },
        ],
      },
      options: {
        plugins: {
          legend: {
            display: true,
          },
        },
      },
    });
    state.charts.registrations.options = {
      plugins: {
        legend: {
          labels: {
            color: '#6181a7',
          },
        },
      },
      scales: {
        x: {
          ticks: { color: '#6181a7' },
          grid: { color: 'rgba(16, 108, 214, 0.08)' },
        },
        y: {
          ticks: { color: '#6181a7' },
          grid: { color: 'rgba(16, 108, 214, 0.08)' },
        },
      },
    };
    state.charts.registrations.update();
    state.charts.deals.options = {
      plugins: {
        legend: {
          labels: {
            color: '#6181a7',
          },
        },
      },
    };
    state.charts.deals.update();
    state.charts.requests.options = {
      plugins: {
        legend: {
          labels: {
            color: '#6181a7',
          },
        },
      },
      scales: {
        x: {
          ticks: { color: '#6181a7' },
          grid: { color: 'rgba(16, 108, 214, 0.08)' },
        },
        y: {
          ticks: { color: '#6181a7' },
          grid: { color: 'rgba(16, 108, 214, 0.08)' },
        },
      },
    };
    state.charts.requests.update();
  } catch (error) {
    renderLayout(
      'Dashboard',
      'Platform health and activity snapshots',
      `<div class="error-box">${error.message}</div>`
    );
  }
};

const listPage = async ({
  title,
  subtitle,
  endpoint,
  query,
  filters,
  renderRows,
  detailEndpoint,
  detailRenderer,
  bindActions,
}) => {
  renderLayout(title, subtitle, `<div class="card">Loading…</div>`);
  const params = new URLSearchParams(query);
  try {
    const res = await api(`${endpoint}?${params.toString()}`);
    const payload = res.data;
    renderLayout(
      title,
      subtitle,
      tableCard({
        title,
        filtersHtml: filters,
        headHtml: renderRows.head,
        bodyHtml: renderRows.body(payload.items),
        pagination: payload.pagination,
      })
    );

    document.querySelectorAll('[data-open-id]').forEach((row) => {
      row.addEventListener('click', async (event) => {
        if (event.target.closest('button, select')) return;
        const id = row.dataset.openId;
        try {
          const detail = await api(`${detailEndpoint}/${id}`);
          showDrawer(title, detailRenderer(detail.data));
        } catch (error) {
          showDrawer('Error', `<div class="error-box">${error.message}</div>`);
        }
      });
    });

    attachListCommon({
      pagination: payload.pagination,
      onPageChange: (page) => {
        const hash = new URLSearchParams(query);
        hash.set('page', String(page));
        location.hash = `${location.hash.split('?')[0]}?${hash.toString()}`;
      },
    });

    bindActions?.();
  } catch (error) {
    renderLayout(title, subtitle, `<div class="error-box">${error.message}</div>`);
  }
};

const currentQuery = () => {
  const raw = location.hash.split('?')[1] || '';
  const params = new URLSearchParams(raw);
  return Object.fromEntries(params.entries());
};

const writeHashQuery = (updates) => {
  const [path] = location.hash.split('?');
  const params = new URLSearchParams(currentQuery());
  Object.entries(updates).forEach(([key, value]) => {
    if (value === '' || value === undefined || value === null) {
      params.delete(key);
    } else {
      params.set(key, value);
    }
  });
  if (!params.get('page')) params.set('page', '1');
  location.hash = `${path}?${params.toString()}`;
};

const bindFilterForm = (ids) => {
  ids.forEach((id) => {
    const el = document.getElementById(id);
    if (!el) return;
    el.addEventListener('change', () => writeHashQuery({ [el.name]: el.value, page: '1' }));
    if (el.tagName === 'INPUT') {
      el.addEventListener('input', () => {
        clearTimeout(el._debounce);
        el._debounce = setTimeout(() => writeHashQuery({ [el.name]: el.value, page: '1' }), 300);
      });
    }
  });
};

const renderUsers = async () => {
  const query = { page: '1', limit: '20', ...currentQuery() };
  await listPage({
    title: 'Users',
    subtitle: 'Search, inspect, and moderate platform users',
    endpoint: '/admin/users',
    query,
    filters: `
      <div class="filters">
        <input id="users-keyword" name="keyword" placeholder="Search name, username, email" value="${query.keyword || ''}" />
        <select id="users-role" name="role">
          <option value="">All roles</option>
          <option value="agent" ${query.role === 'agent' ? 'selected' : ''}>Agent</option>
          <option value="support" ${query.role === 'support' ? 'selected' : ''}>Support</option>
          <option value="admin" ${query.role === 'admin' ? 'selected' : ''}>Admin</option>
        </select>
        <select id="users-status" name="status">
          <option value="">All statuses</option>
          <option value="pending" ${query.status === 'pending' ? 'selected' : ''}>Pending</option>
          <option value="verified" ${query.status === 'verified' ? 'selected' : ''}>Verified</option>
          <option value="suspended" ${query.status === 'suspended' ? 'selected' : ''}>Suspended</option>
        </select>
      </div>
    `,
    renderRows: {
      head: `<tr><th>ID</th><th>Name</th><th>Email</th><th>Role</th><th>Status</th><th>Company</th><th>Joined</th><th>Actions</th></tr>`,
      body: (items) =>
        items
          .map(
            (item) => `
              <tr data-clickable="true" data-open-id="${item.id}">
                <td class="mono">${item.id}</td>
                <td>${item.fullName}</td>
                <td>${item.email}</td>
                <td>${badge(item.role)}</td>
                <td>${badge(item.status)}</td>
                <td>${item.company?.name || '—'}</td>
                <td>${formatDate(item.createdAt)}</td>
                <td>
                  ${
                    state.user.role === 'admin'
                      ? `<div class="actions">
                          <select data-user-status="${item.id}">
                            <option value="">Set status</option>
                            <option value="pending">pending</option>
                            <option value="verified">verified</option>
                            <option value="suspended">suspended</option>
                          </select>
                          <select data-user-role="${item.id}">
                            <option value="">Set role</option>
                            <option value="agent">agent</option>
                            <option value="support">support</option>
                            <option value="admin">admin</option>
                          </select>
                        </div>`
                      : '<span class="mono">read-only</span>'
                  }
                </td>
              </tr>
            `
          )
          .join(''),
    },
    detailEndpoint: '/admin/users',
    detailRenderer: (item) => `
      <div class="drawer-section"><div class="kv">
        <strong>Name</strong><div>${item.fullName}</div>
        <strong>Email</strong><div>${item.email}</div>
        <strong>Username</strong><div>${item.username}</div>
        <strong>Role</strong><div>${badge(item.role)}</div>
        <strong>Status</strong><div>${badge(item.status)}</div>
        <strong>Company</strong><div>${item.company ? `${item.company.name} (#${item.company.id})` : '—'}</div>
        <strong>Created</strong><div>${formatDate(item.createdAt)}</div>
      </div></div>
      <div class="drawer-section"><h4>Preferences</h4><pre>${JSON.stringify(item.preferences || {}, null, 2)}</pre></div>
    `,
    bindActions: () => {
      bindFilterForm(['users-keyword', 'users-role', 'users-status']);
      document.querySelectorAll('[data-user-status]').forEach((select) => {
        select.addEventListener('change', async () => {
          if (!select.value) return;
          try {
            await api(`/admin/users/${select.dataset.userStatus}/status`, {
              method: 'PATCH',
              body: JSON.stringify({ status: select.value }),
            });
            renderUsers();
          } catch (error) {
            alert(error.message);
          }
        });
      });
      document.querySelectorAll('[data-user-role]').forEach((select) => {
        select.addEventListener('change', async () => {
          if (!select.value) return;
          try {
            await api(`/admin/users/${select.dataset.userRole}/role`, {
              method: 'PATCH',
              body: JSON.stringify({ role: select.value }),
            });
            renderUsers();
          } catch (error) {
            alert(error.message);
          }
        });
      });
    },
  });
};

const renderCompanies = async () => {
  const query = { page: '1', limit: '20', ...currentQuery() };
  await listPage({
    title: 'Companies',
    subtitle: 'Review company profiles and status transitions',
    endpoint: '/admin/companies',
    query,
    filters: `
      <div class="filters">
        <input id="companies-keyword" name="keyword" placeholder="Search company or agent email" value="${query.keyword || ''}" />
        <select id="companies-status" name="status">
          <option value="">All statuses</option>
          <option value="active" ${query.status === 'active' ? 'selected' : ''}>active</option>
          <option value="underReview" ${query.status === 'underReview' ? 'selected' : ''}>underReview</option>
          <option value="rejected" ${query.status === 'rejected' ? 'selected' : ''}>rejected</option>
          <option value="suspended" ${query.status === 'suspended' ? 'selected' : ''}>suspended</option>
        </select>
        <input id="companies-type" name="companyType" placeholder="Company type" value="${query.companyType || ''}" />
      </div>
    `,
    renderRows: {
      head: `<tr><th>ID</th><th>Name</th><th>Type</th><th>Status</th><th>Agent</th><th>Created</th><th>Actions</th></tr>`,
      body: (items) =>
        items
          .map(
            (item) => `
              <tr data-clickable="true" data-open-id="${item.id}">
                <td class="mono">${item.id}</td>
                <td>${item.name}</td>
                <td>${item.companyType || '—'}</td>
                <td>${badge(item.status)}</td>
                <td>${item.agent ? `${item.agent.firstName || ''} ${item.agent.lastName || ''}<br /><span class="mono">${item.agent.email}</span>` : '—'}</td>
                <td>${formatDate(item.createdAt)}</td>
                <td>
                  ${
                    state.user.role === 'admin'
                      ? `<div class="actions">
                          <button data-company-status="${item.id}" data-status="active">Approve</button>
                          <button data-company-status="${item.id}" data-status="suspended">Suspend</button>
                          <button data-company-reject="${item.id}">Reject</button>
                        </div>`
                      : '<span class="mono">read-only</span>'
                  }
                </td>
              </tr>
            `
          )
          .join(''),
    },
    detailEndpoint: '/admin/companies',
    detailRenderer: (data) => `
      <div class="drawer-section"><div class="kv">
        <strong>Name</strong><div>${data.company.name}</div>
        <strong>Status</strong><div>${badge(data.company.status)}</div>
        <strong>Type</strong><div>${data.company.companyType || '—'}</div>
        <strong>Industry</strong><div>${data.company.companyIndustry || '—'}</div>
        <strong>Agent</strong><div>${data.company.agent ? `${data.company.agent.firstName} ${data.company.agent.lastName} (${data.company.agent.email})` : '—'}</div>
        <strong>Website</strong><div>${data.company.website || '—'}</div>
      </div></div>
      <div class="drawer-section"><h4>Description</h4><pre>${data.company.description || '—'}</pre></div>
      <div class="drawer-section"><h4>Documents</h4><pre>${JSON.stringify(data.documents || [], null, 2)}</pre></div>
    `,
    bindActions: () => {
      bindFilterForm(['companies-keyword', 'companies-status', 'companies-type']);
      document.querySelectorAll('[data-company-status]').forEach((btn) => {
        btn.addEventListener('click', async (event) => {
          event.stopPropagation();
          try {
            await api(`/admin/companies/${btn.dataset.companyStatus}/status`, {
              method: 'PATCH',
              body: JSON.stringify({ status: btn.dataset.status }),
            });
            renderCompanies();
          } catch (error) {
            alert(error.message);
          }
        });
      });
      document.querySelectorAll('[data-company-reject]').forEach((btn) => {
        btn.addEventListener('click', async (event) => {
          event.stopPropagation();
          const rejectionReason = window.prompt('Rejection reason');
          if (!rejectionReason) return;
          try {
            await api(`/admin/companies/${btn.dataset.companyReject}/status`, {
              method: 'PATCH',
              body: JSON.stringify({ status: 'rejected', rejectionReason }),
            });
            renderCompanies();
          } catch (error) {
            alert(error.message);
          }
        });
      });
    },
  });
};

const renderDeals = async () => {
  const query = { page: '1', limit: '20', ...currentQuery() };
  await listPage({
    title: 'Deals',
    subtitle: 'Inspect deal inventory and force status changes',
    endpoint: '/admin/deals',
    query,
    filters: `
      <div class="filters">
        <input id="deals-keyword" name="keyword" placeholder="Search deal or company" value="${query.keyword || ''}" />
        <select id="deals-status" name="status">
          <option value="">All statuses</option>
          <option value="open" ${query.status === 'open' ? 'selected' : ''}>open</option>
          <option value="closed" ${query.status === 'closed' ? 'selected' : ''}>closed</option>
          <option value="archived" ${query.status === 'archived' ? 'selected' : ''}>archived</option>
        </select>
        <input id="deals-type" name="dealType" placeholder="Deal type" value="${query.dealType || ''}" />
      </div>
    `,
    renderRows: {
      head: `<tr><th>ID</th><th>Name</th><th>Company</th><th>Type</th><th>Status</th><th>Value</th><th>Requests</th><th>Actions</th></tr>`,
      body: (items) =>
        items
          .map(
            (item) => `
              <tr data-clickable="true" data-open-id="${item.id}">
                <td class="mono">${item.id}</td>
                <td>${item.dealName}</td>
                <td>${item.company.name}</td>
                <td>${item.dealType}</td>
                <td>${badge(item.status)}</td>
                <td>${formatMoney(item.dealValue)}</td>
                <td>${formatNumber(item.requestCount)}</td>
                <td>
                  ${
                    state.user.role === 'admin'
                      ? `<div class="actions">
                          <select data-deal-status="${item.id}">
                            <option value="">Set status</option>
                            <option value="open">open</option>
                            <option value="closed">closed</option>
                            <option value="archived">archived</option>
                          </select>
                        </div>`
                      : '<span class="mono">read-only</span>'
                  }
                </td>
              </tr>
            `
          )
          .join(''),
    },
    detailEndpoint: '/admin/deals',
    detailRenderer: (item) => `
      <div class="drawer-section"><div class="kv">
        <strong>Name</strong><div>${item.dealName}</div>
        <strong>Status</strong><div>${badge(item.status)}</div>
        <strong>Type</strong><div>${item.dealType}</div>
        <strong>Company</strong><div>${item.companyName || '—'}</div>
        <strong>Value</strong><div>${formatMoney(item.dealValue)}</div>
        <strong>Applications</strong><div>${formatNumber(item.applicationsCount)}</div>
      </div></div>
      <div class="drawer-section"><h4>Description</h4><pre>${item.dealDescription || '—'}</pre></div>
      <div class="drawer-section"><h4>Attachments</h4><pre>${JSON.stringify(item.attachments || [], null, 2)}</pre></div>
    `,
    bindActions: () => {
      bindFilterForm(['deals-keyword', 'deals-status', 'deals-type']);
      document.querySelectorAll('[data-deal-status]').forEach((select) => {
        select.addEventListener('change', async () => {
          if (!select.value) return;
          try {
            await api(`/admin/deals/${select.dataset.dealStatus}/status`, {
              method: 'PATCH',
              body: JSON.stringify({ status: select.value }),
            });
            renderDeals();
          } catch (error) {
            alert(error.message);
          }
        });
      });
    },
  });
};

const renderEmailLogs = async () => {
  const query = { page: '1', limit: '20', ...currentQuery() };
  await listPage({
    title: 'Email Logs',
    subtitle: 'Outbound email tracking and failure inspection',
    endpoint: '/admin/email-logs',
    query,
    filters: `
      <div class="filters">
        <input id="email-recipient" name="recipient" placeholder="Recipient" value="${query.recipient || ''}" />
        <input id="email-template" name="template" placeholder="Template" value="${query.template || ''}" />
        <input id="email-status" name="status" placeholder="Status" value="${query.status || ''}" />
      </div>
    `,
    renderRows: {
      head: `<tr><th>ID</th><th>Recipient</th><th>Template</th><th>Status</th><th>Attempts</th><th>Sent</th><th>Created</th></tr>`,
      body: (items) =>
        items
          .map(
            (item) => `
              <tr data-clickable="true" data-open-id="${item.id}">
                <td class="mono">${item.id}</td>
                <td>${item.recipient}</td>
                <td>${item.template || '—'}</td>
                <td>${badge(item.status)}</td>
                <td>${item.attempts}</td>
                <td>${formatDate(item.sentAt)}</td>
                <td>${formatDate(item.createdAt)}</td>
              </tr>
            `
          )
          .join(''),
    },
    detailEndpoint: '/admin/email-logs',
    detailRenderer: (item) => `
      <div class="drawer-section"><div class="kv">
        <strong>Recipient</strong><div>${item.recipient}</div>
        <strong>Template</strong><div>${item.template || '—'}</div>
        <strong>Status</strong><div>${badge(item.status)}</div>
        <strong>Message ID</strong><div class="mono">${item.messageId || '—'}</div>
        <strong>Attempts</strong><div>${item.attempts}</div>
      </div></div>
      <div class="drawer-section"><h4>Subject</h4><pre>${item.subject || '—'}</pre></div>
      <div class="drawer-section"><h4>Error</h4><pre>${item.error || '—'}</pre></div>
    `,
    bindActions: () => bindFilterForm(['email-recipient', 'email-template', 'email-status']),
  });
};

const renderRoute = async () => {
  const path = location.hash.split('?')[0] || '#/dashboard';
  if (path === '#/login') {
    renderLogin();
    return;
  }
  if (!ensureAuthorized()) return;

  if (path === '#/users') return renderUsers();
  if (path === '#/companies') return renderCompanies();
  if (path === '#/deals') return renderDeals();
  if (path === '#/email-logs') return renderEmailLogs();
  return renderDashboard();
};

window.addEventListener('hashchange', renderRoute);
window.addEventListener('load', () => {
  auth.loadUser();
  if (!location.hash) {
    location.hash = auth.getToken() ? '#/dashboard' : '#/login';
  }
  renderRoute();
});
