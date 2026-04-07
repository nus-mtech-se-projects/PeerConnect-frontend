/**
 * Well-being Resource Strategies
 *
 * Implements the Strategy design pattern to provide contextually appropriate
 * mental health and well-being resources based on the user's affiliation.
 *
 * Pattern participants:
 *   - ResourceStrategy      (abstract base / interface)
 *   - NUSResourceStrategy   (concrete strategy for NUS staff & students)
 *   - ExternalResourceStrategy (concrete strategy for non-NUS users)
 *   - ResourceContext       (context that delegates to a strategy)
 */

/* ─── Abstract base strategy ─────────────────────────────────────────────── */

class ResourceStrategy {
  /** Short label shown in the tab / header for this audience. */
  getUserLabel() { return ""; }

  /** One-sentence description of who these resources are for. */
  getUserDescription() { return ""; }

  /**
   * Returns an ordered array of resource sections.
   * Each section: { id, title, resources[] }
   * Each resource: { name, description, url, phone?, badge? }
   */
  getSections() { return []; }
}

/* ─── Concrete strategy: NUS staff & students ────────────────────────────── */

class NUSResourceStrategy extends ResourceStrategy {
  getUserLabel() { return "NUS Community"; }

  getUserDescription() {
    return "Resources provided by NUS Health & Well-being Office and the Office of Student Affairs for NUS students and staff.";
  }

  getSections() {
    return [
      {
        id: "counselling",
        title: "Counselling & Psychological Support",
        resources: [
          {
            name: "University Counselling Services (UCS)",
            description:
              "Free, confidential counselling for NUS students and staff. Individual counselling, crisis support, and psychological assessments are available.",
            url: "https://osa.nus.edu.sg/",
            phone: "6516 1972",
            badge: "Free",
          },
          {
            name: "University Health Centre (UHC)",
            description:
              "Medical and mental health consultations by doctors and nurses at UHC. Referrals to psychiatrists and counsellors available.",
            url: "https://www.nus.edu.sg/uhc",
            phone: "6779 5930",
            badge: "On-campus",
          },
          {
            name: "NUS Peer Helpers Programme",
            description:
              "A student-run initiative offering peer support and active listening. Peer helpers are trained to provide a safe space and refer members of the community to professional help when needed.",
            url: "https://osa.nus.edu.sg/",
            badge: "Peer Support",
          },
        ],
      },
      {
        id: "wellness",
        title: "Wellness Programmes & Initiatives",
        resources: [
          {
            name: "OSA – Office of Student Affairs",
            description:
              "The Office of Student Affairs organises well-being workshops, mindfulness sessions, mental health talks, and community events throughout the academic year.",
            url: "https://osa.nus.edu.sg/",
            badge: "OSA",
          },
        ],
      },
      {
        id: "crisis",
        title: "Crisis & Emergency Support",
        resources: [
          {
            name: "NUS Campus Security (24-hour)",
            description:
              "24-hour emergency response on campus. Call Campus Security for urgent on-campus safety and welfare concerns.",
            phone: "6874 1616",
            badge: "24/7",
          },
          {
            name: "Samaritans of Singapore (SOS)",
            description:
              "24-hour emotional support helpline available to anyone in distress, including the NUS community.",
            url: "https://www.sos.org.sg",
            phone: "1767",
            badge: "24/7",
          },
        ],
      },
    ];
  }
}

/* ─── Concrete strategy: Non-NUS / general public (Singapore) ────────────── */

class ExternalResourceStrategy extends ResourceStrategy {
  getUserLabel() { return "Singapore Community"; }

  getUserDescription() {
    return "Mental health and well-being resources available to everyone in Singapore, including platforms supported by HealthHub SG and the National Council of Social Service.";
  }

  getSections() {
    return [
      {
        id: "platforms",
        title: "Online Platforms & Self-Help",
        resources: [
          {
            name: "MindSG (HealthHub)",
            description:
              "Singapore's national mental wellness platform by MOH and HPB. Offers self-assessments, guided programmes, audio exercises, and a directory of mental health services.",
            url: "https://www.healthhub.sg/programmes/mindsg",
            badge: "Gov",
          },
          {
            name: "Institute of Mental Health (IMH)",
            description:
              "Singapore's national psychiatric hospital. The IMH website provides information on mental health conditions, community services, and how to access specialist care.",
            url: "https://www.imh.com.sg",
            badge: "Specialist",
          },
        ],
      },
      {
        id: "helplines",
        title: "Helplines & Crisis Support",
        resources: [
          {
            name: "Samaritans of Singapore (SOS)",
            description:
              "24-hour multilingual emotional support and suicide prevention helpline. Call or chat for confidential, judgment-free listening.",
            url: "https://www.sos.org.sg",
            phone: "1767",
            badge: "24/7",
          },
          {
            name: "IMH Emergency Services",
            description:
              "The Institute of Mental Health's 24-hour emergency department provides urgent care and assessment for people experiencing severe emotional distress.",
            url: "https://www.imh.com.sg/Clinical-Services/Pages/Emergency-Services.aspx",
            phone: "6389 2000",
            badge: "24/7",
          },
        ],
      },
      {
        id: "specialised",
        title: "Specialised Services",
        resources: [
          {
            name: "CHAT (Community Health Assessment Team)",
            description:
              "Free mental health screening and support for young people aged 16–30 in Singapore. Walk-in or online assessment available.",
            url: "https://www.imh.com.sg/CHAT/Pages/default.aspx",
            badge: "Ages 16–30",
          },
        ],
      },
    ];
  }
}

/* ─── Context ─────────────────────────────────────────────────────────────── */

export class ResourceContext {
  constructor(strategy) {
    this._strategy = strategy;
  }

  setStrategy(strategy) {
    this._strategy = strategy;
  }

  getUserLabel() { return this._strategy.getUserLabel(); }
  getUserDescription() { return this._strategy.getUserDescription(); }
  getSections() { return this._strategy.getSections(); }
}

/* ─── Factory helper ─────────────────────────────────────────────────────── */

/**
 * Inspects the stored JWT (if present) to determine user affiliation and
 * returns the appropriate concrete strategy.
 *
 * NUS affiliates are identified by email domains:
 *   @nus.edu.sg  – staff
 *   @u.nus.edu   – students
 */
export function createResourceStrategy() {
  const token = localStorage.getItem("accessToken");
  if (token) {
    try {
      const payload = JSON.parse(atob(token.split(".")[1]));
      const email = (payload.email || payload.sub || "").toLowerCase();
      if (email.endsWith("@nus.edu.sg") || email.endsWith("@u.nus.edu")) {
        return new NUSResourceStrategy();
      }
    } catch {
      /* malformed token — fall through to external */
    }
  }
  return new ExternalResourceStrategy();
}

/* Named exports for testing / direct instantiation */
export { NUSResourceStrategy, ExternalResourceStrategy };
