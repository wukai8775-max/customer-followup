:root {
  color: #1f2933;
  background: #f3f5f7;
  font-family:
    "Microsoft YaHei",
    "PingFang SC",
    "Segoe UI",
    Arial,
    sans-serif;
  font-size: 14px;
}

* {
  box-sizing: border-box;
}

body {
  margin: 0;
  min-width: 320px;
  min-height: 100vh;
  background: #f3f5f7;
}

button,
input,
select,
textarea {
  font: inherit;
}

button {
  cursor: pointer;
}

button:disabled {
  cursor: not-allowed;
  opacity: 0.6;
}

input,
select,
textarea {
  width: 100%;
  min-height: 36px;
  border: 1px solid #cfd6dd;
  border-radius: 6px;
  background: #fff;
  color: #1f2933;
  padding: 8px 10px;
  outline: none;
}

textarea {
  min-height: 76px;
  resize: vertical;
}

input:focus,
select:focus,
textarea:focus {
  border-color: #2f80ed;
  box-shadow: 0 0 0 3px rgba(47, 128, 237, 0.12);
}

table {
  width: 100%;
  border-collapse: collapse;
  table-layout: auto;
}

th,
td {
  border-bottom: 1px solid #e4e8ed;
  padding: 10px 12px;
  text-align: left;
  vertical-align: middle;
  white-space: nowrap;
}

th {
  position: sticky;
  top: 0;
  z-index: 1;
  background: #f7f9fb;
  color: #52606d;
  font-weight: 700;
}

td small {
  display: block;
  margin-top: 3px;
  color: #697684;
}

.boot {
  display: grid;
  min-height: 100vh;
  place-items: center;
  color: #52606d;
}

.shell {
  display: grid;
  grid-template-columns: 232px minmax(0, 1fr);
  min-height: 100vh;
}

.sidebar {
  position: sticky;
  top: 0;
  height: 100vh;
  overflow-y: auto;
  border-right: 1px solid #dce2e8;
  background: #ffffff;
  padding: 18px 14px;
}

.brand,
.login-title {
  display: flex;
  align-items: center;
  gap: 10px;
}

.brand {
  margin-bottom: 18px;
  padding: 0 6px;
}

.brand strong,
.login-title h1 {
  display: block;
  margin: 0;
  font-size: 17px;
}

.brand span {
  display: block;
  margin-top: 2px;
  color: #697684;
  font-size: 12px;
}

.brand-mark {
  display: grid;
  width: 36px;
  height: 36px;
  min-width: 36px;
  place-items: center;
  border-radius: 8px;
  background: #1f7a5a;
  color: #fff;
  font-weight: 800;
}

.nav-item {
  display: flex;
  width: 100%;
  min-height: 40px;
  align-items: center;
  gap: 10px;
  border: 0;
  border-radius: 6px;
  background: transparent;
  color: #334e68;
  padding: 9px 10px;
  text-align: left;
}

.nav-item:hover {
  background: #eef4f8;
}

.nav-item.active {
  background: #dceee7;
  color: #166046;
  font-weight: 700;
}

.main {
  min-width: 0;
  padding: 22px;
}

.topbar {
  display: flex;
  min-height: 54px;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  margin-bottom: 16px;
}

.topbar h1 {
  margin: 0;
  font-size: 22px;
}

.topbar span {
  color: #697684;
}

.userbar {
  display: flex;
  align-items: center;
  gap: 9px;
  white-space: nowrap;
}

.role {
  border-radius: 999px;
  background: #edf0f2;
  color: #52606d;
  padding: 4px 8px;
  font-size: 12px;
}

.content-stack {
  display: grid;
  gap: 16px;
}

.panel {
  border: 1px solid #dce2e8;
  border-radius: 8px;
  background: #fff;
  overflow: hidden;
}

.panel-heading {
  display: flex;
  min-height: 52px;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  border-bottom: 1px solid #e4e8ed;
  padding: 12px 14px;
}

