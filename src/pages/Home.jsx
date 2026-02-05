import React from "react";
import Carousel from "../components/Carousel";

export default function Home() {
  const slides = [
    { title: "Find the right tutor", description: "Match with peers who have aced the same module.", imageText: "Tutoring" },
    { title: "Join study groups", description: "Learn together with scheduled group sessions.", imageText: "Groups" },
    { title: "Ask the AI chatbot", description: "Get quick explanations and practice questions.", imageText: "AI Chat" },
  ];

  const features = [
    { title: "Peer tutoring system", desc: "Book 1:1 sessions with peer tutors who know your module." },
    { title: "Study Groups", desc: "Collaborative learning rooms with shared goals and schedules." },
    { title: "AI Chatbot", desc: "Instant explanations, examples, and revision questions." },
    { title: "Support System", desc: "Help center, FAQs, and assistance when you get stuck." },
  ];

  return (
    <div className="page">
      <Carousel slides={slides} autoPlayMs={0} />

      <section className="featureRow">
        {features.map((f) => (
          <article key={f.title} className="featureCard">
            <div className="featureCardTitle">{f.title}</div>
            <div className="featureCardDesc">{f.desc}</div>
          </article>
        ))}
      </section>
    </div>
  );
}
