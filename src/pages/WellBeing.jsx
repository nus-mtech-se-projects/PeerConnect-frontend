/**
 * WellBeing.jsx — Mental Health & Well-being Resources
 *
 * Uses the Strategy design pattern (see src/strategies/resourceStrategies.js)
 * to present contextually appropriate resources:
 *   • NUS students / staff  → NUS Health & Well-being Office + OSA resources
 *   • Everyone else         → HealthHub SG + NCSS + Singapore community resources
 *
 * Styling reuses existing Home.css and Dashboard.css classes throughout.
 * WellBeing.css adds only three targeted overrides that cannot be expressed
 * with existing classes.
 */

import { useState, useMemo } from "react";
import { WellBeingIcon } from "../components/Icons";
import {
  ResourceContext,
  NUSResourceStrategy,
  ExternalResourceStrategy,
  createResourceStrategy,
} from "../strategies/resourceStrategies";
import "../styles/pages/Home.css";
import "../styles/pages/Dashboard.css";
import "../styles/pages/WellBeing.css";

/* ─── Inline SVG helpers ─────────────────────────────────────────────────── */

const ExternalLinkIcon = () => (
  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>
    <polyline points="15 3 21 3 21 9"/>
    <line x1="10" y1="14" x2="21" y2="3"/>
  </svg>
);

const PhoneIcon = () => (
  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 12a19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 3.6 1.18h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L7.91 8.77a16 16 0 0 0 6.29 6.29l1.46-1.46a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7a2 2 0 0 1 1.72 2.02z"/>
  </svg>
);

const AlertIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
    <line x1="12" y1="9" x2="12" y2="13"/>
    <line x1="12" y1="17" x2="12.01" y2="17"/>
  </svg>
);

/* ─── Badge colour mapping ───────────────────────────────────────────────── */
// Reuses .groupCourse (blue), .groupMode.online (green), and .pill (neutral)

function BadgeChip({ badge }) {
  if (!badge) return null;
  const greenBadges = new Set(["Peer Support", "Ages 16–30", "Free"]);
  const cls = greenBadges.has(badge) ? "groupMode online" : "groupCourse";
  return <span className={cls}>{badge}</span>;
}

/* ─── Resource card ──────────────────────────────────────────────────────── */
// Reuses .groupCard, .groupName, .groupActions, .groupJoinBtn from Dashboard.css

function ResourceCard({ resource }) {
  const { name, description, url, phone, badge } = resource;
  return (
    <article className="groupCard" style={{ width: "auto" }}>
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 8, marginBottom: 4 }}>
        <span className="groupName" style={{ fontSize: 14 }}>{name}</span>
        <BadgeChip badge={badge} />
      </div>
      <p className="wbCardDesc">{description}</p>
      <div className="groupActions" style={{ marginTop: "auto", paddingTop: 12, borderTop: "1px solid #f3f4f6" }}>
        {url && (
          <a className="groupJoinBtn" href={url} target="_blank" rel="noopener noreferrer" style={{ textDecoration: "none" }}>
            Visit <ExternalLinkIcon />
          </a>
        )}
        {phone && (
          <a className="wbPhoneLink" href={`tel:${phone.replace(/\s/g, "")}`}>
            <PhoneIcon /> {phone}
          </a>
        )}
      </div>
    </article>
  );
}

/* ─── Resource section ───────────────────────────────────────────────────── */
// Reuses .dashNavLabel and .dashGrid from Dashboard.css

function ResourceSection({ section }) {
  return (
    <div style={{ marginBottom: 28 }}>
      <span className="dashNavLabel" style={{ display: "block", marginBottom: 14 }}>{section.title}</span>
      <div className="dashGrid">
        {section.resources.map((res) => (
          <ResourceCard key={res.name} resource={res} />
        ))}
      </div>
    </div>
  );
}

/* ─── Tab definitions ────────────────────────────────────────────────────── */

const TABS = [
  { id: "nus",      label: "NUS Resources",       badge: "NUS",    strategy: new NUSResourceStrategy() },
  { id: "external", label: "Singapore Community", badge: "Public", strategy: new ExternalResourceStrategy() },
];

/* ─── Main page ──────────────────────────────────────────────────────────── */

export default function WellBeing() {
  /* Determine default tab from JWT email via Strategy factory */
  const defaultStrategy = useMemo(() => createResourceStrategy(), []);
  const isNUSDefault = defaultStrategy instanceof NUSResourceStrategy;
  const [activeTab, setActiveTab] = useState(isNUSDefault ? "nus" : "external");

  /* Build ResourceContext for the active tab */
  const context = useMemo(() => {
    const tab = TABS.find((t) => t.id === activeTab);
    return new ResourceContext(tab.strategy);
  }, [activeTab]);

  const sections = context.getSections();
  const audienceDesc = context.getUserDescription();

  return (
    <div className="page">

      {/* ── Header — reuses .heroCard, .heroGlow, .heroKicker, .heroTitle, .heroDesc ── */}
      <header className="heroCard" style={{ marginBottom: 24 }}>
        <div className="heroGlow" aria-hidden="true" />
        <span className="heroKicker">
          <WellBeingIcon size={13} style={{ verticalAlign: "middle" }} />
          {" "}Mental Health &amp; Well-being
        </span>
        <h1 className="heroTitle">Well-being Resources</h1>
        <p className="heroDesc">
          Your well-being matters. Below you will find trusted resources — from
          on-campus counselling to community helplines — to support you whenever
          you need it.
        </p>
      </header>

      {/* ── Audience selector — reuses .ptRoleNav, .ptRoleBtn from Dashboard.css ── */}
      <nav className="ptRoleNav" role="tablist" aria-label="Audience" style={{ marginBottom: 16 }}>
        {TABS.map((tab) => (
          <button
            key={tab.id}
            role="tab"
            aria-selected={activeTab === tab.id}
            className={`ptRoleBtn${activeTab === tab.id ? " active" : ""}`}
            onClick={() => setActiveTab(tab.id)}
          >
            {tab.label}
            {/* Reuse .pill for the small badge inside the tab */}
            <span className="pill" style={{ fontSize: 10, padding: "2px 7px" }}>{tab.badge}</span>
          </button>
        ))}
      </nav>

      {/* ── Audience description — reuses .enrollMsg--success from Dashboard.css ── */}
      <div className="enrollMsg enrollMsg--success" style={{ marginBottom: 24 }} role="note">
        {audienceDesc}
      </div>

      {/* ── Resource sections ── */}
      {sections.map((section) => (
        <ResourceSection key={section.id} section={section} />
      ))}

      {/* ── Emergency banner — reuses .enrollMsg--error from Dashboard.css ── */}
      <div className="enrollMsg enrollMsg--error" style={{ display: "flex", gap: 12, alignItems: "flex-start", marginTop: 8 }} role="alert">
        <span style={{ flexShrink: 0, marginTop: 1 }}><AlertIcon /></span>
        <span>
          <strong>If you are in immediate danger</strong>, call{" "}
          <strong>995</strong> (Singapore Emergency) or go to your nearest
          hospital A&amp;E. For emotional crisis support, call the{" "}
          <strong>Samaritans of Singapore at 1767</strong> — available 24 hours
          a day, 7 days a week.
        </span>
      </div>

    </div>
  );
}