.panel-heading h2,
.panel h3 {
  margin: 0;
}

.panel-heading h2 {
  font-size: 16px;
}

.panel-heading span {
  display: block;
  margin-top: 3px;
  color: #697684;
}

.toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.filter-grid {
  display: grid;
  width: 100%;
  grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
  gap: 10px;
}

.search-box {
  position: relative;
  display: flex;
  width: min(420px, 100%);
  align-items: center;
}

.search-box svg {
  position: absolute;
  left: 10px;
  color: #697684;
}

.search-box input {
  padding-left: 34px;
}

.primary-button,
.secondary-button,
.text-button,
.icon-button {
  display: inline-flex;
  min-height: 36px;
  align-items: center;
  justify-content: center;
  gap: 7px;
  border-radius: 6px;
  border: 1px solid transparent;
  padding: 8px 12px;
  white-space: nowrap;
}

.primary-button {
  background: #1f7a5a;
  color: #fff;
}

.primary-button:hover {
  background: #166046;
}

.secondary-button {
  border-color: #cfd6dd;
  background: #fff;
  color: #334e68;
}

.text-button {
  border: 0;
  background: transparent;
  color: #2f80ed;
  padding-inline: 4px;
}

.icon-button {
  width: 36px;
  min-width: 36px;
  padding: 0;
  border-color: #dce2e8;
  background: #fff;
  color: #334e68;
}

.icon-button:hover,
.secondary-button:hover {
  background: #f3f6f8;
}

.icon-button.danger {
  color: #b42318;
}

.link-button {
  border: 0;
  background: transparent;
  color: #1665c1;
  font-weight: 700;
  padding: 0;
}

.row-actions {
  display: flex;
  align-items: center;
  gap: 6px;
}

.metric-grid {
  display: grid;
  grid-template-columns: repeat(6, minmax(130px, 1fr));
  gap: 12px;
}

.metric-card {
  display: grid;
  min-height: 96px;
  align-content: center;
  gap: 10px;
  border: 1px solid #dce2e8;
  border-radius: 8px;
  background: #fff;
  color: #1f2933;
  padding: 14px;
  text-align: left;
}

.metric-card:hover {
  border-color: #9fb5ca;
}

.metric-card.static {
  cursor: default;
}

.metric-card span {
  color: #52606d;
  font-weight: 600;
}

.metric-card strong {
  font-size: 28px;
}

.table-wrap {
  width: 100%;
  overflow: auto;
}

.compact-table th,
.compact-table td {
  padding: 8px 10px;
}

.selected-row {
  background: #eef7f2;
}

.alert-yellow {
  background: #fff9e8;
}

.alert-red {
  background: #fff1f0;
}

.badge,
.tag {
  display: inline-flex;
  min-height: 24px;
  align-items: center;
  border-radius: 999px;
  background: #edf0f2;
  color: #3f4d5a;
  padding: 3px 9px;
  font-size: 12px;
  font-weight: 700;
  white-space: nowrap;
}

.badge.warning {
  background: #fff3cf;
  color: #8a5a00;
}

.badge.danger {
  background: #ffe1df;
  color: #a61b10;
}

.badge.success {
  background: #ddf5e9;
  color: #136c48;
}

.badge.blue {
  background: #e3f0ff;
  color: #155aa8;
}

.badge.teal {
  background: #d9f3f0;
  color: #0f6f69;
}

.badge.muted {
  background: #eef0f2;
  color: #697684;
}

.tag-list {
  display: flex;
  flex-wrap: wrap;
  gap: 5px;
}

.tag {
  background: #edf6ef;
  color: #1f7a5a;
}

.notice {
  border: 1px solid #ffd4cf;
  border-radius: 8px;
  background: #fff1f0;
  color: #a61b10;
  padding: 10px 12px;
}

.empty {
  padding: 24px;
  color: #697684;
  text-align: center;
}

.detail-grid {
  display: grid;
  grid-template-columns: minmax(0, 1.2fr) minmax(360px, 0.8fr);
  gap: 16px;
  padding: 14px;
}

