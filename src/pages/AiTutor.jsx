import { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { API_BASE, authHeaders } from "../utils/auth";
import PromptFactory from "../factories/PromptFactory";
import "../styles/pages/AiTutor.css";

async function callAI(prompt) {
  const res = await fetch(`${API_BASE}/api/ai-tutor/chat`, {
    method: "POST",
    headers: authHeaders(),
    credentials: "include",
    body: JSON.stringify({ message: prompt, history: [] }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.error || `Request failed (${res.status})`);

  // Strip markdown fences, then extract only the JSON object
  let raw = data.reply.replace(/```json\s*/gi, "").replace(/```\s*/g, "").trim();
  const start = raw.indexOf("{");
  const end   = raw.lastIndexOf("}");
  if (start !== -1 && end > start) raw = raw.slice(start, end + 1);

  // Remove trailing commas before ] or } which break JSON.parse
  raw = raw.replace(/,\s*([}\]])/g, "$1");

  try {
    return JSON.parse(raw);
  } catch (e) {
    console.error("AI JSON parse error:", e.message, "\nRaw:", raw.slice(0, 300));
    throw new Error("AI returned malformed JSON. Please retry.");
  }
}

function buildContextStr(ctx) {
  if (!ctx) return null;
  return [
    ctx.moduleCode && ctx.moduleCode !== "N/A" ? `Module: ${ctx.moduleCode}` : null,
    `Title: ${ctx.title}`,
    ctx.topic       ? `Topic: ${ctx.topic}`             : null,
    ctx.description ? `Description: ${ctx.description}` : null,
  ].filter(Boolean).join("\n");
}

function normalizeLower(value) {
  return typeof value === "string" ? value.trim().toLowerCase() : "";
}

function getUserIdentifiers(userProfile) {
  return new Set(
    [
      userProfile?.id,
      userProfile?.userId,
      userProfile?._id,
      userProfile?.email,
      userProfile?.userEmail,
    ]
      .filter(Boolean)
      .map((value) => String(value).trim().toLowerCase())
  );
}

function getUserDisplayAliases(userProfile) {
  const fullName = [userProfile?.firstName, userProfile?.lastName]
    .filter(Boolean)
    .join(" ")
    .trim()
    .toLowerCase();
  const emailLocalPart = typeof userProfile?.email === "string"
    ? userProfile.email.split("@")[0]?.trim().toLowerCase()
    : "";

  return new Set(
    [
      fullName,
      normalizeLower(userProfile?.name),
      normalizeLower(userProfile?.displayName),
      emailLocalPart,
    ].filter(Boolean)
  );
}

function memberMatchesUser(member, identifiers) {
  if (!member || identifiers.size === 0) return false;
  return [member.userId, member.id, member.email]
    .filter(Boolean)
    .some((value) => identifiers.has(String(value).trim().toLowerCase()));
}

function getStudyGroupBucket(group, userProfile) {
  const membershipStatus = normalizeLower(group?.membershipStatus);
  const role = normalizeLower(group?.role || group?.membershipRole);
  const userIdentifiers = getUserIdentifiers(userProfile);
  const currentMember = Array.isArray(group?.members)
    ? group.members.find((member) => memberMatchesUser(member, userIdentifiers))
    : null;
  const currentMemberRole = normalizeLower(currentMember?.role);
  const currentMemberStatus = normalizeLower(currentMember?.membershipStatus);

  const isOwner =
    group?.isAdmin === true ||
    role === "owner" ||
    role === "admin" ||
    currentMemberRole === "owner" ||
    currentMemberRole === "admin";

  if (isOwner) return "owner";

  const isJoined =
    group?.joined === true ||
    membershipStatus === "approved" ||
    membershipStatus === "joined" ||
    role === "member" ||
    currentMemberStatus === "approved";

  if (isJoined) return "joined";

  const isPending =
    membershipStatus === "pending" ||
    membershipStatus === "invited" ||
    membershipStatus === "requested" ||
    currentMemberStatus === "pending" ||
    currentMemberStatus === "invited";

  return isPending ? "pending" : "available";
}

function partitionStudyGroups(studyGroups, userProfile) {
  const sourceGroups = Array.isArray(studyGroups) ? studyGroups : [];
  return sourceGroups.reduce(
    (acc, group) => {
      const bucket = getStudyGroupBucket(group, userProfile);
      acc[bucket].push(group);
      return acc;
    },
    { owner: [], joined: [], pending: [], available: [] }
  );
}

function normalizePeerTutoringQuestion(message) {
  if (typeof message !== "string" || !message.trim()) return message;

  return message
    .replace(/\bpeer tutor groups\b/gi, "peer tutoring classes")
    .replace(/\bpeer tutor group\b/gi, "peer tutoring class")
    .replace(/\btutor groups\b/gi, "tutoring classes")
    .replace(/\btutor group\b/gi, "tutoring class")
    .replace(/\bpeer tutor\b/gi, "peer tutoring")
    .replace(/\bpeer tutoring groups\b/gi, "peer tutoring classes")
    .replace(/\bpeer tutoring group\b/gi, "peer tutoring class");
}

function isStudyGroupMessage(message) {
  const text = normalizeLower(message);
  if (!text) return false;

  const mentionsPeerTutoring = /(peer tutoring|peer tutor|tutoring class|tutoring classes|tutor class|tutor classes)/.test(text);
  if (mentionsPeerTutoring) return false;

  const explicitStudyGroups = /(study\s*groups?|study\s*group)/.test(text);
  const genericGroupsWithStudyIntent =
    /\bgroups?\b/.test(text) &&
    /(join|joined|manage|managed|created|pending|approval|available|not joined|open groups|my groups|what groups|which groups|groups i can join|groups do i have)/.test(text);

  return explicitStudyGroups || genericGroupsWithStudyIntent;
}

function isAvailableStudyGroupQuestion(message) {
  const text = normalizeLower(message);
  return (
    isStudyGroupMessage(text) &&
    (
      /(can i join|can join|available|not joined|have not joined|haven't joined|joinable|open study groups|open groups|study groups to join|groups to join|suggest study groups i can join)/.test(text) ||
      /\bwhat\b[\s\S]{0,20}\bjoin\b/.test(text) ||
      /\bwhich\b[\s\S]{0,20}\bjoin\b/.test(text)
    )
  );
}

function buildContextFocusInstruction(message) {
  const text = normalizeLower(message);
  const asksAboutAvailableStudyGroups = isAvailableStudyGroupQuestion(text);

  if (/(restricted|blocked|restrict|restricted members?)/.test(text)) {
    return "The user's question is about restricted members. Answer from the restricted-members section first. Use the restricted-member details already present in context when available, and do not ask the user to repeat them. Do not switch to profile, study groups, or peer tutoring unless the user explicitly asks for that connection.";
  }

  if (/(profile|major|faculty|year of study|bio|full-time|part-time)/.test(text)) {
    return "The user's question is about their profile. Answer from the profile section first. If profile details are already present in context, use them directly, summarize only the fields actually shown there, and do not ask the user to provide them again. Do not claim access to unrelated fields like name, email, enrolled modules, or avatar unless those details are explicitly present in context. Do not switch to study groups, restricted members, or peer tutoring unless the user explicitly asks for that connection.";
  }

  if (/(peer tutoring|peer tutor|tutoring class|tutoring classes|tutor class|tutor classes)/.test(text)) {
    if (isCreatedPeerTutoringQuestion(text)) {
      return "The user's question is about peer tutoring classes they created or teach. Answer ONLY from the created peer-tutoring classes section. Do NOT switch to enrolled or available classes unless the user explicitly asks for them.";
    }
    if (isAvailablePeerTutoringQuestion(text)) {
      return "The user's question is about peer tutoring classes they can still join. Answer ONLY from the available peer-tutoring classes section. Do NOT list classes the user is already enrolled in as joinable. If available classes are listed, name those actual classes directly. Only give navigation or browsing advice if the available peer-tutoring section explicitly says no classes were found in the current context.";
    }
    return "The user's question is about peer tutoring. Answer from the peer-tutoring classes section first. Use the tutoring details already present in context when available, and do not ask the user to repeat them. Do not switch to study groups or profile unless the user explicitly asks for that connection.";
  }

  if (asksAboutAvailableStudyGroups) {
    return "The user's question is about study groups they can still join. Answer ONLY from the 'Other Available Study Groups (user has NOT joined)' section. Treat that section as the source of truth for joinable groups. Do NOT list joined groups, managed groups, or pending requests as groups the user can join. If available groups are listed, name those actual groups directly. Only give navigation or browsing advice if that available-groups section explicitly says no groups were found in the current context.";
  }

  if (isStudyGroupMessage(text)) {
    return "The user's question is about study groups. Answer EXCLUSIVELY from the study-groups sections (Joined, Created/Managed, Pending, Available). Use the study-group details already present in context when available, and do not ask the user to repeat them. If the user asks what study groups they can join, have not joined, what is available, or asks to suggest joinable study groups, prioritize ONLY the 'Other Available Study Groups (user has NOT joined)' section, list the actual available groups directly, and do not list pending requests as joinable groups. Do not give generic navigation or browsing steps if available groups are already present in context; only give navigation guidance when no available groups are listed. The peer tutoring classes section is IRRELEVANT to this question and profile details should only be mentioned if directly needed.";
  }

  return "Answer using the most relevant section of context for the user's question. If the needed details are already present in context, use them directly and do not ask the user to repeat them. Do not drift into unrelated profile, study-group, peer-tutoring, or restricted-member details unless they directly help answer the question.";
}

function buildAvailableStudyGroupsInstruction(studyGroups, userProfile) {
  const availableGroups = partitionStudyGroups(studyGroups, userProfile).available;

  if (availableGroups.length === 0) {
    return "For this request, there are currently no joinable study groups in the available-groups section. Say that clearly and do not invent any additional groups.";
  }

  const names = availableGroups
    .map((group) => group?.name || group?.title)
    .filter(Boolean);

  return [
    "For this request, the available study groups the user can still join are listed below. Treat this list as the source of truth and mention these groups directly.",
    ...names.map((name) => `- ${name}`),
    "Do not say there are no available study groups, and do not replace this with generic browsing advice.",
  ].join("\n");
}

function partitionTutoringClasses(tutoringClasses, userProfile) {
  const sourceClasses = Array.isArray(tutoringClasses) ? tutoringClasses : [];
  const userIdentifiers = getUserIdentifiers(userProfile);
  const userDisplayAliases = getUserDisplayAliases(userProfile);
  return sourceClasses.reduce(
    (acc, tutoringClass) => {
      const enrolled = tutoringClass?.enrolled === true;
      const tutorDisplay = [
        tutoringClass?.tutorName,
        tutoringClass?.createdByName,
        tutoringClass?.ownerName,
      ]
        .map(normalizeLower)
        .find(Boolean);
      const isTutorOwned =
        tutoringClass?.isTutor === true ||
        normalizeLower(tutoringClass?.role) === "tutor" ||
        normalizeLower(tutoringClass?.userRole) === "tutor" ||
        (tutorDisplay ? userDisplayAliases.has(tutorDisplay) : false) ||
        [tutoringClass?.createdBy, tutoringClass?.tutorId, tutoringClass?.ownerId]
          .filter(Boolean)
          .some((value) => userIdentifiers.has(String(value).trim().toLowerCase()));
      const maxStudents = tutoringClass?.maxStudents ?? Infinity;
      const enrolledCount = tutoringClass?.enrolledCount ?? 0;
      const isFull = Number.isFinite(maxStudents) ? enrolledCount >= maxStudents : false;

      if (isTutorOwned) {
        acc.created.push(tutoringClass);
      } else if (enrolled) {
        acc.enrolled.push(tutoringClass);
      } else if (!isTutorOwned && !isFull) {
        acc.available.push(tutoringClass);
      }

      return acc;
    },
    { created: [], enrolled: [], available: [] }
  );
}

function isCreatedPeerTutoringQuestion(message) {
  const text = normalizeLower(message);
  return (
    /(peer tutoring|peer tutor|tutoring class|tutoring classes|tutor class|tutor classes)/.test(text) &&
    /(created|create|made|teach|teaching|my classes|my tutoring classes|classes i created|classes i teach|have i created|what.*created|which.*created|manage)/.test(text)
  );
}

function isAvailablePeerTutoringQuestion(message) {
  const text = normalizeLower(message);
  return (
    /(peer tutoring|peer tutor|tutoring class|tutoring classes|tutor class|tutor classes)/.test(text) &&
    (
      /(can i join|can join|available|not joined|have not joined|joinable|open tutoring classes|peer tutoring classes to join|classes to join|what.*join|which.*join)/.test(text)
    )
  );
}

function buildAvailablePeerTutoringInstruction(tutoringClasses, userProfile) {
  const availableClasses = partitionTutoringClasses(tutoringClasses, userProfile).available;

  if (availableClasses.length === 0) {
    return "For this request, there are currently no joinable peer tutoring classes in the available peer-tutoring section. Say that clearly and do not invent any additional classes.";
  }

  return [
    "For this request, the peer tutoring classes the user can still join are listed below. Treat this list as the source of truth and mention these classes directly.",
    ...availableClasses
      .map((tutoringClass) => tutoringClass?.title || tutoringClass?.name)
      .filter(Boolean)
      .map((name) => `- ${name}`),
    "Do not say there are no available peer tutoring classes, and do not replace this with generic browsing advice.",
  ].join("\n");
}

function buildCreatedPeerTutoringInstruction(tutoringClasses, userProfile) {
  const createdClasses = partitionTutoringClasses(tutoringClasses, userProfile).created;

  if (createdClasses.length === 0) {
    return "For this request, there are currently no created peer tutoring classes in the created peer-tutoring section. Say that clearly and do not invent any additional classes.";
  }

  return [
    "For this request, the peer tutoring classes created or taught by the user are listed below. Treat this list as the source of truth and mention these classes directly.",
    ...createdClasses
      .map((tutoringClass) => tutoringClass?.title || tutoringClass?.name)
      .filter(Boolean)
      .map((name) => `- ${name}`),
    "Do not say the user has not created any peer tutoring classes if classes are listed here.",
  ].join("\n");
}

function buildProfileInstruction(profile) {
  if (!profile) {
    return "For this request, no profile details were found in the current context. Say that clearly and do not claim to know profile details that are not present.";
  }

  const knownFields = [
    profile.faculty ? `Faculty: ${profile.faculty}` : null,
    profile.major ? `Major: ${profile.major}` : null,
    profile.yearOfStudy !== undefined && profile.yearOfStudy !== null && profile.yearOfStudy !== ""
      ? `Year of Study: ${profile.yearOfStudy}`
      : null,
    profile.fullTime !== undefined ? `Mode: ${profile.fullTime ? "Full-time" : "Part-time"}` : null,
    profile.bio ? `Bio: ${profile.bio}` : null,
  ].filter(Boolean);

  const missingFields = [];
  if (!profile.faculty) missingFields.push("faculty");
  if (!profile.major) missingFields.push("major");
  if (profile.yearOfStudy === undefined || profile.yearOfStudy === null || profile.yearOfStudy === "") missingFields.push("year of study");
  if (profile.fullTime === undefined) missingFields.push("study mode");
  if (!profile.bio) missingFields.push("bio");

  return [
    "For this request, answer ONLY from the profile fields present in the profile section.",
    knownFields.length > 0 ? "Profile fields available now:" : "No structured profile fields are available now.",
    ...knownFields.map((field) => `- ${field}`),
    missingFields.length > 0
      ? `Do not claim access to missing fields such as ${missingFields.join(", ")} unless they are explicitly shown in context.`
      : "All supported profile fields are present in context.",
    "Do not say you cannot access the user's profile if the profile section is present. Summarize only the fields actually shown there.",
  ].join("\n");
}

function buildRestrictedMembersInstruction(restrictedUsers) {
  const users = Array.isArray(restrictedUsers) ? restrictedUsers : [];

  if (users.length === 0) {
    return "For this request, there are currently no restricted members in the restricted-members section. Say that clearly and do not invent any user names.";
  }

  return [
    "For this request, the restricted members are listed below. Treat this list as the source of truth and mention only these users.",
    ...users.map((user) => {
      const name = [user.firstName, user.lastName].filter(Boolean).join(" ") || user.fullName || user.email || "Unknown user";
      return `- ${name}`;
    }),
    "Do not invent additional restricted users beyond this list.",
  ].join("\n");
}

function buildChatRequestMeta(message, isWellbeing = false, detectTopicFn = () => "general") {
  if (isWellbeing) {
    return {
      aiMessage: message,
      topic: "general",
      focusInstruction: "The user's question is about well-being. Answer only with a short, practical well-being tip.",
    };
  }

  const aiMessage = normalizePeerTutoringQuestion(message);
  return {
    aiMessage,
    topic: detectTopicFn(aiMessage),
    focusInstruction: buildContextFocusInstruction(aiMessage),
  };
}

function hasProfileContextData(profile) {
  return Boolean(
    profile && (
      profile.faculty ||
      profile.major ||
      profile.yearOfStudy !== undefined && profile.yearOfStudy !== null && profile.yearOfStudy !== "" ||
      profile.fullTime !== undefined ||
      profile.bio
    )
  );
}

/* ── Shared chat bubbles ─────────────────────────────────────── */

function UserBubble({ text }) {
  return (
    <div className="atMsgRow atMsgRowUser">
      <div className="atBubble atBubbleUser">{text}</div>
    </div>
  );
}

function BotBubble({ text, isLoading }) {
  if (isLoading) {
    return (
      <div className="atMsgRow atMsgRowBot">
        <div className="atAvatar">🤖</div>
        <div className="atBubble atBubbleBot atBubbleLoading">
          <span className="atDot" /><span className="atDot" /><span className="atDot" />
        </div>
      </div>
    );
  }
  return (
    <div className="atMsgRow atMsgRowBot">
      <div className="atAvatar">🤖</div>
      <div className="atBubble atBubbleBot">
        {text.split("\n").map((line, i) =>
          line === "" ? <br key={i} /> : <p key={i}>{line}</p>
        )}
      </div>
    </div>
  );
}

/* ── Shared feature pieces ───────────────────────────────────── */

function FeatureHeader({ title, onExit }) {
  return (
    <div className="atFeatureHeader">
      <span className="atFeatureTitle">{title}</span>
      <button className="atQuizExitBtn" onClick={onExit}>✕ Exit</button>
    </div>
  );
}

function FeatureLoading({ label }) {
  return (
    <div className="atQuizLoading">
      <div style={{ display:"inline-flex", gap:6 }}>
        <span className="atDot" /><span className="atDot" /><span className="atDot" />
      </div>
      <p>{label || "Generating…"}</p>
    </div>
  );
}

function QuizProgress({ current, total }) {
  const pct = Math.round((current / total) * 100);
  return (
    <div className="atQuizProgress">
      <div className="atQuizProgressTop">
        <span className="atQuizProgressLabel">Question {current} of {total}</span>
        <span className="atQuizProgressPct">{pct}%</span>
      </div>
      <div className="atQuizProgressBar">
        <div className="atQuizProgressFill" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

function QuizQuestion({ q, selected, onSelect }) {
  return (
    <div className="atQuizQuestion">
      <p className="atQuizQuestionText">{q.question}</p>
      <div className="atQuizOptions">
        {q.options.map((opt, i) => {
          const letter = ["A","B","C","D"][i];
          return (
            <button
              key={i}
              className={`atQuizOption ${selected === letter ? "atQuizOptionSelected" : ""}`}
              onClick={() => onSelect(letter)}
            >
              <span className="atQuizOptionLetter">{letter}</span>
              <span className="atQuizOptionText">{opt.replace(/^[A-D][).]\s*/i,"")}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function QuizResults({ quiz, userAnswers, onRetry, onClose }) {
  const score = quiz.questions.reduce((acc, q, i) => acc + (userAnswers[i] === q.answer ? 1 : 0), 0);
  const total = quiz.questions.length;
  const pct   = Math.round((score / total) * 100);
  return (
    <div className="atQuizResults">
      <div className="atQuizScoreCard">
        <div className="atQuizScoreCircle">
          <span className="atQuizScoreNum">{score}/{total}</span>
          <span className="atQuizScoreLabel">Score</span>
        </div>
        <div>
          <p className="atQuizScoreTitle">{pct >= 80 ? "🎉 Great work!" : pct >= 50 ? "👍 Good effort!" : "📖 Keep studying!"}</p>
          <p className="atQuizScoreSub">{pct}% correct</p>
        </div>
      </div>
      <div className="atQuizReview">
        {quiz.questions.map((q, i) => {
          const correct = userAnswers[i] === q.answer;
          const letters = ["A","B","C","D"];
          return (
            <div key={i} className={`atQuizReviewItem ${correct ? "atQuizReviewCorrect" : "atQuizReviewWrong"}`}>
              <div className="atQuizReviewHeader">
                <span className="atQuizReviewIcon">{correct ? "✅" : "❌"}</span>
                <span className="atQuizReviewQ">Q{i+1}: {q.question}</span>
              </div>
              <div className="atQuizReviewAnswers">
                {!correct && (
                  <p className="atQuizReviewYours">Your answer: <strong>{userAnswers[i]}) {q.options[letters.indexOf(userAnswers[i])]?.replace(/^[A-D][).]\s*/i,"") ?? "—"}</strong></p>
                )}
                <p className="atQuizReviewCorrectAns">Correct: <strong>{q.answer}) {q.options[letters.indexOf(q.answer)]?.replace(/^[A-D][).]\s*/i,"")}</strong></p>
                {q.explanation && <p className="atQuizReviewExplanation">{q.explanation}</p>}
              </div>
            </div>
          );
        })}
      </div>
      <div className="atQuizResultBtns">
        <button className="atQuizRetryBtn" onClick={onRetry}>🔁 Retry</button>
        <button className="atQuizCloseBtn" onClick={onClose}>Back to Chat</button>
      </div>
    </div>
  );
}

/* ── Flashcard view ──────────────────────────────────────────── */

function FlashcardView({ cards, index, onNext, onStop }) {
  const [answer, setAnswer] = useState("");
  const [revealed, setRevealed] = useState(false);

  function handleReveal() { setRevealed(true); }
  function handleNext() { setAnswer(""); setRevealed(false); onNext(); }

  return (
    <div className="atFlashcard">
      <div className="atFlashcardProgress">
        <span>Card {index + 1} of {cards.length}</span>
        <div className="atQuizProgressBar" style={{ marginTop:6 }}>
          <div className="atQuizProgressFill" style={{ width:`${((index+1)/cards.length)*100}%` }} />
        </div>
      </div>

      <div className="atFlashcardCard">
        <p className="atFlashcardQuestion">{cards[index].question}</p>
      </div>

      {!revealed ? (
        <div className="atFlashcardInputArea">
          <textarea
            className="atFlashcardInput"
            placeholder="Type your answer…"
            value={answer}
            onChange={(e) => setAnswer(e.target.value)}
            rows={3}
          />
          <button className="atQuizNextBtn" onClick={handleReveal} disabled={!answer.trim()}>
            Reveal Answer
          </button>
        </div>
      ) : (
        <div className="atFlashcardReveal">
          {answer.trim() && (
            <div className="atFlashcardYours">
              <span className="atFlashcardLabel atFlashcardLabelYours">Your answer</span>
              <p>{answer}</p>
            </div>
          )}
          <div className="atFlashcardCorrect">
            <span className="atFlashcardLabel atFlashcardLabelCorrect">✅ Correct answer</span>
            <p>{cards[index].answer}</p>
          </div>
          <div className="atFlashcardActions">
            {index + 1 < cards.length
              ? <button className="atQuizNextBtn" onClick={handleNext}>Next Card →</button>
              : <button className="atQuizNextBtn" onClick={onStop}>Finish</button>
            }
            <button className="atQuizCloseBtn" onClick={onStop}>Stop</button>
          </div>
        </div>
      )}
    </div>
  );
}

/* ── Study plan view ─────────────────────────────────────────── */

const DAY_COLORS = {
  Monday:"#dbeafe", Tuesday:"#ede9fe", Wednesday:"#dcfce7",
  Thursday:"#fef9c3", Friday:"#ffe4e6", Saturday:"#e0f2fe", Sunday:"#f3f4f6",
};

function StudyPlanView({ plan, onClose }) {
  return (
    <div className="atStudyPlan">
      <p className="atStudyPlanMeta">⏱ {plan.dailyHours} hour{plan.dailyHours !== 1 ? "s" : ""} per day · 7-day plan</p>
      <div className="atStudyPlanGrid">
        {plan.schedule.map((day) => (
          <div key={day.day} className="atStudyPlanDay" style={{ background: DAY_COLORS[day.day] || "#f9fafb" }}>
            <p className="atStudyPlanDayLabel">{day.day}</p>
            {day.sessions.map((s, i) => (
              <div key={i} className="atStudyPlanSession">
                <span className="atStudyPlanDuration">{s.duration}</span>
                <div>
                  <p className="atStudyPlanTopic">{s.topic}</p>
                  <p className="atStudyPlanActivity">{s.activity}</p>
                </div>
              </div>
            ))}
          </div>
        ))}
      </div>
      <div className="atQuizResultBtns">
        <button className="atQuizCloseBtn" onClick={onClose}>Back to Chat</button>
      </div>
    </div>
  );
}

/* ── Topics view ─────────────────────────────────────────────── */

const PRIORITY = {
  high:   { label:"🔴 High Priority",   bg:"#fee2e2", text:"#b91c1c", chip:"#fecaca" },
  medium: { label:"🟡 Medium Priority", bg:"#fef9c3", text:"#854d0e", chip:"#fef08a" },
  low:    { label:"🟢 Low Priority",    bg:"#dcfce7", text:"#166534", chip:"#bbf7d0" },
};

function TopicsView({ data, onClose }) {
  const grouped = { high:[], medium:[], low:[] };
  data.topics.forEach((t) => { (grouped[t.priority] || grouped.medium).push(t); });

  return (
    <div className="atTopics">
      {["high","medium","low"].map((p) => grouped[p].length > 0 && (
        <div key={p} className="atTopicsGroup">
          <p className="atTopicsGroupLabel" style={{ color: PRIORITY[p].text }}>{PRIORITY[p].label}</p>
          <div className="atTopicsCards">
            {grouped[p].map((t, i) => (
              <div key={i} className="atTopicCard" style={{ borderLeftColor: PRIORITY[p].text }}>
                <p className="atTopicName">{t.name}</p>
                <p className="atTopicDesc">{t.description}</p>
                {t.subtopics?.length > 0 && (
                  <div className="atTopicSubs">
                    {t.subtopics.map((s, j) => (
                      <span key={j} className="atTopicSub" style={{ background: PRIORITY[p].chip, color: PRIORITY[p].text }}>{s}</span>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      ))}
      <div className="atQuizResultBtns">
        <button className="atQuizCloseBtn" onClick={onClose}>Back to Chat</button>
      </div>
    </div>
  );
}

/* ── Context picker modal ────────────────────────────────────── */

function ContextPicker({ tutoringClasses, studyGroups, classesLoading, groupsLoading, onSelect, onClose }) {
  const hasTabs = true;
  const [tab, setTab] = useState("tutoring");
  const [customTopic, setCustomTopic] = useState("");
  const items     = tab === "tutoring" ? tutoringClasses : studyGroups;
  const isLoading = tab === "tutoring" ? classesLoading : groupsLoading;

  function toCtx(item, src) {
    return {
      source: src,
      moduleCode: item.moduleCode || item.courseCode || "N/A",
      title: item.title || item.name || "N/A",
      topic: item.topic || "",
      description: item.description || "",
    };
  }

  function handleCustomSubmit() {
    const t = customTopic.trim();
    if (!t) return;
    onSelect({ source: "custom", moduleCode: "N/A", title: t, topic: t, description: "" });
  }

  return (
    <div className="atModal">
      <div className="atModalCard">
        <div className="atModalTop">
          <h3 className="atModalTitle">Select a class or group</h3>
          <button className="atClassPickerClose" onClick={onClose}>✕</button>
        </div>

        {/* Custom topic input */}
        <div className="atCustomTopicRow">
          <input
            className="atCustomTopicInput"
            type="text"
            placeholder="Or type a topic / subject…"
            value={customTopic}
            onChange={(e) => setCustomTopic(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") handleCustomSubmit(); }}
          />
          <button
            className="atCustomTopicBtn"
            onClick={handleCustomSubmit}
            disabled={!customTopic.trim()}
          >
            Go →
          </button>
        </div>

        <div className="atPickerDivider"><span>or choose from your classes and groups</span></div>

        {hasTabs && (
          <div className="atModalTabs">
            <button className={`atModalTab ${tab==="tutoring"?"active":""}`} onClick={() => setTab("tutoring")}>Peer Tutoring</button>
            <button className={`atModalTab ${tab==="groups"?"active":""}`}   onClick={() => setTab("groups")}>Study Groups</button>
          </div>
        )}

        {isLoading && <p className="atClassPickerMsg">Loading…</p>}
        {!isLoading && items.length === 0 && (
          <p className="atClassPickerMsg">No {tab==="tutoring" ? "tutoring classes" : "joined or managed study groups"} found.</p>
        )}

        <div className="atClassPickerList">
          {items.map((item) => (
            <button key={item.id} className="atClassPickerItem" onClick={() => onSelect(toCtx(item, tab))}>
              <span className="atClassPickerCode">{item.moduleCode || item.courseCode || "General"}</span>
              <span className="atClassPickerTitle">{item.title || item.name}</span>
              {item.topic && <span className="atClassPickerTopic">{item.topic}</span>}
            </button>
          ))}
        </div>

        <button className="atClassPickerGeneral" style={{ marginTop:8 }} onClick={() => onSelect(null)}>
          Skip — generate without context →
        </button>
      </div>
    </div>
  );
}

/* ── Study time picker modal ─────────────────────────────────── */

const STUDY_TIMES = [
  { label:"30 min", hours:0.5 },
  { label:"1 hour", hours:1 },
  { label:"1.5 hours", hours:1.5 },
  { label:"2 hours", hours:2 },
  { label:"3+ hours", hours:3 },
];

function StudyTimePicker({ context, onSelect, onClose }) {
  return (
    <div className="atModal">
      <div className="atModalCard">
        <div className="atModalTop">
          <h3 className="atModalTitle">How long can you study each day?</h3>
          <button className="atClassPickerClose" onClick={onClose}>✕</button>
        </div>
        {context && (
          <p className="atModalContext">
            <span className="atClassPickerCode">{context.moduleCode}</span> {context.title}
          </p>
        )}
        <div className="atStudyTimeGrid">
          {STUDY_TIMES.map((opt) => (
            <button key={opt.hours} className="atStudyTimeBtn" onClick={() => onSelect(opt.hours)}>
              ⏱ {opt.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ── Main component ──────────────────────────────────────────── */

const FEATURE_LABEL = {
  quiz:"📝 Quiz", exam:"📄 Exam", flashcard:"🃏 Flashcards",
  studyplan:"🗓️ Study Plan", topics:"💡 Topic Suggestions",
};

export default function AiTutor({ embedded = false }) {
  const nav = useNavigate();

  /* Chat */
  const [messages, setMessages] = useState([{ role:"bot",
    text:"Hi! I'm your AI Study Tutor 👋\n\nI can help you understand topics, generate quizzes, build study plans, make flashcards, and guide you around PeerConnect.\n\nWhat would you like to do today?" }]);
  const [input, setInput]           = useState("");
  const [chatLoading, setChatLoading] = useState(false);
  const [chatError, setChatError]   = useState("");
  const messagesRef = useRef(null);

  /* Feature mode */
  const [featureType, setFeatureType] = useState(null);
  const [featureStep, setFeatureStep] = useState(null); // picker|studytime|loading|active|done|error
  const [featureCtx,  setFeatureCtx]  = useState(null);
  const [featureData, setFeatureData] = useState(null);
  const [featureErr,  setFeatureErr]  = useState("");

  /* Quiz / Exam state */
  const [qIndex,    setQIndex]    = useState(0);
  const [qSelected, setQSelected] = useState(null);
  const [qAnswers,  setQAnswers]  = useState([]);

  /* Flashcard state */
  const [fcIndex, setFcIndex] = useState(0);

  /* Well-being follow-up */
  const [wellbeingFollowUp, setWellbeingFollowUp] = useState(false);

  /* Remote data */
  const [tutoringClasses, setTutoringClasses] = useState([]);
  const [studyGroups,     setStudyGroups]     = useState([]);
  const [classesLoading,  setClassesLoading]  = useState(false);
  const [groupsLoading,   setGroupsLoading]   = useState(false);
  const [userProfile,     setUserProfile]     = useState(null);
  const [restrictedUsers, setRestrictedUsers] = useState([]);

  useEffect(() => {
    const el = messagesRef.current;
    if (!el) return;
    el.scrollTo({ top: el.scrollHeight, behavior:"smooth" });
  }, [messages, chatLoading]);

  /* Fetch profile + context data on mount */
  async function fetchUserProfile() {
    try {
      const res = await fetch(`${API_BASE}/api/profile`, { headers: authHeaders(), credentials: "include" });
      if (!res.ok) return null;
      const data = await res.json().catch(() => null);
      if (data) setUserProfile(data);
      return data;
    } catch {
      return null;
    }
  }

  useEffect(() => {
    fetchUserProfile();

    fetch(`${API_BASE}/api/tutoring/classes`, { headers: authHeaders(), credentials: "include" })
      .then((r) => r.ok ? r.json() : [])
      .then((d) => setTutoringClasses(Array.isArray(d) ? d : []))
      .catch(() => {});

    fetch(`${API_BASE}/api/groups`, { headers: authHeaders(), credentials: "include" })
      .then((r) => r.ok ? r.json() : [])
      .then((d) => setStudyGroups(Array.isArray(d) ? d : []))
      .catch(() => {});

    fetch(`${API_BASE}/api/restricted-users`, { headers: authHeaders(), credentials: "include" })
      .then((r) => r.ok ? r.json() : [])
      .then((d) => setRestrictedUsers(Array.isArray(d) ? d : []))
      .catch(() => {});
  }, []);

  /* ── Data fetching ─────────────────────────────────────────── */
  async function fetchTutoring() {
    if (tutoringClasses.length > 0) return tutoringClasses;
    setClassesLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/tutoring/classes`, { headers:authHeaders(), credentials:"include" });
      const d   = await res.json().catch(() => []);
      const nextClasses = Array.isArray(d) ? d : [];
      setTutoringClasses(nextClasses);
      return nextClasses;
    } catch {
      setTutoringClasses([]);
      return [];
    } finally {
      setClassesLoading(false);
    }
  }

  async function fetchGroups() {
    if (studyGroups.length > 0) return studyGroups;
    setGroupsLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/groups`, { headers:authHeaders(), credentials:"include" });
      const d   = await res.json().catch(() => []);
      const nextGroups = Array.isArray(d) ? d : [];
      setStudyGroups(nextGroups);
      return nextGroups;
    } catch {
      setStudyGroups([]);
      return [];
    } finally {
      setGroupsLoading(false);
    }
  }

  async function fetchRestrictedUsers() {
    if (restrictedUsers.length > 0) return restrictedUsers;
    try {
      const res = await fetch(`${API_BASE}/api/restricted-users`, { headers:authHeaders(), credentials:"include" });
      const d   = await res.json().catch(() => []);
      const nextRestrictedUsers = Array.isArray(d) ? d : [];
      setRestrictedUsers(nextRestrictedUsers);
      return nextRestrictedUsers;
    } catch {
      setRestrictedUsers([]);
      return [];
    }
  }

  /* ── Feature launch ────────────────────────────────────────── */
  function startFeature(type) {
    setFeatureType(type); setFeatureStep("picker");
    setFeatureData(null); setFeatureErr("");
    setQIndex(0); setQSelected(null); setQAnswers([]);
    setFcIndex(0);
    fetchTutoring();
    fetchGroups();
  }

  function exitFeature() {
    setFeatureType(null); setFeatureStep(null);
    setFeatureData(null); setFeatureErr("");
  }

  /* ── Context chosen ────────────────────────────────────────── */
  function handleContextSelected(ctx) {
    setFeatureCtx(ctx);
    if (featureType === "studyplan") { setFeatureStep("studytime"); return; }
    runGenerate(featureType, ctx, null);
  }

  /* ── Generation ────────────────────────────────────────────── */
  async function runGenerate(type, ctx, hours) {
    setFeatureStep("loading"); setFeatureErr("");
    const ctxStr = buildContextStr(ctx);
    try {
      const builder = PromptFactory.create(type);
      const prompt = builder.build(ctxStr, type === "studyplan" ? hours : type);

      const parsed = await callAI(prompt);

      if ((type==="quiz"||type==="exam") && !Array.isArray(parsed.questions)) throw new Error("Invalid quiz format");
      if (type==="flashcard" && !Array.isArray(parsed.cards))    throw new Error("Invalid flashcard format");
      if (type==="studyplan" && !Array.isArray(parsed.schedule)) throw new Error("Invalid study plan format");
      if (type==="topics"    && !Array.isArray(parsed.topics))   throw new Error("Invalid topics format");


      setFeatureData(parsed); setFeatureStep("active");
    } catch (err) {
      setFeatureErr("Couldn't generate content. " + err.message);
      setFeatureStep("error");
    }
  }

  /* ── Quiz navigation ───────────────────────────────────────── */
  function handleNextQ() {
    if (!qSelected) return;
    const next = [...qAnswers, qSelected];
    setQAnswers(next); setQSelected(null);
    if (qIndex + 1 < featureData.questions.length) setQIndex(qIndex + 1);
    else setFeatureStep("done");
  }

  /* ── System context ────────────────────────────────────────── */
  function detectTopic(message) {
    const text = normalizeLower(message);
    let detected = "general";
    if (isStudyGroupMessage(text)) detected = "studygroup";
    else if (/(peer tutoring|peer tutor|tutoring class)/.test(text)) detected = "peertutoring";
    else if (/(restricted|blocked|restrict|restricted members?)/.test(text)) detected = "restrictedmembers";
    else if (/(profile|major|faculty|year of study|bio|full-time|part-time)/.test(text)) detected = "profile";
    return detected;
  }

  function buildSystemContext(topic = "general", profileOverride = userProfile, contextOverrides = {}) {
    const includeTutoring = topic === "general" || topic === "peertutoring";
    const includeStudyGroups = topic === "general" || topic === "studygroup";
    const includeRestrictedMembers = topic === "general" || topic === "restrictedmembers";
    const includeProfile = topic === "general" || topic === "profile";
    const peerTutoringScope = contextOverrides.peerTutoringScope || "full";
    const includeCreatedPeerTutoring = peerTutoringScope !== "joinableOnly";
    const activeProfile = profileOverride || userProfile;
    const activeTutoringClasses = Array.isArray(contextOverrides.tutoringClasses) ? contextOverrides.tutoringClasses : tutoringClasses;
    const activeStudyGroups = Array.isArray(contextOverrides.studyGroups) ? contextOverrides.studyGroups : studyGroups;
    const activeRestrictedUsers = Array.isArray(contextOverrides.restrictedUsers) ? contextOverrides.restrictedUsers : restrictedUsers;

    const lines = [
      "You are an AI Study Tutor embedded in PeerConnect, a university peer learning platform.",
      "",
      "## PeerConnect Features",
      "- **Study Groups**: Students create or join groups to study together. Each group has a title, description, subject, and schedule.",
      "- **Peer Tutoring**: Students sign up as tutors or tutees for specific modules. Tutoring classes have a module code, title, topic, and description.",
      "- **AI Study Tutor (you)**: Generates quizzes, flashcards, study plans, topic suggestions, and exam-style questions linked to the user's classes.",
      "- **Restricted Members**: Users in this list are blocked from joining the user's groups until the user allows them again.",
      "- **Well-being Support**: Tips and resources for student mental health and stress management.",
      "- **Profile**: Users set their faculty, major, year of study, and bio.",
      "- **Navigation**: Sidebar links — Home/Dashboard, AI Tutor, Profile, Contact.",
      "",
    ];

    if (includeTutoring) {
      const groupedTutoringClasses = partitionTutoringClasses(activeTutoringClasses, activeProfile);

      if (includeCreatedPeerTutoring) {
        lines.push("## Peer Tutoring Classes Created/Taught by the User");
        if (groupedTutoringClasses.created.length === 0) {
          lines.push("- No created peer tutoring classes found in the current context.");
        } else {
          groupedTutoringClasses.created.forEach((c) => {
            const enrollment = c.enrolledCount !== undefined ? `${c.enrolledCount}${c.maxStudents ? `/${c.maxStudents}` : ""} enrolled` : null;
            const parts = [
              `[${c.moduleCode || "N/A"}] ${c.title || c.name}`,
              c.topic ? `Topic: ${c.topic}` : null,
              c.description ? `Description: ${c.description}` : null,
              enrollment,
            ].filter(Boolean);
            lines.push(`- ${parts.join(" | ")}`);
          });
        }
        lines.push("");
      }

      lines.push("## User's Peer Tutoring Classes");
      if (groupedTutoringClasses.enrolled.length === 0) {
        lines.push("- No peer tutoring classes found in the current context.");
      } else {
        groupedTutoringClasses.enrolled.forEach((c) => {
          const role = c.isTutor ? "Tutor" : "Tutee";
          const tutor = c.tutorName ? `Tutor: ${c.tutorName.split(" ").filter((p) => p && p !== "null" && p !== "undefined").join(" ")}` : null;
          const enrollment = c.enrolledCount !== undefined ? `${c.enrolledCount}${c.maxStudents ? `/${c.maxStudents}` : ""} enrolled` : null;
          const parts = [
            `[${c.moduleCode || "N/A"}] ${c.title || c.name}`,
            `Role: ${role}`,
            tutor,
            c.topic ? `Topic: ${c.topic}` : null,
            c.description ? `Description: ${c.description}` : null,
            enrollment,
          ].filter(Boolean);
          lines.push(`- ${parts.join(" | ")}`);
        });
      }
      lines.push("");

      lines.push("## Other Available Peer Tutoring Classes (user can still join)");
      if (groupedTutoringClasses.available.length === 0) {
        lines.push("- No other available peer tutoring classes found in the current context.");
      } else {
        groupedTutoringClasses.available.forEach((c) => {
          const tutor = c.tutorName ? `Tutor: ${c.tutorName.split(" ").filter((p) => p && p !== "null" && p !== "undefined").join(" ")}` : null;
          const enrollment = c.enrolledCount !== undefined ? `${c.enrolledCount}${c.maxStudents ? `/${c.maxStudents}` : ""} enrolled` : null;
          const parts = [
            `[${c.moduleCode || "N/A"}] ${c.title || c.name}`,
            tutor,
            c.topic ? `Topic: ${c.topic}` : null,
            c.description ? `Description: ${c.description}` : null,
            enrollment,
          ].filter(Boolean);
          lines.push(`- ${parts.join(" | ")}`);
        });
      }
      lines.push("");
    }

    const groupedStudyGroups = partitionStudyGroups(activeStudyGroups, activeProfile);
    const myGroups = groupedStudyGroups.owner;
    const joinedGroups = groupedStudyGroups.joined;
    const pendingGroups = groupedStudyGroups.pending;
    const availableGroups = groupedStudyGroups.available;

    function fmtGroup(g, role) {
      const members = g.memberCount !== undefined ? `${g.memberCount}${g.maxMembers ? `/${g.maxMembers}` : ""} members` : null;
      const status = g.status && g.status !== "active" ? `Status: ${g.status}` : null;
      const parts = [
        `**${g.name || g.title}**`,
        g.moduleCode || g.courseCode ? `[${g.moduleCode || g.courseCode}]` : null,
        g.subject ? `[${g.subject}]` : null,
        role ? `Role: ${role}` : null,
        g.topic ? `Topic: ${g.topic}` : null,
        g.preferredSchedule ? `Schedule: ${g.preferredSchedule}` : null,
        members,
        status,
        g.description || null,
      ].filter(Boolean);
      return `- ${parts.join(" | ")}`;
    }

    if (includeStudyGroups) {
      lines.push("## Study Groups Created/Managed by the User");
      if (myGroups.length === 0) lines.push("- No study groups created or managed by the user in the current context.");
      else myGroups.forEach((g) => lines.push(fmtGroup(g, "Owner/Admin")));
      lines.push("");

      lines.push("## Study Groups the User Has Joined (as member)");
      if (joinedGroups.length === 0) lines.push("- No joined study groups found in the current context.");
      else joinedGroups.forEach((g) => lines.push(fmtGroup(g, "Member")));
      lines.push("");

      lines.push("## Study Groups the User Has Requested to Join (pending approval)");
      if (pendingGroups.length === 0) lines.push("- No pending study-group requests found in the current context.");
      else pendingGroups.forEach((g) => lines.push(fmtGroup(g, null)));
      lines.push("");

      lines.push("## Other Available Study Groups (user has NOT joined)");
      if (availableGroups.length === 0) lines.push("- No other available study groups found in the current context.");
      else availableGroups.forEach((g) => lines.push(fmtGroup(g, null)));
      lines.push("");
    }

    if (includeRestrictedMembers) {
      lines.push("## User's Restricted Members");
      if (activeRestrictedUsers.length === 0) {
        lines.push("- No restricted members found in the current context.");
      } else {
        activeRestrictedUsers.forEach((u) => {
          const name = [u.firstName, u.lastName].filter(Boolean).join(" ") || u.fullName || u.email || "Unknown user";
          const parts = [
            name,
            u.email ? `Email: ${u.email}` : null,
            u.createdAt ? `Restricted since: ${u.createdAt}` : null,
          ].filter(Boolean);
          lines.push(`- ${parts.join(" | ")}`);
        });
      }
      lines.push("");
    }

    if (includeProfile && activeProfile) {
      lines.push("## User Profile");
      if (activeProfile.faculty)     lines.push(`- Faculty: ${activeProfile.faculty}`);
      if (activeProfile.major)       lines.push(`- Major: ${activeProfile.major}`);
      if (activeProfile.yearOfStudy) lines.push(`- Year of Study: ${activeProfile.yearOfStudy}`);
      if (activeProfile.fullTime !== undefined) lines.push(`- Mode: ${activeProfile.fullTime ? "Full-time" : "Part-time"}`);
      if (activeProfile.bio)         lines.push(`- Bio: ${activeProfile.bio}`);
      lines.push("");
    }

    lines.push("## IMPORTANT INSTRUCTIONS — READ CAREFULLY");
    lines.push("- STUDY GROUPS vs PEER TUTORING are two completely separate features. Never mix their data.");
    lines.push("- When the user asks about STUDY GROUPS (joined, managed, topics for study groups, etc.): use ONLY the 'Study Groups' sections above. Do NOT use peer tutoring class data.");
    lines.push("- When the user asks about PEER TUTORING (tutoring classes, tutor/tutee role, module topics): use ONLY the peer-tutoring sections above. Do NOT use study group data.");
    lines.push("- Never say you do not have access to the user's peer tutoring classes if the 'User's Peer Tutoring Classes' section is present. If that section says no classes were found, say that no peer tutoring classes were found in the current context.");
    lines.push("- If the user asks which peer tutoring classes they can still join, answer ONLY from the 'Other Available Peer Tutoring Classes (user can still join)' section and do not list already-enrolled classes as joinable.");
    lines.push("- If the user asks which peer tutoring classes they created, teach, or manage, answer ONLY from the 'Peer Tutoring Classes Created/Taught by the User' section.");
    lines.push("- TOPIC SUGGESTIONS FOR STUDY GROUPS: If asked to suggest topics for study groups, base suggestions ONLY on the names, subjects, and descriptions from the 'Study Groups Joined/Managed' sections. If no study groups are listed, say the user has not joined any study groups yet.");
    lines.push("- TOPIC SUGGESTIONS FOR PEER TUTORING: If asked to suggest topics for tutoring, base suggestions ONLY on the peer tutoring class data.");
    lines.push("- Never use the user's faculty, major, or bio to answer questions about study groups or peer tutoring.");
    lines.push("- do not say the user has not joined any study groups if groups appear in the joined or managed sections above.");
    lines.push("- If the user asks about restricted members, answer from the provided restricted-member list and explain that restricted users cannot join the user's groups until allowed again.");
    lines.push("- For profile questions, use ONLY the fields explicitly listed in the 'User Profile' section. Do not claim access to name, email, modules, or avatar unless those details are actually present there.");
    lines.push("- For all other questions, use the full context above to give personalised, accurate answers.");
    return lines.join("\n");
  }

  /* ── Chat ──────────────────────────────────────────────────── */
  const WELLBEING_PROMPT = "Give me one random well-being tip to help with student stress, focus, or mental health. Keep it short, practical, and different each time. Do not add any follow-up question at the end.";

  async function sendChatRequest(trimmed, isWellbeing = false) {
    setChatError("");
    setMessages((p) => [...p, { role:"user", text:trimmed }]);
    setChatLoading(true);
    setWellbeingFollowUp(false);
    try {
      const { aiMessage, topic, focusInstruction } = buildChatRequestMeta(trimmed, isWellbeing, detectTopic);
      let profileForContext = userProfile;
      let studyGroupsForContext = studyGroups;
      let tutoringClassesForContext = tutoringClasses;
      let restrictedUsersForContext = restrictedUsers;
      let additionalInstruction = null;

      if (topic === "profile" && !hasProfileContextData(profileForContext)) {
        profileForContext = await fetchUserProfile();
      }

      if (topic === "studygroup" && studyGroupsForContext.length === 0) {
        studyGroupsForContext = await fetchGroups();
      }

      if (topic === "peertutoring" && tutoringClassesForContext.length === 0) {
        tutoringClassesForContext = await fetchTutoring();
      }

      if (topic === "restrictedmembers" && restrictedUsersForContext.length === 0) {
        restrictedUsersForContext = await fetchRestrictedUsers();
      }

      if (topic === "studygroup" && isAvailableStudyGroupQuestion(aiMessage)) {
        additionalInstruction = buildAvailableStudyGroupsInstruction(studyGroupsForContext, profileForContext);
      }

      if (topic === "peertutoring" && isAvailablePeerTutoringQuestion(aiMessage)) {
        additionalInstruction = buildAvailablePeerTutoringInstruction(tutoringClassesForContext, profileForContext);
      }

      if (topic === "peertutoring" && isCreatedPeerTutoringQuestion(aiMessage)) {
        additionalInstruction = buildCreatedPeerTutoringInstruction(tutoringClassesForContext, profileForContext);
      }

      if (topic === "profile") {
        additionalInstruction = buildProfileInstruction(profileForContext);
      }

      if (topic === "restrictedmembers") {
        additionalInstruction = buildRestrictedMembersInstruction(restrictedUsersForContext);
      }

      const history = [
        {
          role: "system",
          content: buildSystemContext(topic, profileForContext, {
            studyGroups: studyGroupsForContext,
            tutoringClasses: tutoringClassesForContext,
            restrictedUsers: restrictedUsersForContext,
            peerTutoringScope: topic === "peertutoring" && isAvailablePeerTutoringQuestion(aiMessage)
              ? "joinableOnly"
              : "full",
          }),
        },
        { role: "system", content: focusInstruction },
        ...(additionalInstruction ? [{ role: "system", content: additionalInstruction }] : []),
        ...messages.map((m) => ({ role: m.role==="bot"?"assistant":"user", content: m.text })),
      ];
      const res  = await fetch(`${API_BASE}/api/ai-tutor/chat`, {
        method:"POST", headers:authHeaders(), credentials:"include",
        body: JSON.stringify({ message:aiMessage, history }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || `Request failed (${res.status})`);
      setMessages((p) => [...p, { role:"bot", text:data.reply }]);
      if (isWellbeing) setWellbeingFollowUp(true);
    } catch (err) {
      setChatError(err.message);
      setMessages((p) => [...p, { role:"bot", text:"Sorry, I ran into an issue. Please try again." }]);
    } finally { setChatLoading(false); }
  }

  const sendChatRequestRef = useRef(sendChatRequest);
  useEffect(() => { sendChatRequestRef.current = sendChatRequest; });

  const sendMessage = useCallback(async (text) => {
    const trimmed = (text ?? input).trim();
    if (!trimmed || chatLoading) return;
    setInput("");
    await sendChatRequestRef.current(trimmed, false);
  }, [input, chatLoading]);

  function sendWellbeingTip() {
    if (chatLoading) return;
    sendChatRequestRef.current(WELLBEING_PROMPT, true);
  }

  function handleKeyDown(e) {
    if (e.key==="Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(); }
  }

  /* ── Render ─────────────────────────────────────────────────── */
  const inFeature = featureType !== null;
  const groupedStudyGroups = partitionStudyGroups(studyGroups, userProfile);
  const contextStudyGroups = [
    ...groupedStudyGroups.owner,
    ...groupedStudyGroups.joined,
    ...groupedStudyGroups.pending,
  ];

  return (
    <div className={embedded ? "atEmbedded" : "atPage"}>
      {!embedded && (
        <div className="atHeader">
          <button className="atBackBtn" onClick={() => nav("/")}>← Back to Dashboard</button>
          <div className="atHeaderInfo">
            <div className="atHeaderAvatar">🤖</div>
            <div>
              <h1 className="atTitle">AI Study Tutor</h1>
              <p className="atSubtitle">Powered by AI · Always here to help</p>
            </div>
          </div>
        </div>
      )}

      <div className="atLayout">
        <div className="atChatPanel">

          {/* ── MODALS ──────────────────────────────────────── */}
          {inFeature && featureStep === "picker" && (
            <ContextPicker
              tutoringClasses={tutoringClasses}
              studyGroups={contextStudyGroups}
              classesLoading={classesLoading}
              groupsLoading={groupsLoading}
              onSelect={handleContextSelected}
              onClose={exitFeature}
            />
          )}

          {inFeature && featureStep === "studytime" && (
            <StudyTimePicker
              context={featureCtx}
              onSelect={(h) => runGenerate("studyplan", featureCtx, h)}
              onClose={exitFeature}
            />
          )}

          {/* ── FEATURE CONTENT ─────────────────────────────── */}
          {inFeature && !["picker","studytime"].includes(featureStep) && (
            <div className="atFeaturePanel">
              {featureStep === "loading" && (
                <FeatureLoading label={`Generating your ${FEATURE_LABEL[featureType]}…`} />
              )}

              {featureStep === "error" && (
                <div className="atQuizError">
                  <p>{featureErr}</p>
                  <button className="atQuizCloseBtn" onClick={exitFeature}>Back to Chat</button>
                </div>
              )}

              {/* Quiz / Exam — active */}
              {featureStep === "active" && (featureType==="quiz"||featureType==="exam") && featureData && (
                <>
                  <FeatureHeader title={`${FEATURE_LABEL[featureType]}: ${featureData.title}`} onExit={exitFeature} />
                  <QuizProgress current={qIndex+1} total={featureData.questions.length} />
                  <QuizQuestion q={featureData.questions[qIndex]} selected={qSelected} onSelect={setQSelected} />
                  <div className="atQuizActions">
                    <button className="atQuizNextBtn" disabled={!qSelected} onClick={handleNextQ}>
                      {qIndex+1 < featureData.questions.length ? "Next Question →" : "Finish"}
                    </button>
                  </div>
                </>
              )}

              {/* Quiz / Exam — results */}
              {featureStep === "done" && (featureType==="quiz"||featureType==="exam") && featureData && (
                <QuizResults
                  quiz={featureData}
                  userAnswers={qAnswers}
                  onRetry={() => { setQIndex(0); setQSelected(null); setQAnswers([]); runGenerate(featureType, featureCtx, null); }}
                  onClose={exitFeature}
                />
              )}

              {/* Flashcards */}
              {featureStep === "active" && featureType === "flashcard" && featureData && (
                <>
                  <FeatureHeader title={`🃏 ${featureData.title}`} onExit={exitFeature} />
                  {fcIndex < featureData.cards.length ? (
                    <FlashcardView
                      cards={featureData.cards}
                      index={fcIndex}
                      onNext={() => setFcIndex(fcIndex+1)}
                      onStop={exitFeature}
                    />
                  ) : (
                    <div className="atQuizLoading">
                      <p style={{ fontSize:36 }}>🎉</p>
                      <p>You completed all {featureData.cards.length} flashcards!</p>
                      <div className="atQuizResultBtns" style={{ marginTop:16 }}>
                        <button className="atQuizRetryBtn" onClick={() => setFcIndex(0)}>🔁 Restart</button>
                        <button className="atQuizCloseBtn" onClick={exitFeature}>Back to Chat</button>
                      </div>
                    </div>
                  )}
                </>
              )}

              {/* Study Plan */}
              {featureStep === "active" && featureType === "studyplan" && featureData && (
                <>
                  <FeatureHeader title={`🗓️ ${featureData.title}`} onExit={exitFeature} />
                  <StudyPlanView plan={featureData} onClose={exitFeature} />
                </>
              )}

              {/* Topics */}
              {featureStep === "active" && featureType === "topics" && featureData && (
                <>
                  <FeatureHeader title={`💡 ${featureData.title}`} onExit={exitFeature} />
                  <TopicsView data={featureData} onClose={exitFeature} />
                </>
              )}
            </div>
          )}

          {/* ── CHAT ────────────────────────────────────────── */}
          {!inFeature && (
            <>
              <div className="atMessages" ref={messagesRef}>
                {messages.map((m,i) =>
                  m.role==="user" ? <UserBubble key={i} text={m.text} /> : <BotBubble key={i} text={m.text} />
                )}
                {chatLoading && <BotBubble isLoading />}
              </div>

              {wellbeingFollowUp && !chatLoading && (
                <div className="atWellbeingFollowUp">
                  <span className="atWellbeingFollowUpLabel">Would you like another tip?</span>
                  <button className="atWellbeingYes" onClick={sendWellbeingTip}>Yes</button>
                  <button className="atWellbeingNo"  onClick={() => setWellbeingFollowUp(false)}>No</button>
                </div>
              )}

              <div className="atSuggestions">
                {[
                  { id:"navigate", icon:"🧭", label:"How to navigate" },
                  { id:"quiz",     icon:"📝", label:"Generate a quiz" },
                  { id:"topics",   icon:"💡", label:"Suggest topics"  },
                ].map((s) => (
                  <button key={s.id} className="atChip" disabled={chatLoading} onClick={() => {
                    if (s.id==="quiz")   { startFeature("quiz");   return; }
                    if (s.id==="topics") { startFeature("topics"); return; }
                    sendMessage("How do I navigate and use this website?");
                  }}>
                    <span className="atChipIcon">{s.icon}</span>{s.label}
                  </button>
                ))}
              </div>

              <div className="atInputBar">
                <textarea
                  className="atInput" rows={1}
                  placeholder="Ask me anything about your studies…"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  disabled={chatLoading}
                />
                <button className="atSendBtn" onClick={() => sendMessage()} disabled={chatLoading||!input.trim()} aria-label="Send">➤</button>
              </div>
              {chatError && <p className="atError">{chatError}</p>}
            </>
          )}
        </div>

        {/* ── SIDEBAR ─────────────────────────────────────── */}
        <aside className="atSidebar">
          <h2 className="atSidebarTitle">Try these features</h2>
          <p className="atSidebarSubtitle">Tap to get started</p>
          <div className="atRecList">
            {[
              { id:"wellbeing",  icon:"🌿", label:"Well-being tips",       description:"Stress management & study wellness",    feature:"wellbeing" },
              { id:"studyplan",  icon:"🗓️", label:"Build a study plan",  description:"Weekly schedule tailored to your class", feature:"studyplan" },
              { id:"flashcards", icon:"🃏", label:"Make flashcards",     description:"Self-test with Q&A cards",               feature:"flashcard" },
              { id:"exam",       icon:"📄", label:"Exam-style questions",description:"20 harder MCQ questions for exam prep",  feature:"exam"      },
            ].map((r) => (
              <button key={r.id} className="atRecCard" onClick={() => {
                if (r.feature === "wellbeing") { sendWellbeingTip(); return; }
                startFeature(r.feature);
              }}>
                <span className="atRecIcon">{r.icon}</span>
                <div className="atRecText">
                  <span className="atRecLabel">{r.label}</span>
                  <span className="atRecDesc">{r.description}</span>
                </div>
                <span className="atRecArrow">›</span>
              </button>
            ))}
          </div>
          <div className="atSidebarTip">
            <span className="atSidebarTipIcon">💬</span>
            <p>All features use your <strong>actual class details</strong> for relevant, personalised content.</p>
          </div>
        </aside>
      </div>
    </div>
  );
}
