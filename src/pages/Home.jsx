import React from "react";
import Carousel from "../components/Carousel";
import FeatureCard from "../components/FeatureCard";

export default function Home() {
   const slides = [
    {
      title: "Find the right tutor",
      description: "Match with peers who have aced the same module.",
      imageSrc: "src/assets/images/tutoring.jpg",
      imageAlt: "Peer tutoring session",
    },
    {
      title: "Join study rooms",
      description: "Create or join groups that keep you consistent.",
      imageSrc: "src/assets/images/study-group.jpg",
      imageAlt: "Students in a study group",
    },
    {
      title: "Ask AI anytime",
      description: "Instant explanations with examples and practice.",
      imageSrc: "src/assets/images/chatbot.jpg",
      imageAlt: "AI chatbot assistance",
    },
      {
      title: "Support Groups",
      description: "Get accountability, encouragement, and guidance from peers.",
      imageSrc: "src/assets/images/support-system.jpg",
      imageAlt: "Students in a supportive group discussion",
    },
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
          <FeatureCard key ={f.title} title={f.title} description={f.desc}/>
        ))}
      </section>
    </div>
  );
}