.detail-grid h3 {
  margin: 0 0 10px;
  font-size: 15px;
}

.inline-form {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 9px;
  margin-bottom: 12px;
}

.inline-form textarea {
  grid-column: 1 / -1;
}

.inline-form button {
  justify-self: start;
}

.timeline {
  display: grid;
  gap: 10px;
  max-height: 360px;
  overflow: auto;
}

.timeline-item {
  border: 1px solid #e4e8ed;
  border-radius: 8px;
  padding: 10px;
}

.timeline-item strong,
.timeline-item span,
.timeline-item em {
  display: block;
}

.timeline-item p {
  margin: 7px 0;
  white-space: pre-wrap;
}

.timeline-item span,
.timeline-item em {
  color: #697684;
  font-style: normal;
  margin-top: 4px;
}

.settings-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(180px, 1fr));
  gap: 12px;
  padding: 14px;
}

.dictionary-column {
  border: 1px solid #e4e8ed;
  border-radius: 8px;
  padding: 12px;
}

.dictionary-column h3 {
  margin-bottom: 10px;
}

.dictionary-item {
  display: flex;
  min-height: 34px;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  border-bottom: 1px solid #eef1f4;
  padding: 6px 0;
}

.dictionary-item:last-child {
  border-bottom: 0;
}

.settings-form {
  display: grid;
  grid-template-columns: 150px minmax(180px, 1fr) auto;
  gap: 8px;
  align-items: center;
}

.settings-form.wide {
  grid-template-columns: repeat(4, minmax(130px, 1fr)) auto;
  padding: 14px;
}

.login-page {
  display: grid;
  min-height: 100vh;
  place-items: center;
  padding: 20px;
  background: #eef2f4;
}

.login-panel {
  display: grid;
  width: min(390px, 100%);
  gap: 14px;
  border: 1px solid #dce2e8;
  border-radius: 8px;
  background: #fff;
  padding: 24px;
}

.login-title {
  margin-bottom: 4px;
}

.modal-backdrop {
  position: fixed;
  inset: 0;
  z-index: 10;
  display: grid;
  place-items: center;
  background: rgba(31, 41, 51, 0.38);
  padding: 18px;
}

.modal-panel {
  width: min(860px, 100%);
  max-height: min(760px, calc(100vh - 36px));
  overflow: auto;
  border-radius: 8px;
  background: #fff;
  box-shadow: 0 18px 44px rgba(31, 41, 51, 0.22);
}

.modal-heading {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  border-bottom: 1px solid #e4e8ed;
  padding: 14px 16px;
}

.modal-heading h2 {
  margin: 0;
  font-size: 17px;
}

.modal-form {
  display: grid;
  grid-template-columns: repeat(2, minmax(220px, 1fr));
  gap: 12px;
  padding: 16px;
}

.modal-form label,
.login-panel label {
  display: grid;
  gap: 6px;
  color: #52606d;
  font-weight: 700;
}

.wide-field,
.modal-actions {
  grid-column: 1 / -1;
}

.modal-actions {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
}

@media (max-width: 1100px) {
  .metric-grid {
    grid-template-columns: repeat(3, minmax(150px, 1fr));
  }

  .filter-grid,
  .settings-grid {
    grid-template-columns: repeat(2, minmax(150px, 1fr));
  }

  .detail-grid {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 760px) {
  .shell {
    grid-template-columns: 1fr;
  }

  .sidebar {
    position: static;
    height: auto;
  }

  .main {
    padding: 14px;
  }

  .topbar,
  .toolbar,
  .panel-heading {
    align-items: flex-start;
    flex-direction: column;
  }

  .metric-grid,
  .filter-grid,
  .settings-grid,
  .settings-form,
  .settings-form.wide,
  .modal-form,
  .inline-form {
    grid-template-columns: 1fr;
  }

  .modal-actions {
    grid-column: auto;
  }
}
